import { useEffect, useRef } from "react";

/**
 * Runs an async callback immediately and then on a fixed interval.
 * Clears the interval when the component unmounts.
 *
 * @param callback  - Async function to call each tick
 * @param intervalMs - Poll interval in milliseconds
 * @param enabled   - Set to false to pause polling
 */
export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number,
  enabled = true
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      if (!cancelled) {
        try {
          await savedCallback.current();
        } catch {
          // Polling errors are swallowed — component handles error state
        }
      }
    }

    tick(); // Immediate first call
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs, enabled]);
}
