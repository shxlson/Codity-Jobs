// ─────────────────────────────────────────────────────────────────────────────
//  Metrics Routes
//  GET /api/v1/metrics/overview        — system-wide health summary
//  GET /api/v1/metrics/queues          — per-queue throughput stats
//  GET /api/v1/metrics/workers         — worker performance summary
//  GET /api/v1/metrics/throughput      — job throughput over time
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/authenticate";
import { query } from "../../config/database";

export const metricsRouter = Router();

metricsRouter.use(authenticate);

metricsRouter.get(
  "/overview",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [jobStats, workerStats, dlqStats] = await Promise.all([
        query<{ status: string; count: string }>(
          `SELECT status, COUNT(*) AS count FROM jobs GROUP BY status`
        ),
        query<{ status: string; count: string }>(
          `SELECT status, COUNT(*) AS count FROM workers GROUP BY status`
        ),
        query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM dead_letter_queue`
        ),
      ]);

      const jobsByStatus: Record<string, number> = {};
      for (const row of jobStats.rows) {
        jobsByStatus[row.status] = parseInt(row.count, 10);
      }

      const workersByStatus: Record<string, number> = {};
      for (const row of workerStats.rows) {
        workersByStatus[row.status] = parseInt(row.count, 10);
      }

      res.json({
        success: true,
        data: {
          jobs: jobsByStatus,
          workers: workersByStatus,
          deadLetterQueue: parseInt(dlqStats.rows[0]?.count ?? "0", 10),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

metricsRouter.get(
  "/queues",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `SELECT
           q.queue_id, q.name, q.paused, q.concurrency, q.priority,
           COUNT(j.job_id) FILTER (WHERE j.status = 'queued')    AS queued_count,
           COUNT(j.job_id) FILTER (WHERE j.status = 'running')   AS running_count,
           COUNT(j.job_id) FILTER (WHERE j.status = 'completed') AS completed_count,
           COUNT(j.job_id) FILTER (WHERE j.status = 'failed')    AS failed_count,
           COUNT(j.job_id) FILTER (WHERE j.status = 'dead')      AS dead_count,
           AVG(je.duration_ms) FILTER (WHERE je.status = 'completed') AS avg_duration_ms
         FROM queues q
         LEFT JOIN jobs j ON j.queue_id = q.queue_id
         LEFT JOIN job_executions je ON je.job_id = j.job_id
         GROUP BY q.queue_id
         ORDER BY q.priority DESC, q.name ASC`
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
);

metricsRouter.get(
  "/throughput",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Default: last 24 hours, hourly buckets
      const hours = parseInt(req.query.hours as string, 10) || 24;

      const result = await query(
        `SELECT
           DATE_TRUNC('hour', completed_at) AS bucket,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE status = 'failed')    AS failed
         FROM job_executions
         WHERE completed_at >= NOW() - INTERVAL '${hours} hours'
         GROUP BY bucket
         ORDER BY bucket ASC`
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
);

metricsRouter.get(
  "/workers",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `SELECT
           w.worker_id, w.hostname, w.status,
           COUNT(je.execution_id) FILTER (WHERE je.status = 'completed') AS jobs_completed,
           COUNT(je.execution_id) FILTER (WHERE je.status = 'failed')    AS jobs_failed,
           AVG(je.duration_ms) AS avg_duration_ms,
           lh.cpu_usage, lh.memory_usage
         FROM workers w
         LEFT JOIN job_executions je ON je.worker_id = w.worker_id
         LEFT JOIN LATERAL (
           SELECT cpu_usage, memory_usage
           FROM worker_heartbeats
           WHERE worker_id = w.worker_id
           ORDER BY heartbeat_time DESC LIMIT 1
         ) lh ON TRUE
         GROUP BY w.worker_id, lh.cpu_usage, lh.memory_usage
         ORDER BY w.started_at DESC`
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
);
