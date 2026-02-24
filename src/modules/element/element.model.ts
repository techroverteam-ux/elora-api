import mongoose, { Schema, Document } from "mongoose";

export interface ElementDocument extends Document {
  name: string;
  standardRate: number;
  isActive: boolean;
}

const ElementSchema = new Schema<ElementDocument>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    standardRate: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<ElementDocument>("Element", ElementSchema);
