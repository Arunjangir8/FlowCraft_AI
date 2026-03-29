// middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthService } from "../classes/AuthService";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const user = await AuthService.prototype.getUserFromToken(token);

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};