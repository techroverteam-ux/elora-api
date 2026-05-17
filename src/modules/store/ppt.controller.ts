import { Request, Response } from "express";
import Store from "./store.model";
import path from "path";
import fs from "fs";
const axios = require("axios");

// ====== HELPER: Load image from URL as base64 with proper sizing ======
const loadImageBase64 = async (
  url: string,
): Promise<{ data: string; width: number; height: number } | null> => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (response.status === 200) {
      const buffer = Buffer.from(response.data);
      const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

      // Try to get image dimensions (basic approach)
      // For now, we'll return default dimensions and let PPT handle aspect ratio
      return {
        data: base64,
        width: 1920, // Default width
        height: 1080, // Default height
      };
    }
  } catch (e) {
    console.error("Error loading image:", e);
  }
  return null;
};

// ====== HELPER: Add image with proper aspect ratio ======
const addImageWithAspectRatio = async (
  slide: any,
  imageUrl: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) => {
  try {
    const imageData = await loadImageBase64(imageUrl);
    if (imageData) {
      slide.addImage({
        data: imageData.data,
        x: x,
        y: y,
        w: maxWidth,
        h: maxHeight,
        sizing: { type: "contain" },
      });
      return true;
    }
  } catch (e) {
    console.error("Error adding image with aspect ratio:", e);
  }
  return false;
};

