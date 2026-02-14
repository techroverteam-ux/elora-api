import express from "express";
import { getDashboardAnalytics } from "./analytics.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = express.Router();

router.use(protect);

router.get("/dashboard", getDashboardAnalytics);

export default router;
