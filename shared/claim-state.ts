/**
 * WHAT THE DECISION LANE'S ACCUMULATED EVIDENCE CURRENTLY JUSTIFIES SAYING, as one value.
 *
 * THE DEFECT THIS CLOSES, AND IT IS STRUCTURAL RATHER THAN COSMETIC. The product holds three
 * separable state layers and two of them already have a module:
 *
 *   EVENT    `shared/decision-stage.ts`   what happened in THIS decision
 *   CLAIM    -- this file --              what the accumulated evidence justifies saying
 *   JOURNEY  `shared/next-action.ts`      what is useful to do next
 *
 * The claim layer existed only as prose. `learning-journey.ts` computed a stage, a question, a
 * count and a sentence in one pass, and rendered them on the record page; nothing else could read
 * it. So `deriveNextAction` -- the layer whose entire job is what to do next -- had no input saying
 * whether anything had been found. Its own docstring says it derives from "what the record is
 * MISSING and from nothing else", and that was literally true: pending analyses, a blitz blocker,
 * two counters and an anchor shortfall. None of them moves when the instrument finally separates
 * something.
 *
 * WHICH MAKES THE LOOP A CYCLE RATHER THAN A RECURSION. Two passes through the product with
 * materially different accumulated evidence produced the same proposal, because the thing that
 * differed between them was not an input to it. `research/player-path/PRODUCT_STATE_WALK.md` found
 * the same shape from the other end: *"the only thing that moves on either counter is effort, so
 * the sole feedback a continuing player receives is a number rising."*
 *
 * THE BLITZ LANE ALREADY HAD THIS AND THE DECISION LANE DID NOT. `BlitzStanding` carries `may` and
 * a blocker taxonomy, and `deriveNextAction` branches on it. `docs/decisions/D26-primary-evidence-path.md`
 * decided that `decisions` is the long-term user-facing evidence path -- so the lane the product
 * leads with was precisely the one whose result could not change what happened next.
 *
 * WHAT THIS MODULE IS NOT. It is not a second opinion about the record. `journeyStageOf` in
 * `learning-journey.ts` states the correspondence with `JOURNEY_STAGES` once, and
 * `tests/shared/an-instrument-that-cannot-learn-from-its-own-result.test.ts` holds it in both
 * directions, so the sentence a player reads and the state a derivation reads cannot drift apart
 * without something going red.
 */
import { DISCOVERY_FLOOR } from "./detector.js";
import type { Claim } from "./claim.js";

/**
 * What the decision lane's evidence currently supports.
 *
 * A UNION AND NOT A STAGE PLUS SOME FIELDS, so a claim id cannot exist without a claim and a grade
 * cannot exist without a forward test having decided one. `shared/claim.ts` makes the same choice
 * for the same reason: `ExternalPointer.promotes_grade` is the literal type `false` rather than a
 * boolean, because a value that cannot be constructed is a rule nobody has to remember.
 */
export type ClaimState =
  /**
   * THE RECORD HAS NOT BEEN READ YET, which is not an empty record.
   *
   * `ProductState.blitzStanding` already carries this distinction with its own `null` and says why:
   * *"a derivation that treated an unread record as an unblocked one would tell a player with
   * eleven unscored games that there is nothing to do."* The same hazard one lane over.
   */
  | { readonly kind: "unread" }
  /** Below the floor. Every separation findable here would be noise, so none is looked for. */
  | { readonly kind: "accumulating"; readonly scored: number }
  /**
   * At or above the floor, and the search separated nothing.
   *
   * A RESULT AND NOT A SHORTAGE, which is the distinction the record page defends best already:
   * *"שהוא לא הפריד ביניהם לא אומר שאין מה למצוא בכם, אלא שהוא לא מצא."*
   */
  | { readonly kind: "nothing-separated"; readonly scored: number }
  /**
   * A separation was found retrospectively and no forward test has decided it.
   *
   * IT COVERS A CLAIM WITH TESTS ON IT THAT DECIDED NOTHING, not only a claim with none.
   * `applyDrillResult` leaves the grade at `hypothesis` when a result arrives under a protocol that
   * may not decide this claim, and from the player's side those two are one state: the question is
   * still open and the act that could close it is a test that could come back negative.
   */
  | { readonly kind: "candidate"; readonly claimId: string }
  /**
   * A forward test has decided it, in either direction.
   *
   * `refuted` IS NOT A FAILURE STATE AND IS NOT SEPARATED FROM `replicated` HERE. Both mean the
   * same thing to the layer that decides what to do next: this question has been asked prospectively
   * and asking it again the same way establishes nothing. What a player is TOLD about the two
   * differs, and that belongs to the surface that says it, not to this state.
   */
  | { readonly kind: "decided"; readonly claimId: string; readonly grade: "replicated" | "refuted" }
  /**
   * THE PLAYER WAS ASKED AND SAID NO, and it is a separate kind from `decided` for one reason.
   *
   * `decided` means a forward test asked the question and an answer came back. This means nobody
   * asked it, and nobody is going to, because the person whose effort it would cost decided it was
   * not worth theirs. Collapsing the two would make the layer that decides what to do next correct
   * -- both stop the proposal -- and would make every layer above it wrong, because a screen
   * reading `decided` prints a verdict and there is no verdict here.
   *
   * IT CARRIES NO GRADE, and that absence is the type saying what the state means: there is nothing
   * for a grade to hold. `claim.ts` makes the same move with `ExternalPointer.promotes_grade`
   * being the literal `false`. See `docs/decisions/D29-question-ownership.md`.
   */
  | { readonly kind: "retired"; readonly claimId: string };

