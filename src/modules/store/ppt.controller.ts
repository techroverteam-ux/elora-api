import { Request, Response } from "express";
import Store from "./store.model";
import path from "path";
import fs from "fs";
const axios = require('axios');

// ====== HELPER: Load image from URL as base64 ======
const loadImageBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (response.status === 200) {
      return `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
    }
  } catch (e) { }
  return null;
};

// ====== HELPER: Add store details header to a slide (top 20%) ======
const addStoreDetailsHeader = (slide: any, prs: any, store: any, type: 'recce' | 'installation', boardInfo?: string) => {
  const CREAM_BG = 'F5F0E8';
  const GOLD = 'D4A017';
  const GREEN = '22C55E';
  const DARK_GRAY = '1F2937';

  slide.background = { color: CREAM_BG };

  // Logo
  let logoBase64 = '';
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (e) { }
  }

  if (logoBase64) {
    slide.addImage({ data: logoBase64, x: 0.1, y: 0.03, w: 1.2, h: 0.65 });
  }

  // Title
  let titleText = type === "recce" ? 'Recce Inspection Report' : 'Installation Completion Report';
  if (boardInfo) titleText += ` - ${boardInfo}`;
  const titleColor = type === "recce" ? GOLD : GREEN;
  slide.addText(titleText, {
    x: 2.4, y: 0.1, w: 5.5, h: 0.45,
    fontSize: 20, bold: true, color: titleColor, align: 'left'
  });

  // Company info - top right
  slide.addText('ELORA CREATIVE ART', {
    x: 9.5, y: 0.1, w: 3.7, h: 0.25,
    fontSize: 9, bold: true, color: GOLD, align: 'right'
  });
  slide.addText('www.eloracreativeart.in', {
    x: 9.5, y: 0.35, w: 3.7, h: 0.2,
    fontSize: 8, color: GOLD, align: 'right'
  });

  // Gold separator line
  slide.addShape(prs.ShapeType.line, {
    x: 0, y: 0.72, w: 11.69, h: 0,
    line: { color: GOLD, width: 2 }
  });

  // Store info box (left side, compact)
  const infoBoxX = 0.1;
  const infoBoxY = 0.78;
  const infoBoxW = 5.0;
  const infoBoxH = 0.95;

  slide.addShape(prs.ShapeType.rect, {
    x: infoBoxX, y: infoBoxY, w: infoBoxW, h: infoBoxH,
    fill: { color: 'FFFFFF' },
    line: { color: GOLD, width: 1.5 }
  });

  const dateValue = type === "recce"
    ? (store.recce?.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : 'N/A')
    : (store.installation?.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : 'N/A');

  const labelX = infoBoxX + 0.15;
  const valueX = labelX + 1.2;
  const rightColX = infoBoxX + 2.8;
  const rightValueX = rightColX + 0.9;
  let infoY = infoBoxY + 0.08;

  // Row 1: Store name | Status
  slide.addText('Store:', { x: labelX, y: infoY, w: 1, h: 0.18, fontSize: 11, bold: true, color: '000000' });
  slide.addText(store.storeName || 'N/A', { x: valueX, y: infoY, w: 1.8, h: 0.18, fontSize: 11, color: '000000' });

  if (type === "installation") {
    slide.addText('✓ COMPLETED', { x: rightColX, y: infoY, w: 1.8, h: 0.18, fontSize: 11, bold: true, color: GOLD });
  }

  // Row 2: ID | City
  infoY += 0.23;
  slide.addText('ID:', { x: labelX, y: infoY, w: 1, h: 0.18, fontSize: 11, bold: true, color: '000000' });
  slide.addText(store.storeId || store.storeCode || 'N/A', { x: valueX, y: infoY, w: 1.8, h: 0.18, fontSize: 11, color: '000000' });
  slide.addText('City:', { x: rightColX, y: infoY, w: 0.8, h: 0.18, fontSize: 11, bold: true, color: '000000' });
  slide.addText(store.location?.city || 'N/A', { x: rightValueX, y: infoY, w: 1.2, h: 0.18, fontSize: 11, color: '000000' });

  // Row 3: Date
  infoY += 0.23;
  slide.addText('Date:', { x: labelX, y: infoY, w: 1, h: 0.18, fontSize: 11, bold: true, color: '000000' });
  slide.addText(dateValue, { x: valueX, y: infoY, w: 1.8, h: 0.18, fontSize: 11, color: '000000' });

  // Row 4: Address
  infoY += 0.23;
  slide.addText('Address:', { x: labelX, y: infoY, w: 1, h: 0.18, fontSize: 11, bold: true, color: '000000' });
  slide.addText(store.location?.address || 'N/A', { x: valueX, y: infoY, w: 4.0, h: 0.18, fontSize: 11, color: '000000' });

  // Separator line after header section
  slide.addShape(prs.ShapeType.line, {
    x: 0, y: 1.78, w: 11.69, h: 0,
    line: { color: GOLD, width: 1.5 }
  });
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

    const PptxGenJS = require('pptxgenjs');
    const prs = new PptxGenJS();
    prs.defineLayout({ name: 'A4', width: 11.69, height: 8.27 });
    prs.layout = 'A4';

    const CREAM_BG = 'F5F0E8';
    const GOLD = 'D4A017';
    const GREEN = '22C55E';
    const RED = 'EF4444';

    // Load logo
    let logoBase64 = '';
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      } catch (e) { }
    }

    // ===== SLIDE 1: COVER PAGE =====
    const coverSlide = prs.addSlide();
    coverSlide.background = { color: CREAM_BG };
    coverSlide.addText('WE DON\'T JUST PRINT.\nWE INSTALL YOUR BRAND\nINTO THE REAL WORLD.', {
      x: 0.8, y: 1.2, w: 4.8, h: 2,
      fontSize: 28, bold: true, color: GOLD, align: 'left'
    });
    if (logoBase64) {
      coverSlide.addImage({ data: logoBase64, x: 3.5, y: 3.0, w: 2.5, h: 1.5 });
    }
    coverSlide.addText('We help businesses stand out with custom branding,\nhigh-quality banner printing, and professional on-site installation.', {
      x: 2.4, y: 5.5, w: 4, h: 1.2,
      fontSize: 10, color: '1F2937', align: 'right'
    });

    // Process each store
    for (const store of stores) {
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const reccePhotos = store.recce?.reccePhotos || [];
      const boardCount = Math.max(1, reccePhotos.length);

      // ===== PER STORE: Initial Photos Slide =====
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        const initialSlide = prs.addSlide();
        addStoreDetailsHeader(initialSlide, prs, store, type);

        // 4 Initial Photos in 2x2 grid (bottom 80%)
        const gridStartY = 1.9;
        const imgSize = 2.6;
        const spacing = 0.2;

        for (let i = 0; i < Math.min(store.recce.initialPhotos.length, 4); i++) {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const x = 0.3 + col * (imgSize + spacing);
          const y = gridStartY + row * (imgSize + spacing);

          initialSlide.addShape(prs.ShapeType.rect, {
            x: x, y: y, w: imgSize, h: imgSize,
            fill: { color: 'FFFFFF' },
            line: { color: GOLD, width: 1.5 }
          });

          try {
            const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[i].replace(/\s+/g, '%20')}`;
            const base64 = await loadImageBase64(photoUrl);
            if (base64) {
              initialSlide.addImage({ data: base64, x: x + 0.03, y: y + 0.03, w: imgSize - 0.06, h: imgSize - 0.06 });
            }
          } catch (e) { }
        }
      }

      // ===== PER BOARD: Before/After Slide =====
      for (let boardIndex = 0; boardIndex < boardCount; boardIndex++) {
        const currentReccePhoto = reccePhotos[boardIndex];
        const boardSlide = prs.addSlide();
        addStoreDetailsHeader(boardSlide, prs, store, type, reccePhotos.length > 1 ? `Board ${boardIndex + 1}/${reccePhotos.length}` : undefined);

        const contentStartY = 1.9;

        if (type === "installation" && currentReccePhoto && store.installation?.photos) {
          const installPhotos = store.installation.photos.filter((p: any) => p.reccePhotoIndex === boardIndex);

          if (installPhotos.length >= 2) {
            // Three images: Before + After1 + After2
            const imgWidth = 3.6;
            const imgHeight = 4.8;

            // BEFORE
            try {
              const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`;
              const base64 = await loadImageBase64(reccePhotoUrl);
              if (base64) {
                boardSlide.addImage({ data: base64, x: 0.2, y: contentStartY, w: imgWidth, h: imgHeight });
              }
            } catch (e) { }

            // AFTER 1
            try {
              const installPhoto1Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[0].installationPhoto.replace(/\s+/g, '%20')}`;
              const base64 = await loadImageBase64(installPhoto1Url);
              if (base64) {
                boardSlide.addImage({ data: base64, x: 4.0, y: contentStartY, w: imgWidth, h: imgHeight });
              }
            } catch (e) { }

            // AFTER 2
            try {
              const installPhoto2Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[1].installationPhoto.replace(/\s+/g, '%20')}`;
              const base64 = await loadImageBase64(installPhoto2Url);
              if (base64) {
                boardSlide.addImage({ data: base64, x: 7.8, y: contentStartY, w: imgWidth, h: imgHeight });
              }
            } catch (e) { }

            // Labels
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.2, y: contentStartY + imgHeight, w: imgWidth, h: 0.35,
              fill: { color: RED }
            });
            boardSlide.addText('BEFORE', {
              x: 0.2, y: contentStartY + imgHeight, w: imgWidth, h: 0.35,
              fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
            });

            boardSlide.addShape(prs.ShapeType.rect, {
              x: 4.0, y: contentStartY + imgHeight, w: imgWidth, h: 0.35,
              fill: { color: GREEN }
            });
            boardSlide.addText('AFTER 1', {
              x: 4.0, y: contentStartY + imgHeight, w: imgWidth, h: 0.35,
              fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
            });

            boardSlide.addShape(prs.ShapeType.rect, {
              x: 7.8, y: contentStartY + imgHeight, w: imgWidth, h: 0.35,
              fill: { color: GREEN }
            });
            boardSlide.addText('AFTER 2', {
              x: 7.8, y: contentStartY + imgHeight, w: imgWidth, h: 0.35,
              fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
            });

          } else {
            // Two images: Before + After
            const imgWidth = 5.5;
            const imgHeight = 4.8;
            const installPhoto = installPhotos[0];

            // BEFORE
            try {
              const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`;
              const base64 = await loadImageBase64(reccePhotoUrl);
              if (base64) {
                boardSlide.addImage({ data: base64, x: 0.2, y: contentStartY, w: imgWidth, h: imgHeight });
              }
            } catch (e) { }

            // AFTER
            if (installPhoto) {
              try {
                const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, '%20')}`;
                const base64 = await loadImageBase64(installPhotoUrl);
                if (base64) {
                  boardSlide.addImage({ data: base64, x: 6.0, y: contentStartY, w: imgWidth, h: imgHeight });
                }
              } catch (e) { }
            }

            // Labels
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.2, y: contentStartY + imgHeight, w: imgWidth, h: 0.4,
              fill: { color: RED }
            });
            boardSlide.addText('BEFORE', {
              x: 0.2, y: contentStartY + imgHeight, w: imgWidth, h: 0.4,
              fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
            });

            boardSlide.addShape(prs.ShapeType.rect, {
              x: 6.0, y: contentStartY + imgHeight, w: imgWidth, h: 0.4,
              fill: { color: GREEN }
            });
            boardSlide.addText('AFTER', {
              x: 6.0, y: contentStartY + imgHeight, w: imgWidth, h: 0.4,
              fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
            });
          }

        } else if (type === "recce" && currentReccePhoto) {
          // Single recce photo
          try {
            const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, '%20')}`;
            const base64 = await loadImageBase64(reccePhotoUrl);
            if (base64) {
              boardSlide.addImage({ data: base64, x: 0.3, y: contentStartY, w: 11.09, h: 4.8 });
            }
          } catch (e) { }
        }
      }
    }

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
