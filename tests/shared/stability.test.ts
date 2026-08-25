/**
 * Whether the number holds still, and the two ways a stability check can flatter its subject.
 *
 * This is the question a serious reader asks first and the instrument could never answer: is the
 * calibration gap a property of the person, or of the sitting they happened to have? Ordinary
 * calibration measures show cross-task correlations of .08 to .39, so the default expectation is
 * that it is the sitting.
 *
 * FLATTERY ONE: SPLITTING DOWN THE MIDDLE. First-half against second-half confounds instability
 * with anything that changes over a sitting -- fatigue, warming up, the order of the bank itself.
 * A player who simply got tired would be reported as one whose number cannot be trusted, and a
 * player whose gap drifted steadily would be caught for the wrong reason.
 *
 * FLATTERY TWO: A SPLIT TOO SMALL TO FAIL. At eight decisions a side the standard error is wide
 * enough to swallow almost any instability, so a comfortable spread there is not evidence of
 * anything. A check that cannot fail is not a check.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL, normaliseConfidence } from "@shared/confidence";
import type { ScoredDecision } from "@shared/detector";
import { MIN_STABILITY_HALF, splitHalfStability } from "@shared/stability";

const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const at = (level: number) => normaliseConfidence(level, CONFIDENCE_LEVELS);

const decision = (index: number, confidence: number, accurate: boolean): ScoredDecision => ({
  decision_id: `d-${index}`,
  fen: NON_ANCHOR_FEN,
  confidence,
  accurate,
  phase: "middlegame",
  secondsTaken: 30,
  clockMsRemaining: 120_000,
});

/** A record that says the same thing throughout: every third decision goes the other way. */
const steady = (count: number, level: number) =>
  Array.from({ length: count }, (_, i) => decision(i, at(level), i % 3 !== 0));

describe("a record that says the same thing twice reads as stable", () => {
  it("puts the two halves close together, in standard errors", () => {
    const result = splitHalfStability(steady(80, 6));
    expect(result.readable).toBe(true);
    expect(result.n).toEqual([40, 40]);
    expect(result.spread!).toBeLessThan(2);
  });

  it("splits by alternating, not down the middle", () => {
    /*
     * THE ASSERTION THAT MATTERS MOST HERE. A record whose gap drifts steadily -- confident early,
     * cautious late -- is a record with a trend, not an unstable one, and a middle split would
     * report the trend as instability. Alternating puts the drift in both halves equally.
     */
    const drifting = Array.from({ length: 80 }, (_, i) =>
      decision(i, i < 40 ? at(CONFIDENCE_LEVELS) : at(2), i % 3 !== 0),
    );
    const alternating = splitHalfStability(drifting);
    expect(alternating.spread!, "a steady drift was reported as instability").toBeLessThan(1);

    // What a middle split would have said about the same record, for contrast.
    const firstHalf = drifting.slice(0, 40);
    const secondHalf = drifting.slice(40);
    const middleGap =
      firstHalf.reduce((t, d) => t + d.confidence - (d.accurate ? 1 : 0), 0) / 40 -
      secondHalf.reduce((t, d) => t + d.confidence - (d.accurate ? 1 : 0), 0) / 40;
    expect(Math.abs(middleGap), "the fixture has no drift to be fooled by").toBeGreaterThan(0.5);
  });
});

describe("a record that does not hold still says so", () => {
  it("separates the halves when they really do disagree", () => {
    /*
     * Built to be unstable on the alternating split specifically, and built to VARY WITHIN each
     * half -- which the first version of this fixture did not. Every even decision confident and
     * wrong, every odd one cautious and right, gives each half a sample variance of exactly zero,
     * and K1 correctly refuses to estimate a standard error from that. The fixture was degenerate
     * in the same way three of this repo's other fixtures once were, and the guard caught it.
     *
     * So each half is mostly one thing and not uniformly: the even side is confident and usually
     * wrong, the odd side cautious and usually right.
     */
    const unstable = Array.from({ length: 80 }, (_, i) =>
      i % 2 === 0
        ? decision(i, at(CONFIDENCE_LEVELS), i % 10 === 0)
        : decision(i, at(2), i % 9 !== 0),
    );
    const result = splitHalfStability(unstable);
    expect(result.readable).toBe(true);
    expect(result.spread!, "two halves that disagree completely read as stable").toBeGreaterThan(5);
  });
});

describe("it refuses to pass a check that could not have failed", () => {
  it("calls a small split unreadable rather than comfortably stable", () => {
    const thin = splitHalfStability(steady(16, 6));
    expect(thin.n).toEqual([8, 8]);
    expect(thin.readable, "eight decisions a side were treated as a stability finding").toBe(false);
  });

  it("needs both halves to clear the floor, not their total", () => {
    // 2 * MIN_STABILITY_HALF decisions split evenly is exactly enough; one short is not.
    expect(splitHalfStability(steady(MIN_STABILITY_HALF * 2, 6)).readable).toBe(true);
    expect(splitHalfStability(steady(MIN_STABILITY_HALF * 2 - 1, 6)).readable).toBe(false);
  });

  it("returns null rather than zero when a half has no variance to estimate", () => {
    /*
     * The K1 defect, in a new place. A half where every decision went the same way has a sample
     * variance of exactly zero, and a standard error of zero makes every difference infinitely
     * many standard errors wide. Null is the answer; zero is a claim.
     */
    const flat = Array.from({ length: 80 }, (_, i) => decision(i, at(EVEN_ODDS_LEVEL), true));
    const result = splitHalfStability(flat);
    expect(result.standardError).toBeNull();
    expect(result.spread).toBeNull();
    expect(result.readable).toBe(false);
  });

  it("handles an empty record without inventing a reading", () => {
    const none = splitHalfStability([]);
    expect(none.n).toEqual([0, 0]);
    expect(none.readable).toBe(false);
    expect(none.spread).toBeNull();
  });
});

describe("it does not claim to be test-retest", () => {
  it("says so in the source, because the distinction is the whole point", () => {
    /*
     * Test-retest separates the two measurements in TIME, which is what distinguishes a trait
     * from a mood, a warm-up, or a run of good positions. No split of a single sitting does that.
     * The day this gets reported as reliability is the day the instrument starts overclaiming in
     * exactly the direction it has spent every other file refusing to.
     */
    const source = readFileSync(resolve(__dirname, "../../shared/stability.ts"), "utf8");
    // Whitespace-tolerant: these sentences wrap across comment lines, and a regex that assumed
    // they did not would fail on a reflow that changed nothing.
    const prose = source.replace(/\s*\n\s*\*\s*/g, " ");
    expect(prose).toMatch(/NOT test-retest reliability/);
    expect(prose, "a Spearman-Brown correction implies a coefficient this cannot produce").toMatch(
      /Spearman-Brown does not apply/,
    );
  });

  it("produces no coefficient, only a spread", () => {
    const result = splitHalfStability(steady(80, 6));
    expect(Object.keys(result).sort()).toEqual([
      "difference",
      "gap",
      "n",
      "readable",
      "spread",
      "standardError",
    ]);
  });
});
