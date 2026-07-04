// ─────────────────────────────────────────────────────────────────────────────
//  Queues Routes
//  GET    /api/v1/queues?projectId=
//  POST   /api/v1/queues
//  GET    /api/v1/queues/:queueId
//  PATCH  /api/v1/queues/:queueId
//  DELETE /api/v1/queues/:queueId
//  POST   /api/v1/queues/:queueId/pause
//  POST   /api/v1/queues/:queueId/resume
//  GET    /api/v1/queues/:queueId/stats
//  PUT    /api/v1/queues/:queueId/retry-policy
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from "express";
import { body, param, query as queryValidator } from "express-validator";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import * as queueService from "./queues.service";

export const queuesRouter = Router();

queuesRouter.use(authenticate);

const VALID_STRATEGIES = ["fixed", "linear", "exponential"];

queuesRouter.get(
  "/",
  [queryValidator("projectId").isInt({ min: 1 }).withMessage("projectId is required")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queues = await queueService.listQueues(
        req.query.projectId as string,
        req.user!.userId
      );
      res.json({ success: true, data: queues });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.post(
  "/",
  [
    body("projectId").isInt({ min: 1 }).withMessage("Valid project ID required"),
    body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Queue name is required"),
    body("priority").optional().isInt({ min: 0 }),
    body("concurrency").optional().isInt({ min: 1, max: 100 }),
    body("retryPolicy.strategy")
      .optional()
      .isIn(VALID_STRATEGIES)
      .withMessage("Strategy must be fixed, linear, or exponential"),
    body("retryPolicy.maxAttempts").optional().isInt({ min: 1, max: 20 }),
    body("retryPolicy.delaySeconds").optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await queueService.createQueue(
        {
          projectId: req.body.projectId,
          name: req.body.name,
          priority: req.body.priority,
          concurrency: req.body.concurrency,
          retryPolicy: req.body.retryPolicy,
        },
        req.user!.userId
      );
      res.status(201).json({ success: true, data: queue });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.get(
  "/:queueId",
  [param("queueId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await queueService.getQueue(req.params.queueId, req.user!.userId);
      res.json({ success: true, data: queue });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.patch(
  "/:queueId",
  [
    param("queueId").isInt({ min: 1 }),
    body("name").optional().trim().isLength({ min: 1, max: 100 }),
    body("priority").optional().isInt({ min: 0 }),
    body("concurrency").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await queueService.updateQueue(
        req.params.queueId,
        req.user!.userId,
        { name: req.body.name, priority: req.body.priority, concurrency: req.body.concurrency }
      );
      res.json({ success: true, data: queue });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.delete(
  "/:queueId",
  [param("queueId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await queueService.deleteQueue(req.params.queueId, req.user!.userId);
      res.json({ success: true, message: "Queue deleted" });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.post(
  "/:queueId/pause",
  [param("queueId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await queueService.pauseQueue(req.params.queueId, req.user!.userId);
      res.json({ success: true, data: queue });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.post(
  "/:queueId/resume",
  [param("queueId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await queueService.resumeQueue(req.params.queueId, req.user!.userId);
      res.json({ success: true, data: queue });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.get(
  "/:queueId/stats",
  [param("queueId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await queueService.getQueueStats(req.params.queueId, req.user!.userId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

queuesRouter.put(
  "/:queueId/retry-policy",
  [
    param("queueId").isInt({ min: 1 }),
    body("strategy").isIn(VALID_STRATEGIES).withMessage("Invalid strategy"),
    body("maxAttempts").isInt({ min: 1, max: 20 }),
    body("delaySeconds").isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const policy = await queueService.upsertRetryPolicy(
        req.params.queueId,
        req.user!.userId,
        {
          strategy: req.body.strategy,
          maxAttempts: req.body.maxAttempts,
          delaySeconds: req.body.delaySeconds,
        }
      );
      res.json({ success: true, data: policy });
    } catch (error) {
      next(error);
    }
  }
);
