import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { authService } from "../../classes/AuthService";
import { prisma } from "../../lib/prisma";


export const getMeController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new APIError({
        message: "Authorization token missing",
        httpCode: HttpStatusCode.UNAUTHORIZED,
      });
    }

    const user = await authService.getUserFromToken(token);

    // Remove sensitive fields
    const { passwordHash, ...safeUser } = user as any;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    });

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: { ...safeUser, subscription },
    });
  } catch (err: any) {
    next(
      err instanceof APIError ? err :
      new APIError({
        message: err.message || "Unauthorized",
        httpCode: HttpStatusCode.UNAUTHORIZED,
      })
    );
  }
};