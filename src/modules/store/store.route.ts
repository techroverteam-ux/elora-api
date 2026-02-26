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
  unassignStoresBulk,
  submitRecce,
  generateReccePPT,
  reviewRecce,
  submitInstallation,
  generateInstallationPPT,
  generateBulkPPT,
  downloadStoreTemplate,
  exportRecceTasks,
  exportInstallationTasks,
  exportStores,
  bulkAssignStoresToUser,
} from "./store.controller";
import { generateReccePDF, generateInstallationPDF, generateBulkPDF } from "./pdf.controller";
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

/**
 * @swagger
 * /api/v1/stores/template:
 *   get:
 *     summary: Download store upload template
 *     description: Downloads an Excel template file for bulk store upload
 *     tags: [Stores]
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
router.get("/template", downloadStoreTemplate);
/**
 * @swagger
 * /api/v1/stores/export/recce:
 *   get:
 *     summary: Export recce tasks to Excel
 *     description: Exports all recce tasks assigned to the current user to an Excel file
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file with recce tasks
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export/recce", exportRecceTasks);
/**
 * @swagger
 * /api/v1/stores/export/installation:
 *   get:
 *     summary: Export installation tasks to Excel
 *     description: Exports all installation tasks assigned to the current user to an Excel file
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file with installation tasks
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export/installation", exportInstallationTasks);

router.get("/export", exportStores);

/**
 * @swagger
 * /api/v1/stores/upload:
 *   post:
 *     summary: Bulk upload stores from Excel
 *     description: Upload one or more Excel files to create multiple stores at once
 *     tags: [Stores]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 totalProcessed:
 *                   type: number
 *                 successCount:
 *                   type: number
 *                 errorCount:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post(
  "/upload",
  checkPermission("stores", "create"),
  upload.array("files"),
  uploadStoresBulk,
);

/**
 * @swagger
 * /api/v1/stores:
 *   post:
 *     summary: Create a new store
 *     description: Manually create a single store with all details
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dealerCode
 *               - storeName
 *             properties:
 *               dealerCode:
 *                 type: string
 *               storeName:
 *                 type: string
 *               vendorCode:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   zone:
 *                     type: string
 *                   state:
 *                     type: string
 *                   district:
 *                     type: string
 *                   city:
 *                     type: string
 *                   address:
 *                     type: string
 *               specs:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                   width:
 *                     type: number
 *                   height:
 *                     type: number
 *                   qty:
 *                     type: number
 *     responses:
 *       201:
 *         description: Store created successfully
 *   get:
 *     summary: Get all stores
 *     description: Retrieve stores with pagination, filtering, and search
 *     tags: [Stores]
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
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of stores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stores:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     pages:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 */
router
  .route("/")
  .post(checkPermission("stores", "create"), createStore)
  .get(checkPermission("stores", "view"), getAllStores);

/**
 * @swagger
 * /api/v1/stores/{id}:
 *   get:
 *     summary: Get store by ID
 *     description: Retrieve detailed information about a specific store
 *     tags: [Stores]
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
 *         description: Store details
 *       404:
 *         description: Store not found
 *   put:
 *     summary: Update store
 *     description: Update store information
 *     tags: [Stores]
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
 *         description: Store updated successfully
 *   delete:
 *     summary: Delete store
 *     description: Permanently delete a store
 *     tags: [Stores]
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
 *         description: Store deleted successfully
 */
router
  .route("/:id")
  .get(checkPermission("stores", "view"), getStoreById)
  .put(checkPermission("stores", "edit"), updateStore)
  .delete(checkPermission("stores", "delete"), deleteStore);

/**
 * @swagger
 * /api/v1/stores/assign:
 *   post:
 *     summary: Assign stores to user
 *     description: Bulk assign stores to a user for recce or installation
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeIds
 *               - userId
 *               - stage
 *             properties:
 *               storeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               userId:
 *                 type: string
 *               stage:
 *                 type: string
 *                 enum: [RECCE, INSTALLATION]
 *     responses:
 *       200:
 *         description: Stores assigned successfully
 */
router.post("/assign", checkPermission("stores", "edit"), assignStoresBulk);
/**
 * @swagger
 * /api/v1/stores/unassign:
 *   post:
 *     summary: Unassign stores from user
 *     description: Bulk unassign stores from a user
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeIds
 *               - stage
 *             properties:
 *               storeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               stage:
 *                 type: string
 *                 enum: [RECCE, INSTALLATION]
 *     responses:
 *       200:
 *         description: Stores unassigned successfully
 */
