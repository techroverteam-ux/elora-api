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

      // SIDE-BY-SIDE Layout: Store Details (Left) + Initial Photos (Right)
      doc.fillColor('#000000').fontSize(10);
      let y = 50;
      
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // LEFT SIDE: Store Details Box (400px width)
      doc.save();
      doc.rect(30, y - 5, 400, 65).strokeColor('#EAB308').lineWidth(1).stroke();
      doc.restore();
      
      // Store details in left box
      doc.font('Helvetica-Bold').text('Store:', 40, y, { width: 60 });
      doc.font('Helvetica').text(store.storeName || 'Fusion Electro World', 100, y, { width: 320 });
      
      y += 15;
      doc.font('Helvetica-Bold').text('ID:', 40, y, { width: 60 });
      doc.font('Helvetica').text(store.storeId || store.storeCode || 'UDAUDAIN002301', 100, y, { width: 150 });
      doc.font('Helvetica-Bold').text('City:', 260, y, { width: 40 });
      doc.font('Helvetica').text(store.location?.city || 'Udaipur', 300, y, { width: 130 });
      
      y += 15;
      doc.font('Helvetica-Bold').text('Date:', 40, y, { width: 60 });
      doc.font('Helvetica').text(dateValue, 100, y, { width: 150 });
      doc.font('Helvetica-Bold').text('By:', 260, y, { width: 30 });
      doc.font('Helvetica').text(submittedBy || 'Amjad', 290, y, { width: 140 });
      
      y += 15;
      doc.font('Helvetica-Bold').text('Address:', 40, y, { width: 60 });
      const address = store.location?.address || 'SHOP NO. 1-2 MEERA PLAZA COMMUNITY HALL ROAD SHAKTI NAGAR UDAIPUR';
      doc.font('Helvetica').text(address, 100, y, { width: 330, height: 15 });
      
      if (type === "installation") {
        doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 350, 50, { width: 80 });
      }

      // RIGHT SIDE: Initial Photos (if available) - Single line, bigger size
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        const photoSize = 60;
        const photoSpacing = 8;
        const rightStartX = 450;
        let photoY = 50;
        
        doc.fillColor('#666666').fontSize(8).font('Helvetica')
          .text('Initial Photos:', rightStartX, photoY - 12);
        
        // Arrange photos in single row
        for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 5); i++) {
          const x = rightStartX + i * (photoSize + photoSpacing);
          
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
      }

      // Professional separator line
      doc.save();
      doc.strokeColor('#EAB308').lineWidth(2).moveTo(30, 125).lineTo(770, 125).stroke();
      doc.restore();

      // MAIN CONTENT AREA
      const contentStartY = 135;
      const availableHeight = doc.page.height - contentStartY - 30;
      const availableWidth = doc.page.width - 60;

      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Installation: Show multiple after images if available
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhotos = store.installation.photos.filter((p: any) => p.reccePhotoIndex === 0);
        
        if (installPhotos.length >= 2) {
          // Three images: Before + After1 + After2
          const imgWidth = doc.page.width / 3;
          const imgHeight = availableHeight - 20;
          
          // BEFORE (Left)
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
          try {
            const axios = require('axios');
            const response = await axios.get(reccePhotoUrl, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (response.status === 200) {
              const buffer = Buffer.from(response.data);
              // Add border
              doc.save();
              doc.rect(0, contentStartY, imgWidth, imgHeight).strokeColor('#EF4444').lineWidth(3).stroke();
              doc.restore();
              
              doc.image(buffer, 5, contentStartY + 5, { 
                width: imgWidth - 10, 
                height: imgHeight - 10, 
                fit: [imgWidth - 10, imgHeight - 10] 
              });
            }
          } catch (error: any) {
            console.log(`Failed to load recce image: ${error.message}`);
          }
          
          // AFTER 1 (Middle)
          const installPhoto1Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[0].installationPhoto.replace(/\s+/g, '%20')}`;
          try {
            const axios = require('axios');
            const response = await axios.get(installPhoto1Url, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (response.status === 200) {
              const buffer = Buffer.from(response.data);
              // Add border
              doc.save();
              doc.rect(imgWidth, contentStartY, imgWidth, imgHeight).strokeColor('#22C55E').lineWidth(3).stroke();
              doc.restore();
              
              doc.image(buffer, imgWidth + 5, contentStartY + 5, { 
                width: imgWidth - 10, 
                height: imgHeight - 10, 
                fit: [imgWidth - 10, imgHeight - 10] 
              });
            }
          } catch (error: any) {
            console.log(`Failed to load installation image 1: ${error.message}`);
          }
          
          // AFTER 2 (Right)
          const installPhoto2Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[1].installationPhoto.replace(/\s+/g, '%20')}`;
          try {
            const axios = require('axios');
            const response = await axios.get(installPhoto2Url, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (response.status === 200) {
              const buffer = Buffer.from(response.data);
              // Add border
              doc.save();
              doc.rect(imgWidth * 2, contentStartY, imgWidth, imgHeight).strokeColor('#22C55E').lineWidth(3).stroke();
              doc.restore();
              
              doc.image(buffer, imgWidth * 2 + 5, contentStartY + 5, { 
                width: imgWidth - 10, 
                height: imgHeight - 10, 
                fit: [imgWidth - 10, imgHeight - 10] 
              });
            }
          } catch (error: any) {
            console.log(`Failed to load installation image 2: ${error.message}`);
          }
          
          // Labels
          doc.save();
          doc.rect(0, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
            .text('BEFORE', 0, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
          
          doc.save();
          doc.rect(imgWidth, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
            .text('AFTER 1', imgWidth, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
          
          doc.save();
          doc.rect(imgWidth * 2, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
            .text('AFTER 2', imgWidth * 2, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
        } else {
          // Two images: Before + After
          const imgWidth = doc.page.width / 2;
          const imgHeight = availableHeight - 20;
          
          const installPhoto = installPhotos[0];
          
          // BEFORE (Left)
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
          try {
            const axios = require('axios');
            const response = await axios.get(reccePhotoUrl, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (response.status === 200) {
              const buffer = Buffer.from(response.data);
              // Add border
              doc.save();
              doc.rect(0, contentStartY, imgWidth, imgHeight).strokeColor('#EF4444').lineWidth(3).stroke();
              doc.restore();
              
              doc.image(buffer, 5, contentStartY + 5, { 
                width: imgWidth - 10, 
                height: imgHeight - 10, 
                fit: [imgWidth - 10, imgHeight - 10] 
              });
            }
          } catch (error: any) {
            console.log(`Failed to load recce image: ${error.message}`);
          }
          
          // AFTER (Right)
          if (installPhoto) {
            const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, '%20')}`;
            try {
              const axios = require('axios');
              const response = await axios.get(installPhotoUrl, { 
                responseType: 'arraybuffer',
                timeout: 10000
              });
              
              if (response.status === 200) {
                const buffer = Buffer.from(response.data);
                // Add border
                doc.save();
                doc.rect(imgWidth, contentStartY, imgWidth, imgHeight).strokeColor('#22C55E').lineWidth(3).stroke();
                doc.restore();
                
                doc.image(buffer, imgWidth + 5, contentStartY + 5, { 
                  width: imgWidth - 10, 
                  height: imgHeight - 10, 
                  fit: [imgWidth - 10, imgHeight - 10] 
                });
              }
            } catch (error: any) {
              console.log(`Failed to load installation image: ${error.message}`);
            }
          }
          
          // Labels
          doc.save();
          doc.rect(0, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
            .text('BEFORE', 0, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
          
          doc.save();
          doc.rect(imgWidth, contentStartY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
            .text('AFTER', imgWidth, contentStartY + imgHeight + 6, { width: imgWidth, align: 'center' });
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Single recce photo - Full width
        const reccePhoto = store.recce.reccePhotos[0];
        const singleImgHeight = availableHeight - 30;
        
        const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
        try {
          const axios = require('axios');
          const response = await axios.get(reccePhotoUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          if (response.status === 200) {
            const buffer = Buffer.from(response.data);
            doc.image(buffer, 0, contentStartY, { 
              width: doc.page.width, 
              height: singleImgHeight, 
              fit: [doc.page.width, singleImgHeight] 
            });
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
      
      // SIDE-BY-SIDE Layout: Store Details (Left) + Initial Photos (Right)
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // LEFT SIDE: Store Details (compact)
      slide.addText(`Store: ${store.storeName || 'Fusion Electro World'}`, {
        x: 0.3, y: 0.7, cx: 4, cy: 0.25, font_size: 11, bold: true
      });
      slide.addText(`ID: ${store.storeId || store.storeCode || 'UDAUDAIN002301'}`, {
        x: 0.3, y: 0.95, cx: 2.5, cy: 0.25, font_size: 10
      });
      slide.addText(`City: ${store.location?.city || 'Udaipur'}`, {
        x: 2.8, y: 0.95, cx: 1.5, cy: 0.25, font_size: 10
      });
      slide.addText(`Date: ${dateValue}`, {
        x: 0.3, y: 1.2, cx: 2.5, cy: 0.25, font_size: 10
      });
      slide.addText(`By: ${submittedBy || 'Amjad'}`, {
        x: 2.8, y: 1.2, cx: 1.5, cy: 0.25, font_size: 10
      });
      
      const address = store.location?.address || 'SHOP NO. 1-2 MEERA PLAZA COMMUNITY HALL ROAD SHAKTI NAGAR UDAIPUR';
      slide.addText(`Address: ${address}`, {
        x: 0.3, y: 1.45, cx: 4, cy: 0.4, font_size: 10, wrap: true
      });
      
      if (type === "installation") {
        slide.addText('✓ COMPLETED', {
          x: 3.8, y: 0.7, cx: 1, cy: 0.25, font_size: 11, bold: true, color: '22C55E'
        });
      }

      // RIGHT SIDE: Initial Photos (if available) - Single line, bigger size
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        slide.addText('Initial Photos:', {
          x: 5.2, y: 0.6, cx: 2, cy: 0.2,
          font_size: 8, color: '666666'
        });
        
        const photoSize = 0.6;
        const photoSpacing = 0.08;
        const rightStartX = 5.2;
        const photoY = 0.8;
        
        // Arrange photos in single row
        for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 5); i++) {
          const x = rightStartX + i * (photoSize + photoSpacing);
          
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
            console.log('Failed to load initial photo for PPT');
          }
        }
      }

      // MAIN CONTENT - Fixed positioning for new layout
      const contentStartY = 2.0;
      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhotos = store.installation.photos.filter((p: any) => p.reccePhotoIndex === 0);
        
        if (installPhotos.length >= 2) {
          // Three images: Before + After1 + After2
          try {
            const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
            const axios = require('axios');
            const recceResponse = await axios.get(reccePhotoUrl, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (recceResponse.status === 200) {
              const recceBuffer = Buffer.from(recceResponse.data);
              slide.addImage(recceBuffer, {
                x: 0.2, y: contentStartY, cx: 2.8, cy: 3.5
              });
            }
          } catch (error) {
            console.log('Failed to load recce image for PPT');
          }
          
          // AFTER 1
          try {
            const installPhoto1Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[0].installationPhoto.replace(/\s+/g, '%20')}`;
            const installResponse1 = await axios.get(installPhoto1Url, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (installResponse1.status === 200) {
              const installBuffer1 = Buffer.from(installResponse1.data);
              slide.addImage(installBuffer1, {
                x: 3.2, y: contentStartY, cx: 2.8, cy: 3.5
              });
            }
          } catch (error) {
            console.log('Failed to load installation image 1 for PPT');
          }
          
          // AFTER 2
          try {
            const installPhoto2Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[1].installationPhoto.replace(/\s+/g, '%20')}`;
            const installResponse2 = await axios.get(installPhoto2Url, { 
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            if (installResponse2.status === 200) {
              const installBuffer2 = Buffer.from(installResponse2.data);
              slide.addImage(installBuffer2, {
                x: 6.2, y: contentStartY, cx: 2.8, cy: 3.5
              });
            }
          } catch (error) {
            console.log('Failed to load installation image 2 for PPT');
          }
          
          // Labels
          slide.addText('BEFORE', {
            x: 0.2, y: contentStartY + 3.6, cx: 2.8, cy: 0.3,
            font_size: 12, bold: true, color: 'FFFFFF',
            fill: { color: 'EF4444' }, align: 'center'
          });
          slide.addText('AFTER 1', {
            x: 3.2, y: contentStartY + 3.6, cx: 2.8, cy: 0.3,
            font_size: 12, bold: true, color: 'FFFFFF',
            fill: { color: '22C55E' }, align: 'center'
          });
          slide.addText('AFTER 2', {
            x: 6.2, y: contentStartY + 3.6, cx: 2.8, cy: 0.3,
            font_size: 12, bold: true, color: 'FFFFFF',
            fill: { color: '22C55E' }, align: 'center'
          });
        } else {
          // Two images: Before + After
          const installPhoto = installPhotos[0];
          
          try {
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
          
          if (installPhoto) {
            try {
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
          
          // Labels
          slide.addText('BEFORE', {
            x: 0.3, y: contentStartY + 3.9, cx: 4.2, cy: 0.4,
            font_size: 14, bold: true, color: 'FFFFFF',
            fill: { color: 'EF4444' }, align: 'center'
          });
          slide.addText('AFTER', {
            x: 4.8, y: contentStartY + 3.9, cx: 4.2, cy: 0.4,
            font_size: 14, bold: true, color: 'FFFFFF',
            fill: { color: '22C55E' }, align: 'center'
          });
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Single recce photo
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
      }
    }

    pptx.generate(res);
  } catch (error: any) {
    console.error("Bulk PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PPT" });
  }
};