// ====== HELPER: Add store details header to a slide (top ~25%) ======
const addStoreDetailsHeader = (
  slide: any,
  prs: any,
  store: any,
  type: "recce" | "installation",
  boardInfo?: string,
) => {
  const CREAM_BG = "F5F0E8";
  const GOLD = "D4A017";
  const GREEN = "22C55E";

  slide.background = { color: CREAM_BG };

  // ── Logo ──────────────────────────────────────────────────────────────
  // Logo PNG is 970x239px → aspect ratio 4.0586:1
  // At h=0.55in: w = 0.55 * (970/239) = 2.232in — preserves correct proportions
  let logoBase64 = "";
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch (e) {}
  }
  if (logoBase64) {
    slide.addImage({ data: logoBase64, x: 0.15, y: 0.08, w: 2.232, h: 0.55 });
  }

  // ── Title — centered across full slide width ───────────────────────────
  let titleText =
    type === "recce"
      ? "Recce Inspection Report"
      : "Installation Completion Report";
  if (boardInfo) titleText += ` — ${boardInfo}`;
  const titleColor = type === "recce" ? GOLD : GREEN;
  slide.addText(titleText, {
    x: 2.845,
    y: 0.1,
    w: 6.0,
    h: 0.5,
    fontSize: 20,
    bold: true,
    color: titleColor,
    align: "center",
    valign: "middle",
  });

  // ── Company info — top right ───────────────────────────────────────────
  slide.addText("ELORA CREATIVE ART", {
    x: 9.2,
    y: 0.1,
    w: 2.39,
    h: 0.25,
    fontSize: 9,
    bold: true,
    color: GOLD,
    align: "right",
  });
  slide.addText("www.eloracreativeart.in", {
    x: 9.2,
    y: 0.35,
    w: 2.39,
    h: 0.2,
    fontSize: 8,
    color: GOLD,
    align: "right",
  });

  // ── Separator line 1 — below logo/title row ────────────────────────────
  slide.addShape(prs.ShapeType.line, {
    x: 0,
    y: 0.72,
    w: 11.69,
    h: 0,
    line: { color: GOLD, width: 2 },
  });

  // ── Store info box ─────────────────────────────────────────────────────
  const boxX = 0.15;
  const boxY = 0.8;
  const boxW = 11.39;
  const boxH = 1.05;

  slide.addShape(prs.ShapeType.rect, {
    x: boxX,
    y: boxY,
    w: boxW,
    h: boxH,
    fill: { color: CREAM_BG }, // cream fill — blends with background, no harsh white
    line: { color: GOLD, width: 1.5 },
  });

  // Date value
  const dateValue =
    type === "recce"
      ? store.recce?.submittedDate
        ? new Date(store.recce.submittedDate)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            .replace(/ /g, "/")
        : "N/A"
      : store.installation?.submittedDate
        ? new Date(store.installation.submittedDate)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            .replace(/ /g, "/")
        : "N/A";

  // Column x positions — 3 groups evenly distributed across 11.39in box
  // Group 1 (left):   label @ 0.30,  value @ 1.12
  // Group 2 (mid):    label @ 4.15,  value @ 4.97
  // Group 3 (right):  label @ 8.05,  value @ 8.70
  const lbl1X = boxX + 0.15;
  const val1X = lbl1X + 0.82;
  const lbl2X = boxX + 4.0;
  const val2X = lbl2X + 0.82;
  const lbl3X = boxX + 7.9;
  const val3X = lbl3X + 0.65;

  // Row y positions — 3 rows with even spacing inside box
  const rowH = 0.22;
  const row1Y = boxY + 0.1;
  const row2Y = row1Y + rowH + 0.03;
  const row3Y = row2Y + rowH + 0.03;

  const lblStyle = { fontSize: 10, bold: true, color: "1F2937" } as const;
  const valStyle = { fontSize: 10, bold: false, color: "1F2937" } as const;

  // Row 1: Store name (left)  |  ✓ COMPLETED (far right, gold)
  slide.addText("Store:", { x: lbl1X, y: row1Y, w: 0.8, h: rowH, ...lblStyle });
  slide.addText(store.storeName || "N/A", {
    x: val1X,
    y: row1Y,
    w: 2.8,
    h: rowH,
    ...valStyle,
  });
  if (type === "installation") {
    slide.addText("✓ COMPLETED", {
      x: val3X,
      y: row1Y,
      w: 2.5,
      h: rowH,
      fontSize: 10,
      bold: true,
      color: GOLD,
      align: "right",
    });
  }

  // Row 2: Dealer (left)  |  ID (mid)  |  City (right)
  slide.addText("Dealer:", {
    x: lbl1X,
    y: row2Y,
    w: 0.8,
    h: rowH,
    ...lblStyle,
  });
  slide.addText(store.dealerCode || "N/A", {
    x: val1X,
    y: row2Y,
    w: 2.8,
    h: rowH,
    ...valStyle,
  });
  slide.addText("ID:", { x: lbl2X, y: row2Y, w: 0.8, h: rowH, ...lblStyle });
  slide.addText(store.storeId || store.storeCode || "N/A", {
    x: val2X,
    y: row2Y,
    w: 2.8,
    h: rowH,
    ...valStyle,
  });
  slide.addText("City:", { x: lbl3X, y: row2Y, w: 0.62, h: rowH, ...lblStyle });
  slide.addText(store.location?.city || "N/A", {
    x: val3X,
    y: row2Y,
    w: 2.4,
    h: rowH,
    ...valStyle,
  });

  // Row 3: State (left)  |  Address (mid → spans to right edge)
  slide.addText("State:", { x: lbl1X, y: row3Y, w: 0.8, h: rowH, ...lblStyle });
  slide.addText(store.location?.state || "N/A", {
    x: val1X,
    y: row3Y,
    w: 2.8,
    h: rowH,
    ...valStyle,
  });
  slide.addText("Address:", {
    x: lbl2X,
    y: row3Y,
    w: 0.8,
    h: rowH,
    ...lblStyle,
  });
  slide.addText(store.location?.address || "N/A", {
    x: val2X,
    y: row3Y,
    w: 5.6,
    h: rowH,
    ...valStyle, // spans all the way to box right edge
  });

  // ── Separator line 2 — after the store box ─────────────────────────────
  slide.addShape(prs.ShapeType.line, {
    x: 0,
    y: 1.95,
    w: 11.69,
    h: 0,
    line: { color: GOLD, width: 1.5 },
  });
};

