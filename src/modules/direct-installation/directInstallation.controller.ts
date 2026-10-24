import { Request, Response } from "express";
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import Store, { StoreStatus } from "../store/store.model";
import Client from "../client/client.model";
import User from "../user/user.model";
import enhancedUploadService from "../../utils/enhancedUploadService";
import {
  getClientScope,
  applyStoreScope,
  isClientInScope,
  isStoreInScope,
  userHasRole,
} from "../../utils/access";

// ===========================================================================
// Direct installation
//
// The recce happens outside the app (photos arrive on WhatsApp), so an admin
// uploads an Excel sheet — one row per board — plus one photo per board. Each
// store is created with its recce assigned, submitted and approved in one go,
// and handed straight to the named installer (status INSTALLATION_ASSIGNED).
// ===========================================================================

const isAdminLike = (user: any) => userHasRole(user, "SUPER_ADMIN", "ADMIN", "SUB_ADMIN");
const isFieldOnly = (user: any) => !isAdminLike(user) && userHasRole(user, "RECCE", "INSTALLATION");

/** Older direct installs were saved before the flag existed: pre-approved boards, no recce visit. */
const LEGACY_DIRECT = {
  isDirectInstallation: { $ne: true },
  "workflow.recceAssignedTo": null,
  "recce.submittedDate": null,
  "recce.reccePhotos.0": { $exists: true },
  currentStatus: {
    $in: [
      StoreStatus.RECCE_APPROVED,
      StoreStatus.INSTALLATION_ASSIGNED,
      StoreStatus.INSTALLATION_SUBMITTED,
      StoreStatus.INSTALLATION_REJECTED,
      StoreStatus.COMPLETED,
    ],
  },
};
const DIRECT_FILTER = { $or: [{ isDirectInstallation: true }, LEGACY_DIRECT] };

/** Same test as DIRECT_FILTER, for a store already loaded. */
const isDirectStore = (st: any) =>
  st?.isDirectInstallation === true ||
  (!st?.workflow?.recceAssignedTo &&
    !st?.recce?.submittedDate &&
    (st?.recce?.reccePhotos?.length || 0) > 0 &&
    (LEGACY_DIRECT.currentStatus.$in as string[]).includes(st?.currentStatus));

// ---------------------------------------------------------------------------
// Excel columns. Headers are matched loosely (case, spaces and symbols are
// ignored), so "Dealer Code", "dealer_code" and "DEALER CODE" all work.
// ---------------------------------------------------------------------------
export const TEMPLATE_COLUMNS: Array<{ key: string; header: string; required?: boolean; note: string; aliases?: string[] }> = [
  { key: "clientCode", header: "Client Code", required: true, note: "From Client Management (see Lists sheet)" },
  { key: "dealerCode", header: "Dealer Code", required: true, note: "Same Dealer Code on several rows = one store with several boards" },
  { key: "storeName", header: "Store Name", required: true, note: "Dealer / shop name", aliases: ["Dealer Name", "Shop Name"] },
  { key: "city", header: "City", required: true, note: "" },
  { key: "district", header: "District", required: true, note: "" },
  { key: "state", header: "State", note: "" },
  { key: "zone", header: "Zone", note: "" },
  { key: "address", header: "Address", note: "" },
  { key: "pincode", header: "Pincode", note: "", aliases: ["Pin Code", "PIN"] },
  { key: "contactPerson", header: "Contact Person", note: "" },
  { key: "mobile", header: "Mobile", note: "", aliases: ["Mobile Number", "Phone", "Contact Number"] },
  { key: "vendorCode", header: "Vendor Code", note: "" },
  { key: "poNumber", header: "PO Number", note: "", aliases: ["PO No", "PO"] },
  { key: "installer", header: "Installer Name", required: true, note: "Exact name of an active Installation user (see Lists sheet)", aliases: ["Installer", "Installation User", "Installed By"] },
  { key: "priority", header: "Priority", note: "HIGH, MEDIUM or LOW (default MEDIUM)" },
  { key: "remark", header: "Store Remark", note: "", aliases: ["Remark", "Remarks"] },
  { key: "boardNo", header: "Board No", note: "1, 2, 3… per store. Names the photo: DEALERCODE_BOARDNO.jpg", aliases: ["Board", "Board Number", "Sr No"] },
  { key: "element", header: "Element", required: true, note: "Element mapped to this client (see Lists sheet)", aliases: ["Element Name", "Board Type"] },
  { key: "width", header: "Width", required: true, note: "Number" },
  { key: "height", header: "Height", required: true, note: "Number" },
  { key: "unit", header: "Unit", note: "ft or in (default ft)" },
  { key: "quantity", header: "Quantity", note: "Default 1", aliases: ["Qty"] },
  { key: "boardRemark", header: "Board Remark", note: "" },
  { key: "photoFile", header: "Photo File Name", note: "Optional. Leave empty to use DEALERCODE_BOARDNO", aliases: ["Photo", "Photo File", "Image"] },
];

const squash = (v: any) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADER_LOOKUP = new Map<string, string>();
TEMPLATE_COLUMNS.forEach((c) => {
  [c.header, c.key, ...(c.aliases || [])].forEach((h) => HEADER_LOOKUP.set(squash(h), c.key));
});

const text = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: any) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Map one raw Excel row ({header: value}) onto our keys. */
const normaliseRow = (raw: any) => {
  const row: Record<string, string> = {};
  Object.keys(raw || {}).forEach((h) => {
    const key = HEADER_LOOKUP.get(squash(h));
    if (key && row[key] === undefined) row[key] = text(raw[h]);
  });
  return row;
};

/** Photo name without extension, lowercased: what an uploaded file must be called. */
const photoKey = (s: string) => squash(s.replace(/\.[a-z0-9]{2,5}$/i, ""));

