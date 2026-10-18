// Draws the pages from reportDesign.ts as a PDF (pdfkit) or a PPTX (pptxgenjs).
// Both renderers use the same point coordinates, so the two files match.

import { Writable } from "stream";
import { getLogoBuffer, getLogoPptData } from "../reportLogo";
import { containBox, toPptData } from "../reportImages";
import { Op, Page, PAGE_W, PAGE_H, C } from "./reportDesign";

// Where the baseline sits below the vertical centre of a line box, in ems. Matches how
// PowerPoint centres a single Arial line (ascent .905, descent .212, line gap ~.033).
const BASELINE_FROM_CENTRE = 0.33;
const HELVETICA_ASCENT = 0.718; // pdfkit puts the top of the text this far above the baseline

const textBlockTop = (op: Extract<Op, { k: "text" }>) => {
  const blockH = op.lines.length * op.lh;
  if (op.valign === "top") return op.y;
  if (op.valign === "bottom") return op.y + op.h - blockH;
  return op.y + (op.h - blockH) / 2;
};

/* ------------------------------------------------------------------ */
/* PDF                                                                */
/* ------------------------------------------------------------------ */

const hex = (c: string) => `#${c}`;

export const renderReportPdf = (pages: Page[], out: Writable, info?: { title?: string }) => {
  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: false, info: { Title: info?.title || "Report", Author: "Elora Creative Art" } });
  doc.pipe(out);
  const logo = getLogoBuffer();

  for (const page of pages) {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(hex(page.bg));

    for (const op of page.ops) {
      switch (op.k) {
        case "rect": {
          doc.save();
          if (op.r) doc.roundedRect(op.x, op.y, op.w, op.h, op.r);
          else doc.rect(op.x, op.y, op.w, op.h);
          if (op.stroke) doc.lineWidth(op.lw || 1);
          if (op.fill && op.stroke) doc.fillAndStroke(hex(op.fill), hex(op.stroke));
          else if (op.fill) doc.fill(hex(op.fill));
          else if (op.stroke) doc.stroke(hex(op.stroke));
          doc.restore();
          break;
        }
        case "line":
          doc.save().moveTo(op.x1, op.y1).lineTo(op.x2, op.y2).lineWidth(op.lw).stroke(hex(op.color)).restore();
          break;
        case "dot":
          doc.save().circle(op.cx, op.cy, op.r).fill(hex(op.color)).restore();
          break;
        case "logo":
          doc.image(logo, op.x, op.y, { width: op.w, height: op.h });
          break;
        case "image": {
          if (op.img) {
            try {
              const b = containBox(op.img.width, op.img.height, op.x, op.y, op.w, op.h);
              doc.image(op.img.buffer, b.x, b.y, { width: b.w, height: b.h });
              break;
            } catch (e) {
              console.warn("[report] could not draw image", e);
            }
          }
          const size = 9;
          const cy = op.y + op.h / 2;
          doc.font("Helvetica-Oblique").fontSize(size).fillColor(hex(C.faint));
          const label = op.empty || "Photo unavailable";
          const tw = doc.widthOfString(label);
          doc.text(label, op.x + (op.w - tw) / 2, cy + BASELINE_FROM_CENTRE * size - HELVETICA_ASCENT * size, { lineBreak: false });
          break;
        }
        case "text": {
          const font = op.bold ? (op.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold") : op.italic ? "Helvetica-Oblique" : "Helvetica";
          doc.font(font).fontSize(op.size).fillColor(hex(op.color));
          const top = textBlockTop(op);
          op.lines.forEach((line, i) => {
            if (!line) return;
            const tw = doc.widthOfString(line);
            const x = op.align === "center" ? op.x + (op.w - tw) / 2 : op.align === "right" ? op.x + op.w - tw : op.x;
            const baseline = top + i * op.lh + op.lh / 2 + BASELINE_FROM_CENTRE * op.size;
            doc.text(line, x, baseline - HELVETICA_ASCENT * op.size, { lineBreak: false });
          });
          break;
        }
      }
    }
  }
  doc.end();
};

/* ------------------------------------------------------------------ */
/* PPTX                                                               */
/* ------------------------------------------------------------------ */

const IN = (pt: number) => pt / 72;

export const renderReportPptx = async (pages: Page[], info?: { title?: string }): Promise<Buffer> => {
  const PptxGenJS = require("pptxgenjs");
  const prs = new PptxGenJS();
  prs.defineLayout({ name: "A4_LANDSCAPE", width: IN(PAGE_W), height: IN(PAGE_H) });
  prs.layout = "A4_LANDSCAPE";
  prs.author = "Elora Creative Art";
  prs.company = "Elora Creative Art";
  prs.title = info?.title || "Report";
  const logo = getLogoPptData();
  const noLine = { type: "none" as const };

  for (const page of pages) {
    const slide = prs.addSlide();
    slide.background = { color: page.bg };

    for (const op of page.ops) {
      switch (op.k) {
        case "rect":
          slide.addShape(op.r ? prs.ShapeType.roundRect : prs.ShapeType.rect, {
            x: IN(op.x),
            y: IN(op.y),
            w: IN(op.w),
            h: IN(op.h),
            fill: op.fill ? { color: op.fill } : { type: "none" },
            line: op.stroke ? { color: op.stroke, width: op.lw || 1 } : noLine,
            ...(op.r ? { rectRadius: IN(op.r) } : {}),
          });
          break;
        case "line":
          slide.addShape(prs.ShapeType.line, { x: IN(op.x1), y: IN(op.y1), w: IN(op.x2 - op.x1), h: IN(op.y2 - op.y1), line: { color: op.color, width: op.lw } });
          break;
        case "dot":
          slide.addShape(prs.ShapeType.ellipse, { x: IN(op.cx - op.r), y: IN(op.cy - op.r), w: IN(op.r * 2), h: IN(op.r * 2), fill: { color: op.color }, line: noLine });
          break;
        case "logo":
          slide.addImage({ data: logo, x: IN(op.x), y: IN(op.y), w: IN(op.w), h: IN(op.h) });
          break;
        case "image": {
          if (op.img) {
            const b = containBox(op.img.width, op.img.height, op.x, op.y, op.w, op.h);
            slide.addImage({ data: toPptData(op.img), x: IN(b.x), y: IN(b.y), w: IN(b.w), h: IN(b.h) });
          } else {
            slide.addText(op.empty || "Photo unavailable", {
              x: IN(op.x), y: IN(op.y), w: IN(op.w), h: IN(op.h),
              fontFace: "Arial", fontSize: 9, italic: true, color: C.faint, align: "center", valign: "middle", margin: 0,
            });
          }
          break;
        }
        case "text": {
          const top = textBlockTop(op);
          op.lines.forEach((line, i) => {
            if (!line) return;
            // One text box per line, no inset and no wrapping, so PowerPoint can't reflow it.
            slide.addText(line, {
              x: IN(op.x),
              y: IN(top + i * op.lh),
              w: IN(op.w),
              h: IN(op.lh),
              fontFace: "Arial",
              fontSize: op.size,
              bold: !!op.bold,
              italic: !!op.italic,
              color: op.color,
              align: op.align,
              valign: "middle",
              margin: 0,
              wrap: false,
              fit: "none",
              paraSpaceBefore: 0,
              paraSpaceAfter: 0,
            });
          });
          break;
        }
      }
    }
  }
  return (await prs.write({ outputType: "nodebuffer" })) as Buffer;
};
