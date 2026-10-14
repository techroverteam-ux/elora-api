/**
 * PPT reports — same design as the PDF reports (pdf.controller.ts).
 *
 * Every slide is a 1:1 port of the matching PDF page. The PDF is A4 landscape
 * (842 x 595 pt) and so is this deck (11.69 x 8.27 in), so each PDF coordinate
 * is used as-is and converted with pt() (72 pt = 1 in). If you change a layout
 * in pdf.controller.ts, change the same numbers here.
 *
 *   GET  /stores/:id/ppt/recce         -> generateReccePPT        (= generateReccePDF)
 *   GET  /stores/:id/ppt/installation  -> generateInstallationPPT (= generateInstallationPDF)
 *   POST /stores/ppt/bulk              -> generateBulkPPT         (= generateBulkPDF)
 *
 * Photos use the same loader as the PDF (utils/reportImages): retries,
 * EXIF rotation, HEIC/WEBP -> JPEG, fitted (not stretched) inside the box.
 */
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
} from "../../utils/reportImages";

type ReportType = "recce" | "installation";

// ── Units & page (identical to the PDF page) ────────────────────────────────
const pt = (v: number) => v / 72;
const PAGE_W = 841.89; // A4 landscape, pt
const PAGE_H = 595.28;

// ── PDF colours / fonts ─────────────────────────────────────────────────────
const BG = "FFFEF5";
const YELLOW = "EAB308";
const GREEN = "22C55E";
const RED = "EF4444";
const DARK = "1F2937";
const ELEMENT_BG = "FEF3C7";
const FONT = "Arial"; // PDF uses Helvetica; Arial is its metric-compatible twin

const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");
let logoData: string | null | undefined;
const getLogo = () => {
  if (logoData === undefined) {
    try {
      logoData = fs.existsSync(LOGO_PATH)
        ? `image/png;base64,${fs.readFileSync(LOGO_PATH).toString("base64")}`
        : null;
    } catch {
      logoData = null;
    }
  }
  return logoData;
};

// ── Drawing primitives, in PDF points ───────────────────────────────────────
const strokeRect = (s: any, x: number, y: number, w: number, h: number, color: string, width: number) =>
  s.addShape("rect", { x: pt(x), y: pt(y), w: pt(w), h: pt(h), line: { color, width } });

const fillRect = (s: any, x: number, y: number, w: number, h: number, fill: string, stroke: string) =>
  s.addShape("rect", { x: pt(x), y: pt(y), w: pt(w), h: pt(h), fill: { color: fill }, line: { color: stroke, width: 1 } });

const hLine = (s: any, x1: number, x2: number, y: number, color: string, width: number) =>
  s.addShape("line", { x: pt(x1), y: pt(y), w: pt(x2 - x1), h: 0, line: { color, width } });

// PDFKit places text by the top of its first line; PowerPoint puts a little
// more space above the first line, so lift the box by TEXT_LIFT x font size.
const TEXT_LIFT = 0.22;
const text = (
  s: any,
  str: string,
  x: number,
  y: number,
  w: number,
  o: { size: number; color: string; bold?: boolean; align?: "left" | "center" | "right"; lines?: number },
) =>
  s.addText(str, {
    x: pt(x), y: pt(y - o.size * TEXT_LIFT), w: pt(w), h: pt(o.size * 1.25 * (o.lines || 1)),
    fontFace: FONT, fontSize: o.size, bold: !!o.bold, color: o.color,
    align: o.align || "left", valign: "top", margin: 0, inset: 0, fit: "none",
  });

// Same as the PDF's drawImageInBox: fitted + centred, or a grey placeholder.
const photo = async (s: any, src: string | undefined, x: number, y: number, w: number, h: number) => {
  const img = src ? await loadReportImage(src) : null;
  if (img) {
    const b = containBox(img.width, img.height, pt(x), pt(y), pt(w), pt(h));
    s.addImage({ data: toPptData(img), x: b.x, y: b.y, w: b.w, h: b.h });
    return;
  }
  s.addShape("rect", { x: pt(x), y: pt(y), w: pt(w), h: pt(h), fill: { color: "F3F4F6" }, line: { type: "none" } });
  s.addText("Photo unavailable", {
    x: pt(x), y: pt(y), w: pt(w), h: pt(h), fontFace: FONT, fontSize: 11, italic: true,
    color: "9CA3AF", align: "center", valign: "middle", margin: 0,
  });
};

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "/") : "N/A";

const measurementText = (p: any) => {
  const m = p?.measurements || {};
  return `Measurements: ${m.width ?? "-"} x ${m.height ?? "-"} ${m.unit ?? ""}`.trim();
};
const elementsText = (p: any) =>
  (p?.elements || []).map((el: any) => `${el.elementName} (Qty: ${el.quantity})`).join(" | ");

