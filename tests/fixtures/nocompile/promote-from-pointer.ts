/**
 * GATE-EXTERNAL positive control (R4).
 *
 * This file MUST NOT COMPILE. It attempts to raise a claim's grade from an ExternalPointer --
 * exactly what R4 forbids: external evidence can raise a question, order a queue, or suggest
 * what to test next, but it can never raise the confidence grade of a claim about the player.
 *
 * The gate runs `tsc --noEmit` on this file and requires a NON-ZERO exit. If it ever compiles,
 * the type design is wrong and the fix belongs in shared/claim.ts, not here.
 *
 * It lives outside the main tsconfig `include` so `npm run check` stays green.
 */
import { evaluateClaim, type Claim, type ExternalPointer } from "../../../shared/claim";

const claim: Claim = {
  claim_id: "c1",
  statement: "placeholder",
  scope: "placeholder",
  supporting_decision_ids: [],
  n: 0,
  grade: "hypothesis",
  refutation_condition: "placeholder",
  prospective_tests: [],
  created_at: "2026-08-21T00:00:00Z",
  last_evaluated_at: "2026-08-21T00:00:00Z",
};

const pointer: ExternalPointer = {
  kind: "pointer",
  promotes_grade: false,
  suggested_next_question: "look at the masters database for this structure",
  suggested_drill: null,
  sources: [{ origin: "lichess-masters", n: 4210 }],
};

// EXPECTED COMPILE ERROR: ExternalPointer is not a ProspectiveDrillResult.
export const promoted = evaluateClaim(claim, pointer);

// EXPECTED COMPILE ERROR: retrospective evidence cannot raise a grade either.
export const promotedFromRetrospective = evaluateClaim(claim, {
  kind: "retrospective",
  decision_ids: ["a", "b", "c"],
});

/*
 * EXPECTED COMPILE ERROR: nor in an array.
 *
 * `evaluateClaim` takes the whole result set since the grade became a fold over it, and an array
 * is a new way to ask the same forbidden question. This control exists because the surface
 * changed, not because anyone tried it -- a gate that only covers the shape of the argument the
 * function used to take is a gate for the old function.
 */
export const promotedFromPointerList = evaluateClaim(claim, [pointer]);

// EXPECTED COMPILE ERROR: and a list that MIXES a real result with a pointer is still refused.
export const promotedFromMixedList = evaluateClaim(claim, [
  {
    kind: "prospective_drill_result",
    drill_id: "dr1",
    claim_id: "c1",
    decision_ids: ["a"],
    predicted: true,
    observed: true,
    recorded_at: "2026-08-22T00:00:00Z",
  },
  pointer,
]);

// EXPECTED COMPILE ERROR: a pointer cannot assert that it promotes.
export const lyingPointer: ExternalPointer = {
  kind: "pointer",
  promotes_grade: true,
  suggested_next_question: "",
  suggested_drill: null,
  sources: [],
};