export interface ResolvedBoard {
  rowNumber: number;
  boardNo: string;
  elementId: string;
  elementName: string;
  width: number;
  height: number;
  unit: "ft" | "in";
  quantity: number;
  sqft: number;
  rate: number;
  cost: number;
  remark: string;
  photoKeys: string[];
  /** Board already on the store (update): its index in recce.reccePhotos. */
  existingIndex?: number;
  /** A recce photo is already saved for this board. */
  hasPhoto: boolean;
}
export interface ResolvedStore {
  key: string;
  dealerCode: string;
  storeName: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  city: string;
  district: string;
  state: string;
  zone: string;
  address: string;
  pincode: string;
  contactPerson: string;
  mobile: string;
  vendorCode: string;
  poNumber: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  remark: string;
  installerId: string;
  installerName: string;
  rowNumbers: number[];
  boards: ResolvedBoard[];
  totalSqft: number;
  totalCost: number;
  errors: string[];
  /** create = new store; update = existing direct installation store in the sheet */
  mode: "create" | "update";
  storeDbId?: string;
}

/**
 * Validate and resolve uploaded rows: clients, elements (with the client's
 * rate), installers by name, duplicates. Same function for the preview and
 * the actual import, so they can never disagree.
 */
export const resolveRows = async (req: any, rawRows: any[], firstRowNumber = 2) => {
  const scope = await getClientScope(req);
  const rowErrors: Array<{ row: number; message: string }> = [];

  const rows = rawRows
    .map((raw, i) => ({ rowNumber: Number(raw?.__rowNumber) || firstRowNumber + i, ...normaliseRow(raw) }))
    // Skip fully empty lines
    .filter((r: any) => TEMPLATE_COLUMNS.some((c) => text(r[c.key])));

  // Lookups, loaded once
  const clientCodes = Array.from(new Set(rows.map((r: any) => text(r.clientCode)).filter(Boolean)));
  const clients: any[] = clientCodes.length
    ? await Client.find({ clientCode: { $in: clientCodes.map((c) => new RegExp(`^${escapeRegex(c)}$`, "i")) } }).lean()
    : [];
  const clientByCode = new Map(clients.map((c) => [String(c.clientCode).toLowerCase(), c]));

  const installerNames = Array.from(new Set(rows.map((r: any) => text(r.installer).toLowerCase()).filter(Boolean)));
  const installerCandidates: any[] = installerNames.length
    ? await User.find({
        isActive: true,
        name: { $in: installerNames.map((n) => new RegExp(`^\\s*${escapeRegex(n)}\\s*$`, "i")) },
      })
        .populate("roles", "name code")
        .select("name email roles")
        .lean()
    : [];
  const installersByName = new Map<string, any[]>();
  installerCandidates
    .filter((u) => userHasRole(u, "INSTALLATION"))
    .forEach((u) => {
      const k = text(u.name).toLowerCase();
      installersByName.set(k, [...(installersByName.get(k) || []), u]);
    });

  const dealerCodes = Array.from(new Set(rows.map((r: any) => text(r.dealerCode)).filter(Boolean)));
  const existing: any[] = dealerCodes.length
    ? await Store.find({ dealerCode: { $in: dealerCodes } })
        .select("dealerCode storeName clientId clientCode location contact vendorCode commercials remark workflow currentStatus isDirectInstallation recce.submittedDate recce.reccePhotos")
        .populate("workflow.installationAssignedTo", "name isActive")
        .lean()
    : [];
  const existingByDealer = new Map(existing.map((s) => [String(s.dealerCode).toLowerCase(), s]));

  // Group rows into stores by dealer code
  const groups = new Map<string, any[]>();
  for (const r of rows as any[]) {
    const dc = text(r.dealerCode);
    if (!dc) {
      rowErrors.push({ row: r.rowNumber, message: "Dealer Code is required" });
      continue;
    }
    const k = dc.toLowerCase();
    groups.set(k, [...(groups.get(k) || []), r]);
  }

  const stores: ResolvedStore[] = [];
  for (const [key, group] of groups) {
    const first = group[0];
    const errors: string[] = [];
    const err = (row: number, message: string) => {
      errors.push(`Row ${row}: ${message}`);
      rowErrors.push({ row, message });
    };

    // ---- existing store? Only direct installations can be updated from this sheet
    const ex = existingByDealer.get(key);
    const exIsDirect = !!ex && isDirectStore(ex);
    const update = !!ex && exIsDirect;
    const exInstaller: any = ex?.workflow?.installationAssignedTo;
    const exFallback: Record<string, string> = ex
      ? {
          clientCode: text(ex.clientCode),
          storeName: text(ex.storeName),
          city: text(ex.location?.city),
          district: text(ex.location?.district),
          state: text(ex.location?.state),
          zone: text(ex.location?.zone),
          address: text(ex.location?.address),
          pincode: text(ex.location?.pincode),
          contactPerson: text(ex.contact?.personName),
          mobile: text(ex.contact?.mobile),
          vendorCode: text(ex.vendorCode),
          poNumber: text(ex.commercials?.poNumber),
          priority: text(ex.workflow?.priority),
          remark: text(ex.remark),
          installer: text(exInstaller?.name),
        }
      : {};

    // ---- store level (taken from any row; other rows may leave it blank).
    // When updating, a blank cell keeps what the store already has.
    const pick = (field: string) => text(group.find((g) => text(g[field]))?.[field]) || (update ? exFallback[field] || "" : "");
    const clientCode = pick("clientCode");
    const storeName = pick("storeName");
    const city = pick("city");
    const district = pick("district");
    const installer = pick("installer");

    if (!clientCode) err(first.rowNumber, "Client Code is required");
    if (!storeName) err(first.rowNumber, "Store Name is required");
    if (!city) err(first.rowNumber, "City is required");
    if (!district) err(first.rowNumber, "District is required");
    if (!installer) err(first.rowNumber, "Installer Name is required");

    // Rows of one store must agree on client and installer
    for (const g of group) {
      if (text(g.clientCode) && text(g.clientCode).toLowerCase() !== clientCode.toLowerCase())
        err(g.rowNumber, `Client Code differs from other rows of Dealer Code ${first.dealerCode}`);
      if (text(g.installer) && text(g.installer).toLowerCase() !== installer.toLowerCase())
        err(g.rowNumber, `Installer differs from other rows of Dealer Code ${first.dealerCode}`);
    }

    if (ex && !exIsDirect) {
      err(first.rowNumber, `Dealer Code ${first.dealerCode} already exists as a normal store (not a direct installation)`);
    } else if (update) {
      if (!isStoreInScope(scope, ex)) err(first.rowNumber, `Store ${first.dealerCode} belongs to a client that is not assigned to you`);
      if (clientCode && text(ex.clientCode) && clientCode.toLowerCase() !== text(ex.clientCode).toLowerCase())
        err(first.rowNumber, `Client of an existing store can't be changed (store is ${ex.clientCode})`);
    }

    const client = clientCode ? clientByCode.get(clientCode.toLowerCase()) : null;
    if (clientCode && !client) err(first.rowNumber, `Client Code ${clientCode} not found`);
    else if (client && !isClientInScope(scope, client._id)) err(first.rowNumber, `Client ${clientCode} is not assigned to you`);

    let installerUser: any = null;
    const sameInstaller = update && exInstaller?._id && installer.toLowerCase() === text(exInstaller.name).toLowerCase();
    if (sameInstaller) {
      installerUser = exInstaller;
    } else if (update && installer && !["RECCE_APPROVED", "INSTALLATION_ASSIGNED", "INSTALLATION_REJECTED"].includes(ex.currentStatus)) {
      err(first.rowNumber, `Installer can't be changed: store ${first.dealerCode} is already ${String(ex.currentStatus).replace(/_/g, " ").toLowerCase()}`);
    } else if (installer) {
      const matches = installersByName.get(installer.toLowerCase()) || [];
      if (matches.length === 0) err(first.rowNumber, `No active Installation user named "${installer}"`);
      else if (matches.length > 1)
        err(first.rowNumber, `${matches.length} Installation users are named "${installer}" (${matches.map((m) => m.email).join(", ")}). Rename one so names are unique`);
      else installerUser = matches[0];
    }

    const priorityRaw = pick("priority").toUpperCase();
    const priority = (["HIGH", "MEDIUM", "LOW"].includes(priorityRaw) ? priorityRaw : "MEDIUM") as ResolvedStore["priority"];
    if (priorityRaw && !["HIGH", "MEDIUM", "LOW"].includes(priorityRaw)) err(first.rowNumber, `Priority must be HIGH, MEDIUM or LOW`);

    // ---- boards
    const boards: ResolvedBoard[] = [];
    const usedBoardNos = new Set<string>();
    const exBoards: any[] = update ? ex.recce?.reccePhotos || [] : [];
    const exBoardNo = (p: any, i: number) => text(p.boardNo) || String(i + 1);
    group.forEach((g, i) => {
      const boardNo = text(g.boardNo) || String(update ? exBoards.length + i + 1 : i + 1);
      if (usedBoardNos.has(boardNo.toLowerCase())) err(g.rowNumber, `Board No ${boardNo} is used twice for Dealer Code ${first.dealerCode}`);
      usedBoardNos.add(boardNo.toLowerCase());

      // Existing board with the same Board No: blank cells keep its values
      const existingIndex = exBoards.findIndex((p, idx) => exBoardNo(p, idx).toLowerCase() === boardNo.toLowerCase());
      const eb = existingIndex >= 0 ? exBoards[existingIndex] : null;
      if (eb) {
        if (!text(g.width)) g.width = String(eb.measurements?.width ?? "");
        if (!text(g.height)) g.height = String(eb.measurements?.height ?? "");
        if (!text(g.unit)) g.unit = text(eb.measurements?.unit);
        if (!text(g.quantity)) g.quantity = String(eb.elements?.[0]?.quantity ?? "");
        if (!text(g.element)) g.element = text(eb.elements?.[0]?.elementName);
        if (!text(g.boardRemark)) g.boardRemark = text(eb.remark);
      }

      const width = num(g.width);
      const height = num(g.height);
      if (!(width > 0)) err(g.rowNumber, "Width must be a number above 0");
      if (!(height > 0)) err(g.rowNumber, "Height must be a number above 0");

      const unitRaw = text(g.unit).toLowerCase();
      const unit: "ft" | "in" = ["in", "inch", "inches", '"'].includes(unitRaw) ? "in" : "ft";
      if (unitRaw && !["ft", "feet", "foot", "'", "in", "inch", "inches", '"'].includes(unitRaw)) err(g.rowNumber, `Unit must be ft or in`);

      const qtyRaw = text(g.quantity);
      const quantity = qtyRaw ? Math.round(num(qtyRaw)) : 1;
      if (!(quantity >= 1)) err(g.rowNumber, "Quantity must be 1 or more");

      const elementName = text(g.element);
      let elementId = "";
      let rate = 0;
      let mappedName = elementName;
      if (!elementName) err(g.rowNumber, "Element is required");
      else if (client) {
        const el = (client.elements || []).find((e: any) => text(e.elementName).toLowerCase() === elementName.toLowerCase());
        if (!el) err(g.rowNumber, `Element "${elementName}" is not mapped to client ${client.clientCode}`);
        else {
          elementId = String(el.elementId);
          rate = Number(el.customRate) || 0;
          mappedName = el.elementName;
        }
      }

      const f = unit === "in" ? 1 / 12 : 1;
      const sqft = width > 0 && height > 0 ? width * f * (height * f) : 0;
      const keys = [photoKey(`${first.dealerCode}_${boardNo}`)];
      if (text(g.photoFile)) keys.unshift(photoKey(text(g.photoFile)));

      boards.push({
        rowNumber: g.rowNumber,
        boardNo,
        elementId,
        elementName: mappedName,
        width: width > 0 ? width : 0,
        height: height > 0 ? height : 0,
        unit,
        quantity: quantity >= 1 ? quantity : 1,
        sqft: Math.round(sqft * 100) / 100,
        rate,
        cost: Math.round(sqft * rate * (quantity >= 1 ? quantity : 1) * 100) / 100,
        remark: text(g.boardRemark),
        photoKeys: Array.from(new Set(keys)),
        ...(eb && { existingIndex }),
        hasPhoto: !!eb?.photo,
      });
    });

    stores.push({
      key,
      dealerCode: text(first.dealerCode),
      storeName,
      clientId: client ? String(client._id) : "",
      clientCode: client ? client.clientCode : clientCode,
      clientName: client ? client.clientName : "",
      city,
      district,
      state: pick("state"),
      zone: pick("zone"),
      address: pick("address"),
      pincode: pick("pincode"),
      contactPerson: pick("contactPerson"),
      mobile: pick("mobile"),
      vendorCode: pick("vendorCode"),
      poNumber: pick("poNumber"),
      priority,
      remark: pick("remark"),
      installerId: installerUser ? String(installerUser._id) : "",
      installerName: installerUser ? installerUser.name : installer,
      rowNumbers: group.map((g) => g.rowNumber),
      boards,
      totalSqft: Math.round(boards.reduce((a, b) => a + b.sqft * b.quantity, 0) * 100) / 100,
      totalCost: Math.round(boards.reduce((a, b) => a + b.cost, 0) * 100) / 100,
      errors,
      mode: update ? "update" : "create",
      ...(update && { storeDbId: String(ex._id) }),
    });
  }

  rowErrors.sort((a, b) => a.row - b.row);
  return { stores, errors: rowErrors, rowCount: rows.length };
};

