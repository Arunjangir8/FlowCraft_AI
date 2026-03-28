import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../shared/api-error";
import { logger } from "../shared/logger";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof APIError) {
    return res.status(err.httpCode || HttpStatusCode.INTERNAL_SERVER).json({
      success: false,
      message: err.message,
      method: err.methodName,
      errorData: err.errorData ?? null,
    });
  }

  logger.error("Unhandled Error:", err);

  return res.status(HttpStatusCode.INTERNAL_SERVER).json({
    success: false,
    message: "Internal Server Error",
  });
};
