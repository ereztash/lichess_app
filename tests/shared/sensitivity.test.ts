/**
 * Metacognitive sensitivity, and the property that makes it worth having separately.
 *
 * THE ONE THING CALIBRATION CANNOT SEE. A player who says "certain" about everything and is right
 * 70% of the time, and a player who says "certain" about every decision they get right and
 * "guess" about every one they get wrong, can have the SAME calibration error. The first is
 * useless as a judge of themselves and the second is perfect. Every assertion here exists to hold
 * that distinction.
 *
 * So the load-bearing test is not that the number is right on a fixture -- it is that shifting
 * every stated confidence by the same amount, which changes calibration completely, leaves this
 * untouched. If that ever stops holding, the measure has collapsed back into the one it was added
 * to complement.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { metacognitiveSensitivity } from "@shared/sensitivity";

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

/**
 * The area, computed a completely different way: the probability that a randomly drawn accurate
 * decision was stated more confidently than a randomly drawn inaccurate one, ties counting half.
 * That identity is what the trapezoid is FOR, so checking one against the other is a real check
 * rather than a restatement.
 */
function byPairs(decisions: readonly ScoredDecision[]): number {
  const yes = decisions.filter((d) => d.accurate);
  const no = decisions.filter((d) => !d.accurate);
  let wins = 0;
  for (const a of yes) {
    for (const b of no) {
      if (a.confidence > b.confidence) wins += 1;
      else if (a.confidence === b.confidence) wins += 0.5;
    }
  }
  return wins / (yes.length * no.length);
}

describe("the area is what it claims to be", () => {
  it("agrees with the rank definition, ties and all", () => {
    /*
     * Two independent computations of the same quantity: a trapezoid over the ROC curve, and a
     * pairwise count. They are equal by a theorem, not by construction, so a disagreement is a
     * bug in one of them. The fixture is deliberately full of ties -- a coarse scale produces
     * them constantly, and half-credit for a tie is exactly what the diagonal of a trapezoid
     * gives where a staircase of rectangles would quietly penalise them.
     */
    const record = [
      ...Array.from({ length: 30 }, (_, i) => decision(i, at(6), i % 4 !== 0)),
      ...Array.from({ length: 30 }, (_, i) => decision(100 + i, at(4), i % 2 === 0)),
      ...Array.from({ length: 30 }, (_, i) => decision(200 + i, at(2), i % 5 === 0)),
    ];
    expect(metacognitiveSensitivity(record).auroc2!).toBeCloseTo(byPairs(record), 12);
  });

  it("reads 0.5 when confidence says nothing about the outcome", () => {
    /*
     * BUILT EXACTLY BALANCED, not modularly. The first version cycled `i % 7` for the level
     * against `i % 2` for the outcome over 120 decisions; seven and two are coprime and 120 is
     * not a multiple of their product, so the cycle did not close and the fixture carried a small
     * real effect. It read 0.507 and I would have called the difference rounding. A null fixture
     * that is only approximately null is a planted effect with a reassuring name.
     */
    const noise: ScoredDecision[] = [];
    for (const level of Array.from({ length: CONFIDENCE_LEVELS }, (_, i) => i + 1)) {
      for (let k = 0; k < 9; k += 1) {
        noise.push(decision(noise.length, at(level), true));
        noise.push(decision(noise.length, at(level), false));
      }
    }
    expect(metacognitiveSensitivity(noise).auroc2!).toBeCloseTo(0.5, 12);
  });

  it("reads 1 when every accurate decision was stated above every inaccurate one", () => {
    const perfect = [
      ...Array.from({ length: 40 }, (_, i) => decision(i, at(6), true)),
      ...Array.from({ length: 40 }, (_, i) => decision(100 + i, at(2), false)),
    ];
    expect(metacognitiveSensitivity(perfect).auroc2!).toBeCloseTo(1, 10);
  });

  it("goes below 0.5 when the player is surer about what they get wrong", () => {
    /*
     * Not an error to be clamped away. Below chance is a real and interesting finding: the player
     * is systematically most confident exactly where they are worst, which is the pattern the
     * whole product exists to be able to see.
     */
    const inverted = [
      ...Array.from({ length: 40 }, (_, i) => decision(i, at(2), true)),
      ...Array.from({ length: 40 }, (_, i) => decision(100 + i, at(6), false)),
    ];
    expect(metacognitiveSensitivity(inverted).auroc2!).toBeCloseTo(0, 10);
  });
});

