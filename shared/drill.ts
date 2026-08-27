/**
 * DRILLS (R5, section 3.5).
 *
 * "What a drill would disprove is written down before the drill runs. A drill that cannot fail
 * measures nothing. Report the result even when it refutes the pattern -- especially then."
 *
 * A drill is the only thing that can change a claim's grade, because it is the only evidence
 * that postdates the claim. Everything here exists to make "started without a stored refutation
 * condition" unreachable: the type requires it, and the runtime guard catches a value that
 * arrived from storage empty or null.
 */
import type { Claim, DrillSpec, ProspectiveDrillResult } from "./claim.js";
import { gapDifferenceStandardError } from "./detector.js";

export class MissingRefutationCondition extends Error {
  constructor(drillId: string) {
    super(
      `drill ${drillId} has no stored refutation condition; a drill that cannot fail measures nothing`,
    );
    this.name = "MissingRefutationCondition";
  }
}

/**
 * A claim that never recorded which direction it names, so no drill of it can be graded.
 *
 * Separate from the class above because it is a different failure with a different remedy: the
 * condition is missing PROSE, this is a missing SIGN, and `evaluateRefutation` is a one-sided
 * test that has no honest default for it. Guessing `true` is precisely the defect this class was
 * added to make unreachable -- it graded every underconfidence claim by whether the player turned
 * out overconfident, and refutation is terminal.
 */
export class MissingClaimDirection extends Error {
  constructor(claimId: string) {
    super(
      `claim ${claimId} does not record whether it predicts overconfidence; ` +
        `a one-sided refutation test cannot be graded without the side it is on`,
    );
    this.name = "MissingClaimDirection";
  }
}

/**
 * Build a drill from a claim. The refutation condition is COPIED from the claim at creation
 * time, not referenced, so editing the claim later cannot retroactively change what the drill
 * was testing. The DIRECTION travels with it, for the same reason and as one term: the stored
 * sentence says "higher" or "lower", and a verdict computed on the other sign would be reported
 * under that sentence.
 */
export function createDrill(
  claim: Claim,
  fens: string[],
  options: { drill_id: string },
): DrillSpec {
  if (!claim.refutation_condition?.trim()) {
    throw new MissingRefutationCondition(options.drill_id);
  }
  if (fens.length === 0) {
    throw new Error(`drill ${options.drill_id} has no positions to test`);
  }
  if (typeof claim.predicts_overconfidence !== "boolean") {
    // A claim stored before the direction was recorded. Refusing is the only honest exit: the
    // sign cannot be recovered later without letting the evidence pick it, and a drill graded on
    // the wrong side ends in a permanent 'refuted'.
    throw new MissingClaimDirection(claim.claim_id);
  }
  return {
    drill_id: options.drill_id,
    claim_id: claim.claim_id,
    fens: [...fens],
    refutation_condition: claim.refutation_condition,
    predicts_overconfidence: claim.predicts_overconfidence,
  };
}

export interface StartedDrill {
  readonly spec: DrillSpec;
  readonly started_at: string;
  /** What the claim predicts, fixed before any position is shown (R5). */
  readonly predicted: boolean;
}

/**
 * Start a drill. THIS IS GATE-PREREG.
 *
 * The runtime guard is not redundant with the type: a spec read back from storage, or built by
 * older code, can carry an empty string or a null that TypeScript cannot see. A drill whose
 * refutation condition is missing must not begin.
 */
export function startDrill(
  spec: DrillSpec,
  options: { predicted: boolean; started_at: string },
): StartedDrill {
  const condition = spec?.refutation_condition;
  if (typeof condition !== "string" || condition.trim().length === 0) {
    throw new MissingRefutationCondition(spec?.drill_id ?? "<unknown>");
  }
  /*
   * THE SIGN IS HALF THE PRE-REGISTERED TERM, and this check is here because it was not.
   *
   * The condition above says "if the gap is not LARGER than in the rest -- refuted" or "if it is
   * not SMALLER -- refuted". Which of the two is a fact about the claim that `evaluateRefutation`
   * reads as a sign. A spec carrying the sentence and no sign has written down half a test, and
   * the grading path used to fill the other half with a constant `true` -- so an underconfidence
   * claim was graded on whether the player turned out overconfident, and refutation is terminal.
   *
   * GATE-PREREG asked only for the sentence, which is why it passed throughout. Same guard shape
   * as the one above, and for the same reason: `createDrill` already refuses to BUILD such a
   * spec, but a spec read back from storage or written by older code can carry an absent value
   * that TypeScript cannot see.
   */
  if (typeof spec?.predicts_overconfidence !== "boolean") {
    throw new MissingClaimDirection(spec?.claim_id ?? "<unknown>");
  }
  if (!spec.fens?.length) {
    throw new Error(`drill ${spec.drill_id} has no positions to test`);
  }
  return { spec, started_at: options.started_at, predicted: options.predicted };
}

