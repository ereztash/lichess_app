import { describe, expect, it } from "vitest";
import { learningRuleEventSchema } from "../../server/recordRouter";

const valid = {
  reflection: { revised_read: "I missed the forcing move", would_choose_again: false },
  rule: {
    source_decision_id: "11111111-1111-4111-8111-111111111111",
    trigger: "The opponent changes the pawn cover",
    mechanism_class: "threat_scan",
    missed_signal: "A forcing check appeared",
    action_rule: "Scan checks, captures and threats before quiet moves",
    exception_rule: null,
    predicted_outcome: "Fewer tactical oversights",
    refutation_condition: "Fewer than two successes in three unseen positions",
  },
};

describe("learning-rule API ownership", () => {
  it("accepts only player-authored inputs and derives ownership and grade internally", () => {
    expect(learningRuleEventSchema.parse(valid)).toEqual(valid);
    expect(() =>
      learningRuleEventSchema.parse({
        ...valid,
        rule: { ...valid.rule, authored_by: "system", grade: "replicated" },
      }),
    ).toThrow();
    expect(() => learningRuleEventSchema.parse({ ...valid, observed: true })).toThrow();
  });
});
