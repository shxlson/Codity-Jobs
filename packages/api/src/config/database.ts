// ─────────────────────────────────────────────────────────────────────────────
//  Database Pool
//  Single shared pg.Pool instance for the entire API process.
//  All queries go through this pool — never create ad-hoc clients.
// ─────────────────────────────────────────────────────────────────────────────

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "./env";
import { logger } from "../utils/logger";

// Singleton pool — module-level, lazy-initialized
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const isCloudDb =
      env.DATABASE_URL?.includes("neon.tech") ||
      env.DATABASE_URL?.includes("render.com") ||
      env.DATABASE_URL?.includes("supabase.co") ||
      env.DATABASE_URL?.includes("railway.app") ||
      env.DATABASE_URL?.includes("sslmode=require") ||
      (env.DATABASE_URL && !env.DATABASE_URL.includes("localhost") && !env.DATABASE_URL.includes("127.0.0.1"));

    _pool = new Pool({
      connectionString: env.DATABASE_URL,
      min: env.DATABASE_POOL_MIN,
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
    });

    _pool.on("error", (err) => {
      logger.error("Unexpected database pool error", { error: err.message });
    });

    _pool.on("connect", () => {
      logger.debug("New database client connected to pool");
    });
  }
  return _pool;
}

/**
 * Execute a single query against the pool.
 * Uses the generic `T` type for type-safe result rows.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  logger.debug("Query executed", {
    query: text.substring(0, 100),
    duration_ms: duration,
    rows: result.rowCount,
  });

  return result;
}

/**
 * Acquire a dedicated client from the pool for use within a transaction.
 * Caller is responsible for calling client.release() when done.
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Run a function within a serializable database transaction.
 * Automatically commits on success and rolls back on error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify database connectivity. Called at server startup.
 */
export async function checkDatabaseConnection(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{ now: Date }>("SELECT NOW() AS now");
    logger.info("Database connection verified", {
      server_time: result.rows[0].now,
    });
  } finally {
    client.release();
  }
}

/**
 * Gracefully drain and close the pool. Called on server shutdown.
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    logger.info("Database pool closed");
  }
}