// ====== CONTROLLER: Generate Bulk PPT ======
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

    const PptxGenJS = require("pptxgenjs");
    const prs = new PptxGenJS();
    prs.defineLayout({ name: "A4", width: 11.69, height: 8.27 });
    prs.layout = "A4";

    const CREAM_BG = "F5F0E8";
    const GOLD = "D4A017";
    const GREEN = "22C55E";
    const RED = "EF4444";

    // ── Load logo once (shared across all slides) ──────────────────────
    let logoBase64 = "";
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      } catch (e) {}
    }

    // ── SLIDE 1: Cover page ────────────────────────────────────────────
    // Logo is 970x239px → ratio 4.0586:1
    // Cover logo: w=3.5 → h = 3.5 / 4.0586 = 0.862
    // All content is centered both horizontally and vertically as one block:
    //   text (h=1.8) + gap 0.35 + logo (h=0.862) + gap 0.40 + subtitle (h=0.55)
    //   total = 3.962, start_y = (8.27 - 3.962) / 2 = 2.154
    const coverSlide = prs.addSlide();
    coverSlide.background = { color: CREAM_BG };

    coverSlide.addText(
      "WE DON'T JUST PRINT.\nWE INSTALL YOUR BRAND\nINTO THE REAL WORLD.",
      {
        x: 2.845,
        y: 2.154,
        w: 6.0,
        h: 1.8,
        fontSize: 28,
        bold: true,
        color: GOLD,
        align: "center",
      },
    );

    if (logoBase64) {
      coverSlide.addImage({
        data: logoBase64,
        x: 4.095,
        y: 4.304,
        w: 3.5,
        h: 0.862, // correct ratio, centered
      });
    }

    coverSlide.addText(
      "We help businesses stand out with custom branding,\nhigh-quality banner printing, and professional on-site installation.",
      {
        x: 3.095,
        y: 5.566,
        w: 5.5,
        h: 0.55,
        fontSize: 10,
        color: "1F2937",
        align: "center",
      },
    );

    // ── Per-store slides ───────────────────────────────────────────────
    // contentStartY = 2.03 (sep2 at 1.95 + 0.08 gap) — updated to match new header height
    const contentStartY = 2.03;

    for (const store of stores) {
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const reccePhotos = store.recce?.reccePhotos || [];
      const boardCount = Math.max(1, reccePhotos.length);

      // ── Initial Photos slide (one per store, recce photos) ────────────
      if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
        const initialSlide = prs.addSlide();
        addStoreDetailsHeader(initialSlide, prs, store, type);

        const gridStartY = contentStartY;
        const availableWidth = 11.69 - 0.4;
        const availableHeight = 8.27 - gridStartY - 0.3;
        const imgSize = Math.min(
          (availableWidth - 0.2) / 2,
          (availableHeight - 0.2) / 2,
        );
        const spacingX = (availableWidth - imgSize * 2) / 3;
        const spacingY = (availableHeight - imgSize * 2) / 3;
        const startX = 0.2 + spacingX;

        for (
          let i = 0;
          i < Math.min(store.recce.initialPhotos.length, 4);
          i++
        ) {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const x = startX + col * (imgSize + spacingX);
          const y = gridStartY + spacingY + row * (imgSize + spacingY);

          initialSlide.addShape(prs.ShapeType.rect, {
            x,
            y,
            w: imgSize,
            h: imgSize,
            fill: { color: "FFFFFF" },
            line: { color: GOLD, width: 2 },
          });

          const photoUrl = `https://storage.enamorimpex.com/eloraftp/${store.recce.initialPhotos[i].replace(/\s+/g, "%20")}`;
          await addImageWithAspectRatio(
            initialSlide,
            photoUrl,
            x + 0.05,
            y + 0.05,
            imgSize - 0.1,
            imgSize - 0.1,
          );
        }
      }

      // ── Per-board Before/After slide ───────────────────────────────────
      for (let boardIndex = 0; boardIndex < boardCount; boardIndex++) {
        const currentReccePhoto = reccePhotos[boardIndex];
        const boardSlide = prs.addSlide();
        addStoreDetailsHeader(
          boardSlide,
          prs,
          store,
          type,
          reccePhotos.length > 1
            ? `Board ${boardIndex + 1}/${reccePhotos.length}`
            : undefined,
        );

        if (
          type === "installation" &&
          currentReccePhoto &&
          store.installation?.photos
        ) {
          const installPhotos = store.installation.photos.filter(
            (p: any) => p.reccePhotoIndex === boardIndex,
          );

          if (installPhotos.length >= 2) {
            // Three images: Before + After 1 + After 2
            const imgWidth = 3.6;
            const imgHeight = 4.8;

            const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, "%20")}`;
            await addImageWithAspectRatio(
              boardSlide,
              reccePhotoUrl,
              0.2,
              contentStartY,
              imgWidth,
              imgHeight,
            );

            const installPhoto1Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[0].installationPhoto.replace(/\s+/g, "%20")}`;
            await addImageWithAspectRatio(
              boardSlide,
              installPhoto1Url,
              4.0,
              contentStartY,
              imgWidth,
              imgHeight,
            );

            const installPhoto2Url = `https://storage.enamorimpex.com/eloraftp/${installPhotos[1].installationPhoto.replace(/\s+/g, "%20")}`;
            await addImageWithAspectRatio(
              boardSlide,
              installPhoto2Url,
              7.8,
              contentStartY,
              imgWidth,
              imgHeight,
            );

            // BEFORE label
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.2,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.35,
              fill: { color: RED },
            });
            boardSlide.addText("BEFORE", {
              x: 0.2,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.35,
              fontSize: 12,
              bold: true,
              color: "FFFFFF",
              align: "center",
              valign: "middle",
            });

            // AFTER 1 label
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 4.0,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.35,
              fill: { color: GREEN },
            });
            boardSlide.addText("AFTER 1", {
              x: 4.0,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.35,
              fontSize: 12,
              bold: true,
              color: "FFFFFF",
              align: "center",
              valign: "middle",
            });

            // AFTER 2 label
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 7.8,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.35,
              fill: { color: GREEN },
            });
            boardSlide.addText("AFTER 2", {
              x: 7.8,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.35,
              fontSize: 12,
              bold: true,
              color: "FFFFFF",
              align: "center",
              valign: "middle",
            });

            // Measurements
            if (currentReccePhoto.measurements) {
              boardSlide.addShape(prs.ShapeType.rect, {
                x: 0.2,
                y: contentStartY + imgHeight + 0.38,
                w: 11.29,
                h: 0.25,
                fill: { color: "FFFFFF" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(
                `Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`,
                {
                  x: 0.2,
                  y: contentStartY + imgHeight + 0.38,
                  w: 11.29,
                  h: 0.25,
                  fontSize: 10,
                  bold: true,
                  color: "1F2937",
                  align: "center",
                  valign: "middle",
                },
              );
            }

            // Elements
            if (
              currentReccePhoto.elements &&
              currentReccePhoto.elements.length > 0
            ) {
              const elementsText = currentReccePhoto.elements
                .map((el: any) => `${el.elementName} (Qty: ${el.quantity})`)
                .join(" | ");
              boardSlide.addShape(prs.ShapeType.rect, {
                x: 0.2,
                y: contentStartY + imgHeight + 0.66,
                w: 11.29,
                h: 0.22,
                fill: { color: "FEF3C7" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(`Elements: ${elementsText}`, {
                x: 0.2,
                y: contentStartY + imgHeight + 0.66,
                w: 11.29,
                h: 0.22,
                fontSize: 9,
                bold: true,
                color: "1F2937",
                align: "center",
                valign: "middle",
              });
            }
          } else {
            // Two images: Before + After
            const imgWidth = 5.5;
            const imgHeight = 4.8;
            const installPhoto = installPhotos[0];

            const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, "%20")}`;
            await addImageWithAspectRatio(
              boardSlide,
              reccePhotoUrl,
              0.2,
              contentStartY,
              imgWidth,
              imgHeight,
            );

            if (installPhoto) {
              const installPhotoUrl = `https://storage.enamorimpex.com/eloraftp/${installPhoto.installationPhoto.replace(/\s+/g, "%20")}`;
              await addImageWithAspectRatio(
                boardSlide,
                installPhotoUrl,
                6.0,
                contentStartY,
                imgWidth,
                imgHeight,
              );
            }

            // BEFORE label
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.2,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.4,
              fill: { color: RED },
            });
            boardSlide.addText("BEFORE", {
              x: 0.2,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.4,
              fontSize: 14,
              bold: true,
              color: "FFFFFF",
              align: "center",
              valign: "middle",
            });

            // AFTER label
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 6.0,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.4,
              fill: { color: GREEN },
            });
            boardSlide.addText("AFTER", {
              x: 6.0,
              y: contentStartY + imgHeight,
              w: imgWidth,
              h: 0.4,
              fontSize: 14,
              bold: true,
              color: "FFFFFF",
              align: "center",
              valign: "middle",
            });

            // Measurements
            if (currentReccePhoto.measurements) {
              boardSlide.addShape(prs.ShapeType.rect, {
                x: 0.2,
                y: contentStartY + imgHeight + 0.43,
                w: 11.29,
                h: 0.25,
                fill: { color: "FFFFFF" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(
                `Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`,
                {
                  x: 0.2,
                  y: contentStartY + imgHeight + 0.43,
                  w: 11.29,
                  h: 0.25,
                  fontSize: 10,
                  bold: true,
                  color: "1F2937",
                  align: "center",
                  valign: "middle",
                },
              );
            }

            // Elements
            if (
              currentReccePhoto.elements &&
              currentReccePhoto.elements.length > 0
            ) {
              const elementsText = currentReccePhoto.elements
                .map((el: any) => `${el.elementName} (Qty: ${el.quantity})`)
                .join(" | ");
              boardSlide.addShape(prs.ShapeType.rect, {
                x: 0.2,
                y: contentStartY + imgHeight + 0.71,
                w: 11.29,
                h: 0.22,
                fill: { color: "FEF3C7" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(`Elements: ${elementsText}`, {
                x: 0.2,
                y: contentStartY + imgHeight + 0.71,
                w: 11.29,
                h: 0.22,
                fontSize: 9,
                bold: true,
                color: "1F2937",
                align: "center",
                valign: "middle",
              });
            }
          }
        } else if (type === "recce" && currentReccePhoto) {
          // Single recce photo
          const reccePhotoUrl = `https://storage.enamorimpex.com/eloraftp/${currentReccePhoto.photo.replace(/\s+/g, "%20")}`;
          await addImageWithAspectRatio(
            boardSlide,
            reccePhotoUrl,
            0.3,
            contentStartY,
            11.09,
            4.8,
          );

          // Measurements
          if (currentReccePhoto.measurements) {
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.3,
              y: contentStartY + 4.83,
              w: 11.09,
              h: 0.25,
              fill: { color: "FFFFFF" },
              line: { color: GOLD, width: 1 },
            });
            boardSlide.addText(
              `Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`,
              {
                x: 0.3,
                y: contentStartY + 4.83,
                w: 11.09,
                h: 0.25,
                fontSize: 10,
                bold: true,
                color: "1F2937",
                align: "center",
                valign: "middle",
              },
            );
          }

          // Elements
          if (
            currentReccePhoto.elements &&
            currentReccePhoto.elements.length > 0
          ) {
            const elementsText = currentReccePhoto.elements
              .map((el: any) => `${el.elementName} (Qty: ${el.quantity})`)
              .join(" | ");
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.3,
              y: contentStartY + 5.11,
              w: 11.09,
              h: 0.22,
              fill: { color: "FEF3C7" },
              line: { color: GOLD, width: 1 },
            });
            boardSlide.addText(`Elements: ${elementsText}`, {
              x: 0.3,
              y: contentStartY + 5.11,
              w: 11.09,
              h: 0.22,
              fontSize: 9,
              bold: true,
              color: "1F2937",
              align: "center",
              valign: "middle",
            });
          }
        }
      }
    }

    // ── Send response ──────────────────────────────────────────────────
    const buffer = await prs.write("nodebuffer");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Report_${type}_${stores.length}_Stores_${new Date().toISOString().split("T")[0]}.pptx"`,
    );
    res.send(buffer);
  } catch (error: any) {
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Error generating bulk PPT", error: error.message });
    }
  }
};
