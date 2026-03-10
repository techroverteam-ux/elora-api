import { Request, Response } from "express";
import Store from "./store.model";
import fs from "fs";
import path from "path";
const axios = require('axios');

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
    res.setHeader('Content-Disposition', `attachment; filename="RECCE_${store.storeName}_${store.storeId}.pdf"`);
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
    doc.font('Helvetica-Bold').text('Recce Date:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.recce.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A', 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('Submitted By:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.recce.submittedBy || 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Notes:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.recce.notes || 'None', 170, y, { width: 620 });

    // Initial Photos Section
    if (store.recce.initialPhotos && store.recce.initialPhotos.length > 0) {
      doc.addPage();
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
      doc.restore();
      
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 20, { width: 100, height: 30 });
      }

      doc.fillColor('#EAB308').fontSize(16).font('Helvetica-Bold')
        .text('INITIAL STORE PHOTOS', 40, 70, { width: 760, align: 'center' });

      let photoY = 110;
      const photoWidth = 180;
      const photoHeight = 135;
      const photosPerRow = 4;
      const spacing = 20;

      for (let i = 0; i < store.recce.initialPhotos.length; i++) {
        const col = i % photosPerRow;
        const row = Math.floor(i / photosPerRow);
        const x = 40 + col * (photoWidth + spacing);
        const y = photoY + row * (photoHeight + spacing);

        if (row > 0 && col === 0 && y > 500) {
          doc.addPage();
          doc.save();
          doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
          doc.restore();
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 20, { width: 100, height: 30 });
          }
          photoY = 70;
        }

        const finalY = row > 0 && col === 0 && y > 500 ? photoY : y;
        const photoPath = path.join(process.cwd(), store.recce.initialPhotos[i]);
        
        doc.save();
        doc.rect(x, finalY, photoWidth, photoHeight).strokeColor('#B45309').lineWidth(1).stroke();
        doc.restore();

        if (fs.existsSync(photoPath)) {
          doc.image(photoPath, x + 5, finalY + 5, { width: photoWidth - 10, height: photoHeight - 10, fit: [photoWidth - 10, photoHeight - 10] });
        }
      }
    }

    // Recce Photos with Measurements and Elements
    if (store.recce.reccePhotos && store.recce.reccePhotos.length > 0) {
      for (let i = 0; i < store.recce.reccePhotos.length; i++) {
        const reccePhoto = store.recce.reccePhotos[i];
        
        doc.addPage();
        doc.save();
        doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
        doc.restore();
        
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 20, { width: 100, height: 30 });
        }

        doc.fillColor('#EAB308').fontSize(16).font('Helvetica-Bold')
          .text(`RECCE PHOTO ${i + 1}`, 40, 70, { width: 760, align: 'center' });

        const photoPath = path.join(process.cwd(), reccePhoto.photo);
        const imgY = 110;
        const imgWidth = 720;
        const imgHeight = 400;

        doc.save();
        doc.rect(40, imgY, imgWidth, imgHeight).strokeColor('#B45309').lineWidth(2).stroke();
        doc.restore();

        if (fs.existsSync(photoPath)) {
          doc.image(photoPath, 45, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
        }

        // Measurements
        const measureY = imgY + imgHeight + 10;
        doc.save();
        doc.rect(40, measureY, imgWidth, 30).fillOpacity(1).fillAndStroke('#FFFFFF', '#B45309');
        doc.restore();
        doc.fillColor('#1F2937').fontSize(12).font('Helvetica-Bold')
          .text(`Measurements: ${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 40, measureY + 10, { width: imgWidth, align: 'center' });

        // Elements
        if (reccePhoto.elements && reccePhoto.elements.length > 0) {
          const elementsText = reccePhoto.elements.map((el: any) => `${el.elementName} (Qty: ${el.quantity})`).join(' | ');
          const elemY = measureY + 35;
          doc.save();
          doc.rect(40, elemY, imgWidth, 25).fillOpacity(1).fillAndStroke('#FEF3C7', '#B45309');
          doc.restore();
          doc.fillColor('#1F2937').fontSize(10).font('Helvetica-Bold')
            .text(`Elements: ${elementsText}`, 40, elemY + 7, { width: imgWidth, align: 'center' });
        }
      }
    }

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
    res.setHeader('Content-Disposition', `attachment; filename="INSTALLATION_${store.storeName}_${store.storeId}.pdf"`);
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
    doc.font('Helvetica-Bold').text('Completion Date:', 50, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.installation.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A', 170, y, { width: 200 });
    doc.font('Helvetica-Bold').text('Submitted By:', 420, y, { continued: false, width: 120 });
    doc.font('Helvetica').text(store.installation.submittedBy || 'N/A', 540, y, { width: 250 });
    
    y += 25;
    doc.font('Helvetica-Bold').text('Status:', 50, y, { continued: false, width: 120 });
    doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 170, y, { width: 620 });

    // Initial Photos Section
    if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
      doc.addPage();
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
      doc.restore();
      
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 20, { width: 100, height: 30 });
      }

      doc.fillColor('#EAB308').fontSize(16).font('Helvetica-Bold')
        .text('INITIAL STORE PHOTOS', 40, 70, { width: 760, align: 'center' });

      let photoY = 110;
      const photoWidth = 180;
      const photoHeight = 135;
      const photosPerRow = 4;
      const spacing = 20;

      for (let i = 0; i < store.recce.initialPhotos.length; i++) {
        const col = i % photosPerRow;
        const row = Math.floor(i / photosPerRow);
        const x = 40 + col * (photoWidth + spacing);
        const y = photoY + row * (photoHeight + spacing);

        if (row > 0 && col === 0 && y > 500) {
          doc.addPage();
          doc.save();
          doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
          doc.restore();
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 20, { width: 100, height: 30 });
          }
          photoY = 70;
        }

        const finalY = row > 0 && col === 0 && y > 500 ? photoY : y;
        const photoPath = path.join(process.cwd(), store.recce.initialPhotos[i]);
        
        doc.save();
        doc.rect(x, finalY, photoWidth, photoHeight).strokeColor('#B45309').lineWidth(1).stroke();
        doc.restore();

        if (fs.existsSync(photoPath)) {
          doc.image(photoPath, x + 5, finalY + 5, { width: photoWidth - 10, height: photoHeight - 10, fit: [photoWidth - 10, photoHeight - 10] });
        }
      }
    }

    // Before & After Comparison
    if (store.recce?.reccePhotos && store.recce.reccePhotos.length > 0 && store.installation.photos) {
      for (let i = 0; i < store.recce.reccePhotos.length; i++) {
        const reccePhoto = store.recce.reccePhotos[i];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === i);
        
        doc.addPage();
        doc.save();
        doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
        doc.restore();
        
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 20, { width: 100, height: 30 });
        }

        doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
          .text(`BEFORE & AFTER - Photo ${i + 1}`, 40, 70, { width: 760, align: 'center' });

        const imgY = 110;
        const imgWidth = 360;
        const imgHeight = 300;
        const spacing = 40;

        // BEFORE (Left)
        const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
        doc.save();
        doc.rect(40, imgY, imgWidth, imgHeight + 30).strokeColor('#EF4444').lineWidth(2).stroke();
        doc.restore();
        
        if (fs.existsSync(reccePhotoPath)) {
          doc.image(reccePhotoPath, 45, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
        }
        
        doc.save();
        doc.rect(40, imgY + imgHeight, imgWidth, 30).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('BEFORE', 40, imgY + imgHeight + 10, { width: imgWidth, align: 'center' });

        // AFTER (Right)
        if (installPhoto) {
          const installPhotoPath = path.join(process.cwd(), installPhoto.installationPhoto);
          doc.save();
          doc.rect(40 + imgWidth + spacing, imgY, imgWidth, imgHeight + 30).strokeColor('#22C55E').lineWidth(2).stroke();
          doc.restore();
          
          if (fs.existsSync(installPhotoPath)) {
            doc.image(installPhotoPath, 45 + imgWidth + spacing, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          }
        }
        
        doc.save();
        doc.rect(40 + imgWidth + spacing, imgY + imgHeight, imgWidth, 30).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('AFTER', 40 + imgWidth + spacing, imgY + imgHeight + 10, { width: imgWidth, align: 'center' });

        // Measurements
        const measureY = imgY + imgHeight + 45;
        doc.save();
        doc.rect(40, measureY, 760, 25).fillOpacity(1).fillAndStroke('#FFFFFF', '#B45309');
        doc.restore();
        doc.fillColor('#1F2937').fontSize(11).font('Helvetica-Bold')
          .text(`Measurements: ${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 40, measureY + 7, { width: 760, align: 'center' });

        // Elements
        if (reccePhoto.elements && reccePhoto.elements.length > 0) {
          const elementsText = reccePhoto.elements.map((el: any) => `${el.elementName} (Qty: ${el.quantity})`).join(' | ');
          const elemY = measureY + 30;
          doc.save();
          doc.rect(40, elemY, 760, 20).fillOpacity(1).fillAndStroke('#FEF3C7', '#B45309');
          doc.restore();
          doc.fillColor('#1F2937').fontSize(9).font('Helvetica-Bold')
            .text(`Elements: ${elementsText}`, 40, elemY + 5, { width: 760, align: 'center' });
        }
      }
    }

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
      
      // Clean white background without shading
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFFFF');
      doc.restore();

      // COMPACT HEADER (Top 15% - 90px total)
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 30, 15, { width: 80, height: 25 });
      }

      const headerColor = type === "recce" ? '#EAB308' : '#22C55E';
      const title = type === "recce" ? 'RECCE INSPECTION REPORT' : 'INSTALLATION COMPLETION REPORT';
      
      doc.fillColor(headerColor).fontSize(16).font('Helvetica-Bold')
        .text(title, 30, 20, { width: doc.page.width - 210, align: 'center' });
      
      doc.fillColor('#EAB308').fontSize(10).font('Helvetica')
        .text('ELORA CREATIVE ART', 650, 15, { width: 150, align: 'right' })
        .text('www.eloracreativeart.in', 650, 28, { width: 150, align: 'right' });

      // ULTRA COMPACT Store Details - Table Layout
      doc.fillColor('#000000').fontSize(8);
      let y = 45;
      
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // Row 1: Store Name | City | Status
      doc.font('Helvetica-Bold').text('Store:', 30, y);
      doc.font('Helvetica').text((store.storeName || 'N/A').substring(0, 30), 70, y);
      doc.font('Helvetica-Bold').text('City:', 320, y);
      doc.font('Helvetica').text((store.location?.city || 'N/A').substring(0, 15), 350, y);
      
      if (type === "installation") {
        doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 480, y);
      }
      
      y += 12;
      // Row 2: Store ID | Date | Submitted By
      doc.fillColor('#000000').font('Helvetica-Bold').text('ID:', 30, y);
      doc.font('Helvetica').text((store.storeId || store.storeCode || 'N/A').substring(0, 20), 50, y);
      doc.font('Helvetica-Bold').text('Date:', 200, y);
      doc.font('Helvetica').text(dateValue, 230, y);
      doc.font('Helvetica-Bold').text('By:', 350, y);
      doc.font('Helvetica').text((submittedBy || 'N/A').substring(0, 20), 370, y);
      
      y += 12;
      // Row 3: Address (truncated if too long)
      doc.font('Helvetica-Bold').text('Address:', 30, y);
      const address = store.location?.address || 'N/A';
      const truncatedAddress = address.length > 80 ? address.substring(0, 80) + '...' : address;
      doc.font('Helvetica').text(truncatedAddress, 80, y);

      // Minimal separator line
      doc.save();
      doc.strokeColor('#EAB308').lineWidth(2).moveTo(30, y + 18).lineTo(770, y + 18).stroke();
      doc.restore();

      // MAIN CONTENT AREA (80% of page)
      const contentStartY = y + 25;
      const availableHeight = doc.page.height - contentStartY - 20;
      const availableWidth = doc.page.width - 60;

      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Before/After Layout - MAXIMIZED (85% image space)
        const imgWidth = (availableWidth - 20) / 2; // 360px each
        const imgHeight = availableHeight - 40; // 445px
        
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);
        
        // BEFORE (Left) - Red border with white padding
        const beforeX = 30;
        const padding = 15;
        
        // Outer red border
        doc.save();
        doc.rect(beforeX, contentStartY, imgWidth, imgHeight + 20).strokeColor('#EF4444').lineWidth(3).stroke();
        doc.restore();
        
        // Inner white padding area
        doc.save();
        doc.rect(beforeX + 5, contentStartY + 5, imgWidth - 10, imgHeight + 10).fillOpacity(1).fill('#FFFFFF');
        doc.restore();
        
        // Load recce image from URL
        const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
        console.log('Loading recce image:', reccePhotoUrl);
        try {
          const axios = require('axios');
          const response = await axios.get(reccePhotoUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PDF-Generator)'
            }
          });
          
          if (response.status === 200 && response.data) {
            const buffer = Buffer.from(response.data);
            doc.image(buffer, beforeX + padding, contentStartY + padding, { 
              width: imgWidth - (padding * 2), 
              height: imgHeight - padding, 
              fit: [imgWidth - (padding * 2), imgHeight - padding] 
            });
            console.log('Recce image loaded successfully');
          }
        } catch (error: any) {
          console.log(`Failed to load recce image: ${error.message}`);
          // Add placeholder text
          doc.fillColor('#999999').fontSize(12).font('Helvetica')
            .text('Image not available', beforeX + padding, contentStartY + imgHeight/2, { 
              width: imgWidth - (padding * 2), 
              align: 'center' 
            });
        }
        
        // Clean label without background shading
        doc.save();
        doc.rect(beforeX, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('BEFORE', beforeX, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
        
        // AFTER (Right) - Green border with white padding
        const afterX = beforeX + imgWidth + 20;
        
        // Outer green border
        doc.save();
        doc.rect(afterX, contentStartY, imgWidth, imgHeight + 20).strokeColor('#22C55E').lineWidth(3).stroke();
        doc.restore();
        
        // Inner white padding area
        doc.save();
        doc.rect(afterX + 5, contentStartY + 5, imgWidth - 10, imgHeight + 10).fillOpacity(1).fill('#FFFFFF');
        doc.restore();
        
        if (installPhoto) {
          const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, '%20')}`;
          console.log('Loading installation image:', installPhotoUrl);
          try {
            const axios = require('axios');
            const response = await axios.get(installPhotoUrl, { 
              responseType: 'arraybuffer',
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PDF-Generator)'
              }
            });
            
            if (response.status === 200 && response.data) {
              const buffer = Buffer.from(response.data);
              doc.image(buffer, afterX + padding, contentStartY + padding, { 
                width: imgWidth - (padding * 2), 
                height: imgHeight - padding, 
                fit: [imgWidth - (padding * 2), imgHeight - padding] 
              });
              console.log('Installation image loaded successfully');
            }
          } catch (error: any) {
            console.log(`Failed to load installation image: ${error.message}`);
            // Add placeholder text
            doc.fillColor('#999999').fontSize(12).font('Helvetica')
              .text('Image not available', afterX + padding, contentStartY + imgHeight/2, { 
                width: imgWidth - (padding * 2), 
                align: 'center' 
              });
          }
        }
        
        // Clean label without background shading
        doc.save();
        doc.rect(afterX, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('AFTER', afterX, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
        
        // Compact measurements at bottom
        if (reccePhoto.measurements) {
          doc.fillColor('#1F2937').fontSize(10).font('Helvetica')
            .text(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 
                  30, contentStartY + imgHeight + 25, { width: availableWidth, align: 'center' });
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Single large recce photo - MAXIMIZED (85% space)
        const reccePhoto = store.recce.reccePhotos[0];
        const singleImgHeight = availableHeight - 30;
        
        // Clean border without shading
        doc.save();
        doc.rect(30, contentStartY, availableWidth, singleImgHeight).strokeColor('#EAB308').lineWidth(2).stroke();
        doc.restore();
        
        const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
        console.log('Loading single recce image:', reccePhotoUrl);
        try {
          const axios = require('axios');
          const response = await axios.get(reccePhotoUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PDF-Generator)'
            }
          });
          
          if (response.status === 200 && response.data) {
            const buffer = Buffer.from(response.data);
            doc.image(buffer, 35, contentStartY + 5, { 
              width: availableWidth - 10, 
              height: singleImgHeight - 10, 
              fit: [availableWidth - 10, singleImgHeight - 10] 
            });
            console.log('Single recce image loaded successfully');
          }
        } catch (error: any) {
          console.log(`Failed to load single recce image: ${error.message}`);
          // Add placeholder text
          doc.fillColor('#999999').fontSize(16).font('Helvetica')
            .text('Image not available', 35, contentStartY + singleImgHeight/2, { 
              width: availableWidth - 10, 
              align: 'center' 
            });
        }
        
        // Compact measurements at bottom
        if (reccePhoto.measurements) {
          doc.fillColor('#1F2937').fontSize(10).font('Helvetica')
            .text(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 
                  30, contentStartY + singleImgHeight + 10, { width: availableWidth, align: 'center' });
        }
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("Bulk PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PDF" });
  }
};

export const generateBulkPPT = async (req: Request, res: Response) => {
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

    const officegen = require('officegen');
    const pptx = officegen('pptx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${type === "recce" ? "Recce" : "Installation"}_Report_${stores.length}_Stores_${new Date().toISOString().split('T')[0]}.pptx"`);

    // Title slide
    const titleSlide = pptx.makeNewSlide();
    titleSlide.name = `${type === "recce" ? "Recce" : "Installation"} Report`;
    
    titleSlide.addText(`${type === "recce" ? "RECCE INSPECTION" : "INSTALLATION COMPLETION"} REPORT`, {
      x: 1, y: 2, cx: 8, cy: 1,
      font_size: 28, bold: true, color: type === "recce" ? 'EAB308' : '22C55E',
      align: 'center'
    });
    
    titleSlide.addText(`${stores.length} Stores | ${new Date().toLocaleDateString()}`, {
      x: 1, y: 3.5, cx: 8, cy: 0.5,
      font_size: 16, color: '1F2937', align: 'center'
    });
    
    titleSlide.addText('ELORA CREATIVE ART | www.eloracreativeart.in', {
      x: 1, y: 5, cx: 8, cy: 0.5,
      font_size: 14, color: 'EAB308', align: 'center'
    });

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const slide = pptx.makeNewSlide();
      slide.name = `${store.storeName} - ${type}`;
      
      // Header with centered title matching PDF
      const title = type === "recce" ? 'RECCE INSPECTION REPORT' : 'INSTALLATION COMPLETION REPORT';
      slide.addText(title, {
        x: 0.9, y: 0.15, cx: 8.2, cy: 0.6,
        font_size: 20, bold: true, color: type === "recce" ? 'EAB308' : '22C55E',
        align: 'center'
      });
      
      // Company info - top right
      slide.addText('ELORA CREATIVE ART', {
        x: 7.5, y: 0.1, cx: 2, cy: 0.25,
        font_size: 9, color: 'EAB308', align: 'right'
      });
      slide.addText('www.eloracreativeart.in', {
        x: 7.5, y: 0.3, cx: 2, cy: 0.25,
        font_size: 9, color: 'EAB308', align: 'right'
      });
      
      // Store details matching PDF layout
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // Row 1: Store | City | Status
      slide.addText(`Store: ${(store.storeName || 'N/A').substring(0, 30)}`, {
        x: 0.2, y: 1.0, cx: 3.5, cy: 0.3, font_size: 11, bold: true
      });
      slide.addText(`City: ${(store.location?.city || 'N/A').substring(0, 15)}`, {
        x: 4.0, y: 1.0, cx: 2, cy: 0.3, font_size: 11, bold: true
      });
      
      if (type === "installation") {
        slide.addText('✓ COMPLETED', {
          x: 6.5, y: 1.0, cx: 2, cy: 0.3, font_size: 11, bold: true, color: '22C55E'
        });
      }
      
      // Row 2: ID | Date | By
      slide.addText(`ID: ${(store.storeId || store.storeCode || 'N/A').substring(0, 20)}`, {
        x: 0.2, y: 1.3, cx: 2.5, cy: 0.3, font_size: 11
      });
      slide.addText(`Date: ${dateValue}`, {
        x: 2.8, y: 1.3, cx: 2, cy: 0.3, font_size: 11
      });
      slide.addText(`By: ${(submittedBy || 'N/A').substring(0, 25)}`, {
        x: 5.0, y: 1.3, cx: 3, cy: 0.3, font_size: 11
      });
      
      // Row 3: Address
      const address = store.location?.address || 'N/A';
      const truncatedAddress = address.length > 90 ? address.substring(0, 90) + '...' : address;
      slide.addText(`Address: ${truncatedAddress}`, {
        x: 0.2, y: 1.6, cx: 8.5, cy: 0.3, font_size: 11
      });

      // MAIN CONTENT - Full images without margins/padding
      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);
        
        try {
          // BEFORE image - full fit, no padding
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
          const axios = require('axios');
          const recceResponse = await axios.get(reccePhotoUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          if (recceResponse.status === 200) {
            const recceBuffer = Buffer.from(recceResponse.data);
            slide.addImage(recceBuffer, {
              x: 0.2, y: 2.1, cx: 4.3, cy: 4.2
            });
          }
        } catch (error) {
          console.log('Failed to load recce image for PPT');
        }
        
        // BEFORE label with red background
        slide.addText('BEFORE', {
          x: 0.2, y: 6.4, cx: 4.3, cy: 0.4,
          font_size: 14, bold: true, color: 'FFFFFF',
          fill: { color: 'EF4444' }, align: 'center'
        });
        
        if (installPhoto) {
          try {
            // AFTER image - full fit, no padding
            const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, '%20')}`;
            const installResponse = await axios.get(installPhotoUrl, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (installResponse.status === 200) {
              const installBuffer = Buffer.from(installResponse.data);
              slide.addImage(installBuffer, {
                x: 5.0, y: 2.1, cx: 4.3, cy: 4.2
              });
            }
          } catch (error) {
            console.log('Failed to load installation image for PPT');
          }
        }
        
        // AFTER label with green background
        slide.addText('AFTER', {
          x: 5.0, y: 6.4, cx: 4.3, cy: 0.4,
          font_size: 14, bold: true, color: 'FFFFFF',
          fill: { color: '22C55E' }, align: 'center'
        });
        
        // Measurements
        if (reccePhoto.measurements) {
          slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
            x: 2, y: 7.0, cx: 5.5, cy: 0.3,
            font_size: 12, align: 'center', color: '1F2937'
          });
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Single recce photo - full width, no padding
        const reccePhoto = store.recce.reccePhotos[0];
        
        try {
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
          const axios = require('axios');
          const response = await axios.get(reccePhotoUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          if (response.status === 200) {
            const buffer = Buffer.from(response.data);
            slide.addImage(buffer, {
              x: 0.5, y: 2.1, cx: 8.5, cy: 4.5
            });
          }
        } catch (error) {
          console.log('Failed to load recce image for PPT');
        }
        
        // Measurements
        if (reccePhoto.measurements) {
          slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
            x: 2, y: 7.0, cx: 5.5, cy: 0.3,
            font_size: 12, align: 'center', color: '1F2937'
          });
        }
      }
    }

    pptx.generate(res);
  } catch (error: any) {
    console.error("Bulk PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PPT" });
  }
};
