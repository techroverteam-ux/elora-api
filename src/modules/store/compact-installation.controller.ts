import { Request, Response } from "express";
import Store from "./store.model";
import fs from "fs";
import path from "path";

export const generateCompactInstallationPDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store || !store.installation) {
      return res.status(404).json({ message: "Store or Installation data not found" });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 20, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="INSTALL_${store.storeName}_${store.storeId}.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // COMPACT HEADER (Top 25-30%)
    doc.save();
    doc.rect(0, 0, doc.page.width, 180).fillOpacity(1).fill('#FFFEF5');
    doc.restore();
    
    // Logo and Title in single row
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 15, { width: 80, height: 25 });
    }
    
    doc.fillColor('#22C55E').fontSize(16).font('Helvetica-Bold')
      .text('INSTALLATION COMPLETION REPORT', 120, 20, { width: 500, align: 'left' });
    
    doc.fillColor('#EAB308').fontSize(10).font('Helvetica')
      .text('ELORA CREATIVE ART', 650, 15, { width: 150, align: 'right' })
      .text('www.eloracreativeart.in', 650, 28, { width: 150, align: 'right' });

    // Compact Store Info (2 rows only)
    doc.fillColor('#000000').fontSize(9);
    let y = 55;
    
    doc.font('Helvetica-Bold').text('Store:', 30, y, { continued: true, width: 50 });
    doc.font('Helvetica').text(`${store.storeName} (${store.storeId})`, 80, y, { width: 200 });
    doc.font('Helvetica-Bold').text('City:', 300, y, { continued: true, width: 40 });
    doc.font('Helvetica').text(store.location?.city || 'N/A', 340, y, { width: 150 });
    doc.font('Helvetica-Bold').text('Date:', 500, y, { continued: true, width: 40 });
    doc.font('Helvetica').text(store.installation.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A', 540, y, { width: 100 });
    doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 650, y, { width: 150 });
    
    y += 15;
    doc.fillColor('#000000').font('Helvetica-Bold').text('Address:', 30, y, { continued: true, width: 60 });
    doc.font('Helvetica').text(store.location?.address || 'N/A', 90, y, { width: 400 });
    doc.font('Helvetica-Bold').text('By:', 500, y, { continued: true, width: 30 });
    doc.font('Helvetica').text(store.installation.submittedBy || 'N/A', 530, y, { width: 270 });

    // Separator line
    doc.save();
    doc.strokeColor('#EAB308').lineWidth(2).moveTo(30, 85).lineTo(770, 85).stroke();
    doc.restore();

    // MAIN CONTENT AREA (70-75% of page)
    const contentStartY = 100;
    const contentHeight = doc.page.height - contentStartY - 30;
    
    // Before & After Grid Layout
    if (store.recce?.reccePhotos && store.recce.reccePhotos.length > 0 && store.installation.photos) {
      const photosPerRow = 2; // Before/After pairs
      const rowsPerPage = 2;
      const imgWidth = 350;
      const imgHeight = 200;
      const spacing = 20;
      
      let currentY = contentStartY;
      let photoIndex = 0;
      
      for (let row = 0; row < rowsPerPage && photoIndex < store.recce.reccePhotos.length; row++) {
        const reccePhoto = store.recce.reccePhotos[photoIndex];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === photoIndex);
        
        // BEFORE (Left)
        const beforeX = 30;
        const beforeY = currentY;
        
        doc.save();
        doc.rect(beforeX, beforeY, imgWidth, imgHeight + 20).strokeColor('#EF4444').lineWidth(2).stroke();
        doc.restore();
        
        const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
        if (fs.existsSync(reccePhotoPath)) {
          doc.image(reccePhotoPath, beforeX + 5, beforeY + 5, { 
            width: imgWidth - 10, 
            height: imgHeight - 10, 
            fit: [imgWidth - 10, imgHeight - 10] 
          });
        }
        
        doc.save();
        doc.rect(beforeX, beforeY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
          .text(`BEFORE - Photo ${photoIndex + 1}`, beforeX, beforeY + imgHeight + 6, { width: imgWidth, align: 'center' });
        
        // AFTER (Right)
        const afterX = beforeX + imgWidth + spacing;
        
        doc.save();
        doc.rect(afterX, beforeY, imgWidth, imgHeight + 20).strokeColor('#22C55E').lineWidth(2).stroke();
        doc.restore();
        
        if (installPhoto) {
          const installPhotoPath = path.join(process.cwd(), installPhoto.installationPhoto);
          if (fs.existsSync(installPhotoPath)) {
            doc.image(installPhotoPath, afterX + 5, beforeY + 5, { 
              width: imgWidth - 10, 
              height: imgHeight - 10, 
              fit: [imgWidth - 10, imgHeight - 10] 
            });
          }
        }
        
        doc.save();
        doc.rect(afterX, beforeY + imgHeight, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
          .text(`AFTER - Photo ${photoIndex + 1}`, afterX, beforeY + imgHeight + 6, { width: imgWidth, align: 'center' });
        
        // Measurements info (compact)
        const measureY = beforeY + imgHeight + 25;
        doc.fillColor('#1F2937').fontSize(8).font('Helvetica')
          .text(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 
                30, measureY, { width: 720, align: 'center' });
        
        if (reccePhoto.elements && reccePhoto.elements.length > 0) {
          const elementsText = reccePhoto.elements.map((el: any) => `${el.elementName} (${el.quantity})`).join(' | ');
          doc.fillColor('#EAB308').fontSize(8).font('Helvetica-Bold')
            .text(elementsText, 30, measureY + 12, { width: 720, align: 'center' });
        }
        
        currentY += imgHeight + 50;
        photoIndex++;
        
        // Add new page if needed
        if (row === rowsPerPage - 1 && photoIndex < store.recce.reccePhotos.length) {
          doc.addPage();
          currentY = 30;
        }
      }
    }

    // Footer
    doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
      .text(`Generated on ${new Date().toLocaleDateString()} | ELORA CREATIVE ART`, 
            30, doc.page.height - 25, { width: 740, align: 'center' });

    doc.end();
  } catch (error: any) {
    console.error("Compact PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating compact PDF" });
  }
};

