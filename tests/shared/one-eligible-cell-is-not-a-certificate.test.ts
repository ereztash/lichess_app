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
 * `every` WAS THE FIRST REPAIR AND IT IS FALSIFIED. It is the obvious generalisation of
 * `BucketReading.measurable` from two cells to seven, it needs no new constant, and it kills the
 * counterexample below. It fails two other ways, both measured:
 *
 *   IT NEVER CERTIFIES. Four confidence distributions, 4,000 simulated records each: a
 *   concentrated one certifies on 0.0% of records at every size up to 2,000 and 2.0% at 4,000. A
 *   player who touches a seventh level occasionally never sees the panel at all.
 *
 *   IT IS NOT MONOTONE, which is the disqualifying one and is pinned as a test below. Appending a
 *   decision can only ever destroy readability under `every`. Sixty decisions across two levels
 *   certify; the same record plus ONE correct decision stated at 95% does not.
 *
 * SO THE FLAG IS MONOTONE AND THE QUALIFICATION IS A QUANTITY. `reliable` is `some` -- it only
 * turns on -- and `unreadableShare` reports how much of the displayed figure rests on levels too
 * thin to read. The acceptance criterion is about certification WITHOUT QUALIFICATION, and a
 * measured share is the qualification, so no number had to be invented to produce one.
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

  it("says how much of the displayed number rests on the cell too small to read", () => {
    /*
     * THE NEGATIVE TEST, AS A QUANTITY RATHER THAN A REFUSAL. The criterion is that a large
     * contribution from an ineligible population may not sit under an aggregate certified WITHOUT
     * QUALIFICATION. This is the qualification, and it is measured rather than chosen.
     */
    const score = calibrationScore(record);
    expect(score.unreadableShare).not.toBeNull();
    expect(score.unreadableShare!).toBeGreaterThan(0.99);
    // With its denominator, which is what makes it renderable at all under R1.
    expect(score.unreadableN).toBe(MIN_BUCKET_N - 1);
  });

  it("reports no share at all once every level the player used cleared the floor", () => {
    /*
     * THE POSITIVE CONTROL. One more decision at the short level -- the difference between 29 and
     * 30, nothing else -- and there is nothing left to discount.
     */
    const enough = [...eligible, ...many(7, MIN_BUCKET_N, 0, 100)];
    expect(calibrationScore(enough).reliable).toBe(true);
    expect(calibrationScore(enough).unreadableShare).toBe(0);
    expect(calibrationScore(enough).unreadableN).toBe(0);
    // And the single-level record the existing suite already certifies is untouched.
    expect(calibrationScore(many(6, MIN_BUCKET_N, 24, 0)).reliable).toBe(true);
  });

  it("never becomes unreadable because more decisions arrived", () => {
    /*
     * THE PROPERTY `every` VIOLATED, pinned so it cannot come back. An instrument may not answer a
     * question and then unanswer it because it was given more evidence.
     *
     * Under `every` this exact pair went true -> false on ONE appended decision, and stayed false
     * at 503 decisions with three of them on the thin level.
     */
    const base = [...many(5, MIN_BUCKET_N, 20, 0), ...many(6, MIN_BUCKET_N, 24, 100)];
    expect(calibrationScore(base).reliable).toBe(true);
    expect(calibrationScore([...base, ...many(7, 1, 1, 200)]).reliable).toBe(true);
    expect(calibrationScore([...base, ...many(7, 3, 2, 300)]).reliable).toBe(true);

    // Stated as the general property over the record, one decision at a time.
    const grown = [...base, ...many(7, 5, 3, 400), ...many(2, 4, 1, 500)];
    let seen = false;
    for (let i = 1; i <= grown.length; i += 1) {
      const readable = calibrationScore(grown.slice(0, i)).reliable;
      if (readable) seen = true;
      expect(seen && !readable, `reading became unreadable at n=${i}`).toBe(false);
    }
  });

  it("reports nothing to discount when there is no number to apportion", () => {
    /*
     * NULL RATHER THAN 0. A perfectly calibrated record has `reliability` 0, and "0% of it rests on
     * thin levels" reads as a clean bill of health on a question nobody could ask.
     */
    expect(calibrationScore([]).unreadableShare).toBeNull();
    expect(calibrationScore([]).levels).toEqual([]);
    expect(calibrationScore([]).reliable).toBe(false);
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
