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
import { MIN_BUCKET_N, SEPARABILITY_K, type ScoredDecision } from "./detector.js";

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
   * The standard error of the area, by Hanley-McNeil, or null where no area exists.
   *
   * CARRIED BECAUSE THE AREA ALONE IS NOT A FINDING. The panel puts two things beside this figure
   * -- the sentence "0.5 זה מקריות", which invites a comparison against chance, and the middle
   * 80% of matched people from the Confidence Database, which invites a placement inside it.
   * Neither is readable without knowing how much of the figure is sampling noise.
   *
   * Measured: with confidence drawn INDEPENDENTLY of the outcome -- true area exactly 0.5 -- a
   * figure appeared on 100% of records, and landed 0.10 or more from chance on 18% of them at
   * MIN_BUCKET_N per class. Nearly one chance-level player in five.
   *
   * HANLEY-McNEIL RATHER THAN A BINOMIAL ERROR. This is a rank statistic over PAIRS, and its
   * precision is governed by the smaller class: 200 accurate decisions beside 30 inaccurate ones
   * is not the precision of 115 and 115, and an estimator on the total would say it was.
   */
  standardError: number | null;
  /**
   * Why the cell is empty, when it is -- and each of these carries different advice.
   *
   * `too-few-inaccurate` means this player needs harder positions, not simply more of them;
   * `too-few-accurate` is the mirror. `inside-noise` is neither: there were enough of both, the
   * area WAS computed, and it came out indistinguishable from chance.
   */
  reason:
    | "ok"
    | "too-few-accurate"
    | "too-few-inaccurate"
    | "too-few-both"
    | "inside-noise"
    | null;
  /**
   * Whether the area is a statement about this player rather than about this sample.
   *
   * Enough of BOTH outcomes is necessary and was previously sufficient. Not total n: a record of
   * two hundred decisions with four inaccurate ones estimates the false alarm rate from four
   * points, and the curve is then a description of those four.
   */
  readable: boolean;
}

const EMPTY: Sensitivity = {
  n: 0,
  split: [0, 0],
  auroc2: null,
  curve: [],
  standardError: null,
  reason: null,
  readable: false,
};

/**
 * The standard error of an area under an ROC curve (Hanley & McNeil, 1982).
 *
 * `Q1` and `Q2` are the probabilities that two randomly drawn members of the same class are both
 * ranked below a member of the other -- the terms that make this an estimator for a rank
 * statistic rather than for a proportion.
 */
function areaStandardError(area: number, positives: number, negatives: number): number | null {
  if (positives < 2 || negatives < 2) return null;
  /*
   * CLAMPED TO ONE PAIR OFF THE BOUNDARY, and the clamp is not a fudge factor.
   *
   * The formula degenerates at 0 and 1: perfect separation gives a variance of exactly ZERO, and
   * a first version of this returned null there and called it unreadable -- reporting the
   * strongest evidence the statistic can produce as no evidence at all. An existing fixture,
   * thirty confident hits against thirty diffident misses, went red and was right to.
   *
   * The bound is the granularity of the statistic itself rather than a chosen epsilon: over
   * `positives * negatives` pairs the area can only move in steps of `1 / (positives *
   * negatives)`, so an estimate at the boundary is treated as carrying the error of the nearest
   * value the statistic could actually distinguish from it.
   */
  const step = 1 / (positives * negatives);
  const a = Math.max(step, Math.min(1 - step, area));
  const q1 = a / (2 - a);
  const q2 = (2 * a * a) / (1 + a);
  const variance =
    (a * (1 - a) + (positives - 1) * (q1 - a * a) + (negatives - 1) * (q2 - a * a)) /
    (positives * negatives);
  // Rounding can still carry the bracket a hair below zero; a negative variance is not a small
  // error, it is not a variance, and NaN out of a sqrt would be worse than null.
  return variance > 0 ? Math.sqrt(variance) : null;
}

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
    /*
     * No curve exists with only one kind of outcome -- but the CELL still has to say which kind is
     * missing. This used to fall through to `EMPTY`'s `reason: null`, so a record of thirty
     * decisions that all went well produced a dash with nothing behind it, which is the same
     * silence as a record of none.
     */
    return {
      ...EMPTY,
      n: decisions.length,
      split,
      reason: accurate.length === 0 ? "too-few-accurate" : "too-few-inaccurate",
    };
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

  const enoughAccurate = accurate.length >= MIN_BUCKET_N;
  const enoughInaccurate = inaccurate.length >= MIN_BUCKET_N;
  const standardError = areaStandardError(area, accurate.length, inaccurate.length);
  /*
   * THE BAR IS THE DETECTOR'S OWN, reused for the third time and for the same reason: the panel
   * must not hold itself to different standards cell by cell, and a constant chosen here would be
   * one picked to make this figure appear. Measured against 0.5, because chance is what the note
   * beside the number invites the reader to compare it to.
   */
  const separated =
    standardError !== null && Math.abs(area - 0.5) >= SEPARABILITY_K * standardError;
  const readable = enoughAccurate && enoughInaccurate && separated;
  return {
    n: decisions.length,
    split,
    auroc2: area,
    curve,
    standardError,
    reason: readable
      ? "ok"
      : !enoughAccurate && !enoughInaccurate
        ? "too-few-both"
        : !enoughAccurate
          ? "too-few-accurate"
          : !enoughInaccurate
            ? "too-few-inaccurate"
            : "inside-noise",
    readable,
  };
}
