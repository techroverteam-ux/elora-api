import { Request, Response } from "express";
import Store, { StoreStatus } from "./store.model";
import * as XLSX from "xlsx";
import fs from "fs";
import PptxGenJS from "pptxgenjs";
import path from "path";
import { Row, Cell } from "exceljs";
import uploadService from "../../utils/uploadService";

// Helper: fuzzy search for column headers
const findKey = (row: any, keywords: string[]): string | undefined => {
  const keys = Object.keys(row);
  return keys.find((k) =>
    keywords.every((kw) =>
      k
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .includes(kw),
    ),
  );
};

export const uploadStoresBulk = async (req: Request, res: Response) => {
  try {
    // --- FIX: SELF-HEALING DATABASE ---
    // This command deletes the old "Unique" rule for storeCode that is causing the crash.
    // We catch errors just in case the index is already gone.
    await Store.collection.dropIndex("storeCode_1").catch(() => {
      // console.log("Index already dropped or doesn't exist");
    });
    // ----------------------------------

    const files =
      (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    let totalProcessed = 0;
    let totalSuccess = 0;
    let allErrors: any[] = [];
    const toInsert: any[] = [];

    // 1. Get existing codes
    const existingCodes = new Set(
      (await Store.find().select("dealerCode")).map((s) => s.dealerCode),
    );

    for (const file of files) {
      try {
        // Use buffer instead of file path for memory storage
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(sheet);

        totalProcessed += rawData.length;

        for (const [index, row] of rawData.entries()) {
          const rowNum = index + 2;

          // A. Dealer Code Check
          const dCodeRaw = row["Dealer Code"];

          if (!dCodeRaw) {
            // Skip empty rows (like footer totals) silently or with a minor note
            allErrors.push({
              file: file.originalname,
              row: rowNum,
              error: "Skipped: 'Dealer Code' is missing/empty",
            });
            continue;
          }

          const dCode = String(dCodeRaw).trim();

          // B. Duplicates
          if (existingCodes.has(dCode)) {
            allErrors.push({
              file: file.originalname,
              row: rowNum,
              error: `Duplicate in DB: ${dCode}`,
            });
            continue;
          }
          if (toInsert.find((i) => i.dealerCode === dCode)) {
            allErrors.push({
              file: file.originalname,
              row: rowNum,
              error: `Duplicate in File: ${dCode}`,
            });
            continue;
          }

          // C. Build Object
          const city = row["City"] || "";
          const district = row["District"] || "";
          const dealerCode = dCode;

          // Generate storeId manually since insertMany doesn't trigger pre-save hooks
          const cityPrefix = city.trim().substring(0, 3).toUpperCase();
          const districtPrefix = district.trim().substring(0, 3).toUpperCase();
          const storeId = `${cityPrefix}${districtPrefix}${dealerCode.toUpperCase()}`;

          const newStore = {
            projectID: row["Sr. No."] ? String(row["Sr. No."]) : "",
            dealerCode: dCode,
            storeId: storeId, // Add generated storeId
            // Now this can repeat "ELORA CREATIVE ART" without crashing!
            storeCode: row["Vendor Code & Name"] || "",
            storeName: row["Dealer's Name"] || "Unknown Name",

            location: {
              city: city,
              area: district,
              district: district, // NEW: Added district for storeId generation
              address: row["Dealer's Address"] || "",
            },
            contact: {
              personName: "",
              mobile: "",
            },
            specs: {
              boardSize: `${row["Width (Ft.)"] || "?"} x ${row["Height (Ft.)"] || "?"}`,
              type: row["Dealer Board Type"] || "",
            },
            currentStatus: StoreStatus.UPLOADED,
          };

          toInsert.push(newStore);
        }
      } catch (err: any) {
        allErrors.push({
          file: file.originalname,
          error: "Parsing Error: " + err.message,
        });
      }
      // No need to delete files with memory storage
    }

    // 3. Batch Insert
    if (toInsert.length > 0) {
      try {
        await Store.insertMany(toInsert, { ordered: false });
        totalSuccess = toInsert.length;
      } catch (err: any) {
        if (err.name === "ValidationError") {
          Object.keys(err.errors).forEach((field) => {
            allErrors.push({
              error: `Validation Error: ${err.errors[field].message}`,
            });
          });
        } else if (err.writeErrors) {
          totalSuccess = toInsert.length - err.writeErrors.length;
          err.writeErrors.forEach((e: any) => {
            if (e.code === 11000) {
              // Check WHICH field is duplicate
              const field = Object.keys(e.keyValue)[0];
              allErrors.push({
                error: `Duplicate ${field}: ${e.keyValue[field]}`,
              });
            } else {
              allErrors.push({ error: `DB Write Error: ${e.errmsg}` });
            }
          });
        } else {
          allErrors.push({ error: `Critical Error: ${err.message}` });
        }
      }
    }

    res.status(201).json({
      message: "Bulk upload processed",
      totalProcessed,
      successCount: totalSuccess,
      errorCount: allErrors.length,
      errors: allErrors,
    });
  } catch (error: any) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const createStore = async (req: Request, res: Response) => {
  try {
    const {
      dealerCode,
      storeName,
      vendorCode,
      location,
      commercials,
      costDetails,
      specs,
    } = req.body;

    if (!dealerCode) {
      return res.status(400).json({ message: "Dealer Code is required" });
    }

    const store = new Store({
      dealerCode,
      storeName,
      vendorCode,
      location,
      commercials,
      costDetails,
      specs,
      currentStatus: StoreStatus.MANUALLY_ADDED,
    });

    await store.save();

    res.status(201).json({
      message: "Store created successfully",
      store,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "A store with this Dealer Code already exists" });
    }

    res.status(500).json({
      message: "Failed to create store",
      error: error.message,
    });
  }
};

export const getAllStores = async (req: Request | any, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, search, city } = req.query;

    let query: any = {};

    // 1. Role-based Access Control
    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.some((r: any) => r.code === "SUPER_ADMIN");
    const isAdmin = userRoles.some((r: any) => r.code === "ADMIN");

    if (!isSuperAdmin && !isAdmin) {
      query.$or = [
        { "workflow.recceAssignedTo": req.user._id },
        { "workflow.installationAssignedTo": req.user._id },
      ];
    }

    // 2. Status Filter
    if (status && status !== "ALL") {
      // Handle comma-separated statuses
      if (status.includes(",")) {
        const statuses = status.split(",").map((s: string) => s.trim());
        query.currentStatus = { $in: statuses };
      } else {
        query.currentStatus = status;
      }
    }

    // 3. City Filter
    if (city) {
      query["location.city"] = city;
    }

    // 4. Search (Store Name, Dealer Code, City)
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { storeName: searchRegex },
            { dealerCode: searchRegex },
            { "location.city": searchRegex },
            { "location.area": searchRegex },
          ],
        },
      ];
    }

    const total = await Store.countDocuments(query);
    const stores = await Store.find(query)
      .populate("workflow.recceAssignedTo", "name email")
      .populate("workflow.recceAssignedBy", "name email")
      .populate("workflow.installationAssignedTo", "name email")
      .populate("workflow.installationAssignedBy", "name email")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      stores,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("Get All Stores Error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch stores", error: error.message });
  }
};

