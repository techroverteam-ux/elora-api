import { Request, Response } from "express";
import Store from "./store.model";
import { prefetchReportImages, collectStoreImagePaths, withReportDeadline } from "../../utils/reportImages";
import { buildReportPages } from "../../utils/report/reportDesign";
import { renderReportPdf } from "../../utils/report/reportRender";

// The page layout lives in utils/report/reportDesign.ts and is shared with the PPT,
// so a PDF and a PPT of the same store look the same.

type ReportType = "recce" | "installation";
const TITLE: Record<ReportType, string> = { recce: "Recce Inspection Report", installation: "Installation Completion Report" };

const safeName = (s: unknown) => String(s ?? "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Store";

/** Builds every page first (photos already fetched), then streams the PDF, so a failure returns JSON, not half a file. */
const sendPdf = async (res: Response, stores: any[], type: ReportType, filename: string) => {
  await prefetchReportImages(stores.flatMap((st: any) => collectStoreImagePaths(st)));
  const pages = await buildReportPages(stores, type);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  renderReportPdf(pages, res, { title: TITLE[type] });
};

// ====== RECCE PDF ======
export const generateReccePDF = (req: Request, res: Response) => withReportDeadline(() => generateSinglePDF(req, res, "recce"));

// ====== INSTALLATION PDF ======
export const generateInstallationPDF = (req: Request, res: Response) => withReportDeadline(() => generateSinglePDF(req, res, "installation"));

const generateSinglePDF = async (req: Request, res: Response, type: ReportType) => {
  try {
    const id = String(req.params.id);
    const store: any = await Store.findById(id);
    if (!store || !store[type]) {
      return res.status(404).json({ message: `Store or ${type === "recce" ? "Recce" : "Installation"} data not found` });
    }
    await sendPdf(res, [store], type, `${type.toUpperCase()}_${safeName(store.storeName)}_${safeName(store.storeId)}.pdf`);
  } catch (error: any) {
    console.error("PDF Gen Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating PDF" });
  }
};

// ====== BULK PDF ======
export const generateBulkPDF = (req: Request, res: Response) => withReportDeadline(() => generateBulkPDFImpl(req, res));

const generateBulkPDFImpl = async (req: Request, res: Response) => {
  try {
    const { storeIds, type } = req.body;
    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ message: "No stores selected" });
    }
    if (type !== "recce" && type !== "installation") {
      return res.status(400).json({ message: "Invalid type" });
    }

    const found = await Store.find({ _id: { $in: storeIds } });
    if (found.length === 0) {
      return res.status(404).json({ message: "No stores found" });
    }
    const order = new Map(storeIds.map((id: any, i: number) => [String(id), i]));
    const stores = [...found].sort((a: any, b: any) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "_");
    await sendPdf(res, stores, type, `${type === "recce" ? "Recce" : "Installation"}_Report_${stores.length}_Stores_${date}.pdf`);
  } catch (error: any) {
    console.error("Bulk PDF Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Error generating bulk PDF" });
  }
};