/** Hide money from roles that shouldn't see it (field users). */
const stripMoney = (s: any) => ({
  ...s,
  totalCost: undefined,
  boards: (s.boards || []).map((b: any) => ({ ...b, rate: undefined, cost: undefined })),
});

// POST /direct-installations/parse   (multipart: file)
// Reads the Excel on the server and returns its rows, so the mobile app
// doesn't need to parse spreadsheets itself. Same rules as the web page:
// header row 1, Excel row numbers kept, grey example rows (DEMO001) skipped.
export const parseUploadFile = async (req: Request | any, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    const XLSX = require("xlsx");
    const wb = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = wb.Sheets["Direct Installation"] || wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, blankrows: true });
    const dealerOf = (r: any) => {
      const k = Object.keys(r).find((h) => squash(h) === "dealercode");
      return k ? text(r[k]) : "";
    };
    const rows = raw
      .map((r, i) => ({ ...r, __rowNumber: i + 2 }))
      .filter((r) => squash(dealerOf(r)) !== "demo001" && Object.entries(r).some(([k, v]) => k !== "__rowNumber" && text(v)));
    res.json({ rows, fileName: file.originalname });
  } catch (error: any) {
    res.status(400).json({ message: "Could not read this Excel file", error: error.message });
  }
};

// POST /direct-installations/validate   { rows: [...] }
export const validateUpload = async (req: Request | any, res: Response) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows) return res.status(400).json({ message: "rows must be an array" });
    if (rows.length > 5000) return res.status(400).json({ message: "Up to 5000 rows per upload. Split the file." });
    const result = await resolveRows(req, rows);
    const showMoney = isAdminLike(req.user);
    res.json({ ...result, stores: showMoney ? result.stores : result.stores.map(stripMoney) });
  } catch (error: any) {
    console.error("Direct installation validate error:", error);
    res.status(500).json({ message: "Failed to check the file", error: error.message });
  }
};

