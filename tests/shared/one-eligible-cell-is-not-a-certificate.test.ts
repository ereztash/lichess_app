/**
 * F2. `reliable` certified an aggregate that one of its own cells was too small to be read in.
 *
 * WHAT THE FLAG MEANT. `levels.some((level) => level.n >= MIN_BUCKET_N)` -- "at least one level
 * carries enough decisions for its term to mean anything". Every word of that is true about the
 * LEVEL it tests. None of it is true about the aggregate the flag is attached to.
 *
 * WHAT THE AGGREGATE IS. `reliability` is a weighted mean over every level the player used:
 * `sum over k of (n_k / n) * (claimed_k - observed_k)^2`. A level's WEIGHT in it is its share of
 * the record, and that share has nothing to do with whether the level cleared eligibility. So an
 * ineligible level can carry almost all of the displayed number while `some` reports on a
 * different level entirely.
 *
 * THE ILLEGAL INFERENCE, in one line: local eligibility of one cell was read as certification of a
 * total that is mostly made of other cells.
 *
 * WHY THE REPAIR IS `every` AND NOT A COVERAGE THRESHOLD. The repository already answers this
 * question, one module away and for the same reason. `BucketReading.measurable` is
 * `inside.n >= MIN_BUCKET_N && outside.n >= MIN_BUCKET_N` -- EVERY cell of the detector's two-cell
 * partition, not one of them -- and `MIN_BUCKET_N`'s own comment calls itself "the smallest bucket,
 * AND THE SMALLEST REMAINDER, this detector will read at all". Generalised from two cells to seven
 * that is `every`, with no new constant, no new score, and no threshold chosen because it felt
 * right. Any rule phrased on the SHARE of mass an ineligible level may carry would need a number
 * this repository has no evidence for.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { calibrationScore } from "@shared/calibration-score";

const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const at = (level: number) => normaliseConfidence(level, CONFIDENCE_LEVELS);

const decision = (confidence: number, accurate: boolean, index: number): ScoredDecision => ({
  decision_id: `d-${index}`,
  fen: NON_ANCHOR_FEN,
  confidence,
  accurate,
  phase: "middlegame",
  secondsTaken: 30,
  clockMsRemaining: 120_000,
});

/** `count` decisions at one level, `hits` of which came true. */
const many = (level: number, count: number, hits: number, seed = 0): ScoredDecision[] =>
  Array.from({ length: count }, (_, i) => decision(at(level), i < hits, seed + i));

/** What one level contributes to `reliability`: its share of the record times its squared error. */
const contribution = (claimed: number, n: number, hits: number, total: number) =>
  (n * (claimed - hits / n) ** 2) / total;

describe("a global reliability flag is not earned by one eligible level", () => {
  /*
   * THE COUNTEREXAMPLE, and it is deliberately the smallest one that can exist: two levels, one
   * either side of the floor, 59 decisions in total.
   *
   *   level 5 (asserts 65%)   n = 30, 20 came true   observed 0.667   eligible
   *   level 7 (asserts 95%)   n = 29,  0 came true   observed 0.000   one short of eligible
   *
   * The eligible level is almost perfectly calibrated and contributes almost nothing. The
   * ineligible one is as wrong as the scale allows and carries essentially the whole number.
   */
  const eligible = many(5, MIN_BUCKET_N, 20, 0);
  const short = many(7, MIN_BUCKET_N - 1, 0, 100);
  const record = [...eligible, ...short];

  it("has one level over the floor and one under it", () => {
    const score = calibrationScore(record);
    const byClaim = new Map(score.levels.map((l) => [l.claimed, l]));
    expect(byClaim.get(at(5))?.n).toBe(MIN_BUCKET_N);
    expect(byClaim.get(at(7))?.n).toBe(MIN_BUCKET_N - 1);
  });

  it("takes almost the whole displayed number from the level that is under it", () => {
    /*
     * The step that makes this a defect rather than a technicality. Computed from the definition
     * rather than read off the object, so the test states the arithmetic it is objecting to.
     */
    const score = calibrationScore(record);
    const fromShort = contribution(at(7), MIN_BUCKET_N - 1, 0, record.length);
    const fromEligible = contribution(at(5), MIN_BUCKET_N, 20, record.length);
    expect(fromShort + fromEligible).toBeCloseTo(score.reliability, 12);
    // Not "a large share". Essentially all of it: the eligible level's term is under a thousandth.
    expect(fromShort).toBeGreaterThan(fromEligible * 100);
    expect(fromShort / score.reliability).toBeGreaterThan(0.99);
  });

  it("refuses to certify it, because a cell too small to read is carrying it", () => {
    // The negative test. `some` returned true here, on the strength of the level contributing least.
    expect(calibrationScore(record).reliable).toBe(false);
  });

  it("still certifies a record where every level the player used cleared the floor", () => {
    /*
     * THE POSITIVE CONTROL, and it is what stops `reliable: false` from being the answer. A rule
     * that never certified anything would pass the case above and delete the panel. One more
     * decision at the short level -- the difference between 29 and 30, nothing else -- and the
     * same record is readable again.
     */
    const enough = [...eligible, ...many(7, MIN_BUCKET_N, 0, 100)];
    expect(calibrationScore(enough).reliable).toBe(true);
    // And the single-level record the existing suite already certifies is untouched.
    expect(calibrationScore(many(6, MIN_BUCKET_N, 24, 0)).reliable).toBe(true);
  });

  it("does not certify an empty record by vacuous agreement", () => {
    /*
     * `every` over nothing is true, which is the one way this rule could have been worse than the
     * one it replaces. A record with no decisions has no levels and must report nothing.
     */
    expect(calibrationScore([]).reliable).toBe(false);
    expect(calibrationScore([]).levels).toEqual([]);
  });

  it("changes no number, only what may be read as a finding", () => {
    /*
     * The boundary of this repair, stated so a later reader cannot widen it by accident. Murphy's
     * decomposition is computed over every decision the player took, before and after: the flag
     * says whether the terms may be read, it does not decide which decisions are in them. Dropping
     * the short level from the aggregate would change `brier`, `uncertainty` and the base rate, and
     * would make the record describe a player who never stated 95%.
     */
    const score = calibrationScore(record);
    expect(score.n).toBe(record.length);
    expect(score.levels).toHaveLength(2);
    expect(score.reliability - score.resolution + score.uncertainty).toBeCloseTo(score.brier, 12);
  });
});
