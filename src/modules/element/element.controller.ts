import { Request, Response } from "express";
import Element from "./element.model";

export const getElements = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const [elements, total] = await Promise.all([
      Element.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Element.countDocuments(query),
    ]);

    res.json({
      elements,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllElements = async (req: Request, res: Response) => {
  try {
    const elements = await Element.find({ isActive: true }).sort({ name: 1 });
    res.json({ elements });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getElementById = async (req: Request, res: Response) => {
  try {
    const element = await Element.findById(req.params.id);
    if (!element) {
      return res.status(404).json({ message: "Element not found" });
    }
    res.json(element);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createElement = async (req: Request, res: Response) => {
  try {
    const { name, standardRate } = req.body;

    const existingElement = await Element.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingElement) {
      return res.status(400).json({ message: "Element with this name already exists" });
    }

    const element = new Element({ name, standardRate });
    await element.save();

    res.status(201).json({ message: "Element created successfully", element });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateElement = async (req: Request, res: Response) => {
  try {
    const { name, standardRate } = req.body;

    const existingElement = await Element.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: req.params.id as any },
    });
    if (existingElement) {
      return res.status(400).json({ message: "Element with this name already exists" });
    }

    const element = await Element.findByIdAndUpdate(
      req.params.id,
      { name, standardRate },
      { new: true, runValidators: true },
    );

    if (!element) {
      return res.status(404).json({ message: "Element not found" });
    }

    res.json({ message: "Element updated successfully", element });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteElement = async (req: Request, res: Response) => {
  try {
    const element = await Element.findByIdAndDelete(req.params.id);
    if (!element) {
      return res.status(404).json({ message: "Element not found" });
    }
    res.json({ message: "Element deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
