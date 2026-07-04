// ─────────────────────────────────────────────────────────────────────────────
//  Queues Service
//  Handles queue CRUD, pause/resume, and retry policy management.
// ─────────────────────────────────────────────────────────────────────────────

import { query, withTransaction } from "../../config/database";
import { AppError } from "../../utils/app-error";
import { RetryStrategy } from "@codity/shared";

// ── Row types ─────────────────────────────────────────────────────────────────

interface QueueRow {
  queue_id: string;
  project_id: string;
  name: string;
  priority: number;
  concurrency: number;
  paused: boolean;
  created_at: Date;
}

interface QueueWithPolicyRow extends QueueRow {
  policy_id: string | null;
  strategy: RetryStrategy | null;
  max_attempts: number | null;
  delay_seconds: number | null;
}

interface RetryPolicyRow {
  policy_id: string;
  queue_id: string;
  strategy: RetryStrategy;
  max_attempts: number;
  delay_seconds: number;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateQueueDto {
  projectId: string;
  name: string;
  priority?: number;
  concurrency?: number;
  retryPolicy?: {
    strategy: RetryStrategy;
    maxAttempts: number;
    delaySeconds: number;
  };
}

export interface UpdateQueueDto {
  name?: string;
  priority?: number;
  concurrency?: number;
}

// ── Ownership Guard ───────────────────────────────────────────────────────────

async function assertProjectOwnership(
  projectId: string,
  ownerId: string
): Promise<void> {
  const result = await query(
    `SELECT 1 FROM projects p
     JOIN organizations o ON o.organization_id = p.organization_id
     WHERE p.project_id = $1 AND o.owner_id = $2`,
    [projectId, ownerId]
  );
  if (!result.rowCount || result.rowCount === 0) {
    throw AppError.forbidden("You do not have access to this project");
  }
}

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

export async function createQueue(dto: CreateQueueDto, ownerId: string) {
  await assertProjectOwnership(dto.projectId, ownerId);

  return withTransaction(async (client) => {
    const queueResult = await client.query<QueueRow>(
      `INSERT INTO queues (project_id, name, priority, concurrency)
       VALUES ($1, $2, $3, $4)
       RETURNING queue_id, project_id, name, priority, concurrency, paused, created_at`,
      [
        dto.projectId,
        dto.name.trim(),
        dto.priority ?? 0,
        dto.concurrency ?? 1,
      ]
    );

    const queue = queueResult.rows[0];

    // Create an associated retry policy if provided
    if (dto.retryPolicy) {
      const { strategy, maxAttempts, delaySeconds } = dto.retryPolicy;
      await client.query(
        `INSERT INTO retry_policies (queue_id, strategy, max_attempts, delay_seconds)
         VALUES ($1, $2, $3, $4)`,
        [queue.queue_id, strategy, maxAttempts, delaySeconds]
      );
    }

    return queue;
  });
}

export async function listQueues(projectId: string, ownerId: string) {
  await assertProjectOwnership(projectId, ownerId);

  const result = await query<QueueWithPolicyRow>(
    `SELECT
       q.queue_id, q.project_id, q.name, q.priority, q.concurrency,
       q.paused, q.created_at,
       rp.policy_id, rp.strategy, rp.max_attempts, rp.delay_seconds
     FROM queues q
     LEFT JOIN retry_policies rp ON rp.queue_id = q.queue_id
     WHERE q.project_id = $1
     ORDER BY q.priority DESC, q.name ASC`,
    [projectId]
  );
  return result.rows;
}

export async function getQueue(queueId: string, ownerId: string) {
  await assertQueueOwnership(queueId, ownerId);

  const result = await query<QueueWithPolicyRow>(
    `SELECT
       q.queue_id, q.project_id, q.name, q.priority, q.concurrency,
       q.paused, q.created_at,
       rp.policy_id, rp.strategy, rp.max_attempts, rp.delay_seconds
     FROM queues q
     LEFT JOIN retry_policies rp ON rp.queue_id = q.queue_id
     WHERE q.queue_id = $1`,
    [queueId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("Queue");
  }
  return result.rows[0];
}

export async function updateQueue(
  queueId: string,
  ownerId: string,
  data: UpdateQueueDto
) {
  await assertQueueOwnership(queueId, ownerId);

  const result = await query<QueueRow>(
    `UPDATE queues
     SET
       name        = COALESCE($1, name),
       priority    = COALESCE($2, priority),
       concurrency = COALESCE($3, concurrency)
     WHERE queue_id = $4
     RETURNING queue_id, project_id, name, priority, concurrency, paused, created_at`,
    [data.name?.trim(), data.priority, data.concurrency, queueId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("Queue");
  }
  return result.rows[0];
}

export async function deleteQueue(queueId: string, ownerId: string): Promise<void> {
  await assertQueueOwnership(queueId, ownerId);

  const result = await query(
    "DELETE FROM queues WHERE queue_id = $1",
    [queueId]
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw AppError.notFound("Queue");
  }
}

export async function pauseQueue(queueId: string, ownerId: string) {
  await assertQueueOwnership(queueId, ownerId);
  const result = await query<QueueRow>(
    "UPDATE queues SET paused = TRUE WHERE queue_id = $1 RETURNING *",
    [queueId]
  );
  if (!result.rows[0]) throw AppError.notFound("Queue");
  return result.rows[0];
}

export async function resumeQueue(queueId: string, ownerId: string) {
  await assertQueueOwnership(queueId, ownerId);
  const result = await query<QueueRow>(
    "UPDATE queues SET paused = FALSE WHERE queue_id = $1 RETURNING *",
    [queueId]
  );
  if (!result.rows[0]) throw AppError.notFound("Queue");
  return result.rows[0];
}

// ── Retry Policy ──────────────────────────────────────────────────────────────

export async function upsertRetryPolicy(
  queueId: string,
  ownerId: string,
  data: { strategy: RetryStrategy; maxAttempts: number; delaySeconds: number }
) {
  await assertQueueOwnership(queueId, ownerId);

  const result = await query<RetryPolicyRow>(
    `INSERT INTO retry_policies (queue_id, strategy, max_attempts, delay_seconds)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (queue_id) DO UPDATE
       SET strategy      = EXCLUDED.strategy,
           max_attempts  = EXCLUDED.max_attempts,
           delay_seconds = EXCLUDED.delay_seconds
     RETURNING *`,
    [queueId, data.strategy, data.maxAttempts, data.delaySeconds]
  );
  return result.rows[0];
}

export async function getQueueStats(queueId: string, ownerId: string) {
  await assertQueueOwnership(queueId, ownerId);

  const result = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count
     FROM jobs
     WHERE queue_id = $1
     GROUP BY status`,
    [queueId]
  );

  const stats: Record<string, number> = {};
  for (const row of result.rows) {
    stats[row.status] = parseInt(row.count, 10);
  }
  return stats;
}
