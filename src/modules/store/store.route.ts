import express from "express";
import multer from "multer";
import path from "path";
import {
  createStore,
  getAllStores,
  getStoreById,
  updateStore,
  deleteStore,
  uploadStoresBulk,
  assignStoresBulk,
  unassignStoresBulk,
  submitRecce,
  reviewRecce,
  reviewReccePhoto,
  bulkApproveReccePhotos,
  submitInstallation,
  downloadStoreTemplate,
  exportRecceTasks,
  exportInstallationTasks,
  exportStores,
  exportSelectedStores,
  bulkAssignStoresToUser,
  generateStoreExcel,
  exportRecceForApproval,
  importRecceApproval,
  transferStores,
  getPendingWork,
  transferUserWork,
  directInstallStores,
  getCities,
} from "./store.controller";
import { generateReccePDF, generateInstallationPDF, generateBulkPDF } from "./pdf.controller";
import { generateBulkPPT, generateReccePPT, generateInstallationPPT } from "./ppt.controller";
import { protect } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/rbac.middleware";
import { storeIdParamGuard, requireStoreIdsInScope } from "../../utils/access";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(protect);

// Sub Admin: every /:id route and every bulk storeIds body is limited to
// stores of the clients mapped to them.
router.param("id", storeIdParamGuard as any);

// Static routes MUST come before dynamic /:id routes
router.get("/cities", getCities); // Remove permission check temporarily to test
router.get("/template", downloadStoreTemplate);
router.get("/export/recce", exportRecceTasks);
router.get("/export/installation", exportInstallationTasks);
router.get("/export", exportStores);
router.post("/export/selected", requireStoreIdsInScope, exportSelectedStores);

router.post("/recce/export-approval", protect, checkPermission("stores", "view"), requireStoreIdsInScope, exportRecceForApproval);
router.post("/recce/import-approval", protect, checkPermission("stores", "edit"), upload.single("file"), importRecceApproval);

router.post(
  "/upload",
  checkPermission("stores", "create"),
  upload.array("files"),
  uploadStoresBulk,
);

// BULK ROUTES - MUST BE BEFORE /:id ROUTES
router.post("/ppt/bulk", requireStoreIdsInScope, generateBulkPPT);
router.post("/pdf/bulk", requireStoreIdsInScope, generateBulkPDF);

router
  .route("/")
  .post(upload.any(), checkPermission("stores", "create"), createStore)
  .get(checkPermission("stores", "view"), getAllStores);

router.post("/assign", checkPermission("stores", "edit"), requireStoreIdsInScope, assignStoresBulk);
router.post("/unassign", checkPermission("stores", "edit"), requireStoreIdsInScope, unassignStoresBulk);
// Move a job (or all of a person's pending jobs) to someone else
router.post("/transfer", checkPermission("stores", "edit"), requireStoreIdsInScope, transferStores);
router.get("/pending-work/:userId", checkPermission("stores", "edit"), getPendingWork);
router.post("/transfer-user-work", checkPermission("stores", "edit"), transferUserWork);
// New store straight to an installer (no recce)
router.post("/direct-install", checkPermission("stores", "edit"), directInstallStores);

router.post(
  "/:id/recce",
  protect,
  upload.any(),
  submitRecce,
);

router.get("/:id/ppt/recce", protect, generateReccePPT);
router.get("/:id/pdf/recce", protect, generateReccePDF);
router.get("/:id/excel/recce", protect, generateStoreExcel);
router.get("/:id/excel/installation", protect, generateStoreExcel);

// Dynamic /:id routes MUST come after all static routes
router
  .route("/:id")
  .get(checkPermission("stores", "view"), getStoreById)
  .put(checkPermission("stores", "edit"), updateStore)
  .delete(deleteStore);

router.post(
  "/:id/recce/review",
  checkPermission("stores", "edit"),
  reviewRecce,
);

router.post(
  "/:id/recce/photos/:photoIndex/review",
  checkPermission("stores", "edit"),
  reviewReccePhoto,
);

router.post(
  "/:id/recce/approve-all",
  checkPermission("stores", "edit"),
  bulkApproveReccePhotos,
);

router.post(
  "/:id/installation",
  protect,
  upload.any(),
  submitInstallation,
);

router.get("/:id/ppt/installation", protect, generateInstallationPPT);
router.get("/:id/pdf/installation", protect, generateInstallationPDF);

export default router;