router.post("/unassign", checkPermission("stores", "edit"), unassignStoresBulk);

/**
 * @swagger
 * /api/v1/stores/{id}/recce:
 *   post:
 *     summary: Submit recce inspection
 *     description: Submit recce inspection with photos and measurements
 *     tags: [Stores]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - width
 *               - height
 *               - front
 *             properties:
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               unit:
 *                 type: string
 *                 enum: [ft, m]
 *               notes:
 *                 type: string
 *               front:
 *                 type: string
 *                 format: binary
 *               side:
 *                 type: string
 *                 format: binary
 *               closeUp:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Recce submitted successfully
 */
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

/**
 * @swagger
 * /api/v1/stores/{id}/ppt/recce:
 *   get:
 *     summary: Download recce PPT
 *     description: Generate and download PowerPoint presentation for recce inspection
 *     tags: [Stores]
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
 *         description: PPT file
 *         content:
 *           application/vnd.openxmlformats-officedocument.presentationml.presentation:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/ppt/recce", protect, generateReccePPT);
/**
 * @swagger
 * /api/v1/stores/{id}/pdf/recce:
 *   get:
 *     summary: Download recce PDF
 *     description: Generate and download PDF report for recce inspection
 *     tags: [Stores]
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
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/pdf/recce", protect, generateReccePDF);
/**
 * @swagger
 * /api/v1/stores/ppt/bulk:
 *   post:
 *     summary: Download bulk PPT
 *     description: Generate multi-page PowerPoint with multiple stores
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeIds
 *               - type
 *             properties:
 *               storeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               type:
 *                 type: string
 *                 enum: [recce, installation]
 *     responses:
 *       200:
 *         description: PPT file with multiple stores
 *         content:
 *           application/vnd.openxmlformats-officedocument.presentationml.presentation:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post("/ppt/bulk", protect, generateBulkPPT);
/**
 * @swagger
 * /api/v1/stores/pdf/bulk:
 *   post:
 *     summary: Download bulk PDF
 *     description: Generate multi-page PDF with multiple stores
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeIds
 *               - type
 *             properties:
 *               storeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               type:
 *                 type: string
 *                 enum: [recce, installation]
 *     responses:
 *       200:
 *         description: PDF file with multiple stores
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post("/pdf/bulk", protect, generateBulkPDF);

/**
 * @swagger
 * /api/v1/stores/{id}/recce/review:
 *   post:
 *     summary: Review recce submission
 *     description: Approve or reject a recce submission
 *     tags: [Stores]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review submitted successfully
 */
router.post(
  "/:id/recce/review",
  checkPermission("stores", "edit"),
  reviewRecce,
);

// --- UPDATED: Accept TWO Installation Images ---
/**
 * @swagger
 * /api/v1/stores/{id}/installation:
 *   post:
 *     summary: Submit installation proof
 *     description: Submit installation completion with after photos
 *     tags: [Stores]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - after1
 *             properties:
 *               after1:
 *                 type: string
 *                 format: binary
 *                 description: First after installation photo
 *               after2:
 *                 type: string
 *                 format: binary
 *                 description: Second after installation photo
 *     responses:
 *       200:
 *         description: Installation submitted successfully
 */
router.post(
  "/:id/installation",
  protect,
  upload.fields([
    { name: "after1", maxCount: 1 },
    { name: "after2", maxCount: 1 },
  ]),
  submitInstallation,
);

/**
 * @swagger
 * /api/v1/stores/{id}/ppt/installation:
 *   get:
 *     summary: Download installation PPT
 *     description: Generate and download PowerPoint presentation for installation with before/after comparison
 *     tags: [Stores]
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
 *         description: PPT file
 *         content:
 *           application/vnd.openxmlformats-officedocument.presentationml.presentation:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/ppt/installation", protect, generateInstallationPPT);
/**
 * @swagger
 * /api/v1/stores/{id}/pdf/installation:
 *   get:
 *     summary: Download installation PDF
 *     description: Generate and download PDF report for installation with before/after comparison
 *     tags: [Stores]
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
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/pdf/installation", protect, generateInstallationPDF);

export default router;
