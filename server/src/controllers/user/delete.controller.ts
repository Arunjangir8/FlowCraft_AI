import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { AuthService } from "../../classes/AuthService";

const authService = new AuthService();


export const deleteAccountController = async (
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

    await authService.deleteAccount(user.id);

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (err: any) {
    next(
      err instanceof APIError ? err :
      new APIError({
        message: err.message || "Delete account failed",
        httpCode: HttpStatusCode.BAD_REQUEST,
      })
    );
  }
};