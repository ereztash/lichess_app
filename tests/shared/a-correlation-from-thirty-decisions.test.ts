/**
 * "מאמץ שהולך אחרי הספק: −0.31" was a bare correlation with no error bar, from 30 decisions.
 *
 * THE SAME DEFECT AS THE POPULATION COMPARISON, IN THE NEIGHBOURING CELL of the same `<dl>`.
 * `effortFollowsDoubt` gated on `n >= MIN_BUCKET_N` and on two degeneracy checks, and then
 * printed `rho.toFixed(2)`. A rank correlation from 30 pairs has a standard error near 0.19.
 *
 * MEASURED. A player whose time is drawn INDEPENDENTLY of their confidence -- no association at
 * all, by construction -- 20,000 records, deterministic seed:
 *
 *   n=30    a figure appears 100% of the time; |rho| >= 0.20 on 29%; >= 0.30 on 11%
 *   n=60    100%;                              12%;                   2%
 *   n=150   100%;                               2%;                   0%
 *
 * One player in nine with no association whatsoever was handed "−0.31" under a label that says
 * their effort follows their doubt. That is a claim about how somebody allocates attention.
 *
 * THE SECOND DEFECT IN THE SAME CELL. `Control.reason` is computed with four distinct values --
 * `ok`, `too-few`, `flat-time`, `flat-confidence` -- and the dashboard rendered
 * `control.readable && control.rho !== null ? ... : "—"`. Every unreadable cause produced the
 * identical bare dash and the reason reached no screen at all. A player who took the same time
 * over everything and a player with twelve decisions saw the same thing, and neither was told
 * which. The distinction was built and then discarded at the last step.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, SEPARABILITY_K, type ScoredDecision } from "@shared/detector";
import { effortFollowsDoubt } from "@shared/control";

function rng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Time drawn independently of confidence: no association exists to find. */
const independent = (next: () => number, n: number): ScoredDecision[] =>
  Array.from({ length: n }, (_, i) => ({
    decision_id: `d-${i}`,
    fen: "f",
    accurate: next() < 0.5,
    confidence: normaliseConfidence(1 + Math.floor(next() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS),
    secondsTaken: 5 + next() * 120,
    phase: "middlegame" as const,
    clockMsRemaining: null,
  }));

/** Time falls as confidence rises, with noise: the healthy pattern, strongly present. */
const coupled = (next: () => number, n: number): ScoredDecision[] =>
  Array.from({ length: n }, (_, i) => {
    const level = 1 + Math.floor(next() * CONFIDENCE_LEVELS);
    return {
      decision_id: `d-${i}`,
      fen: "f",
      accurate: next() < 0.5,
      confidence: normaliseConfidence(level, CONFIDENCE_LEVELS),
      secondsTaken: 120 - level * 14 + next() * 10,
      phase: "middlegame" as const,
      clockMsRemaining: null,
    };
  });

describe("a coefficient inside its own noise is not reported", () => {
  it("almost never calls an independent record a pattern, at the floor the product set", () => {
    const next = rng(20260826);
    const TRIALS = 5_000;
    let separated = 0;
    let wouldHaveShown = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      const control = effortFollowsDoubt(independent(next, MIN_BUCKET_N));
      if (control.rho !== null) wouldHaveShown += 1;
      if (control.readable) separated += 1;
    }
    expect(wouldHaveShown / TRIALS, "the fixture is not reproducing the defect").toBeGreaterThan(
      0.95,
    );
    expect(separated / TRIALS, "a record with no association is still called one").toBeLessThan(
      0.02,
    );
  });

  it("still reports a player whose effort really does follow their doubt", () => {
    // The other direction. A gate that never fires is the measure deleted, not the measure fixed.
    const control = effortFollowsDoubt(coupled(rng(11), 200));
    expect(control.readable).toBe(true);
    expect(control.reason).toBe("ok");
    expect(control.rho!).toBeLessThan(-0.5);
  });

  it("carries the error beside the coefficient rather than leaving it to the caller", () => {
    const control = effortFollowsDoubt(coupled(rng(11), 200));
    expect(control.standardError).not.toBeNull();
    expect(control.standardError!).toBeGreaterThan(0);
    expect(Number.isFinite(control.standardError!)).toBe(true);
  });

  it("uses the detector's own multiplier rather than one chosen for this cell", () => {
    // Reused for the same reason the population comparison reuses it: the panel must not hold
    // itself to two standards, and a fresh constant here would be picked to make a number appear.
    const control = effortFollowsDoubt(coupled(rng(11), 200));
    expect(control.readable).toBe(
      Math.abs(Math.atanh(control.rho!)) >= SEPARABILITY_K * control.standardError!,
    );
  });

  it("scales its error with the record, so the same coefficient becomes reportable", () => {
    /*
     * THE PROPERTY THAT MAKES IT A MEASUREMENT RATHER THAN A THRESHOLD ON RHO. The same
     * association is noise on a short record and a finding on a long one, and the only thing that
     * changed is how much was measured.
     */
    const short = effortFollowsDoubt(coupled(rng(3), MIN_BUCKET_N));
    const long = effortFollowsDoubt(coupled(rng(3), 400));
    expect(long.standardError!).toBeLessThan(short.standardError!);
  });
});

describe("every reason the cell is empty is a different reason", () => {
  const flatTime = (n: number): ScoredDecision[] =>
    Array.from({ length: n }, (_, i) => ({
      decision_id: `d-${i}`,
      fen: "f",
      accurate: i % 2 === 0,
      confidence: normaliseConfidence(1 + (i % CONFIDENCE_LEVELS), CONFIDENCE_LEVELS),
      secondsTaken: 30,
      phase: "middlegame" as const,
      clockMsRemaining: null,
    }));

  it("names a record too short to correlate", () => {
    const control = effortFollowsDoubt(independent(rng(1), MIN_BUCKET_N - 5));
    expect(control.reason).toBe("too-few");
    expect(control.readable).toBe(false);
  });

  it("names a player who took the same time over everything", () => {
    // Not "not enough decisions": more decisions at the same speed will never make this readable,
    // so telling them to keep playing is advice that cannot work.
    const control = effortFollowsDoubt(flatTime(MIN_BUCKET_N + 10));
    expect(control.reason).toBe("flat-time");
  });

  it("names an association that was measured and came out inside the noise", () => {
    /*
     * THE NEW ONE, and it is distinct from all three above on purpose: this record HAS enough
     * decisions, both variables DO vary, the coefficient WAS computed -- and it still says
     * nothing. "Keep playing" is the correct advice here and wrong for `flat-time`, which is
     * exactly why they must not share a sentence.
     */
    const control = effortFollowsDoubt(independent(rng(20260826), MIN_BUCKET_N));
    expect(control.reason).toBe("inside-noise");
    expect(control.readable).toBe(false);
    expect(control.rho, "the coefficient is discarded rather than kept unreported").not.toBeNull();
  });

  it("never leaves a record without a reason once it holds any decision", () => {
    // A null reason with decisions in the record is a cell that says nothing about why it is empty.
    for (const n of [1, MIN_BUCKET_N - 1, MIN_BUCKET_N, 200]) {
      const control = effortFollowsDoubt(independent(rng(n), n));
      expect(control.reason, `n=${n}`).not.toBeNull();
    }
  });
});
