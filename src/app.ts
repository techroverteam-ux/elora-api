import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes";
import roleRoutes from "./modules/role/role.routes";
import userRoutes from "./modules/user/user.routes";
import storeRoutes from "./modules/store/store.route";
import analyticsRoutes from "./modules/analytics/analytics.route";
import notificationRoutes from "./modules/notification/notification.route";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import { setupSwagger } from "./config/swagger";
import path from "path";

const app = express();

// Middlewares
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://elora-web.vercel.app',
      'https://elora-web-git-main-techroverteam-ux.vercel.app',
      /\.vercel\.app$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
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
    <title>Elora Crafting Arts - API Server</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            min-height: 100vh; 
            color: #1f2937;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { 
            background: white;
            border-radius: 16px;
            padding: 3rem 2rem;
            text-align: center;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        .logo { 
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        .logo-text { 
            font-size: 2.5rem; 
            font-weight: 700; 
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle { 
            font-size: 1.1rem; 
            color: #6b7280;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .status { 
            display: inline-block; 
            width: 8px; 
            height: 8px; 
            background: #10b981; 
            border-radius: 50%; 
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        .cards { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); 
            gap: 1.5rem; 
            margin-bottom: 2rem; 
        }
        .card { 
            background: white;
            border-radius: 12px;
            padding: 2rem;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
        }
        .card:hover { 
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .card-icon { 
            font-size: 2rem; 
            margin-bottom: 1rem; 
        }
        .card h3 { 
            font-size: 1.25rem; 
            font-weight: 600; 
            margin-bottom: 0.5rem; 
            color: #1f2937;
        }
        .card p { 
            color: #6b7280; 
            font-size: 0.95rem;
        }
        
        .endpoints { 
            background: white;
            border-radius: 12px;
            padding: 2rem;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }
        .endpoints h2 { 
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: #1f2937;
        }
        .endpoint { 
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            margin: 0.5rem 0;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        .endpoint-left { display: flex; align-items: center; gap: 1rem; }
        .method { 
            padding: 0.25rem 0.75rem;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .get { background: #dcfce7; color: #166534; }
        .post { background: #dbeafe; color: #1e40af; }
        .endpoint-path { font-family: 'Monaco', 'Menlo', monospace; font-size: 0.9rem; }
        .endpoint-desc { color: #6b7280; font-size: 0.9rem; }
        
        .actions { 
            text-align: center;
            margin: 2rem 0;
        }
        .btn { 
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            margin: 0.5rem;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
        }
        .btn:hover { 
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        .btn-secondary {
            background: white;
            color: #3b82f6;
            border: 1px solid #e5e7eb;
        }
        .btn-secondary:hover {
            background: #f8fafc;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .footer { 
            text-align: center;
            padding: 2rem;
            color: #6b7280;
            font-size: 0.9rem;
        }
        .footer p { margin: 0.25rem 0; }
        
        @media (max-width: 768px) {
            .container { padding: 1rem; }
            .header { padding: 2rem 1rem; }
            .logo-text { font-size: 2rem; }
            .endpoint { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-text">Elora Crafting Arts</div>
            </div>
            <div class="subtitle">
                <span class="status"></span>
                API Server • Version 1.0.0 • Production Ready
            </div>
        </div>

        <div class="cards">
            <div class="card">
                <div class="card-icon">🚀</div>
                <h3>High Performance</h3>
                <p>Built with Express.js and TypeScript for optimal performance and type safety. Deployed on Vercel for global edge distribution.</p>
            </div>
            <div class="card">
                <div class="card-icon">🔒</div>
                <h3>Secure Authentication</h3>
                <p>JWT-based authentication with role-based access control (RBAC) to ensure your data is protected and secure.</p>
            </div>
            <div class="card">
                <div class="card-icon">📊</div>
                <h3>Real-time Analytics</h3>
                <p>Comprehensive analytics and reporting system for stores, users, and business operations with real-time insights.</p>
            </div>
        </div>

        <div class="endpoints">
            <h2>🔗 Available API Endpoints</h2>
            
            <div class="endpoint">
                <div class="endpoint-left">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/v1/health</span>
                </div>
                <span class="endpoint-desc">System Health Check</span>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-left">
                    <span class="method post">POST</span>
                    <span class="endpoint-path">/api/v1/auth/login</span>
                </div>
                <span class="endpoint-desc">User Authentication</span>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-left">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/v1/users</span>
                </div>
                <span class="endpoint-desc">User Management</span>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-left">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/v1/stores</span>
                </div>
                <span class="endpoint-desc">Store Operations</span>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-left">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/v1/analytics</span>
                </div>
                <span class="endpoint-desc">Analytics & Reports</span>
            </div>
        </div>

        <div class="actions">
            <a href="/api-docs" class="btn">📚 API Documentation</a>
            <a href="/api/v1/health" class="btn btn-secondary">🔍 Health Check</a>
        </div>

        <div class="footer">
            <p>&copy; 2026 Elora Crafting Arts. All rights reserved.</p>
            <p>Powered by Express.js • MongoDB • TypeScript • Vercel</p>
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
app.use("/api/v1/dashboard", dashboardRoutes);
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