const makeStoreId = async (city: string, district: string, dealerCode: string) => {
  const base = `${city.trim().substring(0, 3)}${district.trim().substring(0, 3)}${dealerCode.trim()}`.toUpperCase().replace(/\s+/g, "");
  let candidate = base;
  for (let i = 2; await Store.exists({ storeId: candidate }); i++) candidate = `${base}-${i}`;
  return candidate;
};

// POST /direct-installations   { rows: [rows of ONE dealer code], batchId }
// Creates the store with recce assigned + submitted + approved and the
// installer assigned. Photos follow, one request per board.
export const createDirectInstallation = async (req: Request | any, res: Response) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows || rows.length === 0) return res.status(400).json({ message: "rows are required" });

    const { stores, errors } = await resolveRows(req, rows);
    if (stores.length !== 1) return res.status(400).json({ message: "Send the rows of exactly one Dealer Code per request" });
    const s = stores[0];
    if (errors.length || s.errors.length) return res.status(400).json({ message: s.errors[0] || errors[0]?.message, errors: s.errors });
    if (s.mode === "update") return updateExistingStore(req, res, s);

    const now = new Date();
    const uploader = req.user;
    const storeId = await makeStoreId(s.city, s.district, s.dealerCode);

    const store = new Store({
      dealerCode: s.dealerCode,
      storeId,
      storeName: s.storeName,
      vendorCode: s.vendorCode,
      clientCode: s.clientCode,
      clientId: s.clientId,
      createdBy: uploader._id,
      isDirectInstallation: true,
      importBatchId: text(req.body?.batchId) || undefined,
      location: {
        zone: s.zone,
        state: s.state,
        district: s.district,
        city: s.city,
        area: s.district,
        address: s.address,
        pincode: s.pincode,
      },
      contact: { personName: s.contactPerson, mobile: s.mobile },
      commercials: { poNumber: s.poNumber, totalCost: s.totalCost },
      costDetails: { totalBoardCost: s.totalCost, boardRate: s.boards[0]?.rate || 0 },
      remark: s.remark,
      workflow: {
        priority: s.priority,
        installationAssignedTo: s.installerId,
        installationAssignedBy: uploader._id,
      },
      recce: {
        assignedDate: now,
        submittedDate: now,
        submittedBy: `${uploader.name} (Excel upload)`,
        initialPhotos: [],
        reccePhotos: s.boards.map((b) => ({
          photo: "",
          measurements: { width: b.width, height: b.height, unit: b.unit },
          elements: [{ elementId: b.elementId, elementName: b.elementName, quantity: b.quantity, customRate: b.rate }],
          approvalStatus: "APPROVED",
          approvedBy: uploader._id,
          approvedAt: now,
          boardNo: b.boardNo,
          remark: b.remark,
        })),
        approvedPhotosCount: s.boards.length,
        pendingPhotosCount: 0,
        rejectedPhotosCount: 0,
        heldPhotosCount: 0,
        costDetails: { totalBoardCost: s.totalCost },
        commercials: { totalCost: s.totalCost },
      },
      installation: { assignedDate: now },
      currentStatus: StoreStatus.INSTALLATION_ASSIGNED,
    });

    await store.save();
    res.status(201).json({
      message: "Store created",
      store: { _id: store._id, storeId: store.storeId, dealerCode: store.dealerCode },
      mode: "create",
      boards: s.boards.map((b, index) => ({ index, boardNo: b.boardNo, photoKeys: b.photoKeys, hasPhoto: false })),
    });
  } catch (error: any) {
    if (error?.code === 11000) return res.status(400).json({ message: "A store with this Dealer Code already exists" });
    console.error("Direct installation create error:", error);
    res.status(500).json({ message: "Failed to create store", error: error.message });
  }
};

