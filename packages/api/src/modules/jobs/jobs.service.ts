// ─────────────────────────────────────────────────────────────────────────────
//  Jobs Service
//  Handles creation of immediate, delayed, scheduled (cron), and batch jobs.
//  Also provides job lifecycle management: requeue, cancel, DLQ inspection.
// ─────────────────────────────────────────────────────────────────────────────

import { query, withTransaction } from "../../config/database";
import { AppError } from "../../utils/app-error";
import { parsePagination, buildPaginatedResponse } from "../../utils/pagination";
import { Request } from "express";
import { JobStatus } from "@codity/shared";

// ── Row types ─────────────────────────────────────────────────────────────────

interface JobRow {
  job_id: string;
  queue_id: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  priority: number;
  scheduled_time: Date | null;
  attempt_count: number;
  idempotency_key: string | null;
  created_at: Date;
}

interface DLQRow {
  dlq_id: string;
  job_id: string;
  reason: string | null;
  error_detail: Record<string, unknown> | null;
  moved_at: Date;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateJobDto {
  queueId: string;
  payload?: Record<string, unknown>;
  priority?: number;
  scheduledTime?: string;      // ISO timestamp for delayed jobs
  cronExpression?: string;     // For recurring jobs
  idempotencyKey?: string;
}

export interface CreateBatchJobsDto {
  queueId: string;
  jobs: Array<{
    payload?: Record<string, unknown>;
    priority?: number;
    scheduledTime?: string;
    idempotencyKey?: string;
  }>;
}

// ── Ownership Guard ───────────────────────────────────────────────────────────

async function assertQueueOwnership(
  queueId: string,
  ownerId: string
): Promise<void> {
  const result = await query(
    `SELECT 1 FROM queues q
     JOIN projects p ON p.project_id = q.project_id
     JOIN organizations o ON o.organization_id = p.organization_id
     WHERE q.queue_id = $1 AND o.owner_id = $2`,
    [queueId, ownerId]
  );
  if (!result.rowCount || result.rowCount === 0) {
    throw AppError.forbidden("You do not have access to this queue");
  }
}

// ── Service Functions ─────────────────────────────────────────────────────────

/**
 * Creates a single job. Supports immediate, delayed, and recurring (cron) jobs.
 *
 * - Immediate:  no scheduledTime, no cronExpression → status = 'queued'
 * - Delayed:    scheduledTime in the future → status = 'scheduled'
 * - Recurring:  cronExpression provided → status = 'scheduled', inserts into scheduled_jobs
 */
export async function createJob(dto: CreateJobDto, ownerId: string) {
  await assertQueueOwnership(dto.queueId, ownerId);

  return withTransaction(async (client) => {
    const isScheduled = !!dto.scheduledTime || !!dto.cronExpression;
    const status: JobStatus = isScheduled ? "scheduled" : "queued";
    const scheduledTime = dto.scheduledTime
      ? new Date(dto.scheduledTime)
      : null;

    const jobResult = await client.query<JobRow>(
      `INSERT INTO jobs (queue_id, status, payload, priority, scheduled_time, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.queueId,
        status,
        JSON.stringify(dto.payload ?? {}),
        dto.priority ?? 0,
        scheduledTime,
        dto.idempotencyKey ?? null,
      ]
    );

    const job = jobResult.rows[0];

    // Register a cron schedule if requested
    if (dto.cronExpression) {
      const nextRun = computeNextRun(dto.cronExpression);

      await client.query(
        `INSERT INTO scheduled_jobs (job_id, cron_expression, next_run)
         VALUES ($1, $2, $3)`,
        [job.job_id, dto.cronExpression, nextRun]
      );
    }

    return job;
  });
}

/**
 * Creates multiple jobs in a single transaction (batch submission).
 * Returns the list of created jobs.
 */
export async function createBatchJobs(
  dto: CreateBatchJobsDto,
  ownerId: string
): Promise<JobRow[]> {
  await assertQueueOwnership(dto.queueId, ownerId);

  return withTransaction(async (client) => {
    const created: JobRow[] = [];

    for (const jobData of dto.jobs) {
      const isScheduled = !!jobData.scheduledTime;
      const status: JobStatus = isScheduled ? "scheduled" : "queued";

      const result = await client.query<JobRow>(
        `INSERT INTO jobs (queue_id, status, payload, priority, scheduled_time, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          dto.queueId,
          status,
          JSON.stringify(jobData.payload ?? {}),
          jobData.priority ?? 0,
          jobData.scheduledTime ? new Date(jobData.scheduledTime) : null,
          jobData.idempotencyKey ?? null,
        ]
      );
      created.push(result.rows[0]);
    }

    return created;
  });
}

/**
 * Lists jobs with filtering and pagination.
 */
export async function listJobs(
  queueId: string,
  ownerId: string,
  req: Request
) {
  await assertQueueOwnership(queueId, ownerId);

  const pagination = parsePagination(req);
  const status = req.query.status as JobStatus | undefined;

  const conditions = ["j.queue_id = $1"];
  const params: unknown[] = [queueId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`j.status = $${paramIdx++}`);
    params.push(status);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [countResult, rowsResult] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM jobs j ${whereClause}`,
      params
    ),
    query<JobRow>(
      `SELECT j.* FROM jobs j
       ${whereClause}
       ORDER BY j.priority DESC, j.created_at ASC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, pagination.pageSize, pagination.offset]
    ),
  ]);

  return buildPaginatedResponse(
    rowsResult.rows,
    parseInt(countResult.rows[0].count, 10),
    pagination
  );
}

