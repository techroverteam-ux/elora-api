import mongoose, { Schema, Document } from "mongoose";

export interface PermissionSet {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface RoleDocument extends Document {
  name: string;
  code: string;
  permissions: Map<string, PermissionSet>;
  isActive: boolean;
}

const PermissionSchema = new Schema<PermissionSet>(
  {
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
  },
  { _id: false },
);

const RoleSchema = new Schema<RoleDocument>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    permissions: {
      type: Map,
      of: PermissionSchema,
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<RoleDocument>("Role", RoleSchema);
