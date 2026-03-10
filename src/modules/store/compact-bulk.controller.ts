import { Request, Response } from "express";
import Store from "./store.model";
import fs from "fs";
import path from "path";

export const generateCompactBulkPDF = async (req: Request, res: Response) => {
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
    const doc = new PDFDocument({ size: 'A4', margin: 15, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Compact_${type}_${stores.length}_Stores.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      if (i > 0) doc.addPage();

      // COMPACT HEADER (Top 20%)
      doc.save();
      doc.rect(0, 0, doc.page.width, 120).fillOpacity(1).fill('#FFFEF5');
      doc.restore();
      
      // Logo and Title
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 20, 10, { width: 60, height: 20 });
      }
      
      const headerColor = type === "recce" ? '#EAB308' : '#22C55E';
      const title = type === "recce" ? 'RECCE REPORT' : 'INSTALLATION REPORT';
      
      doc.fillColor(headerColor).fontSize(14).font('Helvetica-Bold')
        .text(title, 90, 12, { width: 400, align: 'left' });
      
      doc.fillColor('#EAB308').fontSize(8).font('Helvetica')
        .text('ELORA CREATIVE ART', 650, 10, { width: 120, align: 'right' })
        .text('www.eloracreativeart.in', 650, 22, { width: 120, align: 'right' });

      // Store Info (1 row)
      doc.fillColor('#000000').fontSize(8);
      let y = 40;
      
      doc.font('Helvetica-Bold').text('Store:', 20, y, { continued: true, width: 40 });
      doc.font('Helvetica').text(`${store.storeName} (${store.storeId})`, 60, y, { width: 180 });
      doc.font('Helvetica-Bold').text('City:', 250, y, { continued: true, width: 30 });
      doc.font('Helvetica').text(store.location?.city || 'N/A', 280, y, { width: 120 });
      doc.font('Helvetica-Bold').text('Date:', 410, y, { continued: true, width: 30 });
      
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      doc.font('Helvetica').text(dateValue, 440, y, { width: 80 });
      
      if (type === "installation") {
        doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 530, y, { width: 100 });
      }

      // Address
      y += 12;
      doc.fillColor('#000000').font('Helvetica-Bold').text('Address:', 20, y, { continued: true, width: 50 });
      doc.font('Helvetica').text(store.location?.address || 'N/A', 70, y, { width: 350 });
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      doc.font('Helvetica-Bold').text('By:', 430, y, { continued: true, width: 20 });
      doc.font('Helvetica').text(submittedBy || 'N/A', 450, y, { width: 200 });

      // Separator
      doc.save();
      doc.strokeColor('#EAB308').lineWidth(1).moveTo(20, 65).lineTo(780, 65).stroke();
      doc.restore();

      // MAIN CONTENT (80% of page)
      const contentStartY = 75;
      
      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Before/After Layout
        const imgWidth = 240;
        const imgHeight = 180;
        const spacing = 15;
        
        let currentY = contentStartY;
        let photoIndex = 0;
        const maxPhotos = Math.min(2, store.recce.reccePhotos.length);
        
        for (let row = 0; row < 2 && photoIndex < maxPhotos; row++) {
          const reccePhoto = store.recce.reccePhotos[photoIndex];
          const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === photoIndex);
          
          const rowY = currentY + (row * (imgHeight + 40));
          
          // BEFORE (Left)
          const beforeX = 50;
          
          doc.save();
          doc.rect(beforeX, rowY, imgWidth, imgHeight + 15).strokeColor('#EF4444').lineWidth(1).stroke();
          doc.restore();
          
          const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
          if (fs.existsSync(reccePhotoPath)) {
            doc.image(reccePhotoPath, beforeX + 3, rowY + 3, { 
              width: imgWidth - 6, 
              height: imgHeight - 6, 
              fit: [imgWidth - 6, imgHeight - 6] 
            });
          }
          
          doc.save();
          doc.rect(beforeX, rowY + imgHeight, imgWidth, 15).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
            .text(`BEFORE - Photo ${photoIndex + 1}`, beforeX, rowY + imgHeight + 4, { width: imgWidth, align: 'center' });
          
          // AFTER (Right)
          const afterX = beforeX + imgWidth + spacing;
          
          doc.save();
          doc.rect(afterX, rowY, imgWidth, imgHeight + 15).strokeColor('#22C55E').lineWidth(1).stroke();
          doc.restore();
          
          if (installPhoto) {
            const installPhotoPath = path.join(process.cwd(), installPhoto.installationPhoto);
            if (fs.existsSync(installPhotoPath)) {
              doc.image(installPhotoPath, afterX + 3, rowY + 3, { 
                width: imgWidth - 6, 
                height: imgHeight - 6, 
                fit: [imgWidth - 6, imgHeight - 6] 
              });
            }
          }
          
          doc.save();
          doc.rect(afterX, rowY + imgHeight, imgWidth, 15).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
            .text(`AFTER - Photo ${photoIndex + 1}`, afterX, rowY + imgHeight + 4, { width: imgWidth, align: 'center' });
          
          // Measurements
          if (reccePhoto.measurements) {
            const measureY = rowY + imgHeight + 20;
            doc.fillColor('#1F2937').fontSize(7).font('Helvetica')
              .text(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 
                    50, measureY, { width: 500, align: 'center' });
          }
          
          photoIndex++;
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Recce Photos Grid
        const imgWidth = 160;
        const imgHeight = 120;
        const spacing = 10;
        const photosPerRow = 4;
        
        let currentY = contentStartY;
        const maxPhotos = Math.min(8, store.recce.reccePhotos.length);
        
        for (let i = 0; i < maxPhotos; i++) {
          const reccePhoto = store.recce.reccePhotos[i];
          const col = i % photosPerRow;
          const row = Math.floor(i / photosPerRow);
          
          const x = 50 + col * (imgWidth + spacing);
          const y = currentY + row * (imgHeight + 25);
          
          doc.save();
          doc.rect(x, y, imgWidth, imgHeight + 15).strokeColor('#EAB308').lineWidth(1).stroke();
          doc.restore();
          
          const photoPath = path.join(process.cwd(), reccePhoto.photo);
          if (fs.existsSync(photoPath)) {
            doc.image(photoPath, x + 2, y + 2, { 
              width: imgWidth - 4, 
              height: imgHeight - 4, 
              fit: [imgWidth - 4, imgHeight - 4] 
            });
          }
          
          doc.save();
          doc.rect(x, y + imgHeight, imgWidth, 15).fillOpacity(1).fillAndStroke('#EAB308', '#EAB308');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold')
            .text(`Photo ${i + 1}`, x, y + imgHeight + 3, { width: imgWidth, align: 'center' });
        }
      }

      // Footer
      doc.fillColor('#6B7280').fontSize(6).font('Helvetica')
        .text(`Generated: ${new Date().toLocaleDateString()} | ELORA CREATIVE ART`, 
              20, doc.page.height - 20, { width: 760, align: 'center' });
    }

    doc.end();
  } catch (error: any) {
    console.error("Compact Bulk PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating compact bulk PDF" });
  }
};

