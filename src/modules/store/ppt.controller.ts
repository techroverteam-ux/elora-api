import { Request, Response } from "express";
import Store from "./store.model";
import path from "path";
import fs from "fs";
import {
  loadReportImage,
  prefetchReportImages,
  collectStoreImagePaths,
  containBox,
  toPptData,
  withReportDeadline,
} from "../../utils/reportImages";
import { getLogoPptData } from "../../utils/reportLogo";

// The shared loader (utils/reportImages) builds and encodes the storage URL
// itself (and decodes first, so a stored "%20" doesn't become "%2520"), so
// pass the stored path through untouched. Same as the PDF generator.
const getFullImageUrl = (p: string) => p || "";

// ====== HELPER: Add image fitted (not stretched) and centred in its box ======
// Uses the same loader as the PDF: retries + timeout, EXIF rotation, HEIC/WEBP
// converted to JPEG, resized to max 1600px. If a photo really can't be loaded,
// draw a "Photo unavailable" placeholder so it's obvious, not a blank box.
const addImageWithAspectRatio = async (
  slide: any,
  imageUrl: string,
  boxX: number,
  boxY: number,
  maxWidth: number,
  maxHeight: number,
) => {
  try {
    const img = await loadReportImage(imageUrl);
    if (img) {
      const dims = containBox(img.width, img.height, boxX, boxY, maxWidth, maxHeight);
      slide.addImage({ data: toPptData(img), x: dims.x, y: dims.y, w: dims.w, h: dims.h });
      return true;
    }
  } catch (e) {
    console.warn("[ppt] could not add image", e);
  }
  slide.addShape("rect", {
    x: boxX, y: boxY, w: maxWidth, h: maxHeight,
    fill: { color: "F3F4F6" }, line: { color: "F3F4F6", width: 0 },
  });
  slide.addText("Photo unavailable", {
    x: boxX, y: boxY, w: maxWidth, h: maxHeight,
    fontSize: 11, italic: true, color: "9CA3AF", align: "center", valign: "middle",
  });
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
  const logoBase64 = getLogoPptData();
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
export const generateBulkPPT = (req: Request, res: Response) =>
  withReportDeadline(() => buildBulkPPT(req, res));

const buildBulkPPT = async (req: Request, res: Response) => {
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

    // ── Logo (embedded fallback, so it never goes missing on Vercel) ──
    const logoBase64 = getLogoPptData();

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

    // Fetch all photos (4 at a time) before building slides, same as the PDF.
    await prefetchReportImages(stores.flatMap((st: any) => collectStoreImagePaths(st)));

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

          const photoUrl = getFullImageUrl(store.recce.initialPhotos[i]);
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

            // BEFORE Card & Image
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.2,
              y: contentStartY,
              w: imgWidth,
              h: imgHeight,
              fill: { color: "FFFFFF" },
              line: { color: RED, width: 2 },
            });
            const reccePhotoUrl = getFullImageUrl(currentReccePhoto.photo);
            await addImageWithAspectRatio(
              boardSlide,
              reccePhotoUrl,
              0.25,
              contentStartY + 0.05,
              imgWidth - 0.1,
              imgHeight - 0.1,
            );

            // AFTER 1 Card & Image
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 4.0,
              y: contentStartY,
              w: imgWidth,
              h: imgHeight,
              fill: { color: "FFFFFF" },
              line: { color: GREEN, width: 2 },
            });
            const installPhoto1Url = getFullImageUrl(installPhotos[0].installationPhoto);
            await addImageWithAspectRatio(
              boardSlide,
              installPhoto1Url,
              4.05,
              contentStartY + 0.05,
              imgWidth - 0.1,
              imgHeight - 0.1,
            );

            // AFTER 2 Card & Image
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 7.8,
              y: contentStartY,
              w: imgWidth,
              h: imgHeight,
              fill: { color: "FFFFFF" },
              line: { color: GREEN, width: 2 },
            });
            const installPhoto2Url = getFullImageUrl(installPhotos[1].installationPhoto);
            await addImageWithAspectRatio(
              boardSlide,
              installPhoto2Url,
              7.85,
              contentStartY + 0.05,
              imgWidth - 0.1,
              imgHeight - 0.1,
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
            let currentBottomY = contentStartY + imgHeight + 0.38;
            if (currentReccePhoto.measurements) {
              boardSlide.addShape(prs.ShapeType.rect, {
                x: 0.2,
                y: currentBottomY,
                w: 11.29,
                h: 0.25,
                fill: { color: "FFFFFF" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(
                `Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`,
                {
                  x: 0.2,
                  y: currentBottomY,
                  w: 11.29,
                  h: 0.25,
                  fontSize: 10,
                  bold: true,
                  color: "1F2937",
                  align: "center",
                  valign: "middle",
                },
              );
              currentBottomY += 0.28;
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
                y: currentBottomY,
                w: 11.29,
                h: 0.22,
                fill: { color: "FEF3C7" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(`Elements: ${elementsText}`, {
                x: 0.2,
                y: currentBottomY,
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

            // BEFORE Card & Image
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 0.2,
              y: contentStartY,
              w: imgWidth,
              h: imgHeight,
              fill: { color: "FFFFFF" },
              line: { color: RED, width: 2 },
            });
            const reccePhotoUrl = getFullImageUrl(currentReccePhoto.photo);
            await addImageWithAspectRatio(
              boardSlide,
              reccePhotoUrl,
              0.25,
              contentStartY + 0.05,
              imgWidth - 0.1,
              imgHeight - 0.1,
            );

            // AFTER Card & Image
            boardSlide.addShape(prs.ShapeType.rect, {
              x: 6.0,
              y: contentStartY,
              w: imgWidth,
              h: imgHeight,
              fill: { color: "FFFFFF" },
              line: { color: GREEN, width: 2 },
            });
            if (installPhoto) {
              const installPhotoUrl = getFullImageUrl(installPhoto.installationPhoto);
              await addImageWithAspectRatio(
                boardSlide,
                installPhotoUrl,
                6.05,
                contentStartY + 0.05,
                imgWidth - 0.1,
                imgHeight - 0.1,
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
            let currentBottomY = contentStartY + imgHeight + 0.43;
            if (currentReccePhoto.measurements) {
              boardSlide.addShape(prs.ShapeType.rect, {
                x: 0.2,
                y: currentBottomY,
                w: 11.29,
                h: 0.25,
                fill: { color: "FFFFFF" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(
                `Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`,
                {
                  x: 0.2,
                  y: currentBottomY,
                  w: 11.29,
                  h: 0.25,
                  fontSize: 10,
                  bold: true,
                  color: "1F2937",
                  align: "center",
                  valign: "middle",
                },
              );
              currentBottomY += 0.28;
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
                y: currentBottomY,
                w: 11.29,
                h: 0.22,
                fill: { color: "FEF3C7" },
                line: { color: GOLD, width: 1 },
              });
              boardSlide.addText(`Elements: ${elementsText}`, {
                x: 0.2,
                y: currentBottomY,
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
          // Single recce photo with container frame and proportional fit
          const boxX = 0.3;
          const boxY = contentStartY;
          const boxW = 11.09;
          const boxH = 4.8;

          boardSlide.addShape(prs.ShapeType.rect, {
            x: boxX,
            y: boxY,
            w: boxW,
            h: boxH,
            fill: { color: "FFFFFF" },
            line: { color: GOLD, width: 2 },
          });

          const reccePhotoUrl = getFullImageUrl(currentReccePhoto.photo);
          await addImageWithAspectRatio(
            boardSlide,
            reccePhotoUrl,
            boxX + 0.05,
            boxY + 0.05,
            boxW - 0.1,
            boxH - 0.1,
          );

          // Measurements
          let currentBottomY = boxY + boxH + 0.03;
          if (currentReccePhoto.measurements) {
            boardSlide.addShape(prs.ShapeType.rect, {
              x: boxX,
              y: currentBottomY,
              w: boxW,
              h: 0.25,
              fill: { color: "FFFFFF" },
              line: { color: GOLD, width: 1 },
            });
            boardSlide.addText(
              `Measurements: ${currentReccePhoto.measurements.width} x ${currentReccePhoto.measurements.height} ${currentReccePhoto.measurements.unit}`,
              {
                x: boxX,
                y: currentBottomY,
                w: boxW,
                h: 0.25,
                fontSize: 10,
                bold: true,
                color: "1F2937",
                align: "center",
                valign: "middle",
              },
            );
            currentBottomY += 0.28;
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
              x: boxX,
              y: currentBottomY,
              w: boxW,
              h: 0.22,
              fill: { color: "FEF3C7" },
              line: { color: GOLD, width: 1 },
            });
            boardSlide.addText(`Elements: ${elementsText}`, {
              x: boxX,
              y: currentBottomY,
              w: boxW,
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
    const filename =
      stores.length === 1
        ? `${type === "recce" ? "Recce" : "Installation"}_${stores[0].dealerCode || stores[0].storeName || stores[0].storeId}.pptx`
        : `Report_${type}_${stores.length}_Stores_${new Date().toISOString().split("T")[0]}.pptx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Error generating bulk PPT", error: error.message });
    }
  }
};

// ====== CONTROLLER: Generate Individual Recce PPT ======
export const generateReccePPT = async (req: Request, res: Response) => {
  const { id } = req.params;
  req.body = { storeIds: [id], type: "recce" };
  return generateBulkPPT(req, res);
};

// ====== CONTROLLER: Generate Individual Installation PPT ======
export const generateInstallationPPT = async (req: Request, res: Response) => {
  const { id } = req.params;
  req.body = { storeIds: [id], type: "installation" };
  return generateBulkPPT(req, res);
};