/**
 * Re-upload of an existing direct installation (from the pre-filled template):
 * update store details, update boards matched by Board No, add new boards.
 * Boards missing from the sheet are kept; photos are kept unless a new one is sent.
 */
const updateExistingStore = async (req: any, res: Response, s: ResolvedStore) => {
  const store: any = await Store.findById(s.storeDbId);
  if (!store) return res.status(404).json({ message: "Store not found" });
  const now = new Date();
  const uploader = req.user;

  store.storeName = s.storeName;
  store.vendorCode = s.vendorCode;
  store.remark = s.remark;
  store.isDirectInstallation = true;
  store.set("location.zone", s.zone);
  store.set("location.state", s.state);
  store.set("location.district", s.district);
  store.set("location.city", s.city);
  store.set("location.address", s.address);
  store.set("location.pincode", s.pincode);
  store.set("contact.personName", s.contactPerson);
  store.set("contact.mobile", s.mobile);
  store.set("commercials.poNumber", s.poNumber);
  store.set("workflow.priority", s.priority);

  // Installer (only changeable before installation was submitted — checked in resolveRows)
  if (s.installerId && String(store.workflow?.installationAssignedTo || "") !== s.installerId) {
    store.set("workflow.installationAssignedTo", s.installerId);
    store.set("workflow.installationAssignedBy", uploader._id);
    store.set("installation.assignedDate", now);
  }
  if (store.currentStatus === StoreStatus.RECCE_APPROVED && store.workflow?.installationAssignedTo) {
    store.currentStatus = StoreStatus.INSTALLATION_ASSIGNED;
  }

  // Older direct installs never had their recce dated
  if (!store.recce?.submittedDate) {
    store.set("recce.assignedDate", now);
    store.set("recce.submittedDate", now);
    store.set("recce.submittedBy", `${uploader.name} (Excel upload)`);
  }

  const boardsOut: Array<{ index: number; boardNo: string; photoKeys: string[]; hasPhoto: boolean }> = [];
  const photos: any[] = store.recce?.reccePhotos || [];
  for (const b of s.boards) {
    const element = { elementId: b.elementId, elementName: b.elementName, quantity: b.quantity, customRate: b.rate };
    if (b.existingIndex !== undefined && photos[b.existingIndex]) {
      const p = photos[b.existingIndex];
      p.measurements = { width: b.width, height: b.height, unit: b.unit };
      p.elements = [element];
      p.boardNo = b.boardNo;
      p.remark = b.remark;
      boardsOut.push({ index: b.existingIndex, boardNo: b.boardNo, photoKeys: b.photoKeys, hasPhoto: !!p.photo });
    } else {
      photos.push({
        photo: "",
        measurements: { width: b.width, height: b.height, unit: b.unit },
        elements: [element],
        approvalStatus: "APPROVED",
        approvedBy: uploader._id,
        approvedAt: now,
        boardNo: b.boardNo,
        remark: b.remark,
      });
      boardsOut.push({ index: photos.length - 1, boardNo: b.boardNo, photoKeys: b.photoKeys, hasPhoto: false });
    }
  }
  store.set("recce.reccePhotos", photos);

  // Totals over every board on the store, not only the ones in the sheet
  const total =
    Math.round(
      photos.reduce((a: number, p: any) => {
        const f = p.measurements?.unit === "in" ? 1 / 12 : 1;
        const sq = (Number(p.measurements?.width) || 0) * f * ((Number(p.measurements?.height) || 0) * f);
        const el = p.elements?.[0] || {};
        return a + sq * (Number(el.customRate) || 0) * (Number(el.quantity) || 1);
      }, 0) * 100
    ) / 100;
  store.set("recce.costDetails.totalBoardCost", total);
  store.set("recce.commercials.totalCost", total);
  store.set("costDetails.totalBoardCost", total);
  store.set("commercials.totalCost", total);
  store.set("recce.approvedPhotosCount", photos.filter((p: any) => p.approvalStatus === "APPROVED").length);
  if (text(req.body?.batchId)) store.importBatchId = text(req.body.batchId);

  await store.save();
  res.json({
    message: "Store updated",
    mode: "update",
    store: { _id: store._id, storeId: store.storeId, dealerCode: store.dealerCode },
    boards: boardsOut,
  });
};

// POST /direct-installations/:id/boards/:index/photo   (multipart: photo)
// Adds or replaces the recce photo of one board.
export const uploadBoardPhoto = async (req: Request | any, res: Response) => {
  try {
    const { id, index } = req.params;
    const i = Number(index);
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: "Store not found" });
    const file = (req.file as Express.Multer.File) || (req.files as Express.Multer.File[])?.[0];
    if (!file) return res.status(400).json({ message: "No photo uploaded" });
    if (!/^image\//.test(file.mimetype)) return res.status(400).json({ message: "Only image files can be uploaded" });

    const store: any = await Store.findById(id);
    if (!store || !isStoreInScope(await getClientScope(req), store)) return res.status(404).json({ message: "Store not found" });
    const boards = store.recce?.reccePhotos || [];
    if (!Number.isInteger(i) || i < 0 || i >= boards.length) return res.status(400).json({ message: "Board not found" });

    const ext = (file.originalname.match(/\.[a-z0-9]{2,5}$/i)?.[0] || ".jpg").toLowerCase();
    const link = await enhancedUploadService.uploadFile(
      file.buffer,
      `recce_board${boards[i].boardNo || i + 1}${ext}`,
      file.mimetype,
      store.clientCode || store.dealerCode || "DEFAULT",
      store.storeId || String(store._id),
      "recce",
      String(req.user?.name || "admin").replace(/\s+/g, "_"),
    );

    store.set(`recce.reccePhotos.${i}.photo`, link);
    await store.save();
    res.json({ message: "Photo saved", photo: link, index: i });
  } catch (error: any) {
    console.error("Direct installation photo error:", error);
    res.status(500).json({ message: "Failed to save the photo", error: error.message });
  }
};

