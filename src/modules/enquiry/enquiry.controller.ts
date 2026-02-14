import { Request, Response } from "express";
import Enquiry from "./enquiry.model";

export const createEnquiry = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, message } = req.body;
    const enquiry = await Enquiry.create({ name, email, phone, message });
    res.status(201).json({ message: "Enquiry submitted successfully", enquiry });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit enquiry", error });
  }
};

export const getAllEnquiries = async (req: Request, res: Response) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.status(200).json(enquiries);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch enquiries", error });
  }
};

export const updateEnquiry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;
    
    const enquiry = await Enquiry.findByIdAndUpdate(
      id,
      { status, remark },
      { new: true }
    );
    
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }
    
    res.status(200).json({ message: "Enquiry updated successfully", enquiry });
  } catch (error) {
    res.status(500).json({ message: "Failed to update enquiry", error });
  }
};
