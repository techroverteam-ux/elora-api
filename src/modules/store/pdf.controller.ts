import { Request, Response } from "express";
import Store from "./store.model";
import fs from "fs";
import path from "path";
const axios = require('axios');

// ====== HELPER: Draw store details header (top 20%) on every content slide ======
const drawStoreDetailsHeader = (doc: any, store: any, type: 'recce' | 'installation', boardInfo?: string) => {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const headerColor = type === "recce" ? '#EAB308' : '#22C55E';

  // Background
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fillOpacity(1).fill('#FFFEF5');
  doc.restore();

  // Logo
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 15, { width: 80, height: 24 });
  }

  // Title
  let title = type === "recce" ? 'RECCE INSPECTION REPORT' : 'INSTALLATION COMPLETION REPORT';
  if (boardInfo) title += ` - ${boardInfo}`;
  doc.fillColor(headerColor).fontSize(18).font('Helvetica-Bold')
    .text(title, 160, 18, { width: 500, align: 'center' });

  // Company info (top right)
  doc.fillColor('#EAB308').fontSize(9).font('Helvetica')
    .text('ELORA CREATIVE ART', 650, 12, { width: 150, align: 'right' })
    .text('www.eloracreativeart.in', 650, 24, { width: 150, align: 'right' });

  // Separator line - use consistent yellow branding color
  doc.save();
  doc.strokeColor('#EAB308').lineWidth(2).moveTo(30, 50).lineTo(770, 50).stroke();
  doc.restore();

  // Store details box (full width, compact, top 20% area)
  const boxY = 58;
  const boxH = 72;
  doc.save();
  doc.rect(30, boxY, 740, boxH).strokeColor('#EAB308').lineWidth(1).stroke();
  doc.restore();

  const dateValue = type === "recce"
    ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : 'N/A')
    : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : 'N/A');

  let y = boxY + 8;
  doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
  doc.text('Dealer Code:', 40, y, { width: 80 });
  doc.font('Helvetica').text(store.dealerCode || 'N/A', 120, y, { width: 180 });

  doc.font('Helvetica-Bold').text('Store Name:', 310, y, { width: 80 });
  doc.font('Helvetica').text(store.storeName || 'N/A', 390, y, { width: 200 });

  doc.font('Helvetica-Bold').text('Store ID:', 600, y, { width: 60 });
  doc.font('Helvetica').text(store.storeId || store.storeCode || 'N/A', 660, y, { width: 100 });

  y += 18;
  doc.font('Helvetica-Bold').text('City:', 40, y, { width: 80 });
  doc.font('Helvetica').text(store.location?.city || 'N/A', 120, y, { width: 180 });

  doc.font('Helvetica-Bold').text('State:', 310, y, { width: 80 });
  doc.font('Helvetica').text(store.location?.state || 'N/A', 390, y, { width: 200 });

  doc.font('Helvetica-Bold').text('Address:', 600, y, { width: 80 });
  doc.font('Helvetica').text(store.location?.address || 'N/A', 680, y, { width: 90 });

  if (type === 'installation') {
    y += 18;
    doc.fillColor('#22C55E').font('Helvetica-Bold').text('✓ COMPLETED', 600, y, { width: 150 });
  }

  // Bottom separator of header area - use consistent yellow branding color
  doc.save();
  doc.strokeColor('#EAB308').lineWidth(1).moveTo(30, boxY + boxH + 4).lineTo(770, boxY + boxH + 4).stroke();
  doc.restore();

  return boxY + boxH + 8; // returns content start Y
};

// ====== HELPER: Load image from URL ======
const loadImageFromUrl = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (response.status === 200) {
      return Buffer.from(response.data);
    }
  } catch (e) { }
  return null;
};

