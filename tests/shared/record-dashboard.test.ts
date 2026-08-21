/**
 * Reading the record.
 *
 * The measurements are the detector's own -- that is the point, so the dashboard and the claim
 * panel cannot end up making different statements about the same player. What these tests defend
 * is the honesty of the reading: a bucket under the threshold must SAY it cannot be read, and a
 * confidence level nobody used must be absent rather than plotted as zero.
 */
import { describe, expect, it } from "vitest";
import { MIN_BUCKET_N, normaliseConfidence, type ScoredDecision } from "../../shared/detector";
import { readRecord } from "../../shared/record-dashboard";

function decision(over: Partial<ScoredDecision> & { id?: string }): ScoredDecision {
  return {
    decision_id: over.id ?? `d-${Math.round(over.secondsTaken ?? 0)}-${over.confidence}`,
    confidence: over.confidence ?? normaliseConfidence(3),
    accurate: over.accurate ?? true,
    phase: over.phase ?? "middlegame",
    secondsTaken: over.secondsTaken ?? 60,
    clockMsRemaining: over.clockMsRemaining ?? null,
  };
}

function many(n: number, over: Partial<ScoredDecision>): ScoredDecision[] {
  return Array.from({ length: n }, (_, i) => decision({ ...over, id: `${over.phase}-${over.secondsTaken}-${i}` }));
}

describe("reading the record", () => {
  it("reports an empty record as nothing measured, not as zero", () => {
    const reading = readRecord([]);
    expect(reading.scored).toBe(0);
    expect(reading.overall.n).toBe(0);
    // Every bucket is still listed -- an omitted row would make the rest look complete.
    expect(reading.buckets).toHaveLength(6);
    expect(reading.buckets.every((b) => !b.measurable)).toBe(true);
  });

  it("keeps a bucket unmeasurable below the threshold and says how short it is", () => {
    const reading = readRecord(many(MIN_BUCKET_N - 3, { secondsTaken: 10 }));
    const fast = reading.buckets.find((b) => b.key === "fast-under-45s");
    expect(fast?.measurable).toBe(false);
    expect(fast?.shortBy).toBe(3);
  });

  it("only reads a split once BOTH sides clear the threshold", () => {
    // Enough inside, nothing outside: still not readable. A gap against an empty comparison is
    // not a gap.
    const reading = readRecord(many(MIN_BUCKET_N + 5, { secondsTaken: 10 }));
    expect(reading.buckets.find((b) => b.key === "fast-under-45s")?.measurable).toBe(false);
  });

  it("reads the split when both sides are populated", () => {
    const reading = readRecord([
      ...many(MIN_BUCKET_N, { secondsTaken: 10, confidence: normaliseConfidence(5), accurate: false }),
      ...many(MIN_BUCKET_N, { secondsTaken: 300, confidence: normaliseConfidence(3), accurate: true }),
    ]);
    const fast = reading.buckets.find((b) => b.key === "fast-under-45s");
    expect(fast?.measurable).toBe(true);
    // Certain and wrong when fast: a large positive gap.
    expect(fast?.inside.gap).toBeCloseTo(1, 5);
    expect(fast?.outside.gap).toBeCloseTo(-0.5, 5);
  });

  it("leaves a confidence level nobody stated with a null observation, never a zero", () => {
    const reading = readRecord(many(4, { confidence: normaliseConfidence(4) }));
    const four = reading.confidence.find((c) => c.stated === 4);
    const one = reading.confidence.find((c) => c.stated === 1);
    expect(four?.n).toBe(4);
    expect(four?.observed).toBe(1);
    // Never stated: n=0 and observed null. Plotting 0% would assert something never claimed.
    expect(one?.n).toBe(0);
    expect(one?.observed).toBeNull();
  });

  it("measures overconfidence as stated minus observed", () => {
    const reading = readRecord([
      ...many(5, { confidence: normaliseConfidence(5), accurate: false }),
      ...many(5, { confidence: normaliseConfidence(5), accurate: true }),
    ]);
    // Claimed 100%, right half the time.
    expect(reading.overall.meanConfidence).toBeCloseTo(1, 5);
    expect(reading.overall.accuracyRate).toBeCloseTo(0.5, 5);
    expect(reading.overall.gap).toBeCloseTo(0.5, 5);
  });
});
