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
      const title = type === "recce" ? 'RECCE INSPECTION REPORT' : 'INSTALLATION COMPLETION REPORT';
      
      doc.fillColor(headerColor).fontSize(16).font('Helvetica-Bold')
        .text(title, 90, 12, { width: 500, align: 'center' });
      
      doc.fillColor('#EAB308').fontSize(8).font('Helvetica')
        .text('ELORA CREATIVE ART', 650, 10, { width: 120, align: 'right' })
        .text('www.eloracreativeart.in', 650, 22, { width: 120, align: 'right' });

      // Store Info with better spacing
      doc.fillColor('#000000').fontSize(9);
      let y = 40;
      
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // Row 1: Store | City | Status
      doc.font('Helvetica-Bold').text('Store:', 20, y);
      doc.font('Helvetica').text((store.storeName || 'N/A').substring(0, 30), 65, y);
      doc.font('Helvetica-Bold').text('City:', 320, y);
      doc.font('Helvetica').text(store.location?.city || 'N/A', 350, y);
      
      if (type === "installation") {
        doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 480, y);
      }
      
      y += 12;
      // Row 2: ID | Date | By
      doc.fillColor('#000000').font('Helvetica-Bold').text('ID:', 20, y);
      doc.font('Helvetica').text((store.storeId || store.storeCode || 'N/A').substring(0, 20), 45, y);
      doc.font('Helvetica-Bold').text('Date:', 200, y);
      doc.font('Helvetica').text(dateValue, 235, y);
      doc.font('Helvetica-Bold').text('By:', 350, y);
      doc.font('Helvetica').text((submittedBy || 'N/A').substring(0, 25), 375, y);
      
      y += 12;
      // Row 3: Address
      doc.font('Helvetica-Bold').text('Address:', 20, y);
      const address = store.location?.address || 'N/A';
      const truncatedAddress = address.length > 90 ? address.substring(0, 90) + '...' : address;
      doc.font('Helvetica').text(truncatedAddress, 75, y);

      // Separator
      doc.save();
      doc.strokeColor('#EAB308').lineWidth(2).moveTo(20, y + 18).lineTo(780, y + 18).stroke();
      doc.restore();

      // MAIN CONTENT (80% of page)
      const contentStartY = y + 25;
      const availableHeight = doc.page.height - contentStartY - 30;
      const availableWidth = doc.page.width - 40;
      
      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Before/After Layout - Full width usage
        const imgWidth = (availableWidth - 30) / 2;
        const imgHeight = availableHeight - 50;
        const spacing = 15;
        
        let currentY = contentStartY;
        let photoIndex = 0;
        const maxPhotos = Math.min(2, store.recce.reccePhotos.length);
        
        for (let row = 0; row < 2 && photoIndex < maxPhotos; row++) {
          const reccePhoto = store.recce.reccePhotos[photoIndex];
          const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === photoIndex);
          
          const rowY = contentStartY;
          
          // BEFORE (Left) - Full border usage
          const beforeX = 20;
          
          doc.save();
          doc.rect(beforeX, rowY, imgWidth, imgHeight + 20).strokeColor('#EF4444').lineWidth(3).stroke();
          doc.restore();
          
          // White padding inside border
          doc.save();
          doc.rect(beforeX + 5, rowY + 5, imgWidth - 10, imgHeight + 10).fillOpacity(1).fill('#FFFFFF');
          doc.restore();
          
          const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
          if (fs.existsSync(reccePhotoPath)) {
            doc.image(reccePhotoPath, beforeX + 15, rowY + 15, { 
              width: imgWidth - 30, 
              height: imgHeight - 20, 
              fit: [imgWidth - 30, imgHeight - 20] 
            });
          }
          
          doc.save();
          doc.rect(beforeX, rowY + imgHeight, imgWidth, 15).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
          doc.restore();
          doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
            .text(`BEFORE - Photo ${photoIndex + 1}`, beforeX, rowY + imgHeight + 4, { width: imgWidth, align: 'center' });
          
          // AFTER (Right) - Full border usage
          const afterX = beforeX + imgWidth + 20;
          
          doc.save();
          doc.rect(afterX, rowY, imgWidth, imgHeight + 20).strokeColor('#22C55E').lineWidth(3).stroke();
          doc.restore();
          
          // White padding inside border
          doc.save();
          doc.rect(afterX + 5, rowY + 5, imgWidth - 10, imgHeight + 10).fillOpacity(1).fill('#FFFFFF');
          doc.restore();
          
          if (installPhoto) {
            const installPhotoPath = path.join(process.cwd(), installPhoto.installationPhoto);
            if (fs.existsSync(installPhotoPath)) {
              doc.image(installPhotoPath, afterX + 15, rowY + 15, { 
                width: imgWidth - 30, 
                height: imgHeight - 20, 
                fit: [imgWidth - 30, imgHeight - 20] 
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
      x: 1, y: 2, cx: 8, cy: 1,
      font_size: 28, bold: true, color: color, align: 'center'
    });
    
    titleSlide.addText(`${stores.length} Stores Report`, {
      x: 1, y: 3.5, cx: 8, cy: 0.8,
      font_size: 18, color: '1F2937', align: 'center'
    });
    
    titleSlide.addText('ELORA CREATIVE ART | www.eloracreativeart.in', {
      x: 1, y: 5, cx: 8, cy: 0.5,
      font_size: 14, color: 'EAB308', align: 'center'
    });

    // Store slides
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const slide = pptx.makeNewSlide();
      slide.name = `${store.storeName}`;
      
      // Header with centered title
      slide.addText(title, {
        x: 1, y: 0.2, cx: 8, cy: 0.6,
        font_size: 18, bold: true, color: color, align: 'center'
      });
      
      // Company info
      slide.addText('ELORA CREATIVE ART | www.eloracreativeart.in', {
        x: 7, y: 0.1, cx: 2.5, cy: 0.4,
        font_size: 10, color: 'EAB308', align: 'right'
      });
      
      // Store details in organized layout
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // Store details row 1
      slide.addText(`Store: ${(store.storeName || 'N/A').substring(0, 30)}`, {
        x: 0.3, y: 1.2, cx: 3, cy: 0.3, font_size: 11, bold: true
      });
      slide.addText(`City: ${(store.location?.city || 'N/A').substring(0, 15)}`, {
        x: 3.5, y: 1.2, cx: 2, cy: 0.3, font_size: 11, bold: true
      });
      
      if (type === "installation") {
        slide.addText('✓ COMPLETED', {
          x: 6, y: 1.2, cx: 2, cy: 0.3, font_size: 11, bold: true, color: '22C55E'
        });
      }
      
      // Store details row 2
      slide.addText(`ID: ${(store.storeId || store.storeCode || 'N/A').substring(0, 20)}`, {
        x: 0.3, y: 1.5, cx: 2.5, cy: 0.3, font_size: 11
      });
      slide.addText(`Date: ${dateValue}`, {
        x: 3, y: 1.5, cx: 2, cy: 0.3, font_size: 11
      });
      slide.addText(`By: ${(submittedBy || 'N/A').substring(0, 20)}`, {
        x: 5.5, y: 1.5, cx: 2.5, cy: 0.3, font_size: 11
      });
      
      // Address
      const address = store.location?.address || 'N/A';
      const truncatedAddress = address.length > 80 ? address.substring(0, 80) + '...' : address;
      slide.addText(`Address: ${truncatedAddress}`, {
        x: 0.3, y: 1.8, cx: 8, cy: 0.3, font_size: 11
      });

      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Before/After comparison (85% of slide)
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);
        
        // BEFORE image with red border effect
        const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
        slide.addImage({
          path: reccePhotoUrl,
          x: 0.5, y: 2.5, cx: 4, cy: 3.5
        });
        
        // BEFORE label with red background
        slide.addText('BEFORE', {
          x: 0.5, y: 6, cx: 4, cy: 0.4,
          font_size: 14, bold: true, color: 'FFFFFF',
          fill: { color: 'EF4444' }, align: 'center'
        });
        
        if (installPhoto) {
          // AFTER image with green border effect
          const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, '%20')}`;
          slide.addImage({
            path: installPhotoUrl,
            x: 5, y: 2.5, cx: 4, cy: 3.5
          });
        }
        
        // AFTER label with green background
        slide.addText('AFTER', {
          x: 5, y: 6, cx: 4, cy: 0.4,
          font_size: 14, bold: true, color: 'FFFFFF',
          fill: { color: '22C55E' }, align: 'center'
        });
        
        // Measurements
        if (reccePhoto.measurements) {
          slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
            x: 2, y: 6.8, cx: 5, cy: 0.3,
            font_size: 12, align: 'center', color: '1F2937'
          });
        }
      } else if (type === "recce" && store.recce?.reccePhotos) {
        // Single recce photo
        const reccePhoto = store.recce.reccePhotos[0];
        const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
        
        slide.addImage({
          path: reccePhotoUrl,
          x: 1, y: 2.5, cx: 7.5, cy: 4
        });
        
        // Measurements
        if (reccePhoto.measurements) {
          slide.addText(`${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, {
            x: 2, y: 6.8, cx: 5, cy: 0.3,
            font_size: 12, align: 'center', color: '1F2937'
          });
        }
      }
    }

    pptx.generate(res);
  } catch (error: any) {
    console.error("Compact Bulk PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating compact bulk PPT" });
  }
};
erateCompactBulkPPT = async (req: Request, res: Response) => {
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
      x: 1, y: 2, cx: 8, cy: 1,
      font_size: 28, bold: true, color: color, align: 'center'
    });
    
    titleSlide.addText(`${stores.length} Stores Report`, {
      x: 1, y: 3.5, cx: 8, cy: 0.8,
      font_size: 18, color: '1F2937', align: 'center'
    });
    
    titleSlide.addText('ELORA CREATIVE ART | www.eloracreativeart.in', {
      x: 1, y: 5, cx: 8, cy: 0.5,
      font_size: 14, color: 'EAB308', align: 'center'
    });

    // Store slides
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const slide = pptx.makeNewSlide();
      slide.name = `${store.storeName}`;
      
      // Header with centered title - matching PDF exactly
      slide.addText(title, {
        x: 0.9, y: 0.15, cx: 8.2, cy: 0.6,
        font_size: 20, bold: true, color: color, align: 'center'
      });
      
      // Company info - top right like PDF
      slide.addText('ELORA CREATIVE ART', {
        x: 7.5, y: 0.1, cx: 2, cy: 0.25,
        font_size: 9, color: 'EAB308', align: 'right'
      });
      slide.addText('www.eloracreativeart.in', {
        x: 7.5, y: 0.3, cx: 2, cy: 0.25,
        font_size: 9, color: 'EAB308', align: 'right'
      });
      
      // Store details matching PDF layout exactly
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A');
      
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;
      
      // Row 1: Store | City | Status (matching PDF positions exactly)
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
      
      // Row 2: ID | Date | By (matching PDF positions exactly)
      slide.addText(`ID: ${(store.storeId || store.storeCode || 'N/A').substring(0, 20)}`, {
        x: 0.2, y: 1.3, cx: 2.5, cy: 0.3, font_size: 11
      });
      slide.addText(`Date: ${dateValue}`, {
        x: 2.8, y: 1.3, cx: 2, cy: 0.3, font_size: 11
      });
      slide.addText(`By: ${(submittedBy || 'N/A').substring(0, 25)}`, {
        x: 5.0, y: 1.3, cx: 3, cy: 0.3, font_size: 11
      });
      
      // Row 3: Address (matching PDF)
      const address = store.location?.address || 'N/A';
      const truncatedAddress = address.length > 90 ? address.substring(0, 90) + '...' : address;
      slide.addText(`Address: ${truncatedAddress}`, {
        x: 0.2, y: 1.6, cx: 8.5, cy: 0.3, font_size: 11
      });

      if (type === "installation" && store.recce?.reccePhotos && store.installation?.photos) {
        // Before/After layout with full width usage like PDF
        const reccePhoto = store.recce.reccePhotos[0];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === 0);
        
        try {
          // BEFORE image - full fit with proper spacing
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
            // AFTER image - full fit with proper spacing
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
        // Single recce photo - full width usage
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
    console.error("Compact Bulk PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating compact bulk PPT" });
  }
};