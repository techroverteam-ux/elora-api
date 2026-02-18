import express from "express";
import { getDashboardAnalytics } from "./analytics.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/v1/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics
 *     description: Retrieve comprehensive analytics data for dashboard including store counts, user statistics, and workflow metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalStores:
 *                   type: number
 *                 totalUsers:
 *                   type: number
 *                 recceCompleted:
 *                   type: number
 *                 installationCompleted:
 *                   type: number
 *                 statusBreakdown:
 *                   type: object
 */
router.get("/dashboard", getDashboardAnalytics);

export default router;
