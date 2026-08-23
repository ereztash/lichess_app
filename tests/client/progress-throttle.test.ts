/**
 * The rate limiter between a 43-second search and a progress bar.
 *
 * Tested with an injected clock rather than fake timers, because the thing under test deliberately
 * has no timers: it decides on the clock reading at the moment a value arrives, and the tail is
 * covered by an explicit flush. That is what makes it safe to drop into an await loop with nothing
 * to cancel and nothing to leak.
 */
import { describe, expect, it } from "vitest";
import { PROGRESS_INTERVAL_MS, throttleProgress } from "../../client/src/lib/progress-throttle";

/** A clock the test moves by hand. */
function clock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe("what gets through", () => {
  it("emits the first value immediately", () => {
    // Otherwise the bar sits at zero for the first interval of a 43-second wait, which reads as
    // "nothing is happening" at exactly the moment the user is deciding whether it is broken.
    const seen: number[] = [];
    const c = clock();
    throttleProgress<number>((v) => seen.push(v), 200, c.now).report(1);
    expect(seen).toEqual([1]);
  });

  it("holds values that arrive inside the interval", () => {
    const seen: number[] = [];
    const c = clock();
    const t = throttleProgress<number>((v) => seen.push(v), 200, c.now);
    t.report(1);
    for (const v of [2, 3, 4]) { c.advance(10); t.report(v); }
    expect(seen).toEqual([1]);
  });

  it("emits again once the interval has passed", () => {
    const seen: number[] = [];
    const c = clock();
    const t = throttleProgress<number>((v) => seen.push(v), 200, c.now);
    t.report(1);
    c.advance(199);
    t.report(2);
    c.advance(1);
    t.report(3);
    expect(seen).toEqual([1, 3]);
  });

  it("keeps the newest held value, not the oldest", () => {
    // A progress bar that jumps to a stale count is worse than one that jumps: it is wrong.
    const seen: number[] = [];
    const c = clock();
    const t = throttleProgress<number>((v) => seen.push(v), 200, c.now);
    t.report(1);
    for (const v of [2, 3, 4]) t.report(v);
    t.flush();
    expect(seen).toEqual([1, 4]);
  });
});

describe("the flush", () => {
  it("emits the held value so the bar ends where the work ended", () => {
    const seen: number[] = [];
    const c = clock();
    const t = throttleProgress<number>((v) => seen.push(v), 200, c.now);
    t.report(1);
    t.report(971);
    t.flush();
    expect(seen.at(-1)).toBe(971);
  });

  it("emits nothing when the last value already went out", () => {
    // Twice is a duplicate render, and on a bar already at 100% it is a wasted one.
    const seen: number[] = [];
    const c = clock();
    const t = throttleProgress<number>((v) => seen.push(v), 200, c.now);
    t.report(1);
    t.flush();
    t.flush();
    expect(seen).toEqual([1]);
  });

  it("emits nothing at all when nothing was ever reported", () => {
    const seen: number[] = [];
    const t = throttleProgress<number>((v) => seen.push(v), 200, clock().now);
    t.flush();
    expect(seen).toEqual([]);
  });
});

describe("turning it off", () => {
  it("emits everything at an interval of zero", () => {
    const seen: number[] = [];
    const c = clock();
    const t = throttleProgress<number>((v) => seen.push(v), 0, c.now);
    for (const v of [1, 2, 3]) t.report(v);
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("the default rate", () => {
  it("is fast enough to look continuous and slow enough to be cheap", () => {
    /*
     * Both bounds matter and they are different failures. Above ~250ms a person sees the bar step
     * rather than move; below ~50ms the renders start costing what the throttle exists to save.
     */
    expect(PROGRESS_INTERVAL_MS).toBeLessThanOrEqual(250);
    expect(PROGRESS_INTERVAL_MS).toBeGreaterThanOrEqual(50);
  });
});
