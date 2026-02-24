import { Router } from "express";
import { generateRFQ } from "./rfq.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/generate", protect, generateRFQ);

export default router;
