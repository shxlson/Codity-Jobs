// ─────────────────────────────────────────────────────────────────────────────
//  @codity/shared — Database Row Types
//  These types mirror the PostgreSQL schema exactly.
//  Consumers should use these for all DB result typing.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ─────────────────────────────────────────────────────────────────────

export type JobStatus =
  | "queued"
  | "scheduled"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "retrying"
  | "dead";

export type RetryStrategy = "fixed" | "linear" | "exponential";

export type WorkerStatus = "active" | "idle" | "draining" | "offline";

export type ExecutionStatus = "running" | "completed" | "failed";

export type LogLevel = "debug" | "info" | "warn" | "error";

// ── Database Row Interfaces ────────────────────────────────────────────────────

export interface UserRow {
  user_id: bigint;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface OrganizationRow {
  organization_id: bigint;
  owner_id: bigint;
  name: string;
  created_at: Date;
}

export interface ProjectRow {
  project_id: bigint;
  organization_id: bigint;
  name: string;
  description: string | null;
}

export interface QueueRow {
  queue_id: bigint;
  project_id: bigint;
  name: string;
  priority: number;
  concurrency: number;
  paused: boolean;
}

export interface RetryPolicyRow {
  policy_id: bigint;
  queue_id: bigint;
  strategy: RetryStrategy;
  max_attempts: number;
  delay_seconds: number;
}

export interface JobRow {
  job_id: bigint;
  queue_id: bigint;
  status: JobStatus;
  payload: Record<string, unknown>;
  priority: number;
  scheduled_time: Date | null;
  created_at: Date;
}

export interface ScheduledJobRow {
  schedule_id: bigint;
  job_id: bigint;
  cron_expression: string;
  next_run: Date;
}

export interface WorkerRow {
  worker_id: bigint;
  hostname: string;
  status: WorkerStatus;
  started_at: Date;
}

export interface WorkerHeartbeatRow {
  heartbeat_id: bigint;
  worker_id: bigint;
  heartbeat_time: Date;
  cpu_usage: number | null;
  memory_usage: number | null;
}

export interface JobExecutionRow {
  execution_id: bigint;
  job_id: bigint;
  worker_id: bigint;
  attempt: number;
  status: ExecutionStatus;
  started_at: Date;
  completed_at: Date | null;
}

export interface JobLogRow {
  log_id: bigint;
  execution_id: bigint;
  level: LogLevel;
  message: string;
  created_at: Date;
}

export interface DeadLetterQueueRow {
  dlq_id: bigint;
  job_id: bigint;
  reason: string | null;
  moved_at: Date;
}

// ── API Response Shapes ────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

// ── Auth Types ─────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: bigint;
  email: string;
  name: string;
}