// ====== RECCE PDF ======
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

    // ===== SLIDE 1: COVER PAGE =====
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

    // ===== SLIDE 2: STORE DETAILS + 4 INITIAL PHOTOS =====
    if (store.recce.initialPhotos && store.recce.initialPhotos.length > 0) {
      doc.addPage();
      const contentStartY = drawStoreDetailsHeader(doc, store, 'recce');

      // Photo grid area: 80% of page - 2x2 grid using full width
      const photoY = contentStartY + 20; // Add some spacing
      const availableWidth = doc.page.width - 80; // Full width minus margins
      const availableHeight = doc.page.height - contentStartY - 60; // 80% bottom space
      const photoWidth = (availableWidth - 30) / 2; // 2 photos per row with spacing
      const photoHeight = (availableHeight - 30) / 2; // 2 rows with spacing
      const spacingX = 30;
      const spacingY = 30;
      const gridStartX = 40;

      for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 4); i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = gridStartX + col * (photoWidth + spacingX);
        const y = photoY + row * (photoHeight + spacingY);

        doc.save();
        doc.rect(x, y, photoWidth, photoHeight).strokeColor('#EAB308').lineWidth(2).stroke();
        doc.restore();

        // Load image from URL instead of local path
        try {
          const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[i].replace(/\s+/g, '%20')}`;
          const buffer = await loadImageFromUrl(photoUrl);
          if (buffer) {
            doc.image(buffer, x + 5, y + 5, { width: photoWidth - 10, height: photoHeight - 10, fit: [photoWidth - 10, photoHeight - 10] });
          }
        } catch (e) {
          console.log(`Failed to load initial photo ${i + 1}`);
        }
      }
    }

    // ===== SLIDE 3+: STORE DETAILS + RECCE PHOTO (per board) =====
    if (store.recce.reccePhotos && store.recce.reccePhotos.length > 0) {
      for (let i = 0; i < store.recce.reccePhotos.length; i++) {
        const reccePhoto = store.recce.reccePhotos[i];
        doc.addPage();
        const contentStartY = drawStoreDetailsHeader(doc, store, 'recce', `Board ${i + 1}/${store.recce.reccePhotos.length}`);

        const imgY = contentStartY;
        const imgWidth = 720;
        const imgHeight = 380;

        doc.save();
        doc.rect(40, imgY, imgWidth, imgHeight).strokeColor('#EAB308').lineWidth(2).stroke();
        doc.restore();

        // Load image from URL instead of local path
        try {
          const photoUrl = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo.replace(/\s+/g, '%20')}`;
          const buffer = await loadImageFromUrl(photoUrl);
          if (buffer) {
            doc.image(buffer, 45, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          }
        } catch (e) {
          console.log('Failed to load recce photo');
        }

        // Measurements
        const measureY = imgY + imgHeight + 8;
        doc.save();
        doc.rect(40, measureY, imgWidth, 25).fillOpacity(1).fillAndStroke('#FFFFFF', '#EAB308');
        doc.restore();
        doc.fillColor('#1F2937').fontSize(11).font('Helvetica-Bold')
          .text(`Measurements: ${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 40, measureY + 7, { width: imgWidth, align: 'center' });

        // Elements
        if (reccePhoto.elements && reccePhoto.elements.length > 0) {
          const elementsText = reccePhoto.elements.map((el: any) => `${el.elementName} (Qty: ${el.quantity})`).join(' | ');
          const elemY = measureY + 28;
          doc.save();
          doc.rect(40, elemY, imgWidth, 22).fillOpacity(1).fillAndStroke('#FEF3C7', '#EAB308');
          doc.restore();
          doc.fillColor('#1F2937').fontSize(9).font('Helvetica-Bold')
            .text(`Elements: ${elementsText}`, 40, elemY + 6, { width: imgWidth, align: 'center' });
        }
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("PDF Gen Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PDF" });
  }
};

// ====== INSTALLATION PDF ======
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

    // ===== SLIDE 1: COVER PAGE =====
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

    // ===== SLIDE 2: STORE DETAILS + 4 INITIAL PHOTOS =====
    if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
      doc.addPage();
      const contentStartY = drawStoreDetailsHeader(doc, store, 'installation');

      const photoY = contentStartY;
      const availableWidth = doc.page.width - 80;
      const availableHeight = doc.page.height - contentStartY - 60;
      const photoWidth = (availableWidth - 30) / 2;
      const photoHeight = (availableHeight - 30) / 2;
      const spacingX = 30;
      const spacingY = 30;
      const gridStartX = 40;

      for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 4); i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = gridStartX + col * (photoWidth + spacingX);
        const y = photoY + row * (photoHeight + spacingY);

        doc.save();
        doc.rect(x, y, photoWidth, photoHeight).strokeColor('#EAB308').lineWidth(2).stroke();
        doc.restore();

        // Load image from URL instead of local path
        try {
          const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[i].replace(/\s+/g, '%20')}`;
          const buffer = await loadImageFromUrl(photoUrl);
          if (buffer) {
            doc.image(buffer, x + 5, y + 5, { width: photoWidth - 10, height: photoHeight - 10, fit: [photoWidth - 10, photoHeight - 10] });
          }
        } catch (e) {
          console.log(`Failed to load initial photo ${i + 1}`);
        }
      }
    }

    // ===== SLIDE 3+: STORE DETAILS + BEFORE/AFTER (per board) =====
    if (store.recce?.reccePhotos && store.recce.reccePhotos.length > 0 && store.installation.photos) {
      for (let i = 0; i < store.recce.reccePhotos.length; i++) {
        const reccePhoto = store.recce.reccePhotos[i];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === i);

        doc.addPage();
        const contentStartY = drawStoreDetailsHeader(doc, store, 'installation', `Board ${i + 1}/${store.recce.reccePhotos.length}`);

        const imgY = contentStartY;
        const imgWidth = 355;
        const imgHeight = 380;
        const spacing = 30;

        // BEFORE (Left)
        const reccePhotoPath = path.join(process.cwd(), reccePhoto.photo);
        doc.save();
        doc.rect(40, imgY, imgWidth, imgHeight).strokeColor('#EF4444').lineWidth(2).stroke();
        doc.restore();

        if (fs.existsSync(reccePhotoPath)) {
          doc.image(reccePhotoPath, 45, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
        }

        // AFTER (Right)
        if (installPhoto) {
          const installPhotoPath = path.join(process.cwd(), installPhoto.installationPhoto);
          doc.save();
          doc.rect(40 + imgWidth + spacing, imgY, imgWidth, imgHeight).strokeColor('#22C55E').lineWidth(2).stroke();
          doc.restore();

          if (fs.existsSync(installPhotoPath)) {
            doc.image(installPhotoPath, 45 + imgWidth + spacing, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
          }
        }

        // Labels
        const labelY = imgY + imgHeight + 5;
        doc.save();
        doc.rect(40, labelY, imgWidth, 25).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('BEFORE', 40, labelY + 7, { width: imgWidth, align: 'center' });

        doc.save();
        doc.rect(40 + imgWidth + spacing, labelY, imgWidth, 25).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
        doc.restore();
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
          .text('AFTER', 40 + imgWidth + spacing, labelY + 7, { width: imgWidth, align: 'center' });

        // Measurements
        const measureY = labelY + 32;
        doc.save();
        doc.rect(40, measureY, imgWidth * 2 + spacing, 22).fillOpacity(1).fillAndStroke('#FFFFFF', '#EAB308');
        doc.restore();
        doc.fillColor('#1F2937').fontSize(10).font('Helvetica-Bold')
          .text(`Measurements: ${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`, 40, measureY + 6, { width: imgWidth * 2 + spacing, align: 'center' });

        // Elements
        if (reccePhoto.elements && reccePhoto.elements.length > 0) {
          const elementsText = reccePhoto.elements.map((el: any) => `${el.elementName} (Qty: ${el.quantity})`).join(' | ');
          const elemY = measureY + 25;
          doc.save();
          doc.rect(40, elemY, imgWidth * 2 + spacing, 20).fillOpacity(1).fillAndStroke('#FEF3C7', '#EAB308');
          doc.restore();
          doc.fillColor('#1F2937').fontSize(9).font('Helvetica-Bold')
            .text(`Elements: ${elementsText}`, 40, elemY + 5, { width: imgWidth * 2 + spacing, align: 'center' });
        }
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("PDF Gen Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PDF" });
  }
};

