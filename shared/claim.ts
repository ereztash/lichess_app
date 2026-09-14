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

import {
  decidesClaim,
  requiredProtocolFor,
  LEGACY_VALIDATION,
  type ValidationKey,
} from "./claim-grade-protocol.js";
import type { ProtocolKind } from "./validation-protocol.js";

/**
 * `retired` IS THE ONE THAT IS NOT A READING OF THE EVIDENCE, and it is here because the player's
 * own hypotheses have had it from the beginning and the instrument's have not.
 *
 * `LEARNING_RULE_GRADES` is `["hypothesis", "replicated", "refuted", "retired"]`, and
 * `learning-record.ts` says what the fourth is for: *"an act of the player's, not a reading of the
 * evidence -- so it is checked before the fold and never rebuilt by it."* A rule the player retires
 * leaves the queue; `preregisterLearningTransfer` throws on it; `saveLearningRule` refuses to take
 * it back off.
 *
 * A CLAIM HAD NO SUCH EXIT. `awaitsForwardTest` is a pure function of the claim layer's
 * `candidate`, so `deriveNextAction` proposed `test-claim` on every derivation until a DRILL graded
 * the claim -- which means a question the player did not want could only be got rid of by answering
 * it. The module that derives the proposal already forbids exactly this shape for the other field
 * it carries: *"An event the product keeps re-offering is not a next action, it is a nag."*
 * `unseenEvent` got that protection and `claimState` did not. See `docs/decisions/D29-question-ownership.md`.
 *
 * IT IS TERMINAL FOR PROPOSALS AND NOT FOR TRUTH. Nothing about the evidence changes: `n`,
 * `supporting_decision_ids`, `statement` and `scope` are untouched, and the separation the detector
 * found is exactly as strong as it was. What ends is the asking.
 */
export const CLAIM_GRADES = ["hypothesis", "replicated", "refuted", "retired"] as const;
export type ClaimGrade = (typeof CLAIM_GRADES)[number];

/**
 * How a grade may be spoken about. A hypothesis is never given the word for a finding.
 *
 * `retired` MUST NOT BE SPEAKABLE AS `refuted`, and this table is the only place that can go wrong.
 * One is a verdict the evidence produced; the other is a sentence the evidence never spoke. The
 * words are chosen so that neither could be mistaken for the other by a reader who knows no English
 * -- `הופרך` says something was shown false, `הוסר מהתור` says something left the queue -- and
 * `tests/shared/a-question-nobody-agreed-to-answer.test.ts` holds the two apart rather than this
 * paragraph.
 */
export const GRADE_WORD: Record<ClaimGrade, { he: string; en: string }> = {
  hypothesis: { he: "השערה", en: "hypothesis" },
  replicated: { he: "שוחזר", en: "replicated" },
  refuted: { he: "הופרך", en: "refuted" },
  retired: { he: "הוסר מהתור", en: "retired" },
};

/** Grades that end the asking. `refuted` ends it with a verdict; `retired` ends it without one. */
export function closedToProposal(grade: ClaimGrade): boolean {
  return grade === "refuted" || grade === "retired" || grade === "replicated";
}

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
  /**
   * The protocol this forward test ran under, stored on the result rather than inferred later.
   *
   * INFERRING IT AT READ TIME WOULD ANSWER FOR TODAY'S RULE, NOT THE ONE THE TEST RAN UNDER, which
   * is the whole failure `reveal_timing` and `measurement_protocol` were added to prevent. A drill
   * reported before this field existed carries `LEGACY_VALIDATION`, which is not a protocol and is
   * not backfilled to one.
   */
  protocol: ValidationKey;
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
  /**
   * Which protocol produced the grade above, or null while the claim is still a hypothesis.
   *
   * DERIVED BY `evaluateClaim` ALONGSIDE THE GRADE AND NEVER STORED SEPARATELY, for the reason the
   * grade itself is derived: two fields written by two writes are two chances to disagree, and a
   * claim reading `replicated` under a protocol that did not produce it is worse than either field
   * alone being wrong.
   */
  graded_under: ValidationKey | null;
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
    graded_under: null,
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
   * A RETIRED CLAIM IS RETURNED UNCHANGED, AND THE CHECK HAS TO BE HERE RATHER THAN ANYWHERE LATER.
   *
   * The fold below opens by resetting the grade to `hypothesis` and replaying the results, which is
   * what makes it idempotent and what makes it safe to run on a hot path. It is also what would
   * silently un-retire a claim on the next read: the grade is not derivable from the results,
   * because no result produced it. Same guard, same position and same reason as
   * `gradeLearningRule`, which says it in one line: *"`retired` is the one thing not derivable this
   * way -- it is an act of the player's, not a reading of the evidence -- so it is checked before
   * the fold and never rebuilt by it."*
   */
  if (claim.grade === "retired") return claim;
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
    graded_under: null,
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
  const append = (next: Partial<Claim> = {}): Claim => ({
    ...claim,
    ...next,
    prospective_tests: [...claim.prospective_tests, result],
  });

  /*
   * WHETHER THE STANDING GRADE WAS REACHED BY A PROTOCOL ENTITLED TO REACH IT (ADR-003).
   *
   * `decidesClaim` is asked about the protocol the STANDING grade came from, not about today's
   * requirement for this bucket, so the answer is a fact about how this claim was actually graded.
   */
  const standingDecided =
    claim.graded_under !== null && decidesClaim(claim.graded_under, claim.claim_id);

  if (claim.grade === "refuted" && standingDecided) {
    // Refutation is terminal. A refuted claim is data, not a draft to be revived.
    return append();
  }

  /*
   * A RESULT THAT ARRIVES AFTER THE PLAYER RETIRED THE QUESTION IS RECORDED AND DOES NOT GRADE.
   *
   * `evaluateClaim` already returns a retired claim before reaching the fold, so this is the
   * narrower case: a drill that was in flight when the question was retired, whose result lands
   * afterwards. Discarding it would lose a measurement somebody actually produced; letting it grade
   * would let the instrument answer a question the player had withdrawn. Appending without grading
   * is the only option that loses neither.
   */
  if (claim.grade === "retired") return append();

  /*
   * AN OFF-PROTOCOL RESULT MAY NOT OVERWRITE A VERDICT REACHED ON PROTOCOL. A timed holdout has
   * measured the claim under the conditions it is about; a later clockless drill has not, and
   * letting it speak last would let the weaker evidence be the one on screen.
   */
  if (standingDecided && !decidesClaim(result.protocol, claim.claim_id)) return append();

  const survived = result.observed === result.predicted;
  return append({
    grade: survived ? "replicated" : "refuted",
    graded_under: result.protocol,
    last_evaluated_at: result.recorded_at,
  });
}

