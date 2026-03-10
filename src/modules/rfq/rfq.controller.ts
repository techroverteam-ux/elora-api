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
  
  // Set column widths for auto-fit
  rfqSheet.columns = [
    { width: 8 },   // A - S.No
    { width: 35 },  // B - Description
    { width: 15 },  // C - Qty
    { width: 10 },  // D - Unit
    { width: 15 },  // E - Rate
    { width: 18 },  // F - Amount
    { width: 15 },  // G - Store ID
    { width: 25 }   // H - Client
  ];

  let currentRow = 1;

  // Company Header
  rfqSheet.mergeCells('A1:H2');
  rfqSheet.getCell('A1').value = 'ELORA TECH SOLUTIONS';
  rfqSheet.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  rfqSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  rfqSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } };
  rfqSheet.getCell('A1').border = {
    top: { style: 'thick', color: { argb: 'FF0066CC' } },
    left: { style: 'thick', color: { argb: 'FF0066CC' } },
    bottom: { style: 'thick', color: { argb: 'FF0066CC' } },
    right: { style: 'thick', color: { argb: 'FF0066CC' } }
  };
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
  rfqSheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } };
  rfqSheet.getCell('A5').border = {
    top: { style: 'thick', color: { argb: 'FF0066CC' } },
    left: { style: 'thick', color: { argb: 'FF0066CC' } },
    bottom: { style: 'thick', color: { argb: 'FF0066CC' } },
    right: { style: 'thick', color: { argb: 'FF0066CC' } }
  };
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
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } };
    cell.border = {
      top: { style: 'thick', color: { argb: 'FF0066CC' } },
      left: { style: 'thick', color: { argb: 'FF0066CC' } },
      bottom: { style: 'thick', color: { argb: 'FF0066CC' } },
      right: { style: 'thick', color: { argb: 'FF0066CC' } }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rfqSheet.getRow(currentRow).height = 25;
  currentRow++;

  let serialNo = 1;
  let grandTotal = 0;
  const storeSubtotals = new Map<string, { amount: number; tax: number; total: number }>();

  // Populate line items - one row per store-element combination
  for (const { store, client } of validStores) {
    const lineItems = calculateLineItems(store.recce, client);
    const storeKey = store.storeId || store.storeCode || store._id;
    let storeAmount = 0;
    
    for (const item of lineItems) {
      const row = rfqSheet.getRow(currentRow);
      
      // Alternate row colors
      const isEvenRow = (currentRow - 11) % 2 === 0;
      const rowColor = isEvenRow ? 'FFF9FAFB' : 'FFFFFFFF';
      
      // Add borders and styling to all cells
      for (let col = 1; col <= 8; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
      }
      
      row.getCell(1).value = serialNo++;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      row.getCell(2).value = `${item.elementName} - ${store.storeName || store.storeId || 'Store'}`;
      row.getCell(2).alignment = { vertical: 'middle' };
      
      row.getCell(3).value = `${item.quantity} (${parseFloat(item.totalSqft.toFixed(2))} Sq.Ft)`;
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
      storeAmount += item.amount;
      currentRow++;
    }
    
    // Store subtotal tracking
    const storeTax = storeAmount * 0.18;
    const storeTotal = storeAmount + storeTax;
    storeSubtotals.set(storeKey, { amount: storeAmount, tax: storeTax, total: storeTotal });
    grandTotal += storeAmount;
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
  rfqSheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } };
  rfqSheet.getCell(`A${currentRow}`).border = {
    top: { style: 'thick', color: { argb: 'FF0066CC' } },
    left: { style: 'thick', color: { argb: 'FF0066CC' } },
    bottom: { style: 'thick', color: { argb: 'FF0066CC' } },
    right: { style: 'thick', color: { argb: 'FF0066CC' } }
  };
  rfqSheet.getCell(`F${currentRow}`).value = parseFloat(totalAmount.toFixed(2));
  rfqSheet.getCell(`F${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  rfqSheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  rfqSheet.getCell(`F${currentRow}`).numFmt = '₹#,##0.00';
  rfqSheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } };
  rfqSheet.getCell(`F${currentRow}`).border = {
    top: { style: 'thick', color: { argb: 'FF0066CC' } },
    left: { style: 'thick', color: { argb: 'FF0066CC' } },
    bottom: { style: 'thick', color: { argb: 'FF0066CC' } },
    right: { style: 'thick', color: { argb: 'FF0066CC' } }
  };
  
  // Add borders to total section
  for (let row = currentRow - 2; row <= currentRow; row++) {
    for (let col = 1; col <= 8; col++) {
      const cell = rfqSheet.getCell(row, col);
      cell.border = {
        top: { style: 'thick', color: { argb: 'FF000000' } },
        left: { style: 'thick', color: { argb: 'FF000000' } },
        bottom: { style: 'thick', color: { argb: 'FF000000' } },
        right: { style: 'thick', color: { argb: 'FF000000' } }
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

  // Create Details Sheet with Detailed Measurements
  const detailsSheet = workbook.addWorksheet("Store Details");
  
  // Company Header for Details Sheet
  detailsSheet.mergeCells('A1:U2');
  detailsSheet.getCell('A1').value = 'ELORA TECH SOLUTIONS - DETAILED MEASUREMENTS';
  detailsSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
  detailsSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  detailsSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  detailsSheet.getRow(1).height = 30;

  // Set column widths for detailed measurements
  detailsSheet.columns = [
    { width: 6 },   // A - S.No
    { width: 12 },  // B - Client Code
    { width: 12 },  // C - Store Code
    { width: 20 },  // D - Store Name
    { width: 15 },  // E - City
    { width: 25 },  // F - Address
    { width: 12 },  // G - Mobile No
    { width: 20 },  // H - Element
    { width: 10 },  // I - Width (Inch)
    { width: 10 },  // J - Height (Inch)
    { width: 10 },  // K - Width (feet)
    { width: 10 },  // L - Height (feet)
    { width: 8 },   // M - QTY
    { width: 10 },  // N - Sq.Ft
    { width: 12 },  // O - Rate
    { width: 12 },  // P - Amount
    { width: 10 },  // Q - Tax
    { width: 12 }   // R - Total
  ];

  // Headers for detailed measurements (row 4)
  const detailHeaders = [
    'S.No', 'Client Code', 'Store Code', 'Store Name', 'City', 'Address', 'Mobile No', 
    'Element', 'Width\n(Inch)', 'Height\n(Inch)', 'Width\n(feet)', 'Height\n(feet)', 
    'QTY', 'Sq.Ft', 'Rate', 'Amount', 'Tax', 'Total'
  ];
  
  detailHeaders.forEach((header, index) => {
    const cell = detailsSheet.getCell(4, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    cell.border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  detailsSheet.getRow(4).height = 35;

  // Populate detailed measurement data
  let detailRowNum = 5;
  let serialNo2 = 1;
  
  for (const { store, client } of validStores) {
    const lineItems = calculateLineItems(store.recce, client);
    
    for (const item of lineItems) {
      for (const measurement of item.measurements) {
        const row = detailsSheet.getRow(detailRowNum);
        
        // Alternate row colors
        const isEvenRow = (detailRowNum - 5) % 2 === 0;
        const rowColor = isEvenRow ? 'FFF9FAFB' : 'FFFFFFFF';
        
        // Style all cells
        for (let col = 1; col <= 18; col++) {
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
        
        const taxAmount = (measurement.sqft * item.rate) * 0.18;
        const totalAmount = (measurement.sqft * item.rate) + taxAmount;
        
        // Populate data
        row.getCell(1).value = serialNo2++; // S.No
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(2).value = client.clientName?.substring(0, 8) || '-'; // Client Code
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(3).value = store.storeId || store.storeCode || '-'; // Store Code
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(4).value = store.storeName || '-'; // Store Name
        
        row.getCell(5).value = store.location?.city || '-'; // City
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(6).value = store.location?.address || '-'; // Address
        
        row.getCell(7).value = store.contactNumber || '-'; // Mobile No
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(8).value = item.elementName; // Element
        
        row.getCell(9).value = parseFloat(measurement.width.toFixed(2)); // Width (Inch)
        row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(10).value = parseFloat(measurement.height.toFixed(2)); // Height (Inch)
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(11).value = parseFloat(measurement.widthFeet.toFixed(2)); // Width (feet)
        row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(12).value = parseFloat(measurement.heightFeet.toFixed(2)); // Height (feet)
        row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(13).value = measurement.quantity; // QTY
        row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.getCell(14).value = parseFloat(measurement.sqft.toFixed(2)); // Sq.Ft
        row.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' };
        
        row.getCell(15).value = parseFloat(item.rate.toFixed(2)); // Rate
        row.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(15).numFmt = '₹#,##0.00';
        
        row.getCell(16).value = parseFloat((measurement.sqft * item.rate).toFixed(2)); // Amount
        row.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(16).numFmt = '₹#,##0.00';
        
        row.getCell(17).value = parseFloat(taxAmount.toFixed(2)); // Tax
        row.getCell(17).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(17).numFmt = '₹#,##0.00';
        
        row.getCell(18).value = parseFloat(totalAmount.toFixed(2)); // Total
        row.getCell(18).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(18).numFmt = '₹#,##0.00';
        
        row.height = 20;
        detailRowNum++;
      }
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function calculateLineItems(recce: any, client: any) {
  if (!recce || !recce.reccePhotos || recce.reccePhotos.length === 0) {
    return [];
  }

  const elementMap = new Map<string, { quantity: number; totalSqft: number; rate: number; name: string; measurements: any[] }>();

  for (const photo of recce.reccePhotos) {
    const { measurements, elements } = photo;
    if (!measurements || !elements || elements.length === 0) continue;

    const { width, height, unit } = measurements;

    // Fixed square footage calculation: Width(inch) * Height(inch) / 144
    let areaSqft = 0;
    if (unit === "inches") {
      areaSqft = (width * height) / 144; // Correct formula: inches to sq ft
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
          totalSqft: 0,
          rate: clientElement.customRate || 0,
          name: clientElement.elementName || "Unknown",
          measurements: []
        });
      }

      const existing = elementMap.get(key)!;
      existing.quantity += elem.quantity || 1;
      existing.totalSqft += areaSqft * (elem.quantity || 1);
      existing.measurements.push({
        width: unit === "inches" ? width : width * 12,
        height: unit === "inches" ? height : height * 12,
        widthFeet: unit === "inches" ? width / 12 : width,
        heightFeet: unit === "inches" ? height / 12 : height,
        quantity: elem.quantity || 1,
        sqft: areaSqft * (elem.quantity || 1)
      });
    }
  }

  // Return combined measurements per element (no duplicates)
  return Array.from(elementMap.values()).map(item => ({
    elementName: item.name,
    quantity: item.quantity,
    totalSqft: item.totalSqft,
    rate: item.rate,
    amount: item.totalSqft * item.rate,
    measurements: item.measurements
  }));
}


