import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "../src/app";
import { seedSuperAdmin } from "../src/config/seedSuperAdmin";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI as string;

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined");
    }

    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log("✅ MongoDB connected");
    
    await seedSuperAdmin();
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    throw error;
  }
};

export default async (req: any, res: any) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (error: any) {
    console.error('Serverless handler error:', error);
    return res.status(500).json({
      error: {
        code: 500,
        message: error.message,
        stack: error.stack
      }
    });
  }
};