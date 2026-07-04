// ─────────────────────────────────────────────────────────────────────────────
//  Worker Environment Configuration
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
import path from "path";
import os from "os";

// Load root .env from monorepo root, then fallback to local .env
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const workerEnv = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  NODE_ENV: optionalEnv("NODE_ENV", "development"),

  // How often (ms) the worker polls for new jobs when idle
  POLL_INTERVAL_MS: parseInt(optionalEnv("WORKER_POLL_INTERVAL_MS", "2000"), 10),

  // How often (ms) the worker emits a heartbeat
  HEARTBEAT_INTERVAL_MS: parseInt(
    optionalEnv("WORKER_HEARTBEAT_INTERVAL_MS", "30000"),
    10
  ),

  // Max concurrent jobs this worker processes simultaneously
  CONCURRENCY: parseInt(optionalEnv("WORKER_CONCURRENCY", "5"), 10),

  // How long (ms) without a heartbeat before the worker is considered stale
  STALE_WORKER_THRESHOLD_MS: parseInt(
    optionalEnv("WORKER_STALE_THRESHOLD_MS", "90000"),
    10
  ),

  HOSTNAME: optionalEnv("HOSTNAME", os.hostname()),
  PID: process.pid,
};
