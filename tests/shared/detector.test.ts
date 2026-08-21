import { describe, expect, it } from "vitest";
import {
  ACCURATE_CP_LOSS,
  DEFAULT_THRESHOLDS,
  MIN_BUCKET_N,
  MIN_GAP_DIFFERENCE,
  detect,
  normaliseConfidence,
  seededRandom,
  shuffleLabels,
  summarise,
  type ScoredDecision,
} from "../../shared/detector";
import { makeNoise } from "../fixtures/shuffle-scenario";

const decision = (over: Partial<ScoredDecision> = {}): ScoredDecision => ({
  decision_id: "d",
  confidence: 0.5,
  accurate: true,
  phase: "middlegame",
  secondsTaken: 60,
  clockMsRemaining: 120_000,
  ...over,
});

describe("calibration", () => {
  it("maps confidence 1..5 onto 0..1 with 3 as even odds", () => {
    expect(normaliseConfidence(1)).toBe(0);
    expect(normaliseConfidence(3)).toBe(0.5);
    expect(normaliseConfidence(5)).toBe(1);
  });

  it("reports a positive gap for overconfidence and negative for under", () => {
    const over = [decision({ confidence: 1, accurate: false })];
    const under = [decision({ confidence: 0, accurate: true })];
    expect(summarise(over).gap).toBeGreaterThan(0);
    expect(summarise(under).gap).toBeLessThan(0);
  });

  it("returns a zeroed summary for an empty record rather than dividing by zero", () => {
    expect(summarise([])).toEqual({ n: 0, meanConfidence: 0, accuracyRate: 0, gap: 0 });
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

  it("ignores a difference smaller than the minimum gap", () => {
    const flat = Array.from({ length: 80 }, (_, i) =>
      decision({ decision_id: `d${i}`, secondsTaken: i % 2 ? 10 : 200, accurate: i % 3 === 0 }),
    );
    for (const pattern of detect(flat)) {
      expect(Math.abs(pattern.gapDifference)).toBeGreaterThanOrEqual(MIN_GAP_DIFFERENCE);
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
    const times = (list: ScoredDecision[]) => list.map((d) => d.secondsTaken).sort((a, b) => a - b);
    expect(times(shuffled)).toEqual(times(record));
  });

  it("is deterministic for a given seed, so the gate cannot flake", () => {
    const a = shuffleLabels(record, seededRandom(42)).map((d) => d.secondsTaken);
    const b = shuffleLabels(record, seededRandom(42)).map((d) => d.secondsTaken);
    expect(a).toEqual(b);
  });
});

describe("the shipped thresholds are the ones the control chose", () => {
  it("uses 30 / 0.45, not the first draft that found structure in noise", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ minBucketN: 30, minGapDifference: 0.45 });
  });

  it("treats a loss inside engine noise as accurate", () => {
    expect(ACCURATE_CP_LOSS).toBe(30);
  });
});
