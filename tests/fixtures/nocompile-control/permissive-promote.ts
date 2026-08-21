/**
 * GATE-EXTERNAL positive control.
 *
 * This models the type design R4 forbids: a promote function that accepts ANY evidence,
 * including an external pointer. It COMPILES, and that is the point -- the gate's control side
 * asserts that a permissive design is caught rather than silently accepted.
 */
import type { Claim, ExternalPointer, ProspectiveDrillResult } from "../../../shared/claim";

type AnyEvidence = ProspectiveDrillResult | ExternalPointer | { kind: "retrospective" };

/** THE DEFECT: external evidence can reach the grade. */
export function permissiveEvaluate(claim: Claim, _evidence: AnyEvidence): Claim {
  return { ...claim, grade: "replicated" };
}

const pointer: ExternalPointer = {
  kind: "pointer",
  promotes_grade: false,
  suggested_next_question: "",
  suggested_drill: null,
  sources: [],
};

export const promotedFromPointer = (claim: Claim) => permissiveEvaluate(claim, pointer);
