"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("../src/app"));
const seedSuperAdmin_1 = require("../src/config/seedSuperAdmin");
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI;
let isConnected = false;
const connectDB = async () => {
    if (isConnected)
        return;
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI is not defined");
        }
        await mongoose_1.default.connect(MONGO_URI);
        isConnected = true;
        console.log("✅ MongoDB connected");
        await (0, seedSuperAdmin_1.seedSuperAdmin)();
    }
    catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        throw error;
    }
};
exports.default = async (req, res) => {
    try {
        await connectDB();
        return (0, app_1.default)(req, res);
    }
    catch (error) {
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
