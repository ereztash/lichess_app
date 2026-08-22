/**
 * Reporting progress at a rate a screen can survive.
 *
 * `analyzePositions` calls `onProgress` after every position. On the measured import in
 * docs/MEASUREMENTS.md that is 971 callbacks in 43.4 seconds. Each one is truthful; the problem is
 * the caller. A React `setState` per callback is 971 renders on the main thread, and at 45ms of
 * engine time per position there is nothing else for that thread to do -- so the renders do not
 * interleave with the search, they compete with it. The progress bar becomes the slowest part of
 * measuring the game.
 *
 * Nobody can read 971 updates. Five a second is already more than a person perceives as anything
 * but continuous motion.
 *
 * TWO PROPERTIES, and the second is the one that makes throttling safe:
 *
 *   1. The first report is emitted immediately, so the bar starts moving on the first position
 *      rather than 200ms into a 43-second wait.
 *   2. `flush()` emits the last held value. Without it the bar stops at whatever the last emitted
 *      count happened to be -- 968 of 971 -- and a bar frozen three short of the end is a bar that
 *      looks broken. This matters just as much on abort, where the honest final number is where
 *      the work actually stopped.
 *
 * No timers. The values arrive from a tight await loop, so the next report is always close behind;
 * a held value waits for the next report or for the flush, and never for a scheduler. That keeps
 * the thing testable with no fake clock and leaves nothing to cancel.
 */

/** Five updates a second. Below the threshold where a person sees steps rather than motion. */
export const PROGRESS_INTERVAL_MS = 200;

export interface ThrottledReporter<T> {
  /** Emit now, or hold until enough time has passed. */
  report(value: T): void;
  /** Emit the most recent held value, if one is still waiting. Idempotent. */
  flush(): void;
}

/**
 * Rate-limit `emit` to at most one call per `intervalMs`, keeping the last value.
 *
 * `intervalMs <= 0` disables holding entirely and every value is emitted -- the shape a test wants
 * when it is asserting on what was measured rather than on how often it was announced.
 */
export function throttleProgress<T>(
  emit: (value: T) => void,
  intervalMs: number,
  now: () => number = Date.now,
): ThrottledReporter<T> {
  let lastEmitAt = -Infinity;
  let held: { value: T } | null = null;

  const send = (value: T, at: number) => {
    held = null;
    lastEmitAt = at;
    emit(value);
  };

  return {
    report(value: T) {
      const at = now();
      if (intervalMs <= 0 || at - lastEmitAt >= intervalMs) send(value, at);
      else held = { value };
    },
    flush() {
      if (held) send(held.value, now());
    },
  };
}