export const generateCompactInstallationPPT = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store || !store.installation) {
      return res.status(404).json({ message: "Store or Installation data not found" });
    }

    // Using officegen for PowerPoint generation
    const officegen = require('officegen');
    const pptx = officegen('pptx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="INSTALL_${store.storeName}_${store.storeId}.pptx"`);

    // Slide 1: Title Slide (Compact)
    const slide1 = pptx.makeNewSlide();
    slide1.name = 'Installation Report';
    
    // Compact header (top 25%)
    slide1.addText('INSTALLATION COMPLETION REPORT', {
      x: 0.5, y: 0.5, cx: 9, cy: 0.8,
      font_size: 24, bold: true, color: '22C55E'
    });
    
    slide1.addText(`${store.storeName} (${store.storeId})`, {
      x: 0.5, y: 1.3, cx: 9, cy: 0.5,
      font_size: 16, color: '1F2937'
    });
    
    slide1.addText(`${store.location?.city} | ${store.installation.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A'}`, {
      x: 0.5, y: 1.8, cx: 9, cy: 0.4,
      font_size: 12, color: '6B7280'
    });

    // Before/After slides (75% image space)
    if (store.recce?.reccePhotos && store.installation.photos) {
      for (let i = 0; i < Math.min(5, store.recce.reccePhotos.length); i++) {
        const reccePhoto = store.recce.reccePhotos[i];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === i);
        
        const slide = pptx.makeNewSlide();
        slide.name = `Before After ${i + 1}`;
        
        // Compact title (top 20%)
        slide.addText(`BEFORE & AFTER - Photo ${i + 1}`, {
          x: 0.5, y: 0.2, cx: 9, cy: 0.6,
          font_size: 18, bold: true, color: '1F2937'
        });
        
        // Images (80% of slide)
        const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
        const installPhotoPath = installPhoto ? path.join(process.cwd(), installPhoto.installationPhoto) : null;
        
        if (fs.existsSync(reccePhotoPath)) {
          slide.addImage(reccePhotoPath, { x: 0.5, y: 1, cx: 4, cy: 4.5 });
          slide.addText('BEFORE', { x: 0.5, y: 5.7, cx: 4, cy: 0.3, font_size: 12, bold: true, color: 'EF4444' });
        }
        
        if (installPhotoPath && fs.existsSync(installPhotoPath)) {
          slide.addImage(installPhotoPath, { x: 5.5, y: 1, cx: 4, cy: 4.5 });
          slide.addText('AFTER', { x: 5.5, y: 5.7, cx: 4, cy: 0.3, font_size: 12, bold: true, color: '22C55E' });
        }
        
        // Measurements (bottom)
        slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
          x: 0.5, y: 6.2, cx: 9, cy: 0.3,
          font_size: 10, color: '6B7280'
        });
      }
    }

    pptx.generate(res);
  } catch (error: any) {
    console.error("PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PPT" });
  }
};