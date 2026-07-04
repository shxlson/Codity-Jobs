// ─────────────────────────────────────────────────────────────────────────────
//  404 Not Found Handler
//  Catches any request that did not match a registered route.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}
