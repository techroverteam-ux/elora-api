import { Request, Response } from "express";
import Store, { StoreStatus } from "./store.model";
import Client from "../client/client.model";
import User from "../user/user.model";
import * as XLSX from "xlsx";
import fs from "fs";
import PptxGenJS from "pptxgenjs";
import path from "path";
import { Row, Cell } from "exceljs";
import uploadService from "../../utils/uploadService";
import enhancedUploadService from "../../utils/enhancedUploadService";
import imagePathResolver from "../../utils/imagePathResolver";

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
    await Store.collection.dropIndex("storeCode_1").catch(() => {});

    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const allRows: any[] = [];
    const existingCodes = new Set((await Store.find().select("dealerCode")).map((s) => s.dealerCode));
    const clientCodes = await Client.find().select("clientCode _id");
    const clientCodeMap = new Map(clientCodes.map((c) => [c.clientCode, c._id]));
    const toInsert: any[] = [];
    const dealerCodesInFile = new Set<string>();

    for (const file of files) {
      try {
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(sheet);

        for (const [index, row] of rawData.entries()) {
          const rowNum = index + 2;
          let error = null;
          let clientId = null;

          const rowData = {
            srNo: row["Sr. No."] || "",
            clientCode: row["Client Code"] || "",
            dealerCode: row["Dealer Code"] || "",
            vendorCode: row["Vendor Code & Name"] || "",
            dealerName: row["Dealer's Name"] || "",
            state: row["State"] || "",
            city: row["City"] || row["City "] || "",
            district: row["District"] || "",
            address: row["Dealer's Address"] || "",
            width: row["Width (Ft.)"] || "",
            height: row["Height (Ft.)"] || "",
            boardType: row["Dealer Board Type"] || "",
          };

          // Validation
          if (!rowData.dealerCode) {
            error = "Dealer Code is required";
          } else {
            const dCode = String(rowData.dealerCode).trim();
            if (existingCodes.has(dCode)) {
              error = `Store with Dealer Code ${dCode} already exists in system`;
            } else if (dealerCodesInFile.has(dCode)) {
              error = `Dealer Code ${dCode} appears multiple times in this file`;
            } else {
              dealerCodesInFile.add(dCode);
              
              if (rowData.clientCode) {
                const clientCode = String(rowData.clientCode).trim();
                clientId = clientCodeMap.get(clientCode);
                if (!clientId) {
                  error = `Client Code ${clientCode} not found in system`;
                }
              }

              if (!error) {
                const city = rowData.city || rowData.district;
                const district = rowData.district;
                const cityPrefix = city.trim().substring(0, 3).toUpperCase();
                const districtPrefix = district.trim().substring(0, 3).toUpperCase();
                const storeId = `${cityPrefix}${districtPrefix}${dCode.toUpperCase()}`;
                const parseNumber = (val: any): number => { const num = Number(val); return isNaN(num) ? 0 : num; };

                toInsert.push({
                  projectID: rowData.srNo ? String(rowData.srNo) : "",
                  dealerCode: dCode,
                  storeId: storeId,
                  storeCode: rowData.vendorCode,
                  storeName: rowData.dealerName || "Unknown Name",
                  vendorCode: rowData.vendorCode,
                  clientCode: rowData.clientCode ? String(rowData.clientCode).trim() : "",
                  clientId: clientId,
                  location: {
                    zone: row["Zone"] || "",
                    state: rowData.state,
                    district: district,
                    city: city,
                    area: district,
                    address: rowData.address,
                  },
                  contact: { personName: "", mobile: "" },
                  commercials: {
                    poNumber: row["PO Number"] || "",
                    poMonth: row["PO Month"] || "",
                    invoiceNumber: row["INVOICE NO:"] || row["Invoice No"] || "",
                    invoiceRemarks: row["Invoice Remarks"] || "",
                    totalCost: parseNumber(row["Total Cost w/0 Tax"]),
                  },
                  costDetails: {
                    boardRate: parseNumber(row["Board Rate/Sq.Ft."]),
                    totalBoardCost: parseNumber(row["Total Board Cost (w/o taxes)"]),
                    angleCharges: parseNumber(row["Angle Charges (if any)"]),
                    scaffoldingCharges: parseNumber(row["Scaffolding Charges (if any)"]),
                    transportation: parseNumber(row["Transportation (if any)"]),
                    flanges: parseNumber(row["Flanges per pc (if any)"]),
                    lollipop: parseNumber(row["Lollipop per pc (if any)"]),
                    oneWayVision: parseNumber(row["One Way Vision (if any)"]),
                    sunboard: parseNumber(row["3 mm Sunboard (if any)"]),
                  },
                  specs: {
                    type: rowData.boardType,
                    width: parseNumber(rowData.width),
                    height: parseNumber(rowData.height),
                    qty: parseNumber(row["Qty"]) || 1,
                    boardSize: parseNumber(row["Board Size (Sq.Ft.)"]) ? String(parseNumber(row["Board Size (Sq.Ft.)"])) : `${parseNumber(rowData.width)}x${parseNumber(rowData.height)}`,
                  },
                  remark: row["Remark"] || "",
                  imagesAttached: row["Images Attached in PPT (yes/no)"] ? String(row["Images Attached in PPT (yes/no)"]).toLowerCase().includes("yes") || String(row["Images Attached in PPT (yes/no)"]).toLowerCase().includes("y") : false,
                  currentStatus: StoreStatus.UPLOADED,
                });
              }
            }
          }

          allRows.push({
            rowNumber: rowNum,
            data: rowData,
            status: error ? "error" : "success",
            error: error,
          });
        }
      } catch (err: any) {
        return res.status(400).json({ message: "File parsing error", error: err.message });
      }
    }

    // If ANY errors exist, reject entire upload
    const errorCount = allRows.filter(r => r.status === "error").length;
    if (errorCount > 0) {
      return res.status(400).json({
        message: "Upload rejected due to errors. Please fix all errors and re-upload.",
        totalProcessed: allRows.length,
        successCount: 0,
        errorCount: errorCount,
        rows: allRows,
      });
    }

    // All valid - proceed with insert
    try {
      await Store.insertMany(toInsert, { ordered: false });
      return res.status(201).json({
        message: "All stores uploaded successfully",
        totalProcessed: allRows.length,
        successCount: allRows.length,
        errorCount: 0,
        rows: allRows,
      });
    } catch (err: any) {
      return res.status(500).json({ message: "Database insertion failed", error: err.message });
    }
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
      clientCode,
      location,
      commercials,
      costDetails,
      specs,
    } = req.body;

    if (!dealerCode) {
      return res.status(400).json({ message: "Dealer Code is required" });
    }

    // Validate required fields for storeId generation
    if (!location?.city || !location?.district) {
      return res.status(400).json({ message: "City and District are required for Store ID generation" });
    }

    let clientId = null;
    if (clientCode) {
      const client = await Client.findOne({ clientCode });
      if (!client) {
        return res.status(400).json({ message: "Invalid Client Code" });
      }
      clientId = client._id;
    }

    const store = new Store({
      dealerCode,
      storeName,
      vendorCode,
      clientCode,
      clientId,
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

    const { status, search, city, clientCode, clientName, district, state, storeName, storeCode } = req.query;

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
      query["location.city"] = { $regex: city, $options: "i" };
    }

    // 4. District Filter
    if (district) {
      query["location.district"] = { $regex: district, $options: "i" };
    }

    // 5. State Filter
    if (state) {
      query["location.state"] = { $regex: state, $options: "i" };
    }

    // 6. Store Name Filter
    if (storeName) {
      query.storeName = { $regex: storeName, $options: "i" };
    }

    // 7. Store Code Filter
    if (storeCode) {
      query.dealerCode = { $regex: storeCode, $options: "i" };
    }

    // 8. Client Code Filter
    if (clientCode) {
      query.clientCode = { $regex: clientCode, $options: "i" };
    }

    // 9. Client Name Filter
    if (clientName) {
      const clients = await Client.find({
        clientName: { $regex: clientName, $options: "i" },
      }).select("_id");
      if (clients.length > 0) {
        query.clientId = { $in: clients.map((c) => c._id) };
      } else {
        query.clientId = null;
      }
    }

    // 10. Search (Store Name, Dealer Code, City)
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
      .populate("clientId", "clientName")
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
    
    // Convert relative paths to full URLs for images
    if (store.recce?.initialPhotos) {
      store.recce.initialPhotos = store.recce.initialPhotos
        .filter(photo => !photo.startsWith('blob:')) // Remove blob URLs
        .map(photo => {
          if (photo.startsWith('uploads/')) {
            // For backward compatibility, construct URL directly
            return `https://storage.enamorimpex.com/eloraftp/${photo}`;
          } else if (!photo.startsWith('http')) {
            // For new format without uploads prefix
            return `https://storage.enamorimpex.com/eloraftp/${photo}`;
          }
          return photo;
        });
    }
    
    if (store.recce?.reccePhotos) {
      store.recce.reccePhotos = store.recce.reccePhotos.map((reccePhoto: any) => {
        if (reccePhoto.photo && reccePhoto.photo.startsWith('uploads/')) {
          // For backward compatibility, construct URL directly
          reccePhoto.photo = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo}`;
        } else if (reccePhoto.photo && !reccePhoto.photo.startsWith('http')) {
          // For new format without uploads prefix
          reccePhoto.photo = `https://storage.enamorimpex.com/eloraftp/${reccePhoto.photo}`;
        }
        return reccePhoto;
      });
    }
    
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
        "recce.assignedDate": new Date(),
        currentStatus: StoreStatus.RECCE_ASSIGNED,
      };
    } else if (stage === "INSTALLATION") {
      updateData = {
        "workflow.installationAssignedTo": userId,
        "workflow.installationAssignedBy": assignedBy,
        "installation.assignedDate": new Date(),
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
    const { notes, initialPhotosCount, reccePhotosData, existingReccePhotos, existingInitialPhotos } = req.body;
    const filesArray = req.files as Express.Multer.File[];

    console.log("Request body:", { notes, initialPhotosCount, reccePhotosData, existingReccePhotos, existingInitialPhotos });
    console.log("Files received:", filesArray?.map(f => f.fieldname));

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    console.log(`[DEBUG] Store found - clientCode: ${store.clientCode}, dealerCode: ${store.dealerCode}, storeId: ${store.storeId}`);

    // Generate storeId if missing
    if (!store.storeId) {
      if (store.location?.city && store.location?.district && store.dealerCode) {
        const cityPrefix = store.location.city.trim().substring(0, 3).toUpperCase();
        const districtPrefix = store.location.district.trim().substring(0, 3).toUpperCase();
        const storeId = `${cityPrefix}${districtPrefix}${store.dealerCode.toUpperCase()}`;
        store.storeId = storeId;
        await store.save();
      } else {
        return res.status(400).json({
          message: "Cannot generate Store ID. Missing city or district information.",
        });
      }
    }

    const userName = req.user?.name || "Unknown";

    // Start with existing initial photos if resubmission (filter out blob URLs)
    const initialPhotos: string[] = [];
    if (existingInitialPhotos) {
      const existing = JSON.parse(existingInitialPhotos);
      existing.forEach((photo: string) => {
        // Only keep actual uploaded files, not blob URLs
        if (photo.startsWith('uploads/') || photo.startsWith('http')) {
          initialPhotos.push(photo);
        }
      });
    }
    
    // Upload new initial photos (up to 10 total)
    const initialCount = parseInt(initialPhotosCount || "0");
    for (let i = 0; i < initialCount; i++) {
      const fieldName = `initialPhoto${i}`;
      const file = filesArray?.find(f => f.fieldname === fieldName);
      if (file) {
        const clientCodeToUse = store.clientCode || store.dealerCode || "DEFAULT";
        console.log(`[DEBUG] Upload params: ${clientCodeToUse}/${store.storeId}/${userName}`);
        
        const link = await enhancedUploadService.uploadFile(
          file.buffer,
          `initial_${Date.now()}_${i}.jpg`,
          file.mimetype,
          clientCodeToUse,
          store.storeId,
          "initial",
          userName,
        );
        initialPhotos.push(link);
      }
    }

    console.log("Initial photos uploaded:", initialPhotos);

    // Start with existing recce photos if resubmission
    const reccePhotos: any[] = [];
    if (existingReccePhotos) {
      const existing = JSON.parse(existingReccePhotos);
      existing.forEach((ep: any) => {
        reccePhotos.push({
          photo: ep.photo,
          measurements: {
            width: parseFloat(ep.width),
            height: parseFloat(ep.height),
            unit: ep.unit || "in",
          },
          elements: ep.elements || [],
        });
      });
    }

    // Parse and upload new recce photos
    const reccePhotosArray = JSON.parse(reccePhotosData || "[]");
    console.log("Recce photos array:", reccePhotosArray);

    for (let i = 0; i < reccePhotosArray.length; i++) {
      const photoData = reccePhotosArray[i];
      const fieldName = `reccePhoto${i}`;
      const file = filesArray?.find(f => f.fieldname === fieldName);
      
      if (file) {
        const link = await enhancedUploadService.uploadFile(
          file.buffer,
          `recce_${Date.now()}_${i}.jpg`,
          file.mimetype,
          store.clientCode || store.dealerCode || "DEFAULT",
          store.storeId,
          "recce",
          userName,
        );

        reccePhotos.push({
          photo: link,
          measurements: {
            width: parseFloat(photoData.width),
            height: parseFloat(photoData.height),
            unit: photoData.unit || "in",
          },
          elements: photoData.elements || [],
        });
      }
    }

    console.log("Recce photos uploaded:", reccePhotos);

    // Calculate costs based on recce data and client element rates
    let totalBoardCost = 0;
    
    if (store.clientId) {
      const client = await Client.findById(store.clientId);
      if (client && client.elements) {
        reccePhotos.forEach((rp: any) => {
          const width = rp.measurements.unit === "in" ? rp.measurements.width / 12 : rp.measurements.width;
          const height = rp.measurements.unit === "in" ? rp.measurements.height / 12 : rp.measurements.height;
          const boardSize = width * height;
          
          if (rp.elements && rp.elements.length > 0) {
            const elementId = rp.elements[0].elementId;
            const clientElement = client.elements.find((el: any) => el.elementId.toString() === elementId.toString());
            if (clientElement) {
              rp.elements[0].customRate = clientElement.customRate;
              const elementCost = boardSize * clientElement.customRate * (rp.elements[0].quantity || 1);
              totalBoardCost += elementCost;
            }
          }
        });
      }
    }

    const angleCharges = store.costDetails?.angleCharges || 0;
    const scaffoldingCharges = store.costDetails?.scaffoldingCharges || 0;
    const transportation = store.costDetails?.transportation || 0;
    const flanges = store.costDetails?.flanges || 0;
    const lollipop = store.costDetails?.lollipop || 0;
    const oneWayVision = store.costDetails?.oneWayVision || 0;
    const sunboard = store.costDetails?.sunboard || 0;
    const totalCost = totalBoardCost + angleCharges + scaffoldingCharges + transportation + flanges + lollipop + oneWayVision + sunboard;

    // Prepare Recce Data
    const recceUpdate: any = {
      "recce.submittedDate": new Date(),
      "recce.notes": notes,
      "recce.initialPhotos": initialPhotos,
      "recce.reccePhotos": reccePhotos,
      "recce.submittedBy": userName,
      "recce.costDetails.totalBoardCost": totalBoardCost,
      "recce.commercials.totalCost": totalCost,
      currentStatus: StoreStatus.RECCE_SUBMITTED,
    };

    console.log("Recce update object:", recceUpdate);

    const updatedStore = await Store.findByIdAndUpdate(
      id,
      { $set: recceUpdate },
      { new: true },
    );

    console.log("Updated store recce:", updatedStore?.recce);

    res.status(200).json({
      message: "Recce submitted successfully",
      store: updatedStore,
    });
  } catch (error: any) {
    console.error("Recce Submit Error:", error);
    res.status(500).json({ message: "Failed to submit recce", error: error.message });
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

    // STORE INFO SLIDE
    const infoSlide = pres.addSlide();
    infoSlide.background = { fill: "FFFEF5" };
    infoSlide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { type: "solid", color: "FEF3C7", transparency: 50 },
    });

    if (fs.existsSync(logoPath)) {
      infoSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
    }

    infoSlide.addShape("rect", {
      x: 0.2,
      y: 0.8,
      w: 9.6,
      h: 0.7,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });
    infoSlide.addText("RECCE INSPECTION REPORT", {
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

    infoSlide.addShape("rect", {
      x: 0.2,
      y: 1.7,
      w: 9.6,
      h: 2.4,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });

    const detailsData = [
      [
        { text: "Dealer Code", options: { bold: true, fill: { color: colors.lightBg } } },
        store.dealerCode || "",
        { text: "Store Name", options: { bold: true, fill: { color: colors.lightBg } } },
        store.storeName || "",
      ],
      [
        { text: "City", options: { bold: true, fill: { color: colors.lightBg } } },
        store.location.city || "",
        { text: "State", options: { bold: true, fill: { color: colors.lightBg } } },
        store.location.state || "",
      ],
      [
        { text: "Address", options: { bold: true, fill: { color: colors.lightBg } } },
        { text: store.location.address || "N/A", options: { colspan: 3 } },
      ],
      [
        { text: "Recce Date", options: { bold: true, fill: { color: colors.lightBg } } },
        store.recce.submittedDate ? new Date(store.recce.submittedDate).toLocaleDateString() : "N/A",
        { text: "Submitted By", options: { bold: true, fill: { color: colors.lightBg } } },
        store.recce.submittedBy || "N/A",
      ],
      [
        { text: "Notes", options: { bold: true, fill: { color: colors.lightBg } } },
        { text: store.recce.notes || "None", options: { colspan: 3 } },
      ],
    ];

    infoSlide.addTable(detailsData as any, {
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

    // INITIAL PHOTOS SLIDES
    if (store.recce.initialPhotos && store.recce.initialPhotos.length > 0) {
      const initialSlide = pres.addSlide();
      initialSlide.background = { fill: "FFFEF5" };
      initialSlide.addShape("rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: "100%",
        fill: { type: "solid", color: "FEF3C7", transparency: 50 },
      });

      if (fs.existsSync(logoPath)) {
        initialSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
      }

      initialSlide.addShape("rect", {
        x: 0.2,
        y: 0.8,
        w: 9.6,
        h: 0.6,
        line: { color: colors.borderDark, width: 2 },
        fill: { color: colors.white },
      });
      initialSlide.addText("INITIAL STORE PHOTOS", {
        x: 0.2,
        y: 0.8,
        w: 9.6,
        h: 0.6,
        fontSize: 24,
        bold: true,
        color: colors.primary,
        align: "center",
        valign: "middle",
      });

      const photosPerSlide = 4;
      const photoWidth = 4.5;
      const photoHeight = 3.0;
      const positions = [
        { x: 0.5, y: 1.8 },
        { x: 5.3, y: 1.8 },
        { x: 0.5, y: 5.0 },
        { x: 5.3, y: 5.0 },
      ];

      let currentSlide = initialSlide;
      const tempFiles: string[] = [];
      
      for (let i = 0; i < store.recce.initialPhotos.length; i++) {
        const posIndex = i % photosPerSlide;
        if (posIndex === 0 && i > 0) {
          currentSlide = pres.addSlide();
          currentSlide.background = { fill: "FFFEF5" };
          currentSlide.addShape("rect", {
            x: 0,
            y: 0,
            w: "100%",
            h: "100%",
            fill: { type: "solid", color: "FEF3C7", transparency: 50 },
          });
          if (fs.existsSync(logoPath)) {
            currentSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
          }
        }

        const pos = positions[posIndex];
        try {
          const photoPath = await imagePathResolver.resolveImagePath(store.recce.initialPhotos[i]);
          tempFiles.push(photoPath);
          
          if (fs.existsSync(photoPath)) {
            currentSlide.addImage({
              path: photoPath,
              x: pos.x,
              y: pos.y,
              w: photoWidth,
              h: photoHeight,
            });
          }
        } catch (error) {
          console.error(`Failed to load image: ${store.recce.initialPhotos[i]}`, error);
        }
      }
      
      // Cleanup temp files after slide creation
      tempFiles.forEach(file => imagePathResolver.cleanupTempFile(file));
    }

    // RECCE PHOTOS SLIDES (Individual slides with measurements and elements)
    if (store.recce.reccePhotos && store.recce.reccePhotos.length > 0) {
      for (let i = 0; i < store.recce.reccePhotos.length; i++) {
        const reccePhoto = store.recce.reccePhotos[i];
        const photoSlide = pres.addSlide();
        photoSlide.background = { fill: "FFFEF5" };
        photoSlide.addShape("rect", {
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
          fill: { type: "solid", color: "FEF3C7", transparency: 50 },
        });

        if (fs.existsSync(logoPath)) {
          photoSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
        }

        try {
          const photoPath = await imagePathResolver.resolveImagePath(reccePhoto.photo);
          if (fs.existsSync(photoPath)) {
            photoSlide.addImage({
              path: photoPath,
              x: 1.0,
              y: 0.8,
              w: 8.0,
              h: 5.5,
            });
          }
          imagePathResolver.cleanupTempFile(photoPath);
        } catch (error) {
          console.error(`Failed to load recce photo: ${reccePhoto.photo}`, error);
        }

        // Measurements box
        photoSlide.addShape("rect", {
          x: 1.0,
          y: 6.4,
          w: 8.0,
          h: 0.6,
          line: { color: colors.borderDark, width: 2 },
          fill: { color: colors.white },
        });
        photoSlide.addText(
          `Measurements: ${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`,
          {
            x: 1.0,
            y: 6.4,
            w: 8.0,
            h: 0.6,
            fontSize: 18,
            bold: true,
            color: colors.text,
            align: "center",
            valign: "middle",
          },
        );

        // Elements section
        if (reccePhoto.elements && reccePhoto.elements.length > 0) {
          const elementsText = reccePhoto.elements
            .map((el: any) => `${el.elementName} (Qty: ${el.quantity})`)
            .join(" | ");
          
          photoSlide.addShape("rect", {
            x: 1.0,
            y: 7.1,
            w: 8.0,
            h: 0.5,
            line: { color: colors.borderDark, width: 2 },
            fill: { color: colors.lightBg },
          });
          photoSlide.addText(`Elements: ${elementsText}`, {
            x: 1.0,
            y: 7.1,
            w: 8.0,
            h: 0.5,
            fontSize: 14,
            bold: true,
            color: colors.text,
            align: "center",
            valign: "middle",
          });
        }
      }
    }

    const buffer = await pres.write({ outputType: "nodebuffer" });
    res.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="RECCE_${store.storeName}_${store.storeId}_PPT.pptx"`,
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

// --- NEW: Review Individual Recce Photo ---
export const reviewReccePhoto = async (req: Request | any, res: Response) => {
  try {
    const { id, photoIndex } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Use APPROVED or REJECTED." });
    }

    const store = await Store.findById(id);
    if (!store || !store.recce?.reccePhotos) {
      return res.status(404).json({ message: "Store or recce photos not found" });
    }

    const photoIdx = parseInt(photoIndex);
    if (photoIdx < 0 || photoIdx >= store.recce.reccePhotos.length) {
      return res.status(400).json({ message: "Invalid photo index" });
    }

    store.recce.reccePhotos[photoIdx].approvalStatus = status as "APPROVED" | "REJECTED";
    store.recce.reccePhotos[photoIdx].approvedBy = req.user._id;
    store.recce.reccePhotos[photoIdx].approvedAt = new Date();
    if (status === "REJECTED" && rejectionReason) {
      store.recce.reccePhotos[photoIdx].rejectionReason = rejectionReason;
    }

    const approved = store.recce.reccePhotos.filter(p => p.approvalStatus === "APPROVED").length;
    const rejected = store.recce.reccePhotos.filter(p => p.approvalStatus === "REJECTED").length;
    const pending = store.recce.reccePhotos.filter(p => !p.approvalStatus || p.approvalStatus === "PENDING").length;

    store.recce.approvedPhotosCount = approved;
    store.recce.rejectedPhotosCount = rejected;
    store.recce.pendingPhotosCount = pending;

    if (approved > 0 && pending === 0) {
      store.currentStatus = StoreStatus.RECCE_APPROVED;
    } else if (approved === 0 && rejected === store.recce.reccePhotos.length) {
      store.currentStatus = StoreStatus.RECCE_REJECTED;
    } else {
      store.currentStatus = StoreStatus.RECCE_SUBMITTED;
    }

    await store.save();

    res.status(200).json({
      message: `Photo ${photoIdx + 1} ${status.toLowerCase()} successfully`,
      store,
      summary: { approved, rejected, pending }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Review failed", error: error.message });
  }
};

// --- NEW: Bulk Approve All Recce Photos ---
export const bulkApproveReccePhotos = async (req: Request | any, res: Response) => {
  try {
    const { id } = req.params;

    const store = await Store.findById(id);
    if (!store || !store.recce?.reccePhotos) {
      return res.status(404).json({ message: "Store or recce photos not found" });
    }

    store.recce.reccePhotos.forEach(photo => {
      photo.approvalStatus = "APPROVED";
      photo.approvedBy = req.user._id;
      photo.approvedAt = new Date();
    });

    store.recce.approvedPhotosCount = store.recce.reccePhotos.length;
    store.recce.rejectedPhotosCount = 0;
    store.recce.pendingPhotosCount = 0;
    store.currentStatus = StoreStatus.RECCE_APPROVED;

    await store.save();

    res.status(200).json({
      message: "All photos approved successfully",
      store
    });
  } catch (error: any) {
    res.status(500).json({ message: "Bulk approval failed", error: error.message });
  }
};

// --- UPDATED: Submit Installation Data (Multiple Images matching Recce Photos) ---
export const submitInstallation = async (req: Request | any, res: Response) => {
  try {
    const { id } = req.params;
    const { installationPhotosData } = req.body;
    const filesArray = req.files as Express.Multer.File[];

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    if (!store.storeId) {
      if (store.location?.city && store.location?.district && store.dealerCode) {
        const cityPrefix = store.location.city.trim().substring(0, 3).toUpperCase();
        const districtPrefix = store.location.district.trim().substring(0, 3).toUpperCase();
        const storeId = `${cityPrefix}${districtPrefix}${store.dealerCode.toUpperCase()}`;
        store.storeId = storeId;
        await store.save();
      } else {
        return res.status(400).json({ message: "Cannot generate Store ID. Missing city or district information." });
      }
    }

    // Filter only approved recce photos
    const approvedReccePhotos = store.recce?.reccePhotos?.filter(
      p => p.approvalStatus === "APPROVED"
    ) || [];

    if (approvedReccePhotos.length === 0) {
      return res.status(400).json({ message: "No approved recce photos found. Cannot submit installation." });
    }

    const userName = req.user?.name || "Unknown";
    const installationPhotos: Array<{ reccePhotoIndex: number; installationPhoto: string }> = [];

    const photosArray = JSON.parse(installationPhotosData || "[]");

    for (let i = 0; i < photosArray.length; i++) {
      const photoData = photosArray[i];
      const fieldName = `installationPhoto${i}`;
      const file = filesArray?.find(f => f.fieldname === fieldName);

      // Validate that the reccePhotoIndex refers to an approved photo
      const originalRecceIndex = photoData.reccePhotoIndex;
      const approvedIndex = store.recce?.reccePhotos?.findIndex(
        (p, idx) => idx === originalRecceIndex && p.approvalStatus === "APPROVED"
      );

      if (approvedIndex === -1) {
        return res.status(400).json({ 
          message: `Recce photo at index ${originalRecceIndex} is not approved or does not exist.` 
        });
      }

      if (file) {
        const link = await enhancedUploadService.uploadFile(
          file.buffer,
          `installation_${Date.now()}_${i}.jpg`,
          file.mimetype,
          store.clientCode || store.dealerCode || "DEFAULT",
          store.storeId,
          "installation",
          userName,
        );

        installationPhotos.push({
          reccePhotoIndex: photoData.reccePhotoIndex,
          installationPhoto: link,
        });
      }
    }

    const installUpdate: any = {
      "installation.submittedDate": new Date(),
      "installation.submittedBy": userName,
      "installation.photos": installationPhotos,
      currentStatus: StoreStatus.INSTALLATION_SUBMITTED,
    };

    await Store.findByIdAndUpdate(id, { $set: installUpdate });

    res.status(200).json({ message: "Installation submitted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Submission failed", error: error.message });
  }
};

// --- UPDATED: Generate Installation PPT (Before & After Comparison) ---
export const generateInstallationPPT = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);

    if (!store || !store.installation) {
      return res.status(404).json({ message: "Store or Installation data not found" });
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
      danger: "EF4444",
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

    // STORE INFO SLIDE
    const infoSlide = pres.addSlide();
    infoSlide.background = { fill: "FFFEF5" };
    infoSlide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { type: "solid", color: "FEF3C7", transparency: 50 },
    });

    if (fs.existsSync(logoPath)) {
      infoSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
    }

    infoSlide.addShape("rect", {
      x: 0.2,
      y: 0.8,
      w: 9.6,
      h: 0.7,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });
    infoSlide.addText("INSTALLATION COMPLETION REPORT", {
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

    infoSlide.addShape("rect", {
      x: 0.2,
      y: 1.7,
      w: 9.6,
      h: 2.4,
      line: { color: colors.borderDark, width: 2 },
      fill: { color: colors.white },
    });

    const detailsData = [
      [
        { text: "Dealer Code", options: { bold: true, fill: { color: colors.lightBg } } },
        store.dealerCode || "",
        { text: "Store Name", options: { bold: true, fill: { color: colors.lightBg } } },
        store.storeName || "",
      ],
      [
        { text: "City", options: { bold: true, fill: { color: colors.lightBg } } },
        store.location.city || "",
        { text: "State", options: { bold: true, fill: { color: colors.lightBg } } },
        store.location.state || "",
      ],
      [
        { text: "Address", options: { bold: true, fill: { color: colors.lightBg } } },
        { text: store.location.address || "N/A", options: { colspan: 3 } },
      ],
      [
        { text: "Completion Date", options: { bold: true, fill: { color: colors.lightBg } } },
        store.installation.submittedDate ? new Date(store.installation.submittedDate).toLocaleDateString() : "N/A",
        { text: "Submitted By", options: { bold: true, fill: { color: colors.lightBg } } },
        store.installation.submittedBy || "N/A",
      ],
      [
        { text: "Status", options: { bold: true, fill: { color: colors.lightBg } } },
        { text: "✓ COMPLETED", options: { colspan: 3, bold: true, color: colors.success } },
      ],
    ];

    infoSlide.addTable(detailsData as any, {
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

    // INITIAL PHOTOS SLIDES
    if (store.recce?.initialPhotos && store.recce.initialPhotos.length > 0) {
      const initialSlide = pres.addSlide();
      initialSlide.background = { fill: "FFFEF5" };
      initialSlide.addShape("rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: "100%",
        fill: { type: "solid", color: "FEF3C7", transparency: 50 },
      });

      if (fs.existsSync(logoPath)) {
        initialSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
      }

      initialSlide.addShape("rect", {
        x: 0.2,
        y: 0.8,
        w: 9.6,
        h: 0.6,
        line: { color: colors.borderDark, width: 2 },
        fill: { color: colors.white },
      });
      initialSlide.addText("INITIAL STORE PHOTOS", {
        x: 0.2,
        y: 0.8,
        w: 9.6,
        h: 0.6,
        fontSize: 24,
        bold: true,
        color: colors.primary,
        align: "center",
        valign: "middle",
      });

      const photosPerSlide = 4;
      const photoWidth = 4.5;
      const photoHeight = 3.0;
      const positions = [
        { x: 0.5, y: 1.8 },
        { x: 5.3, y: 1.8 },
        { x: 0.5, y: 5.0 },
        { x: 5.3, y: 5.0 },
      ];

      let currentSlide = initialSlide;
      for (let i = 0; i < store.recce.initialPhotos.length; i++) {
        const posIndex = i % photosPerSlide;
        if (posIndex === 0 && i > 0) {
          currentSlide = pres.addSlide();
          currentSlide.background = { fill: "FFFEF5" };
          currentSlide.addShape("rect", {
            x: 0,
            y: 0,
            w: "100%",
            h: "100%",
            fill: { type: "solid", color: "FEF3C7", transparency: 50 },
          });
          if (fs.existsSync(logoPath)) {
            currentSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
          }
        }

        const pos = positions[posIndex];
        const photoPath = path.join(process.cwd(), store.recce.initialPhotos[i]);

        if (fs.existsSync(photoPath)) {
          currentSlide.addImage({
            path: photoPath,
            x: pos.x,
            y: pos.y,
            w: photoWidth,
            h: photoHeight,
          });
        }
      }
    }

    // BEFORE & AFTER COMPARISON SLIDES (Side by side for each recce photo)
    if (store.recce?.reccePhotos && store.recce.reccePhotos.length > 0 && store.installation.photos) {
      for (let i = 0; i < store.recce.reccePhotos.length; i++) {
        const reccePhoto = store.recce.reccePhotos[i];
        const installPhoto = store.installation.photos.find((p: any) => p.reccePhotoIndex === i);
        
        const comparisonSlide = pres.addSlide();
        comparisonSlide.background = { fill: "FFFEF5" };
        comparisonSlide.addShape("rect", {
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
          fill: { type: "solid", color: "FEF3C7", transparency: 50 },
        });

        if (fs.existsSync(logoPath)) {
          comparisonSlide.addImage({ path: logoPath, x: 0.3, y: 0.15, w: 1.5, h: 0.45 });
        }

        // Title
        comparisonSlide.addShape("rect", {
          x: 0.2,
          y: 0.8,
          w: 9.6,
          h: 0.5,
          line: { color: colors.borderDark, width: 2 },
          fill: { color: colors.white },
        });
        comparisonSlide.addText(`BEFORE & AFTER - Photo ${i + 1}`, {
          x: 0.2,
          y: 0.8,
          w: 9.6,
          h: 0.5,
          fontSize: 20,
          bold: true,
          color: colors.secondary,
          align: "center",
          valign: "middle",
        });

        // BEFORE (Left side)
        try {
          const reccePhotoPath = await imagePathResolver.resolveImagePath(reccePhoto.photo);
          if (fs.existsSync(reccePhotoPath)) {
            comparisonSlide.addImage({
              path: reccePhotoPath,
              x: 0.5,
              y: 1.5,
              w: 4.5,
              h: 4.5,
            });
          }
          imagePathResolver.cleanupTempFile(reccePhotoPath);
        } catch (error) {
          console.error(`Failed to load recce photo: ${reccePhoto.photo}`, error);
        }
        comparisonSlide.addShape("rect", {
          x: 0.5,
          y: 6.1,
          w: 4.5,
          h: 0.4,
          fill: { color: colors.danger },
          line: { color: colors.borderDark, width: 2 },
        });
        comparisonSlide.addText("BEFORE", {
          x: 0.5,
          y: 6.1,
          w: 4.5,
          h: 0.4,
          fontSize: 16,
          bold: true,
          color: colors.white,
          align: "center",
          valign: "middle",
        });

        // AFTER (Right side)
        if (installPhoto) {
          try {
            const installPhotoPath = await imagePathResolver.resolveImagePath(installPhoto.installationPhoto);
            if (fs.existsSync(installPhotoPath)) {
              comparisonSlide.addImage({
                path: installPhotoPath,
                x: 5.3,
                y: 1.5,
                w: 4.5,
                h: 4.5,
              });
            }
            imagePathResolver.cleanupTempFile(installPhotoPath);
          } catch (error) {
            console.error(`Failed to load installation photo: ${installPhoto.installationPhoto}`, error);
          }
        }
        comparisonSlide.addShape("rect", {
          x: 5.3,
          y: 6.1,
          w: 4.5,
          h: 0.4,
          fill: { color: colors.success },
          line: { color: colors.borderDark, width: 2 },
        });
        comparisonSlide.addText("AFTER", {
          x: 5.3,
          y: 6.1,
          w: 4.5,
          h: 0.4,
          fontSize: 16,
          bold: true,
          color: colors.white,
          align: "center",
          valign: "middle",
        });

        // Measurements and Elements
        comparisonSlide.addShape("rect", {
          x: 0.5,
          y: 6.6,
          w: 9.3,
          h: 0.5,
          line: { color: colors.borderDark, width: 2 },
          fill: { color: colors.white },
        });
        comparisonSlide.addText(
          `Measurements: ${reccePhoto.measurements.width} x ${reccePhoto.measurements.height} ${reccePhoto.measurements.unit}`,
          {
            x: 0.5,
            y: 6.6,
            w: 9.3,
            h: 0.5,
            fontSize: 14,
            bold: true,
            color: colors.text,
            align: "center",
            valign: "middle",
          },
        );

        if (reccePhoto.elements && reccePhoto.elements.length > 0) {
          const elementsText = reccePhoto.elements
            .map((el: any) => `${el.elementName} (Qty: ${el.quantity})`)
            .join(" | ");
          
          comparisonSlide.addShape("rect", {
            x: 0.5,
            y: 7.2,
            w: 9.3,
            h: 0.4,
            line: { color: colors.borderDark, width: 2 },
            fill: { color: colors.lightBg },
          });
          comparisonSlide.addText(`Elements: ${elementsText}`, {
            x: 0.5,
            y: 7.2,
            w: 9.3,
            h: 0.4,
            fontSize: 12,
            bold: true,
            color: colors.text,
            align: "center",
            valign: "middle",
          });
        }
      }
    }

    const buffer = await pres.write({ outputType: "nodebuffer" });
    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="INSTALLATION_${store.storeName}_${store.storeId}_PPT.pptx"`,
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
                `${store.specs?.width || 0} x ${store.specs?.height || 0} ft`,
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
                `${store.specs?.width || 0} x ${store.specs?.height || 0} ft`,
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
          store.recce?.reccePhotos?.[0]?.photo,
          "PHOTO 1",
          0.5,
          4.9,
          colors.primary,
        );
        addImage(
          store.recce?.reccePhotos?.[1]?.photo,
          "PHOTO 2",
          3.7,
          4.9,
          colors.primary,
        );
        addImage(
          store.recce?.reccePhotos?.[2]?.photo,
          "PHOTO 3",
          6.9,
          4.9,
          colors.primary,
        );
      } else {
        addImage(store.recce?.reccePhotos?.[0]?.photo, "BEFORE", 0.5, 4.9, "EF4444");
        addImage(
          store.installation?.photos?.[0]?.installationPhoto,
          "AFTER - VIEW 1",
          3.7,
          4.9,
          colors.success,
        );
        addImage(
          store.installation?.photos?.[1]?.installationPhoto,
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

export const exportStores = async (req: Request | any, res: Response) => {
  try {
    const ExcelJS = require("exceljs");
    const {
      status,
      search,
      city,
      clientCode,
      clientName,
      zone,
      state,
      district,
      vendorCode,
      dealerCode,
      poNumber,
      invoiceNo,
    } = req.query;

    let query: any = {};
    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.some((r: any) => r.code === "SUPER_ADMIN");
    const isAdmin = userRoles.some((r: any) => r.code === "ADMIN");

    if (!isSuperAdmin && !isAdmin) {
      query.$or = [
        { "workflow.recceAssignedTo": req.user._id },
        { "workflow.installationAssignedTo": req.user._id },
      ];
    }

    if (status && status !== "ALL") {
      if (status.includes(",")) {
        const statuses = status.split(",").map((s: string) => s.trim());
        query.currentStatus = { $in: statuses };
      } else {
        query.currentStatus = status;
      }
    }

    if (city) query["location.city"] = { $regex: city, $options: "i" };
    if (zone) query["location.zone"] = zone;
    if (state) query["location.state"] = state;
    if (district) query["location.district"] = district;
    if (vendorCode) query.vendorCode = vendorCode;
    if (dealerCode) query.dealerCode = { $regex: dealerCode, $options: "i" };
    if (poNumber)
      query["commercials.poNumber"] = { $regex: poNumber, $options: "i" };
    if (invoiceNo)
      query["commercials.invoiceNumber"] = { $regex: invoiceNo, $options: "i" };
    if (clientCode) query.clientCode = { $regex: clientCode, $options: "i" };

    if (clientName) {
      const clients = await Client.find({
        clientName: { $regex: clientName, $options: "i" },
      }).select("_id");
      if (clients.length > 0) {
        query.clientId = { $in: clients.map((c) => c._id) };
      } else {
        query.clientId = null;
      }
    }

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

    const stores = await Store.find(query)
      .populate("workflow.recceAssignedTo", "name")
      .populate("workflow.installationAssignedTo", "name")
      .populate("clientId", "clientName")
      .sort({ updatedAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stores");

    worksheet.mergeCells("A1:L3");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Stores Export";
    titleCell.font = { size: 18, bold: true, color: { argb: "FF1F2937" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    const headers = [
      "Store ID",
      "Client Code",
      "Dealer Code",
      "Vendor Code",
      "Zone",
      "State",
      "District",
      "City",
      "Address",
      "Status",
      "Recce User",
      "Installation User",
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

    stores.forEach((store: any, index) => {
      const row = worksheet.getRow(6 + index);
      row.values = [
        store.storeId || "-",
        store.clientCode || "-",
        store.dealerCode || "-",
        store.vendorCode || "-",
        store.location.zone || "-",
        store.location.state || "-",
        store.location.district || "-",
        store.location.city || "-",
        store.location.address || "-",
        store.currentStatus || "-",
        store.workflow.recceAssignedTo?.name || "-",
        store.workflow.installationAssignedTo?.name || "-",
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
      { width: 20 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 45 },
      { width: 25 },
      { width: 25 },
      { width: 25 },
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
      "attachment; filename=Stores_Export.xlsx",
    );
    res.send(buffer);
  } catch (error: any) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to export stores" });
  }
};

export const bulkAssignStoresToUser = async (
  req: Request | any,
  res: Response,
) => {
  try {
    const { userId } = req.params;
    const files =
      (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const user = await User.findById(userId).populate("roles");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
    const userRoleNames = userRoles.map((r: any) => r?.name).filter(Boolean);
    const isRecceUser = userRoleNames.includes("RECCE");
    const isInstallUser = userRoleNames.includes("INSTALLATION");

    if (!isRecceUser && !isInstallUser) {
      return res
        .status(400)
        .json({ message: "User must have RECCE or INSTALLATION role" });
    }

    let totalProcessed = 0;
    let totalSuccess = 0;
    let allErrors: any[] = [];

    for (const file of files) {
      try {
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { range: 4 });

        totalProcessed += rawData.length;

        for (const [index, row] of rawData.entries()) {
          const rowNum = index + 2;

          const storeId = row["Store ID"];
          const clientCode = row["Client Code"];
          const status = row["Status"];

          if (!storeId) {
            allErrors.push({ row: rowNum, error: "Store ID is missing" });
            continue;
          }

          const store = await Store.findOne({ storeId: storeId });
          if (!store) {
            allErrors.push({
              row: rowNum,
              error: `Store not found: ${storeId}`,
            });
            continue;
          }

          if (clientCode && store.clientCode !== clientCode) {
            allErrors.push({
              row: rowNum,
              error: `Client Code mismatch for ${storeId}`,
            });
            continue;
          }

          if (isRecceUser) {
            if (
              store.currentStatus === StoreStatus.RECCE_APPROVED ||
              store.currentStatus === StoreStatus.RECCE_SUBMITTED ||
              store.currentStatus === StoreStatus.INSTALLATION_ASSIGNED ||
              store.currentStatus === StoreStatus.INSTALLATION_SUBMITTED ||
              store.currentStatus === StoreStatus.COMPLETED
            ) {
              allErrors.push({
                row: rowNum,
                error: `Cannot assign recce to ${storeId} - recce already completed`,
              });
              continue;
            }

            await Store.findByIdAndUpdate(store._id, {
              $set: {
                "workflow.recceAssignedTo": userId,
                "workflow.recceAssignedBy": req.user._id,
                "recce.assignedDate": new Date(),
                currentStatus: StoreStatus.RECCE_ASSIGNED,
              },
            });
            totalSuccess++;
          } else if (isInstallUser) {
            if (
              store.currentStatus === StoreStatus.INSTALLATION_SUBMITTED ||
              store.currentStatus === StoreStatus.COMPLETED
            ) {
              allErrors.push({
                row: rowNum,
                error: `Cannot assign installation to ${storeId} - installation already completed`,
              });
              continue;
            }

            if (store.currentStatus !== StoreStatus.RECCE_APPROVED) {
              allErrors.push({
                row: rowNum,
                error: `Cannot assign installation to ${storeId} - recce not approved`,
              });
              continue;
            }

            await Store.findByIdAndUpdate(store._id, {
              $set: {
                "workflow.installationAssignedTo": userId,
                "workflow.installationAssignedBy": req.user._id,
                "installation.assignedDate": new Date(),
                currentStatus: StoreStatus.INSTALLATION_ASSIGNED,
              },
            });
            totalSuccess++;
          }
        }
      } catch (err: any) {
        allErrors.push({ error: "Parsing Error: " + err.message });
      }
    }

    res.status(200).json({
      message: "Bulk assignment processed",
      totalProcessed,
      successCount: totalSuccess,
      errorCount: allErrors.length,
      errors: allErrors,
    });
  } catch (error: any) {
    console.error("Bulk Assign Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const downloadStoreTemplate = async (req: Request, res: Response) => {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stores");
    const headers = [
      "Sr. No.",
      "Client Code",
      "Dealer Code",
      "Vendor Code & Name",
      "Dealer's Name",
      "State",
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
      { width: 15 },
      { width: 25 },
      { width: 30 },
      { width: 15 },
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
        "RELBAN240101",
        "DLR001",
        "ELORA CREATIVE ART",
        "Rajesh Kumar",
        "Maharashtra",
        "Mumbai",
        "Mumbai Suburban",
        "123 Main Street, Andheri West",
        10,
        5,
        "Flex",
      ],
      [
        2,
        "RELBAN240101",
        "DLR002",
        "ELORA CREATIVE ART",
        "Amit Sharma",
        "Delhi",
        "Delhi",
        "Central Delhi",
        "456 Park Avenue, Connaught Place",
        10,
        10,
        "LED",
      ],
      [
        3,
        "RELBAN240101",
        "DLR003",
        "ELORA CREATIVE ART",
        "Priya Singh",
        "Karnataka",
        "Bangalore",
        "Bangalore Urban",
        "789 MG Road, Indiranagar",
        15,
        10,
        "Digital",
      ],
      [
        4,
        "RELBAN240101",
        "DLR004",
        "ELORA CREATIVE ART",
        "Suresh Patel",
        "Maharashtra",
        "Pune",
        "Pune",
        "321 FC Road, Shivajinagar",
        20,
        10,
        "Flex",
      ],
      [
        5,
        "RELBAN240101",
        "DLR005",
        "ELORA CREATIVE ART",
        "Neha Gupta",
        "Telangana",
        "Hyderabad",
        "Hyderabad",
        "654 Banjara Hills, Road No 12",
        10,
        5,
        "LED",
      ],
      [
        6,
        "RELBAN240101",
        "DLR006",
        "ELORA CREATIVE ART",
        "Vikram Reddy",
        "Tamil Nadu",
        "Chennai",
        "Chennai",
        "987 Anna Salai, T Nagar",
        10,
        10,
        "Digital",
      ],
      [
        7,
        "RELBAN240101",
        "DLR007",
        "ELORA CREATIVE ART",
        "Anjali Verma",
        "West Bengal",
        "Kolkata",
        "Kolkata",
        "147 Park Street, Central Kolkata",
        15,
        10,
        "Flex",
      ],
      [
        8,
        "RELBAN240101",
        "DLR008",
        "ELORA CREATIVE ART",
        "Rahul Joshi",
        "Gujarat",
        "Ahmedabad",
        "Ahmedabad",
        "258 CG Road, Navrangpura",
        20,
        10,
        "LED",
      ],
      [
        9,
        "RELBAN240101",
        "DLR009",
        "ELORA CREATIVE ART",
        "Kavita Desai",
        "Rajasthan",
        "Jaipur",
        "Jaipur",
        "369 MI Road, C Scheme",
        10,
        5,
        "Digital",
      ],
      [
        10,
        "RELBAN240101",
        "DLR010",
        "ELORA CREATIVE ART",
        "Manoj Yadav",
        "Uttar Pradesh",
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
      "2. Client Code must exist in the system (optional field)",
      "3. Dealer Code must be unique for each store",
      "4. Width and Height should be in feet (numbers only)",
      "5. Refer to Validations sheet for Board Sizes and Types",
      "6. Delete sample data before uploading your actual data",
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

export const generateStoreExcel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const type = req.url.includes('/installation') ? 'installation' : 'recce';
    const store = await Store.findById(id).populate("workflow.recceAssignedTo workflow.installationAssignedTo", "name");

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Store Details");

    const headers = [
      "Client Code", "Store Code", "Store Name", "City", "Address", "Mobile No",
      "Element", "Width (Inch)", "Height (Inch)", "RECCE Person", "Installation Person"
    ];

    const headerRow = worksheet.getRow(1);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAB308" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 25;

    worksheet.columns = [
      { width: 15 }, { width: 15 }, { width: 30 }, { width: 15 }, { width: 40 },
      { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 20 }
    ];

    const reccePhotos = store.recce?.reccePhotos || [];
    const reccePerson = (store.workflow.recceAssignedTo as any)?.name || "-";
    const installPerson = (store.workflow.installationAssignedTo as any)?.name || "-";

    if (reccePhotos.length > 0) {
      reccePhotos.forEach((photo: any, index: number) => {
        const elements = photo.elements || [];
        if (elements.length > 0) {
          elements.forEach((el: any) => {
            const row = worksheet.addRow([
              store.clientCode || "-",
              store.storeCode || "-",
              store.storeName,
              store.location.city || "-",
              store.location.address || "-",
              store.contact?.mobile || "-",
              el.elementName,
              photo.measurements.unit === "in" ? photo.measurements.width : (photo.measurements.width * 12).toFixed(2),
              photo.measurements.unit === "in" ? photo.measurements.height : (photo.measurements.height * 12).toFixed(2),
              reccePerson,
              installPerson
            ]);
            row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            row.height = 30;
          });
        } else {
          const row = worksheet.addRow([
            store.clientCode || "-",
            store.storeCode || "-",
            store.storeName,
            store.location.city || "-",
            store.location.address || "-",
            store.contact?.mobile || "-",
            "-",
            photo.measurements.unit === "in" ? photo.measurements.width : (photo.measurements.width * 12).toFixed(2),
            photo.measurements.unit === "in" ? photo.measurements.height : (photo.measurements.height * 12).toFixed(2),
            reccePerson,
            installPerson
          ]);
          row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          row.height = 30;
        }
      });
    } else {
      const row = worksheet.addRow([
        store.clientCode || "-",
        store.storeCode || "-",
        store.storeName,
        store.location.city || "-",
        store.location.address || "-",
        store.contact?.mobile || "-",
        "-", "-", "-",
        reccePerson,
        installPerson
      ]);
      row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      row.height = 30;
    }

    worksheet.eachRow((row: Row, rowNumber: number) => {
      row.eachCell((cell: Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = type === 'installation' ? `INSTALLATION_${store.storeName}_${store.storeId}.xlsx` : `RECCE_${store.storeName}_${store.storeId}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Excel Gen Error:", error);
    res.status(500).json({ message: "Failed to generate Excel" });
  }
};

// --- NEW: Export Recce for Approval (Single/Bulk) ---
export const exportRecceForApproval = async (req: Request | any, res: Response) => {
  try {
    const { storeIds } = req.body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ message: "No stores selected" });
    }

    const stores = await Store.find({ _id: { $in: storeIds } }).populate("clientId", "clientName");

    if (stores.length === 0) {
      return res.status(404).json({ message: "No stores found" });
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Recce Approval");

    const headers = [
      "Store ID", "Store Name", "Store Code", "Client Code", "Client Name",
      "City", "District", "State", "Address", "Contact", "Mobile",
      "Photo Index", "Photo URL", "Width (in)", "Height (in)", "Unit",
      "Element", "Board Rate", "Total Board Cost", "Angle Charges", "Scaffolding",
      "Transportation", "Total Cost", "Current Status", "STATUS", "REJECTION_REASON"
    ];

    const headerRow = worksheet.getRow(1);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    headerRow.height = 30;

    worksheet.columns = [
      { width: 15 }, { width: 25 }, { width: 15 }, { width: 12 }, { width: 20 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 35 }, { width: 15 }, { width: 12 },
      { width: 10 }, { width: 50 }, { width: 10 }, { width: 10 }, { width: 8 },
      { width: 20 }, { width: 12 }, { width: 15 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 30 }
    ];

    let rowIndex = 2;
    stores.forEach((store: any) => {
      const reccePhotos = store.recce?.reccePhotos || [];
      if (reccePhotos.length === 0) return;

      reccePhotos.forEach((photo: any, photoIndex: number) => {
        const row = worksheet.getRow(rowIndex);
        row.values = [
          store.storeId || store.dealerCode,
          store.storeName,
          store.dealerCode,
          store.clientCode || "-",
          (store.clientId as any)?.clientName || "-",
          store.location.city || "-",
          store.location.district || "-",
          store.location.state || "-",
          store.location.address || "-",
          store.contact?.personName || "-",
          store.contact?.mobile || "-",
          photoIndex,
          photo.photo || "-",
          photo.measurements.width,
          photo.measurements.height,
          photo.measurements.unit,
          photo.elements?.[0]?.elementName || "-",
          store.costDetails?.boardRate || 0,
          store.costDetails?.totalBoardCost || 0,
          store.costDetails?.angleCharges || 0,
          store.costDetails?.scaffoldingCharges || 0,
          store.costDetails?.transportation || 0,
          store.commercials?.totalCost || 0,
          photo.approvalStatus || "PENDING",
          photo.approvalStatus || "PENDING",
          photo.rejectionReason || ""
        ];

        // Make photo URL clickable
        if (photo.photo) {
          const urlCell = row.getCell(13);
          urlCell.value = { text: "View Photo", hyperlink: photo.photo };
          urlCell.font = { color: { argb: "FF0000FF" }, underline: true };
        }

        // Add dropdown validation for STATUS column (column 25)
        const statusCell = row.getCell(25);
        statusCell.dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: ['"PENDING,APPROVED,REJECTED"'],
          showErrorMessage: true,
          errorTitle: "Invalid Status",
          error: "Please select PENDING, APPROVED, or REJECTED"
        };

        row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        row.height = 25;
        rowIndex++;
      });
    });

    worksheet.eachRow((row: Row, rowNumber: number) => {
      row.eachCell((cell: Cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Recce_Approval_${stores.length}_Stores_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to export recce", error: error.message });
  }
};

// --- NEW: Import Recce Approval from Excel ---
export const importRecceApproval = async (req: Request | any, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.getWorksheet("Recce Approval");

    if (!worksheet) {
      return res.status(400).json({ message: "Invalid Excel format. Sheet 'Recce Approval' not found." });
    }

    const updates: any[] = [];
    const errors: any[] = [];

    worksheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return; // Skip header

      const storeId = row.getCell(1).value;
      const photoIndex = row.getCell(12).value;
      const status = row.getCell(25).value;
      const rejectionReason = row.getCell(26).value || "";

      if (!storeId || photoIndex === null || photoIndex === undefined) {
        errors.push({ row: rowNumber, error: "Missing Store ID or Photo Index" });
        return;
      }

      if (!status || !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
        errors.push({ row: rowNumber, error: `Invalid status: ${status}` });
        return;
      }

      updates.push({ storeId, photoIndex, status, rejectionReason });
    });

    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation errors found", errors });
    }

    // Process updates
    let successCount = 0;
    for (const update of updates) {
      try {
        const store = await Store.findOne({ $or: [{ storeId: update.storeId }, { dealerCode: update.storeId }] });
        if (!store || !store.recce?.reccePhotos) continue;

        const photoIdx = parseInt(update.photoIndex);
        if (photoIdx < 0 || photoIdx >= store.recce.reccePhotos.length) continue;

        store.recce.reccePhotos[photoIdx].approvalStatus = update.status;
        store.recce.reccePhotos[photoIdx].approvedBy = req.user._id;
        store.recce.reccePhotos[photoIdx].approvedAt = new Date();
        if (update.status === "REJECTED" && update.rejectionReason) {
          store.recce.reccePhotos[photoIdx].rejectionReason = update.rejectionReason;
        }

        const approved = store.recce.reccePhotos.filter(p => p.approvalStatus === "APPROVED").length;
        const rejected = store.recce.reccePhotos.filter(p => p.approvalStatus === "REJECTED").length;
        const pending = store.recce.reccePhotos.filter(p => !p.approvalStatus || p.approvalStatus === "PENDING").length;

        store.recce.approvedPhotosCount = approved;
        store.recce.rejectedPhotosCount = rejected;
        store.recce.pendingPhotosCount = pending;

        if (approved > 0 && pending === 0) {
          store.currentStatus = StoreStatus.RECCE_APPROVED;
        } else if (approved === 0 && rejected === store.recce.reccePhotos.length) {
          store.currentStatus = StoreStatus.RECCE_REJECTED;
        } else {
          store.currentStatus = StoreStatus.RECCE_SUBMITTED;
        }

        await store.save();
        successCount++;
      } catch (err) {
        errors.push({ storeId: update.storeId, photoIndex: update.photoIndex, error: "Update failed" });
      }
    }

    res.status(200).json({
      message: "Import completed",
      successCount,
      totalProcessed: updates.length,
      errors
    });
  } catch (error: any) {
    console.error("Import Error:", error);
    res.status(500).json({ message: "Failed to import", error: error.message });
  }
};
