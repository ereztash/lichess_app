import { describe, expect, it } from "vitest";
import {
  ACCURATE_CP_LOSS,
  DEFAULT_THRESHOLDS,
  MIN_BUCKET_N,
  SEPARABILITY_K,
  detect,
  seededRandom,
  shuffleLabels,
  summarise,
  type ScoredDecision,
} from "../../shared/detector";
import { makeNoise } from "../fixtures/shuffle-scenario";

/** A position that is deliberately NOT in the anchor set: these are free-play records. */
const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const decision = (over: Partial<ScoredDecision> = {}): ScoredDecision => ({
  decision_id: "d",
  fen: NON_ANCHOR_FEN,
  confidence: 0.5,
  accurate: true,
  phase: "middlegame",
  secondsTaken: 60,
  clockMsRemaining: 120_000,
  ...over,
});

describe("calibration", () => {
  /*
   * The scale's own contract moved to tests/shared/confidence-scale.test.ts when it moved out of
   * this module. It is not a detector concern: the detector only ever sees a probability, and
   * which button produced it is the scale's business. Asserting it here as well would leave two
   * files to update on a scale change and no rule about which one is right.
   */

  it("reports a positive gap for overconfidence and negative for under", () => {
    const over = [decision({ confidence: 1, accurate: false })];
    const under = [decision({ confidence: 0, accurate: true })];
    expect(summarise(over).gap).toBeGreaterThan(0);
    expect(summarise(under).gap).toBeLessThan(0);
  });

  it("returns a zeroed summary for an empty record rather than dividing by zero", () => {
    expect(summarise([])).toEqual({
      n: 0,
      meanConfidence: 0,
      accuracyRate: 0,
      gap: 0,
      // Zero because there is no variance to estimate, which is not the same as no variation --
      // `gapDifferenceStandardError` refuses this summary rather than reading the zero as a fact.
      gapVariance: 0,
    });
  });
});

describe("the detector declines on thin evidence", () => {
  it("says nothing at all when no bucket clears the minimum", () => {
    const thin = Array.from({ length: MIN_BUCKET_N * 2 - 2 }, (_, i) =>
      decision({ decision_id: `d${i}`, secondsTaken: i < 5 ? 10 : 200 }),
    );
    expect(detect(thin)).toEqual([]);
  });

  it("requires the minimum on BOTH sides, not just inside the bucket", () => {
    // 40 fast decisions, 3 slow: the bucket is large but its complement is not.
    const lopsided = [
      ...Array.from({ length: 40 }, (_, i) =>
        decision({ decision_id: `f${i}`, secondsTaken: 10, confidence: 1, accurate: false }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        decision({ decision_id: `s${i}`, secondsTaken: 200, confidence: 0, accurate: true }),
      ),
    ];
    expect(detect(lopsided)).toEqual([]);
  });

  it("reports nothing that is not separable from its own sampling error", () => {
    /*
     * Rewritten with the rule it guards. It used to assert the gap difference cleared a CONSTANT,
     * which is exactly the test that was wrong: a constant compared against a point estimate has
     * no dependence on n, so it went silent on real effects as the record grew. What must hold
     * now is the relation, and it has to hold for the pattern's own reported error.
     */
    const flat = Array.from({ length: 80 }, (_, i) =>
      decision({ decision_id: `d${i}`, secondsTaken: i % 2 ? 10 : 200, accurate: i % 3 === 0 }),
    );
    for (const pattern of detect(flat)) {
      expect(pattern.standardError).toBeGreaterThan(0);
      expect(Math.abs(pattern.gapDifference)).toBeGreaterThanOrEqual(
        SEPARABILITY_K * pattern.standardError,
      );
    }
  });
});

describe("shuffling preserves the marginals and destroys the relationship", () => {
  const record = makeNoise(120, 991);

  it("keeps every confidence and accuracy attached to its own decision", () => {
    const shuffled = shuffleLabels(record, seededRandom(5));
    for (const [index, original] of record.entries()) {
      expect(shuffled[index].decision_id).toBe(original.decision_id);
      expect(shuffled[index].confidence).toBe(original.confidence);
      expect(shuffled[index].accurate).toBe(original.accurate);
    }
  });

  it("preserves the multiset of context labels", () => {
    const shuffled = shuffleLabels(record, seededRandom(5));
    // Nulls sort with the numbers rather than being dropped: the multiset this asserts on is the
    // one the shuffle permutes, and MISSINGNESS is part of it. A control that quietly discarded
    // the unmeasured decisions would permute a different record from the one the detector reads.
    const times = (list: ScoredDecision[]) =>
      list.map((d) => (d.secondsTaken === null ? -1 : d.secondsTaken)).sort((a, b) => a - b);
    expect(times(shuffled)).toEqual(times(record));
  });

  it("is deterministic for a given seed, so the gate cannot flake", () => {
    const a = shuffleLabels(record, seededRandom(42)).map((d) => d.secondsTaken);
    const b = shuffleLabels(record, seededRandom(42)).map((d) => d.secondsTaken);
    expect(a).toEqual(b);
  });
});

describe("the shipped thresholds are the ones the control chose", () => {
  it("uses 30 decisions and 3.75 standard errors, both set by the shuffled-label control", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ minBucketN: 30, separabilityK: 3.75 });
  });

  it("treats a loss inside engine noise as accurate", () => {
    expect(ACCURATE_CP_LOSS).toBe(30);
  });
});
