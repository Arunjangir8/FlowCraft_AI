import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../shared/api-error";
import { authService } from "../classes/AuthService";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Header first (all normal routes), query param fallback (SSE/EventSource)
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;

    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : queryToken;

    if (!token) {
      return next(new APIError({
        message: "Unauthorized",
        httpCode: HttpStatusCode.UNAUTHORIZED,
      }));
    }

    const user = await authService.getUserFromToken(token);

    if (!user) {
      return next(new APIError({
        message: "Invalid or expired token",
        httpCode: HttpStatusCode.UNAUTHORIZED,
      }));
    }

    req.user = user;
    next();

  } catch (error) {
    return next(new APIError({
      message: "Invalid or expired token",
      httpCode: HttpStatusCode.UNAUTHORIZED,
    }));
  }
};