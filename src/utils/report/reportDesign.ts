// One layout for the recce / installation reports, shared by the PDF and the PPT.
//
// Everything is placed on a fixed grid in points (A4 landscape, 841.89 × 595.28 pt).
// buildReportPages() turns stores into a list of pages made of simple drawing ops
// (rect, line, dot, text, image). reportRender.ts draws the same ops with pdfkit and
// pptxgenjs, so both files line up identically.

import { loadReportImage, ReportImage } from "../reportImages";
import { installPhotosByType } from "../installPhotos";

/* ------------------------------------------------------------------ */
/* Page grid                                                          */
/* ------------------------------------------------------------------ */

export const PAGE_W = 841.89;
export const PAGE_H = 595.28;
export const M = 28; // left / right page margin
export const CW = PAGE_W - M * 2; // content width
export const GAP = 12; // gutter between cards and columns

const HEADER_Y = 20; // top of logo / title row
const LOGO_H = 28;
const LOGO_W = LOGO_H * (970 / 239); // logo.png is 970 × 239
const RULE_Y = 58; // gold rule under the header
const INFO_Y = 68; // store panel
const INFO_H = 68;
export const CONTENT_Y = INFO_Y + INFO_H + 14; // 142
const FOOTER_RULE_Y = PAGE_H - 30;
const FOOTER_TEXT_Y = FOOTER_RULE_Y + 7;
export const CONTENT_BOTTOM = FOOTER_RULE_Y - 12;
export const CONTENT_H = CONTENT_BOTTOM - CONTENT_Y;

const DETAIL_H = 46; // measurement / element bar under board photos
const CARD_LABEL_H = 24; // label row on top of every photo card
const CARD_PAD = 6;
const RADIUS = 6;

/* ------------------------------------------------------------------ */
/* Colours (hex without #)                                            */
/* ------------------------------------------------------------------ */

export const C = {
  page: "FFFDF8",
  cover: "F7F3EA",
  panel: "F7F3EA",
  card: "FFFFFF",
  well: "F3F0E8", // behind letterboxed photos
  line: "E7E1D3",
  brand: "F6B21C", // logo yellow
  brandDark: "B7791F",
  ink: "1F2937",
  body: "374151",
  muted: "6B7280",
  faint: "9CA3AF",
  recce: "B7791F",
  before: "C2410C",
  after: "15803D",
  closeup: "1D4ED8",
  danger: "B91C1C",
  warn: "B45309",
};

/* ------------------------------------------------------------------ */
/* Drawing ops                                                        */
/* ------------------------------------------------------------------ */

export type Align = "left" | "center" | "right";
export type Op =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; r?: number }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { k: "dot"; cx: number; cy: number; r: number; color: string }
  | { k: "text"; x: number; y: number; w: number; h: number; lines: string[]; size: number; bold?: boolean; italic?: boolean; color: string; align: Align; valign: "top" | "middle" | "bottom"; lh: number }
  | { k: "image"; img: ReportImage | null; x: number; y: number; w: number; h: number; empty?: string }
  | { k: "logo"; x: number; y: number; w: number; h: number };

export type Page = { bg: string; ops: Op[]; footer?: { left: string; center: string } };

/* ------------------------------------------------------------------ */
/* Text measuring (Helvetica metrics; Arial in the PPT is metric-compatible) */
/* ------------------------------------------------------------------ */

let measurer: any = null;
const measure = (text: string, size: number, bold = false): number => {
  if (!measurer) {
    const PDFDocument = require("pdfkit");
    measurer = new PDFDocument({ autoFirstPage: false });
  }
  measurer.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
  return measurer.widthOfString(text);
};

// Characters Helvetica (WinAnsi) can't draw are swapped for close equivalents.
export const clean = (s: unknown): string =>
  String(s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/✓|✔/g, "")
    .replace(/\s+/g, " ")
    .trim();

const ellipsize = (text: string, width: number, size: number, bold: boolean) => {
  if (measure(text, size, bold) <= width) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid).trimEnd() + "…", size, bold) <= width) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + "…";
};

/** Wraps text into at most `maxLines` lines that fit `width`; the last line gets "…" if cut. */
export const wrap = (raw: unknown, width: number, size: number, bold = false, maxLines = 1): string[] => {
  const text = clean(raw);
  if (!text) return [""];
  if (maxLines <= 1) return [ellipsize(text, width, size, bold)];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (measure(next, size, bold) <= width || !cur) {
      cur = next;
    } else {
      lines.push(cur);
      cur = words[i];
      if (lines.length === maxLines - 1) {
        lines.push(ellipsize(words.slice(i).join(" "), width, size, bold));
        return lines;
      }
    }
  }
  lines.push(ellipsize(cur, width, size, bold));
  return lines;
};

