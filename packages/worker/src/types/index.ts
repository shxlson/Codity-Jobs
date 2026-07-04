// ─────────────────────────────────────────────────────────────────────────────
//  Worker Internal Types
// ─────────────────────────────────────────────────────────────────────────────

import { JobStatus, RetryStrategy } from "@codity/shared";

export interface JobRow {
  job_id: string;
  queue_id: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  priority: number;
  scheduled_time: Date | null;
  attempt_count: number;
  idempotency_key: string | null;
  created_at: Date;
}

export interface RetryPolicyRow {
  policy_id: string;
  queue_id: string;
  strategy: RetryStrategy;
  max_attempts: number;
  delay_seconds: number;
}

export interface WorkerRow {
  worker_id: string;
  hostname: string;
  pid: number;
  status: string;
  started_at: Date;
}
