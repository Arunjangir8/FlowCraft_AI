import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../shared/api-error";

export const getHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // throw new APIError({
    //     message: "Server is not healthy",
    //     httpCode: HttpStatusCode.INTERNAL_SERVER,
    //   });

    res.status(200).json({
      success: true,
      message: "Server is healthy",
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};