export const getStoreById = async (req: Request, res: Response) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate("workflow.recceAssignedTo", "name")
      .populate("workflow.installationAssignedTo", "name");

    if (!store) return res.status(404).json({ message: "Store not found" });
    res.status(200).json({ store });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch store" });
  }
};

export const updateStore = async (req: Request, res: Response) => {
  try {
    const store = await Store.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!store) return res.status(404).json({ message: "Store not found" });
    res.status(200).json({ store });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update store" });
  }
};

export const deleteStore = async (req: Request, res: Response) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ message: "Store not found" });
    res.status(200).json({ message: "Store deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to delete store" });
  }
};

export const assignStoresBulk = async (req: Request | any, res: Response) => {
  try {
    const { storeIds, userId, stage } = req.body;
    // stage must be 'RECCE' or 'INSTALLATION'

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ message: "No stores selected" });
    }
    if (!userId) {
      return res.status(400).json({ message: "No user selected" });
    }

    const assignedBy = req.user._id; // Track who assigned the task
    let updateData = {};

    // LOGIC: Handle Recce vs Installation Assignment
    if (stage === "RECCE") {
      updateData = {
        "workflow.recceAssignedTo": userId,
        "workflow.recceAssignedBy": assignedBy,
        "workflow.recceAssignedDate": new Date(),
        currentStatus: StoreStatus.RECCE_ASSIGNED,
      };
    } else if (stage === "INSTALLATION") {
      updateData = {
        "workflow.installationAssignedTo": userId,
        "workflow.installationAssignedBy": assignedBy,
        "workflow.installationAssignedDate": new Date(),
        currentStatus: StoreStatus.INSTALLATION_ASSIGNED,
      };
    } else {
      return res.status(400).json({ message: "Invalid assignment stage" });
    }

    // Execute Bulk Update
    const result = await Store.updateMany(
      { _id: { $in: storeIds } },
      { $set: updateData },
    );

    res.status(200).json({
      message: `Successfully assigned ${result.modifiedCount} stores to user.`,
      result,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Assignment failed", error: error.message });
  }
};

export const unassignStoresBulk = async (req: Request | any, res: Response) => {
  try {
    const { storeIds, stage } = req.body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ message: "No stores selected" });
    }

    let updateData = {};

    if (stage === "RECCE") {
      updateData = {
        "workflow.recceAssignedTo": null,
        "workflow.recceAssignedBy": null,
        "workflow.recceAssignedDate": null,
        currentStatus: StoreStatus.UPLOADED,
      };
    } else if (stage === "INSTALLATION") {
      updateData = {
        "workflow.installationAssignedTo": null,
        "workflow.installationAssignedBy": null,
        "workflow.installationAssignedDate": null,
        currentStatus: StoreStatus.RECCE_APPROVED,
      };
    } else {
      return res.status(400).json({ message: "Invalid stage" });
    }

    const result = await Store.updateMany(
      { _id: { $in: storeIds } },
      { $set: updateData },
    );

    res.status(200).json({
      message: `Successfully unassigned ${result.modifiedCount} stores.`,
      result,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Unassignment failed", error: error.message });
  }
};

export const submitRecce = async (req: Request | any, res: Response) => {
  try {
    const { id } = req.params;
    const { width, height, notes, unit } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    // Generate storeId if missing
    if (!store.storeId) {
      if (
        store.location?.city &&
        store.location?.district &&
        store.dealerCode
      ) {
        const cityPrefix = store.location.city
          .trim()
          .substring(0, 3)
          .toUpperCase();
        const districtPrefix = store.location.district
          .trim()
          .substring(0, 3)
          .toUpperCase();
        const storeId = `${cityPrefix}${districtPrefix}${store.dealerCode.toUpperCase()}`;
        store.storeId = storeId;
        await store.save();
      } else {
        return res.status(400).json({
          message:
            "Cannot generate Store ID. Missing city or district information.",
        });
      }
    }

    const userName = req.user?.name || "Unknown";

    // Upload images to Google Drive
    const driveLinks: { front?: string; side?: string; closeUp?: string } = {};

    if (files.front) {
      driveLinks.front = await uploadService.uploadFile(
        files.front[0].buffer,
        "front.jpg",
        files.front[0].mimetype,
        store.storeId,
        "Recce",
        userName,
      );
    }
    if (files.side) {
      driveLinks.side = await uploadService.uploadFile(
        files.side[0].buffer,
        "side.jpg",
        files.side[0].mimetype,
        store.storeId,
        "Recce",
        userName,
      );
    }
    if (files.closeUp) {
      driveLinks.closeUp = await uploadService.uploadFile(
        files.closeUp[0].buffer,
        "closeup.jpg",
        files.closeUp[0].mimetype,
        store.storeId,
        "Recce",
        userName,
      );
    }

    // Prepare Recce Data
    const recceUpdate: any = {
      "recce.submittedDate": new Date(),
      "recce.notes": notes,
      "recce.sizes": {
        width: Number(width),
        height: Number(height),
        unit: unit || "ft",
      },
      "recce.submittedBy": userName,
      "recce.photos": driveLinks,
      currentStatus: StoreStatus.RECCE_SUBMITTED,
    };

    const updatedStore = await Store.findByIdAndUpdate(
      id,
      { $set: recceUpdate },
      { new: true },
    );

    res.status(200).json({
      message: "Recce submitted successfully",
      store: updatedStore,
    });
  } catch (error: any) {
    console.error("Recce Submit Error:", error);
    res
      .status(500)
      .json({ message: "Failed to submit recce", error: error.message });
  }
};

