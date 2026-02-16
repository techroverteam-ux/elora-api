import express from "express";
import multer from "multer";
import path from "path"; // Import path
import {
  createStore,
  getAllStores,
  getStoreById,
  updateStore,
  deleteStore,
  uploadStoresBulk,
  assignStoresBulk,
  submitRecce,
  generateReccePPT,
  reviewRecce,
  submitInstallation,
  generateInstallationPPT,
  generateBulkPPT,
  downloadStoreTemplate,
  exportRecceTasks,
  exportInstallationTasks,
} from "./store.controller";
import { protect } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/rbac.middleware";

const router = express.Router();

// --- FIX: USE MEMORY STORAGE FOR VERCEL COMPATIBILITY ---
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
// ------------------------------------------------

router.use(protect);

router.get("/template", downloadStoreTemplate);
router.get("/export/recce", exportRecceTasks);
router.get("/export/installation", exportInstallationTasks);

router.post(
  "/upload",
  checkPermission("stores", "create"),
  upload.array("files"),
  uploadStoresBulk,
);

router
  .route("/")
  .post(checkPermission("stores", "create"), createStore)
  .get(checkPermission("stores", "view"), getAllStores);

router
  .route("/:id")
  .get(checkPermission("stores", "view"), getStoreById)
  .put(checkPermission("stores", "edit"), updateStore)
  .delete(checkPermission("stores", "delete"), deleteStore);

router.post("/assign", checkPermission("stores", "edit"), assignStoresBulk);

router.post(
  "/:id/recce",
  protect,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "side", maxCount: 1 },
    { name: "closeUp", maxCount: 1 },
  ]),
  submitRecce,
);

router.get("/:id/ppt/recce", protect, generateReccePPT);
router.post("/ppt/bulk", protect, generateBulkPPT);

router.post(
  "/:id/recce/review",
  checkPermission("stores", "edit"),
  reviewRecce,
);

// --- UPDATED: Accept TWO Installation Images ---
router.post(
  "/:id/installation",
  protect,
  upload.fields([
    { name: "after1", maxCount: 1 },
    { name: "after2", maxCount: 1 },
  ]),
  submitInstallation,
);

router.get("/:id/ppt/installation", protect, generateInstallationPPT);

export default router;