export interface DrillObservation {
  decision_id: string;
  /** Did this decision show the behaviour the claim predicts? */
  matchedPrediction: boolean;
}

/**
 * Close a drill into a prospective result.
 *
 * The observed value is a MAJORITY over the drill's decisions, and the result is returned
 * whether or not it agrees with the prediction. Reporting only confirmations is how a claim
 * that cannot fail gets manufactured after the fact.
 */
export function completeDrill(
  started: StartedDrill,
  observations: DrillObservation[],
  options: { recorded_at: string },
): ProspectiveDrillResult {
  if (observations.length === 0) {
    throw new Error(`drill ${started.spec.drill_id} recorded no decisions`);
  }
  const matched = observations.filter((o) => o.matchedPrediction).length;
  const observed = matched * 2 > observations.length;
  return {
    kind: "prospective_drill_result",
    drill_id: started.spec.drill_id,
    claim_id: started.spec.claim_id,
    decision_ids: observations.map((o) => o.decision_id),
    predicted: started.predicted,
    observed,
    recorded_at: options.recorded_at,
  };
}

/** How the result reads, refutation included. Section 3.5: report either way. */
export function describeResult(result: ProspectiveDrillResult): string {
  const n = result.decision_ids.length;
  return result.observed === result.predicted
    ? `הדריל אישר את ההשערה על ${n} החלטות חדשות. היא עוברת ל"שוחזר" — היא יכלה להיכשל כאן ולא נכשלה.`
    : `הדריל הפריך את ההשערה על ${n} החלטות חדשות. היא עוברת ל"הופרך" ונשמרת לתמיד, כדי שאותו דפוס שגוי לא יתגלה מחדש.`;
}

/**
 * The per-decision calibration gap: stated confidence minus realised accuracy.
 *
 * Same quantity the detector aggregates, evaluated on one decision. Positive means the player
 * was more confident than the result justified.
 */
export function decisionGap(normalisedConfidence: number, accurate: boolean): number {
  return normalisedConfidence - (accurate ? 1 : 0);
}

export interface DrillDecision {
  decision_id: string;
  /** Stated confidence, 0..1. */
  confidence: number;
  accurate: boolean;
}

export interface RefutationVerdict {
  observed: boolean;
  drillGap: number;
  baselineGap: number;
  gapDifference: number;
  /**
   * The sampling error of `gapDifference`, or null when it could not be computed -- fewer than
   * two decisions on a side, or no variation on either. See the note on drill length below: at
   * the shipped 5-8 positions this number is large, and it is the honest reason most drills
   * cannot confirm anything.
   */
  standardError: number | null;
  n: number;
}

