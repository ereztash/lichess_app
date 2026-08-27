/**
 * "ההבחנה שלכם: 0.60", beside a note saying 0.5 is chance and a band from the literature.
 *
 * THE THIRD AND LAST INSTANCE of the pattern, found by sweeping every discriminated field the
 * shared code computes and asking whether it reaches a screen and whether it carries its error.
 * `import-diagnostic` and `prereg` render every member of their unions; `stability` already
 * carries a standard error and a spread. `control` did not, and now does. This one did not.
 *
 * `metacognitiveSensitivity` gated on `accurate.length >= MIN_BUCKET_N && inaccurate.length >=
 * MIN_BUCKET_N` and printed `auroc2.toFixed(2)`. The panel then puts two things beside that
 * figure: the sentence "0.5 זה מקריות", which invites a comparison against chance, and the middle
 * 80% of matched people from the Confidence Database, which invites a placement inside it.
 *
 * MEASURED. A player whose confidence is drawn INDEPENDENTLY of the outcome -- true area exactly
 * 0.5, nothing to find -- 5,000 records, deterministic seed:
 *
 *   30 per class   a figure appears 100% of the time; 0.05 or more from chance on 52%; 0.10 on 18%
 *   60 per class   100%;                                                        34%;         6%
 *   150 per class  100%;                                                        14%;       0.3%
 *
 * Nearly one chance-level player in five was handed a figure a tenth of the scale away from
 * chance, under a label reading "your discrimination" and next to a peer range.
 *
 * HANLEY-McNEIL, not an invented estimator: the standard error of an area under an ROC curve has
 * a published closed form that accounts for both class sizes, and the naive binomial one does not
 * apply to a rank statistic computed over pairs.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, SEPARABILITY_K, type ScoredDecision } from "@shared/detector";
import { metacognitiveSensitivity } from "@shared/sensitivity";

function rng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const decision = (i: number, accurate: boolean, level: number): ScoredDecision => ({
  decision_id: `d-${i}`,
  fen: "f",
  accurate,
  confidence: normaliseConfidence(level, CONFIDENCE_LEVELS),
  secondsTaken: 30,
  phase: "middlegame" as const,
  clockMsRemaining: null,
});

/** Confidence drawn independently of the outcome: the true area is 0.5 by construction. */
const atChance = (next: () => number, perClass: number): ScoredDecision[] =>
  Array.from({ length: perClass * 2 }, (_, i) =>
    decision(i, i < perClass, 1 + Math.floor(next() * CONFIDENCE_LEVELS)),
  );

/** Confidence that genuinely separates the two outcomes, with overlap so it is not degenerate. */
const discriminating = (next: () => number, perClass: number): ScoredDecision[] =>
  Array.from({ length: perClass * 2 }, (_, i) => {
    const accurate = i < perClass;
    const base = accurate ? CONFIDENCE_LEVELS - 1 : 2;
    const jitter = next() < 0.25 ? (accurate ? -2 : 2) : 0;
    return decision(i, accurate, Math.max(1, Math.min(CONFIDENCE_LEVELS, base + jitter)));
  });

