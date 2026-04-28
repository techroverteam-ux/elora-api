import { Request, Response } from "express";
import Store from "./store.model";
import path from "path";
import fs from "fs";
const axios = require('axios');

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

    const PptxGenJS = require('pptxgenjs');
    const prs = new PptxGenJS();
    
    // Set A4 dimensions for PPT (client requirement)
    prs.defineLayout({ name: 'A4', width: 11.69, height: 8.27 });
    prs.layout = 'A4';

    const CREAM_BG = 'F5F0E8';
    const GOLD = 'D4A017';
    const GREEN = '22C55E';
    const RED = 'EF4444';
    const DARK_GRAY = '1F2937';

    // Load logo as base64
    let logoBase64 = '';
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch (error: any) {
      }
    }

    // SLIDE 1 - COVER PAGE
    const coverSlide = prs.addSlide();
    coverSlide.background = { color: CREAM_BG };
    
    // Top-left: Bold gold text
    coverSlide.addText('WE DON\'T JUST PRINT.\nWE INSTALL YOUR BRAND\nINTO THE REAL WORLD.', {
      x: 0.8, y: 1.2, w: 4.8, h: 2,
      fontSize: 28, bold: true, color: GOLD, align: 'left'
    });

    // Center: Logo
    if (logoBase64) {
      coverSlide.addImage({
        data: logoBase64,
        x: 3.5, y: 3.0, w: 2.5, h: 1.5
      });
    }

    // Bottom-right: Small gray text
    coverSlide.addText('We help businesses stand out with custom branding,\nhigh-quality banner printing, and professional on-site installation.', {
      x: 2.4, y: 5.5, w: 4, h: 1.2,
      fontSize: 10, color: DARK_GRAY, align: 'right'
    });

    // Process each store
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      if (type === "recce" && !store.recce) {
        continue;
      }
      if (type === "installation" && !store.installation) {
        continue;
      }

      // Process each measurement board (recce photo) for this store
      const reccePhotos = store.recce?.reccePhotos || [];
      const boardCount = Math.max(1, reccePhotos.length); // At least 1 slide per store
      
      for (let boardIndex = 0; boardIndex < boardCount; boardIndex++) {
        const currentReccePhoto = reccePhotos[boardIndex];
        
        // SLIDE 2+ - INSTALLATION/RECCE REPORT SLIDE
        const reportSlide = prs.addSlide();
        reportSlide.background = { color: CREAM_BG };

      // ===== TOP INFO SECTION (y: 0 to y: 1.85) =====

      // Left zone: ECA logo + title + website
      if (logoBase64) {
        reportSlide.addImage({
          data: logoBase64,
          x: 0.1, y: 0.03, w: 1.2, h: 0.65
        });
      }

      // Title with board number if multiple boards
      let titleText = type === "recce" ? 'Recce Inspection Report' : 'Installation Completion Report';
      if (reccePhotos.length > 1) {
        titleText += ` - Board ${boardIndex + 1}/${reccePhotos.length}`;
      }
      const titleColor = type === "recce" ? GOLD : GREEN;
      reportSlide.addText(titleText, {
        x: 2.4, y: 0.1, w: 5.5, h: 0.45,
        fontSize: 20, bold: true, color: titleColor, align: 'left'
      });

      // Company info - top right
      reportSlide.addText('ELORA CREATIVE ART', {
        x: 9.5, y: 0.1, w: 3.7, h: 0.25,
        fontSize: 9, bold: true, color: GOLD, align: 'right'
      });
      reportSlide.addText('www.eloracreativeart.in', {
        x: 9.5, y: 0.35, w: 3.7, h: 0.2,
        fontSize: 8, color: GOLD, align: 'right'
      });

      // ===== STORE INFO BOX (LEFT SIDE - 20%) =====
      const infoBoxX = 0.1;
      const infoBoxY = 0.75;
      const infoBoxW = 2.3;
      const infoBoxH = 1.0;

      // Draw border
      reportSlide.addShape(prs.ShapeType.rect, {
        x: infoBoxX, y: infoBoxY, w: infoBoxW, h: infoBoxH,
        fill: { color: 'FFFFFF' },
        line: { color: GOLD, width: 1.5 }
      });

      // Store info content
      const labelX = infoBoxX + 0.15;
      const valueX = labelX + 1.2;
      const rightColX = infoBoxX + 3.2;
      const rightValueX = rightColX + 1;
      let infoY = infoBoxY + 0.08;

      // Row 1: Store name | ✓ COMPLETED
      reportSlide.addText('Store:', {
        x: labelX, y: infoY, w: 1, h: 0.18,
        fontSize: 11, bold: true, color: '000000'
      });
      reportSlide.addText(store.storeName || 'N/A', {
        x: valueX, y: infoY, w: 2, h: 0.18,
        fontSize: 11, color: '000000'
      });

      if (type === "installation") {
        reportSlide.addText('✓ COMPLETED', {
          x: rightColX, y: infoY, w: 2, h: 0.18,
          fontSize: 11, bold: true, color: GOLD
        });
      }

      // Row 2: ID | City
      infoY += 0.23;
      reportSlide.addText('ID:', {
        x: labelX, y: infoY, w: 1, h: 0.18,
        fontSize: 11, bold: true, color: '000000'
      });
      reportSlide.addText(store.storeId || store.storeCode || 'N/A', {
        x: valueX, y: infoY, w: 2, h: 0.18,
        fontSize: 11, color: '000000'
      });

      reportSlide.addText('City:', {
        x: rightColX, y: infoY, w: 0.8, h: 0.18,
        fontSize: 11, bold: true, color: '000000'
      });
      reportSlide.addText(store.location?.city || 'N/A', {
        x: rightValueX, y: infoY, w: 1.2, h: 0.18,
        fontSize: 11, color: '000000'
      });

      // Row 3: Date | By
      infoY += 0.23;
      const dateValue = type === "recce" 
        ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : 'N/A')
        : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : 'N/A');
      const submittedBy = type === "recce" ? store.recce?.submittedBy : store.installation?.submittedBy;

      reportSlide.addText('Date:', {
        x: labelX, y: infoY, w: 1, h: 0.18,
        fontSize: 11, bold: true, color: '000000'
      });
      reportSlide.addText(dateValue, {
        x: valueX, y: infoY, w: 2, h: 0.18,
        fontSize: 11, color: '000000'
      });



      // Row 4: Address (spanning both columns)
      infoY += 0.23;
      const address = store.location?.address || 'N/A';
      reportSlide.addText('Address:', {
        x: labelX, y: infoY, w: 1, h: 0.18,
        fontSize: 11, bold: true, color: '000000'
      });
      reportSlide.addText(address, {
        x: valueX, y: infoY, w: 4.5, h: 0.18,
        fontSize: 11, color: '000000'
      });

      // ===== 4 LAYOUT IMAGES SECTION (RIGHT SIDE - 80%) =====
      // Load layout images (initial photos + measurement photos)
      let layoutImagesBase64: string[] = [];
      
      // Load initial photos
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        for (let j = 0; j < Math.min(store.recce.initialPhotos.length, 2); j++) {
          try {
            const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[j].replace(/\s+/g, '%20')}`;
            const response = await axios.get(photoUrl, {
              responseType: 'arraybuffer',
              timeout: 8000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (response.status === 200) {
              const base64 = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
              layoutImagesBase64.push(base64);
            }
          } catch (error: any) {
          }
        }
      }
      
      // Load pre-recce measurement photo
      if (currentReccePhoto) {
        try {
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`;
          const response = await axios.get(reccePhotoUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (response.status === 200) {
            const base64 = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
            layoutImagesBase64.push(base64);
          }
        } catch (error: any) {
        }
      }
      
      // Load post-installation photo
      if (type === "installation" && store.installation?.photos) {
        const installPhotos = store.installation.photos.filter((p: any) => p.reccePhotoIndex === boardIndex);
        if (installPhotos.length > 0) {
          try {
            const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhotos[0].installationPhoto.replace(/\s+/g, '%20')}`;
            const response = await axios.get(installPhotoUrl, {
              responseType: 'arraybuffer',
              timeout: 10000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (response.status === 200) {
              const base64 = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
              layoutImagesBase64.push(base64);
            }
          } catch (error: any) {
          }
        }
      }

      // Display 4 layout images in 2x2 grid (80% of slide width)
      const layoutStartX = 2.5;
      const layoutWidth = 9.19; // 80% of slide width
      const imageSize = (layoutWidth - 0.2) / 2; // 2 images per row with spacing
      const imageSpacing = 0.1;
      
      reportSlide.addText('Layout Images:', {
        x: layoutStartX, y: 0.75, w: layoutWidth, h: 0.15,
        fontSize: 9, bold: true, color: GOLD
      });

      // Display up to 4 images in 2x2 grid
      for (let i = 0; i < Math.min(layoutImagesBase64.length, 4); i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = layoutStartX + col * (imageSize + imageSpacing);
        const y = 0.93 + row * (imageSize + imageSpacing);
        
        reportSlide.addShape(prs.ShapeType.rect, {
          x: x, y: y, w: imageSize, h: imageSize,
          fill: { color: 'FFFFFF' },
          line: { color: GOLD, width: 1 }
        });
        
        reportSlide.addImage({
          data: layoutImagesBase64[i],
          x: x + 0.02, y: y + 0.02, w: imageSize - 0.04, h: imageSize - 0.04
        });
      }

      // ===== GOLD SEPARATOR LINE (FULL WIDTH) =====
      reportSlide.addShape(prs.ShapeType.line, {
        x: 0, y: 1.85, w: 11.69, h: 0,
        line: { color: GOLD, width: 2 }
      });

      // ===== BEFORE/AFTER SECTION =====
      // Load before image for current board
      let beforeImageBase64 = '';
      if (currentReccePhoto) {
        try {
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`;
          const response = await axios.get(reccePhotoUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (response.status === 200) {
            beforeImageBase64 = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
          }
        } catch (error: any) {
        }
      }

      // Load after image for current board
      let afterImageBase64 = '';
      if (type === "installation" && store.installation?.photos) {
        const installPhotos = store.installation.photos.filter((p: any) => p.reccePhotoIndex === boardIndex);
        if (installPhotos.length > 0) {
          try {
            const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhotos[0].installationPhoto.replace(/\s+/g, '%20')}`;
            const response = await axios.get(installPhotoUrl, {
              responseType: 'arraybuffer',
              timeout: 10000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (response.status === 200) {
              afterImageBase64 = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
            }
          } catch (error: any) {
          }
        }
      }

      // BEFORE image: x: 0, y: 1.9, w: 5.845, h: 5.6
      if (beforeImageBase64) {
        reportSlide.addImage({
          data: beforeImageBase64,
          x: 0, y: 1.9, w: 5.845, h: 5.6
        });
      }

      // AFTER image: x: 5.845, y: 1.9, w: 5.845, h: 5.6
      if (afterImageBase64) {
        reportSlide.addImage({
          data: afterImageBase64,
          x: 5.845, y: 1.9, w: 5.845, h: 5.6
        });
      }

      // BEFORE label bar: x: 0, y: 7.0, w: 5.845, h: 0.4
      reportSlide.addShape(prs.ShapeType.rect, {
        x: 0, y: 7.0, w: 5.845, h: 0.4,
        fill: { color: RED }
      });
      reportSlide.addText('BEFORE', {
        x: 0, y: 7.0, w: 5.845, h: 0.4,
        fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
      });

      // AFTER label bar: x: 5.845, y: 7.0, w: 5.845, h: 0.4
      reportSlide.addShape(prs.ShapeType.rect, {
        x: 5.845, y: 7.0, w: 5.845, h: 0.4,
        fill: { color: GREEN }
      });
      reportSlide.addText('AFTER', {
        x: 5.845, y: 7.0, w: 5.845, h: 0.4,
        fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
      });

      // Border rectangles around images
      reportSlide.addShape(prs.ShapeType.rect, {
        x: 0.0, y: 1.88, w: 5.845, h: 5.52,
        fill: { type: 'none' },
        line: { color: 'EF4444', width: 2.5 }
      });

      reportSlide.addShape(prs.ShapeType.rect, {
        x: 5.845, y: 1.88, w: 5.845, h: 5.52,
        fill: { type: 'none' },
        line: { color: '22C55E', width: 2.5 }
      });
      
      } // End of board loop
    } // End of store loop

    const buffer = await prs.write('nodebuffer');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="Report_${type}_${stores.length}_Stores_${new Date().toISOString().split('T')[0]}.pptx"`);
    res.send(buffer);

  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ message: "Error generating bulk PPT", error: error.message });
    }
  }
};
