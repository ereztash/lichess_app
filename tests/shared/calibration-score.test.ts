/**
 * The decomposition, and the identity that makes it worth having.
 *
 * A raw calibration gap is one number standing in for three things with different owners. This
 * file holds the split apart and, more importantly, holds the ONE arithmetic fact that makes the
 * split meaningful rather than decorative: the three terms have to reassemble into the Brier
 * score. If they do not, they are three unrelated numbers with suggestive names.
 *
 * The Brier score here is computed decision by decision and the three terms are computed level by
 * level, on purpose. Deriving either side from the other would make the identity true by
 * construction and the test would prove nothing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { calibrationScore } from "@shared/calibration-score";

/** A position that is deliberately NOT in the anchor set: these are free-play records. */
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

describe("the three terms reassemble into the score", () => {
  it("holds brier = reliability - resolution + uncertainty, on a real spread", () => {
    const record = [
      ...many(7, 40, 34, 0),
      ...many(6, 30, 22, 100),
      ...many(EVEN_ODDS_LEVEL, 50, 26, 200),
      ...many(2, 20, 5, 300),
    ];
    const score = calibrationScore(record);
    expect(score.reliability - score.resolution + score.uncertainty).toBeCloseTo(score.brier, 12);
  });

  it("holds it on a degenerate record too, where every term is at an extreme", () => {
    // One level, one outcome: resolution and uncertainty both vanish and reliability is the whole
    // score. The identity has to survive the corners, not just the comfortable middle.
    const score = calibrationScore(many(7, 20, 20, 0));
    expect(score.uncertainty).toBe(0);
    expect(score.resolution).toBe(0);
    expect(score.reliability - score.resolution + score.uncertainty).toBeCloseTo(score.brier, 12);
  });
});

