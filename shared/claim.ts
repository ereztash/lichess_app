/**
 * LAYER B -- CLAIMS ABOUT THE PLAYER (section 3.3).
 *
 * Derived from Layer A only. Graded, refutable, never certain.
 *
 * The central rule: a claim NEVER moves to 'replicated' from more retrospective data. More of
 * the same data that produced a hypothesis cannot confirm it. Only a forward test can.
 *
 * That rule is enforced in the TYPE SYSTEM, not by convention. `evaluateClaim` accepts a
 * ProspectiveDrillResult and nothing else. Retrospective evidence and external pointers carry
 * different `kind` discriminants, so passing either is a compile error rather than a code-review
 * question. GATE-EXTERNAL's positive control is exactly that: a file that attempts it and must
 * fail to compile.
 */

export const CLAIM_GRADES = ["hypothesis", "replicated", "refuted"] as const;
export type ClaimGrade = (typeof CLAIM_GRADES)[number];

/** How a grade may be spoken about. A hypothesis is never given the word for a finding. */
export const GRADE_WORD: Record<ClaimGrade, { he: string; en: string }> = {
  hypothesis: { he: "השערה", en: "hypothesis" },
  replicated: { he: "שוחזר", en: "replicated" },
  refuted: { he: "הופרך", en: "refuted" },
};

/**
 * Evidence gathered BEFORE the claim existed. It can form a hypothesis. It can never raise one.
 */
export interface RetrospectiveEvidence {
  readonly kind: "retrospective";
  decision_ids: string[];
}

/**
 * The result of a drill that ran AFTER the claim was formed, and that the claim could have
 * failed. This is the only thing that may change a grade.
 */
export interface ProspectiveDrillResult {
  readonly kind: "prospective_drill_result";
  drill_id: string;
  claim_id: string;
  /** Decisions recorded during the drill. All postdate the claim by construction. */
  decision_ids: string[];
  /** What the claim predicted would happen. Stored before the drill ran (R5). */
  predicted: boolean;
  /** What actually happened. */
  observed: boolean;
  recorded_at: string;
}

/**
 * LAYER C output (section 3.4). External evidence POINTS; it never promotes.
 *
 * `promotes_grade` is the literal type `false`, not `boolean`, so no value of this type can ever
 * claim otherwise. The claim-update function has no overload accepting it.
 */
export interface ExternalPointer {
  readonly kind: "pointer";
  readonly promotes_grade: false;
  suggested_next_question: string;
  suggested_drill: DrillSpec | null;
  sources: { origin: string; n?: number; depth?: number }[];
}

export interface DrillSpec {
  drill_id: string;
  claim_id: string;
  /** Positions that discriminate between the candidate explanations. */
  fens: string[];
  /**
   * What result would disprove the claim. Stored BEFORE the drill runs (R5). A drill that
   * cannot fail measures nothing.
   */
  refutation_condition: string;
}

export interface Claim {
  claim_id: string;
  statement: string;
  /** What class of decision this covers. A claim wider than its scope is a claim about nobody. */
  scope: string;
  supporting_decision_ids: string[];
  n: number;
  grade: ClaimGrade;
  refutation_condition: string;
  prospective_tests: ProspectiveDrillResult[];
  created_at: string;
  last_evaluated_at: string;
}

/**
 * Form a hypothesis. Every claim starts here, and this function cannot produce any other grade.
 * The return type says so.
 */
export function formHypothesis(input: {
  claim_id: string;
  statement: string;
  scope: string;
  evidence: RetrospectiveEvidence;
  refutation_condition: string;
  created_at: string;
}): Claim & { grade: "hypothesis" } {
  if (!input.refutation_condition.trim()) {
    // R5: a claim with nothing that would disprove it measures nothing.
    throw new Error("a claim requires a refutation condition");
  }
  return {
    claim_id: input.claim_id,
    statement: input.statement,
    scope: input.scope,
    supporting_decision_ids: [...input.evidence.decision_ids],
    n: input.evidence.decision_ids.length,
    grade: "hypothesis",
    refutation_condition: input.refutation_condition,
    prospective_tests: [],
    created_at: input.created_at,
    last_evaluated_at: input.created_at,
  };
}

/**
 * The ONLY function that may change a grade.
 *
 * It accepts a ProspectiveDrillResult and nothing else. There is deliberately no overload for
 * RetrospectiveEvidence and none for ExternalPointer -- R4 says external evidence can raise a
 * question, order a queue, or suggest a test, but never the confidence grade of a claim about
 * the player. Only the player's own prospective results can do that.
 *
 * A refuted claim is kept forever. Deleting it lets the same wrong pattern be rediscovered.
 */
export function evaluateClaim(claim: Claim, result: ProspectiveDrillResult): Claim {
  if (result.claim_id !== claim.claim_id) {
    throw new Error("drill result belongs to a different claim");
  }
  if (claim.grade === "refuted") {
    // Refutation is terminal. A refuted claim is data, not a draft to be revived.
    return { ...claim, prospective_tests: [...claim.prospective_tests, result] };
  }
  const survived = result.observed === result.predicted;
  return {
    ...claim,
    grade: survived ? "replicated" : "refuted",
    prospective_tests: [...claim.prospective_tests, result],
    last_evaluated_at: result.recorded_at,
  };
}

/**
 * Fold an external pointer into a claim. Note what it does NOT do: touch the grade.
 * It exists so the type system has somewhere honest to put pointers.
 */
export function attachPointer(
  claim: Claim,
  pointer: ExternalPointer,
): { claim: Claim; next_question: string } {
  return { claim, next_question: pointer.suggested_next_question };
}
