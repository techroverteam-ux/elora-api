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
      const title = type === "recce" ? 'Recce Inspection Report' : 'Installation Completion Report';
      
      doc.fillColor(headerColor).fontSize(16).font('Helvetica-Bold')
        .text(title, 30, 20, { width: doc.page.width - 210, align: 'center' });
      
      doc.fillColor('#EAB308').fontSize(10).font('Helvetica')
        .text('ELORA CREATIVE ART', 650, 15, { width: 150, align: 'right' })
        .text('www.eloracreativeart.in', 650, 28, { width: 150, align: 'right' });

      // Add initial photos in small layout if available (for both recce and installation)
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        const photoSize = 60;
        const photoSpacing = 5;
        const startX = 30;
        let photoY = 45;
        
        doc.fillColor('#666666').fontSize(8).font('Helvetica')
          .text('Initial Photos:', startX, photoY - 12);
        
        for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 6); i++) {
          const col = i % 6;
          const x = startX + col * (photoSize + photoSpacing);
          
          try {
            const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[i].replace(/\s+/g, '%20')}`;
            const axios = require('axios');
            const response = await axios.get(photoUrl, { 
              responseType: 'arraybuffer',
              timeout: 5000
            });
            
            if (response.status === 200) {
              const buffer = Buffer.from(response.data);
              doc.image(buffer, x, photoY, { 
                width: photoSize, 
                height: photoSize, 
                fit: [photoSize, photoSize] 
              });
            }
          } catch (error) {
            doc.save();
            doc.rect(x, photoY, photoSize, photoSize).strokeColor('#CCCCCC').stroke();
            doc.restore();
          }
        }
        photoY += photoSize + 10;
      }

      // WELL-FORMATTED Store Details - Professional Layout
      doc.fillColor('#000000').fontSize(10);
      let y = store.recce?.initialPhotos && store.recce.initialPhotos.length > 0 ? 120 : 50;
      
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // Create a bordered info box
      doc.save();
      doc.rect(30, y - 5, 740, 65).strokeColor('#EAB308').lineWidth(1).stroke();
      doc.restore();
      
      // Row 1: Store Name and City
      doc.font('Helvetica-Bold').text('Store:', 40, y, { width: 60 });
      doc.font('Helvetica').text(store.storeName || 'Fusion Electro World', 100, y, { width: 250 });
      doc.font('Helvetica-Bold').text('City:', 400, y, { width: 40 });
      doc.font('Helvetica').text(store.location?.city || 'Udaipur', 440, y, { width: 150 });
      
      if (type === "installation") {
        doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 620, y, { width: 140 });
      }
      
      y += 18;
      // Row 2: Store ID and Date
      doc.fillColor('#000000').font('Helvetica-Bold').text('ID:', 40, y, { width: 60 });
      doc.font('Helvetica').text(store.storeId || store.storeCode || 'UDAUDAIN002301', 100, y, { width: 200 });
      doc.font('Helvetica-Bold').text('Date:', 400, y, { width: 40 });
      doc.font('Helvetica').text(dateValue, 440, y, { width: 150 });
      doc.font('Helvetica-Bold').text('By:', 620, y, { width: 30 });
      doc.font('Helvetica').text(submittedBy || 'Amjad', 650, y, { width: 120 });
      
      y += 18;
      // Row 3: Address - Full width with proper wrapping
      doc.font('Helvetica-Bold').text('Address:', 40, y, { width: 60 });
      const address = store.location?.address || 'SHOP NO. 1-2 MEERA PLAZA COMMUNITY HALL ROAD SHAKTI NAGAR UDAIPUR';
      doc.font('Helvetica').text(address, 100, y, { width: 670, height: 20 });

      // Professional separator line
      doc.save();
      doc.strokeColor('#EAB308').lineWidth(2).moveTo(30, y + 25).lineTo(770, y + 25).stroke();
      doc.restore();

      // MAIN CONTENT AREA (75% of page)
      const contentStartY = y + 35;
      const availableHeight = doc.page.height - contentStartY - 30;
      const availableWidth = doc.page.width - 60;

      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Before/After Layout - Full width, no padding except bottom
        const imgWidth = (doc.page.width) / 2; // Full half width each
        const imgHeight = availableHeight - 20; // Leave space for bottom labels
        
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);
        
        // BEFORE (Left) - No padding, full edge to edge
        const beforeX = 0;
        
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
            doc.image(buffer, beforeX, contentStartY, { 
              width: imgWidth, 
              height: imgHeight, 
              fit: [imgWidth, imgHeight] 
            });
            console.log('Recce image loaded successfully');
          }
        } catch (error: any) {
          console.log(`Failed to load recce image: ${error.message}`);
        }
        
        // AFTER (Right) - No padding, full edge to edge
        const afterX = imgWidth;
        
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
              doc.image(buffer, afterX, contentStartY, { 
                width: imgWidth, 
                height: imgHeight, 
                fit: [imgWidth, imgHeight] 
              });
              console.log('Installation image loaded successfully');
            }
          } catch (error: any) {
            console.log(`Failed to load installation image: ${error.message}`);
          }
        }
        
        // Labels at bottom with full width
        doc.save();
        doc.rect(beforeX, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('BEFORE', beforeX, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
        
        doc.save();
        doc.rect(afterX, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('AFTER', afterX, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
        
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Single recce photo - Full width, no padding except bottom
        const reccePhoto = store.recce.reccePhotos[0];
        const singleImgHeight = availableHeight - 30;
        
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
            doc.image(buffer, 0, contentStartY, { 
              width: doc.page.width, 
              height: singleImgHeight, 
              fit: [doc.page.width, singleImgHeight] 
            });
            console.log('Single recce image loaded successfully');
          }
        } catch (error: any) {
          console.log(`Failed to load single recce image: ${error.message}`);
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
    
    titleSlide.addText(`${type === "recce" ? "Recce Inspection" : "Installation Completion"} REPORT`, {
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
      const title = type === "recce" ? 'Recce Inspection Report' : 'Installation Completion Report';
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
      
      // Add initial photos in small layout if available (for both recce and installation)
      let detailsStartY = 1.0;
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        slide.addText('Initial Photos:', {
          x: 0.3, y: 0.6, cx: 2, cy: 0.2,
          font_size: 8, color: '666666'
        });
        
        const photoSize = 0.6;
        const photoSpacing = 0.05;
        const startX = 0.3;
        const photoY = 0.8;
        
        for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 6); i++) {
          const x = startX + i * (photoSize + photoSpacing);
          
          try {
            const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[i].replace(/\s+/g, '%20')}`;
            const axios = require('axios');
            const response = await axios.get(photoUrl, { 
              responseType: 'arraybuffer',
              timeout: 5000
            });
            
            if (response.status === 200) {
              const buffer = Buffer.from(response.data);
              slide.addImage(buffer, {
                x: x, y: photoY, cx: photoSize, cy: photoSize
              });
            }
          } catch (error) {
            // Add placeholder rectangle for failed images
            console.log('Failed to load initial photo for PPT');
          }
        }
        detailsStartY = 1.5;
      }
      
      // Store details with better formatting and spacing
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // Row 1: Store Name and City with better spacing
      slide.addText(`Store: ${store.storeName || 'Fusion Electro World'}`, {
        x: 0.3, y: detailsStartY, cx: 4, cy: 0.3, font_size: 12, bold: true
      });
      slide.addText(`City: ${store.location?.city || 'Udaipur'}`, {
        x: 4.5, y: detailsStartY, cx: 2, cy: 0.3, font_size: 12, bold: true
      });
      
      if (type === "installation") {
        slide.addText('✓ COMPLETED', {
          x: 7, y: detailsStartY, cx: 2, cy: 0.3, font_size: 12, bold: true, color: '22C55E'
        });
      }
      
      // Row 2: Store ID, Date, and Submitted By
      slide.addText(`ID: ${store.storeId || store.storeCode || 'UDAUDAIN002301'}`, {
        x: 0.3, y: detailsStartY + 0.35, cx: 3, cy: 0.3, font_size: 11
      });
      slide.addText(`Date: ${dateValue}`, {
        x: 3.5, y: detailsStartY + 0.35, cx: 2.5, cy: 0.3, font_size: 11
      });
      slide.addText(`By: ${submittedBy || 'Amjad'}`, {
        x: 6.2, y: detailsStartY + 0.35, cx: 2.5, cy: 0.3, font_size: 11
      });
      
      // Row 3: Full Address with proper wrapping
      const address = store.location?.address || 'SHOP NO. 1-2 MEERA PLAZA COMMUNITY HALL ROAD SHAKTI NAGAR UDAIPUR';
      slide.addText(`Address: ${address}`, {
        x: 0.3, y: detailsStartY + 0.7, cx: 8.4, cy: 0.4, font_size: 11, wrap: true
      });

      // MAIN CONTENT - Adjusted for dynamic header spacing
      const contentStartY = detailsStartY + 1.3;
      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);
        
        try {
          // BEFORE image - positioned dynamically
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
          const axios = require('axios');
          const recceResponse = await axios.get(reccePhotoUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          if (recceResponse.status === 200) {
            const recceBuffer = Buffer.from(recceResponse.data);
            slide.addImage(recceBuffer, {
              x: 0.3, y: contentStartY, cx: 4.2, cy: 3.8
            });
          }
        } catch (error) {
          console.log('Failed to load recce image for PPT');
        }
        
        // BEFORE label with red background
        slide.addText('BEFORE', {
          x: 0.3, y: contentStartY + 3.9, cx: 4.2, cy: 0.4,
          font_size: 14, bold: true, color: 'FFFFFF',
          fill: { color: 'EF4444' }, align: 'center'
        });
        
        if (installPhoto) {
          try {
            // AFTER image - positioned dynamically
            const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, '%20')}`;
            const installResponse = await axios.get(installPhotoUrl, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (installResponse.status === 200) {
              const installBuffer = Buffer.from(installResponse.data);
              slide.addImage(installBuffer, {
                x: 4.8, y: contentStartY, cx: 4.2, cy: 3.8
              });
            }
          } catch (error) {
            console.log('Failed to load installation image for PPT');
          }
        }
        
        // AFTER label with green background
        slide.addText('AFTER', {
          x: 4.8, y: contentStartY + 3.9, cx: 4.2, cy: 0.4,
          font_size: 14, bold: true, color: 'FFFFFF',
          fill: { color: '22C55E' }, align: 'center'
        });
        
        // Measurements
        if (reccePhoto.measurements) {
          slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
            x: 2, y: contentStartY + 4.5, cx: 5.5, cy: 0.3,
            font_size: 12, align: 'center', color: '1F2937'
          });
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Single recce photo - positioned dynamically
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
              x: 0.5, y: contentStartY, cx: 8.5, cy: 4.2
            });
          }
        } catch (error) {
          console.log('Failed to load recce image for PPT');
        }
        
        // Measurements
        if (reccePhoto.measurements) {
          slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
            x: 2, y: contentStartY + 4.5, cx: 5.5, cy: 0.3,
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
