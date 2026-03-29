import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { AuthService } from "../../classes/AuthService";

const authService = new AuthService();

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

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: safeUser,
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