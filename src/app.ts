import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes";
import roleRoutes from "./modules/role/role.routes";
import userRoutes from "./modules/user/user.routes";
import storeRoutes from "./modules/store/store.route";
import analyticsRoutes from "./modules/analytics/analytics.route";
import notificationRoutes from "./modules/notification/notification.route";
import { setupSwagger } from "./config/swagger";
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

// Landing page
app.get("/", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Elora Crafting Arts API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: white; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .logo { font-size: 3rem; font-weight: bold; margin-bottom: 1rem; }
        .subtitle { font-size: 1.2rem; opacity: 0.9; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3rem; }
        .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 15px; padding: 2rem; border: 1px solid rgba(255,255,255,0.2); }
        .card h3 { font-size: 1.5rem; margin-bottom: 1rem; color: #ffd700; }
        .card p { line-height: 1.6; opacity: 0.9; }
        .endpoints { background: rgba(0,0,0,0.2); border-radius: 15px; padding: 2rem; }
        .endpoints h2 { margin-bottom: 1.5rem; color: #ffd700; }
        .endpoint { background: rgba(255,255,255,0.1); margin: 1rem 0; padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .method { padding: 0.3rem 0.8rem; border-radius: 5px; font-weight: bold; font-size: 0.8rem; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .btn { display: inline-block; background: #ffd700; color: #333; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 0.5rem; transition: transform 0.2s; }
        .btn:hover { transform: translateY(-2px); }
        .footer { text-align: center; margin-top: 3rem; opacity: 0.7; }
        .status { display: inline-block; width: 10px; height: 10px; background: #28a745; border-radius: 50%; margin-right: 0.5rem; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎨 Elora Crafting Arts</div>
            <div class="subtitle">
                <span class="status"></span>
                API Server Running - Version 1.0.0
            </div>
        </div>

        <div class="cards">
            <div class="card">
                <h3>🚀 High Performance</h3>
                <p>Built with Express.js and TypeScript for optimal performance and type safety. Deployed on Vercel for global edge distribution.</p>
            </div>
            <div class="card">
                <h3>🔒 Secure Authentication</h3>
                <p>JWT-based authentication with role-based access control (RBAC) to ensure your data is protected.</p>
            </div>
            <div class="card">
                <h3>📊 Real-time Analytics</h3>
                <p>Comprehensive analytics and reporting system for stores, users, and business operations.</p>
            </div>
        </div>

        <div class="endpoints">
            <h2>🔗 API Endpoints</h2>
            
            <div class="endpoint">
                <div>
                    <span class="method get">GET</span>
                    <span>/api/v1/health</span>
                </div>
                <span>Health Check</span>
            </div>
            
            <div class="endpoint">
                <div>
                    <span class="method post">POST</span>
                    <span>/api/v1/auth/login</span>
                </div>
                <span>User Authentication</span>
            </div>
            
            <div class="endpoint">
                <div>
                    <span class="method get">GET</span>
                    <span>/api/v1/users</span>
                </div>
                <span>User Management</span>
            </div>
            
            <div class="endpoint">
                <div>
                    <span class="method get">GET</span>
                    <span>/api/v1/stores</span>
                </div>
                <span>Store Operations</span>
            </div>
        </div>

        <div style="text-align: center; margin-top: 2rem;">
            <a href="/api-docs" class="btn">📚 API Documentation</a>
            <a href="/api/v1/health" class="btn">🔍 Health Check</a>
        </div>

        <div class="footer">
            <p>&copy; 2026 Elora Crafting Arts. All rights reserved.</p>
            <p>Powered by Express.js • MongoDB • Vercel</p>
        </div>
    </div>
</body>
</html>
  `);
});

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

// Setup Swagger documentation
setupSwagger(app);

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
