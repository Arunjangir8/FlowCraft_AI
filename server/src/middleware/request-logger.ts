import { NextFunction, Request, Response } from "express";
import { AppEnv } from "../config";
import { logger } from "../shared/logger";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.on("finish", () => {
    const hasBody = req.body && Object.keys(req.body).length > 0;
    const hasQuery = req.query && Object.keys(req.query).length > 0;
    const hasParams = req.params && Object.keys(req.params).length > 0;

    const normalizedPath = (() => {
      const pathWithoutQuery = req.originalUrl.split("?")[0] || "/";

      if (
        AppEnv.API_PREFIX &&
        pathWithoutQuery.startsWith(AppEnv.API_PREFIX)
      ) {
        const trimmed = pathWithoutQuery.slice(AppEnv.API_PREFIX.length);
        return trimmed || "/";
      }

      return pathWithoutQuery;
    })();

    const requestLineLog = `${req.method} ${normalizedPath} ${res.statusCode}`;

    let payloadLog = "";

    if (hasBody || hasQuery || hasParams) {
      const payload = {
        ...(hasBody && { body: req.body }),
        ...(hasQuery && { query: req.query }),
        ...(hasParams && { params: req.params }),
      };

      payloadLog = `\nPAYLOAD: ${JSON.stringify(payload, null, 2)}`;
    }

    const finalLog = requestLineLog + payloadLog;

    if (res.statusCode >= 500) {
      logger.error(finalLog);
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn(finalLog);
      return;
    }

    logger.info(finalLog);
  });

  next();
};