// ─────────────────────────────────────────────────────────────────────────────
//  Global Error Handler Middleware
//  Must be registered LAST in the Express middleware chain.
//  Normalizes all thrown errors into a consistent JSON response shape.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // ── Operational errors (expected, user-facing) ─────────────────────────────
  if (error instanceof AppError) {
    logger.warn("Operational error", {
      statusCode: error.statusCode,
      message: error.message,
      path: req.path,
      method: req.method,
    });

    const body: Record<string, unknown> = { success: false, error: error.message };
    if (error.details != null) body["details"] = error.details;
    res.status(error.statusCode).json(body);
    return;
  }

  // ── PostgreSQL errors ──────────────────────────────────────────────────────
  const pgError = error as { code?: string; constraint?: string };

  if (pgError.code === "23505") {
    // Unique constraint violation
    res.status(409).json({
      success: false,
      error: "Resource already exists",
      details: pgError.constraint,
    });
    return;
  }

  if (pgError.code === "23503") {
    // Foreign key violation
    res.status(400).json({
      success: false,
      error: "Referenced resource does not exist",
    });
    return;
  }

  // ── Unexpected / programming errors ───────────────────────────────────────
  logger.error("Unhandled server error", {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: "Internal server error",
    // Only expose stack traces in development
    ...(env.isDevelopment && { stack: error.stack }),
  });
}
