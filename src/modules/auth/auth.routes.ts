import { Router } from "express";
import { login, getMe, logout } from "./auth.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