const text = (
  ops: Op[],
  value: unknown,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { size: number; bold?: boolean; italic?: boolean; color?: string; align?: Align; valign?: "top" | "middle" | "bottom"; maxLines?: number; lh?: number }
) => {
  const lines = wrap(value, w, o.size, !!o.bold, o.maxLines || 1);
  ops.push({
    k: "text",
    x,
    y,
    w,
    h,
    lines,
    size: o.size,
    bold: o.bold,
    italic: o.italic,
    color: o.color || C.ink,
    align: o.align || "left",
    valign: o.valign || "middle",
    lh: o.lh || Math.round(o.size * 1.25 * 100) / 100,
  });
};

/* ------------------------------------------------------------------ */
/* Formatting                                                         */
/* ------------------------------------------------------------------ */

const fmtDate = (d?: Date | string | null) => {
  if (!d) return "";
  const t = new Date(d);
  if (isNaN(t.getTime())) return "";
  return t.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};

const toFeet = (m?: { width?: any; height?: any; unit?: string }) => {
  const w = Number(m?.width || 0);
  const h = Number(m?.height || 0);
  const u = String(m?.unit || "ft").toLowerCase();
  const f = u === "in" || u === "inch" ? 1 / 12 : u === "cm" ? 1 / 30.48 : u === "mm" ? 1 / 304.8 : u === "m" ? 3.28084 : 1;
  return { w: w * f, h: h * f };
};

const num = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d).replace(/\.?0+$/, "") || "0" : "0");

const reviewLabel = (s?: string) =>
  ({ APPROVED: "Approved", REJECTED: "Rejected", HOLD: "On hold" } as Record<string, string>)[String(s || "")] || "Pending review";
const reviewColor = (s?: string) => (s === "APPROVED" ? C.after : s === "REJECTED" ? C.danger : C.warn);

/* ------------------------------------------------------------------ */
/* Building blocks                                                    */
/* ------------------------------------------------------------------ */

type ReportType = "recce" | "installation";
const REPORT_TITLE: Record<ReportType, string> = { recce: "Recce Inspection Report", installation: "Installation Completion Report" };

/** Label + value cell used in the store panel and the detail bar. */
const field = (ops: Op[], label: string, value: unknown, x: number, y: number, w: number, valueColor = C.ink) => {
  text(ops, label.toUpperCase(), x, y, w, 10, { size: 6.5, bold: true, color: C.muted });
  text(ops, value === "" || value == null ? "-" : value, x, y + 12, w, 14, { size: 10, bold: true, color: valueColor });
};

/** Columns across a box: weights → [x, w] pairs with `GAP`-wide gutters. */
const columns = (x: number, w: number, weights: number[], gap = 16) => {
  const total = weights.reduce((a, b) => a + b, 0);
  const free = w - gap * (weights.length - 1);
  let cx = x;
  return weights.map((wt) => {
    const cw = (free * wt) / total;
    const col = { x: cx, w: cw };
    cx += cw + gap;
    return col;
  });
};

const header = (ops: Op[], type: ReportType, subtitle: string) => {
  ops.push({ k: "logo", x: M, y: HEADER_Y, w: LOGO_W, h: LOGO_H });
  const tx = M + LOGO_W + 24;
  const tw = PAGE_W - M - tx;
  text(ops, REPORT_TITLE[type], tx, HEADER_Y - 1, tw, 18, { size: 14, bold: true, align: "right" });
  text(ops, subtitle, tx, HEADER_Y + 17, tw, 13, { size: 9, color: C.muted, align: "right" });
  ops.push({ k: "line", x1: M, y1: RULE_Y, x2: PAGE_W - M, y2: RULE_Y, color: C.brand, lw: 1.25 });
};

