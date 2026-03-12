import mongoose, { Schema, Document } from "mongoose";

export interface ClientElement {
  elementId: mongoose.Types.ObjectId;
  elementName: string;
  customRate: number;
  quantity: number;
}

export interface ClientDocument extends Document {
  clientCode: string;
  clientName: string;
  branchName: string;
  gstNumber: string;
  elements: ClientElement[];
  isActive: boolean;
  enableLocationMapping: boolean;
}

const ClientElementSchema = new Schema<ClientElement>(
  {
    elementId: { type: Schema.Types.ObjectId, ref: "Element", required: true },
    elementName: { type: String, required: true },
    customRate: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false },
);

const ClientSchema = new Schema<ClientDocument>(
  {
    clientCode: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, trim: true },
    branchName: { type: String, required: true, trim: true },
    gstNumber: { type: String, required: true, trim: true, unique: true },
    elements: [ClientElementSchema],
    isActive: { type: Boolean, default: true },
    enableLocationMapping: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model<ClientDocument>("Client", ClientSchema);
