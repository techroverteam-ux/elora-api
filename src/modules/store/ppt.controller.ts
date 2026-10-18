import { Request, Response } from "express";
import Store from "./store.model";
import { prefetchReportImages, collectStoreImagePaths, withReportDeadline } from "../../utils/reportImages";
import { buildReportPages } from "../../utils/report/reportDesign";
import { renderReportPptx } from "../../utils/report/reportRender";

// The slide layout lives in utils/report/reportDesign.ts and is shared with the PDF,
// so a PPT and a PDF of the same store look the same.

const TITLE = { recce: "Recce Inspection Report", installation: "Installation Completion Report" } as const;

// ====== CONTROLLER: Generate Bulk PPT ======
export const generateBulkPPT = (req: Request, res: Response) => withReportDeadline(() => buildBulkPPT(req, res));

const buildBulkPPT = async (req: Request, res: Response) => {
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
    // Keep the order the stores were selected in.
    const order = new Map(storeIds.map((id: any, i: number) => [String(id), i]));
    const stores = [...found].sort((a: any, b: any) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

    // Fetch all photos (6 at a time) before building slides, same as the PDF.
    await prefetchReportImages(stores.flatMap((st: any) => collectStoreImagePaths(st)));

    const pages = await buildReportPages(stores, type);
    const buffer = await renderReportPptx(pages, { title: TITLE[type as "recce" | "installation"] });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    const filename =
      stores.length === 1
        ? `${type === "recce" ? "Recce" : "Installation"}_${stores[0].dealerCode || stores[0].storeName || stores[0].storeId}.pptx`
        : `Report_${type}_${stores.length}_Stores_${new Date().toISOString().split("T")[0]}.pptx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Bulk PPT Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error generating bulk PPT", error: error.message });
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