describe("and the identity is a check, not a definition", () => {
  it("computes the score from the decisions rather than from its own three terms", () => {
    /*
     * A POSITIVE CONTROL SURVIVED HERE, and the reason is worth the space.
     *
     * Replacing `brier` with `reliability - resolution + uncertainty` left every test above green.
     * That is not a gap in the assertions -- it is a fact about the mathematics: Murphy's identity
     * is EXACT, so the two sides agree on every input where the terms are computed correctly. No
     * comparison of values can ever tell a measured Brier score from a reassembled one.
     *
     * What the reassembly destroys is not this test's value but its POWER. With `brier` derived,
     * the identity holds by construction and stops testing anything -- and the mutation that
     * divides reliability by the wrong denominator, which is caught above by exactly one failing
     * assertion, becomes invisible.
     *
     * So the independence has to be asserted against the source. It is a claim about what the
     * module is allowed to read, and those are the only claims a value can never carry.
     */
    const source = readFileSync(resolve(__dirname, "../../shared/calibration-score.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source, "the score is reassembled from its own decomposition").not.toMatch(
      /brier:\s*reliability/,
    );
    expect(source, "the score is not summed over the decisions").toMatch(
      /squared \+= \(decision\.confidence - outcome\) \*\* 2/,
    );
    expect(source).toMatch(/brier: squared \/ n/);
  });
});

describe("uncertainty belongs to the positions, not to the player", () => {
  it("moves when the positions get harder, with the player's judgement held identical", () => {
    /*
     * THE WHOLE REASON THIS MODULE EXISTS. Both players below are the same judge: they say the
     * same thing and are right exactly as often as they claimed, so their calibration error is
     * zero. One was served easy positions and one hard ones. A raw gap charges the second player
     * for the item bank; RELIABILITY does not.
     */
    const easy = [...many(7, 100, 95, 0), ...many(6, 100, 80, 100)];
    const hard = [...many(EVEN_ODDS_LEVEL, 100, 50, 0), ...many(2, 100, 20, 100)];

    const onEasy = calibrationScore(easy);
    const onHard = calibrationScore(hard);

    expect(onEasy.reliability).toBeCloseTo(0, 10);
    expect(onHard.reliability).toBeCloseTo(0, 10);
    expect(onHard.uncertainty).toBeGreaterThan(onEasy.uncertainty);
    expect(onHard.brier, "the raw score punishes the harder item bank").toBeGreaterThan(
      onEasy.brier,
    );
  });

  it("gives a perfectly calibrated player zero reliability whatever they claimed", () => {
    for (const level of [2, EVEN_ODDS_LEVEL, 6, 7]) {
      const claimed = at(level);
      const count = 200;
      const score = calibrationScore(many(level, count, Math.round(claimed * count), 0));
      expect(score.reliability, `level ${level} charged a calibrated player`).toBeCloseTo(0, 3);
    }
  });
});

describe("resolution is what saying different things earns", () => {
  it("is zero for a player who says the same thing about everything", () => {
    // Right 60% of the time and always claims even odds: perfectly useless as a discriminator,
    // whatever their gap looks like.
    const score = calibrationScore(many(EVEN_ODDS_LEVEL, 100, 60, 0));
    expect(score.resolution).toBeCloseTo(0, 12);
    expect(score.skillScore!, "a non-discriminating player beat the base rate").toBeLessThanOrEqual(0);
  });

  it("rises when the levels separate cases that really do turn out differently", () => {
    const flat = [...many(EVEN_ODDS_LEVEL, 100, 70, 0)];
    const sorted = [...many(7, 50, 48, 0), ...many(2, 50, 22, 100)];
    expect(calibrationScore(sorted).resolution).toBeGreaterThan(
      calibrationScore(flat).resolution,
    );
  });
});

describe("the log score is finite, which the old scale could not promise", () => {
  it("stays bounded even when the most confident claim is wrong every time", () => {
    /*
     * The payoff of insetting the scale, stated as arithmetic. On the old five-level scale the top
     * level asserted 1.0, and ONE such decision that turned out wrong made this infinite -- and
     * infinite forever, because a mean over a set containing infinity is infinity. No proper
     * scoring rule could be computed over a record that contained a single stated certainty.
     */
    const score = calibrationScore(many(CONFIDENCE_LEVELS, 30, 0, 0));
    expect(Number.isFinite(score.logScore)).toBe(true);
    expect(score.logScore).toBeCloseTo(-Math.log(1 - at(CONFIDENCE_LEVELS)), 10);
    expect(score.logScore).toBeLessThan(3.1);
  });

  it("is smallest when the confident claims are the ones that come true", () => {
    const right = calibrationScore(many(CONFIDENCE_LEVELS, 30, 30, 0));
    const wrong = calibrationScore(many(CONFIDENCE_LEVELS, 30, 0, 0));
    expect(right.logScore).toBeLessThan(wrong.logScore);
  });
});

describe("it says when its own terms cannot be read", () => {
  it("refuses to call a handful of decisions a calibration measurement", () => {
    /*
     * RELIABILITY is biased upward in small samples -- with one decision per level it is at its
     * maximum by construction, because an observed rate of 0 or 1 is the furthest anything can be
     * from a claim of 0.65. The numbers are still exactly right for the data; what `reliable`
     * says is whether they may be read as a finding.
     */
    expect(calibrationScore(many(6, 5, 3, 0)).reliable).toBe(false);
    expect(calibrationScore(many(6, MIN_BUCKET_N, 24, 0)).reliable).toBe(true);
  });

  it("returns null rather than a skill score when there is no base rate to beat", () => {
    // Every decision accurate: uncertainty is 0, and `1 - brier/0` is not a skill, it is a
    // division by an empty comparison.
    expect(calibrationScore(many(7, 20, 20, 0)).skillScore).toBeNull();
    expect(calibrationScore(many(7, 20, 10, 0)).skillScore).not.toBeNull();
  });

  it("reports nothing at all for an empty record instead of a confident zero", () => {
    const score = calibrationScore([]);
    expect(score.n).toBe(0);
    expect(score.levels).toEqual([]);
    expect(score.reliable).toBe(false);
    expect(score.skillScore).toBeNull();
  });
});

describe("levels are grouped by the claim, not the button", () => {
  it("keeps two scales apart when the same button meant different things", () => {
    /*
     * A record can hold decisions from before the scale changed. Button 4 asserted 0.75 then and
     * asserts 0.50 now; grouping by the button would pool two different claims into one term and
     * charge the reliability of each against the other.
     */
    const legacy = decision(0.75, true, 900);
    const current = decision(at(EVEN_ODDS_LEVEL), true, 901);
    const score = calibrationScore([legacy, current]);
    expect(score.levels.map((l) => l.claimed)).toEqual([0.5, 0.75]);
    expect(score.levels.every((l) => l.n === 1)).toBe(true);
  });

  it("counts every decision exactly once across the levels", () => {
    const record = [...many(7, 13, 9, 0), ...many(3, 7, 2, 100), ...many(5, 11, 6, 200)];
    const score = calibrationScore(record);
    expect(score.levels.reduce((total, l) => total + l.n, 0)).toBe(record.length);
    expect(score.n).toBe(record.length);
  });
});