// ── Cover page (PDF "SLIDE 1: COVER PAGE") ──────────────────────────────────
const addCover = (prs: any) => {
  const s = prs.addSlide();
  s.background = { color: BG };
  const big = { size: 24, color: YELLOW, bold: true };
  text(s, "WE DON'T JUST PRINT.", 100, 150, 600, big);
  text(s, "WE INSTALL YOUR BRAND", 100, 185, 600, big);
  text(s, "INTO THE REAL WORLD.", 100, 220, 600, big);
  const logo = getLogo();
  if (logo) s.addImage({ data: logo, x: pt(240), y: pt(280), w: pt(300), h: pt(90) });
  text(s, "We help businesses stand out with custom branding,", 300, 420, 500, { size: 12, color: DARK, align: "right" });
  text(s, "high-quality banner printing, and professional on-site installation.", 200, 438, 600, { size: 12, color: DARK, align: "right" });
};

// ── Header on every content slide (PDF drawStoreDetailsHeader) ──────────────
// Returns the content start Y in pt, like the PDF.
const addHeader = (s: any, store: any, type: ReportType, boardInfo?: string) => {
  s.background = { color: BG };
  const titleColor = type === "recce" ? YELLOW : GREEN;

  const logo = getLogo();
  if (logo) s.addImage({ data: logo, x: pt(40), y: pt(15), w: pt(80), h: pt(24) });

  let title = type === "recce" ? "RECCE INSPECTION REPORT" : "INSTALLATION COMPLETION REPORT";
  if (boardInfo) title += ` - ${boardInfo}`;
  text(s, title, 160, 18, 500, { size: 18, color: titleColor, bold: true, align: "center" });

  text(s, "ELORA CREATIVE ART", 650, 12, 150, { size: 9, color: YELLOW, align: "right" });
  text(s, "www.eloracreativeart.in", 650, 24, 150, { size: 9, color: YELLOW, align: "right" });

  hLine(s, 30, 770, 50, YELLOW, 2);

  const boxY = 55;
  const boxH = 65;
  strokeRect(s, 30, boxY, 740, boxH, YELLOW, 1);

  const label = (str: string, x: number, y: number, w: number) => text(s, str, x, y, w, { size: 9, color: "000000", bold: true });
  const value = (str: string, x: number, y: number, w: number) => text(s, str, x, y, w, { size: 9, color: "000000" });

  let y = boxY + 10;
  label("Dealer Code:", 40, y, 80);
  value(store.dealerCode || "N/A", 120, y, 180);
  label("Store Name:", 310, y, 80);
  value(store.storeName || "N/A", 390, y, 200);
  label("Store ID:", 600, y, 60);
  value(store.storeId || store.storeCode || "N/A", 660, y, 100);

  y += 16;
  label("City:", 40, y, 80);
  value(store.location?.city || "N/A", 120, y, 180);
  label("State:", 310, y, 80);
  value(store.location?.state || "N/A", 390, y, 200);
  label("Address:", 600, y, 80);
  value(store.location?.address || "N/A", 680, y, 90);

  if (type === "installation") {
    y += 16;
    text(s, "✓ COMPLETED", 600, y, 150, { size: 9, color: GREEN, bold: true });
  }

  hLine(s, 30, 770, boxY + boxH + 2, YELLOW, 1);
  return boxY + boxH + 6;
};

// ── Initial photos 2x2 grid ─────────────────────────────────────────────────
// The PDFs use two slightly different grids; `tight` = per-store recce PDF.
const addInitialPhotos = async (prs: any, store: any, type: ReportType, tight: boolean) => {
  const photos: string[] = store.recce?.initialPhotos || [];
  if (!photos.length) return;
  const s = prs.addSlide();
  const contentStartY = addHeader(s, store, type);

  const gap = tight ? 20 : 30;
  const photoY = tight ? contentStartY + 10 : contentStartY;
  const availableWidth = PAGE_W - 80;
  const availableHeight = PAGE_H - contentStartY - (tight ? 40 : 60);
  const w = (availableWidth - gap) / 2;
  const h = (availableHeight - gap) / 2;

  for (let i = 0; i < Math.min(photos.length, 4); i++) {
    const x = 40 + (i % 2) * (w + gap);
    const y = photoY + Math.floor(i / 2) * (h + gap);
    strokeRect(s, x, y, w, h, YELLOW, 2);
    await photo(s, photos[i], x + 5, y + 5, w - 10, h - 10);
  }
};

