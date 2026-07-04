// ─────────────────────────────────────────────────────────────────────────────
//  Environment Configuration
//  Validates and exports all required environment variables at startup.
//  The application will fail fast if a required variable is missing.
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
import path from "path";

// Load root .env from monorepo root, then fallback to local .env
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  // ── Server ──────────────────────────────────────────────────────────────────
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  PORT: parseInt(optionalEnv("PORT", "3000"), 10),

  // ── Database ─────────────────────────────────────────────────────────────────
  DATABASE_URL: requireEnv("DATABASE_URL"),
  DATABASE_POOL_MIN: parseInt(optionalEnv("DATABASE_POOL_MIN", "2"), 10),
  DATABASE_POOL_MAX: parseInt(optionalEnv("DATABASE_POOL_MAX", "10"), 10),

  // ── JWT ───────────────────────────────────────────────────────────────────────
  JWT_SECRET: requireEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: optionalEnv("JWT_EXPIRES_IN", "7d"),

  // ── Feature Flags ─────────────────────────────────────────────────────────────
  get isProduction() {
    return this.NODE_ENV === "production";
  },
  get isDevelopment() {
    return this.NODE_ENV === "development";
  },
} as const;
