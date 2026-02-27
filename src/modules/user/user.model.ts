import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  roles: mongoose.Types.ObjectId[];
  isActive: boolean;
  loginCount?: number;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, required: true },
    roles: [{ type: Schema.Types.ObjectId, ref: "Role", required: true }],
    isActive: { type: Boolean, default: true },
    loginCount: { type: Number, default: 0 },
    lastLogin: { type: Date },
  },
  { timestamps: true },
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.comparePassword = function (password: string) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model<UserDocument>("User", UserSchema);