// ── Measurements + elements bars ────────────────────────────────────────────
const addMeasureBars = (
  s: any, p: any, x: number, y: number, w: number,
  m: { h: number; textDy: number; elemDy: number; elemH: number; elemTextDy: number },
) => {
  fillRect(s, x, y, w, m.h, "FFFFFF", YELLOW);
  text(s, measurementText(p), x, y + m.textDy, w, { size: 10, color: DARK, bold: true, align: "center" });
  const els = elementsText(p);
  if (els) {
    const ey = y + m.elemDy;
    fillRect(s, x, ey, w, m.elemH, ELEMENT_BG, YELLOW);
    text(s, `Elements: ${els}`, x, ey + m.elemTextDy, w, { size: 9, color: DARK, bold: true, align: "center" });
  }
};

const labelBar = (s: any, str: string, x: number, y: number, w: number, h: number, color: string, textDy: number) => {
  fillRect(s, x, y, w, h, color, color);
  text(s, str, x, y + textDy, w, { size: 11, color: "FFFFFF", bold: true, align: "center" });
};

const boardStatus = (p: any) =>
  ({ APPROVED: "APPROVED", REJECTED: "REJECTED", HOLD: "ON HOLD" } as Record<string, string>)[p?.approvalStatus] || "PENDING";

// ── Per-store RECCE deck (= generateReccePDF) ───────────────────────────────
const buildRecceDeck = async (prs: any, store: any) => {
  addCover(prs);
  await addInitialPhotos(prs, store, "recce", true);

  const boards: any[] = store.recce?.reccePhotos || [];
  for (let i = 0; i < boards.length; i++) {
    const p = boards[i];
    const s = prs.addSlide();
    const y0 = addHeader(s, store, "recce", `Board ${i + 1}/${boards.length} · ${boardStatus(p)}`);
    const imgW = 720;
    const imgH = 380;
    strokeRect(s, 40, y0, imgW, imgH, YELLOW, 2);
    await photo(s, p.photo, 45, y0 + 5, imgW - 10, imgH - 10);
    addMeasureBars(s, p, 40, y0 + imgH + 5, imgW, { h: 22, textDy: 6, elemDy: 25, elemH: 20, elemTextDy: 5 });
  }
};

// ── Per-store INSTALLATION deck (= generateInstallationPDF) ─────────────────
const buildInstallationDeck = async (prs: any, store: any) => {
  addCover(prs);
  await addInitialPhotos(prs, store, "installation", false);

  const boards: any[] = store.recce?.reccePhotos || [];
  const installs: any[] = store.installation?.photos || [];
  if (!boards.length || !store.installation?.photos) return;

  for (let i = 0; i < boards.length; i++) {
    const p = boards[i];
    const after = installs.find((ip: any) => ip.reccePhotoIndex === i);
    const s = prs.addSlide();
    const y0 = addHeader(s, store, "installation", `Board ${i + 1}/${boards.length}`);
    const imgW = 355;
    const imgH = 380;
    const gap = 30;

    strokeRect(s, 40, y0, imgW, imgH, RED, 2);
    await photo(s, p.photo, 45, y0 + 5, imgW - 10, imgH - 10);
    if (after) {
      strokeRect(s, 40 + imgW + gap, y0, imgW, imgH, GREEN, 2);
      await photo(s, after.installationPhoto, 45 + imgW + gap, y0 + 5, imgW - 10, imgH - 10);
    }

    const labelY = y0 + imgH + 3;
    labelBar(s, "BEFORE", 40, labelY, imgW, 22, RED, 6);
    labelBar(s, "AFTER", 40 + imgW + gap, labelY, imgW, 22, GREEN, 6);

    addMeasureBars(s, p, 40, labelY + 27, imgW * 2 + gap, { h: 20, textDy: 5, elemDy: 23, elemH: 18, elemTextDy: 4 });
  }
};

