// ─────────────────────────────────────────────────────────────────────────────
//  Database Migration Runner
//  Reads SQL files from the migrations directory in lexicographic order,
//  checks the migrations table, and applies only unapplied migrations.
//
//  Usage:
//    npm run migrate --workspace=packages/api
//    or:
//    ts-node src/db/migrate.ts
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { getClient, closePool } from "../config/database";
import { logger } from "../utils/logger";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

interface MigrationRecord {
  name: string;
}

async function getAppliedMigrations(
  client: Awaited<ReturnType<typeof getClient>>
): Promise<Set<string>> {
  // Ensure the migrations table itself exists before querying it
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      migration_id BIGSERIAL    PRIMARY KEY,
      name         VARCHAR(255) NOT NULL UNIQUE,
      applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  const result = await client.query<MigrationRecord>(
    "SELECT name FROM migrations ORDER BY name ASC"
  );

  return new Set(result.rows.map((r) => r.name));
}

async function runMigrations(): Promise<void> {
  logger.info("Starting database migrations...");

  const client = await getClient();

  try {
    const appliedMigrations = await getAppliedMigrations(client);

    // Read all .sql files from the migrations directory, sorted lexicographically
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const migrationName = path.basename(file, ".sql");

      if (appliedMigrations.has(migrationName)) {
        logger.debug(`Skipping already-applied migration: ${migrationName}`);
        skippedCount++;
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      logger.info(`Applying migration: ${migrationName}`);

      try {
        // Run the migration SQL (each file manages its own transaction)
        await client.query(sql);
        appliedCount++;
        logger.info(`Migration applied successfully: ${migrationName}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Migration failed: ${migrationName}`, { error: message });
        throw new Error(`Migration ${migrationName} failed: ${message}`);
      }
    }

    logger.info("Migration run complete", {
      applied: appliedCount,
      skipped: skippedCount,
      total: files.length,
    });
  } finally {
    client.release();
    await closePool();
  }
}

// ── Entry Point ───────────────────────────────────────────────────────────────
runMigrations().catch((error) => {
  const errObj = error instanceof Error
    ? { ...error, message: error.message, stack: error.stack }
    : { error: String(error), raw: error };
  logger.error("Migration runner crashed", errObj);
  process.exit(1);
});
