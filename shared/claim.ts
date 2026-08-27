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
  /**
   * The direction the condition above is written in, copied from the claim when the drill starts.
   *
   * IT IS COPIED RATHER THAN LOOKED UP, for the reason `refutation_condition` is copied: the terms
   * of the test are fixed before the first position is shown, and reading them off the claim at
   * grading time would let a claim edited in between change what the drill was. The sentence and
   * the sign are one term, so they are pinned together or the sentence describes a test that was
   * not run.
   */
  predicts_overconfidence: boolean;
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
  /**
   * WHICH DIRECTION THE CLAIM NAMES: true for "more confident than the results justify", false for
   * less. Measured by `detect` (shared/detector.ts) as `gapDifference > 0`.
   *
   * IT IS STORED BECAUSE THE VERDICT IS A SIGNED TEST AND NOTHING ELSE CARRIES THE SIGN. It used
   * to be computed, spent on the two sentences in claim-derivation.ts, and dropped -- so
   * `finishDrill` had nothing to read and passed the constant `true` to `evaluateRefutation`,
   * whose `directional = predictsOverconfidence ? gapDifference : -gapDifference` is the entire
   * grading rule. An underconfidence claim was therefore graded by whether the player turned out
   * OVERconfident. A player who behaved exactly as the claim described refuted it, permanently,
   * on the ordinary path with nothing failing. `shared/bucket-variable.ts` records that this is
   * the common direction, not the rare one: of 78 mirror claims, 78 were underconfidence.
   *
   * NULL MEANS A CLAIM WRITTEN BEFORE THIS WAS RECORDED, and it is not a third direction. The
   * direction cannot be recovered afterwards -- re-deriving it from today's record would let the
   * evidence choose the test's sign, which is the post-hoc choice R5 exists to forbid, and
   * reading it back out of the Hebrew statement would rebuild the same prose-carries-the-fact
   * coupling that caused this. So `createDrill` refuses such a claim rather than guessing, the
   * way it already refuses one with no refutation condition.
   */
  predicts_overconfidence: boolean | null;
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
  predicts_overconfidence: boolean;
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
    predicts_overconfidence: input.predicts_overconfidence,
    prospective_tests: [],
    created_at: input.created_at,
    last_evaluated_at: input.created_at,
  };
}

/**
 * The ONLY function that may change a grade.
 *
 * It accepts ProspectiveDrillResults and nothing else. There is deliberately no overload for
 * RetrospectiveEvidence and none for ExternalPointer -- R4 says external evidence can raise a
 * question, order a queue, or suggest a test, but never the confidence grade of a claim about
 * the player. Only the player's own prospective results can do that. Taking an ARRAY of them
 * rather than one narrows nothing: the element type is still the discriminant that GATE-EXTERNAL's
 * positive control fails to compile against.
 *
 * A refuted claim is kept forever. Deleting it lets the same wrong pattern be rediscovered.
 *
 * THE GRADE IS DERIVED FROM THE DRILL RESULTS, NOT ACCUMULATED ONTO THE CLAIM.
 *
 * This took one result and stepped the claim forward from wherever it stood. That made the grade
 * an accumulator whose correctness depended on every result having been folded in exactly once --
 * across two separate writes, in two stores, neither of which has a transaction. It is the same
 * shape that cost a learning rule its grade in cycle 31, and it was worse here: `finishDrill` had
 * no idempotent replay branch at all, and `saveDrillResult` is append-only in both stores, so the
 * retry a lost response makes inevitable raised rather than recovering. The verdict became
 * unreachable, permanently, on the path the product exists to run.
 *
 * A fold over the whole result set has no such state. Run it once or five times, before the crash
 * or after it, and the same record produces the same claim -- so the retry repairs rather than
 * freezes.
 *
 * NOTHING NEW HAD TO BE STORED FOR THIS. Both `getClaim` implementations already build
 * `prospective_tests` by reading the `drill_results` rows rather than from a column on the claim,
 * so the evidence to fold over was already being handed to every caller.
 *
 * The per-result rules are unchanged and are in `applyDrillResult` below, including the one that
 * matters most: refutation is terminal within the sequence.
 */
export function evaluateClaim(claim: Claim, results: ProspectiveDrillResult[]): Claim {
  /*
   * Ordered by when the drill was reported, because the fold reproduces the sequence the drills
   * happened in and `refuted` is terminal within it. Ties break on the drill id so the ordering is
   * total: two results stamped the same instant must not grade differently depending on row order.
   */
  const ordered = [...results].sort(
    (a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.drill_id.localeCompare(b.drill_id),
  );
  // The claim as formed. `formHypothesis` cannot produce any other grade, and a claim with no
  // forward test behind it has been evaluated exactly as recently as it was written.
  let folded: Claim = {
    ...claim,
    grade: "hypothesis",
    prospective_tests: [],
    last_evaluated_at: claim.created_at,
  };
  for (const result of ordered) folded = applyDrillResult(folded, result);
  return folded;
}

function applyDrillResult(claim: Claim, result: ProspectiveDrillResult): Claim {
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
