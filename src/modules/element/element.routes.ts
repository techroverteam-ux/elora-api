import { Router } from "express";
import * as elementController from "./element.controller";
import { protect } from "../../middlewares/auth.middleware";
import { denySubAdmin } from "../../utils/access";

const router = Router();

router.use(protect);

router.get("/", elementController.getElements);
router.get("/all", elementController.getAllElements);
router.get("/:id", elementController.getElementById);
router.post("/", denySubAdmin, elementController.createElement);
router.put("/:id", denySubAdmin, elementController.updateElement);
router.delete("/:id", denySubAdmin, elementController.deleteElement);

export default router;