// ---------------------------------------------------------------------------
// List / export
// ---------------------------------------------------------------------------
const csv = (v: any): string[] =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((x) => String(x).trim())
    .filter(Boolean);

const buildListQuery = async (req: any) => {
  const q = req.query || {};
  const and: any[] = [DIRECT_FILTER];

  if (isFieldOnly(req.user)) {
    and.push({ $or: [{ "workflow.installationAssignedTo": req.user._id }, { createdBy: req.user._id }] });
  }

  const statuses = csv(q.status);
  if (statuses.length) and.push({ currentStatus: { $in: statuses } });
  const clients = csv(q.clientCode);
  if (clients.length) and.push({ clientCode: { $in: clients } });
  const cities = csv(q.city);
  if (cities.length) and.push({ "location.city": { $in: cities.map((c) => new RegExp(`^${escapeRegex(c)}$`, "i")) } });
  const states = csv(q.state);
  if (states.length) and.push({ "location.state": { $in: states.map((c) => new RegExp(`^${escapeRegex(c)}$`, "i")) } });
  const installers = csv(q.installer).filter((x) => mongoose.isValidObjectId(x));
  if (installers.length) and.push({ "workflow.installationAssignedTo": { $in: installers } });
  if (text(q.batchId)) and.push({ importBatchId: text(q.batchId) });
  if (q.photos === "missing") and.push({ "recce.reccePhotos": { $elemMatch: { $or: [{ photo: "" }, { photo: null }, { photo: { $exists: false } }] } } });

  const from = q.from ? new Date(String(q.from)) : null;
  const to = q.to ? new Date(String(q.to)) : null;
  if ((from && !isNaN(+from)) || (to && !isNaN(+to))) {
    const range: any = {};
    if (from && !isNaN(+from)) range.$gte = from;
    if (to && !isNaN(+to)) {
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
    and.push({ createdAt: range });
  }

  if (text(q.search)) {
    const r = new RegExp(escapeRegex(text(q.search)), "i");
    and.push({ $or: [{ storeName: r }, { dealerCode: r }, { storeId: r }, { "location.city": r }, { clientCode: r }] });
  }

  return applyStoreScope({ $and: and }, await getClientScope(req));
};

const boardRows = (store: any, showMoney: boolean) =>
  (store.recce?.reccePhotos || []).map((p: any, index: number) => {
    const w = Number(p.measurements?.width) || 0;
    const h = Number(p.measurements?.height) || 0;
    const f = p.measurements?.unit === "in" ? 1 / 12 : 1;
    const sqft = Math.round(w * f * (h * f) * 100) / 100;
    const el = p.elements?.[0] || {};
    const quantity = Number(el.quantity) || 1;
    const rate = Number(el.customRate) || 0;
    return {
      index,
      boardNo: p.boardNo || String(index + 1),
      photo: p.photo || "",
      elementName: el.elementName || "",
      width: w,
      height: h,
      unit: p.measurements?.unit || "ft",
      quantity,
      sqft,
      approvalStatus: p.approvalStatus,
      remark: p.remark || "",
      installedPhotos: (store.installation?.photos || []).filter((ip: any) => ip.reccePhotoIndex === index).length,
      ...(showMoney && { rate, cost: Math.round(sqft * rate * quantity * 100) / 100 }),
    };
  });

const shapeStore = (s: any, showMoney: boolean) => {
  const boards = boardRows(s, showMoney);
  return {
    _id: s._id,
    storeId: s.storeId,
    dealerCode: s.dealerCode,
    storeName: s.storeName,
    clientCode: s.clientCode,
    clientName: s.clientId?.clientName || "",
    location: s.location,
    contact: s.contact,
    currentStatus: s.currentStatus,
    priority: s.workflow?.priority,
    installer: s.workflow?.installationAssignedTo
      ? { _id: s.workflow.installationAssignedTo._id, name: s.workflow.installationAssignedTo.name }
      : null,
    createdBy: s.createdBy ? { _id: s.createdBy._id, name: s.createdBy.name } : null,
    createdAt: s.createdAt,
    installAssignedAt: s.installation?.assignedDate,
    installedAt: s.installation?.submittedDate,
    importBatchId: s.importBatchId,
    remark: s.remark,
    boards,
    boardCount: boards.length,
    photosMissing: boards.filter((b: any) => !b.photo).length,
    totalSqft: Math.round(boards.reduce((a: number, b: any) => a + b.sqft * b.quantity, 0) * 100) / 100,
    ...(showMoney && { totalCost: Math.round(boards.reduce((a: number, b: any) => a + (b.cost || 0), 0) * 100) / 100 }),
  };
};

const populateList = (q: any) =>
  q
    .populate("clientId", "clientName")
    .populate("workflow.installationAssignedTo", "name")
    .populate("createdBy", "name");

// GET /direct-installations
export const listDirectInstallations = async (req: Request | any, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const query = await buildListQuery(req);
    const showMoney = isAdminLike(req.user);

    const [total, stores, statusCounts] = await Promise.all([
      Store.countDocuments(query),
      populateList(Store.find(query))
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Store.aggregate([{ $match: query }, { $group: { _id: "$currentStatus", count: { $sum: 1 } } }]),
    ]);

    res.json({
      stores: stores.map((s: any) => shapeStore(s, showMoney)),
      statusCounts: Object.fromEntries(statusCounts.map((c: any) => [c._id, c.count])),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("Direct installation list error:", error);
    res.status(500).json({ message: "Failed to load direct installations", error: error.message });
  }
};

// GET /direct-installations/filters  — options for the filter dropdowns (scoped)
export const getFilterOptions = async (req: Request | any, res: Response) => {
  try {
    const query = await buildListQuery({ ...req, query: {} });
    const [clientCodes, cities, states, installerIds] = await Promise.all([
      Store.distinct("clientCode", query),
      Store.distinct("location.city", query),
      Store.distinct("location.state", query),
      Store.distinct("workflow.installationAssignedTo", query),
    ]);
    const installers = await User.find({ _id: { $in: installerIds.filter(Boolean) } }).select("name").sort({ name: 1 }).lean();
    const clean = (a: any[]) => Array.from(new Set(a.filter((x) => x && String(x).trim()).map((x) => String(x).trim()))).sort();
    res.json({
      clientCodes: clean(clientCodes),
      cities: clean(cities),
      states: clean(states),
      installers: installers.map((u: any) => ({ _id: u._id, name: u.name })),
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to load filters", error: error.message });
  }
};

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

// GET /direct-installations/export   — one row per board, same filters as the list
export const exportDirectInstallations = async (req: Request | any, res: Response) => {
  try {
    const query = await buildListQuery(req);
    const showMoney = isAdminLike(req.user);
    const stores = await populateList(Store.find(query)).sort({ createdAt: -1 }).limit(20000).lean();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Direct Installation");
    const cols: Array<{ header: string; key: string; width: number }> = [
      { header: "Store ID", key: "storeId", width: 18 },
      { header: "Dealer Code", key: "dealerCode", width: 14 },
      { header: "Store Name", key: "storeName", width: 28 },
      { header: "Client Code", key: "clientCode", width: 14 },
      { header: "Client Name", key: "clientName", width: 22 },
      { header: "Zone", key: "zone", width: 10 },
      { header: "State", key: "state", width: 16 },
      { header: "District", key: "district", width: 16 },
      { header: "City", key: "city", width: 16 },
      { header: "Address", key: "address", width: 34 },
      { header: "Pincode", key: "pincode", width: 10 },
      { header: "Contact Person", key: "contactPerson", width: 18 },
      { header: "Mobile", key: "mobile", width: 14 },
      { header: "Installer", key: "installer", width: 18 },
      { header: "Status", key: "status", width: 22 },
      { header: "Board No", key: "boardNo", width: 9 },
      { header: "Element", key: "element", width: 22 },
      { header: "Width", key: "width", width: 8 },
      { header: "Height", key: "height", width: 8 },
      { header: "Unit", key: "unit", width: 6 },
      { header: "Quantity", key: "quantity", width: 9 },
      { header: "Sq.Ft (each)", key: "sqft", width: 11 },
      ...(showMoney ? [{ header: "Rate / Sq.Ft", key: "rate", width: 11 }, { header: "Board Cost", key: "cost", width: 12 }] : []),
      { header: "Recce Photo", key: "photo", width: 12 },
      { header: "Installation Photos", key: "installedPhotos", width: 12 },
      { header: "Board Remark", key: "boardRemark", width: 22 },
      { header: "Store Remark", key: "remark", width: 22 },
      { header: "Uploaded By", key: "createdBy", width: 18 },
      { header: "Uploaded On", key: "createdAt", width: 14 },
      { header: "Installed On", key: "installedAt", width: 14 },
    ];
    ws.columns = cols;
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAB308" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    for (const raw of stores as any[]) {
      const s = shapeStore(raw, showMoney);
      for (const b of s.boards as any[]) {
        ws.addRow({
          storeId: s.storeId,
          dealerCode: s.dealerCode,
          storeName: s.storeName,
          clientCode: s.clientCode,
          clientName: s.clientName,
          zone: s.location?.zone,
          state: s.location?.state,
          district: s.location?.district,
          city: s.location?.city,
          address: s.location?.address,
          pincode: s.location?.pincode,
          contactPerson: s.contact?.personName,
          mobile: s.contact?.mobile,
          installer: s.installer?.name || "",
          status: String(s.currentStatus || "").replace(/_/g, " "),
          boardNo: b.boardNo,
          element: b.elementName,
          width: b.width,
          height: b.height,
          unit: b.unit,
          quantity: b.quantity,
          sqft: b.sqft,
          rate: b.rate,
          cost: b.cost,
          photo: b.photo ? "Yes" : "Missing",
          installedPhotos: b.installedPhotos,
          boardRemark: b.remark,
          remark: s.remark,
          createdBy: s.createdBy?.name || "",
          createdAt: fmtDate(s.createdAt),
          installedAt: fmtDate(s.installedAt),
        });
      }
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Direct_Installation_${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error("Direct installation export error:", error);
    res.status(500).json({ message: "Failed to export", error: error.message });
  }
};

// GET /direct-installations/template  — upload sheet + instructions + lists (scoped to the user's clients)
// ?prefill=1 (plus the list filters) fills the sheet with existing direct
// installations, one row per board; blank required cells are highlighted.
export const downloadTemplate = async (req: Request | any, res: Response) => {
  try {
    const scope = await getClientScope(req);
    const clients: any[] = await Client.find(scope ? { _id: { $in: scope.ids } } : { isActive: { $ne: false } })
      .select("clientCode clientName elements")
      .sort({ clientName: 1 })
      .lean();
    const installers: any[] = (
      await User.find({ isActive: true }).populate("roles", "name code").select("name email roles").sort({ name: 1 }).lean()
    ).filter((u: any) => userHasRole(u, "INSTALLATION"));

    const wb = new ExcelJS.Workbook();

    const prefill = String(req.query.prefill || "") === "1";

    // 1. Upload sheet (two info-only columns at the end when pre-filled; ignored on upload)
    const ws = wb.addWorksheet("Direct Installation");
    ws.columns = [
      ...TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 4) })),
      ...(prefill
        ? [
            { header: "Recce Photo On File (info)", key: "_photo", width: 16 },
            { header: "Current Status (info)", key: "_status", width: 22 },
          ]
        : []),
    ];
    TEMPLATE_COLUMNS.forEach((c, i) => {
      const cell = ws.getRow(1).getCell(i + 1);
      cell.font = { bold: true, color: { argb: c.required ? "FFFFFFFF" : "FF1F2937" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? "FFEAB308" : "FFFDE68A" } };
      if (c.note) cell.note = c.note;
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const exClient = clients[0];
    const exElements = (exClient?.elements || []).slice(0, 2);
    const exInstaller = installers[0]?.name || "Installer Name";
    if (prefill) {
      const query = await buildListQuery(req);
      const stores: any[] = await Store.find(query)
        .populate("workflow.installationAssignedTo", "name")
        .sort({ clientCode: 1, dealerCode: 1 })
        .limit(5000)
        .lean();
      for (const st of stores) {
        const boards: any[] = st.recce?.reccePhotos || [];
        boards.forEach((p: any, i: number) => {
          const el = p.elements?.[0] || {};
          const row = ws.addRow({
            clientCode: st.clientCode,
            dealerCode: st.dealerCode,
            storeName: st.storeName,
            city: st.location?.city,
            district: st.location?.district,
            state: st.location?.state,
            zone: st.location?.zone,
            address: st.location?.address,
            pincode: st.location?.pincode,
            contactPerson: st.contact?.personName,
            mobile: st.contact?.mobile,
            vendorCode: st.vendorCode,
            poNumber: st.commercials?.poNumber,
            installer: st.workflow?.installationAssignedTo?.name || "",
            priority: st.workflow?.priority || "MEDIUM",
            remark: st.remark,
            boardNo: p.boardNo || String(i + 1),
            element: el.elementName || "",
            width: p.measurements?.width || "",
            height: p.measurements?.height || "",
            unit: p.measurements?.unit || "ft",
            quantity: el.quantity || 1,
            boardRemark: p.remark || "",
            photoFile: "",
            _photo: p.photo ? "Yes" : "No - add photo",
            _status: String(st.currentStatus || "").replace(/_/g, " "),
          });
          // Highlight what the user still has to fill
          TEMPLATE_COLUMNS.forEach((c, ci) => {
            if (!c.required) return;
            const cell = row.getCell(ci + 1);
            if (cell.value === null || cell.value === undefined || String(cell.value).trim() === "") {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } };
            }
          });
          if (!p.photo) row.getCell(TEMPLATE_COLUMNS.length + 1).font = { bold: true, color: { argb: "FFB45309" } };
        });
      }
      [TEMPLATE_COLUMNS.length + 1, TEMPLATE_COLUMNS.length + 2].forEach((ci) => {
        const h = ws.getRow(1).getCell(ci);
        h.font = { bold: true, color: { argb: "FF6B7280" } };
        h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
        h.note = "Information only. Ignored when you upload.";
      });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TEMPLATE_COLUMNS.length + 2 } };
    } else if (exClient && exElements.length) {
      const base = {
        clientCode: exClient.clientCode, dealerCode: "DEMO001", storeName: "Example Store (delete this row)",
        city: "Jodhpur", district: "Jodhpur", state: "Rajasthan", zone: "North", address: "Main Road",
        pincode: "342001", contactPerson: "Owner", mobile: "9999999999", installer: exInstaller, priority: "MEDIUM",
      };
      ws.addRow({ ...base, boardNo: 1, element: exElements[0].elementName, width: 10, height: 4, unit: "ft", quantity: 1 });
      ws.addRow({ dealerCode: "DEMO001", boardNo: 2, element: (exElements[1] || exElements[0]).elementName, width: 36, height: 24, unit: "in", quantity: 2 });
      [2, 3].forEach((r) => (ws.getRow(r).font = { italic: true, color: { argb: "FF9CA3AF" } }));
    }

    // 2. Instructions
    const help = wb.addWorksheet("Instructions");
    help.columns = [{ width: 24 }, { width: 12 }, { width: 80 }];
    help.addRow(["Direct Installation upload"]).font = { bold: true, size: 14 };
    [
      "One row per BOARD. Rows with the same Dealer Code become one store with several boards.",
      "Store details (client, name, city, installer…) only need to be filled on the first row of each Dealer Code.",
      "Every board needs a recce photo. Name each photo DEALERCODE_BOARDNO (e.g. DEMO001_1.jpg, DEMO001_2.jpg),",
      "or put the file name in the Photo File Name column. Then select the Excel and all photos together on the upload page.",
      "On upload, the recce is marked assigned, submitted and approved, and the store goes to the installer.",
      "Rates come from the client's element mapping. Delete the grey example rows before uploading.",
      "Pre-filled sheet: rows of stores that already exist update those stores. Red cells are required and still empty.",
      "Boards are matched by Board No. Change a value to correct it, add a row with a new Board No to add a board.",
      "Boards you delete from the sheet are NOT removed from the store. Existing photos are kept unless you send a new one.",
    ].forEach((l) => help.addRow([l]));
    help.addRow([]);
    help.addRow(["Column", "Required", "Notes"]).font = { bold: true };
    TEMPLATE_COLUMNS.forEach((c) => help.addRow([c.header, c.required ? "Yes" : "", c.note]));

    // 3. Lists
    const lists = wb.addWorksheet("Lists");
    lists.columns = [{ width: 16 }, { width: 28 }, { width: 28 }, { width: 4 }, { width: 26 }, { width: 30 }];
    lists.addRow(["Client Code", "Client Name", "Element", "", "Installer Name", "Email"]).font = { bold: true };
    const clientLines: string[][] = [];
    clients.forEach((c) => (c.elements?.length ? c.elements : [{ elementName: "(no elements mapped)" }]).forEach((e: any) => clientLines.push([c.clientCode, c.clientName, e.elementName])));
    const n = Math.max(clientLines.length, installers.length);
    for (let i = 0; i < n; i++) {
      const c = clientLines[i] || ["", "", ""];
      const u = installers[i];
      lists.addRow([...c, "", u?.name || "", u?.email || ""]);
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${prefill ? `Direct_Installation_Data_${new Date().toISOString().slice(0, 10)}` : "Direct_Installation_Template"}.xlsx`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error("Direct installation template error:", error);
    res.status(500).json({ message: "Failed to build template", error: error.message });
  }
};
