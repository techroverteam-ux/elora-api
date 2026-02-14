import express from "express";
import {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  exportRoles
} from "./role.controller";
import { protect } from "../../middlewares/auth.middleware";
import { checkPermission } from "../../middlewares/rbac.middleware";

const router = express.Router();

router.use(protect);

// FIX: Changed "role" to "roles" to match DB permissions
router.get("/export", checkPermission("roles", "view"), exportRoles);

router
  .route("/")
  .post(checkPermission("roles", "create"), createRole)
  .get(checkPermission("roles", "view"), getAllRoles);

router
  .route("/:id")
  .get(checkPermission("roles", "view"), getRoleById)
  .put(checkPermission("roles", "edit"), updateRole)
  .delete(checkPermission("roles", "delete"), deleteRole);

export default router;
