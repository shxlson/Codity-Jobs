// ─────────────────────────────────────────────────────────────────────────────
//  HTTP Server Entry Point
//  Starts the Express server and handles graceful shutdown signals.
// ─────────────────────────────────────────────────────────────────────────────

import { createApp } from "./app";
import { env } from "./config/env";
import { checkDatabaseConnection, closePool } from "./config/database";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  // Verify database is reachable before accepting traffic
  await checkDatabaseConnection();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Codity Jobs API started`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      pid: process.pid,
    });
  });

  // ── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal} — initiating graceful shutdown`);

    server.close(async () => {
      logger.info("HTTP server closed");

      try {
        await closePool();
        logger.info("Graceful shutdown complete");
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown", {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { reason });
    process.exit(1);
  });
}

main().catch((error) => {
  const errObj = error instanceof Error
    ? { ...error, message: error.message, stack: error.stack }
    : { error: String(error), raw: error };
  logger.error("Failed to start server", errObj);
  process.exit(1);
});
