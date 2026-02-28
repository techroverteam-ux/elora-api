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
      
      if (type === "recce") {
        doc.font('Helvetica-Bold').text('Recce Date:', 50, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A', 170, y, { width: 200 });
        doc.font('Helvetica-Bold').text('Submitted By:', 420, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.recce?.submittedBy || 'N/A', 540, y, { width: 250 });
        y += 25;
        doc.font('Helvetica-Bold').text('Notes:', 50, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.recce?.notes || 'None', 170, y, { width: 620 });
      } else {
        doc.font('Helvetica-Bold').text('Completion Date:', 50, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A', 170, y, { width: 200 });
        doc.font('Helvetica-Bold').text('Submitted By:', 420, y, { continued: false, width: 120 });
        doc.font('Helvetica').text(store.installation?.submittedBy || 'N/A', 540, y, { width: 250 });
        y += 25;
        doc.font('Helvetica-Bold').text('Status:', 50, y, { continued: false, width: 120 });
        doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 170, y, { width: 620 });
      }

      // Images Section - Show only first 3 recce photos or first before/after comparison
      if (type === "recce" && store.recce?.reccePhotos && store.recce.reccePhotos.length > 0) {
        const sectionTitle = 'RECCE PHOTOS (First 3)';
        doc.fillColor(headerColor).fontSize(14).font('Helvetica-Bold')
          .text(sectionTitle, 40, 300, { width: 760, align: 'center' });

        const imgY = 330;
        const imgWidth = 220;
        const imgHeight = 165;
        const spacing = 30;

        for (let j = 0; j < Math.min(3, store.recce.reccePhotos.length); j++) {
          const reccePhoto = store.recce.reccePhotos[j];
          const x = 60 + j * (imgWidth + spacing);
          
          doc.save();
          doc.rect(x, imgY, imgWidth, imgHeight + 25).strokeColor('#EAB308').lineWidth(1).stroke();
          doc.restore();
          
          const photoPath = path.join(process.cwd(), reccePhoto.photo);
          if (fs.existsSync(photoPath)) {
            doc.image(photoPath, x + 5, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          }
          
          doc.save();
          doc.rect(x, imgY + imgHeight, imgWidth, 25).fillOpacity(1).fillAndStroke('#EAB308', '#B45309');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(`Photo ${j + 1}`, x, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
        }
      } else if (type === "installation" && store.recce?.reccePhotos && store.recce.reccePhotos.length > 0 && store.installation?.photos) {
        const sectionTitle = 'BEFORE & AFTER (First Comparison)';
        doc.fillColor(headerColor).fontSize(14).font('Helvetica-Bold')
          .text(sectionTitle, 40, 300, { width: 760, align: 'center' });

        const imgY = 330;
        const imgWidth = 220;
        const imgHeight = 165;
        const spacing = 30;

        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);

        // BEFORE
        const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
        doc.save();
        doc.rect(60, imgY, imgWidth, imgHeight + 25).strokeColor('#EF4444').lineWidth(1).stroke();
        doc.restore();
        if (fs.existsSync(reccePhotoPath)) {
          doc.image(reccePhotoPath, 65, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
        }
        doc.save();
        doc.rect(60, imgY + imgHeight, imgWidth, 25).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text('BEFORE', 60, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });

        // AFTER
        if (installPhoto) {
          const installPhotoPath = path.join(process.cwd(), installPhoto.installationPhoto);
          doc.save();
          doc.rect(60 + imgWidth + spacing, imgY, imgWidth, imgHeight + 25).strokeColor('#22C55E').lineWidth(1).stroke();
          doc.restore();
          if (fs.existsSync(installPhotoPath)) {
            doc.image(installPhotoPath, 65 + imgWidth + spacing, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          }
          doc.save();
          doc.rect(60 + imgWidth + spacing, imgY + imgHeight, imgWidth, 25).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text('AFTER', 60 + imgWidth + spacing, imgY + imgHeight + 7, { width: imgWidth, align: 'center' });
        }
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("Bulk PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PDF" });
  }
};