// ── Bulk deck (= generateBulkPDF) ───────────────────────────────────────────
const buildBulkDeck = async (prs: any, stores: any[], type: ReportType) => {
  addCover(prs);

  for (const store of stores) {
    if (type === "recce" && !store.recce) continue;
    if (type === "installation" && !store.installation) continue;

    await addInitialPhotos(prs, store, type, false);

    const boards: any[] = store.recce?.reccePhotos || [];
    const boardCount = Math.max(1, boards.length);
    for (let b = 0; b < boardCount; b++) {
      const p = boards[b];
      const s = prs.addSlide();
      const y0 = addHeader(s, store, type, boards.length > 1 ? `Board ${b + 1}/${boards.length}` : undefined);

      if (type === "installation" && p && store.installation?.photos) {
        const afters = store.installation.photos.filter((ip: any) => ip.reccePhotoIndex === b);
        const imgH = 380;

        if (afters.length >= 2) {
          const imgW = (PAGE_W - 60) / 3;
          strokeRect(s, 30, y0, imgW, imgH, RED, 3);
          await photo(s, p.photo, 35, y0 + 5, imgW - 10, imgH - 10);
          strokeRect(s, 30 + imgW, y0, imgW, imgH, GREEN, 3);
          await photo(s, afters[0].installationPhoto, 35 + imgW, y0 + 5, imgW - 10, imgH - 10);
          strokeRect(s, 30 + imgW * 2, y0, imgW, imgH, GREEN, 3);
          await photo(s, afters[1].installationPhoto, 35 + imgW * 2, y0 + 5, imgW - 10, imgH - 10);

          const labelY = y0 + imgH + 5;
          labelBar(s, "BEFORE", 30, labelY, imgW, 20, RED, 5);
          labelBar(s, "AFTER 1", 30 + imgW, labelY, imgW, 20, GREEN, 5);
          labelBar(s, "AFTER 2", 30 + imgW * 2, labelY, imgW, 20, GREEN, 5);
        } else {
          const imgW = (PAGE_W - 50) / 2;
          strokeRect(s, 30, y0, imgW, imgH, RED, 3);
          await photo(s, p.photo, 35, y0 + 5, imgW - 10, imgH - 10);
          if (afters[0]) {
            strokeRect(s, 30 + imgW, y0, imgW, imgH, GREEN, 3);
            await photo(s, afters[0].installationPhoto, 35 + imgW, y0 + 5, imgW - 10, imgH - 10);
          }
          const labelY = y0 + imgH + 5;
          labelBar(s, "BEFORE", 30, labelY, imgW, 20, RED, 5);
          labelBar(s, "AFTER", 30 + imgW, labelY, imgW, 20, GREEN, 5);
        }

        addMeasureBars(s, p, 30, y0 + imgH + 30, PAGE_W - 60, { h: 20, textDy: 5, elemDy: 23, elemH: 18, elemTextDy: 4 });
      } else if (type === "recce" && p) {
        const imgH = 400;
        strokeRect(s, 30, y0, PAGE_W - 60, imgH, YELLOW, 3);
        await photo(s, p.photo, 35, y0 + 5, PAGE_W - 70, imgH - 10);
        addMeasureBars(s, p, 30, y0 + imgH + 8, PAGE_W - 60, { h: 22, textDy: 5, elemDy: 25, elemH: 18, elemTextDy: 4 });
      }
    }
  }
};

// ── Shared plumbing ─────────────────────────────────────────────────────────
const newDeck = () => {
  const PptxGenJS = require("pptxgenjs");
  const prs = new PptxGenJS();
  prs.defineLayout({ name: "A4_LANDSCAPE", width: pt(PAGE_W), height: pt(PAGE_H) });
  prs.layout = "A4_LANDSCAPE";
  return prs;
};

const sendDeck = async (res: Response, prs: any, filename: string) => {
  const buffer = await prs.write({ outputType: "nodebuffer" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
};

const storeLabel = (store: any) => store.dealerCode || store.storeName || store.storeId;

// ====== CONTROLLER: Per-store Recce PPT ======
export const generateReccePPT = async (req: Request, res: Response) => {
  try {
    const store: any = await Store.findById(req.params.id);
    if (!store || !store.recce) {
      return res.status(404).json({ message: "Store or Recce data not found" });
    }
    await prefetchReportImages(collectStoreImagePaths(store));
    const prs = newDeck();
    await buildRecceDeck(prs, store);
    await sendDeck(res, prs, `Recce_${storeLabel(store)}.pptx`);
  } catch (error: any) {
    console.error("Recce PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PPT", error: error.message });
  }
};

// ====== CONTROLLER: Per-store Installation PPT ======
export const generateInstallationPPT = async (req: Request, res: Response) => {
  try {
    const store: any = await Store.findById(req.params.id);
    if (!store || !store.installation) {
      return res.status(404).json({ message: "Store or Installation data not found" });
    }
    await prefetchReportImages(collectStoreImagePaths(store));
    const prs = newDeck();
    await buildInstallationDeck(prs, store);
    await sendDeck(res, prs, `Installation_${storeLabel(store)}.pptx`);
  } catch (error: any) {
    console.error("Installation PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PPT", error: error.message });
  }
};

// ====== CONTROLLER: Bulk PPT ======
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
    await prefetchReportImages(stores.flatMap((st: any) => collectStoreImagePaths(st)));

    const prs = newDeck();
    await buildBulkDeck(prs, stores, type);

    const filename =
      stores.length === 1
        ? `${type === "recce" ? "Recce" : "Installation"}_${storeLabel(stores[0])}.pptx`
        : `Report_${type}_${stores.length}_Stores_${new Date().toISOString().split("T")[0]}.pptx`;
    await sendDeck(res, prs, filename);
  } catch (error: any) {
    console.error("Bulk PPT Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PPT", error: error.message });
  }
};