const storePanel = (ops: Op[], store: any, type: ReportType) => {
  ops.push({ k: "rect", x: M, y: INFO_Y, w: CW, h: INFO_H, fill: C.panel, r: RADIUS });
  const pad = 14;
  const cols = columns(M + pad, CW - pad * 2, [1, 1, 1, 1, 1]);
  const span = (a: number, b: number) => ({ x: cols[a].x, w: cols[b].x + cols[b].w - cols[a].x });
  const r1 = INFO_Y + 10;
  const r2 = INFO_Y + 38;
  const date = type === "recce" ? store.recce?.submittedDate : store.installation?.submittedDate;
  const s01 = span(0, 1);
  field(ops, "Store", store.storeName, s01.x, r1, s01.w);
  field(ops, "Store ID", store.storeId || store.storeCode, cols[2].x, r1, cols[2].w);
  field(ops, "Dealer code", store.dealerCode, cols[3].x, r1, cols[3].w);
  field(ops, type === "recce" ? "Recce date" : "Installed on", fmtDate(date) || "Not submitted", cols[4].x, r1, cols[4].w);
  const s02 = span(0, 2);
  field(ops, "Address", store.location?.address, s02.x, r2, s02.w);
  field(ops, "City", store.location?.city, cols[3].x, r2, cols[3].w);
  field(ops, "State", store.location?.state, cols[4].x, r2, cols[4].w);
};

/** A photo card: coloured dot + label row on top, photo letterboxed in a well below. */
const photoCard = (
  ops: Op[],
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  accent: string,
  img: ReportImage | null,
  meta = "",
  empty = "Photo unavailable"
) => {
  ops.push({ k: "rect", x, y, w, h, fill: C.card, stroke: C.line, lw: 0.75, r: RADIUS });
  ops.push({ k: "dot", cx: x + CARD_PAD + 4 + 3.5, cy: y + CARD_LABEL_H / 2, r: 3.5, color: accent });
  const lx = x + CARD_PAD + 16;
  const metaW = meta ? Math.min(w * 0.45, measure(clean(meta), 8) + 2) : 0;
  text(ops, label.toUpperCase(), lx, y, w - (lx - x) - CARD_PAD - 4 - metaW, CARD_LABEL_H, { size: 8.5, bold: true, color: accent });
  if (meta) text(ops, meta, x + w - CARD_PAD - 4 - metaW, y, metaW, CARD_LABEL_H, { size: 8, color: C.muted, align: "right" });
  const ix = x + CARD_PAD;
  const iy = y + CARD_LABEL_H;
  const iw = w - CARD_PAD * 2;
  const ih = h - CARD_LABEL_H - CARD_PAD;
  ops.push({ k: "rect", x: ix, y: iy, w: iw, h: ih, fill: C.well, r: 3 });
  ops.push({ k: "image", img, x: ix, y: iy, w: iw, h: ih, empty });
};

/* ------------------------------------------------------------------ */
/* Pages                                                              */
/* ------------------------------------------------------------------ */

const newPage = (store: any, type: ReportType, subtitle: string): Page => {
  const ops: Op[] = [];
  header(ops, type, subtitle);
  storePanel(ops, store, type);
  return {
    bg: C.page,
    ops,
    footer: { left: "Elora Creative Art  ·  www.eloracreativeart.in", center: [clean(store.storeName), store.storeId].filter(Boolean).join("  ·  ") },
  };
};

/** Grid for k photos on one page: 1 → 1×1, 2 → 2×1, 3 → 3×1, 4 → 2×2, 5–6 → 3×2. */
const gridFor = (k: number) => (k <= 3 ? { cols: Math.max(1, k), rows: 1 } : k === 4 ? { cols: 2, rows: 2 } : { cols: 3, rows: 2 });

const storePhotoPages = async (store: any, type: ReportType): Promise<Page[]> => {
  const photos: string[] = (store.recce?.initialPhotos || []).filter(Boolean);
  if (!photos.length) return [];
  // Spread photos evenly over as few pages as possible (7 → 4 + 3, not 6 + 1).
  const pageCount = Math.ceil(photos.length / 6);
  const per = Math.ceil(photos.length / pageCount);
  const pages: Page[] = [];
  for (let start = 0; start < photos.length; start += per) {
    const chunk = photos.slice(start, start + per);
    const range = pageCount > 1 ? `  ·  ${start + 1}-${start + chunk.length} of ${photos.length}` : `  ·  ${photos.length}`;
    const page = newPage(store, type, `Store photos${range}`);
    const { cols, rows } = gridFor(chunk.length);
    const cellW = (CW - GAP * (cols - 1)) / cols;
    const cellH = (CONTENT_H - GAP * (rows - 1)) / rows;
    for (let i = 0; i < chunk.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const img = await loadReportImage(chunk[i]);
      photoCard(page.ops, M + col * (cellW + GAP), CONTENT_Y + row * (cellH + GAP), cellW, cellH, `Store photo ${start + i + 1}`, C.brandDark, img);
    }
    pages.push(page);
  }
  return pages;
};

