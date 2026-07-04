// ─────────────────────────────────────────────────────────────────────────────
//  Worker Database Pool
//  Same pattern as the API pool, isolated to the worker process.
// ─────────────────────────────────────────────────────────────────────────────

import { Pool, PoolClient } from "pg";
import { workerEnv } from "./env";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: workerEnv.DATABASE_URL,
      min: 2,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    _pool.on("error", (err) => {
      console.error("[pool] Unexpected database error:", err.message);
    });
  }
  return _pool;
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
