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
  generateReccePPT,
  reviewRecce,
  reviewReccePhoto,
  bulkApproveReccePhotos,
  submitInstallation,
  generateInstallationPPT,
  downloadStoreTemplate,
  exportRecceTasks,
  exportInstallationTasks,
  exportStores,
  bulkAssignStoresToUser,
  generateStoreExcel,
  exportRecceForApproval,
  importRecceApproval,
} from "./store.controller";
import { generateReccePDF, generateInstallationPDF, generateBulkPDF } from "./pdf.controller";
import { generateBulkPPT } from "./ppt.controller";
import { protect } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/rbac.middleware";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(protect);

router.get("/template", downloadStoreTemplate);
router.get("/export/recce", exportRecceTasks);
router.get("/export/installation", exportInstallationTasks);
router.get("/export", exportStores);

router.post("/recce/export-approval", protect, checkPermission("stores", "view"), exportRecceForApproval);
router.post("/recce/import-approval", protect, checkPermission("stores", "edit"), upload.single("file"), importRecceApproval);

router.post(
  "/upload",
  checkPermission("stores", "create"),
  upload.array("files"),
  uploadStoresBulk,
);

// BULK ROUTES - MUST BE BEFORE /:id ROUTES
router.post("/ppt/bulk", generateBulkPPT);
router.post("/pdf/bulk", generateBulkPDF);

router
  .route("/")
  .post(checkPermission("stores", "create"), createStore)
  .get(checkPermission("stores", "view"), getAllStores);

router.post("/assign", checkPermission("stores", "edit"), assignStoresBulk);
router.post("/unassign", checkPermission("stores", "edit"), unassignStoresBulk);

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

router
  .route("/:id")
  .get(checkPermission("stores", "view"), getStoreById)
  .put(checkPermission("stores", "edit"), updateStore)
  .delete(checkPermission("stores", "delete"), deleteStore);

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