const detailBar = (ops: Op[], board: any, type: ReportType, store: any) => {
  const y = CONTENT_BOTTOM - DETAIL_H;
  ops.push({ k: "rect", x: M, y, w: CW, h: DETAIL_H, fill: C.panel, r: RADIUS });
  const m = board?.measurements || {};
  const ft = toFeet(m);
  const area = ft.w * ft.h;
  const elements = (board?.elements || [])
    .filter((e: any) => e?.elementName)
    .map((e: any) => `${e.elementName}${Number(e.quantity) > 1 ? ` × ${e.quantity}` : ""}`)
    .join(", ");
  const pad = 14;
  const fy = y + 10;
  if (type === "recce") {
    const cols = columns(M + pad, CW - pad * 2, [1, 1.1, 0.8, 2.3, 1.6]);
    field(ops, "Measured", m.width ? `${num(Number(m.width))} × ${num(Number(m.height))} ${m.unit || ""}` : "", cols[0].x, fy, cols[0].w);
    field(ops, "In feet", ft.w ? `${num(ft.w)} × ${num(ft.h)} ft` : "", cols[1].x, fy, cols[1].w);
    field(ops, "Area", area ? `${num(area, 1)} sq.ft` : "", cols[2].x, fy, cols[2].w);
    field(ops, "Elements", elements || "Not set", cols[3].x, fy, cols[3].w);
    const status = reviewLabel(board?.approvalStatus);
    field(ops, "Review", board?.rejectionReason ? `${status}: ${board.rejectionReason}` : status, cols[4].x, fy, cols[4].w, reviewColor(board?.approvalStatus));
  } else {
    const cols = columns(M + pad, CW - pad * 2, [1, 1.1, 0.8, 2.5, 1.4]);
    field(ops, "Measured", m.width ? `${num(Number(m.width))} × ${num(Number(m.height))} ${m.unit || ""}` : "", cols[0].x, fy, cols[0].w);
    field(ops, "In feet", ft.w ? `${num(ft.w)} × ${num(ft.h)} ft` : "", cols[1].x, fy, cols[1].w);
    field(ops, "Area", area ? `${num(area, 1)} sq.ft` : "", cols[2].x, fy, cols[2].w);
    field(ops, "Elements", elements || "Not set", cols[3].x, fy, cols[3].w);
    field(ops, "Installed by", store.installation?.submittedBy || store.workflow?.installationAssignedTo?.name, cols[4].x, fy, cols[4].w);
  }
};

const boardPages = async (store: any, type: ReportType): Promise<Page[]> => {
  const boards: any[] = store.recce?.reccePhotos || [];
  const total = boards.length;
  const pages: Page[] = [];
  const cardY = CONTENT_Y;
  const cardH = CONTENT_H - DETAIL_H - GAP;

  for (let i = 0; i < total; i++) {
    const b = boards[i];
    const byType = installPhotosByType(store.installation?.photos as any, i);
    const hasInstall = !!(byType.before || byType.after || byType.closeup);
    // Installation report: boards that were approved for installation or have installed photos.
    if (type === "installation" && b?.approvalStatus !== "APPROVED" && !hasInstall) continue;

    const subtitle = type === "recce" ? `Board ${i + 1} of ${total}  ·  ${reviewLabel(b?.approvalStatus)}` : `Board ${i + 1} of ${total}`;
    const page = newPage(store, type, subtitle);
    const recceImg = await loadReportImage(b?.photo);
    const noRecce = b?.photo ? "Photo unavailable" : "No recce photo (direct installation)";

    if (type === "recce") {
      photoCard(page.ops, M, cardY, CW, cardH, `Board ${i + 1}`, C.recce, recceImg, "", noRecce);
    } else {
      const cards: Array<{ label: string; accent: string; img: ReportImage | null; empty: string }> = [
        { label: "Recce", accent: C.recce, img: recceImg, empty: noRecce },
        { label: "Before", accent: C.before, img: await loadReportImage(byType.before?.installationPhoto), empty: byType.before ? "Photo unavailable" : "Not uploaded" },
        { label: "After", accent: C.after, img: await loadReportImage(byType.after?.installationPhoto), empty: byType.after ? "Photo unavailable" : "Not uploaded" },
      ];
      if (byType.closeup) cards.push({ label: "Close-up", accent: C.closeup, img: await loadReportImage(byType.closeup.installationPhoto), empty: "Photo unavailable" });
      const n = cards.length;
      const cw = (CW - GAP * (n - 1)) / n;
      cards.forEach((c, k) => photoCard(page.ops, M + k * (cw + GAP), cardY, cw, cardH, c.label, c.accent, c.img, "", c.empty));
    }
    detailBar(page.ops, b, type, store);
    pages.push(page);
  }
  return pages;
};

