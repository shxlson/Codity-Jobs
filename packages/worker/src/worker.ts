// ─────────────────────────────────────────────────────────────────────────────
//  Worker Service — Main Poll Loop
//
//  Flow (matches the worker processing flowchart):
//    1. Register worker in DB
//    2. Start heartbeat loop
//    3. Poll queues for claimable jobs
//    4. Atomically claim a job (SELECT FOR UPDATE SKIP LOCKED)
//    5. Execute job concurrently (up to CONCURRENCY limit)
//    6. On success → mark completed, store execution log
//    7. On failure:
//       a. Fetch retry policy for this queue
//       b. If attempts remaining → calculate backoff → requeue with scheduled_time
//       c. If max retries exceeded → move to Dead Letter Queue
//    8. Graceful shutdown on SIGTERM/SIGINT
// ─────────────────────────────────────────────────────────────────────────────

import os from "os";
import { PoolClient } from "pg";
import { getPool, getClient, closePool } from "./config/database";
import { workerEnv } from "./config/env";
import { executeJob } from "./executor/executor";
import { computeRetryAt } from "./retry/backoff";
import { JobRow, RetryPolicyRow, WorkerRow } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Worker State
// ─────────────────────────────────────────────────────────────────────────────

let workerId: string | null = null;
let isShuttingDown = false;
let activeJobCount = 0;

// ─────────────────────────────────────────────────────────────────────────────
//  Worker Registration
// ─────────────────────────────────────────────────────────────────────────────

async function registerWorker(): Promise<string> {
  const pool = getPool();
  const result = await pool.query<WorkerRow>(
    `INSERT INTO workers (hostname, pid, status)
     VALUES ($1, $2, 'active')
     RETURNING worker_id`,
    [workerEnv.HOSTNAME, workerEnv.PID]
  );
  const id = result.rows[0].worker_id;
  console.log(`[worker] Registered with ID ${id} on ${workerEnv.HOSTNAME}`);
  return id;
}

