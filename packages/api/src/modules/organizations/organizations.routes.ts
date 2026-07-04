// ─────────────────────────────────────────────────────────────────────────────
//  Organizations Routes
//  GET    /api/v1/organizations
//  POST   /api/v1/organizations
//  GET    /api/v1/organizations/:organizationId
//  PATCH  /api/v1/organizations/:organizationId
//  DELETE /api/v1/organizations/:organizationId
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import * as orgService from "./organizations.service";

export const organizationsRouter = Router();

// All organization routes require authentication
organizationsRouter.use(authenticate);

organizationsRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgs = await orgService.listOrganizations(req.user!.userId);
      res.json({ success: true, data: orgs });
    } catch (error) {
      next(error);
    }
  }
);

organizationsRouter.post(
  "/",
  [body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await orgService.createOrganization({
        name: req.body.name,
        ownerId: req.user!.userId,
      });
      res.status(201).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }
);

organizationsRouter.get(
  "/:organizationId",
  [param("organizationId").isInt({ min: 1 }).withMessage("Invalid organization ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await orgService.getOrganization(
        req.params.organizationId,
        req.user!.userId
      );
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }
);

organizationsRouter.patch(
  "/:organizationId",
  [
    param("organizationId").isInt({ min: 1 }).withMessage("Invalid organization ID"),
    body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await orgService.updateOrganization(
        req.params.organizationId,
        req.user!.userId,
        req.body.name
      );
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }
);

organizationsRouter.delete(
  "/:organizationId",
  [param("organizationId").isInt({ min: 1 }).withMessage("Invalid organization ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await orgService.deleteOrganization(
        req.params.organizationId,
        req.user!.userId
      );
      res.json({ success: true, message: "Organization deleted" });
    } catch (error) {
      next(error);
    }
  }
);
