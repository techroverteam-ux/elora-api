import { Request, Response } from "express";
import Store from "../store/store.model";
import Client from "../client/client.model";
import ExcelJS from "exceljs";

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

    const validStores: any[] = [];
    const skippedStores: SkippedStore[] = [];

    for (const storeId of storeIds) {
      let store;
      try {
        store = await Store.findById(storeId);

        if (!store) {
          skippedStores.push({ storeId, reason: "Store not found" });
          continue;
        }

        const client = await Client.findById(store.clientId);
        if (!client) {
          skippedStores.push({ storeId: store.storeId || store.storeCode || storeId, reason: "Client not found" });
          continue;
        }

        validStores.push({ store, client });
      } catch (error) {
        skippedStores.push({ storeId: store?.storeId || store?.storeCode || storeId, reason: (error as Error).message });
      }
    }

    res.setHeader("x-skipped-stores", JSON.stringify(skippedStores));

    if (validStores.length === 0) {
      return res.status(400).json({ error: "No valid stores to process", skippedStores });
    }

    const buffer = await generateCombinedRFQ(validStores);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="RFQ_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("RFQ Generation Error:", error);
    res.status(500).json({ message: "Failed to generate RFQ", error: error.message });
  }
};

async function generateCombinedRFQ(validStores: Array<{ store: any; client: any }>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Create RFQ Sheet (Invoice Style)
  const rfqSheet = workbook.addWorksheet("RFQ");
  
  // Set column widths
  rfqSheet.columns = [
    { width: 6 },   // A - S.No
    { width: 30 },  // B - Description
    { width: 10 },  // C - Qty
    { width: 8 },   // D - Unit
    { width: 12 },  // E - Rate
    { width: 15 },  // F - Amount
    { width: 15 },  // G - Store ID
    { width: 20 }   // H - Client
  ];

  let currentRow = 1;

  // Company Header
  rfqSheet.mergeCells('A1:H2');
  rfqSheet.getCell('A1').value = 'ELORA TECH SOLUTIONS';
  rfqSheet.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FF1F2937' } };
  rfqSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  rfqSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rfqSheet.getRow(1).height = 35;
  
  currentRow = 3;
  
  // Company Details
  rfqSheet.mergeCells('A3:H3');
  rfqSheet.getCell('A3').value = 'Digital Signage & Display Solutions | GST: 07XXXXX1234X1Z5';
  rfqSheet.getCell('A3').font = { size: 11, color: { argb: 'FF6B7280' } };
  rfqSheet.getCell('A3').alignment = { horizontal: 'center' };
  
  currentRow = 5;
  
  // RFQ Title
  rfqSheet.mergeCells('A5:H5');
  rfqSheet.getCell('A5').value = 'REQUEST FOR QUOTATION';
  rfqSheet.getCell('A5').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  rfqSheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
  rfqSheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  rfqSheet.getRow(5).height = 30;
  
  currentRow = 7;

  // RFQ Details Section
  const rfqNumber = `RFQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const currentDate = new Date().toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  
  rfqSheet.getCell('A7').value = 'RFQ Number:';
  rfqSheet.getCell('A7').font = { bold: true };
  rfqSheet.getCell('B7').value = rfqNumber;
  
  rfqSheet.getCell('E7').value = 'Date:';
  rfqSheet.getCell('E7').font = { bold: true };
  rfqSheet.getCell('F7').value = currentDate;
  
  rfqSheet.getCell('A8').value = 'Valid Until:';
  rfqSheet.getCell('A8').font = { bold: true };
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  rfqSheet.getCell('B8').value = validUntil.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  
  currentRow = 10;

  // Table Headers
  const headers = ['S.No', 'Description', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)', 'Store ID', 'Client'];
  headers.forEach((header, index) => {
    const cell = rfqSheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    cell.border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rfqSheet.getRow(currentRow).height = 25;
  currentRow++;

  let serialNo = 1;
  let grandTotal = 0;

  // Populate line items
  for (const { store, client } of validStores) {
    const lineItems = calculateLineItems(store.recce, client);
    
    for (const item of lineItems) {
      const row = rfqSheet.getRow(currentRow);
      
      // Alternate row colors
      const isEvenRow = (currentRow - 11) % 2 === 0;
      const rowColor = isEvenRow ? 'FFF9FAFB' : 'FFFFFFFF';
      
      // Add borders and styling to all cells
      for (let col = 1; col <= 8; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
      }
      
      row.getCell(1).value = serialNo++;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      row.getCell(2).value = item.elementName;
      row.getCell(2).alignment = { vertical: 'middle' };
      
      row.getCell(3).value = item.quantity;
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      
      row.getCell(4).value = 'Sq.Ft';
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      
      row.getCell(5).value = parseFloat(item.rate.toFixed(2));
      row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(5).numFmt = '₹#,##0.00';
      
      row.getCell(6).value = parseFloat(item.amount.toFixed(2));
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = '₹#,##0.00';
      
      row.getCell(7).value = store.storeId || store.storeCode || '-';
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      
      row.getCell(8).value = client.clientName || '-';
      row.getCell(8).alignment = { vertical: 'middle' };
      
      row.height = 20;
      grandTotal += item.amount;
      currentRow++;
    }
  }

  // Subtotal and Total Section
  currentRow++;
  
  // Subtotal
  rfqSheet.mergeCells(`A${currentRow}:E${currentRow}`);
  rfqSheet.getCell(`A${currentRow}`).value = 'SUBTOTAL';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  rfqSheet.getCell(`F${currentRow}`).value = parseFloat(grandTotal.toFixed(2));
  rfqSheet.getCell(`F${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  rfqSheet.getCell(`F${currentRow}`).numFmt = '₹#,##0.00';
  
  // GST (18%)
  currentRow++;
  const gstAmount = grandTotal * 0.18;
  rfqSheet.mergeCells(`A${currentRow}:E${currentRow}`);
  rfqSheet.getCell(`A${currentRow}`).value = 'GST (18%)';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  rfqSheet.getCell(`F${currentRow}`).value = parseFloat(gstAmount.toFixed(2));
  rfqSheet.getCell(`F${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  rfqSheet.getCell(`F${currentRow}`).numFmt = '₹#,##0.00';
  
  // Total Amount
  currentRow++;
  const totalAmount = grandTotal + gstAmount;
  rfqSheet.mergeCells(`A${currentRow}:E${currentRow}`);
  rfqSheet.getCell(`A${currentRow}`).value = 'TOTAL AMOUNT';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  rfqSheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  rfqSheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  rfqSheet.getCell(`F${currentRow}`).value = parseFloat(totalAmount.toFixed(2));
  rfqSheet.getCell(`F${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  rfqSheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  rfqSheet.getCell(`F${currentRow}`).numFmt = '₹#,##0.00';
  rfqSheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  
  // Add borders to total section
  for (let row = currentRow - 2; row <= currentRow; row++) {
    for (let col = 1; col <= 6; col++) {
      const cell = rfqSheet.getCell(row, col);
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF3B82F6' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    }
  }
  
  // Terms & Conditions
  currentRow += 3;
  rfqSheet.mergeCells(`A${currentRow}:H${currentRow}`);
  rfqSheet.getCell(`A${currentRow}`).value = 'TERMS & CONDITIONS';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  rfqSheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  
  const terms = [
    '1. Prices are valid for 30 days from the date of quotation',
    '2. GST @ 18% will be charged extra as applicable',
    '3. Payment terms: 50% advance, 50% on completion',
    '4. Installation and commissioning charges included',
    '5. Warranty: 1 year on hardware, 6 months on installation'
  ];
  
  terms.forEach((term, index) => {
    currentRow++;
    rfqSheet.mergeCells(`A${currentRow}:H${currentRow}`);
    rfqSheet.getCell(`A${currentRow}`).value = term;
    rfqSheet.getCell(`A${currentRow}`).font = { size: 10 };
  });
  
  // Footer
  currentRow += 2;
  rfqSheet.mergeCells(`A${currentRow}:H${currentRow}`);
  rfqSheet.getCell(`A${currentRow}`).value = 'For ELORA TECH SOLUTIONS';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right' };
  
  currentRow += 3;
  rfqSheet.mergeCells(`A${currentRow}:H${currentRow}`);
  rfqSheet.getCell(`A${currentRow}`).value = 'Authorized Signatory';
  rfqSheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right' };

  // Create Details Sheet
  const detailsSheet = workbook.addWorksheet("Store Details");
  
  // Company Header for Details Sheet
  detailsSheet.mergeCells('A1:H2');
  detailsSheet.getCell('A1').value = 'ELORA TECH SOLUTIONS';
  detailsSheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FF1F2937' } };
  detailsSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  detailsSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  detailsSheet.getRow(1).height = 30;
  
  // Details Header
  detailsSheet.mergeCells('A4:H4');
  detailsSheet.getCell('A4').value = 'STORE & CLIENT DETAILS';
  detailsSheet.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  detailsSheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  detailsSheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  detailsSheet.getRow(4).height = 25;

  // Set column widths for details sheet
  detailsSheet.columns = [
    { header: "Store ID", key: "storeId", width: 15 },
    { header: "Store Name", key: "storeName", width: 25 },
    { header: "Client Name", key: "clientName", width: 20 },
    { header: "Client GST", key: "clientGST", width: 20 },
    { header: "Address", key: "address", width: 30 },
    { header: "City", key: "city", width: 15 },
    { header: "State", key: "state", width: 15 },
    { header: "Status", key: "status", width: 15 }
  ];

  // Style header row (row 6)
  const headerRow = detailsSheet.getRow(6);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  headerRow.height = 25;
  
  // Add borders to header
  for (let col = 1; col <= 8; col++) {
    headerRow.getCell(col).border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
    headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Populate Details data starting from row 7
  let detailRow = 7;
  for (const { store, client } of validStores) {
    const row = detailsSheet.getRow(detailRow);
    
    // Alternate row colors
    const isEvenRow = (detailRow - 7) % 2 === 0;
    const rowColor = isEvenRow ? 'FFF9FAFB' : 'FFFFFFFF';
    
    // Add borders and styling
    for (let col = 1; col <= 8; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
      cell.alignment = { vertical: 'middle' };
    }
    
    row.getCell(1).value = store.storeId || store.storeCode || '-';
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    
    row.getCell(2).value = store.storeName || '-';
    row.getCell(3).value = client.clientName || '-';
    row.getCell(4).value = client.gstNumber || '-';
    row.getCell(5).value = store.location?.address || '-';
    row.getCell(6).value = store.location?.city || '-';
    row.getCell(7).value = store.location?.state || '-';
    row.getCell(8).value = store.currentStatus || '-';
    
    row.height = 20;
    detailRow++;
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function calculateLineItems(recce: any, client: any) {
  if (!recce || !recce.reccePhotos || recce.reccePhotos.length === 0) {
    return [];
  }

  const elementMap = new Map<string, { quantity: number; area: number; rate: number; name: string }>();

  for (const photo of recce.reccePhotos) {
    const { measurements, elements } = photo;
    if (!measurements || !elements || elements.length === 0) continue;

    const { width, height, unit } = measurements;

    let areaSqft = 0;
    if (unit === "inches") {
      areaSqft = (width * height) / 144;
    } else if (unit === "feet") {
      areaSqft = width * height;
    }

    for (const elem of elements) {
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