export type ClaimStateKind = ClaimState["kind"];

/** Every kind as a value, so a map over the union can be checked for exhaustiveness at run time. */
export const CLAIM_STATE_KINDS = [
  "unread",
  "accumulating",
  "nothing-separated",
  "candidate",
  "decided",
  "retired",
] as const satisfies readonly ClaimStateKind[];

/**
 * What the record supports, from the view the product already fetches.
 *
 * `null` AND `undefined` BOTH MEAN UNREAD, because react-query's not-yet is `undefined` and a
 * caller with no reading at all passes `null`. Neither is an empty record and neither may be
 * flattened into one -- see the `unread` member above.
 *
 * `Pick` RATHER THAN `ClaimView`, so this module does not depend on the record service. What it
 * needs is two fields, and naming exactly those keeps a reading assembled by a test honest without
 * making it construct a claim it does not have.
 */
export function claimStateOf(
  view:
    | {
        scored: number;
        claim: Pick<Claim, "claim_id" | "grade"> | null;
      }
    | null
    | undefined,
): ClaimState {
  if (!view) return { kind: "unread" };
  const { claim } = view;
  if (claim) {
    if (claim.grade === "hypothesis") return { kind: "candidate", claimId: claim.claim_id };
    /*
     * READ BEFORE `decided`, because a retired claim is a retired HYPOTHESIS -- `retireClaim`
     * returns a replicated or refuted one unchanged -- and the remaining branch would otherwise
     * have to invent a grade for a state in which no forward test ran.
     */
    if (claim.grade === "retired") return { kind: "retired", claimId: claim.claim_id };
    return { kind: "decided", claimId: claim.claim_id, grade: claim.grade };
  }
  return view.scored >= DISCOVERY_FLOOR
    ? { kind: "nothing-separated", scored: view.scored }
    : { kind: "accumulating", scored: view.scored };
}

/**
 * Whether this state names a question a forward test could still close.
 *
 * SEPARATE FROM THE UNION because it is the one predicate two layers share: the derivation uses it
 * to rank a test above collecting more of the same evidence, and a test uses it to assert that
 * more retrospective evidence never produces it. `shared/claim.ts` states the rule this enforces:
 * *"a claim NEVER moves to 'replicated' from more retrospective data."* The converse belongs here:
 * a state that is already decided never proposes the test that decided it.
 */
export function awaitsForwardTest(state: ClaimState): state is Extract<ClaimState, { kind: "candidate" }> {
  return state.kind === "candidate";
}

/**
 * Whether a question stopped being proposed because a person said so rather than because evidence
 * answered it.
 *
 * IT EXISTS SO THAT "THE DERIVATION IS SILENT" AND "THE QUESTION WAS SETTLED" CANNOT BE READ AS ONE
 * FACT. `awaitsForwardTest` is false for `decided` and for `retired` alike, which is correct for
 * the layer that ranks actions and is wrong for anything that explains itself: a surface that says
 * "this has been answered" about a question nobody asked has made a claim on the instrument's
 * behalf that the instrument never made. Nothing renders it yet; it is the predicate a renderer
 * will need, beside the one the derivation already uses, so the two cannot be confused later.
 */
export function withdrawnByPlayer(state: ClaimState): state is Extract<ClaimState, { kind: "retired" }> {
  return state.kind === "retired";
}
