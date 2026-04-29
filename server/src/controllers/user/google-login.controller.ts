import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { authService } from "../../classes/AuthService";

export const googleLoginController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      throw new APIError({
        message: "Google ID token is required",
        httpCode: HttpStatusCode.BAD_REQUEST,
      });
    }

    const { user, token } = await authService.loginWithGoogleIdToken(idToken);
    const { passwordHash, ...safeUser } = user as any;

    res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (err: any) {
    next(
      err instanceof APIError
        ? err
        : new APIError({
            message: err.message || "Google login failed",
            httpCode: HttpStatusCode.UNAUTHORIZED,
          })
    );
  }
};