export const generateCompactBulkPPT = async (req: Request, res: Response) => {
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
    res.setHeader('Content-Disposition', `attachment; filename="Compact_${type}_${stores.length}_Stores.pptx"`);

    // Title Slide
    const titleSlide = pptx.makeNewSlide();
    titleSlide.name = `${type} Report`;
    
    const title = type === "recce" ? 'RECCE INSPECTION REPORT' : 'INSTALLATION COMPLETION REPORT';
    const color = type === "recce" ? 'EAB308' : '22C55E';
    
    titleSlide.addText(title, {
      x: 0.5, y: 2, cx: 9, cy: 1,
      font_size: 28, bold: true, color: color
    });
    
    titleSlide.addText(`${stores.length} Stores Report`, {
      x: 0.5, y: 3.5, cx: 9, cy: 0.8,
      font_size: 18, color: '1F2937'
    });
    
    titleSlide.addText('ELORA CREATIVE ART', {
      x: 0.5, y: 5, cx: 9, cy: 0.5,
      font_size: 14, color: 'EAB308'
    });

    // Store slides
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const slide = pptx.makeNewSlide();
      slide.name = `${store.storeName}`;
      
      // Compact header (top 15%)
      slide.addText(`${store.storeName} (${store.storeId})`, {
        x: 0.5, y: 0.2, cx: 9, cy: 0.6,
        font_size: 16, bold: true, color: '1F2937'
      });
      
      slide.addText(`${store.location?.city} | ${type === "recce" ? 
        (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A') :
        (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A')}`, {
        x: 0.5, y: 0.8, cx: 9, cy: 0.4,
        font_size: 12, color: '6B7280'
      });

      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Before/After comparison (85% of slide)
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);
        
        const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
        const installPhotoPath = installPhoto ? path.join(process.cwd(), installPhoto.installationPhoto) : null;
        
        if (fs.existsSync(reccePhotoPath)) {
          slide.addImage(reccePhotoPath, { x: 0.5, y: 1.5, cx: 4, cy: 4 });
          slide.addText('BEFORE', { x: 0.5, y: 5.7, cx: 4, cy: 0.3, font_size: 12, bold: true, color: 'EF4444' });
        }
        
        if (installPhotoPath && fs.existsSync(installPhotoPath)) {
          slide.addImage(installPhotoPath, { x: 5.5, y: 1.5, cx: 4, cy: 4 });
          slide.addText('AFTER', { x: 5.5, y: 5.7, cx: 4, cy: 0.3, font_size: 12, bold: true, color: '22C55E' });
        }
        
        if (reccePhoto.measurements) {
          slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
            x: 0.5, y: 6.2, cx: 9, cy: 0.3,
            font_size: 10, color: '6B7280'
          });
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Recce photos grid
        const maxPhotos = Math.min(4, store.recce.reccePhotos.length);
        
        for (let j = 0; j < maxPhotos; j++) {
          const reccePhoto = store.recce.reccePhotos[j];
          const photoPath = path.join(process.cwd(), reccePhoto.photo);
          
          if (fs.existsSync(photoPath)) {
            const x = 0.5 + (j % 2) * 4.5;
            const y = 1.5 + Math.floor(j / 2) * 2.5;
            
            slide.addImage(photoPath, { x: x, y: y, cx: 4, cy: 2 });
            slide.addText(`Photo ${j + 1}`, { x: x, y: y + 2.2, cx: 4, cy: 0.3, font_size: 10, color: 'EAB308' });
          }
        }
      }
    }

    pptx.generate(res);
  } catch (error: any) {
    console.error("Compact Bulk PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating compact bulk PPT" });
  }
};