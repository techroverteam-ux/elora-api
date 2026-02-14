import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes";
import roleRoutes from "./modules/role/role.routes";
import userRoutes from "./modules/user/user.routes";
import storeRoutes from "./modules/store/store.route";
import analyticsRoutes from "./modules/analytics/analytics.route";
import notificationRoutes from "./modules/notification/notification.route";
import path from "path";

const app = express();

// Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Elora API is running",
  });
});
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/stores", storeRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("API Error:", err);
    res.status(err.status || 500).json({
      error: {
        code: err.status || 500,
        message: err.message,
        ...(err.stack && { stack: err.stack }),
        ...(err.errors && { details: err.errors }),
      },
    });
  },
);

export default app;
