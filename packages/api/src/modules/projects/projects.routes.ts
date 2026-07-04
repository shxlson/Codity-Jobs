// ─────────────────────────────────────────────────────────────────────────────
//  Projects Routes
//  GET    /api/v1/projects?organizationId=
//  POST   /api/v1/projects
//  GET    /api/v1/projects/:projectId
//  PATCH  /api/v1/projects/:projectId
//  DELETE /api/v1/projects/:projectId
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from "express";
import { body, param, query as queryValidator } from "express-validator";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import * as projectService from "./projects.service";

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.get(
  "/",
  [queryValidator("organizationId").isInt({ min: 1 }).withMessage("organizationId is required")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projects = await projectService.listProjects(
        req.query.organizationId as string,
        req.user!.userId
      );
      res.json({ success: true, data: projects });
    } catch (error) {
      next(error);
    }
  }
);

projectsRouter.post(
  "/",
  [
    body("organizationId").isInt({ min: 1 }).withMessage("Valid organization ID required"),
    body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),
    body("description").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.createProject({
        organizationId: req.body.organizationId,
        name: req.body.name,
        description: req.body.description,
        ownerId: req.user!.userId,
      });
      res.status(201).json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }
);

projectsRouter.get(
  "/:projectId",
  [param("projectId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.getProject(
        req.params.projectId,
        req.user!.userId
      );
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }
);

projectsRouter.patch(
  "/:projectId",
  [
    param("projectId").isInt({ min: 1 }),
    body("name").optional().trim().isLength({ min: 2, max: 100 }),
    body("description").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.updateProject(
        req.params.projectId,
        req.user!.userId,
        { name: req.body.name, description: req.body.description }
      );
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }
);

projectsRouter.delete(
  "/:projectId",
  [param("projectId").isInt({ min: 1 })],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await projectService.deleteProject(req.params.projectId, req.user!.userId);
      res.json({ success: true, message: "Project deleted" });
    } catch (error) {
      next(error);
    }
  }
);