async function deregisterWorker(id: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE workers SET status = 'offline', stopped_at = NOW()
     WHERE worker_id = $1`,
    [id]
  );
  console.log(`[worker] Deregistered worker ${id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Heartbeat Loop
// ─────────────────────────────────────────────────────────────────────────────

function startHeartbeatLoop(id: string): NodeJS.Timeout {
  const interval = setInterval(async () => {
    try {
      const memUsage = process.memoryUsage().rss;
      const cpuUsage = process.cpuUsage();
      // Rough CPU percentage approximation
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1_000_000;

      await getPool().query(
        `INSERT INTO worker_heartbeats (worker_id, cpu_usage, memory_usage)
         VALUES ($1, $2, $3)`,
        [id, cpuPercent, memUsage]
      );

      // Update worker status based on active job count
      const status = activeJobCount > 0 ? "active" : "idle";
      await getPool().query(
        "UPDATE workers SET status = $1 WHERE worker_id = $2",
        [status, id]
      );
    } catch (error) {
      console.error("[heartbeat] Error sending heartbeat:", (error as Error).message);
    }
  }, workerEnv.HEARTBEAT_INTERVAL_MS);

  // Don't prevent process exit
  interval.unref();
  return interval;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Atomic Job Claim
//  Uses SELECT FOR UPDATE SKIP LOCKED — the cornerstone of preventing
//  duplicate job execution across multiple workers.
// ─────────────────────────────────────────────────────────────────────────────

async function claimJob(
  client: PoolClient,
  wid: string
): Promise<JobRow | null> {
  await client.query("BEGIN");

  // Select one claimable job across all non-paused queues,
  // ordered by queue priority then job priority, skipping locked rows.
  // SKIP LOCKED is what makes this operation safe for concurrent workers.
  const result = await client.query<JobRow>(
    `SELECT j.*
     FROM jobs j
     JOIN queues q ON q.queue_id = j.queue_id
     WHERE q.paused = FALSE
       AND j.status IN ('queued', 'retrying')
       AND (j.scheduled_time IS NULL OR j.scheduled_time <= NOW())
     ORDER BY q.priority DESC, j.priority DESC, j.created_at ASC
     LIMIT 1
     FOR UPDATE OF j SKIP LOCKED`
  );

  if (!result.rows[0]) {
    await client.query("ROLLBACK");
    return null;
  }

  const job = result.rows[0];

  // Atomically transition from queued/retrying → claimed
  await client.query(
    `UPDATE jobs
     SET status = 'claimed', attempt_count = attempt_count + 1
     WHERE job_id = $1`,
    [job.job_id]
  );

  // Create an execution record
  await client.query(
    `INSERT INTO job_executions (job_id, worker_id, attempt, status)
     VALUES ($1, $2, $3, 'running')`,
    [job.job_id, wid, job.attempt_count + 1]
  );

  // Transition to running
  await client.query(
    "UPDATE jobs SET status = 'running' WHERE job_id = $1",
    [job.job_id]
  );

  await client.query("COMMIT");

  return { ...job, attempt_count: job.attempt_count + 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Job Completion Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleSuccess(
  job: JobRow,
  executionId: string,
  output: Record<string, unknown>
): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE jobs SET status = 'completed' WHERE job_id = $1`,
    [job.job_id]
  );

  await pool.query(
    `UPDATE job_executions
     SET status = 'completed', completed_at = NOW(),
         duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
     WHERE execution_id = $1`,
    [executionId]
  );

  await pool.query(
    `INSERT INTO job_logs (execution_id, level, message, meta)
     VALUES ($1, 'info', 'Job completed successfully', $2)`,
    [executionId, JSON.stringify({ output })]
  );
}

async function handleFailure(
  job: JobRow,
  executionId: string,
  error: Error
): Promise<void> {
  const pool = getPool();

  // Record execution failure
  await pool.query(
    `UPDATE job_executions
     SET status = 'failed', completed_at = NOW(),
         duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
     WHERE execution_id = $1`,
    [executionId]
  );

  await pool.query(
    `INSERT INTO job_logs (execution_id, level, message, meta)
     VALUES ($1, 'error', $2, $3)`,
    [
      executionId,
      `Job execution failed: ${error.message}`,
      JSON.stringify({ stack: error.stack }),
    ]
  );

  // Look up the retry policy for this queue
  const policyResult = await pool.query<RetryPolicyRow>(
    "SELECT * FROM retry_policies WHERE queue_id = $1",
    [job.queue_id]
  );

  const policy = policyResult.rows[0];

  if (policy && job.attempt_count < policy.max_attempts) {
    // ── Retry path ────────────────────────────────────────────────────────────
    const retryAt = computeRetryAt(
      policy.strategy,
      job.attempt_count,
      policy.delay_seconds
    );

    await pool.query(
      `UPDATE jobs
       SET status = 'retrying', scheduled_time = $1
       WHERE job_id = $2`,
      [retryAt, job.job_id]
    );

    console.log(
      `[worker] Job ${job.job_id} will retry at ${retryAt.toISOString()} ` +
      `(attempt ${job.attempt_count}/${policy.max_attempts})`
    );
  } else {
    // ── Dead Letter Queue path ────────────────────────────────────────────────
    await pool.query(
      "UPDATE jobs SET status = 'dead' WHERE job_id = $1",
      [job.job_id]
    );

    await pool.query(
      `INSERT INTO dead_letter_queue (job_id, reason, error_detail)
       VALUES ($1, $2, $3)`,
      [
        job.job_id,
        `Max retries exceeded after ${job.attempt_count} attempt(s)`,
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          attempt_count: job.attempt_count,
        }),
      ]
    );

    console.warn(`[worker] Job ${job.job_id} moved to Dead Letter Queue`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Single Job Execution
// ─────────────────────────────────────────────────────────────────────────────

async function processJob(job: JobRow, executionId: string): Promise<void> {
  console.log(
    `[worker] Executing job ${job.job_id} (attempt ${job.attempt_count})`
  );

  try {
    const output = await executeJob(job);
    await handleSuccess(job, executionId, output);
    console.log(`[worker] Job ${job.job_id} completed`);
  } catch (error) {
    console.error(`[worker] Job ${job.job_id} failed:`, (error as Error).message);
    await handleFailure(job, executionId, error as Error);
  } finally {
    activeJobCount--;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Poll Loop
// ─────────────────────────────────────────────────────────────────────────────

async function pollOnce(wid: string): Promise<boolean> {
  if (activeJobCount >= workerEnv.CONCURRENCY) {
    return false; // At capacity — skip this poll
  }

  const client = await getClient();

  try {
    const job = await claimJob(client, wid);
    if (!job) return false;

    // Retrieve the execution_id we just created
    const execResult = await getPool().query<{ execution_id: string }>(
      `SELECT execution_id FROM job_executions
       WHERE job_id = $1
       ORDER BY started_at DESC LIMIT 1`,
      [job.job_id]
    );

    const executionId = execResult.rows[0]?.execution_id;
    if (!executionId) {
      console.error(`[worker] No execution record found for job ${job.job_id}`);
      return false;
    }

    activeJobCount++;

    // Process job asynchronously (non-blocking) — allows concurrent execution
    processJob(job, executionId).catch((err) => {
      console.error(`[worker] Unhandled error in processJob:`, err);
      activeJobCount--;
    });

    return true;
  } catch (error) {
    console.error("[worker] Poll error:", (error as Error).message);
    return false;
  } finally {
    client.release();
  }
}

async function runPollLoop(wid: string): Promise<void> {
  console.log(
    `[worker] Poll loop started (interval: ${workerEnv.POLL_INTERVAL_MS}ms, ` +
    `concurrency: ${workerEnv.CONCURRENCY})`
  );

  while (!isShuttingDown) {
    try {
      const claimed = await pollOnce(wid);

      if (!claimed) {
        // No job found or at capacity — wait before next poll
        await sleep(workerEnv.POLL_INTERVAL_MS);
      }
      // If a job was claimed, immediately poll again (drain the queue)
    } catch (error) {
      console.error("[worker] Poll loop error:", (error as Error).message);
      await sleep(workerEnv.POLL_INTERVAL_MS);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Graceful Shutdown
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal} — initiating graceful shutdown`);
  isShuttingDown = true;

  if (workerId) {
    await getPool().query(
      "UPDATE workers SET status = 'draining' WHERE worker_id = $1",
      [workerId]
    );
  }

  // Wait for active jobs to complete (up to 30s)
  const shutdownDeadline = Date.now() + 30_000;
  while (activeJobCount > 0 && Date.now() < shutdownDeadline) {
    console.log(`[worker] Waiting for ${activeJobCount} active job(s) to finish...`);
    await sleep(1_000);
  }

  if (activeJobCount > 0) {
    console.warn(`[worker] Forced shutdown with ${activeJobCount} jobs still running`);
  }

  if (workerId) {
    await deregisterWorker(workerId);
  }

  await closePool();
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("[worker] Uncaught exception:", err);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[worker] Unhandled rejection:", reason);
    shutdown("unhandledRejection");
  });

  workerId = await registerWorker();

  const heartbeatInterval = startHeartbeatLoop(workerId);

  try {
    await runPollLoop(workerId);
  } finally {
    clearInterval(heartbeatInterval);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("[worker] Fatal error:", error);
  process.exit(1);
});
