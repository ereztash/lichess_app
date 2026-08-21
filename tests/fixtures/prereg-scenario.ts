/**
 * The GATE-PREREG scenario and predicate, shared by the gate and its positive control.
 * Both run this identical check; only the drill starter differs.
 */
import type { DrillSpec } from "../../shared/claim";

export const SPEC_WITHOUT_CONDITION = {
  drill_id: "drill-no-condition",
  claim_id: "c1",
  fens: ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
  // Arrived from storage with nothing here. TypeScript cannot see this.
  refutation_condition: null as unknown as string,
} as DrillSpec;

export const SPEC_WITH_EMPTY_CONDITION = {
  ...SPEC_WITHOUT_CONDITION,
  drill_id: "drill-blank-condition",
  refutation_condition: "   ",
} as DrillSpec;

export interface PreregVerdict {
  ok: boolean;
  detail: string;
}

/**
 * A drill starter must REFUSE both a null and a blank refutation condition.
 * `start` is the function under test; it should throw.
 */
export function preregVerdict(start: (spec: DrillSpec) => unknown): PreregVerdict {
  const cases: Array<[string, DrillSpec]> = [
    ["null condition", SPEC_WITHOUT_CONDITION],
    ["blank condition", SPEC_WITH_EMPTY_CONDITION],
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
  return { ok: true, detail: "drills refuse to start without a stored refutation condition" };
}
