import { Request, Response } from "express";
import Store from "./store.model";

export const generateBulkPPT = async (req: Request, res: Response) => {
  console.log("=== BULK PPT ENDPOINT HIT ===");
  try {
    console.log("Request body:", req.body);
    const { storeIds, type } = req.body;
    
    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      console.log("No storeIds provided");
      return res.status(400).json({ message: "No stores selected" });
    }
    
    console.log("Fetching stores...");
    const stores = await Store.find({ _id: { $in: storeIds } });
    console.log(`Found ${stores.length} stores`);
    
    if (stores.length === 0) {
      return res.status(404).json({ message: "No stores found" });
    }

    console.log("Loading pptxgenjs...");
    const PptxGenJS = require('pptxgenjs');
    console.log("Creating presentation...");
    const prs = new PptxGenJS();

    console.log("Adding title slide...");
    const slide1 = prs.addSlide();
    slide1.addText("Test PPT", { x: 1, y: 1, w: 8, h: 1, fontSize: 44, bold: true });

    console.log("Adding store slides...");
    stores.forEach((store, idx) => {
      const slide = prs.addSlide();
      slide.addText(`Store ${idx + 1}: ${store.storeName}`, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24 });
    });

    console.log("Writing to buffer...");
    const buffer = await prs.write('nodebuffer');
    console.log(`Buffer size: ${buffer.length}`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="report.pptx"`);
    res.send(buffer);
    console.log("PPT sent successfully");
  } catch (error: any) {
    console.error("ERROR:", error.message);
    console.error("STACK:", error.stack);
    res.status(500).json({ message: "Error generating bulk PPT", error: error.message });
  }
};
