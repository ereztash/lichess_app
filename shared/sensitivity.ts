/**
 * Metacognitive sensitivity -- can the player tell their good decisions from their bad ones?
 *
 * A DIFFERENT QUESTION FROM CALIBRATION, and the difference is the reason this file exists. A
 * player who says "certain" about everything and is right 70% of the time has a calibration error
 * of 25 points and is useless as a judge of themselves. A player who says "certain" about
 * everything they get right and "guess" about everything they get wrong has the SAME systematic
 * bias and is a perfect judge of themselves. Calibration cannot tell those two apart. This can.
 *
 * The measure is the area under the Type-2 ROC curve. For each threshold on the confidence scale:
 *
 *     hit rate   = P(confidence >= threshold | the decision was accurate)
 *     false alarm= P(confidence >= threshold | the decision was not)
 *
 * Sweep the thresholds, plot one against the other, take the area. 0.5 is chance -- confidence
 * carries no information about correctness. 1.0 would mean every accurate decision was stated
 * more confidently than every inaccurate one.
 *
 * WHY THIS ONE AND NOT META-D-PRIME, which is what the field reaches for first. `meta-d'` is
 * defined against a Type-1 signal detection model: it asks how much of the evidence available to
 * the first-order decision the confidence rating actually used, and to do that it needs `d'`,
 * which needs a BINARY first-order task with signal-present and signal-absent trials. Choosing a
 * move from thirty legal options is not that, and there is no honest way to force it into the
 * shape. AUROC2 needs no such model -- it reads confidence and outcome and nothing else.
 *
 * WHAT AUROC2 GIVES UP for that, stated because it is the standard criticism and it is fair: it
 * is not independent of first-order performance. A player who is very good or very bad at chess
 * has a skewed base rate, and that constrains the curve. `meta-d'/d'` exists precisely to remove
 * that, and it is unavailable here. THE ANCHOR SET IS THIS INSTRUMENT'S ANSWER TO THE SAME
 * PROBLEM, by a different route: hold the items fixed and the constraint is identical for
 * everybody, so what differs between two players is not the difficulty they faced.
 */
import { MIN_BUCKET_N, type ScoredDecision } from "./detector.js";

export interface Sensitivity {
  n: number;
  /** Accurate and inaccurate decisions. The curve needs both; either at zero and there is no curve. */
  split: [accurate: number, inaccurate: number];
  /**
   * Area under the Type-2 ROC curve, or null when it is not defined.
   *
   * 0.5 is chance. Below 0.5 is worse than chance and is a real finding rather than an error: it
   * means the player is systematically MORE confident about the decisions they get wrong.
   */
  auroc2: number | null;
  /** The curve itself, so a caller can draw it rather than trust a single number. */
  curve: { threshold: number; hitRate: number; falseAlarmRate: number }[];
  /**
   * Whether there are enough of BOTH outcomes for the area to mean anything.
   *
   * Not total n: a record of two hundred decisions with four inaccurate ones estimates the false
   * alarm rate from four points, and the curve is then a description of those four.
   */
  readable: boolean;
}

const EMPTY: Sensitivity = { n: 0, split: [0, 0], auroc2: null, curve: [], readable: false };

/**
 * How well confidence separated the accurate decisions from the inaccurate ones.
 *
 * Independent of bias by construction: shifting every stated confidence up or down by the same
 * amount moves the thresholds with it and leaves the area unchanged. That is the whole point --
 * it isolates the half of metacognition that calibration cannot see.
 */
export function metacognitiveSensitivity(decisions: readonly ScoredDecision[]): Sensitivity {
  if (decisions.length === 0) return EMPTY;

  const accurate = decisions.filter((d) => d.accurate).map((d) => d.confidence);
  const inaccurate = decisions.filter((d) => !d.accurate).map((d) => d.confidence);
  const split: [number, number] = [accurate.length, inaccurate.length];
  if (accurate.length === 0 || inaccurate.length === 0) {
    return { ...EMPTY, n: decisions.length, split };
  }

  /*
   * Thresholds are the confidence values actually used, not the scale's levels. A record can hold
   * decisions stated on more than one scale, and a threshold nobody's confidence can reach adds a
   * duplicate point to the curve rather than information.
   */
  const thresholds = [...new Set(decisions.map((d) => d.confidence))].sort((a, b) => b - a);
  const rate = (values: number[], threshold: number) =>
    values.filter((value) => value >= threshold).length / values.length;

  /*
   * (0,0) opens the curve. The far corner needs no guard: the lowest threshold IS the lowest
   * confidence in the record, so every decision clears it and both rates are 1 there by
   * construction. A closing `push` guarded on `hitRate < 1` was written here first and was dead
   * code -- the condition can never be true -- which a positive control found by deleting it and
   * watching nothing fail.
   */
  const curve = [
    { threshold: Number.POSITIVE_INFINITY, hitRate: 0, falseAlarmRate: 0 },
    ...thresholds.map((threshold) => ({
      threshold,
      hitRate: rate(accurate, threshold),
      falseAlarmRate: rate(inaccurate, threshold),
    })),
  ];

  /*
   * Trapezoid rule. Ties matter and the trapezoid is how they are handled: when several decisions
   * share a confidence value the curve steps diagonally rather than in a staircase, and the
   * diagonal is exactly the "half credit for a tie" that the rank-based definition of this area
   * gives. Summing rectangles instead would quietly penalise a coarse scale.
   */
  let area = 0;
  for (let i = 1; i < curve.length; i += 1) {
    const width = curve[i].falseAlarmRate - curve[i - 1].falseAlarmRate;
    area += (width * (curve[i].hitRate + curve[i - 1].hitRate)) / 2;
  }

  return {
    n: decisions.length,
    split,
    auroc2: area,
    curve,
    readable: accurate.length >= MIN_BUCKET_N && inaccurate.length >= MIN_BUCKET_N,
  };
}
