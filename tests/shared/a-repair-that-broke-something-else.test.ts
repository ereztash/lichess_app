/**
 * The second-order run, on the decisions the four-family repair introduced.
 *
 * `docs/PRE_HUMAN_CEILING.md` names this class and its questions: is a new predicate monotone in
 * the record, does a reused rule answer its new consumer's question, and WHAT DID THE
 * COUNTEREXAMPLE HOLD FIXED. Two of the six decisions that closed F1 through F4 fail it, and both
 * failures are the same shape as the families they were written to close.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calibrationScore } from "@shared/calibration-score";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const at = (level: number) => normaliseConfidence(level, CONFIDENCE_LEVELS);
let seq = 0;
const decision = (level: number, accurate: boolean): ScoredDecision => ({
  decision_id: `d-${seq++}`,
  fen: FEN,
  confidence: at(level),
  accurate,
  phase: "middlegame",
  secondsTaken: 30,
  clockMsRemaining: 120_000,
});
const many = (level: number, n: number, hits: number) =>
  Array.from({ length: n }, (_, i) => decision(level, i < hits));

/** 400 decisions on two big levels, `miss` of them away from the claim, plus a thin level of 3. */
const record = (miss: number, thinHits = 2) => [
  ...many(5, 200, 130 - miss),
  ...many(6, 200, 160 - miss),
  ...many(7, 3, thinHits),
];

describe("what a reading says rests on thin cells does not depend on how the thick ones landed", () => {
  it("says the same thing about the same thin level whatever the rest of the record did", () => {
    /*
     * THE COUNTEREXAMPLE, AND IT IS THE F2 SHAPE ONE LEVEL UP. `unreadableShare` was a ratio of
     * SQUARED ERRORS: the thin level's term over `reliability`. `reliability` is near zero for a
     * well-calibrated player, so the ratio was governed by how well the BIG levels happened to
     * land rather than by anything about the thin one.
     *
     * Measured on three decisions out of 403 -- 0.74% of the record, unchanged across every row:
     *
     *     big levels off by    0     1     2     4     8    16    32
     *     share reported     100%   96%   86%   60%   27%    9%    2%
     *
     * Loudest for the best-calibrated reader and quietest for the worst, which is backwards, and
     * the field's own documentation claimed it said "how much of the displayed figure a reader may
     * not lean on".
     *
     * WHAT THE F2 COUNTEREXAMPLE HELD FIXED: a thin level as wrong as the scale allows beside an
     * eligible level that was nearly perfect. At that one point the ratio reads as intended. It is
     * degenerate everywhere else, and nothing had looked anywhere else.
     */
    const readings = [0, 1, 2, 4, 8, 16, 32].map((miss) => calibrationScore(record(miss)));
    for (const reading of readings) {
      expect(reading.unreadableN, "the thin level is the same in every row").toBe(3);
      expect(reading.n).toBe(403);
    }
    const said = new Set(readings.map((r) => r.unreadableN / r.n));
    expect(said.size, "the same thin level was described seven different ways").toBe(1);
  });

  it("does not fall silent about a thin cell that happens to be right", () => {
    /*
     * THE OTHER DIRECTION, and it is the worse one. A ratio of squared errors is exactly zero when
     * the thin level's observed rate matches its claim -- so 28 decisions, 7% of the record, sat on
     * a cell the instrument cannot read while the panel showed no qualification at all.
     */
    const rightAndThin = [...many(5, 200, 128), ...many(6, 200, 158), ...many(4, 28, 14)];
    const reading = calibrationScore(rightAndThin);
    expect(reading.unreadableN, "a cell too thin to read went unmentioned").toBe(28);
    expect(reading.unreadableN / reading.n).toBeGreaterThan(0.06);
  });

  it("still says loudly what F2 was written to make it say", () => {
    /*
     * THE POSITIVE CONTROL. The original counterexample must stay loud: 29 of 59 decisions sit on a
     * level one short of the floor, and that is half the reading rather than a rounding error.
     */
    const f2 = [...many(5, MIN_BUCKET_N, 20), ...many(7, MIN_BUCKET_N - 1, 0)];
    const reading = calibrationScore(f2);
    expect(reading.unreadableN).toBe(MIN_BUCKET_N - 1);
    expect(reading.unreadableN / reading.n).toBeGreaterThan(0.49);
    // And a record with nothing thin says nothing.
    const clean = [...many(5, MIN_BUCKET_N, 20), ...many(6, MIN_BUCKET_N, 24)];
    expect(calibrationScore(clean).unreadableN).toBe(0);
  });

  it("carries no qualification whose denominator is the error it is qualifying", () => {
    /*
     * THE HALF A VALUE CANNOT CARRY, so it is asserted against the source -- the device
     * `calibration-score.test.ts` already uses for a claim about what a module may contain.
     *
     * `unreadableShare` divided the thin level's term by `reliability`, which is the number it was
     * meant to qualify. A qualification whose denominator is its own subject moves with the
     * subject: the measurements above are what that produces. The share of the RECORD on
     * unreadable cells is `unreadableN` over `n`, it depends on nothing else, and it is what the
     * panel says.
     */
    const source = readFileSync(resolve(__dirname, "../../shared/calibration-score.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code, "a share of `reliability` is back").not.toMatch(/unreadableShare/);
  });
});
