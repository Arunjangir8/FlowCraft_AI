// middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

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

    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (session.expiresAt < new Date()) {
      await prisma.userSession.delete({ where: { token } });
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = session.user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};