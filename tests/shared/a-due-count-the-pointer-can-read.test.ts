/**
 * How much rule work is waiting, counted the way the pointer reads it.
 *
 * This function shipped once with no caller and no test: `loopPosition` had nine tests proving it
 * handled a due rule, `useLoopPosition` never passed one, and `ruleLoad` was exported into nothing.
 * `GATE-JOURNEY-REACHABLE` now refuses the first half of that. This is the second half.
 */
import { describe, expect, it } from "vitest";
import { ruleLoad } from "../../client/src/lib/rule-load";

const NOW = new Date("2026-09-12T12:00:00.000Z");
const rule = (grade: string, due: string | null) => ({ grade, next_due_at: due });

describe("counting the rule work that is waiting", () => {
  it("is silent about a record that holds no rule", () => {
    expect(ruleLoad(undefined, NOW)).toEqual({ due: 0, open: 0 });
    expect(ruleLoad([], NOW)).toEqual({ due: 0, open: 0 });
  });

  it("counts a rule due in the past and not one due later", () => {
    const load = ruleLoad(
      [
        rule("hypothesis", "2026-09-11T00:00:00.000Z"),
        rule("hypothesis", "2026-09-20T00:00:00.000Z"),
      ],
      NOW,
    );
    expect(load).toEqual({ due: 1, open: 2 });
  });

  it("treats a rule due at this exact instant as due", () => {
    /* The boundary is inclusive, because a schedule that says 'today' and a queue that says 'not
       yet' is the product disagreeing with itself for one tick. */
    expect(ruleLoad([rule("hypothesis", NOW.toISOString())], NOW).due).toBe(1);
  });

  it("counts a replicated rule as live, because it is still scheduled", () => {
    expect(ruleLoad([rule("replicated", "2026-09-01T00:00:00.000Z")], NOW)).toEqual({
      due: 1,
      open: 1,
    });
  });

  it("counts neither a refuted nor a retired rule, in either column", () => {
    /*
     * CLOSED IS NOT WAITING, and the distinction is what stops the pointer sending a player to a
     * queue with nothing in it. A refuted rule is closed by the record and a retired one by the
     * player; `gradeLearningRule` sets `next_due_at: null` on refutation, but a retired rule can
     * still carry a date from before it was closed, so the grade is what decides and not the date.
     */
    const load = ruleLoad(
      [
        rule("refuted", null),
        rule("retired", "2026-09-01T00:00:00.000Z"),
        rule("hypothesis", null),
      ],
      NOW,
    );
    expect(load).toEqual({ due: 0, open: 1 });
  });

  it("counts a live rule with no date as open and not due", () => {
    expect(ruleLoad([rule("hypothesis", null)], NOW)).toEqual({ due: 0, open: 1 });
  });
});
