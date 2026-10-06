import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "../src/app";
import { seedSuperAdmin } from "../src/config/seedSuperAdmin";

dotenv.config();

// SECURITY: this connection string (with password) is committed to git.
// Set MONGO_URI in the Vercel project's Environment Variables, rotate the
// Atlas password, then delete the fallback below.
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb+srv://elora_crafting_arts:elora_crafting_arts%402026@elora-art.7osood6.mongodb.net/elora_crafting_arts?retryWrites=true&w=majority";

// One shared connection promise per serverless instance. Concurrent requests
// on a cold start (the app fires /stores, /stores/cities, /clients together)
// all await the SAME connect instead of each opening their own.
let connectPromise: Promise<typeof mongoose> | null = null;
let seeded = false;

const connectDB = async () => {
  // 1 = connected. Re-check the real state so a dropped connection reconnects
  // instead of every query hanging on a stale "isConnected = true" flag.
  if (mongoose.connection.readyState === 1) return;

  if (!connectPromise) {
    console.log("Connecting to MongoDB...");
    const started = Date.now();
    connectPromise = mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 8000, // fail in 8s, not the 30s default
        connectTimeoutMS: 8000,
        maxPoolSize: 5,
      })
      .then((m) => {
        console.log(`✅ MongoDB connected in ${Date.now() - started}ms`);
        // Seed once per instance, in the background — never make a user's
        // request wait for these writes.
        if (!seeded) {
          seeded = true;
          seedSuperAdmin().catch((e) => console.error("seedSuperAdmin failed:", e));
        }
        return m;
      })
      .catch((error) => {
        console.error("❌ MongoDB connection failed:", error);
        connectPromise = null; // allow the next request to retry
        throw error;
      });
  }
  await connectPromise;
};

export default async (req: any, res: any) => {
  // Define allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'https://elora-web.vercel.app',
    'https://elora-web-git-main-techroverteam-ux.vercel.app',
    'https://www.eloracreativeart.in',
    'https://eloracreativeart.in'
  ];
  
  const origin = req.headers.origin;
  const isAllowedOrigin = allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin);
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

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