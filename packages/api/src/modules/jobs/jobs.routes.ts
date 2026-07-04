// ─────────────────────────────────────────────────────────────────────────────
//  Jobs Routes
//  POST   /api/v1/jobs                    — create single job
//  POST   /api/v1/jobs/batch              — create batch jobs
//  GET    /api/v1/jobs?queueId=&status=   — list jobs (paginated)
//  GET    /api/v1/jobs/:jobId             — get job with execution history
//  POST   /api/v1/jobs/:jobId/cancel      — cancel a queued/scheduled job
//  POST   /api/v1/jobs/:jobId/requeue     — requeue a failed/dead job
//  GET    /api/v1/jobs/:jobId/logs        — get execution logs
//  GET    /api/v1/jobs/dlq?queueId=       — list DLQ entries
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from "express";
import { body, param, query as queryValidator } from "express-validator";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import * as jobService from "./jobs.service";

export const jobsRouter = Router();

jobsRouter.use(authenticate);

// ── Batch & DLQ endpoints first (avoid /:jobId param conflicts) ───────────────

jobsRouter.post(
  "/batch",
  [
    body("queueId").isInt({ min: 1 }).withMessage("Valid queue ID required"),
    body("jobs").isArray({ min: 1, max: 500 }).withMessage("jobs must be an array of 1–500 items"),
    body("jobs.*.payload").optional().isObject(),
    body("jobs.*.priority").optional().isInt({ min: 0 }),
    body("jobs.*.scheduledTime").optional().isISO8601().withMessage("scheduledTime must be ISO 8601"),
    body("jobs.*.idempotencyKey").optional().isString().isLength({ max: 255 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobs = await jobService.createBatchJobs(
        { queueId: req.body.queueId, jobs: req.body.jobs },
        req.user!.userId
      );
      res.status(201).json({ success: true, data: jobs });
    } catch (error) {
      next(error);
    }
  }
);

jobsRouter.get(
  "/dlq",
  [queryValidator("queueId").isInt({ min: 1 }).withMessage("queueId is required")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await jobService.listDLQ(
        req.query.queueId as string,
        req.user!.userId,
        req
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ── Single job endpoints ───────────────────────────────────────────────────────

jobsRouter.post(
  "/",
  [
    body("queueId").isInt({ min: 1 }).withMessage("Valid queue ID required"),
    body("payload").optional().isObject(),
    body("priority").optional().isInt({ min: 0 }),
    body("scheduledTime").optional().isISO8601().withMessage("Must be a valid ISO 8601 timestamp"),
    body("cronExpression")
      .optional()
      .isString()
      .matches(/^(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)$/)
      .withMessage("Must be a valid 5-field cron expression"),
    body("idempotencyKey").optional().isString().isLength({ max: 255 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await jobService.createJob(
        {
          queueId: req.body.queueId,
          payload: req.body.payload,
          priority: req.body.priority,
          scheduledTime: req.body.scheduledTime,
          cronExpression: req.body.cronExpression,
          idempotencyKey: req.body.idempotencyKey,
        },
        req.user!.userId
      );
      res.status(201).json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

jobsRouter.get(
  "/",
  [queryValidator("queueId").isInt({ min: 1 }).withMessage("queueId is required")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await jobService.listJobs(
        req.query.queueId as string,
        req.user!.userId,
        req
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

jobsRouter.get(
  "/:jobId",
  [param("jobId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await jobService.getJob(req.params.jobId, req.user!.userId);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

jobsRouter.post(
  "/:jobId/cancel",
  [param("jobId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await jobService.cancelJob(req.params.jobId, req.user!.userId);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

jobsRouter.post(
  "/:jobId/requeue",
  [param("jobId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await jobService.requeueJob(req.params.jobId, req.user!.userId);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

jobsRouter.get(
  "/:jobId/logs",
  [param("jobId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = await jobService.getJobLogs(req.params.jobId, req.user!.userId);
      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }
);