/**
 * Retrieves a single job with its execution history.
 */
export async function getJob(jobId: string, ownerId: string) {
  const result = await query<JobRow>(
    `SELECT j.* FROM jobs j
     JOIN queues q ON q.queue_id = j.queue_id
     JOIN projects p ON p.project_id = q.project_id
     JOIN organizations o ON o.organization_id = p.organization_id
     WHERE j.job_id = $1 AND o.owner_id = $2`,
    [jobId, ownerId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("Job");
  }

  const job = result.rows[0];

  // Fetch execution history
  const executionsResult = await query(
    `SELECT
       je.execution_id, je.worker_id, je.attempt, je.status,
       je.started_at, je.completed_at, je.duration_ms,
       w.hostname AS worker_hostname
     FROM job_executions je
     JOIN workers w ON w.worker_id = je.worker_id
     WHERE je.job_id = $1
     ORDER BY je.attempt ASC`,
    [jobId]
  );

  return { ...job, executions: executionsResult.rows };
}

/**
 * Cancels a queued or scheduled job (cannot cancel running jobs).
 */
export async function cancelJob(jobId: string, ownerId: string) {
  const result = await query<JobRow>(
    `UPDATE jobs j
     SET status = 'dead'
     FROM queues q
     JOIN projects p ON p.project_id = q.project_id
     JOIN organizations o ON o.organization_id = p.organization_id
     WHERE j.job_id = $1
       AND j.queue_id = q.queue_id
       AND o.owner_id = $2
       AND j.status IN ('queued', 'scheduled', 'retrying')
     RETURNING j.*`,
    [jobId, ownerId]
  );

  if (!result.rows[0]) {
    throw new AppError(
      "Job not found or cannot be cancelled in its current state",
      400
    );
  }
  return result.rows[0];
}

/**
 * Requeues a dead or failed job — moves it back to 'queued' status.
 */
export async function requeueJob(jobId: string, ownerId: string) {
  const result = await query<JobRow>(
    `UPDATE jobs j
     SET status = 'queued', attempt_count = 0
     FROM queues q
     JOIN projects p ON p.project_id = q.project_id
     JOIN organizations o ON o.organization_id = p.organization_id
     WHERE j.job_id = $1
       AND j.queue_id = q.queue_id
       AND o.owner_id = $2
       AND j.status IN ('failed', 'dead')
     RETURNING j.*`,
    [jobId, ownerId]
  );

  if (!result.rows[0]) {
    throw new AppError(
      "Job not found or is not in a failed/dead state",
      400
    );
  }

  // Remove from DLQ if present
  await query(
    "DELETE FROM dead_letter_queue WHERE job_id = $1",
    [jobId]
  );

  return result.rows[0];
}

/**
 * Returns execution logs for a specific job.
 */
export async function getJobLogs(jobId: string, ownerId: string) {
  // Verify ownership first
  await getJob(jobId, ownerId);

  const result = await query(
    `SELECT jl.log_id, jl.execution_id, jl.level, jl.message, jl.meta, jl.created_at
     FROM job_logs jl
     JOIN job_executions je ON je.execution_id = jl.execution_id
     WHERE je.job_id = $1
     ORDER BY jl.created_at ASC`,
    [jobId]
  );

  return result.rows;
}

/**
 * Lists all entries in the Dead Letter Queue for a given queue.
 */
export async function listDLQ(queueId: string, ownerId: string, req: Request) {
  await assertQueueOwnership(queueId, ownerId);

  const pagination = parsePagination(req);

  const [countResult, rowsResult] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) FROM dead_letter_queue dlq
       JOIN jobs j ON j.job_id = dlq.job_id
       WHERE j.queue_id = $1`,
      [queueId]
    ),
    query<DLQRow>(
      `SELECT dlq.*, j.payload, j.priority, j.created_at AS job_created_at
       FROM dead_letter_queue dlq
       JOIN jobs j ON j.job_id = dlq.job_id
       WHERE j.queue_id = $1
       ORDER BY dlq.moved_at DESC
       LIMIT $2 OFFSET $3`,
      [queueId, pagination.pageSize, pagination.offset]
    ),
  ]);

  return buildPaginatedResponse(
    rowsResult.rows,
    parseInt(countResult.rows[0].count, 10),
    pagination
  );
}

// ── Internal Utilities ────────────────────────────────────────────────────────

/**
 * Computes the next run time from a cron expression.
 * Uses a simple approach — in production, use the 'cron-parser' library.
 */
function computeNextRun(cronExpression: string): Date {
  // For now, schedule 1 minute from now as a sensible default.
  // The scheduler service will update this after each run using cron-parser.
  const nextRun = new Date();
  nextRun.setMinutes(nextRun.getMinutes() + 1, 0, 0);
  return nextRun;
}
