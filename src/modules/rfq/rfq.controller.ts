import { Request, Response } from "express";
import Store from "../store/store.model";
import Client from "../client/client.model";
import ExcelJS from "exceljs";
import archiver from "archiver";
import path from "path";

interface SkippedStore {
  storeId: string;
  reason: string;
}

export const generateRFQ = async (req: Request, res: Response) => {
  try {
    const { storeIds } = req.body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ message: "No stores selected" });
    }

    const validStores: Array<{ storeId: string; buffer: Buffer }> = [];
    const skippedStores: SkippedStore[] = [];

    for (const storeId of storeIds) {
      try {
        const store = await Store.findById(storeId);

        if (!store) {
          skippedStores.push({ storeId, reason: "Store not found" });
          continue;
        }

        if (store.currentStatus !== "RECCE_SUBMITTED" && store.currentStatus !== "RECCE_APPROVED") {
          skippedStores.push({ storeId, reason: "Invalid status" });
          continue;
        }

        if (!store.recce) {
          skippedStores.push({ storeId, reason: "No recce found" });
          continue;
        }

        if (!store.recce.reccePhotos || store.recce.reccePhotos.length === 0) {
          skippedStores.push({ storeId, reason: "No recce photos" });
          continue;
        }

        const elementIds = store.recce.reccePhotos.flatMap(p => p.elements?.map(e => e.elementId) || []);
        if (elementIds.length === 0) {
          skippedStores.push({ storeId, reason: "No elements" });
          continue;
        }

        const client = await Client.findById(store.clientId);
        if (!client) {
          skippedStores.push({ storeId, reason: "Client not found" });
          continue;
        }

        const clientElementIds = client.elements.map(e => e.elementId.toString());
        const allElementsExist = elementIds.every(id => clientElementIds.includes(id));

        if (!allElementsExist) {
          skippedStores.push({ storeId, reason: "Invalid element IDs" });
          continue;
        }

        const buffer = await generateSingleRFQ(store, client);
        validStores.push({ storeId: store.storeId || store._id.toString(), buffer });
      } catch (error) {
        skippedStores.push({ storeId, reason: (error as Error).message });
      }
    }

    res.setHeader("x-skipped-stores", JSON.stringify(skippedStores));

    if (validStores.length === 0) {
      return res.status(400).json({ error: "No valid stores to process", skippedStores });
    }

    if (validStores.length === 1) {
      const { storeId, buffer } = validStores[0];
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="RFQ_${storeId}.xlsx"`);
      return res.send(buffer);
    }

    const zipBuffer = await createZip(validStores);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="RFQs.zip"');
    res.send(zipBuffer);
  } catch (error: any) {
    console.error("RFQ Generation Error:", error);
    res.status(500).json({ message: "Failed to generate RFQ", error: error.message });
  }
};

async function generateSingleRFQ(store: any, client: any): Promise<any> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.resolve("templates/rfq-template.xlsx"));

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error("Template worksheet not found");

  worksheet.eachRow(row => {
    row.eachCell(cell => {
      if (cell.value && typeof cell.value === "string") {
        cell.value = cell.value
          .replace("{{clientName}}", client.clientName || "")
          .replace("{{clientGST}}", client.gstNumber || "")
          .replace("{{storeId}}", store.storeId || "")
          .replace("{{storeName}}", store.storeName || "")
          .replace("{{storeAddress}}", store.location?.address || "")
          .replace("{{date}}", new Date().toLocaleDateString());
      }
    });
  });

  const lineItems = calculateLineItems(store.recce, client);
  const tableStartRow = findTableStartRow(worksheet);
  populateLineItems(worksheet, lineItems, tableStartRow);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const gst = subtotal * 0.18;
  const grandTotal = subtotal + gst;

  populateTotals(worksheet, subtotal, gst, grandTotal, tableStartRow + lineItems.length);

  return await workbook.xlsx.writeBuffer();
}

function calculateLineItems(recce: any, client: any) {
  const elementMap = new Map<string, { quantity: number; area: number; rate: number; name: string }>();

  for (const photo of recce.reccePhotos) {
    const { measurements, elements } = photo;
    const { width, height, unit } = measurements;

    let areaSqft = 0;
    if (unit === "inches") {
      areaSqft = (width * height) / 144;
    } else if (unit === "feet") {
      areaSqft = width * height;
    }

    for (const elem of elements || []) {
      const clientElement = client.elements.find((e: any) => e.elementId.toString() === elem.elementId);
      if (!clientElement) continue;

      const key = elem.elementId;
      if (!elementMap.has(key)) {
        elementMap.set(key, {
          quantity: 0,
          area: 0,
          rate: clientElement.customRate || 0,
          name: clientElement.elementName || "Unknown"
        });
      }

      const existing = elementMap.get(key)!;
      existing.quantity += elem.quantity || 1;
      existing.area += areaSqft;
    }
  }

  return Array.from(elementMap.values()).map(item => ({
    elementName: item.name,
    quantity: item.quantity,
    area: item.area,
    rate: item.rate,
    amount: item.area * item.rate
  }));
}

function findTableStartRow(worksheet: ExcelJS.Worksheet): number {
  let startRow = 10;
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell(cell => {
      const val = cell.value?.toString().toLowerCase();
      if (val?.includes("s.no") || val?.includes("element") || val?.includes("description")) {
        startRow = rowNumber + 1;
      }
    });
  });
  return startRow;
}

function populateLineItems(worksheet: ExcelJS.Worksheet, lineItems: any[], startRow: number) {
  const templateRow = worksheet.getRow(startRow);
  const styles: any[] = [];
  templateRow.eachCell({ includeEmpty: true }, cell => {
    styles.push({ font: cell.font, alignment: cell.alignment, border: cell.border, fill: cell.fill });
  });

  lineItems.forEach((item, index) => {
    const row = worksheet.getRow(startRow + index);
    styles.forEach((style, i) => {
      const cell = row.getCell(i + 1);
      cell.font = style.font;
      cell.alignment = style.alignment;
      cell.border = style.border;
      cell.fill = style.fill;
    });

    row.getCell(1).value = index + 1;
    row.getCell(2).value = item.elementName;
    row.getCell(3).value = item.quantity;
    row.getCell(4).value = parseFloat(item.area.toFixed(2));
    row.getCell(5).value = parseFloat(item.rate.toFixed(2));
    row.getCell(6).value = parseFloat(item.amount.toFixed(2));
    row.commit();
  });
}

function populateTotals(worksheet: ExcelJS.Worksheet, subtotal: number, gst: number, grandTotal: number, startRow: number) {
  const totalsRow = startRow + 2;
  worksheet.getRow(totalsRow).getCell(5).value = "Subtotal:";
  worksheet.getRow(totalsRow).getCell(6).value = parseFloat(subtotal.toFixed(2));
  worksheet.getRow(totalsRow + 1).getCell(5).value = "GST (18%):";
  worksheet.getRow(totalsRow + 1).getCell(6).value = parseFloat(gst.toFixed(2));
  worksheet.getRow(totalsRow + 2).getCell(5).value = "Grand Total:";
  worksheet.getRow(totalsRow + 2).getCell(6).value = parseFloat(grandTotal.toFixed(2));
}

async function createZip(validStores: Array<{ storeId: string; buffer: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const buffers: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => buffers.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(buffers)));
    archive.on("error", reject);

    validStores.forEach(({ storeId, buffer }) => {
      archive.append(buffer, { name: `RFQ_${storeId}.xlsx` });
    });

    archive.finalize();
  });
}
