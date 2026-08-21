/**
 * The GATE-GRADE predicate, shared by the gate and its positive control.
 *
 * Both run this identical check over rendered markup; only the component differs. A control with
 * its own weaker predicate proves nothing.
 */
import type { Claim } from "../../shared/claim";
import { GRADE_WORD } from "../../shared/claim";

export interface GradeVerdict {
  ok: boolean;
  detail: string;
}

/** Words that belong to a replicated finding and must never appear for a hypothesis. */
const FINDING_WORDS = ["שוחזר", "מאושש", "הוכח", "ממצא"];

export function claimRenderVerdict(markup: string, claim: Claim): GradeVerdict {
  const grade = GRADE_WORD[claim.grade].he;
  if (!markup.includes(grade)) {
    return { ok: false, detail: `claim rendered without its grade ("${grade}" absent)` };
  }
  if (!markup.includes(`n=${claim.n}`)) {
    return { ok: false, detail: `claim rendered without its n (n=${claim.n} absent)` };
  }
  if (claim.grade === "hypothesis") {
    const borrowed = FINDING_WORDS.filter((word) => markup.includes(word));
    if (borrowed.length) {
      return {
        ok: false,
        detail: `hypothesis rendered using the word for a finding: ${borrowed.join(", ")}`,
      };
    }
  }
  return { ok: true, detail: `claim rendered at its grade with n=${claim.n}` };
}

/** An n=1 hypothesis: the weakest thing the product can say, and the easiest to overstate. */
export const N1_HYPOTHESIS: Claim = {
  claim_id: "c-n1",
  statement: "בהחלטות מהירות הביטחון שלך גבוה מהתוצאות.",
  scope: "החלטות תחת פחות מ-45 שניות",
  supporting_decision_ids: ["d1"],
  n: 1,
  grade: "hypothesis",
  refutation_condition: "אם בדריל הפער לא יהיה גדול יותר — הופרך.",
  prospective_tests: [],
  created_at: "2026-08-21T00:00:00Z",
  last_evaluated_at: "2026-08-21T00:00:00Z",
};
