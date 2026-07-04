// ─────────────────────────────────────────────────────────────────────────────
//  Retry Backoff Strategies
//  Calculates the delay (in ms) before a failed job is re-queued.
//
//  Strategies:
//    fixed:       always delay_seconds
//    linear:      attempt * delay_seconds
//    exponential: delay_seconds * 2^(attempt - 1) (capped at 1 hour)
// ─────────────────────────────────────────────────────────────────────────────

import { RetryStrategy } from "@codity/shared";

const MAX_DELAY_MS = 60 * 60 * 1000; // 1 hour cap

/**
 * Returns the retry delay in milliseconds for a given attempt number
 * and retry strategy configuration.
 *
 * @param strategy    - The backoff algorithm to use
 * @param attempt     - Current attempt number (1-indexed)
 * @param delaySeconds - Base delay in seconds from retry_policies table
 */
export function calculateBackoffDelay(
  strategy: RetryStrategy,
  attempt: number,
  delaySeconds: number
): number {
  const baseMs = delaySeconds * 1_000;

  let delayMs: number;

  switch (strategy) {
    case "fixed":
      delayMs = baseMs;
      break;

    case "linear":
      delayMs = attempt * baseMs;
      break;

    case "exponential":
      // 2^(attempt-1) gives: 1x, 2x, 4x, 8x, 16x...
      delayMs = baseMs * Math.pow(2, attempt - 1);
      break;

    default:
      delayMs = baseMs;
  }

  // Add ±10% jitter to spread out thundering-herd retries
  const jitterFactor = 0.9 + Math.random() * 0.2;
  return Math.min(Math.round(delayMs * jitterFactor), MAX_DELAY_MS);
}

/**
 * Computes the scheduled_time at which a job should next be retried.
 */
export function computeRetryAt(
  strategy: RetryStrategy,
  attempt: number,
  delaySeconds: number
): Date {
  const delayMs = calculateBackoffDelay(strategy, attempt, delaySeconds);
  return new Date(Date.now() + delayMs);
}
