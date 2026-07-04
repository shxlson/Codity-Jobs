// ─────────────────────────────────────────────────────────────────────────────
//  Scheduler Service
//  Runs as a background loop (or can be collocated with the API process).
//
//  Responsibilities:
//    1. Promote scheduled jobs: status = 'scheduled' AND scheduled_time <= NOW()
//       → status = 'queued'
//    2. Tick recurring (cron) jobs: when next_run <= NOW(), create a new job
//       instance and update next_run to the following occurrence.
//
//  Design note: Uses a single, non-overlapping interval. If a tick takes
//  longer than the interval, the next tick starts immediately after completion.
// ─────────────────────────────────────────────────────────────────────────────

import { getPool, closePool } from "./config/database";
import { workerEnv } from "./config/env";
import cronParser from "cron-parser";

let isShuttingDown = false;
const TICK_INTERVAL_MS = parseInt(
  process.env.SCHEDULER_TICK_INTERVAL_MS ?? "60000",
  10
);

// ─────────────────────────────────────────────────────────────────────────────
//  Promote Scheduled Jobs
//  Any job in 'scheduled' status whose scheduled_time has passed should
//  be moved back to 'queued' so workers can pick it up.
// ─────────────────────────────────────────────────────────────────────────────

async function promoteScheduledJobs(): Promise<number> {
  const pool = getPool();

  const result = await pool.query<{ job_id: string }>(
    `UPDATE jobs
     SET status = 'queued', scheduled_time = NULL
     WHERE status = 'scheduled'
       AND scheduled_time <= NOW()
     RETURNING job_id`
  );

  return result.rowCount ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tick Recurring Jobs
//  For each scheduled_jobs row whose next_run has passed:
//    1. Create a new job instance (clone of the template job)
//    2. Update next_run to the next cron occurrence
// ─────────────────────────────────────────────────────────────────────────────

async function tickRecurringJobs(): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  let spawned = 0;

  try {
    await client.query("BEGIN");

    // Lock the due scheduled_jobs rows to prevent duplicate spawning
    // if multiple scheduler instances run (safety measure)
    const dueResult = await client.query<{
      schedule_id: string;
      job_id: string;
      cron_expression: string;
    }>(
      `SELECT schedule_id, job_id, cron_expression
       FROM scheduled_jobs
       WHERE next_run <= NOW()
       FOR UPDATE SKIP LOCKED`
    );

    for (const schedule of dueResult.rows) {
      // Fetch the template job for cloning
      const jobResult = await client.query<{
        queue_id: string;
        payload: Record<string, unknown>;
        priority: number;
      }>(
        "SELECT queue_id, payload, priority FROM jobs WHERE job_id = $1",
        [schedule.job_id]
      );

      const templateJob = jobResult.rows[0];
      if (!templateJob) continue;

      // Create a new job instance (status = queued, no scheduled_time)
      await client.query(
        `INSERT INTO jobs (queue_id, status, payload, priority)
         VALUES ($1, 'queued', $2, $3)`,
        [templateJob.queue_id, JSON.stringify(templateJob.payload), templateJob.priority]
      );

      // Calculate the next run time using cron-parser
      const nextRun = computeNextCronRun(schedule.cron_expression);

      await client.query(
        "UPDATE scheduled_jobs SET next_run = $1 WHERE schedule_id = $2",
        [nextRun, schedule.schedule_id]
      );

      spawned++;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return spawned;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stale Worker Detection
//  Workers that haven't sent a heartbeat in STALE_THRESHOLD are marked offline
//  and any jobs they were running are moved back to 'queued'.
// ─────────────────────────────────────────────────────────────────────────────

async function detectStaleWorkers(): Promise<void> {
  const pool = getPool();
  const staleThresholdMs =
    parseInt(process.env.WORKER_STALE_THRESHOLD_MS ?? "90000", 10);

  // Find workers with no recent heartbeat
  const staleResult = await pool.query<{ worker_id: string }>(
    `SELECT w.worker_id
     FROM workers w
     WHERE w.status IN ('active', 'idle')
       AND NOT EXISTS (
         SELECT 1 FROM worker_heartbeats wh
         WHERE wh.worker_id = w.worker_id
           AND wh.heartbeat_time >= NOW() - INTERVAL '${staleThresholdMs} milliseconds'
       )`
  );

  for (const { worker_id } of staleResult.rows) {
    console.warn(`[scheduler] Stale worker detected: ${worker_id}`);

    await pool.query(
      "UPDATE workers SET status = 'offline', stopped_at = NOW() WHERE worker_id = $1",
      [worker_id]
    );

    // Requeue any jobs that were running on this stale worker
    const rescuedResult = await pool.query<{ job_id: string }>(
      `UPDATE jobs j
       SET status = 'queued'
       FROM job_executions je
       WHERE je.job_id = j.job_id
         AND je.worker_id = $1
         AND j.status IN ('claimed', 'running')
         AND je.status = 'running'
       RETURNING j.job_id`,
      [worker_id]
    );

    if (rescuedResult.rowCount && rescuedResult.rowCount > 0) {
      console.log(
        `[scheduler] Rescued ${rescuedResult.rowCount} job(s) from stale worker ${worker_id}`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scheduler Tick
// ─────────────────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  try {
    const [promoted, spawned] = await Promise.all([
      promoteScheduledJobs(),
      tickRecurringJobs(),
      detectStaleWorkers(),
    ]);

    if (promoted > 0 || spawned > 0) {
      console.log(
        `[scheduler] Tick: promoted=${promoted}, spawned_cron=${spawned}`
      );
    }
  } catch (error) {
    console.error("[scheduler] Tick error:", (error as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Loop
// ─────────────────────────────────────────────────────────────────────────────

async function runSchedulerLoop(): Promise<void> {
  console.log(
    `[scheduler] Started (tick interval: ${TICK_INTERVAL_MS}ms)`
  );

  while (!isShuttingDown) {
    await tick();
    await sleep(TICK_INTERVAL_MS);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────────────────────

function computeNextCronRun(expression: string): Date {
  const interval = cronParser.parseExpression(expression, {
    utc: true,
    currentDate: new Date(),
  });
  return interval.next().toDate();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[scheduler] Received ${signal} — shutting down`);
  isShuttingDown = true;
  await closePool();
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Entry Point
// ─────────────────────────────────────────────────────────────────────────────

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

runSchedulerLoop().catch((error) => {
  console.error("[scheduler] Fatal error:", error);
  process.exit(1);
});
