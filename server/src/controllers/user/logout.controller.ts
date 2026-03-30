import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { authService } from "../../classes/AuthService";

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.headers.authorization?.split(" ")[1] || req.body.token;

    if (!token) {
      throw new APIError({
        message: "Token is required",
        httpCode: HttpStatusCode.BAD_REQUEST,
      });
    }

    await authService.logout(token);

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (err: any) {
    next(
      err instanceof APIError
        ? err
        : new APIError({
            message: err.message || "Logout failed",
            httpCode: HttpStatusCode.BAD_REQUEST,
          })
    );
  }
};
