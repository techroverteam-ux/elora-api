import express from "express";
import multer from "multer";
import path from "path";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUsersByRole,
  exportUsers,
  downloadUserTemplate,
  uploadUsersBulk
} from "./user.controller";
import { protect } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/rbac.middleware";

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

router.use(protect);

router.get("/template", checkPermission("users", "view"), downloadUserTemplate);
router.post("/upload", checkPermission("users", "create"), upload.array("files"), uploadUsersBulk);
router.get("/export", checkPermission("users", "view"), exportUsers);

router
  .route("/")
  .post(checkPermission("users", "create"), createUser)
  .get(checkPermission("users", "view"), getAllUsers);

router
  .route("/:id")
  .get(checkPermission("users", "view"), getUserById)
  .put(checkPermission("users", "edit"), updateUser)
  .delete(checkPermission("users", "delete"), deleteUser);

router.get("/role/:roleCode", protect, getUsersByRole);

export default router;