// ====== BULK PDF ======
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
    res.setHeader('Content-Disposition', `attachment; filename="${type === "recce" ? "Recce" : "Installation"}_Report_${stores.length}_Stores_${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/')}.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // ===== COVER PAGE =====
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

    for (const store of stores) {
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const reccePhotos = store.recce?.reccePhotos || [];
      const boardCount = Math.max(1, reccePhotos.length);

      // ===== PER STORE: Initial Photos Slide =====
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        doc.addPage();
        const contentStartY = drawStoreDetailsHeader(doc, store, type);

        const photoY = contentStartY;
        const availableWidth = doc.page.width - 80;
        const availableHeight = doc.page.height - contentStartY - 60;
        const photoWidth = (availableWidth - 30) / 2;
        const photoHeight = (availableHeight - 30) / 2;
        const spacingX = 30;
        const spacingY = 30;
        const gridStartX = 40;

        for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 4); i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = gridStartX + col * (photoWidth + spacingX);
          const y = photoY + row * (photoHeight + spacingY);

          doc.save();
          doc.rect(x, y, photoWidth, photoHeight).strokeColor('#EAB308').lineWidth(2).stroke();
          doc.restore();

          // Load image from URL instead of local path
          try {
            const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[i].replace(/\s+/g, '%20')}`;
            const buffer = await loadImageFromUrl(photoUrl);
            if (buffer) {
              doc.image(buffer, x + 5, y + 5, { width: photoWidth - 10, height: photoHeight - 10, fit: [photoWidth - 10, photoHeight - 10] });
            }
          } catch (e) {
            console.log(`Failed to load initial photo ${i + 1}`);
          }
        }
      }

      // ===== PER BOARD: Content Slide =====
      for (let boardIndex = 0; boardIndex < boardCount; boardIndex++) {
        const currentReccePhoto = reccePhotos[boardIndex];
        doc.addPage();
        const contentStartY = drawStoreDetailsHeader(doc, store, type, reccePhotos.length > 1 ? `Board ${boardIndex + 1}/${reccePhotos.length}` : undefined);

        if (type === "installation" && currentReccePhoto && store.installation?.photos) {
          const installPhotos = store.installation.photos.filter((p: any) => p.reccePhotoIndex === boardIndex);
          const imgY = contentStartY;
          const imgHeight = 380;

          if (installPhotos.length >= 2) {
            // Three images: Before + After1 + After2
            const imgWidth = (doc.page.width - 60) / 3;

            // BEFORE
            const beforeBuffer = await loadImageFromUrl(`https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`);
            if (beforeBuffer) {
              doc.save();
              doc.rect(30, imgY, imgWidth, imgHeight).strokeColor('#EF4444').lineWidth(3).stroke();
              doc.restore();
              doc.image(beforeBuffer, 35, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
            }

            // AFTER 1
            const after1Buffer = await loadImageFromUrl(`https://storage.enamorimpex.com/eloraftp/${installPhotos[0].installationPhoto.replace(/\s+/g, '%20')}`);
            if (after1Buffer) {
              doc.save();
              doc.rect(30 + imgWidth, imgY, imgWidth, imgHeight).strokeColor('#22C55E').lineWidth(3).stroke();
              doc.restore();
              doc.image(after1Buffer, 35 + imgWidth, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
            }

            // AFTER 2
            const after2Buffer = await loadImageFromUrl(`https://storage.enamorimpex.com/eloraftp/${installPhotos[1].installationPhoto.replace(/\s+/g, '%20')}`);
            if (after2Buffer) {
              doc.save();
              doc.rect(30 + imgWidth * 2, imgY, imgWidth, imgHeight).strokeColor('#22C55E').lineWidth(3).stroke();
              doc.restore();
              doc.image(after2Buffer, 35 + imgWidth * 2, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
            }

            // Labels
            const labelY = imgY + imgHeight + 5;
            doc.save();
            doc.rect(30, labelY, imgWidth, 20).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
            doc.restore();
            doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('BEFORE', 30, labelY + 5, { width: imgWidth, align: 'center' });

            doc.save();
            doc.rect(30 + imgWidth, labelY, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
            doc.restore();
            doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('AFTER 1', 30 + imgWidth, labelY + 5, { width: imgWidth, align: 'center' });

            doc.save();
            doc.rect(30 + imgWidth * 2, labelY, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
            doc.restore();
            doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('AFTER 2', 30 + imgWidth * 2, labelY + 5, { width: imgWidth, align: 'center' });

          } else {
            // Two images: Before + After
            const imgWidth = (doc.page.width - 50) / 2;
            const installPhoto = installPhotos[0];

            const beforeBuffer = await loadImageFromUrl(`https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`);
            if (beforeBuffer) {
              doc.save();
              doc.rect(30, imgY, imgWidth, imgHeight).strokeColor('#EF4444').lineWidth(3).stroke();
              doc.restore();
              doc.image(beforeBuffer, 35, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
            }

            if (installPhoto) {
              const afterBuffer = await loadImageFromUrl(`https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, '%20')}`);
              if (afterBuffer) {
                doc.save();
                doc.rect(30 + imgWidth, imgY, imgWidth, imgHeight).strokeColor('#22C55E').lineWidth(3).stroke();
                doc.restore();
                doc.image(afterBuffer, 35 + imgWidth, imgY + 5, { width: imgWidth - 10, height: imgHeight - 10, fit: [imgWidth - 10, imgHeight - 10] });
              }
            }

            // Labels
            const labelY = imgY + imgHeight + 5;
            doc.save();
            doc.rect(30, labelY, imgWidth, 20).fillOpacity(1).fillAndStroke('#EF4444', '#EF4444');
            doc.restore();
            doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('BEFORE', 30, labelY + 5, { width: imgWidth, align: 'center' });

            doc.save();
            doc.rect(30 + imgWidth, labelY, imgWidth, 20).fillOpacity(1).fillAndStroke('#22C55E', '#22C55E');
            doc.restore();
            doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('AFTER', 30 + imgWidth, labelY + 5, { width: imgWidth, align: 'center' });
          }

          // Measurements
          const measureY = imgY + imgHeight + 30;
          doc.save();
          doc.rect(30, measureY, doc.page.width - 60, 20).fillOpacity(1).fillAndStroke('#FFFFFF', '#EAB308');
          doc.restore();
          doc.fillColor('#1F2937').fontSize(10).font('Helvetica-Bold')
            .text(`Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`, 30, measureY + 5, { width: doc.page.width - 60, align: 'center' });

          // Elements
          if (currentReccePhoto.elements && currentReccePhoto.elements.length > 0) {
            const elementsText = currentReccePhoto.elements.map((el: any) => `${el.elementName} (Qty: ${el.quantity})`).join(' | ');
            const elemY = measureY + 23;
            doc.save();
            doc.rect(30, elemY, doc.page.width - 60, 18).fillOpacity(1).fillAndStroke('#FEF3C7', '#EAB308');
            doc.restore();
            doc.fillColor('#1F2937').fontSize(9).font('Helvetica-Bold')
              .text(`Elements: ${elementsText}`, 30, elemY + 4, { width: doc.page.width - 60, align: 'center' });
          }

        } else if (type === "recce" && currentReccePhoto) {
          // Single recce photo
          const imgY = contentStartY;
          const imgHeight = 400;

          const buffer = await loadImageFromUrl(`https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`);
          if (buffer) {
            doc.save();
            doc.rect(30, imgY, doc.page.width - 60, imgHeight).strokeColor('#EAB308').lineWidth(3).stroke();
            doc.restore();
            doc.image(buffer, 35, imgY + 5, { width: doc.page.width - 70, height: imgHeight - 10, fit: [doc.page.width - 70, imgHeight - 10] });
          }

          // Measurements
          const measureY = imgY + imgHeight + 8;
          doc.save();
          doc.rect(30, measureY, doc.page.width - 60, 22).fillOpacity(1).fillAndStroke('#FFFFFF', '#EAB308');
          doc.restore();
          doc.fillColor('#1F2937').fontSize(10).font('Helvetica-Bold')
            .text(`Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`, 30, measureY + 5, { width: doc.page.width - 60, align: 'center' });

          // Elements
          if (currentReccePhoto.elements && currentReccePhoto.elements.length > 0) {
            const elementsText = currentReccePhoto.elements.map((el: any) => `${el.elementName} (Qty: ${el.quantity})`).join(' | ');
            const elemY = measureY + 25;
            doc.save();
            doc.rect(30, elemY, doc.page.width - 60, 18).fillOpacity(1).fillAndStroke('#FEF3C7', '#EAB308');
            doc.restore();
            doc.fillColor('#1F2937').fontSize(9).font('Helvetica-Bold')
              .text(`Elements: ${elementsText}`, 30, elemY + 4, { width: doc.page.width - 60, align: 'center' });
          }
        }
      }
    }

    doc.end();
  } catch (error: any) {
    console.error("Bulk PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PDF" });
  }
};