describe("it is blind to bias, which is the entire point", () => {
  it("does not move when every stated confidence shifts by the same amount", () => {
    /*
     * THE ASSERTION THIS FILE EXISTS FOR. The shifted record has a completely different
     * calibration error -- the player has become systematically far more confident -- and exactly
     * the same ability to tell their good decisions from their bad ones. A measure that moved
     * here would be measuring bias again under a new name.
     */
    const base = Array.from({ length: 90 }, (_, i) =>
      decision(i, at(i % 3 === 0 ? 5 : 3), i % 3 === 0),
    );
    const shifted = base.map((d, i) => decision(i, d.confidence + 0.15, d.accurate));

    const before = metacognitiveSensitivity(base);
    const after = metacognitiveSensitivity(shifted);
    expect(after.auroc2!).toBeCloseTo(before.auroc2!, 12);

    // And the shift really did change the thing sensitivity is supposed to be blind to.
    const meanOf = (rows: ScoredDecision[]) =>
      rows.reduce((t, d) => t + d.confidence, 0) / rows.length;
    expect(meanOf(shifted) - meanOf(base)).toBeCloseTo(0.15, 12);
  });

  it("separates the two players calibration cannot tell apart", () => {
    /*
     * Both are right 60 times in 90 and both claim far too much. The reckless one says the same
     * thing about everything; the discriminating one says more about what they get right. Same
     * mean confidence, same accuracy, same gap -- and this is the number that knows the
     * difference.
     */
    const reckless = Array.from({ length: 90 }, (_, i) => decision(i, at(6), i % 3 !== 0));
    const discriminating = Array.from({ length: 90 }, (_, i) =>
      decision(i, i % 3 !== 0 ? at(7) : at(4), i % 3 !== 0),
    );
    const mean = (rows: ScoredDecision[]) =>
      rows.reduce((t, d) => t + d.confidence, 0) / rows.length;
    expect(mean(discriminating)).toBeCloseTo(mean(reckless), 10);

    expect(metacognitiveSensitivity(reckless).auroc2!).toBeCloseTo(0.5, 10);
    expect(metacognitiveSensitivity(discriminating).auroc2!).toBeGreaterThan(0.9);
  });
});

describe("it refuses to draw a curve it has no points for", () => {
  it("returns null when every decision went the same way", () => {
    // With no inaccurate decisions there is no false-alarm rate, and no curve. Reporting 0.5 here
    // would say "this player has no metacognitive sensitivity" about a record that cannot say.
    const allRight = Array.from({ length: 40 }, (_, i) => decision(i, at(5), true));
    const result = metacognitiveSensitivity(allRight);
    expect(result.auroc2).toBeNull();
    expect(result.split).toEqual([40, 0]);
    expect(result.readable).toBe(false);
  });

  it("needs enough of BOTH outcomes, not enough decisions", () => {
    /*
     * A record of two hundred decisions with four inaccurate ones estimates the false alarm rate
     * from four points, and the curve is then a description of those four. Total n hides that;
     * the split does not.
     */
    const lopsided = [
      ...Array.from({ length: 200 }, (_, i) => decision(i, at(6), true)),
      ...Array.from({ length: 4 }, (_, i) => decision(300 + i, at(3), false)),
    ];
    const thin = metacognitiveSensitivity(lopsided);
    expect(thin.auroc2).not.toBeNull();
    expect(thin.readable, "four inaccurate decisions were treated as a curve").toBe(false);

    const balanced = [
      ...Array.from({ length: MIN_BUCKET_N }, (_, i) => decision(i, at(6), true)),
      ...Array.from({ length: MIN_BUCKET_N }, (_, i) => decision(300 + i, at(3), false)),
    ];
    expect(metacognitiveSensitivity(balanced).readable).toBe(true);
  });

  it("reports nothing for an empty record instead of chance", () => {
    const none = metacognitiveSensitivity([]);
    expect(none.auroc2).toBeNull();
    expect(none.curve).toEqual([]);
    expect(none.readable).toBe(false);
  });
});

