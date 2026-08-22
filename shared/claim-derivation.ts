/**
 * Turning a candidate pattern (Layer A statistics) into a claim (Layer B).
 *
 * Every claim produced here is a HYPOTHESIS. That is not a hedge -- it is the only grade
 * retrospective data can support. Nothing in this file can produce 'replicated'; the return type
 * says so, and the only function that raises a grade lives in claim.ts and accepts a prospective
 * drill result exclusively.
 *
 * The statement is assembled from measured quantities. It carries its n, it names its scope, and
 * it states in advance what would refute it. A sentence that cannot do all four is not written.
 */
import type { Claim, RetrospectiveEvidence } from "./claim.js";
import { formHypothesis } from "./claim.js";
import type { CandidatePattern } from "./detector.js";

/**
 * The unit of output is ONE claim (section 3.5). If the system has three candidates it shows the
 * one with the most supporting decisions and says the other two exist. Showing everything is how
 * the player ends up changing nothing.
 */
export interface ClaimSelection {
  claim: Claim & { grade: "hypothesis" };
  /** How many other candidates were found and deliberately not shown. */
  othersWithheld: number;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * What the claim says. Built from the numbers, not from a template with the numbers dropped in:
 * change the measurement and the sentence changes shape, not just its digits.
 */
export function statementFor(pattern: CandidatePattern): string {
  const { scope, inside, outside } = pattern;
  const direction = pattern.predicts_overconfidence
    ? "גבוה יותר ממה שהתוצאות מצדיקות"
    : "נמוך יותר ממה שהתוצאות מצדיקות";
  return (
    `ב-${scope} (${inside.n} החלטות) הביטחון שלך ${direction}: ` +
    `ביטחון ממוצע ${pct(inside.meanConfidence)} מול דיוק ${pct(inside.accuracyRate)}. ` +
    `בשאר ההחלטות (${outside.n}) הפער קטן בהרבה — ` +
    `ביטחון ${pct(outside.meanConfidence)} מול דיוק ${pct(outside.accuracyRate)}.`
  );
}

/**
 * What would disprove this, written down BEFORE any drill runs (R5).
 *
 * A claim that predicts nothing specific cannot fail, and a claim that cannot fail measures
 * nothing. This states the observable outcome that would refute it.
 */
export function refutationConditionFor(pattern: CandidatePattern): string {
  return pattern.predicts_overconfidence
    ? `בדריל של עמדות מ-${pattern.scope}, אם הפער בין הביטחון המוצהר לדיוק בפועל לא יהיה גדול יותר מאשר בשאר ההחלטות — ההשערה הופרכה.`
    : `בדריל של עמדות מ-${pattern.scope}, אם הביטחון המוצהר לא יהיה נמוך מהדיוק בפועל יותר מאשר בשאר ההחלטות — ההשערה הופרכה.`;
}

export function deriveClaim(
  pattern: CandidatePattern,
  options: { claim_id: string; created_at: string },
): Claim & { grade: "hypothesis" } {
  const evidence: RetrospectiveEvidence = {
    kind: "retrospective",
    decision_ids: pattern.supporting_decision_ids,
  };
  return formHypothesis({
    claim_id: options.claim_id,
    statement: statementFor(pattern),
    scope: pattern.scope,
    evidence,
    refutation_condition: refutationConditionFor(pattern),
    created_at: options.created_at,
  });
}

/** Select the single claim to show, and count what is being withheld. */
export function selectClaim(
  patterns: CandidatePattern[],
  options: { claim_id: string; created_at: string },
): ClaimSelection | null {
  if (patterns.length === 0) return null;
  return {
    claim: deriveClaim(patterns[0], options),
    othersWithheld: patterns.length - 1,
  };
}
