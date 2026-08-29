/**
 * The other half of metacognition, and the ways a correlation flatters whoever computes it.
 *
 * Monitoring is whether the confidence tracks the outcome. Control is whether the EFFORT tracks
 * the monitoring -- whether the player actually spends longer where they are less sure. Until
 * this file the product measured only the first, and reported it under a name that implied both.
 *
 * FLATTERY ONE: PEARSON ON A SKEWED VARIABLE. Time taken is mostly small with a few enormous
 * values, so a product-moment correlation is a statement about the three slowest decisions in the
 * record. The fixture below makes that concrete: one outlier is enough to flip the sign.
 *
 * FLATTERY TWO: A COEFFICIENT FROM A FLAT RECORD. A player who took the same time over everything
 * has no association to measure, and zero would be a claim that effort and confidence are
 * unrelated for them. Null is the truth: this record cannot say.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { effortFollowsDoubt } from "@shared/control";

const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const at = (level: number) => normaliseConfidence(level, CONFIDENCE_LEVELS);

const decision = (index: number, seconds: number, level: number): ScoredDecision => ({
  decision_id: `d-${index}`,
  fen: NON_ANCHOR_FEN,
  confidence: at(level),
  accurate: index % 3 !== 0,
  phase: "middlegame",
  secondsTaken: seconds,
  clockMsRemaining: 120_000,
});

describe("effort that follows doubt reads negative", () => {
  it("is strongly negative when the least sure decisions took longest", () => {
    /*
     * The healthy direction: confidence falls as time rises. Written as a monotone descent, which
     * the first version was not -- `CONFIDENCE_LEVELS - (i % CONFIDENCE_LEVELS)` sawtooths 7,6,5,
     * 4,3,2,1,7,6,... against a rising clock, so the fixture carried almost no association and
     * the assertion was failing on the fixture rather than on the code.
     */
    const descending = (i: number) => Math.max(1, CONFIDENCE_LEVELS - Math.floor(i / 6));
    const record = Array.from({ length: 42 }, (_, i) => decision(i, 10 + i * 5, descending(i)));
    const result = effortFollowsDoubt(record);
    expect(result.readable).toBe(true);
    expect(result.rho!).toBeLessThan(-0.4);
  });

  it("is positive when the longest thought went into what they were surest about", () => {
    /*
     * Reported signed, not as a magnitude. A player who spends longest on the decisions they are
     * most certain about is polishing what they already know, and that is a legible finding about
     * how they allocate effort -- not a fault in the measurement to be hidden behind an absolute
     * value.
     */
    const ascending = (i: number) => Math.min(CONFIDENCE_LEVELS, 1 + Math.floor(i / 6));
    const record = Array.from({ length: 42 }, (_, i) => decision(i, 10 + i * 5, ascending(i)));
    expect(effortFollowsDoubt(record).rho!).toBeGreaterThan(0.4);
  });

  it("is near zero when effort has nothing to do with what they said", () => {
    /*
     * Built exactly balanced rather than modularly: every confidence level paired with the same
     * set of times. A fixture that is only approximately null plants a small effect and calls the
     * difference rounding.
     */
    const record: ScoredDecision[] = [];
    const times = [5, 20, 60, 150];
    for (let level = 1; level <= CONFIDENCE_LEVELS; level += 1) {
      for (const seconds of times) record.push(decision(record.length, seconds, level));
    }
    expect(effortFollowsDoubt(record).rho!).toBeCloseTo(0, 10);
  });
});

describe("ranks, because seconds are not normally distributed", () => {
  it("does not let one enormous think flip the answer", () => {
    /*
     * THE ASSERTION THAT CHOOSES SPEARMAN. The record is a clean healthy pattern with ONE decision
     * where the player stared at the board for an hour and was certain. On ranks that is a single
     * observation at the far end. On raw seconds it is 3600 against a median of 40, and a
     * product-moment correlation reports the outlier rather than the player.
     */
    const descending = (i: number) => Math.max(1, CONFIDENCE_LEVELS - Math.floor(i / 6));
    const clean = Array.from({ length: 41 }, (_, i) => decision(i, 10 + i * 4, descending(i)));
    const withOutlier = [...clean, decision(999, 3600, CONFIDENCE_LEVELS)];

    const spearman = effortFollowsDoubt(withOutlier).rho!;
    expect(spearman, "one outlier moved the rank correlation").toBeLessThan(-0.3);

    const pearson = (rows: ScoredDecision[]) => {
      // Every row in this fixture carries a time; the filter is what the type now requires.
      const x = rows.flatMap((r) => (r.secondsTaken === null ? [] : [r.secondsTaken]));
      const y = rows.map((r) => r.confidence);
      const m = (v: number[]) => v.reduce((t, n) => t + n, 0) / v.length;
      const mx = m(x);
      const my = m(y);
      let top = 0;
      let l = 0;
      let r = 0;
      for (let i = 0; i < x.length; i += 1) {
        top += (x[i] - mx) * (y[i] - my);
        l += (x[i] - mx) ** 2;
        r += (y[i] - my) ** 2;
      }
      return top / Math.sqrt(l * r);
    };
    expect(
      pearson(withOutlier),
      "the fixture has no outlier for Spearman to be robust against",
    ).toBeGreaterThan(pearson(clean) + 0.2);
  });

  it("averages tied times rather than ordering them arbitrarily", () => {
    // Seconds are integers and a coarse scale produces ties constantly; breaking them by input
    // order would make the coefficient depend on which decision happened to be recorded first.
    const forward = Array.from({ length: 40 }, (_, i) => decision(i, i % 2 === 0 ? 30 : 90, (i % 4) + 2));
    const reversed = [...forward].reverse();
    expect(effortFollowsDoubt(forward).rho!).toBeCloseTo(effortFollowsDoubt(reversed).rho!, 12);
  });
});

describe("it says when there is no association to measure", () => {
  it("returns null and a reason for a record with one time in it", () => {
    const flat = Array.from({ length: 40 }, (_, i) => decision(i, 30, (i % CONFIDENCE_LEVELS) + 1));
    const result = effortFollowsDoubt(flat);
    expect(result.rho).toBeNull();
    expect(result.reason).toBe("flat-time");
    expect(result.readable).toBe(false);
  });

  it("distinguishes a flat clock from a flat opinion", () => {
    // Two different states, and a caller that renders them alike tells the player the wrong thing
    // about their own record.
    const sameOpinion = Array.from({ length: 40 }, (_, i) => decision(i, 10 + i * 3, 5));
    expect(effortFollowsDoubt(sameOpinion).reason).toBe("flat-confidence");
  });

  it("refuses a record too small for a coefficient to mean anything", () => {
    const thin = Array.from({ length: MIN_BUCKET_N - 1 }, (_, i) =>
      decision(i, 10 + i * 5, Math.max(1, CONFIDENCE_LEVELS - Math.floor(i / 4))),
    );
    expect(effortFollowsDoubt(thin).reason).toBe("too-few");
    expect(effortFollowsDoubt(thin).readable).toBe(false);
  });

  it("reports nothing at all for an empty record", () => {
    const none = effortFollowsDoubt([]);
    expect(none.n).toBe(0);
    expect(none.rho).toBeNull();
    expect(none.reason).toBeNull();
  });
});