describe("the curve is returned, not just its area", () => {
  it("closes at both corners so the area is the right shape", () => {
    /*
     * The far corner is an INVARIANT, not a step: the lowest threshold is the lowest confidence in
     * the record, so everything clears it. The implementation once carried a `push` guarded on
     * `hitRate < 1` to close the curve, and a positive control deleted it and watched every test
     * stay green -- because the guard could never fire. Asserted across records of different
     * shapes so it is checked as the property it is.
     */
    const shapes = [
      [...Array.from({ length: 30 }, (_, i) => decision(i, at(6), i % 3 !== 0)),
       ...Array.from({ length: 30 }, (_, i) => decision(100 + i, at(3), i % 4 === 0))],
      [...Array.from({ length: 12 }, (_, i) => decision(i, at(7), true)),
       ...Array.from({ length: 12 }, (_, i) => decision(50 + i, at(1), false))],
      [...Array.from({ length: 20 }, (_, i) => decision(i, at(4), i % 2 === 0))],
    ];
    for (const record of shapes) {
      const { curve } = metacognitiveSensitivity(record);
      expect(curve[0]).toMatchObject({ hitRate: 0, falseAlarmRate: 0 });
      expect(curve[curve.length - 1]).toMatchObject({ hitRate: 1, falseAlarmRate: 1 });
    }
  });

  it("gives the same area whether a threshold is read as 'at least' or 'above'", () => {
    /*
     * NOT A DEFECT, recorded because a positive control tried it and it survived, and the next
     * person will try it too. With thresholds drawn from the data, `>= t + epsilon` is `> t` for
     * any epsilon smaller than the gap between levels -- and the trapezoid area over a curve
     * closed at both corners is identical either way. The strict and non-strict readings differ
     * only in where the tied decisions sit along the same diagonal.
     */
    const record = [
      ...Array.from({ length: 25 }, (_, i) => decision(i, at(6), i % 3 !== 0)),
      ...Array.from({ length: 25 }, (_, i) => decision(100 + i, at(3), i % 4 === 0)),
    ];
    const strictly = (rows: ScoredDecision[]) => {
      const yes = rows.filter((d) => d.accurate).map((d) => d.confidence);
      const no = rows.filter((d) => !d.accurate).map((d) => d.confidence);
      const points = [
        { h: 0, f: 0 },
        ...[...new Set(rows.map((d) => d.confidence))]
          .sort((a, b) => b - a)
          .map((t) => ({
            h: yes.filter((v) => v > t).length / yes.length,
            f: no.filter((v) => v > t).length / no.length,
          })),
        { h: 1, f: 1 },
      ];
      let area = 0;
      for (let i = 1; i < points.length; i += 1) {
        area += ((points[i].f - points[i - 1].f) * (points[i].h + points[i - 1].h)) / 2;
      }
      return area;
    };
    expect(metacognitiveSensitivity(record).auroc2!).toBeCloseTo(strictly(record), 12);
  });

  it("uses the confidence values the record actually contains", () => {
    // A threshold nobody's confidence can reach adds a duplicate point, not information -- and a
    // record can hold decisions stated on more than one scale.
    const twoScales = [
      ...Array.from({ length: 20 }, (_, i) => decision(i, at(6), true)),
      ...Array.from({ length: 20 }, (_, i) => decision(100 + i, 0.75, false)),
    ];
    const { curve } = metacognitiveSensitivity(twoScales);
    const inner = curve.filter((point) => Number.isFinite(point.threshold));
    expect(inner.map((point) => point.threshold)).toEqual([0.8, 0.75]);
  });
});
