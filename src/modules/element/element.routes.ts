import { Router } from "express";
import * as elementController from "./element.controller";
import { protect } from "../../middlewares/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", elementController.getElements);
router.get("/all", elementController.getAllElements);
router.get("/:id", elementController.getElementById);
router.post("/", elementController.createElement);
router.put("/:id", elementController.updateElement);
router.delete("/:id", elementController.deleteElement);

export default router;
