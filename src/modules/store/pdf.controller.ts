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
    const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Recce_${store.dealerCode}.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // COVER PAGE
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
    doc.restore();
    
    doc.fillColor('#EAB308').fontSize(24).font('Helvetica-Bold')
      .text('WE DON\'T JUST PRINT.', 100, 150, { width: 600, align: 'left', lineBreak: false })
      .text('WE INSTALL YOUR BRAND', 100, 185, { width: 600, align: 'left', lineBreak: false })
      .text('INTO THE REAL WORLD.', 100, 220, { width: 600, align: 'left', lineBreak: false });
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 240, 280, { width: 300, height: 90 });
    }
    
    doc.fillColor('#1F2937').fontSize(12).font('Helvetica')
      .text('We help businesses stand out with custom branding,', 300, 420, { width: 500, align: 'right', lineBreak: false })
      .text('high-quality banner printing, and professional on-site installation.', 200, 438, { width: 600, align: 'right', lineBreak: false });

    // DATA PAGE
    doc.addPage();
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
    doc.restore();
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 20, { width: 100, height: 30 });
    }

    doc.fillColor('#EAB308').fontSize(20).font('Helvetica-Bold')
      .text('RECCE INSPECTION REPORT', 40, 70, { width: 760, align: 'center' });
    
    doc.save();
    doc.strokeColor('#B45309').lineWidth(2).moveTo(40, 105).lineTo(800, 105).stroke();
    doc.restore();

    // Store Details
    doc.fillColor('#000000').fontSize(10);
    const startY = 130;
    
    doc.save();
    doc.rect(40, startY, 760, 140).strokeColor('#B45309').lineWidth(1).stroke();
    doc.restore();
    
    let y = startY + 15;
    doc.font('Helvetica-Bold').text('Dealer Code:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.dealerCode || 'N/A', 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('Store Name:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.storeName || 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('City:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.location.city || 'N/A', 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('State:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.location.state || 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Address:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.location.address || 'N/A', 170, y, { width: 620 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Board Size:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(`${store.recce.sizes?.width || 0} x ${store.recce.sizes?.height || 0} ft`, 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('Recce Date:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.recce.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Notes:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.recce.notes || 'None', 170, y, { width: 620 });

    // Images Section
    doc.fillColor('#EAB308').fontSize(14).font('Helvetica-Bold')
      .text('SITE INSPECTION PHOTOS', 40, 300, { width: 760, align: 'center' });

    const imgY = 330;
    const imgWidth = 220;
    const imgHeight = 165;
    const spacing = 30;

    const addImage = (relativePath: string | undefined, label: string, x: number) => {
      doc.save();
      doc.rect(x, imgY, imgWidth, imgHeight + 25).strokeColor('#B45309').lineWidth(1).stroke();
      doc.restore();
      
      if (relativePath) {
        try {
          const absolutePath = path.join(process.cwd(), relativePath);
          if (fs.existsSync(absolutePath)) {
            doc.image(absolutePath, x + 5, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          } else {
            doc.fillColor('#999999').fontSize(9).text('Image Not Found', x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
          }
        } catch (err) {
          doc.fillColor('#FF0000').fontSize(9).text('Error Loading', x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
        }
      } else {
        doc.fillColor('#999999').fontSize(9).text(`No ${label}`, x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
      }
      
      doc.save();
      doc.rect(x, imgY + imgHeight, imgWidth, 25).fillOpacity(1).fillAndStroke('#EAB308', '#B45309');
      doc.restore();
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(label, x, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
    };

    addImage(store.recce.photos?.front, 'FRONT VIEW', 60);
    addImage(store.recce.photos?.side, 'SIDE VIEW', 60 + imgWidth + spacing);
    addImage(store.recce.photos?.closeUp, 'CLOSE UP VIEW', 60 + (imgWidth + spacing) * 2);

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
    const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Installation_${store.dealerCode}.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // COVER PAGE
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
    doc.restore();
    
    doc.fillColor('#EAB308').fontSize(24).font('Helvetica-Bold')
      .text('WE DON\'T JUST PRINT.', 100, 150, { width: 600, align: 'left', lineBreak: false })
      .text('WE INSTALL YOUR BRAND', 100, 185, { width: 600, align: 'left', lineBreak: false })
      .text('INTO THE REAL WORLD.', 100, 220, { width: 600, align: 'left', lineBreak: false });
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 240, 280, { width: 300, height: 90 });
    }
    
    doc.fillColor('#1F2937').fontSize(12).font('Helvetica')
      .text('We help businesses stand out with custom branding,', 300, 420, { width: 500, align: 'right', lineBreak: false })
      .text('high-quality banner printing, and professional on-site installation.', 200, 438, { width: 600, align: 'right', lineBreak: false });

    // DATA PAGE
    doc.addPage();
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
    doc.restore();
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 20, { width: 100, height: 30 });
    }

    doc.fillColor('#22C55E').fontSize(20).font('Helvetica-Bold')
      .text('INSTALLATION COMPLETION REPORT', 40, 70, { width: 760, align: 'center' });
    
    doc.save();
    doc.strokeColor('#B45309').lineWidth(2).moveTo(40, 105).lineTo(800, 105).stroke();
    doc.restore();

    // Store Details
    doc.fillColor('#000000').fontSize(10);
    const startY = 130;
    
    doc.save();
    doc.rect(40, startY, 760, 140).strokeColor('#B45309').lineWidth(1).stroke();
    doc.restore();
    
    let y = startY + 15;
    doc.font('Helvetica-Bold').text('Dealer Code:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.dealerCode || 'N/A', 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('Store Name:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.storeName || 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('City:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.location.city || 'N/A', 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('State:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.location.state || 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Address:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.location.address || 'N/A', 170, y, { width: 620 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Board Size:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(`${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`, 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('Completion Date:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.installation.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Status:', 50, y, { continued: false, width: 120 });
    doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 170, y, { width: 620 });

    // Images Section
    doc.fillColor('#22C55E').fontSize(14).font('Helvetica-Bold')
      .text('BEFORE & AFTER COMPARISON', 40, 300, { width: 760, align: 'center' });

    const imgY = 330;
    const imgWidth = 220;
    const imgHeight = 165;
    const spacing = 30;

    const addImage = (relativePath: string | undefined, label: string, x: number, borderColor: string) => {
      doc.save();
      doc.rect(x, imgY, imgWidth, imgHeight + 25).strokeColor(borderColor).lineWidth(1).stroke();
      doc.restore();
      
      if (relativePath) {
        try {
          const absolutePath = path.join(process.cwd(), relativePath);
          if (fs.existsSync(absolutePath)) {
            doc.image(absolutePath, x + 5, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          } else {
            doc.fillColor('#999999').fontSize(9).text('Image Not Found', x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
          }
        } catch (err) {
          doc.fillColor('#FF0000').fontSize(9).text('Error Loading', x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
        }
      } else {
        doc.fillColor('#999999').fontSize(9).text(`No ${label}`, x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
      }
      
      doc.save();
      doc.rect(x, imgY + imgHeight, imgWidth, 25).fillOpacity(1).fillAndStroke(borderColor, borderColor);
      doc.restore();
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(label, x, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
    };

    addImage(store.recce?.photos?.front, 'BEFORE', 60, '#EF4444');
    addImage(store.installation.photos?.after1, 'AFTER - VIEW 1', 60 + imgWidth + spacing, '#22C55E');
    addImage(store.installation.photos?.after2, 'AFTER - VIEW 2', 60 + (imgWidth + spacing) * 2, '#22C55E');

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
    const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type === "recce" ? "Recce" : "Installation"}_Report_${stores.length}_Stores_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // COVER PAGE
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
    doc.restore();
    
    doc.fillColor('#EAB308').fontSize(24).font('Helvetica-Bold')
      .text('WE DON\'T JUST PRINT.', 100, 150, { width: 600, align: 'left', lineBreak: false })
      .text('WE INSTALL YOUR BRAND', 100, 185, { width: 600, align: 'left', lineBreak: false })
      .text('INTO THE REAL WORLD.', 100, 220, { width: 600, align: 'left', lineBreak: false });
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 240, 280, { width: 300, height: 90 });
    }
    
    doc.fillColor('#1F2937').fontSize(12).font('Helvetica')
      .text('We help businesses stand out with custom branding,', 300, 420, { width: 500, align: 'right', lineBreak: false })
      .text('high-quality banner printing, and professional on-site installation.', 200, 438, { width: 600, align: 'right', lineBreak: false });

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      doc.addPage();
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
      doc.restore();

      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 20, { width: 100, height: 30 });
      }

      const headerColor = type === "recce" ? '#EAB308' : '#22C55E';
      const title = type === "recce" ? 'RECCE INSPECTION REPORT' : 'INSTALLATION COMPLETION REPORT';
      
      doc.fillColor(headerColor).fontSize(20).font('Helvetica-Bold')
        .text(title, 40, 70, { width: 760, align: 'center' });
      
      doc.save();
      doc.strokeColor('#B45309').lineWidth(2).moveTo(40, 105).lineTo(800, 105).stroke();
      doc.restore();

      // Store Details
      doc.fillColor('#000000').fontSize(10);
      const startY = 130;
      
      doc.save();
      doc.rect(40, startY, 760, 140).strokeColor('#B45309').lineWidth(1).stroke();
      doc.restore();
      
      let y = startY + 15;
      doc.font('Helvetica-Bold').text('Dealer Code:', 50, y, { continued: false, width: 120 });
      doc.font('Helvetica').text(store.dealerCode || 'N/A', 170, y, { width: 200 });
      doc.font('Helvetica-Bold').text('Store Name:', 420, y, { continued: false, width: 120 });
      doc.font('Helvetica').text(store.storeName || 'N/A', 540, y, { width: 250 });
      
      y += 25;
      doc.font('Helvetica-Bold').text('City:', 50, y, { continued: false, width: 120 });
      doc.font('Helvetica').text(store.location.city || 'N/A', 170, y, { width: 200 });
      doc.font('Helvetica-Bold').text('State:', 420, y, { continued: false, width: 120 });
      doc.font('Helvetica').text(store.location.state || 'N/A', 540, y, { width: 250 });
      
      y += 25;
      doc.font('Helvetica-Bold').text('Address:', 50, y, { continued: false, width: 120 });
      doc.font('Helvetica').text(store.location.address || 'N/A', 170, y, { width: 620 });
      
      y += 25;
      doc.font('Helvetica-Bold').text('Board Size:', 50, y, { continued: false, width: 120 });
      doc.font('Helvetica').text(`${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`, 170, y, { width: 200 });
      
      if (type === "recce") {
        doc.font('Helvetica-Bold').text('Recce Date:', 420, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A', 540, y, { width: 250 });
        y += 25;
        doc.font('Helvetica-Bold').text('Notes:', 50, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.recce?.notes || 'None', 170, y, { width: 620 });
      } else {
        doc.font('Helvetica-Bold').text('Completion Date:', 420, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A', 540, y, { width: 250 });
        y += 25;
        doc.font('Helvetica-Bold').text('Status:', 50, y, { continued: false, width: 120 });
        doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 170, y, { width: 620 });
      }

      // Images Section
      const sectionTitle = type === "recce" ? 'SITE INSPECTION PHOTOS' : 'BEFORE & AFTER COMPARISON';
      doc.fillColor(headerColor).fontSize(14).font('Helvetica-Bold')
        .text(sectionTitle, 40, 300, { width: 760, align: 'center' });

      const imgY = 330;
      const imgWidth = 220;
      const imgHeight = 165;
      const spacing = 30;

      const addImage = (relativePath: string | undefined, label: string, x: number, borderColor: string) => {
        doc.save();
        doc.rect(x, imgY, imgWidth, imgHeight + 25).strokeColor(borderColor).lineWidth(1).stroke();
        doc.restore();
        
        if (relativePath) {
          try {
            const absolutePath = path.join(process.cwd(), relativePath);
            if (fs.existsSync(absolutePath)) {
              doc.image(absolutePath, x + 5, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
            } else {
              doc.fillColor('#999999').fontSize(9).text('Image Not Found', x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
            }
          } catch (err) {
            doc.fillColor('#FF0000').fontSize(9).text('Error Loading', x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
          }
        } else {
          doc.fillColor('#999999').fontSize(9).text(`No ${label}`, x + 10, imgY + 80, { width: imgWidth - 20, align: 'center' });
        }
        
        doc.save();
        doc.rect(x, imgY + imgHeight, imgWidth, 25).fillOpacity(1).fillAndStroke(borderColor, borderColor);
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(label, x, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
      };

      if (type === "recce") {
        addImage(store.recce?.photos?.front, 'FRONT VIEW', 60, '#EAB308');
        addImage(store.recce?.photos?.side, 'SIDE VIEW', 60 + imgWidth + spacing, '#EAB308');
        addImage(store.recce?.photos?.closeUp, 'CLOSE UP VIEW', 60 + (imgWidth + spacing) * 2, '#EAB308');
      } else {
        addImage(store.recce?.photos?.front, 'BEFORE', 60, '#EF4444');
        addImage(store.installation?.photos?.after1, 'AFTER - VIEW 1', 60 + imgWidth + spacing, '#22C55E');
        addImage(store.installation?.photos?.after2, 'AFTER - VIEW 2', 60 + (imgWidth + spacing) * 2, '#22C55E');
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("Bulk PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PDF" });
  }
};
