import { Router } from "express";
import { generateRFQ } from "./rfq.controller";
import { protect } from "../../middlewares/auth.middleware";
import { requireStoreIdsInScope } from "../../utils/access";

const router = Router();

router.post("/generate", protect, requireStoreIdsInScope, generateRFQ);

export default router;
