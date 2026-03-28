import winston, { format, transports } from "winston";
import { isProduction } from "../config/constants";

const devFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "HH:mm:ss" }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;

    if (stack) log += `\n${stack}`;

    if (Object.keys(meta).length) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

export const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  transports: [
    new transports.Console({
      format: isProduction ? prodFormat : devFormat,
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
});