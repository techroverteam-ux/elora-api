import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";
import { seedSuperAdmin } from "./config/seedSuperAdmin";
import enquiryRoutes from "./modules/enquiry/enquiry.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI as string;

const startServer = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    await seedSuperAdmin();

    app.use("/api/v1/enquiries", enquiryRoutes);
    app.use("/api/enquiries", enquiryRoutes);
    app.use("/api/dashboard", dashboardRoutes);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
