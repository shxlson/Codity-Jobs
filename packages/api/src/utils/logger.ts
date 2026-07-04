// ─────────────────────────────────────────────────────────────────────────────
//  Structured Logger (Winston)
//  All application code should use this logger instead of console.log.
// ─────────────────────────────────────────────────────────────────────────────

import winston from "winston";
import { env } from "../config/env";

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// ── Development format: human-readable colored output ─────────────────────────
const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n  ${JSON.stringify(meta, null, 2)}`
      : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// ── Production format: structured JSON for log aggregation ────────────────────
const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: env.isDevelopment ? "debug" : "info",
  format: env.isProduction ? productionFormat : developmentFormat,
  transports: [
    new winston.transports.Console(),
  ],
  // Prevent winston from exiting on uncaught exceptions
  exitOnError: false,
});
