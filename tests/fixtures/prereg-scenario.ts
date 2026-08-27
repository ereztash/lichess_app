/**
 * The GATE-PREREG scenario and predicate, shared by the gate and its positive control.
 * Both run this identical check; only the drill starter differs.
 *
 * WHAT "PRE-REGISTERED" HAS TO MEAN HERE. R5 asks that what would disprove the claim is written
 * down before the drill runs. For this instrument that is TWO things, not one: the sentence, and
 * the side of zero it is about. The scenario used to carry only the sentence, and the gate passed
 * for the entire time the grading path was filling the missing side with a constant -- which
 * graded every underconfidence claim by whether the player turned out overconfident, permanently.
 * A drill that stores "if the gap is not larger -- refuted" and cannot say larger-in-which-
 * direction has registered a sentence, not a test.
 */
import type { DrillSpec } from "../../shared/claim";

export const SPEC_WITHOUT_CONDITION = {
  drill_id: "drill-no-condition",
  claim_id: "c1",
  fens: ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
  // Arrived from storage with nothing here. TypeScript cannot see this.
  refutation_condition: null as unknown as string,
  predicts_overconfidence: true,
} as DrillSpec;

export const SPEC_WITH_EMPTY_CONDITION = {
  ...SPEC_WITHOUT_CONDITION,
  drill_id: "drill-blank-condition",
  refutation_condition: "   ",
} as DrillSpec;

/** The sentence is there; the side of zero it is about is not. Also invisible to TypeScript. */
export const SPEC_WITHOUT_DIRECTION = {
  ...SPEC_WITHOUT_CONDITION,
  drill_id: "drill-no-direction",
  refutation_condition: "אם הפער בדריל לא יהיה גדול יותר מאשר בשאר ההחלטות — הופרך.",
  predicts_overconfidence: undefined as unknown as boolean,
} as DrillSpec;

export interface PreregVerdict {
  ok: boolean;
  detail: string;
}

/**
 * A drill starter must REFUSE a null condition, a blank condition, and a missing direction alike.
 * `start` is the function under test; it should throw on each.
 */
export function preregVerdict(start: (spec: DrillSpec) => unknown): PreregVerdict {
  const cases: Array<[string, DrillSpec]> = [
    ["null condition", SPEC_WITHOUT_CONDITION],
    ["blank condition", SPEC_WITH_EMPTY_CONDITION],
    ["missing direction", SPEC_WITHOUT_DIRECTION],
  ];
  for (const [label, spec] of cases) {
    let refused = false;
    try {
      start(spec);
    } catch {
      refused = true;
    }
    if (!refused) {
      return { ok: false, detail: `a drill started with a ${label} -- it could not have failed` };
    }
  }
  return {
    ok: true,
    detail: "drills refuse to start without a stored refutation condition and a stored direction",
  };
}
