// ─────────────────────────────────────────────────────────────────────────────
//  AppError — Operational Error Class
//  Thrown by route handlers and service functions for expected errors.
//  Distinguished from unexpected programming errors by the isOperational flag.
// ─────────────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    // Restore prototype chain (required when extending built-in classes)
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(message, 403);
  }

  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409);
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError(message, 500);
  }
}
