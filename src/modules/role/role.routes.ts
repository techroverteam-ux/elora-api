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

/**
 * @swagger
 * /api/v1/roles/export:
 *   get:
 *     summary: Export roles to Excel
 *     description: Exports all roles and permissions to an Excel file
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file with roles
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export", checkPermission("roles", "view"), exportRoles);

/**
 * @swagger
 * /api/v1/roles:
 *   post:
 *     summary: Create a new role
 *     description: Create a new role with specific permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               permissions:
 *                 type: object
 *                 properties:
 *                   stores:
 *                     type: object
 *                     properties:
 *                       view:
 *                         type: boolean
 *                       create:
 *                         type: boolean
 *                       edit:
 *                         type: boolean
 *                       delete:
 *                         type: boolean
 *     responses:
 *       201:
 *         description: Role created successfully
 *   get:
 *     summary: Get all roles
 *     description: Retrieve all roles with their permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 */
router
  .route("/")
  .post(checkPermission("roles", "create"), createRole)
  .get(checkPermission("roles", "view"), getAllRoles);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     description: Retrieve detailed information about a specific role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role details
 *       404:
 *         description: Role not found
 *   put:
 *     summary: Update role
 *     description: Update role information and permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Role updated successfully
 *   delete:
 *     summary: Delete role
 *     description: Permanently delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 */
router
  .route("/:id")
  .get(checkPermission("roles", "view"), getRoleById)
  .put(checkPermission("roles", "edit"), updateRole)
  .delete(checkPermission("roles", "delete"), deleteRole);

export default router;
