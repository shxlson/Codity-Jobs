// ─────────────────────────────────────────────────────────────────────────────
//  Unit Tests: Retry Backoff Strategies
//  Tests the calculateBackoffDelay function for all three strategies.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { calculateBackoffDelay, computeRetryAt } from "../src/retry/backoff";

describe("calculateBackoffDelay", () => {
  describe("fixed strategy", () => {
    it("always returns the base delay regardless of attempt number", () => {
      const delay1 = calculateBackoffDelay("fixed", 1, 60);
      const delay2 = calculateBackoffDelay("fixed", 5, 60);
      const delay3 = calculateBackoffDelay("fixed", 10, 60);

      // Allow ±10% jitter
      expect(delay1).toBeGreaterThanOrEqual(54_000);
      expect(delay1).toBeLessThanOrEqual(66_000);
      expect(delay2).toBeGreaterThanOrEqual(54_000);
      expect(delay2).toBeLessThanOrEqual(66_000);
      expect(delay3).toBeGreaterThanOrEqual(54_000);
      expect(delay3).toBeLessThanOrEqual(66_000);
    });
  });

  describe("linear strategy", () => {
    it("scales linearly with attempt number", () => {
      const delay1 = calculateBackoffDelay("linear", 1, 60);
      const delay2 = calculateBackoffDelay("linear", 2, 60);
      const delay3 = calculateBackoffDelay("linear", 3, 60);

      // Base: 60s. Linear: attempt * 60s
      // Attempt 1: 60s base, Attempt 2: 120s base, Attempt 3: 180s base
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);

      // Rough scale check (allowing for jitter)
      expect(delay2 / delay1).toBeGreaterThan(1.5);
      expect(delay2 / delay1).toBeLessThan(2.5);
    });
  });

  describe("exponential strategy", () => {
    it("grows exponentially with attempt number", () => {
      const delay1 = calculateBackoffDelay("exponential", 1, 10);
      const delay2 = calculateBackoffDelay("exponential", 2, 10);
      const delay3 = calculateBackoffDelay("exponential", 3, 10);

      // Base: 10s. Exponential: 10s, 20s, 40s (before jitter)
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it("is capped at 1 hour", () => {
      const delay = calculateBackoffDelay("exponential", 100, 60);
      expect(delay).toBeLessThanOrEqual(60 * 60 * 1000);
    });
  });

  describe("edge cases", () => {
    it("handles zero delay seconds", () => {
      const delay = calculateBackoffDelay("fixed", 1, 0);
      expect(delay).toBe(0);
    });
  });
});

describe("computeRetryAt", () => {
  it("returns a future date", () => {
    const retryAt = computeRetryAt("fixed", 1, 60);
    expect(retryAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns a date within the expected range", () => {
    const before = Date.now();
    const retryAt = computeRetryAt("fixed", 1, 60);
    const after = Date.now();

    // Should be approximately 60s in the future (±10% jitter)
    const minExpected = before + 54_000;
    const maxExpected = after + 66_000;

    expect(retryAt.getTime()).toBeGreaterThanOrEqual(minExpected);
    expect(retryAt.getTime()).toBeLessThanOrEqual(maxExpected);
  });
});
