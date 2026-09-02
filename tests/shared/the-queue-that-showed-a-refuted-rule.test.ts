/**
 * The disagreement fixture for `G-01`: stored says one thing, the record implies another, and the
 * queue must show the record's answer.
 *
 * WHAT WAS WRONG. `grade`, `retrieval_step`, `next_due_at` and `last_evaluated_at` are a
 * materialized projection. `gradeFromRecord` folds them from the results and writes them back when
 * they differ -- but it runs only when a transfer touches the rule, and **the learning queue is
 * precisely the surface that lists the rules nobody is drilling**. A rule refuted three sittings ago
 * kept whatever projection it last had, and four read sites in `LearningQueue.tsx` printed it: the
 * retired filter, the due-ness computation, the grade badge, and the button hidden on `refuted`.
 *
 * The repository already knew the shape. Cycle 39 closed the WRITE half -- `beginLearningTransfer`
 * derives the grade before deciding on it, and all three stores refuse to move a rule off
 * `retired`. The read half stayed open and is recorded as `X-01`.
 *
 * WHY THE FIXTURE IS A DISAGREEMENT AND NOT A HAPPY PATH. A test that stores `refuted` and reads
 * `refuted` passes whether the read derives or not, and would have passed for the whole time this
 * defect existed. The only test that can tell the two apart is one where the stored value is WRONG,
 * so the fixture writes a stored grade the results contradict and asserts which side wins.
 *
 * `retired` IS THE CONTROL FOR THE OPPOSITE ERROR. Deriving everything would erase it, because no
 * fold produces retirement -- it is an act of the player's. A rule stored `retired` whose results
 * would otherwise grade it `replicated` must come back `retired`, and that is the second case here.
 */
import { describe, expect, it } from "vitest";
import { learningRules } from "@shared/record-service";
import type { LearningRule, LearningTransferResult } from "@shared/learning-record";
import type { RecordStore } from "@shared/record-store";

const CREATED = "2026-01-01T00:00:00.000Z";

function rule(overrides: Partial<LearningRule> = {}): LearningRule {
  return {
    rule_id: "rule-1",
    source_decision_id: "decision-1",
    trigger: "כשהשעון מתחת לדקה",
    mechanism_class: "time_allocation",
    missed_signal: "האיום על המלכה",
    action_rule: "לסרוק איומים לפני חישוב",
    exception_rule: null,
    predicted_outcome: "פחות טעויות בזמן לחץ",
    refutation_condition: "שתי סדרות ללא שיפור",
    authored_by: "player",
    grade: "hypothesis",
    retrieval_step: 0,
    next_due_at: null,
    created_at: CREATED,
    last_evaluated_at: CREATED,
    ...overrides,
  } as LearningRule;
}

/** A sitting the player failed: `observed` false is what `applyTransferResult` reads as a miss. */
function failedSitting(transferId: string, completedAt: string): LearningTransferResult {
  return {
    kind: "learning_transfer_result",
    transfer_id: transferId,
    rule_id: "rule-1",
    decision_ids: ["d1", "d2"],
    recalled_rules: [],
    applied_rule: [false, false],
    successes: 0,
    observed: false,
    completed_at: completedAt,
  };
}

/**
 * The smallest store the read path needs.
 *
 * Deliberately NOT `MemoryRecordStore`: that class repairs on write, and a fixture built on it
 * could not hold a disagreement open long enough to read it. This one stores exactly what it is
 * given, which is what a real row that nothing has re-graded looks like.
 */
function storeHolding(rules: LearningRule[], results: LearningTransferResult[]): RecordStore {
  return {
    listLearningRules: async () => rules,
    listLearningTransferResults: async (ruleId: string) =>
      results.filter((r) => r.rule_id === ruleId),
  } as unknown as RecordStore;
}

describe("the learning queue reads the record, not the row", () => {
  it("shows `refuted` when the results refute a rule the row still calls a hypothesis", async () => {
    const stale = rule({
      grade: "hypothesis",
      next_due_at: "2026-01-08T00:00:00.000Z",
      retrieval_step: 1,
    });
    const results = [
      failedSitting("t1", "2026-01-02T00:00:00.000Z"),
      failedSitting("t2", "2026-01-09T00:00:00.000Z"),
    ];

    const { rules } = await learningRules(storeHolding([stale], results));

    expect(rules).toHaveLength(1);
    expect(
      rules[0].grade,
      "the row says hypothesis and two sittings refute it; the queue printed the row",
    ).toBe("refuted");
    expect(
      rules[0].grade,
      "a stored value that survives the read is the defect this test exists for",
    ).not.toBe(stale.grade);
  });

  it("keeps `retired`, which no fold produces and only the player can say", async () => {
    /*
     * The opposite error. `retired` is an act, not a derivation, and a read path that derived
     * everything would hand this rule back as `replicated` and put it in front of the player again
     * -- which is the write-side defect Cycle 39 closed, reintroduced from the other end.
     */
    const retired = rule({ rule_id: "rule-1", grade: "retired" });
    const successes: LearningTransferResult[] = [
      { ...failedSitting("t1", "2026-01-02T00:00:00.000Z"), successes: 2, observed: true, applied_rule: [true, true] },
      { ...failedSitting("t2", "2026-01-09T00:00:00.000Z"), successes: 2, observed: true, applied_rule: [true, true] },
    ];

    const { rules } = await learningRules(storeHolding([retired], successes));

    expect(rules[0].grade, "retirement is the one grade the record cannot re-derive").toBe(
      "retired",
    );
  });

  it("agrees with the row when the row is right, so the change is a repair and not a rewrite", async () => {
    /*
     * The third case matters as much as the first two: if deriving on read returned something
     * different from a CORRECT projection, this would be a semantic change wearing the name of a
     * reconciliation. It returns the same values.
     */
    const results = [failedSitting("t1", "2026-01-02T00:00:00.000Z")];
    const correct = (await learningRules(storeHolding([rule()], results))).rules[0];

    const { rules } = await learningRules(storeHolding([correct], results));

    expect(rules[0]).toEqual(correct);
  });
});