// --- NEW UPDATED: Generate Recce PPT ---
export const generateReccePPT = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store || !store.recce) {
      return res.status(404).json({ message: "Store or Recce data not found" });
    }

    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";
    pres.title = `Recce Report - ${store.storeName}`;

    const colors = {
      primary: "EAB308",
      secondary: "000000",
      text: "1F2937",
      lightBg: "FEF3C7",
      white: "FFFFFF",
      borderDark: "B45309",
    };

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // COVER SLIDE
    const coverSlide = pres.addSlide();
    coverSlide.background = { fill: "FFFEF5" };
    coverSlide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { type: "solid", color: "FFFEF5", transparency: 10 },
    });

    coverSlide.addText(
      "WE DON'T JUST PRINT.\nWE INSTALL YOUR BRAND\nINTO THE REAL WORLD.",
      {
        x: 0.5,
        y: 0.5,
        w: 5,
        h: 2,
        fontSize: 32,
        bold: true,
        color: colors.primary,
        align: "left",
        valign: "top",
      },
    );

    if (fs.existsSync(logoPath)) {
      coverSlide.addImage({ path: logoPath, x: 3.3, y: 3, w: 4.2, h: 1.26 });
    } else {
      console.log("Logo not found at:", logoPath);
    }

    coverSlide.addText(
      "We help businesses stand out with custom branding,\nhigh-quality banner printing, and professional on-site installation.",
      {
        x: 6.5,
        y: 5.8,
        w: 3,
        h: 1.2,
        fontSize: 16,
        color: colors.text,
        align: "right",
        valign: "bottom",
      },
    );

    // DATA SLIDE
    const slide = pres.addSlide();
    slide.background = { fill: "FFFEF5" };
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { type: "solid", color: "FEF3C7", transparency: 50 },
    });

    if (fs.existsSync(logoPath)) {
      slide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
    }

    slide.addShape("rect", {
      x: 0.2,
      y: 0.8,
      w: 9.6,
      h: 0.7,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });
    slide.addText("RECCE INSPECTION REPORT", {
      x: 0.2,
      y: 0.8,
      w: 9.6,
      h: 0.7,
      fontSize: 32,
      bold: true,
      color: colors.primary,
      align: "center",
      valign: "middle",
    });

    slide.addShape("rect", {
      x: 0.2,
      y: 1.7,
      w: 9.6,
      h: 2.4,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });

    const detailsData = [
      [
        {
          text: "Dealer Code",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.dealerCode || "",
        {
          text: "Store Name",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.storeName || "",
      ],
      [
        {
          text: "City",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.location.city || "",
        {
          text: "State",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.location.state || "",
      ],
      [
        {
          text: "Address",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        { text: store.location.address || "N/A", options: { colspan: 3 } },
      ],
      [
        {
          text: "Board Size",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        `${store.recce.sizes?.width || 0} x ${store.recce.sizes?.height || 0} ft`,
        {
          text: "Recce Date",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.recce.submittedDate
          ? new Date(store.recce.submittedDate).toLocaleDateString()
          : "N/A",
      ],
      [
        {
          text: "Notes",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        { text: store.recce.notes || "None", options: { colspan: 3 } },
      ],
    ];

    slide.addTable(detailsData as any, {
      x: 0.2,
      y: 1.7,
      w: 9.6,
      h: 2.4,
      colW: [2.1, 2.5, 2.1, 2.9],
      fontSize: 14,
      border: { pt: 2, color: colors.borderDark },
      valign: "middle",
      color: colors.text,
    });

    slide.addShape("rect", {
      x: 0.2,
      y: 4.3,
      w: 9.6,
      h: 0.5,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });
    slide.addText("SITE INSPECTION PHOTOS", {
      x: 0.2,
      y: 4.3,
      w: 9.6,
      h: 0.5,
      fontSize: 18,
      bold: true,
      color: colors.secondary,
      align: "center",
      valign: "middle",
    });

    const addImage = (
      relativePath: string | undefined,
      label: string,
      x: number,
      y: number,
    ) => {
      slide.addShape("rect", {
        x,
        y,
        w: 3,
        h: 2.5,
        line: { color: colors.borderDark, width: 2 },
        fill: { color: colors.white },
      });
      if (relativePath) {
        try {
          const absolutePath = path.join(process.cwd(), relativePath);
          if (fs.existsSync(absolutePath)) {
            slide.addImage({
              path: absolutePath,
              x: x + 0.05,
              y: y + 0.05,
              w: 2.9,
              h: 2.0,
            });
          } else {
            slide.addText("Image Not Found", {
              x,
              y: y + 1,
              w: 3,
              fontSize: 10,
              align: "center",
              color: "999999",
            });
          }
        } catch (err) {
          slide.addText("Error Loading Image", {
            x,
            y: y + 1,
            w: 3,
            fontSize: 10,
            align: "center",
            color: "FF0000",
          });
        }
      } else {
        slide.addText(`No ${label}`, {
          x,
          y: y + 1,
          w: 3,
          fontSize: 10,
          align: "center",
          color: "999999",
        });
      }
      slide.addShape("rect", {
        x,
        y: y + 2.05,
        w: 3,
        h: 0.45,
        fill: { color: colors.primary },
        line: { color: colors.borderDark, width: 2 },
      });
      slide.addText(label, {
        x,
        y: y + 2.05,
        w: 3,
        h: 0.45,
        fontSize: 12,
        bold: true,
        align: "center",
        valign: "middle",
        color: colors.white,
      });
    };

    addImage(store.recce.photos?.front, "FRONT VIEW", 0.5, 4.9);
    addImage(store.recce.photos?.side, "SIDE VIEW", 3.7, 4.9);
    addImage(store.recce.photos?.closeUp, "CLOSE UP VIEW", 6.9, 4.9);

    const buffer = await pres.write({ outputType: "nodebuffer" });
    res.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="Recce_${store.dealerCode}.pptx"`,
    });
    res.end(buffer);
  } catch (error: any) {
    console.error("PPT Gen Error:", error);
    if (!res.headersSent)
      res.status(500).json({ message: "Error generating PPT" });
  }
};

// --- NEW: Review Recce (Approve/Reject) ---
export const reviewRecce = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body; // Expecting status: "APPROVED" or "REJECTED"

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Invalid status. Use APPROVED or REJECTED." });
    }

    const newStatus =
      status === "APPROVED"
        ? StoreStatus.RECCE_APPROVED
        : StoreStatus.RECCE_REJECTED;

    const store = await Store.findByIdAndUpdate(
      id,
      {
        currentStatus: newStatus,
        // Optional: Save admin remarks if rejected so staff knows what to fix
        "recce.notes": remarks
          ? `[Admin]: ${remarks} | ${new Date().toLocaleDateString()}`
          : undefined,
      },
      { new: true },
    );

    if (!store) return res.status(404).json({ message: "Store not found" });

    res.status(200).json({
      message: `Recce ${status.toLowerCase()} successfully`,
      store,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Review failed", error: error.message });
  }
};

// --- UPDATED: Submit Installation Data (2 Images) ---
export const submitInstallation = async (req: Request | any, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    // Generate storeId if missing
    if (!store.storeId) {
      if (
        store.location?.city &&
        store.location?.district &&
        store.dealerCode
      ) {
        const cityPrefix = store.location.city
          .trim()
          .substring(0, 3)
          .toUpperCase();
        const districtPrefix = store.location.district
          .trim()
          .substring(0, 3)
          .toUpperCase();
        const storeId = `${cityPrefix}${districtPrefix}${store.dealerCode.toUpperCase()}`;
        store.storeId = storeId;
        await store.save();
      } else {
        return res.status(400).json({
          message:
            "Cannot generate Store ID. Missing city or district information.",
        });
      }
    }

    const userName = req.user?.name || "Unknown";

    // Upload images to Google Drive
    const driveLinks: { after1?: string; after2?: string } = {};

    if (files.after1) {
      driveLinks.after1 = await uploadService.uploadFile(
        files.after1[0].buffer,
        "after1.jpg",
        files.after1[0].mimetype,
        store.storeId,
        "Installation",
        userName,
      );
    }
    if (files.after2) {
      driveLinks.after2 = await uploadService.uploadFile(
        files.after2[0].buffer,
        "after2.jpg",
        files.after2[0].mimetype,
        store.storeId,
        "Installation",
        userName,
      );
    }

    const installUpdate: any = {
      "installation.submittedDate": new Date(),
      "installation.submittedBy": userName,
      "installation.photos": driveLinks,
      currentStatus: StoreStatus.INSTALLATION_SUBMITTED,
    };

    await Store.findByIdAndUpdate(id, { $set: installUpdate });

    res.status(200).json({ message: "Installation submitted successfully" });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Submission failed", error: error.message });
  }
};

// --- UPDATED: Generate Installation PPT (Before & After Comparison) ---
export const generateInstallationPPT = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store || !store.installation) {
      return res
        .status(404)
        .json({ message: "Store or Installation data not found" });
    }

    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";
    pres.title = `Installation Report - ${store.storeName}`;

    const colors = {
      primary: "EAB308",
      secondary: "000000",
      success: "22C55E",
      text: "1F2937",
      lightBg: "FEF3C7",
      white: "FFFFFF",
      borderDark: "B45309",
    };

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // COVER SLIDE
    const coverSlide = pres.addSlide();
    coverSlide.background = { fill: "FFFEF5" };
    coverSlide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { type: "solid", color: "FFFEF5", transparency: 10 },
    });

    coverSlide.addText(
      "WE DON'T JUST PRINT.\nWE INSTALL YOUR BRAND\nINTO THE REAL WORLD.",
      {
        x: 0.5,
        y: 0.5,
        w: 5,
        h: 2,
        fontSize: 32,
        bold: true,
        color: colors.primary,
        align: "left",
        valign: "top",
      },
    );

    if (fs.existsSync(logoPath)) {
      coverSlide.addImage({ path: logoPath, x: 3.3, y: 3, w: 4.2, h: 1.26 });
    }

    coverSlide.addText(
      "We help businesses stand out with custom branding,\nhigh-quality banner printing, and professional on-site installation.",
      {
        x: 6.5,
        y: 5.8,
        w: 3,
        h: 1.2,
        fontSize: 16,
        color: colors.text,
        align: "right",
        valign: "bottom",
      },
    );

    // DATA SLIDE
    const slide = pres.addSlide();
    slide.background = { fill: "FFFEF5" };
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { type: "solid", color: "FEF3C7", transparency: 50 },
    });

    if (fs.existsSync(logoPath)) {
      slide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
    }

    slide.addShape("rect", {
      x: 0.2,
      y: 0.8,
      w: 9.6,
      h: 0.7,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });
    slide.addText("INSTALLATION COMPLETION REPORT", {
      x: 0.2,
      y: 0.8,
      w: 9.6,
      h: 0.7,
      fontSize: 32,
      bold: true,
      color: colors.success,
      align: "center",
      valign: "middle",
    });

    slide.addShape("rect", {
      x: 0.2,
      y: 1.7,
      w: 9.6,
      h: 2.4,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });

    const detailsData = [
      [
        {
          text: "Dealer Code",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.dealerCode || "",
        {
          text: "Store Name",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.storeName || "",
      ],
      [
        {
          text: "City",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.location.city || "",
        {
          text: "State",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.location.state || "",
      ],
      [
        {
          text: "Address",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        { text: store.location.address || "N/A", options: { colspan: 3 } },
      ],
      [
        {
          text: "Board Size",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        `${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`,
        {
          text: "Completion Date",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        store.installation.submittedDate
          ? new Date(store.installation.submittedDate).toLocaleDateString()
          : "N/A",
      ],
      [
        {
          text: "Status",
          options: { bold: true, fill: { color: colors.lightBg } },
        },
        {
          text: "✓ COMPLETED",
          options: { colspan: 3, bold: true, color: colors.success },
        },
      ],
    ];

    slide.addTable(detailsData as any, {
      x: 0.2,
      y: 1.7,
      w: 9.6,
      h: 2.4,
      colW: [2.1, 2.5, 2.1, 2.9],
      fontSize: 14,
      border: { pt: 2, color: colors.borderDark },
      valign: "middle",
      color: colors.text,
    });

    slide.addShape("rect", {
      x: 0.2,
      y: 4.3,
      w: 9.6,
      h: 0.5,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });
    slide.addText("BEFORE & AFTER COMPARISON", {
      x: 0.2,
      y: 4.3,
      w: 9.6,
      h: 0.5,
      fontSize: 18,
      bold: true,
      color: colors.secondary,
      align: "center",
      valign: "middle",
    });

    const addImage = (
      relativePath: string | undefined,
      label: string,
      x: number,
      y: number,
      bgColor: string,
    ) => {
      slide.addShape("rect", {
        x,
        y,
        w: 3,
        h: 2.5,
        line: { color: colors.borderDark, width: 2 },
        fill: { color: colors.white },
      });
      if (relativePath) {
        try {
          const absolutePath = path.join(process.cwd(), relativePath);
          if (fs.existsSync(absolutePath)) {
            slide.addImage({
              path: absolutePath,
              x: x + 0.05,
              y: y + 0.05,
              w: 2.9,
              h: 2.0,
            });
          } else {
            slide.addText("Image Not Found", {
              x,
              y: y + 1,
              w: 3,
              fontSize: 10,
              align: "center",
              color: "999999",
            });
          }
        } catch (err) {
          slide.addText("Error Loading Image", {
            x,
            y: y + 1,
            w: 3,
            fontSize: 10,
            align: "center",
            color: "FF0000",
          });
        }
      } else {
        slide.addText(`No ${label}`, {
          x,
          y: y + 1,
          w: 3,
          fontSize: 10,
          align: "center",
          color: "999999",
        });
      }
      slide.addShape("rect", {
        x,
        y: y + 2.05,
        w: 3,
        h: 0.45,
        fill: { color: bgColor },
        line: { color: colors.borderDark, width: 2 },
      });
      slide.addText(label, {
        x,
        y: y + 2.05,
        w: 3,
        h: 0.45,
        fontSize: 12,
        bold: true,
        align: "center",
        valign: "middle",
        color: colors.white,
      });
    };

    addImage(store.recce?.photos?.front, "BEFORE", 0.5, 4.9, "EF4444");
    addImage(
      store.installation.photos?.after1,
      "AFTER - VIEW 1",
      3.7,
      4.9,
      colors.success,
    );
    addImage(
      store.installation.photos?.after2,
      "AFTER - VIEW 2",
      6.9,
      4.9,
      colors.success,
    );

    const buffer = await pres.write({ outputType: "nodebuffer" });
    res.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="Installation_${store.dealerCode}.pptx"`,
    });
    res.end(buffer);
  } catch (error: any) {
    console.error("PPT Gen Error:", error);
    if (!res.headersSent)
      res.status(500).json({ message: "Error generating PPT" });
  }
};

// --- NEW: Bulk PPT Generation (Single PPT with Multiple Slides) ---
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

    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE";
    pres.title = `${type === "recce" ? "Recce" : "Installation"} Report - ${stores.length} Stores`;
    pres.author = "Elora System";
    pres.subject = `${type === "recce" ? "Recce Inspection" : "Installation Completion"} Report`;

    const colors = {
      primary: "EAB308",
      secondary: "000000",
      success: "22C55E",
      text: "1F2937",
      lightBg: "FEF3C7",
      white: "FFFFFF",
      borderDark: "B45309",
    };

    const logoPath = path.join(process.cwd(), "public", "logo.png");

    // COVER SLIDE
    const coverSlide = pres.addSlide();
    coverSlide.background = { fill: "FFFEF5" };
    coverSlide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { type: "solid", color: "FFFEF5", transparency: 10 },
    });

    coverSlide.addText(
      "WE DON'T JUST PRINT.\nWE INSTALL YOUR BRAND\nINTO THE REAL WORLD.",
      {
        x: 0.5,
        y: 0.5,
        w: 5,
        h: 2,
        fontSize: 32,
        bold: true,
        color: colors.primary,
        align: "left",
        valign: "top",
      },
    );

    if (fs.existsSync(logoPath)) {
      coverSlide.addImage({ path: logoPath, x: 3.3, y: 3, w: 4.2, h: 1.26 });
    }

    coverSlide.addText(
      "We help businesses stand out with custom branding,\nhigh-quality banner printing, and professional on-site installation.",
      {
        x: 6.5,
        y: 5.8,
        w: 3,
        h: 1.2,
        fontSize: 16,
        color: colors.text,
        align: "right",
        valign: "bottom",
      },
    );

    for (const store of stores) {
      if (type === "recce" && !store.recce) continue;
      if (type === "installation" && !store.installation) continue;

      const slide = pres.addSlide();
      slide.background = { fill: "FFFEF5" };
      slide.addShape("rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: "100%",
        fill: { type: "solid", color: "FEF3C7", transparency: 50 },
      });

      if (fs.existsSync(logoPath)) {
        slide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
      }

      slide.addShape("rect", {
        x: 0.2,
        y: 0.8,
        w: 9.6,
        h: 0.7,
        line: { color: colors.borderDark, width: 2 },
        fill: { color: colors.white },
      });
      slide.addText(
        type === "recce"
          ? "RECCE INSPECTION REPORT"
          : "INSTALLATION COMPLETION REPORT",
        {
          x: 0.2,
          y: 0.8,
          w: 9.6,
          h: 0.7,
          fontSize: 32,
          bold: true,
          color: type === "recce" ? colors.primary : colors.success,
          align: "center",
          valign: "middle",
        },
      );

      slide.addShape("rect", {
        x: 0.2,
        y: 1.7,
        w: 9.6,
        h: 2.4,
        line: { color: colors.borderDark, width: 2 },
        fill: { color: colors.white },
      });

      const detailsData =
        type === "recce"
          ? [
              [
                {
                  text: "Dealer Code",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.dealerCode || "",
                {
                  text: "Store Name",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.storeName || "",
              ],
              [
                {
                  text: "City",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.location.city || "",
                {
                  text: "State",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.location.state || "",
              ],
              [
                {
                  text: "Address",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                {
                  text: store.location.address || "N/A",
                  options: { colspan: 3 },
                },
              ],
              [
                {
                  text: "Board Size",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                `${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`,
                {
                  text: "Recce Date",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.recce?.submittedDate
                  ? new Date(store.recce.submittedDate).toLocaleDateString()
                  : "N/A",
              ],
              [
                {
                  text: "Notes",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                { text: store.recce?.notes || "None", options: { colspan: 3 } },
              ],
            ]
          : [
              [
                {
                  text: "Dealer Code",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.dealerCode || "",
                {
                  text: "Store Name",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.storeName || "",
              ],
              [
                {
                  text: "City",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.location.city || "",
                {
                  text: "State",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.location.state || "",
              ],
              [
                {
                  text: "Address",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                {
                  text: store.location.address || "N/A",
                  options: { colspan: 3 },
                },
              ],
              [
                {
                  text: "Board Size",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                `${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`,
                {
                  text: "Completion Date",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                store.installation?.submittedDate
                  ? new Date(
                      store.installation.submittedDate,
                    ).toLocaleDateString()
                  : "N/A",
              ],
              [
                {
                  text: "Status",
                  options: { bold: true, fill: { color: colors.lightBg } },
                },
                {
                  text: "✓ COMPLETED",
                  options: { colspan: 3, bold: true, color: colors.success },
                },
              ],
            ];

      slide.addTable(detailsData as any, {
        x: 0.2,
        y: 1.7,
        w: 9.6,
        h: 2.4,
        colW: [2.1, 2.5, 2.1, 2.9],
        fontSize: 14,
        border: { pt: 2, color: colors.borderDark },
        valign: "middle",
        color: colors.text,
      });

      slide.addShape("rect", {
        x: 0.2,
        y: 4.3,
        w: 9.6,
        h: 0.5,
        line: { color: colors.borderDark, width: 2 },
        fill: { color: colors.white },
      });
      slide.addText(
        type === "recce"
          ? "SITE INSPECTION PHOTOS"
          : "BEFORE & AFTER COMPARISON",
        {
          x: 0.2,
          y: 4.3,
          w: 9.6,
          h: 0.5,
          fontSize: 18,
          bold: true,
          color: colors.secondary,
          align: "center",
          valign: "middle",
        },
      );

      const addImage = (
        relativePath: string | undefined,
        label: string,
        x: number,
        y: number,
        bgColor: string,
      ) => {
        slide.addShape("rect", {
          x,
          y,
          w: 3,
          h: 2.5,
          line: { color: colors.borderDark, width: 2 },
          fill: { color: colors.white },
        });
        if (relativePath) {
          try {
            const absolutePath = path.join(process.cwd(), relativePath);
            if (fs.existsSync(absolutePath)) {
              slide.addImage({
                path: absolutePath,
                x: x + 0.05,
                y: y + 0.05,
                w: 2.9,
                h: 2.0,
              });
            }
          } catch (err) {}
        }
        slide.addShape("rect", {
          x,
          y: y + 2.05,
          w: 3,
          h: 0.45,
          fill: { color: bgColor },
          line: { color: colors.borderDark, width: 2 },
        });
        slide.addText(label, {
          x,
          y: y + 2.05,
          w: 3,
          h: 0.45,
          fontSize: 12,
          bold: true,
          align: "center",
          valign: "middle",
          color: colors.white,
        });
      };

      if (type === "recce") {
        addImage(
          store.recce?.photos?.front,
          "FRONT VIEW",
          0.5,
          4.9,
          colors.primary,
        );
        addImage(
          store.recce?.photos?.side,
          "SIDE VIEW",
          3.7,
          4.9,
          colors.primary,
        );
        addImage(
          store.recce?.photos?.closeUp,
          "CLOSE UP VIEW",
          6.9,
          4.9,
          colors.primary,
        );
      } else {
        addImage(store.recce?.photos?.front, "BEFORE", 0.5, 4.9, "EF4444");
        addImage(
          store.installation?.photos?.after1,
          "AFTER - VIEW 1",
          3.7,
          4.9,
          colors.success,
        );
        addImage(
          store.installation?.photos?.after2,
          "AFTER - VIEW 2",
          6.9,
          4.9,
          colors.success,
        );
      }
    }

    const buffer = await pres.write({ outputType: "nodebuffer" });
    res.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${type === "recce" ? "Recce" : "Installation"}_Report_${stores.length}_Stores_${new Date().toISOString().split("T")[0]}.pptx"`,
    });
    res.end(buffer);
  } catch (error: any) {
    console.error("Bulk PPT Error:", error);
    if (!res.headersSent)
      res.status(500).json({ message: "Error generating bulk PPT" });
  }
};

export const exportRecceTasks = async (req: Request | any, res: Response) => {
  try {
    const ExcelJS = require("exceljs");
    let query: any = {};
    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.some((r: any) => r.code === "SUPER_ADMIN");
    const isAdmin = userRoles.some((r: any) => r.code === "ADMIN");
    if (!isSuperAdmin && !isAdmin) {
      query["workflow.recceAssignedTo"] = req.user._id;
    }
    const stores = await Store.find(query)
      .populate("workflow.recceAssignedTo", "name")
      .sort({ updatedAt: -1 });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Recce Tasks");
    worksheet.mergeCells("A1:G3");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Recce Inspection Report";
    titleCell.font = { size: 18, bold: true, color: { argb: "FF1F2937" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    const headers = [
      "Store Name",
      "Dealer Code",
      "City",
      "Address",
      "Status",
      "Recce Assigned To",
      "Recce Date",
    ];
    const headerRow = worksheet.getRow(5);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAB308" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 25;
    const formatDate = (date: Date) => {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const d = new Date(date);
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };
    stores.forEach((store: any, index) => {
      const row = worksheet.getRow(6 + index);
      row.values = [
        store.storeName,
        store.dealerCode,
        store.location.city,
        store.location.address,
        store.currentStatus,
        store.workflow.recceAssignedTo?.name || "N/A",
        store.recce?.submittedDate
          ? formatDate(store.recce.submittedDate)
          : "-",
      ];
      row.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      row.height = 40;
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
    });
    worksheet.columns = [
      { width: 35 },
      { width: 18 },
      { width: 18 },
      { width: 45 },
      { width: 25 },
      { width: 25 },
      { width: 18 },
    ];
    worksheet.eachRow((row: Row, rowNumber: number) => {
      if (rowNumber >= 5) {
        row.eachCell((cell: Cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Recce_Tasks.xlsx",
    );
    res.send(buffer);
  } catch (error: any) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to export recce tasks" });
  }
};

export const exportInstallationTasks = async (
  req: Request | any,
  res: Response,
) => {
  try {
    const ExcelJS = require("exceljs");
    let query: any = {};
    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.some((r: any) => r.code === "SUPER_ADMIN");
    const isAdmin = userRoles.some((r: any) => r.code === "ADMIN");
    if (!isSuperAdmin && !isAdmin) {
      query["workflow.installationAssignedTo"] = req.user._id;
    }
    const stores = await Store.find(query)
      .populate("workflow.installationAssignedTo", "name")
      .sort({ updatedAt: -1 });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Installation Tasks");
    worksheet.mergeCells("A1:G3");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Installation Tasks Report";
    titleCell.font = { size: 18, bold: true, color: { argb: "FF1F2937" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    const headers = [
      "Store Name",
      "Dealer Code",
      "City",
      "Address",
      "Status",
      "Install Assigned To",
      "Install Date",
    ];
    const headerRow = worksheet.getRow(5);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAB308" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 25;
    const formatDate = (date: Date) => {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const d = new Date(date);
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };
    stores.forEach((store: any, index) => {
      const row = worksheet.getRow(6 + index);
      row.values = [
        store.storeName,
        store.dealerCode,
        store.location.city,
        store.location.address,
        store.currentStatus,
        store.workflow.installationAssignedTo?.name || "N/A",
        store.installation?.submittedDate
          ? formatDate(store.installation.submittedDate)
          : "-",
      ];
      row.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      row.height = 40;
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
    });
    worksheet.columns = [
      { width: 35 },
      { width: 18 },
      { width: 18 },
      { width: 45 },
      { width: 25 },
      { width: 25 },
      { width: 18 },
    ];
    worksheet.eachRow((row: Row, rowNumber: number) => {
      if (rowNumber >= 5) {
        row.eachCell((cell: Cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Installation_Tasks.xlsx",
    );
    res.send(buffer);
  } catch (error: any) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to export installation tasks" });
  }
};

export const downloadStoreTemplate = async (req: Request, res: Response) => {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stores");
    const headers = [
      "Sr. No.",
      "Dealer Code",
      "Vendor Code & Name",
      "Dealer's Name",
      "City",
      "District",
      "Dealer's Address",
      "Width (Ft.)",
      "Height (Ft.)",
      "Dealer Board Type",
    ];
    const headerRow = sheet.getRow(1);
    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAB308" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
    sheet.columns = [
      { width: 10 },
      { width: 15 },
      { width: 25 },
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 40 },
      { width: 12 },
      { width: 12 },
      { width: 20 },
    ];
    const samples = [
      [
        1,
        "DLR001",
        "ELORA CREATIVE ART",
        "Rajesh Kumar",
        "Mumbai",
        "Mumbai Suburban",
        "123 Main Street, Andheri West",
        10,
        5,
        "Flex",
      ],
      [
        2,
        "DLR002",
        "ELORA CREATIVE ART",
        "Amit Sharma",
        "Delhi",
        "Central Delhi",
        "456 Park Avenue, Connaught Place",
        10,
        10,
        "LED",
      ],
      [
        3,
        "DLR003",
        "ELORA CREATIVE ART",
        "Priya Singh",
        "Bangalore",
        "Bangalore Urban",
        "789 MG Road, Indiranagar",
        15,
        10,
        "Digital",
      ],
      [
        4,
        "DLR004",
        "ELORA CREATIVE ART",
        "Suresh Patel",
        "Pune",
        "Pune",
        "321 FC Road, Shivajinagar",
        20,
        10,
        "Flex",
      ],
      [
        5,
        "DLR005",
        "ELORA CREATIVE ART",
        "Neha Gupta",
        "Hyderabad",
        "Hyderabad",
        "654 Banjara Hills, Road No 12",
        10,
        5,
        "LED",
      ],
      [
        6,
        "DLR006",
        "ELORA CREATIVE ART",
        "Vikram Reddy",
        "Chennai",
        "Chennai",
        "987 Anna Salai, T Nagar",
        10,
        10,
        "Digital",
      ],
      [
        7,
        "DLR007",
        "ELORA CREATIVE ART",
        "Anjali Verma",
        "Kolkata",
        "Kolkata",
        "147 Park Street, Central Kolkata",
        15,
        10,
        "Flex",
      ],
      [
        8,
        "DLR008",
        "ELORA CREATIVE ART",
        "Rahul Joshi",
        "Ahmedabad",
        "Ahmedabad",
        "258 CG Road, Navrangpura",
        20,
        10,
        "LED",
      ],
      [
        9,
        "DLR009",
        "ELORA CREATIVE ART",
        "Kavita Desai",
        "Jaipur",
        "Jaipur",
        "369 MI Road, C Scheme",
        10,
        5,
        "Digital",
      ],
      [
        10,
        "DLR010",
        "ELORA CREATIVE ART",
        "Manoj Yadav",
        "Lucknow",
        "Lucknow",
        "741 Hazratganj, Lucknow Central",
        10,
        10,
        "Flex",
      ],
    ];
    samples.forEach((data, idx) => {
      const row: Row = sheet.getRow(idx + 2);
      row.values = data;

      row.eachCell((cell: Cell) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });
    const validationSheet = workbook.addWorksheet("Validations");
    const valHeaders = ["Board Sizes", "Types"];
    const valHeaderRow = validationSheet.getRow(1);
    for (let i = 0; i < valHeaders.length; i++) {
      const cell = valHeaderRow.getCell(i + 1);
      cell.value = valHeaders[i];
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAB308" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
    validationSheet.getColumn(1).values = [
      "Board Sizes",
      "10 x 5",
      "10 x 10",
      "15 x 10",
      "20 x 10",
    ];
    validationSheet.getColumn(2).values = ["Types", "Flex", "LED", "Digital"];
    validationSheet.columns = [{ width: 20 }, { width: 20 }];
    validationSheet.eachRow((row: Row, rowNumber: number) => {
      if (rowNumber > 1) {
        row.eachCell((cell: Cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }
    });
    const instructionsSheet = workbook.addWorksheet("Instructions");
    const titleCell = instructionsSheet.getCell("A1");
    titleCell.value = "Instructions for Store Template";
    titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAB308" },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    const instructions = [
      "1. Fill all required fields in the Stores sheet",
      "2. Dealer Code must be unique for each store",
      "3. Width and Height should be in feet (numbers only)",
      "4. Refer to Validations sheet for Board Sizes and Types",
      "5. Delete sample data before uploading your actual data",
    ];
    instructions.forEach((text, i) => {
      const cell = instructionsSheet.getCell("A" + (i + 3));
      cell.value = text;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    instructionsSheet.getColumn(1).width = 60;
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Elora_Store_Upload_Template.xlsx",
    );
    res.send(buffer);
  } catch (error: any) {
    console.error("Template Error:", error);
    res.status(500).json({ message: "Failed to generate template" });
  }
};

// --- PDF Generation Functions ---
// export const generateReccePDF = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const store = await Store.findById(id);

//     if (!store || !store.recce) {
//       return res.status(404).json({ message: "Store or Recce data not found" });
//     }

//     const PDFDocument = require('pdfkit');
//     const doc = new PDFDocument({ margin: 50 });

//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename="Recce_${store.dealerCode}.pdf"`);
//     doc.pipe(res);

//     // Header
//     doc.fontSize(24).fillColor('#EAB308').text('RECCE INSPECTION REPORT', { align: 'center' });
//     doc.moveDown();
//     doc.strokeColor('#EAB308').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
//     doc.moveDown();

//     // Store Details
//     doc.fontSize(12).fillColor('#000000');
//     doc.text(`Dealer Code: ${store.dealerCode || 'N/A'}`, { continued: true }).text(`    Store Name: ${store.storeName || 'N/A'}`);
//     doc.text(`City: ${store.location.city || 'N/A'}`, { continued: true }).text(`    State: ${store.location.state || 'N/A'}`);
//     doc.text(`Address: ${store.location.address || 'N/A'}`);
//     doc.text(`Board Size: ${store.recce.sizes?.width || 0} x ${store.recce.sizes?.height || 0} ft`, { continued: true });
//     doc.text(`    Recce Date: ${store.recce.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : 'N/A'}`);
//     doc.text(`Notes: ${store.recce.notes || 'None'}`);
//     doc.moveDown();

//     // Images Section
//     doc.fontSize(16).fillColor('#EAB308').text('SITE INSPECTION PHOTOS', { align: 'center' });
//     doc.moveDown();

//     const addImage = (relativePath: string | undefined, label: string) => {
//       if (relativePath) {
//         try {
//           const absolutePath = path.join(process.cwd(), relativePath);
//           if (fs.existsSync(absolutePath)) {
//             doc.fontSize(12).fillColor('#000000').text(label, { underline: true });
//             doc.image(absolutePath, { fit: [450, 300], align: 'center' });
//             doc.moveDown();
//           }
//         } catch (err) {
//           doc.text(`${label}: Image not available`);
//         }
//       }
//     };

//     addImage(store.recce.photos?.front, 'FRONT VIEW');
//     addImage(store.recce.photos?.side, 'SIDE VIEW');
//     addImage(store.recce.photos?.closeUp, 'CLOSE UP VIEW');

//     doc.end();
//   } catch (error: any) {
//     console.error("PDF Gen Error:", error);
//     if (!res.headersSent) res.status(500).json({ message: "Error generating PDF" });
//   }
// };

// export const generateInstallationPDF = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const store = await Store.findById(id);

//     if (!store || !store.installation) {
//       return res.status(404).json({ message: "Store or Installation data not found" });
//     }

//     const PDFDocument = require('pdfkit');
//     const doc = new PDFDocument({ margin: 50 });

//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename="Installation_${store.dealerCode}.pdf"`);
//     doc.pipe(res);

//     // Header
//     doc.fontSize(24).fillColor('#22C55E').text('INSTALLATION COMPLETION REPORT', { align: 'center' });
//     doc.moveDown();
//     doc.strokeColor('#22C55E').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
//     doc.moveDown();

//     // Store Details
//     doc.fontSize(12).fillColor('#000000');
//     doc.text(`Dealer Code: ${store.dealerCode || 'N/A'}`, { continued: true }).text(`    Store Name: ${store.storeName || 'N/A'}`);
//     doc.text(`City: ${store.location.city || 'N/A'}`, { continued: true }).text(`    State: ${store.location.state || 'N/A'}`);
//     doc.text(`Address: ${store.location.address || 'N/A'}`);
//     doc.text(`Board Size: ${store.recce?.sizes?.width || 0} x ${store.recce?.sizes?.height || 0} ft`, { continued: true });
//     doc.text(`    Completion Date: ${store.installation.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : 'N/A'}`);
//     doc.fontSize(14).fillColor('#22C55E').text('Status: ✓ COMPLETED', { bold: true });
//     doc.moveDown();

//     // Images Section
//     doc.fontSize(16).fillColor('#22C55E').text('BEFORE & AFTER COMPARISON', { align: 'center' });
//     doc.moveDown();

//     const addImage = (relativePath: string | undefined, label: string, color: string) => {
//       if (relativePath) {
//         try {
//           const absolutePath = path.join(process.cwd(), relativePath);
//           if (fs.existsSync(absolutePath)) {
//             doc.fontSize(12).fillColor(color).text(label, { underline: true });
//             doc.image(absolutePath, { fit: [450, 300], align: 'center' });
//             doc.moveDown();
//           }
//         } catch (err) {
//           doc.fillColor('#000000').text(`${label}: Image not available`);
//         }
//       }
//     };

//     addImage(store.recce?.photos?.front, 'BEFORE', '#EF4444');
//     addImage(store.installation.photos?.after1, 'AFTER - VIEW 1', '#22C55E');
//     addImage(store.installation.photos?.after2, 'AFTER - VIEW 2', '#22C55E');

//     doc.end();
//   } catch (error: any) {
//     console.error("PDF Gen Error:", error);
//     if (!res.headersSent) res.status(500).json({ message: "Error generating PDF" });
//   }
// };
