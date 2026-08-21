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
import type { Claim, DrillSpec, ProspectiveDrillResult } from "./claim";

export class MissingRefutationCondition extends Error {
  constructor(drillId: string) {
    super(
      `drill ${drillId} has no stored refutation condition; a drill that cannot fail measures nothing`,
    );
    this.name = "MissingRefutationCondition";
  }
}

/**
 * Build a drill from a claim. The refutation condition is COPIED from the claim at creation
 * time, not referenced, so editing the claim later cannot retroactively change what the drill
 * was testing.
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
  return {
    drill_id: options.drill_id,
    claim_id: claim.claim_id,
    fens: [...fens],
    refutation_condition: claim.refutation_condition,
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
