// ─────────────────────────────────────────────────────────────────────────────
//  Job Executor
//  Simulates job execution. In production, job handlers would be registered
//  here by job type (e.g., "send_email", "generate_report").
//
//  The executor receives the job payload and must:
//    - Return successfully on completion
//    - Throw an error on failure (the worker catches it)
// ─────────────────────────────────────────────────────────────────────────────

import { JobRow } from "../types";

export type ExecutionResult = {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
};

// ── Handler Registry ──────────────────────────────────────────────────────────

type JobHandler = (payload: Record<string, unknown>) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();

/**
 * Register a job handler for a given job type.
 * The type field in the job payload determines which handler runs.
 */
export function registerHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

// ── Built-in Handler Examples ─────────────────────────────────────────────────

registerHandler("noop", async (_payload) => {
  // No-op job: used for testing and benchmarking
  return { status: "ok" };
});

registerHandler("echo", async (payload) => {
  return { echoed: payload };
});

registerHandler("delay", async (payload) => {
  const ms = typeof payload.ms === "number" ? payload.ms : 1000;
  await sleep(ms);
  return { slept_ms: ms };
});

// ── Executor ──────────────────────────────────────────────────────────────────

/**
 * Executes a job by dispatching to the registered handler for its type.
 * Returns the handler output. Throws on failure so the worker can handle retry.
 */
export async function executeJob(
  job: JobRow
): Promise<Record<string, unknown>> {
  const jobType = (job.payload.type as string) ?? "noop";
  const handler = handlers.get(jobType);

  if (!handler) {
    // Unknown job types are treated as no-ops rather than failures
    // to prevent poison-pill jobs from filling the DLQ unnecessarily.
    console.warn(`[executor] No handler registered for type "${jobType}". Running noop.`);
    return { warning: `No handler for type: ${jobType}` };
  }

  const output = await handler(job.payload);
  return (output as Record<string, unknown>) ?? {};
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
