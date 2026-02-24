import express from "express";
import { getDashboardStats } from "./dashboard.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = express.Router();

router.use(protect);

router.get("/stats", getDashboardStats);

export default router;
