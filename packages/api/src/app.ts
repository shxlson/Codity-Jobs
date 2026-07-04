// ─────────────────────────────────────────────────────────────────────────────
//  Express Application Factory
//  Creates and configures the Express app without starting the HTTP server.
//  This separation makes the app importable in tests without binding a port.
// ─────────────────────────────────────────────────────────────────────────────

import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found-handler";

// ── Route Modules ─────────────────────────────────────────────────────────────
import { authRouter } from "./modules/auth/auth.routes";
import { organizationsRouter } from "./modules/organizations/organizations.routes";
import { projectsRouter } from "./modules/projects/projects.routes";
import { queuesRouter } from "./modules/queues/queues.routes";
import { jobsRouter } from "./modules/jobs/jobs.routes";
import { workersRouter } from "./modules/workers/workers.routes";
import { metricsRouter } from "./modules/metrics/metrics.routes";

export function createApp(): Application {
  const app = express();

  // ── Security Middleware ──────────────────────────────────────────────────────
  app.use(helmet());

  app.use(
    cors({
      origin: env.isDevelopment ? "*" : process.env.ALLOWED_ORIGINS?.split(","),
      credentials: true,
    })
  );

  // ── Global Rate Limiting ─────────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100000,
    message: { success: false, error: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);

  // ── Request Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ── HTTP Request Logging ─────────────────────────────────────────────────────
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
      skip: (req) => req.path === "/health",
    })
  );

  // ── Health Check (no auth required) ─────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "1.0.0",
    });
  });

  // ── API Routes ───────────────────────────────────────────────────────────────
  const API_PREFIX = "/api/v1";

  app.use(`${API_PREFIX}/auth`, authRouter);
  app.use(`${API_PREFIX}/organizations`, organizationsRouter);
  app.use(`${API_PREFIX}/projects`, projectsRouter);
  app.use(`${API_PREFIX}/queues`, queuesRouter);
  app.use(`${API_PREFIX}/jobs`, jobsRouter);
  app.use(`${API_PREFIX}/workers`, workersRouter);
  app.use(`${API_PREFIX}/metrics`, metricsRouter);

  // ── Error Handling (must be last) ────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
