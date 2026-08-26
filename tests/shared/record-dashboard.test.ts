/**
 * Reading the record.
 *
 * The measurements are the detector's own -- that is the point, so the dashboard and the claim
 * panel cannot end up making different statements about the same player. What these tests defend
 * is the honesty of the reading: a bucket under the threshold must SAY it cannot be read, and a
 * confidence level nobody used must be absent rather than plotted as zero.
 */
import { ANCHOR_POSITIONS } from "../../shared/anchor-set";
import {
  CONFIDENCE_CHOICES,
  CONFIDENCE_LEVELS,
  EVEN_ODDS_LEVEL,
  LEGACY_CONFIDENCE_LEVELS,
  normaliseConfidence,
} from "../../shared/confidence";
import { describe, expect, it } from "vitest";
import { MIN_BUCKET_N, type ScoredDecision } from "../../shared/detector";
import { populationBucket } from "../../shared/population-baseline";
import { readRecord } from "../../shared/record-dashboard";

/** A position that is deliberately NOT in the anchor set: these are free-play records. */
const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function decision(over: Partial<ScoredDecision> & { id?: string }): ScoredDecision {
  return {
    decision_id: over.id ?? `d-${Math.round(over.secondsTaken ?? 0)}-${over.confidence}`,
    fen: NON_ANCHOR_FEN,
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

describe("the gap is reported split, not only whole", () => {
  it("carries the decomposition on the reading so a surface can lead with the player's term", () => {
    /*
     * Computing the split and not shipping it would leave the raw gap as the only thing anyone
     * sees, which is the state this replaced. The reading has to carry it for a surface to be
     * able to lead with `reliability` instead.
     */
    const reading = readRecord([
      ...many(40, { confidence: normaliseConfidence(CONFIDENCE_LEVELS, CONFIDENCE_LEVELS), accurate: true }),
      ...many(40, { confidence: normaliseConfidence(2, CONFIDENCE_LEVELS), accurate: false }),
    ]);
    expect(reading.calibration.n).toBe(80);
    expect(
      reading.calibration.reliability - reading.calibration.resolution + reading.calibration.uncertainty,
    ).toBeCloseTo(reading.calibration.brier, 12);
  });

  it("separates the player's error from the difficulty of what they were served", () => {
    /*
     * Two records from the SAME judge -- each says a thing and is right exactly that often -- on
     * item banks of different difficulty. `reliability` must not move; `uncertainty` must.
     */
    const calibrated = (level: number, count: number) =>
      many(count, {
        confidence: normaliseConfidence(level, CONFIDENCE_LEVELS),
      }).map((d, i) => ({
        ...d,
        accurate: i < Math.round(normaliseConfidence(level, CONFIDENCE_LEVELS) * count),
      }));

    const easy = readRecord([...calibrated(CONFIDENCE_LEVELS, 100), ...calibrated(6, 100)]);
    const hard = readRecord([...calibrated(EVEN_ODDS_LEVEL, 100), ...calibrated(2, 100)]);

    expect(easy.calibration.reliability).toBeCloseTo(0, 2);
    expect(hard.calibration.reliability).toBeCloseTo(0, 2);
    expect(hard.calibration.uncertainty).toBeGreaterThan(easy.calibration.uncertainty);
  });
});

describe("the anchor reading is the one that is comparable between players", () => {
  const anchored = (index: number, confidence: number, accurate: boolean) => ({
    decision_id: `a-${index}`,
    fen: ANCHOR_POSITIONS[index % ANCHOR_POSITIONS.length].fen,
    confidence,
    accurate,
    phase: "middlegame" as const,
    secondsTaken: 30,
    clockMsRemaining: 120_000,
  });

  it("counts only decisions taken on the bank, and says so with its own n", () => {
    const record = [
      ...Array.from({ length: 20 }, (_, i) => anchored(i, 0.8, i < 16)),
      ...many(35, { confidence: 0.65, accurate: true }),
    ];
    const reading = readRecord(record);
    expect(reading.calibration.n, "the whole record").toBe(55);
    expect(reading.anchor.n, "the anchor subset").toBe(20);
  });

  it("gives two players who answered the same positions the same uncertainty", () => {
    /*
     * THE WHOLE POINT, as arithmetic. `uncertainty` is a property of the items, so two players on
     * the same items cannot differ on it -- which is what makes the rest of their scores
     * comparable. It is asserted here on records that differ in every OTHER way: different
     * confidences, different people, same positions, same outcomes.
     */
    const bold = Array.from({ length: 30 }, (_, i) => anchored(i, 0.95, i < 21));
    const timid = Array.from({ length: 30 }, (_, i) => anchored(i, 0.5, i < 21));
    const a = readRecord(bold).anchor;
    const b = readRecord(timid).anchor;
    expect(a.uncertainty).toBeCloseTo(b.uncertainty, 12);
    expect(a.reliability, "the two judges came out identical").not.toBeCloseTo(b.reliability, 3);
  });

  it("stays empty rather than borrowing from the rest of the record", () => {
    /*
     * A player who has answered no bank positions has no comparable reading, and the honest
     * representation of that is nothing. Filling it in from their free-play decisions would
     * produce exactly the number the anchor set exists to stop being produced.
     */
    const reading = readRecord(many(40, { confidence: 0.8, accurate: true }));
    expect(reading.calibration.n).toBe(40);
    expect(reading.anchor.n).toBe(0);
    expect(reading.anchor.levels).toEqual([]);
    expect(reading.anchor.reliable).toBe(false);
  });
});

describe("a bucket's own accuracy is not a finding until it is against the population", () => {
  /*
   * WHY THIS BLOCK EXISTS. Measured on 693,130 Lichess moves: the middlegame is 12.6 points less
   * accurate than everything else FOR EVERYONE, and moves that took over two minutes are 14.2
   * points worse -- people think longer because the position is hard, so the slow bucket is a
   * property of the positions before it is a property of anyone. A record that reports a player's
   * middlegame rate on its own is telling them a fact about chess in the second person.
   */
  it("subtracts the population's rate for the bucket, not the record's own outside half", () => {
    const inside = many(MIN_BUCKET_N + 10, { phase: "middlegame", accurate: true });
    // Every one inside is accurate, so the record's own rate is exactly 1 and the comparison is
    // pinned to the baseline: any other subtraction gives a different number.
    const outside = many(MIN_BUCKET_N + 10, { phase: "opening", accurate: false });
    const middlegame = readRecord([...inside, ...outside]).buckets.find(
      (b) => b.key === "phase-middlegame",
    )!;
    const population = populationBucket("phase-middlegame")!;
    expect(middlegame.measurable).toBe(true);
    expect(middlegame.inside.accuracyRate).toBe(1);
    expect(middlegame.versusPopulation).toBeCloseTo(1 - population.accuracy, 10);
  });

  it("keeps the sign, so being below the population reads as below", () => {
    const inside = many(MIN_BUCKET_N + 10, { phase: "middlegame", accurate: false });
    const outside = many(MIN_BUCKET_N + 10, { phase: "opening", accurate: true });
    const middlegame = readRecord([...inside, ...outside]).buckets.find(
      (b) => b.key === "phase-middlegame",
    )!;
    expect(middlegame.versusPopulation).toBeLessThan(0);
    expect(middlegame.versusPopulation).toBeCloseTo(-populationBucket("phase-middlegame")!.accuracy, 10);
  });

  it("says nothing about a bucket the record itself cannot read", () => {
    /*
     * THE THRESHOLD GOVERNS THE COMPARISON TOO. A population has a very confident-looking
     * provenance, and eight decisions measured against 693,130 is still eight decisions.
     */
    const thin = readRecord(many(MIN_BUCKET_N - 3, { phase: "middlegame" })).buckets.find(
      (b) => b.key === "phase-middlegame",
    )!;
    expect(thin.measurable).toBe(false);
    expect(thin.versusPopulation).toBeNull();
  });

  it("leaves it null where the corpus has no baseline for the bucket at all", () => {
    // Not zero. Zero would read as "exactly average" -- a claim the corpus never made.
    const reading = readRecord([
      ...many(MIN_BUCKET_N + 10, { phase: "middlegame" }),
      ...many(MIN_BUCKET_N + 10, { phase: "opening" }),
    ]);
    for (const bucket of reading.buckets) {
      if (bucket.versusPopulation !== null) expect(populationBucket(bucket.key)).not.toBeNull();
    }
  });
});
