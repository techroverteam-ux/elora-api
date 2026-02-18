import { Request, Response } from "express";
import Store from "./store.model";
import fs from "fs";
import path from "path";

export const generateReccePDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store || !store.recce) {
      return res.status(404).json({ message: "Store or Recce data not found" });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Recce_${store.dealerCode}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#EAB308').text('RECCE INSPECTION REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#EAB308').lineWidth(3).moveTo(40, doc.y).lineTo(800, doc.y).stroke();
    doc.moveDown();

    // Store Details Table
    doc.fontSize(10).fillColor('#000000');
    const startY = doc.y;
    doc.rect(40, startY, 720, 100).stroke('#EAB308');
    
    let y = startY + 10;
    doc.font('Helvetica-Bold').text('Dealer Code:', 50, y, { width: 120, continued: false });
    doc.font('Helvetica').text(store.dealerCode || 'N/A', 170, y, { width: 150 });
    doc.font('Helvetica-Bold').text('Store Name:', 400, y, { width: 120 });
    doc.font('Helvetica').text(store.storeName || 'N/A', 520, y, { width: 230 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('City:', 50, y, { width: 120 });
    doc.font('Helvetica').text(store.location.city || 'N/A', 170, y, { width: 150 });
    doc.font('Helvetica-Bold').text('State:', 400, y, { width: 120 });
    doc.font('Helvetica').text(store.location.state || 'N/A', 520, y, { width: 230 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('Address:', 50, y, { width: 120 });
    doc.font('Helvetica').text(store.location.address || 'N/A', 170, y, { width: 580 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('Board Size:', 50, y, { width: 120 });
    doc.font('Helvetica').text(`${store.recce.sizes?.width || 0} x ${store.recce.sizes?.height || 0} ft`, 170, y, { width: 150 });
    doc.font('Helvetica-Bold').text('Recce Date:', 400, y, { width: 120 });
    doc.font('Helvetica').text(store.recce.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A', 520, y, { width: 230 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('Notes:', 50, y, { width: 120 });
    doc.font('Helvetica').text(store.recce.notes || 'None', 170, y, { width: 580 });

    doc.moveDown(2);

    // Images Section
    doc.fontSize(14).fillColor('#EAB308').text('SITE INSPECTION PHOTOS', { align: 'center' });
    doc.moveDown(0.5);

    const imgY = doc.y;
    const imgWidth = 220;
    const imgHeight = 165;
    const spacing = 20;

    const addImage = (relativePath: string | undefined, label: string, x: number) => {
      doc.rect(x, imgY, imgWidth, imgHeight + 25).stroke('#EAB308');
      if (relativePath) {
        try {
          const absolutePath = path.join(process.cwd(), relativePath);
          if (fs.existsSync(absolutePath)) {
            doc.image(absolutePath, x + 5, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          } else {
            doc.fontSize(9).fillColor('#999999').text('Image Not Found', x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
          }
        } catch (err) {
          doc.fontSize(9).fillColor('#FF0000').text('Error Loading', x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
        }
      } else {
        doc.fontSize(9).fillColor('#999999').text(`No ${label}`, x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
      }
      doc.rect(x, imgY + imgHeight, imgWidth, 25).fillAndStroke('#EAB308', '#EAB308');
      doc.fontSize(10).fillColor('#FFFFFF').text(label, x, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
    };

    addImage(store.recce.photos?.front, 'FRONT VIEW', 50);
    addImage(store.recce.photos?.side, 'SIDE VIEW', 50 + imgWidth + spacing);
    addImage(store.recce.photos?.closeUp, 'CLOSE UP VIEW', 50 + (imgWidth + spacing) * 2);

    doc.end();
  } catch (error: any) {
    console.error("PDF Gen Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PDF" });
  }
};

export const generateInstallationPDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store || !store.installation) {
      return res.status(404).json({ message: "Store or Installation data not found" });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Installation_${store.dealerCode}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#22C55E').text('INSTALLATION COMPLETION REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#22C55E').lineWidth(3).moveTo(40, doc.y).lineTo(800, doc.y).stroke();
    doc.moveDown();

    // Store Details Table
    doc.fontSize(10).fillColor('#000000');
    const startY = doc.y;
    doc.rect(40, startY, 720, 100).stroke('#EAB308');
    
    let y = startY + 10;
    doc.font('Helvetica-Bold').text('Dealer Code:', 50, y, { width: 120, continued: false });
    doc.font('Helvetica').text(store.dealerCode || 'N/A', 170, y, { width: 150 });
    doc.font('Helvetica-Bold').text('Store Name:', 400, y, { width: 120 });
    doc.font('Helvetica').text(store.storeName || 'N/A', 520, y, { width: 230 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('City:', 50, y, { width: 120 });
    doc.font('Helvetica').text(store.location.city || 'N/A', 170, y, { width: 150 });
    doc.font('Helvetica-Bold').text('State:', 400, y, { width: 120 });
    doc.font('Helvetica').text(store.location.state || 'N/A', 520, y, { width: 230 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('Address:', 50, y, { width: 120 });
    doc.font('Helvetica').text(store.location.address || 'N/A', 170, y, { width: 580 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('Board Size:', 50, y, { width: 120 });
    doc.font('Helvetica').text(`${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`, 170, y, { width: 150 });
    doc.font('Helvetica-Bold').text('Completion Date:', 400, y, { width: 120 });
    doc.font('Helvetica').text(store.installation.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A', 520, y, { width: 230 });
    
    y += 20;
    doc.font('Helvetica-Bold').text('Status:', 50, y, { width: 120 });
    doc.font('Helvetica').fillColor('#22C55E').text('✓ COMPLETED', 170, y, { width: 580 });

    doc.moveDown(2);

    // Images Section
    doc.fontSize(14).fillColor('#22C55E').text('BEFORE & AFTER COMPARISON', { align: 'center' });
    doc.moveDown(0.5);

    const imgY = doc.y;
    const imgWidth = 220;
    const imgHeight = 165;
    const spacing = 20;

    const addImage = (relativePath: string | undefined, label: string, x: number, borderColor: string) => {
      doc.rect(x, imgY, imgWidth, imgHeight + 25).stroke(borderColor);
      if (relativePath) {
        try {
          const absolutePath = path.join(process.cwd(), relativePath);
          if (fs.existsSync(absolutePath)) {
            doc.image(absolutePath, x + 5, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          } else {
            doc.fontSize(9).fillColor('#999999').text('Image Not Found', x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
          }
        } catch (err) {
          doc.fontSize(9).fillColor('#FF0000').text('Error Loading', x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
        }
      } else {
        doc.fontSize(9).fillColor('#999999').text(`No ${label}`, x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
      }
      doc.rect(x, imgY + imgHeight, imgWidth, 25).fillAndStroke(borderColor, borderColor);
      doc.fontSize(10).fillColor('#FFFFFF').text(label, x, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
    };

    addImage(store.recce?.photos?.front, 'BEFORE', 50, '#EF4444');
    addImage(store.installation.photos?.after1, 'AFTER - VIEW 1', 50 + imgWidth + spacing, '#22C55E');
    addImage(store.installation.photos?.after2, 'AFTER - VIEW 2', 50 + (imgWidth + spacing) * 2, '#22C55E');

    doc.end();
  } catch (error: any) {
    console.error("PDF Gen Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PDF" });
  }
};

export const generateBulkPDF = async (req: Request, res: Response) => {
  try {
    const { storeIds, type } = req.body;
    
    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ message: "No stores selected" });
    }
    
    if (type !== "recce" && type !== "installation") {
      return res.status(400).json({ message: "Invalid type" });
    }

    const stores = await Store.find({ _id: { $in: storeIds } });
    
    if (stores.length === 0) {
      return res.status(404).json({ message: "No stores found" });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type === "recce" ? "Recce" : "Installation"}_Report_${stores.length}_Stores_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      if (i > 0) doc.addPage();

      // Header
      const headerColor = type === "recce" ? '#EAB308' : '#22C55E';
      const title = type === "recce" ? 'RECCE INSPECTION REPORT' : 'INSTALLATION COMPLETION REPORT';
      
      doc.fontSize(22).fillColor(headerColor).text(title, { align: 'center' });
      doc.moveDown(0.5);
      doc.strokeColor(headerColor).lineWidth(3).moveTo(40, doc.y).lineTo(800, doc.y).stroke();
      doc.moveDown();

      // Store Details Table
      doc.fontSize(10).fillColor('#000000');
      const startY = doc.y;
      doc.rect(40, startY, 720, 100).stroke('#EAB308');
      
      let y = startY + 10;
      doc.font('Helvetica-Bold').text('Dealer Code:', 50, y, { width: 120, continued: false });
      doc.font('Helvetica').text(store.dealerCode || 'N/A', 170, y, { width: 150 });
      doc.font('Helvetica-Bold').text('Store Name:', 400, y, { width: 120 });
      doc.font('Helvetica').text(store.storeName || 'N/A', 520, y, { width: 230 });
      
      y += 20;
      doc.font('Helvetica-Bold').text('City:', 50, y, { width: 120 });
      doc.font('Helvetica').text(store.location.city || 'N/A', 170, y, { width: 150 });
      doc.font('Helvetica-Bold').text('State:', 400, y, { width: 120 });
      doc.font('Helvetica').text(store.location.state || 'N/A', 520, y, { width: 230 });
      
      y += 20;
      doc.font('Helvetica-Bold').text('Address:', 50, y, { width: 120 });
      doc.font('Helvetica').text(store.location.address || 'N/A', 170, y, { width: 580 });
      
      y += 20;
      doc.font('Helvetica-Bold').text('Board Size:', 50, y, { width: 120 });
      doc.font('Helvetica').text(`${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`, 170, y, { width: 150 });
      
      if (type === "recce") {
        doc.font('Helvetica-Bold').text('Recce Date:', 400, y, { width: 120 });
        doc.font('Helvetica').text(store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A', 520, y, { width: 230 });
        y += 20;
        doc.font('Helvetica-Bold').text('Notes:', 50, y, { width: 120 });
        doc.font('Helvetica').text(store.recce?.notes || 'None', 170, y, { width: 580 });
      } else {
        doc.font('Helvetica-Bold').text('Completion Date:', 400, y, { width: 120 });
        doc.font('Helvetica').text(store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A', 520, y, { width: 230 });
        y += 20;
        doc.font('Helvetica-Bold').text('Status:', 50, y, { width: 120 });
        doc.font('Helvetica').fillColor('#22C55E').text('✓ COMPLETED', 170, y, { width: 580 });
      }

      doc.moveDown(2);

      // Images Section
      const sectionTitle = type === "recce" ? 'SITE INSPECTION PHOTOS' : 'BEFORE & AFTER COMPARISON';
      doc.fontSize(14).fillColor(headerColor).text(sectionTitle, { align: 'center' });
      doc.moveDown(0.5);

      const imgY = doc.y;
      const imgWidth = 220;
      const imgHeight = 165;
      const spacing = 20;

      const addImage = (relativePath: string | undefined, label: string, x: number, borderColor: string) => {
        doc.rect(x, imgY, imgWidth, imgHeight + 25).stroke(borderColor);
        if (relativePath) {
          try {
            const absolutePath = path.join(process.cwd(), relativePath);
            if (fs.existsSync(absolutePath)) {
              doc.image(absolutePath, x + 5, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
            } else {
              doc.fontSize(9).fillColor('#999999').text('Image Not Found', x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
            }
          } catch (err) {
            doc.fontSize(9).fillColor('#FF0000').text('Error Loading', x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
          }
        } else {
          doc.fontSize(9).fillColor('#999999').text(`No ${label}`, x, imgY + imgHeight / 2, { width: imgWidth, align: 'center' });
        }
        doc.rect(x, imgY + imgHeight, imgWidth, 25).fillAndStroke(borderColor, borderColor);
        doc.fontSize(10).fillColor('#FFFFFF').text(label, x, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
      };

      if (type === "recce") {
        addImage(store.recce?.photos?.front, 'FRONT VIEW', 50, '#EAB308');
        addImage(store.recce?.photos?.side, 'SIDE VIEW', 50 + imgWidth + spacing, '#EAB308');
        addImage(store.recce?.photos?.closeUp, 'CLOSE UP VIEW', 50 + (imgWidth + spacing) * 2, '#EAB308');
      } else {
        addImage(store.recce?.photos?.front, 'BEFORE', 50, '#EF4444');
        addImage(store.installation?.photos?.after1, 'AFTER - VIEW 1', 50 + imgWidth + spacing, '#22C55E');
        addImage(store.installation?.photos?.after2, 'AFTER - VIEW 2', 50 + (imgWidth + spacing) * 2, '#22C55E');
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("Bulk PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PDF" });
  }
};
