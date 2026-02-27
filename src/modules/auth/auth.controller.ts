import { Request, Response } from "express";
import User from "../user/user.model";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/jwt";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate("roles");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Allow super admins to login even if inactive
    const isSuperAdmin = Array.isArray(user.roles) && (user.roles as any[]).some(
      (role: any) => role.code === "SUPER_ADMIN"
    );
    if (!user.isActive && !isSuperAdmin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update login tracking
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    await user.save();

    const token = generateAccessToken({
      userId: user._id,
      role: user.roles,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id,
    });

    // Create unique session cookie with user-specific path
    const sessionId = `session_${user._id}_${Date.now()}`;
    
    res.cookie("access_token", token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    // Store session identifier
    res.cookie("session_id", sessionId, {
      httpOnly: false, // Allow JS access for logout
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      sessionId,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.roles,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({
      error: {
        code: 500,
        message: error.message || "Login failed",
        stack: error.stack,
      },
    });
  }
};

// @desc    Logout user / Clear cookie
// @route   POST /api/v1/auth/logout
// @access  Public
export const logout = (_req: Request, res: Response) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  res.clearCookie("refresh_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  res.clearCookie("session_id", {
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  res.status(200).json({ message: "Logged out successfully" });
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    // The user is already attached to req by the 'protect' middleware
    // We send it back to the frontend
    res.status(200).json(req.user);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh
// @access  Public
export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      res.status(401).json({ message: "No refresh token provided" });
      return;
    }

    const decoded = verifyRefreshToken(refreshToken) as { userId: string };
    const user = await User.findById(decoded.userId).populate("roles").select("-password");

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    const isSuperAdmin = Array.isArray(user.roles) && (user.roles as any[]).some(
      (role: any) => role.code === "SUPER_ADMIN"
    );
    
    if (!user.isActive && !isSuperAdmin) {
      res.status(403).json({ message: "User account is inactive" });
      return;
    }

    const newAccessToken = generateAccessToken({
      userId: user._id,
      role: user.roles,
    });

    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });

    res.status(200).json({ 
      message: "Token refreshed",
      token: newAccessToken 
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({ message: "Invalid refresh token" });
  }
};
