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
import { bulkAssignStoresToUser } from "../store/store.controller";
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

/**
 * @swagger
 * /api/v1/users/template:
 *   get:
 *     summary: Download user upload template
 *     description: Downloads an Excel template file for bulk user upload
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel template file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/template", checkPermission("users", "view"), downloadUserTemplate);
/**
 * @swagger
 * /api/v1/users/upload:
 *   post:
 *     summary: Bulk upload users from Excel
 *     description: Upload Excel file to create multiple users at once
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Upload processed successfully
 */
router.post("/upload", checkPermission("users", "create"), upload.array("files"), uploadUsersBulk);
/**
 * @swagger
 * /api/v1/users/export:
 *   get:
 *     summary: Export users to Excel
 *     description: Exports all users to an Excel file
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file with users
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export", checkPermission("users", "view"), exportUsers);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user with roles and permissions
 *     tags: [Users]
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
 *               - email
 *               - password
 *               - roles
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               mobile:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *   get:
 *     summary: Get all users
 *     description: Retrieve all users with pagination
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router
  .route("/")
  .post(checkPermission("users", "create"), createUser)
  .get(checkPermission("users", "view"), getAllUsers);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve detailed information about a specific user
 *     tags: [Users]
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
 *         description: User details
 *       404:
 *         description: User not found
 *   put:
 *     summary: Update user
 *     description: Update user information
 *     tags: [Users]
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
 *         description: User updated successfully
 *   delete:
 *     summary: Delete user
 *     description: Permanently delete a user
 *     tags: [Users]
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
 *         description: User deleted successfully
 */
router
  .route("/:id")
  .get(checkPermission("users", "view"), getUserById)
  .put(checkPermission("users", "edit"), updateUser)
  .delete(checkPermission("users", "delete"), deleteUser);

/**
 * @swagger
 * /api/v1/users/role/{roleCode}:
 *   get:
 *     summary: Get users by role
 *     description: Retrieve all users with a specific role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleCode
 *         required: true
 *         schema:
 *           type: string
 *           enum: [SUPER_ADMIN, ADMIN, RECCE, INSTALLATION]
 *     responses:
 *       200:
 *         description: List of users with the specified role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get("/role/:roleCode", protect, getUsersByRole);

router.post("/:userId/bulk-assign-stores", checkPermission("stores", "edit"), upload.array("files"), bulkAssignStoresToUser);

export default router;
