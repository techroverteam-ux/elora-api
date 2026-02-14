import mongoose, { Schema, Document } from "mongoose";

export interface EnquiryDocument extends Document {
  name: string;
  email: string;
  phone: string;
  message: string;
  status: "NEW" | "READ" | "CONTACTED" | "RESOLVED";
  remark?: string;
}

const EnquirySchema = new Schema<EnquiryDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["NEW", "READ", "CONTACTED", "RESOLVED"],
      default: "NEW",
    },
    remark: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model<EnquiryDocument>("Enquiry", EnquirySchema);
