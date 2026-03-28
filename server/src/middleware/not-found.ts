import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../shared/api-error";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(
    new APIError({
      message: `Route ${req.originalUrl} not found`,
      httpCode: HttpStatusCode.NOT_FOUND,
      methodName: "notFoundHandler",
    })
  );
};