/**
 * Whether this claim's grade may be spoken as a finished verdict, or only as what one protocol saw.
 *
 * THE RENDER PATH NEEDS THIS AND THE GRADE ALONE CANNOT ANSWER IT. `replicated` reached by a
 * position drill on a claim about the clock is a real measurement of something -- it is not a
 * measurement of the thing the claim says, and a screen that prints the same word for both has
 * told the player the drill settled a question it cannot reach.
 */
export function gradeIsSettled(claim: Claim): boolean {
  if (claim.grade === "hypothesis") return false;
  /*
   * `retired` IS NEVER SETTLED, WHATEVER `graded_under` SAYS. Settled means a protocol entitled to
   * decide has decided. Retiring decided nothing; it ended the asking. A retired claim that had a
   * legacy `graded_under` on it from an earlier drill would otherwise be printed as a finished
   * verdict, which is the one confusion this grade exists to avoid.
   */
  if (claim.grade === "retired") return false;
  return claim.graded_under !== null && decidesClaim(claim.graded_under, claim.claim_id);
}

/**
 * The protocol a forward test actually ran under, when it was a protocol at all.
 *
 * Null for a hypothesis and for a legacy grade -- the second is not a protocol and must not be
 * printed as one, which is the whole reason `LEGACY_VALIDATION` is a separate key.
 */
export function testedUnder(claim: Claim): ProtocolKind | null {
  if (claim.graded_under === null || claim.graded_under === LEGACY_VALIDATION) return null;
  return claim.graded_under;
}

/**
 * The protocol that still has to speak before this claim's grade is settled, or null if none does.
 *
 * Null covers two different situations that need no distinction here: the grade is already settled,
 * or the claim is a hypothesis with no forward test behind it at all.
 */
export function awaitingProtocol(claim: Claim): ProtocolKind | null {
  // Nothing is awaited for a question the player withdrew. `gradeIsSettled` is false for it by
  // design, so without this it would report the protocol that is never going to run.
  if (claim.grade === "retired") return null;
  if (claim.grade === "hypothesis" || gradeIsSettled(claim)) return null;
  return requiredProtocolFor(claim.claim_id);
}

/**
 * The player has decided this question is not worth their effort.
 *
 * THE ONLY WRITE IN THIS MODULE THAT NO EVIDENCE JUSTIFIES, which is exactly what it is for.
 * `formHypothesis` writes what the search found and `evaluateClaim` writes what a forward test
 * showed; this writes what a person decided, and it must be impossible to read it as either of the
 * others. So it touches the grade and the evaluation timestamp and nothing else: `n`,
 * `supporting_decision_ids`, `statement`, `scope`, `refutation_condition`, `prospective_tests` and
 * `graded_under` all stand, because the evidence is exactly as strong as it was a moment ago.
 *
 * A CLAIM ALREADY CLOSED TO PROPOSAL IS RETURNED UNCHANGED rather than refused. Retiring a question
 * a forward test has already answered is not an error a caller should have to handle -- it is a
 * request to stop being asked about something nothing is asking about -- and turning it into a
 * throw would put an error path on a control whose whole purpose is to be safe to press.
 *
 * THE GUARD IS `closedToProposal` AND NOT THE TWO DECIDED GRADES, which is the difference between
 * this version and the one a test caught. Naming `replicated` and `refuted` left `retired` itself
 * out, so a second press rewrote `last_evaluated_at` -- moving the recorded moment of a decision
 * the player had already made, on a control that is pressable twice by a double tap or a second
 * tab. The idempotence S11 asks for is not a property of the caller; it belongs here.
 *
 * Mirrors `retireLearningRule`, deliberately, down to writing `last_evaluated_at`.
 */
export function retireClaim(claim: Claim, retiredAt: string): Claim {
  if (closedToProposal(claim.grade)) return claim;
  return { ...claim, grade: "retired", last_evaluated_at: retiredAt };
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
