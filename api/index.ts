import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "../src/app";
import { seedSuperAdmin } from "../src/config/seedSuperAdmin";

dotenv.config();

const MONGO_URI = "mongodb+srv://elora_crafting_arts:elora_crafting_arts%402026@elora-art.7osood6.mongodb.net/elora_crafting_arts?retryWrites=true&w=majority";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  try {
    if (!MONGO_URI) {
      console.error("Environment variables:", {
        MONGO_URI: process.env.MONGO_URI,
        MONGODB_URI: process.env.MONGODB_URI,
        NODE_ENV: process.env.NODE_ENV
      });
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log("✅ MongoDB connected successfully");
    
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