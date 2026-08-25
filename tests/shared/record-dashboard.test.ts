/**
 * Reading the record.
 *
 * The measurements are the detector's own -- that is the point, so the dashboard and the claim
 * panel cannot end up making different statements about the same player. What these tests defend
 * is the honesty of the reading: a bucket under the threshold must SAY it cannot be read, and a
 * confidence level nobody used must be absent rather than plotted as zero.
 */
import {
  CONFIDENCE_CHOICES,
  CONFIDENCE_LEVELS,
  EVEN_ODDS_LEVEL,
  LEGACY_CONFIDENCE_LEVELS,
  normaliseConfidence,
} from "../../shared/confidence";
import { describe, expect, it } from "vitest";
import { MIN_BUCKET_N, type ScoredDecision } from "../../shared/detector";
import { readRecord } from "../../shared/record-dashboard";

function decision(over: Partial<ScoredDecision> & { id?: string }): ScoredDecision {
  return {
    decision_id: over.id ?? `d-${Math.round(over.secondsTaken ?? 0)}-${over.confidence}`,
    confidence: over.confidence ?? normaliseConfidence(3, CONFIDENCE_LEVELS),
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
    /*
     * Written in SCALE TERMS, not integers. This used to plant `confidence: 5` for "as sure as
     * this scale allows" and `3` for "no read at all", both true of a five-level scale and
     * neither true of a seven-level one -- 5 became 0.65 and the planted effect quietly halved
     * while the assertion kept its old number.
     */
    const top = normaliseConfidence(CONFIDENCE_LEVELS, CONFIDENCE_LEVELS);
    const evens = normaliseConfidence(EVEN_ODDS_LEVEL, CONFIDENCE_LEVELS);
    const reading = readRecord([
      ...many(MIN_BUCKET_N, { secondsTaken: 10, confidence: top, accurate: false }),
      ...many(MIN_BUCKET_N, { secondsTaken: 300, confidence: evens, accurate: true }),
    ]);
    const fast = reading.buckets.find((b) => b.key === "fast-under-45s");
    expect(fast?.measurable).toBe(true);
    // As sure as the scale allows, and wrong, when fast: a large positive gap.
    expect(fast?.inside.gap).toBeCloseTo(top, 5);
    expect(fast?.outside.gap).toBeCloseTo(evens - 1, 5);
  });

  it("leaves a confidence level nobody stated with a null observation, never a zero", () => {
    const at = (reading: ReturnType<typeof readRecord>, level: number) =>
      reading.confidence.find(
        (c) => Math.abs(c.claimed - normaliseConfidence(level, CONFIDENCE_LEVELS)) < 1e-9,
      );
    const reading = readRecord(many(4, { confidence: normaliseConfidence(4, CONFIDENCE_LEVELS) }));
    expect(at(reading, 4)?.n).toBe(4);
    expect(at(reading, 4)?.observed).toBe(1);
    // Never stated: n=0 and observed null. Plotting 0% would assert something never claimed.
    expect(at(reading, 1)?.n).toBe(0);
    expect(at(reading, 1)?.observed).toBeNull();
    // Every level of the scale is present, whether or not anyone reached for it.
    for (const level of CONFIDENCE_CHOICES) expect(at(reading, level), `level ${level}`).toBeTruthy();
  });

  it("keeps a decision stated on an older scale on the chart instead of dropping it", () => {
    /*
     * A record can hold both scales: the five-level grid ran 0/.25/.5/.75/1 and this one is inset
     * at .05/.95, and they share only even odds. Grouping by the current grid alone would have
     * quietly excluded every older decision from a chart that still reported a total -- a
     * denominator computed over one set and a numerator over another.
     */
    const legacy = normaliseConfidence(4, LEGACY_CONFIDENCE_LEVELS);
    const reading = readRecord([
      ...many(3, { confidence: legacy, accurate: true }),
      ...many(2, { confidence: normaliseConfidence(6, CONFIDENCE_LEVELS), accurate: false }),
    ]);
    const older = reading.confidence.find((c) => Math.abs(c.claimed - legacy) < 1e-9);
    expect(older, "a decision stated on the old scale vanished from the chart").toBeTruthy();
    expect(older!.n).toBe(3);
    expect(reading.confidence.reduce((total, c) => total + c.n, 0)).toBe(5);
    // And it is labelled by the claim, not the button, so it cannot collide with today's level 4.
    expect(older!.stated).toBe(75);
    expect(reading.confidence.find((c) => c.claimed === 0.5)!.stated).toBe(50);
  });

  it("measures overconfidence as stated minus observed", () => {
    const top = normaliseConfidence(CONFIDENCE_LEVELS, CONFIDENCE_LEVELS);
    const reading = readRecord([
      ...many(5, { confidence: top, accurate: false }),
      ...many(5, { confidence: top, accurate: true }),
    ]);
    // Claimed the most this scale can claim, right half the time. Note the top is 0.95 and not
    // 1: no level asserts certainty, because a stated 1 makes a logarithmic score infinite.
    expect(reading.overall.meanConfidence).toBeCloseTo(top, 5);
    expect(reading.overall.accuracyRate).toBeCloseTo(0.5, 5);
    expect(reading.overall.gap).toBeCloseTo(top - 0.5, 5);
  });
});
