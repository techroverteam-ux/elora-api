import { Request, Response } from "express";
import Store from "../store/store.model";
import Client from "../client/client.model";
import ExcelJS from "exceljs";

export const generateRFQ = async (req: Request, res: Response) => {
  try {
    const { storeIds } = req.body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ message: "No stores selected" });
    }

    const stores = await Store.find({ _id: { $in: storeIds } }).populate("clientId");

    if (stores.length === 0) {
      return res.status(404).json({ message: "No stores found" });
    }

    const clientStore = stores[0];
    const client: any = clientStore.clientId;

    if (!client) {
      return res.status(400).json({ message: "Client not found for selected stores" });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("RFQ");

    sheet.mergeCells("A1:G3");
    const headerCell = sheet.getCell("A1");
    headerCell.value = "( ELORA CREATIVE ART ) PLOT NO. 55, STREET NO.2, MILKMAN COLONY, JODHPUR. (RAJ.)-342008\nGST NO: 08AXYPK1335R1ZJ";
    headerCell.font = { size: 14, bold: true };
    headerCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    sheet.mergeCells("A4:G4");
    const titleCell = sheet.getCell("A4");
    titleCell.value = "Request for Quotation (RFQ)";
    titleCell.font = { size: 12, bold: true };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    const rfqNumber = `RFQ-${Date.now()}`;
    const currentDate = new Date().toLocaleDateString("en-IN");
    sheet.mergeCells("A5:D5");
    sheet.getCell("A5").value = `RFQ NO.: ${rfqNumber}`;
    sheet.mergeCells("E5:G5");
    sheet.getCell("E5").value = `Date: ${currentDate}`;
    sheet.getCell("E5").alignment = { horizontal: "right" };

    sheet.mergeCells("A7:G7");
    const quotationForCell = sheet.getCell("A7");
    quotationForCell.value = "Quotation For: Inshop Branding";
    quotationForCell.font = { size: 11, bold: true };

    sheet.mergeCells("A8:G8");
    const clientNameCell = sheet.getCell("A8");
    clientNameCell.value = client.clientName;
    clientNameCell.font = { size: 12, bold: true };

    sheet.mergeCells("A9:G9");
    sheet.getCell("A9").value = `Contact Person Name: ${client.branchName || "N/A"}`;
    sheet.mergeCells("A10:G10");
    sheet.getCell("A10").value = `Contact Person No.: ${client.gstNumber || "N/A"}`;

    const headerRow = sheet.getRow(12);
    const headers = ["Sl. No.", "Description", "Transport Mode", "Quantity", "UOM/Sqft/Km", "Unit Price", "Amount"];
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAB308" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    let currentRow = 13;
    let totalAmount = 0;

    client.elements.forEach((element: any, index: number) => {
      const row = sheet.getRow(currentRow);
      const amount = element.customRate * element.quantity;
      totalAmount += amount;

      row.values = [
        index + 1,
        element.elementName,
        "Road",
        element.quantity,
        "Sqft",
        element.customRate,
        amount,
      ];

      row.eachCell((cell: any) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      currentRow++;
    });

    currentRow += 2;
    const taxRate = 0.18;
    const taxAmount = totalAmount * taxRate;
    const totalWithTax = totalAmount + taxAmount;

    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Amount in Words:";
    sheet.getCell(`A${currentRow}`).font = { bold: true };

    currentRow++;
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Total Amount before tax";
    sheet.getCell(`F${currentRow}`).value = totalAmount;

    currentRow++;
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Taxes/GST @ 18%";
    sheet.getCell(`F${currentRow}`).value = taxAmount;

    currentRow++;
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Total Amount After tax";
    sheet.getCell(`A${currentRow}`).font = { bold: true };
    sheet.getCell(`F${currentRow}`).value = totalWithTax;
    sheet.getCell(`F${currentRow}`).font = { bold: true };

    currentRow += 3;
    sheet.mergeCells(`A${currentRow}:G${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Terms & Conditions:";
    sheet.getCell(`A${currentRow}`).font = { bold: true };

    const terms = [
      "Billing will be done only on basis of acceptance of this Quotation.",
      "Delivery deadline: As per requirement Of material",
      "Payment terms: Due after 30-35 days of submission of invoices & supported documents",
      "All materials should be as per specified and approved specifications",
      "All rates are inclusive of sampling, production, installation, packaging and transportation etc. at all locations.",
      "In case of a missed deadline, company reserves the right to reject the delivery and payment.",
    ];

    terms.forEach((term) => {
      currentRow++;
      sheet.mergeCells(`A${currentRow}:G${currentRow}`);
      sheet.getCell(`A${currentRow}`).value = term;
    });

    currentRow += 3;
    sheet.mergeCells(`A${currentRow}:C${currentRow + 3}`);
    const vendorCell = sheet.getCell(`A${currentRow}`);
    vendorCell.value = "(For Vendor use only)\nPrepared By: SHADAB KHAN\nContact No: 9799333000\nSignature:";
    vendorCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

    sheet.mergeCells(`E${currentRow}:G${currentRow + 3}`);
    const relameCell = sheet.getCell(`E${currentRow}`);
    relameCell.value = "(For Relame use only)\nName of approver:\nEMP ID:\nSignature:";
    relameCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

    sheet.columns = [
      { width: 10 },
      { width: 30 },
      { width: 15 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="RFQ_${client.clientCode}_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("RFQ Generation Error:", error);
    res.status(500).json({ message: "Failed to generate RFQ", error: error.message });
  }
};