describe("an area that cannot tell itself from chance is not reported", () => {
  it("almost never calls a chance-level record a discrimination, at the floor the product set", () => {
    const next = rng(20260826);
    const TRIALS = 2_000;
    let readable = 0;
    let wouldHaveShown = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      const sensitivity = metacognitiveSensitivity(atChance(next, MIN_BUCKET_N));
      if (sensitivity.auroc2 !== null) wouldHaveShown += 1;
      if (sensitivity.readable) readable += 1;
    }
    expect(wouldHaveShown / TRIALS, "the fixture is not reproducing the defect").toBeGreaterThan(
      0.95,
    );
    expect(readable / TRIALS, "a record at chance is still reported as a discrimination").toBeLessThan(
      0.02,
    );
  });

  it("still reports a player whose confidence really does separate the outcomes", () => {
    // A gate that never fires is the measure deleted rather than the measure fixed.
    const sensitivity = metacognitiveSensitivity(discriminating(rng(4), 120));
    expect(sensitivity.readable).toBe(true);
    expect(sensitivity.reason).toBe("ok");
    expect(sensitivity.auroc2!).toBeGreaterThan(0.7);
  });

  it("carries the error beside the area rather than leaving it to the caller", () => {
    const sensitivity = metacognitiveSensitivity(discriminating(rng(4), 120));
    expect(sensitivity.standardError).not.toBeNull();
    expect(sensitivity.standardError!).toBeGreaterThan(0);
    expect(Number.isFinite(sensitivity.standardError!)).toBe(true);
  });

  it("uses the detector's own multiplier rather than one chosen for this cell", () => {
    const sensitivity = metacognitiveSensitivity(discriminating(rng(4), 120));
    expect(sensitivity.readable).toBe(
      Math.abs(sensitivity.auroc2! - 0.5) >= SEPARABILITY_K * sensitivity.standardError!,
    );
  });

  it("shrinks its error as the record grows, so the same area becomes reportable", () => {
    /*
     * What makes it a measurement rather than a threshold on the area itself: the same separation
     * is noise on a short record and a finding on a long one, and only the amount measured changed.
     */
    const short = metacognitiveSensitivity(discriminating(rng(9), MIN_BUCKET_N));
    const long = metacognitiveSensitivity(discriminating(rng(9), 300));
    expect(long.standardError!).toBeLessThan(short.standardError!);
  });

  it("accounts for BOTH class sizes, not just the total", () => {
    /*
     * A rank statistic over pairs is limited by the SMALLER class. 200 accurate decisions and 30
     * inaccurate ones is not the precision of 115 and 115, and a naive estimator on the total
     * would say it was.
     */
    const next = rng(21);
    const lopsided = [
      ...Array.from({ length: 200 }, (_, i) => decision(i, true, 1 + Math.floor(next() * CONFIDENCE_LEVELS))),
      ...Array.from({ length: MIN_BUCKET_N }, (_, i) =>
        decision(200 + i, false, 1 + Math.floor(next() * CONFIDENCE_LEVELS)),
      ),
    ];
    const balanced = atChance(rng(21), 115);
    expect(lopsided.length).toBe(balanced.length);
    expect(
      metacognitiveSensitivity(lopsided).standardError!,
      "a lopsided split was treated as precise as a balanced one",
    ).toBeGreaterThan(metacognitiveSensitivity(balanced).standardError!);
  });
});

describe("every reason the discrimination cell is empty is a different reason", () => {
  const only = (accurate: number, inaccurate: number): ScoredDecision[] => {
    const next = rng(2);
    return [
      ...Array.from({ length: accurate }, (_, i) =>
        decision(i, true, 1 + Math.floor(next() * CONFIDENCE_LEVELS)),
      ),
      ...Array.from({ length: inaccurate }, (_, i) =>
        decision(accurate + i, false, 1 + Math.floor(next() * CONFIDENCE_LEVELS)),
      ),
    ];
  };

  it("names a record short of decisions that went badly", () => {
    // Actionable and specific: this player needs harder positions, not simply more of them.
    expect(metacognitiveSensitivity(only(MIN_BUCKET_N + 20, 4)).reason).toBe("too-few-inaccurate");
  });

  it("names a record short of decisions that went well", () => {
    expect(metacognitiveSensitivity(only(4, MIN_BUCKET_N + 20)).reason).toBe("too-few-accurate");
  });

  it("names a record short of both", () => {
    expect(metacognitiveSensitivity(only(4, 4)).reason).toBe("too-few-both");
  });

  it("names an area that was measured and came out indistinguishable from chance", () => {
    /*
     * DISTINCT FROM ALL THREE ABOVE ON PURPOSE. Enough of both kinds, the area WAS computed, and
     * it still says nothing. "Keep playing" is right here and says something different from
     * "you need decisions that went badly".
     */
    const sensitivity = metacognitiveSensitivity(atChance(rng(20260826), MIN_BUCKET_N));
    expect(sensitivity.reason).toBe("inside-noise");
    expect(sensitivity.readable).toBe(false);
    expect(sensitivity.auroc2, "the area is discarded rather than kept unreported").not.toBeNull();
  });

  it("never leaves a record without a reason once it holds any decision", () => {
    for (const [a, b] of [
      [1, 0],
      [MIN_BUCKET_N, 1],
      [MIN_BUCKET_N, MIN_BUCKET_N],
      [200, 200],
    ]) {
      expect(metacognitiveSensitivity(only(a, b)).reason, `${a}/${b}`).not.toBeNull();
    }
  });
});
