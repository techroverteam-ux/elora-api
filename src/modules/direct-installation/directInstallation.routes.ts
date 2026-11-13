import express from "express";
import multer from "multer";
import { protect } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/rbac.middleware";
import { storeIdParamGuard } from "../../utils/access";
import {
  validateUpload,
  parseUploadFile,
  createDirectInstallation,
  uploadBoardPhoto,
  listDirectInstallations,
  getFilterOptions,
  exportDirectInstallations,
  downloadTemplate,
} from "./directInstallation.controller";

const router = express.Router();
// One photo per request keeps every call under Vercel's ~4.5 MB body limit.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const uploadPhoto: express.RequestHandler = (req, res, next) => {
  upload.single("photo")(req, res, (error: any) => {
    if (error instanceof multer.MulterError) {
      res.status(400).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Image exceeds 4 MB. Choose a smaller image or convert it to JPEG." : error.message });
      return;
    }
    next(error);
  });
};

router.use(protect);
// Sub Admin: a store id outside their clients is "not found"
router.param("id", storeIdParamGuard as any);

router.get("/", checkPermission("stores", "view"), listDirectInstallations);
router.get("/filters", checkPermission("stores", "view"), getFilterOptions);
router.get("/export", checkPermission("stores", "view"), exportDirectInstallations);
router.get("/template", checkPermission("stores", "create"), downloadTemplate);
router.post("/parse", checkPermission("stores", "create"), upload.single("file"), parseUploadFile);
router.post("/validate", checkPermission("stores", "create"), validateUpload);
router.post("/", checkPermission("stores", "create"), createDirectInstallation);
router.post("/:id/boards/:index/photo", checkPermission("stores", "edit"), uploadPhoto, uploadBoardPhoto);

export default router;