/**
 * Test the claim against the condition it actually stored.
 *
 * The refutation condition reads: "if the gap between stated confidence and realised accuracy is
 * NOT larger than in the rest of your decisions -- refuted". So that is what is measured here:
 * the drill's mean gap against the baseline, in the predicted direction.
 *
 * SEPARABLY LARGER, not larger by a fixed amount, and that is the fix. This used to require the
 * drill's gap to exceed the baseline by `minGapDifference` -- 0.45, the detector's old floor --
 * which carries the detector's own defect into the arm that decides a GRADE. Measured against a
 * baseline of 200 decisions, 2000 runs per cell, on a claim that is TRUE with the effect
 * reproduced exactly in the drill, and on a TRUE null where the drill matches the baseline:
 *
 *     claim TRUE, confirmed      n=5     n=8    n=12    n=20    n=40    n=80
 *       fixed 0.45             22.1%   14.8%    9.3%    4.5%    1.0%    0.1%
 *       separable k=3.00        7.6%   10.8%   13.0%   23.1%   46.9%   78.1%
 *
 *     claim FALSE, confirmed     n=5     n=8    n=12    n=20    n=40    n=80
 *       fixed 0.45              2.1%    0.4%    0.1%    0.0%    0.0%    0.0%
 *       separable k=3.00        2.1%    1.6%    0.8%    0.4%    0.3%    0.7%
 *
 * SAID PLAINLY, because the first row does not read the way the change wants it to: at five
 * positions the fixed bar really is more sensitive, at the same false-confirmation rate. The two
 * cross at about twelve, and past that the old rule collapses -- at eighty positions it confirms
 * a true claim one time in a thousand. A LONGER DRILL MADE THE PRODUCT LESS LIKELY TO BELIEVE A
 * CLAIM THAT WAS TRUE, which is the detector's defect in the arm where it costs a grade.
 *
 * WHAT THIS DOES NOT FIX, and it is measured rather than argued: at the shipped drill length of
 * MIN/MAX_DRILL_POSITIONS = 5..8, NEITHER rule has usable power -- 7.6% to 22.1% on a claim that
 * is true. A drill that short cannot separate a coaching-scale effect from its own sampling
 * error, so `observed: false` conflates "the drill refuted this" with "the drill could not have
 * confirmed it". The verdict now carries `standardError` so a caller can tell those apart;
 * distinguishing them in the stored GRADE needs a third state in a persisted field, and making a
 * drill long enough to decide anything is a question about how many positions a player is asked
 * to play. Both are recorded in docs/MEASUREMENTS.md rather than decided here.
 *
 * This is deliberately NOT completeDrill's majority-of-matches rule. A drill that writes down one
 * condition and tests another has not pre-registered anything, which is the whole of R5. The
 * majority rule remains available for claims whose condition really is per-decision; this claim
 * type's condition is an aggregate comparison, so it gets an aggregate test.
 */
export function evaluateRefutation(
  decisions: DrillDecision[],
  options: {
    /**
     * The rest of the record, as a summary rather than a bare number.
     *
     * It used to be `baselineGap: number`, which forced the comparison to treat the baseline as
     * exactly known. It is not -- it is an estimate from a finite sample, with its own error, and
     * a test that ignores it is too permissive by exactly that much.
     */
    baseline: { gap: number; gapVariance: number; n: number };
    predictsOverconfidence: boolean;
    /** How many standard errors of the difference the drill must clear. One pre-named test. */
    separabilityK: number;
  },
): RefutationVerdict {
  if (decisions.length === 0) {
    throw new Error("cannot evaluate a refutation condition against zero decisions");
  }
  const gaps = decisions.map((d) => decisionGap(d.confidence, d.accurate));
  const drillGap = gaps.reduce((total, g) => total + g, 0) / gaps.length;
  const gapVariance =
    gaps.length < 2
      ? 0
      : gaps.reduce((total, g) => total + (g - drillGap) ** 2, 0) / (gaps.length - 1);
  const standardError = gapDifferenceStandardError(
    { n: gaps.length, gapVariance },
    options.baseline,
  );
  const gapDifference = drillGap - options.baseline.gap;
  const directional = options.predictsOverconfidence ? gapDifference : -gapDifference;
  return {
    // A drill that cannot produce a standard error has not observed anything, in either
    // direction. It must not read as a confirmation.
    observed: standardError !== null && directional >= options.separabilityK * standardError,
    drillGap,
    baselineGap: options.baseline.gap,
    gapDifference,
    standardError,
    n: decisions.length,
  };
}

/**
 * Close a drill using the stored refutation condition rather than a majority vote.
 *
 * Returns the result whether or not it agrees with the prediction. Reporting only confirmations
 * is how a claim that cannot fail gets manufactured after the fact.
 */
export function completeDrillAgainstBaseline(
  started: StartedDrill,
  decisions: DrillDecision[],
  verdict: RefutationVerdict,
  options: { recorded_at: string },
): ProspectiveDrillResult {
  if (decisions.length === 0) {
    throw new Error(`drill ${started.spec.drill_id} recorded no decisions`);
  }
  return {
    kind: "prospective_drill_result",
    drill_id: started.spec.drill_id,
    claim_id: started.spec.claim_id,
    decision_ids: decisions.map((d) => d.decision_id),
    predicted: started.predicted,
    observed: verdict.observed,
    recorded_at: options.recorded_at,
  };
}