const coverPage = (stores: any[], type: ReportType): Page => {
  const ops: Op[] = [];
  const logoH = 64;
  const logoW = logoH * (970 / 239);
  const tagSize = 24;
  const tagLH = 30;
  const tagline = ["WE DON'T JUST PRINT.", "WE INSTALL YOUR BRAND", "INTO THE REAL WORLD."];
  const sub = ["We help businesses stand out with custom branding, high-quality banner", "printing, and professional on-site installation."];
  const subLH = 15;
  const panelW = 500;
  const panelH = 124;
  const gaps = [28, 16, 30];
  const blockH = logoH + gaps[0] + tagline.length * tagLH + gaps[1] + sub.length * subLH + gaps[2] + panelH;
  let y = (PAGE_H - blockH) / 2;

  ops.push({ k: "logo", x: (PAGE_W - logoW) / 2, y, w: logoW, h: logoH });
  y += logoH + gaps[0];
  tagline.forEach((t) => {
    text(ops, t, M, y, CW, tagLH, { size: tagSize, bold: true, color: C.brandDark, align: "center" });
    y += tagLH;
  });
  y += gaps[1];
  sub.forEach((t) => {
    text(ops, t, M, y, CW, subLH, { size: 10.5, color: C.body, align: "center" });
    y += subLH;
  });
  y += gaps[2];

  const px = (PAGE_W - panelW) / 2;
  ops.push({ k: "rect", x: px, y, w: panelW, h: panelH, fill: "FFFFFF", stroke: C.line, lw: 0.75, r: 8 });
  const single = stores.length === 1 ? stores[0] : null;
  const cols = columns(px + 18, panelW - 36, [1, 1]);
  field(ops, "Report", REPORT_TITLE[type], cols[0].x, y + 14, cols[0].w);
  field(ops, "Generated on", fmtDate(new Date()), cols[1].x, y + 14, cols[1].w);
  const full = { x: cols[0].x, w: cols[1].x + cols[1].w - cols[0].x };
  field(ops, single ? "Store" : "Stores", single ? single.storeName : `${stores.length} stores`, full.x, y + 50, full.w);
  if (single) {
    field(ops, "Store ID", single.storeId || single.storeCode, cols[0].x, y + 86, cols[0].w);
    field(ops, "City", [single.location?.city, single.location?.state].filter(Boolean).join(", "), cols[1].x, y + 86, cols[1].w);
  } else {
    field(ops, "Cities", Array.from(new Set(stores.map((s) => s.location?.city).filter(Boolean))).join(", "), full.x, y + 86, full.w);
  }
  ops.push({ k: "rect", x: 0, y: PAGE_H - 6, w: PAGE_W, h: 6, fill: C.brand });
  return { bg: C.cover, ops };
};

const emptyPage = (type: ReportType): Page => {
  const ops: Op[] = [];
  text(ops, `No ${type} data for the selected stores.`, M, PAGE_H / 2 - 12, CW, 24, { size: 14, bold: true, color: C.muted, align: "center" });
  return { bg: C.page, ops };
};

/** Every page of a report, with footers (page x of n) added last. */
export const buildReportPages = async (stores: any[], type: ReportType): Promise<Page[]> => {
  const pages: Page[] = [coverPage(stores, type)];
  for (const store of stores) {
    if (type === "recce" && !store.recce) continue;
    if (type === "installation" && !store.installation) continue;
    pages.push(...(await storePhotoPages(store, type)));
    pages.push(...(await boardPages(store, type)));
  }
  if (pages.length === 1) pages.push(emptyPage(type));

  const n = pages.length;
  pages.forEach((p, idx) => {
    if (!p.footer) return;
    p.ops.push({ k: "line", x1: M, y1: FOOTER_RULE_Y, x2: PAGE_W - M, y2: FOOTER_RULE_Y, color: C.line, lw: 0.75 });
    const third = CW / 3;
    text(p.ops, p.footer.left, M, FOOTER_TEXT_Y, third, 12, { size: 7.5, color: C.muted });
    text(p.ops, p.footer.center, M + third, FOOTER_TEXT_Y, third, 12, { size: 7.5, color: C.muted, align: "center" });
    text(p.ops, `Page ${idx + 1} of ${n}`, M + third * 2, FOOTER_TEXT_Y, third, 12, { size: 7.5, color: C.muted, align: "right" });
  });
  return pages;
};
