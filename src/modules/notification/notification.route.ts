import { Router } from "express";
import { getNotifications } from "./notification.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/", protect, getNotifications);

export default router;
