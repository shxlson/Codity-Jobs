// ─────────────────────────────────────────────────────────────────────────────
//  Authentication Routes
//  POST /api/v1/auth/register
//  POST /api/v1/auth/login
//  GET  /api/v1/auth/me
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import * as authService from "./auth.service";

export const authRouter = Router();

// ── Validation Chains ─────────────────────────────────────────────────────────

const registerValidators = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Must be a valid email address"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),
];

const loginValidators = [
  body("email").isEmail().normalizeEmail().withMessage("Must be a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new user account and returns a JWT.
 */
authRouter.post(
  "/register",
  registerValidators,
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Authenticates a user and returns a JWT.
 */
authRouter.post(
  "/login",
  loginValidators,
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login({
        email: req.body.email,
        password: req.body.password,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's profile.
 */
authRouter.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await authService.getProfile(req.user!.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);
