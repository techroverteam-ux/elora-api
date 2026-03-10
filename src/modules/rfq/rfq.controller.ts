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
  
  // Create RFQ Sheet
  const rfqSheet = workbook.addWorksheet("RFQ");
  
  rfqSheet.columns = [
    { width: 8 }, { width: 35 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 18 }
  ];

  let currentRow = 1;

  // Company Header
  rfqSheet.mergeCells('A1:G3');
  rfqSheet.getCell('A1').value = '( ELORA CREATIVE ART )\nPLOT NO. 55, STREET NO.2, MILKMAN COLONY, JODHPUR. (RAJ.)-342008\nGST NO: 08AXYPK1335R1ZJ';
  rfqSheet.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  rfqSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  rfqSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
  rfqSheet.getCell('A1').border = {
    top: { style: 'thick', color: { argb: 'FF000000' } },
    left: { style: 'thick', color: { argb: 'FF000000' } },
    bottom: { style: 'thick', color: { argb: 'FF000000' } },
    right: { style: 'thick', color: { argb: 'FF000000' } }
  };
  rfqSheet.getRow(1).height = 60;
  
  // RFQ Title
  rfqSheet.mergeCells('A5:G5');
  rfqSheet.getCell('A5').value = 'Request for quotation(RFQ)';
  rfqSheet.getCell('A5').font = { bold: true, size: 14, color: { argb: 'FF000000' } };
  rfqSheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
  rfqSheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
  rfqSheet.getRow(5).height = 25;

  // RFQ Details
  const rfqNumber = `EX${String(Date.now()).slice(-8)}-${new Date().getFullYear()}-33`;
  const currentDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  rfqSheet.getCell('A7').value = 'RFQ NO. :';
  rfqSheet.getCell('A7').font = { bold: true };
  rfqSheet.getCell('B7').value = rfqNumber;
  rfqSheet.getCell('E7').value = 'Date:';
  rfqSheet.getCell('E7').font = { bold: true };
  rfqSheet.getCell('F7').value = currentDate;
  
  rfqSheet.mergeCells('A8:G8');
  rfqSheet.getCell('A8').value = 'Quotation For : Inshop Branding';
  rfqSheet.getCell('A8').font = { bold: true };
  
  const firstClient = validStores[0]?.client;
  rfqSheet.mergeCells('A9:G9');
  rfqSheet.getCell('A9').value = `M/S ${firstClient?.clientName || 'CLIENT NAME'}`;
  rfqSheet.getCell('A9').font = { bold: true };
  
  rfqSheet.getCell('A10').value = 'Contact Person name (vendor)';
  rfqSheet.getCell('A10').font = { bold: true };
  rfqSheet.getCell('B10').value = 'ELORA TEAM';
  rfqSheet.getCell('D10').value = 'Contact Person no. (vendor)';
  rfqSheet.getCell('D10').font = { bold: true };
  rfqSheet.getCell('E10').value = '9799333000';
  
  currentRow = 12;

  // Table Headers
  const headers = ['Sl. No.', 'Description', 'Transport Mode', 'Quantity', 'UOM/Sqft/Km', 'Unit Price', 'Amount'];
  headers.forEach((header, index) => {
    const cell = rfqSheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
    cell.border = {
      top: { style: 'thick', color: { argb: 'FF000000' } },
      left: { style: 'thick', color: { argb: 'FF000000' } },
      bottom: { style: 'thick', color: { argb: 'FF000000' } },
      right: { style: 'thick', color: { argb: 'FF000000' } }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  rfqSheet.getRow(currentRow).height = 30;
  currentRow++;

  let serialNo = 1;
  let grandTotal = 0;

  // Calculate all line items from database
  const allLineItems = [];
  for (const { store, client } of validStores) {
    const lineItems = calculateLineItems(store, client);
    allLineItems.push(...lineItems);
  }

  // Group by element type for RFQ summary
  const elementGroups = new Map();
  for (const item of allLineItems) {
    const key = item.elementName;
    if (elementGroups.has(key)) {
      const existing = elementGroups.get(key);
      existing.quantity += item.quantity;
      existing.totalSqft += item.totalSqft;
      existing.amount += item.amount;
    } else {
      elementGroups.set(key, { ...item });
    }
  }

  // Populate RFQ line items
  for (const [elementName, item] of elementGroups) {
    const row = rfqSheet.getRow(currentRow);
    
    for (let col = 1; col <= 7; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    }
    
    row.getCell(1).value = serialNo++;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).value = item.elementName;
    row.getCell(2).alignment = { vertical: 'middle' };
    row.getCell(3).value = '';
    row.getCell(4).value = item.quantity;
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).value = parseFloat(item.totalSqft.toFixed(2));
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).value = parseFloat(item.rate.toFixed(2));
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).value = parseFloat(item.amount.toFixed(2));
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).numFmt = '#,##0.00';
    
    row.height = 20;
    grandTotal += item.amount;
    currentRow++;
  }

  // Transportation
  const transportRow = rfqSheet.getRow(currentRow);
  for (let col = 1; col <= 7; col++) {
    transportRow.getCell(col).border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  }
  transportRow.getCell(1).value = serialNo++;
  transportRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  transportRow.getCell(2).value = 'TRANSPORTATION';
  transportRow.getCell(4).value = 1;
  transportRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
  const transportAmount = grandTotal * 0.05;
  transportRow.getCell(5).value = parseFloat(transportAmount.toFixed(2));
  transportRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
  transportRow.getCell(6).value = 1.5;
  transportRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  transportRow.getCell(7).value = parseFloat((transportAmount * 1.5).toFixed(2));
  transportRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  transportRow.getCell(7).numFmt = '#,##0.00';
  grandTotal += (transportAmount * 1.5);
  currentRow += 4;

  // Totals section
  rfqSheet.getCell(`A${currentRow}`).value = 'Amount in Words: Rupees Only';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`E${currentRow}`).value = 'Total Amount before tax';
  rfqSheet.getCell(`E${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`E${currentRow}`).alignment = { horizontal: 'right' };
  rfqSheet.getCell(`G${currentRow}`).value = parseFloat(grandTotal.toFixed(2));
  rfqSheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right' };
  rfqSheet.getCell(`G${currentRow}`).numFmt = '#,##0.00';
  
  currentRow++;
  const gstAmount = grandTotal * 0.18;
  rfqSheet.getCell(`E${currentRow}`).value = 'Taxes/GST @ 18%';
  rfqSheet.getCell(`E${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`E${currentRow}`).alignment = { horizontal: 'right' };
  rfqSheet.getCell(`G${currentRow}`).value = parseFloat(gstAmount.toFixed(2));
  rfqSheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right' };
  rfqSheet.getCell(`G${currentRow}`).numFmt = '#,##0.00';
  
  currentRow++;
  const totalAmount = grandTotal + gstAmount;
  rfqSheet.getCell(`E${currentRow}`).value = 'Total Amount After tax';
  rfqSheet.getCell(`E${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`E${currentRow}`).alignment = { horizontal: 'right' };
  rfqSheet.getCell(`G${currentRow}`).value = parseFloat(totalAmount.toFixed(2));
  rfqSheet.getCell(`G${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right' };
  rfqSheet.getCell(`G${currentRow}`).numFmt = '#,##0.00';
  rfqSheet.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
  
  // Terms & Conditions
  currentRow += 3;
  rfqSheet.mergeCells(`A${currentRow}:G${currentRow}`);
  rfqSheet.getCell(`A${currentRow}`).value = 'Terms & Conditions:';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  
  const terms = [
    'Billing will be done only on basis of acceptance of this Quotation.',
    'Delivery deadline:As per requirement Of material',
    'Payment terms:Due after 30-35 days of submission of invoices & supported documents',
    'All materials should be as per specified and approved specifications',
    'All rates are inclusive of sampling,production,installation,packaging and transportation etc. at all locations.',
    'In case of a missed deadline,company reserves the right to reject the delivery and payment.'
  ];
  
  terms.forEach((term) => {
    currentRow++;
    rfqSheet.mergeCells(`A${currentRow}:G${currentRow}`);
    rfqSheet.getCell(`A${currentRow}`).value = term;
    rfqSheet.getCell(`A${currentRow}`).font = { size: 10 };
  });
  
  // Footer signatures
  currentRow += 3;
  rfqSheet.getCell(`A${currentRow}`).value = '(For Vendor use only)';
  rfqSheet.getCell(`A${currentRow}`).font = { bold: true };
  rfqSheet.getCell(`E${currentRow}`).value = '(For relame use only)';
  rfqSheet.getCell(`E${currentRow}`).font = { bold: true };
  
  currentRow++;
  rfqSheet.getCell(`A${currentRow}`).value = 'Prepared By:- ELORA TEAM';
  rfqSheet.getCell(`E${currentRow}`).value = 'Name of approver:-';
  
  currentRow++;
  rfqSheet.getCell(`A${currentRow}`).value = 'Contact No:- 9799333000';
  rfqSheet.getCell(`E${currentRow}`).value = 'EMP ID:-';
  
  currentRow++;
  rfqSheet.getCell(`A${currentRow}`).value = 'Signature:-';
  rfqSheet.getCell(`E${currentRow}`).value = 'Signature:-';

  // Create Details Sheet
  const detailsSheet = workbook.addWorksheet("Store Details");
  
  detailsSheet.columns = [
    { width: 6 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 15 }, { width: 25 }, 
    { width: 12 }, { width: 20 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, 
    { width: 8 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 12 }
  ];

  // Headers for detailed measurements
  const detailHeaders = [
    'S.No', 'Client Code', 'Store Code', 'Store Name', 'City', 'Address', 'Mobile No', 
    'Element', 'Width\n(Inch)', 'Height\n(Inch)', 'Width\n(feet)', 'Height\n(feet)', 
    'QTY', 'Sq.Ft', 'Rate', 'Amount', 'Tax', 'Total'
  ];
  
  detailHeaders.forEach((header, index) => {
    const cell = detailsSheet.getCell(1, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
    cell.border = {
      top: { style: 'thick', color: { argb: 'FF000000' } },
      left: { style: 'thick', color: { argb: 'FF000000' } },
      bottom: { style: 'thick', color: { argb: 'FF000000' } },
      right: { style: 'thick', color: { argb: 'FF000000' } }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  detailsSheet.getRow(1).height = 35;

  // Populate detailed data
  let detailRowNum = 2;
  let serialNo2 = 1;
  
  for (const item of allLineItems) {
    for (const measurement of item.measurements) {
      const row = detailsSheet.getRow(detailRowNum);
      
      for (let col = 1; col <= 18; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cell.alignment = { vertical: 'middle' };
      }
      
      const amount = measurement.sqft * item.rate;
      const taxAmount = amount * 0.18;
      const totalAmount = amount + taxAmount;
      
      row.getCell(1).value = serialNo2++;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).value = item.clientCode;
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).value = item.storeCode;
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).value = item.storeName;
      row.getCell(5).value = item.city;
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).value = item.address;
      row.getCell(7).value = item.mobile;
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).value = item.elementName;
      row.getCell(9).value = Math.round(measurement.width);
      row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(10).value = Math.round(measurement.height);
      row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(11).value = parseFloat(measurement.widthFeet.toFixed(2));
      row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(12).value = parseFloat(measurement.heightFeet.toFixed(2));
      row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(13).value = measurement.quantity;
      row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(14).value = parseFloat(measurement.sqft.toFixed(2));
      row.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(15).value = parseFloat(item.rate.toFixed(2));
      row.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(16).value = parseFloat(amount.toFixed(2));
      row.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(17).value = parseFloat(taxAmount.toFixed(2));
      row.getCell(17).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(18).value = parseFloat(totalAmount.toFixed(2));
      row.getCell(18).alignment = { horizontal: 'right', vertical: 'middle' };
      
      row.height = 20;
      detailRowNum++;
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function calculateLineItems(store: any, client: any) {
  if (!store.recce || !store.recce.reccePhotos || store.recce.reccePhotos.length === 0) {
    return [];
  }

  const elementMap = new Map<string, { quantity: number; totalSqft: number; rate: number; name: string; measurements: any[] }>();

  for (const photo of store.recce.reccePhotos) {
    const { measurements, elements } = photo;
    if (!measurements || !elements || elements.length === 0) continue;

    const { width, height, unit } = measurements;

    // Convert to feet
    let widthFeet = unit === "inches" ? width / 12 : width;
    let heightFeet = unit === "inches" ? height / 12 : height;
    
    // Calculate square footage: Width(feet) * Height(feet)
    const areaSqft = widthFeet * heightFeet;

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
      const elemQuantity = elem.quantity || 1;
      existing.quantity += elemQuantity;
      existing.totalSqft += areaSqft * elemQuantity;
      existing.measurements.push({
        width: unit === "inches" ? width : width * 12,
        height: unit === "inches" ? height : height * 12,
        widthFeet: widthFeet,
        heightFeet: heightFeet,
        quantity: elemQuantity,
        sqft: areaSqft * elemQuantity
      });
    }
  }

  return Array.from(elementMap.values()).map(item => ({
    elementName: item.name,
    quantity: item.quantity,
    totalSqft: item.totalSqft,
    rate: item.rate,
    amount: item.totalSqft * item.rate,
    measurements: item.measurements,
    clientCode: client.clientName?.substring(0, 8) || '-',
    storeCode: store.storeId || store.storeCode || '-',
    storeName: store.storeName || '-',
    city: store.location?.city || '-',
    address: store.location?.address || '-',
    mobile: store.contactNumber || '-'
  }));
}