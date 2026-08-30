/**
 * A guard that could not fire, in the one file where every threshold carries its measurement.
 *
 * `gapDifferenceStandardError` refuses a side whose `gapVariance <= 0`, and its comment explains at
 * length what that is for:
 *
 *   > A bucket where every decision carries the same stated confidence and the same outcome has a
 *   > sample variance of exactly 0 … the pooled error then reduces to `sqrt(varOut / nOut)` and the
 *   > degenerate bucket is treated as though its gap were known exactly, which makes almost any
 *   > difference clear the threshold.
 *   >
 *   > MEASURED … an opening bucket at book-move accuracy, played by someone who anchors on one
 *   > confidence value there, fires on up to 13% of records — against this product's own 2% ceiling.
 *
 * THE GUARD WAS DEAD CODE. Sixty doubles that are each exactly 0.8 do not average to 0.8 — the mean
 * comes out 0.7999999999999993 — so every `decisionGap(d) - gap` is about 7e-16 rather than 0, and
 * squaring and Bessel-averaging leaves **6.1e-31**. `<= 0` tests for an exact zero that
 * floating-point summation essentially never produces, so the case the guard was written for went
 * straight through it and the 13% was still on the table.
 *
 * FOUND SIDEWAYS, which is worth recording. It surfaced while building the attribution test for
 * R-08: a fixture deliberately constructed to be degenerate came back readable, and the first
 * assumption was that the fixture was wrong. It was not.
 *
 * THE FIX IS STRUCTURAL RATHER THAN A TOLERANCE. "Did this sample vary at all" has an exact answer —
 * are all the gaps the same number — and asking it that way needs no epsilon to choose, cannot
 * drift with the scale of the values, and does not add a threshold nobody has measured.
 */
import { describe, expect, it } from "vitest";
import {
  decisionGap,
  gapDifferenceStandardError,
  summarise,
  type ScoredDecision,
} from "@shared/detector";

const decision = (i: number, confidence: number, accurate: boolean): ScoredDecision => ({
  decision_id: `d${i}`,
  fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
  confidence,
  accurate,
  phase: "opening",
  secondsTaken: 10,
  clockMsRemaining: 120_000,
});

/** `n` decisions that are all the same: the shape the guard exists for. */
const uniform = (n: number, confidence: number, accurate: boolean) =>
  Array.from({ length: n }, (_, i) => decision(i, confidence, accurate));

describe("a bucket that never varied", () => {
  it("reports a variance of exactly zero, which the arithmetic on its own does not", () => {
    /*
     * THE ASSERTION THAT WOULD HAVE CAUGHT THIS. `toBe(0)` rather than `toBeCloseTo(0)`: the whole
     * defect is that 6.1e-31 is close to zero and is not zero, and the one consumer of this number
     * compares it with `<=`.
     */
    const summary = summarise(uniform(60, 0.8, true));
    expect(summary.gapVariance).toBe(0);
    expect(summary.gap).toBeCloseTo(-0.2, 10);
  });

  it("is a bucket whose standard error CANNOT be estimated, and says so", () => {
    const degenerate = summarise(uniform(60, 0.8, true));
    const ordinary = summarise([
      ...uniform(30, 0.8, true),
      ...uniform(30, 0.8, false),
    ]);
    expect(gapDifferenceStandardError(degenerate, ordinary)).toBeNull();
    expect(gapDifferenceStandardError(ordinary, degenerate)).toBeNull();
  });

  it("still estimates one when BOTH sides vary, or the guard would be a wall", () => {
    /*
     * The control. A rule that refused every pair would satisfy the two cases above and stop the
     * detector finding anything at all.
     */
    const a = summarise([...uniform(30, 0.8, true), ...uniform(30, 0.8, false)]);
    const b = summarise([...uniform(20, 0.5, true), ...uniform(40, 0.5, false)]);
    const se = gapDifferenceStandardError(a, b);
    expect(se).not.toBeNull();
    expect(se!).toBeGreaterThan(0);
  });

  it("counts a sample that varies by ONE decision as varying", () => {
    /*
     * The boundary. The rule is "did anything differ", not "did enough differ" -- a single
     * dissenting decision is a real observation about the bucket, and how much it is worth is what
     * the standard error is for rather than something to decide here.
     */
    const almost = [...uniform(59, 0.8, true), decision(59, 0.8, false)];
    expect(summarise(almost).gapVariance).toBeGreaterThan(0);
  });

  it("is degenerate on the GAP, not on the confidence, which are not the same thing", () => {
    /*
     * THE DISTINCTION THAT DECIDES WHERE THE CHECK BELONGS. A bucket can hold two confidences and
     * two outcomes and still have a constant per-decision gap -- 0.8-and-accurate and
     * 0.5-and-accurate do not, but stated 1.0 with an accurate outcome and stated 0.0 with an
     * inaccurate one both give a gap of 0. `decisionGap` is the quantity the whole separability
     * test is built on, so it is the quantity whose variation matters; checking the confidences
     * instead would call this bucket varied and hand back an error estimated from nothing.
     */
    const constantGap = [
      ...uniform(30, 1, true),
      ...uniform(30, 0, false),
    ];
    expect(new Set(constantGap.map((d) => d.confidence)).size).toBe(2);
    expect(new Set(constantGap.map(decisionGap)).size).toBe(1);
    expect(summarise(constantGap).gapVariance).toBe(0);
  });

  it("leaves a one-decision sample at zero, which it always did", () => {
    // Not the case this file is about, and it must not have moved: n < 2 has no variance to estimate.
    expect(summarise(uniform(1, 0.8, true)).gapVariance).toBe(0);
    expect(summarise([]).gapVariance).toBe(0);
  });
});
