// ─────────────────────────────────────────────────────────────────────────────
//  Pagination Utility
//  Parses query parameters and builds LIMIT/OFFSET clauses.
// ─────────────────────────────────────────────────────────────────────────────

import { Request } from "express";

export interface PaginationOptions {
  page: number;
  pageSize: number;
  offset: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parsePagination(req: Request): PaginationOptions {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(req.query.pageSize as string, 10) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  options: PaginationOptions
) {
  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.ceil(total / options.pageSize),
  };
}
