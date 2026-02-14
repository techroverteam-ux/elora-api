import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../modules/user/user.model";

interface JwtPayload {
  userId: string;
  roles: any[]; // UPDATED: Array of roles
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token;

    // 1. Check for token
    if (req.cookies.access_token) {
      token = req.cookies.access_token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      res.status(401).json({ message: "Not authorized, no token provided" });
      return;
    }

    // 2. Verify Token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as JwtPayload;

    // 3. Find User & Populate Roles (UPDATED: Plural 'roles')
    const user = await User.findById(decoded.userId)
      .populate("roles")
      .select("-password");

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: "User account is inactive" });
      return;
    }

    // 4. Attach to Request
    req.user = user as any;

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};
