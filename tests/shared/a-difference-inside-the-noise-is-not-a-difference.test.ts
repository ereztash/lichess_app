/**
 * "+14 points versus everyone" was a point estimate with no error bar, from as few as 30 moves.
 *
 * THE INSTRUMENT HELD ITSELF TO TWO STANDARDS ON TWO SCREENS. `findPatterns` will not report a
 * bucket as a finding until its gap sits `SEPARABILITY_K = 3.75` standard errors from the rest of
 * the record -- the whole reason `CalibrationSummary` carries `gapVariance` at all. The dashboard
 * then printed `inside.accuracyRate - population.accuracy` as a signed figure in points, with no
 * standard error anywhere in its path and no bar to clear, and put it on screen in the second
 * person: "+14 נק׳ מול כולם".
 *
 * MEASURED, NOT ARGUED. Simulating a player whose true accuracy EQUALS the population's, drawing
 * `MIN_BUCKET_N` decisions, against the real published baselines:
 *
 *   n=30   shows a non-zero figure 100% of the time; >=5 points 71%; >=10 points 25%
 *   n=100  shows a non-zero figure  92%;              >=5 points 34%; >=10 points  4%
 *
 * One exactly-average player in four is told they are ten or more points from everyone. Under the
 * product's own bar, 0.22% of those same draws clear it -- which is what "average" should look
 * like. The bar is reused rather than invented for the same reason `MixBlock` reuses
 * `MIN_BUCKET_N`: a fresh threshold here would be a number chosen to make this screen work.
 *
 * WHAT IS NOT DROPPED. Both rates stay on screen. The population figure is measured on hundreds
 * of thousands of moves and is the context the whole baseline exists to supply; what goes is the
 * assertion that the player DIFFERS from it, which is the only part that needed 30 decisions to
 * carry it.
 */
import { describe, expect, it } from "vitest";
import { MIN_BUCKET_N, SEPARABILITY_K } from "@shared/detector";
import { POPULATION_BASELINE } from "@shared/population-baseline";
import { populationSeparation } from "@shared/record-dashboard";

/** Deterministic: a simulation whose number moves between runs cannot be cited. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function drawRate(next: () => number, p: number, n: number): number {
  let hits = 0;
  for (let i = 0; i < n; i++) if (next() < p) hits++;
  return hits / n;
}

describe("a player who is exactly average is not told they differ", () => {
  it("almost never clears the bar, at the floor the product itself set", () => {
    /*
     * THE ASSERTION THE WHOLE CHANGE EXISTS FOR. The old field would have shown a signed figure
     * on every one of these 20,000 draws.
     */
    const next = rng(20260826);
    const bucket = POPULATION_BASELINE[0];
    const TRIALS = 20_000;
    let separated = 0;
    let wouldHaveShown = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      const rate = drawRate(next, bucket.accuracy, MIN_BUCKET_N);
      const reading = populationSeparation(
        { n: MIN_BUCKET_N, accuracyRate: rate },
        bucket,
      )!;
      if (reading.separated) separated += 1;
      if (Math.abs(Math.round(reading.points * 100)) >= 1) wouldHaveShown += 1;
    }
    expect(wouldHaveShown / TRIALS, "the fixture is not reproducing the defect").toBeGreaterThan(
      0.95,
    );
    expect(separated / TRIALS, "an average player is still told they differ").toBeLessThan(0.02);
  });

  it("does not go quiet on a player who genuinely is different", () => {
    /*
     * THE OTHER DIRECTION, and the one that makes the assertion above more than "return false".
     * A gate that never fires is not a gate; it is the population comparison deleted.
     */
    const next = rng(7);
    const bucket = POPULATION_BASELINE[0];
    // Far from the baseline and with a record to back it: the case the feature is FOR.
    const rate = drawRate(next, Math.min(0.98, bucket.accuracy + 0.25), 300);
    const reading = populationSeparation({ n: 300, accuracyRate: rate }, bucket)!;
    expect(reading.separated).toBe(true);
    expect(reading.points).toBeGreaterThan(0.15);
  });

  it("uses the detector's own multiplier rather than one chosen for this screen", () => {
    // Both bucketings are tested across the same six splits, so the same multiplicity applies.
    // A separate constant here would be a threshold picked to make a number appear.
    const bucket = POPULATION_BASELINE[0];
    const reading = populationSeparation({ n: 200, accuracyRate: bucket.accuracy + 0.2 }, bucket)!;
    expect(reading.separated).toBe(
      Math.abs(reading.points) >= SEPARABILITY_K * reading.standardError,
    );
  });
});

describe("the error carries both sides of the comparison", () => {
  it("includes the population's own sampling error, small as it is", () => {
    /*
     * The corpus is large but finite, and a baseline bucket can be as thin as 500 moves. Treating
     * it as exact would understate the error by the amount that matters most in exactly the
     * buckets where the baseline is weakest.
     *
     * Compared against the SAME estimator with the population side removed -- a thin baseline
     * stood in for it. Comparing against the textbook `sqrt(p(1-p)/n)` instead was this test's
     * first form and it failed for a reason that had nothing to do with the property: Agresti-
     * Coull divides by `n + 4`, so it reads LOWER than Wald away from the boundary, and the
     * assertion was measuring the choice of estimator rather than the second term.
     */
    const thin = POPULATION_BASELINE.reduce((a, b) => (a.n <= b.n ? a : b));
    const huge = { ...thin, n: 50_000_000 };
    const player = { n: 100, accuracyRate: 0.6 };
    const withThin = populationSeparation(player, thin)!;
    const withHuge = populationSeparation(player, huge)!;
    expect(
      withThin.standardError,
      "the population's own sample size makes no difference to the error",
    ).toBeGreaterThan(withHuge.standardError);
  });

  it("refuses to divide by a sample too small to have an error at all", () => {
    expect(populationSeparation({ n: 1, accuracyRate: 1 }, POPULATION_BASELINE[0])).toBeNull();
    expect(populationSeparation({ n: 0, accuracyRate: 0 }, POPULATION_BASELINE[0])).toBeNull();
  });

  it("says nothing where a bucket has no published baseline", () => {
    expect(populationSeparation({ n: 100, accuracyRate: 0.6 }, null)).toBeNull();
  });

  it("keeps a degenerate all-or-nothing record from reading as infinite precision", () => {
    /*
     * A player accurate on every one of 30 decisions has `p(1-p) = 0`, so the textbook estimator
     * gives that side an error of ZERO and the whole error collapses to the population's, which
     * is computed on hundreds of thousands of moves and is therefore tiny. The bar is then
     * loudest exactly where the sample says least: 30 for 30 against a 95% population would be
     * reported as a separated five-point difference.
     *
     * ASSERTED AS THAT OUTCOME, not as `standardError > 0`. That was this test's first form and a
     * control restoring the textbook estimator SURVIVED it -- the population's own term keeps the
     * sum above zero, so the assertion was satisfied by the side of the comparison it was not
     * about. Five points from 30 decisions is the thing that must not be reported.
     */
    const near = { ...POPULATION_BASELINE[0], accuracy: 0.95, n: 400_000 };
    const perfect = populationSeparation({ n: MIN_BUCKET_N, accuracyRate: 1 }, near)!;
    expect(perfect.points).toBeCloseTo(0.05, 10);
    expect(
      perfect.separated,
      "a five-point gap from 30 decisions was reported as a difference",
    ).toBe(false);
    expect(Number.isFinite(perfect.standardError)).toBe(true);
  });
});
