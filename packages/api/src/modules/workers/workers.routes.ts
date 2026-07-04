// ─────────────────────────────────────────────────────────────────────────────
//  Workers Routes
//  GET /api/v1/workers          — list active workers
//  GET /api/v1/workers/:workerId — get worker detail with heartbeats
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from "express";
import { param } from "express-validator";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { query } from "../../config/database";
import { AppError } from "../../utils/app-error";

export const workersRouter = Router();

workersRouter.use(authenticate);

workersRouter.get(
  "/",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `SELECT
           w.worker_id, w.hostname, w.pid, w.status, w.started_at, w.stopped_at,
           lh.heartbeat_time AS last_heartbeat,
           lh.cpu_usage, lh.memory_usage,
           COUNT(je.execution_id) FILTER (WHERE je.status = 'running') AS active_jobs
         FROM workers w
         LEFT JOIN LATERAL (
           SELECT heartbeat_time, cpu_usage, memory_usage
           FROM worker_heartbeats
           WHERE worker_id = w.worker_id
           ORDER BY heartbeat_time DESC
           LIMIT 1
         ) lh ON TRUE
         LEFT JOIN job_executions je ON je.worker_id = w.worker_id AND je.status = 'running'
         GROUP BY w.worker_id, lh.heartbeat_time, lh.cpu_usage, lh.memory_usage
         ORDER BY w.started_at DESC`
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }
);

workersRouter.get(
  "/:workerId",
  [param("workerId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workerResult = await query(
        "SELECT * FROM workers WHERE worker_id = $1",
        [req.params.workerId]
      );

      if (!workerResult.rows[0]) {
        throw AppError.notFound("Worker");
      }

      // Last 20 heartbeats
      const heartbeatsResult = await query(
        `SELECT heartbeat_id, heartbeat_time, cpu_usage, memory_usage
         FROM worker_heartbeats
         WHERE worker_id = $1
         ORDER BY heartbeat_time DESC
         LIMIT 20`,
        [req.params.workerId]
      );

      // Recent executions
      const executionsResult = await query(
        `SELECT
           je.execution_id, je.job_id, je.attempt, je.status,
           je.started_at, je.completed_at, je.duration_ms
         FROM job_executions je
         WHERE je.worker_id = $1
         ORDER BY je.started_at DESC
         LIMIT 20`,
        [req.params.workerId]
      );

      res.json({
        success: true,
        data: {
          ...workerResult.rows[0],
          heartbeats: heartbeatsResult.rows,
          recentExecutions: executionsResult.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
