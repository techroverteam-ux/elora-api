import express from "express";
import { createEnquiry, getAllEnquiries, updateEnquiry } from "./enquiry.controller";

const router = express.Router();

router.post("/", createEnquiry);
router.get("/", getAllEnquiries);
router.put("/:id", updateEnquiry);

export default router;
