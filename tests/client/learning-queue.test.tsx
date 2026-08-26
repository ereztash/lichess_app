// @vitest-environment jsdom
/**
 * The queue that offers a delayed retrieval test must not hand over the answer first.
 *
 * TWO DEFECTS, one screen.
 *
 * THE ANSWER WAS BESIDE THE BUTTON. Each row printed `action_rule` -- the rule the player is
 * about to be asked to recall from memory -- inches from the control that starts the test. What
 * that measures is working memory over a few seconds, not delayed retrieval, and the whole
 * schedule of 1/3/7/21 days exists to make the delay the thing being measured. The TRIGGER stays:
 * it is the retrieval cue, and showing the cue is what a retrieval test IS.
 *
 * NULL MEANT "GO AHEAD" INSTEAD OF "FINISHED". `gradeLearningRule` sets `next_due_at` to null
 * when the last interval has passed, and the row read it as due now -- so it printed
 * "אין בדיקה נוספת" and enabled the button in the same breath, offering an unlimited supply of
 * tests to a rule whose schedule had ended.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LearningRule } from "@shared/learning-record";

const rules: LearningRule[] = [];
vi.mock("@/lib/record-api", () => ({
  useLearningRules: () => ({ isLoading: false, data: { rules } }),
  useRetireLearningRule: () => ({ mutateAsync: vi.fn() }),
}));

const { LearningQueue } = await import("@/components/LearningQueue");

const ACTION = "רשימת שחים, הכאות ואיומים ישירים לפני מועמדים שקטים";
const rule = (over: Partial<LearningRule>): LearningRule => ({
  rule_id: "rule-1",
  source_decision_id: "11111111-1111-4111-8111-111111111111",
  trigger: "כשהיריב משנה את מבנה הרגלים ליד המלך שלי",
  mechanism_class: "threat_scan",
  missed_signal: "לא סרקתי שחים כופים",
  action_rule: ACTION,
  exception_rule: null,
  predicted_outcome: "אפחית הפסדים טקטיים במהלך אחד",
  refutation_condition: "פחות משתי הצלחות בשלוש עמדות",
  authored_by: "player",
  grade: "hypothesis",
  retrieval_step: 0,
  next_due_at: "2020-01-01T00:00:00.000Z",
  created_at: "2019-12-31T00:00:00.000Z",
  last_evaluated_at: "2019-12-31T00:00:00.000Z",
  ...over,
});

const show = (only: LearningRule[]) => {
  rules.length = 0;
  rules.push(...only);
  return render(<LearningQueue onStart={vi.fn()} busy={false} />);
};

describe("the queue shows the cue and withholds the answer", () => {
  it("never prints the action rule the player is about to be asked to recall", () => {
    show([rule({})]);
    expect(
      screen.queryByText(ACTION),
      "the answer is on screen beside the button that tests recall of it",
    ).toBeNull();
  });

  it("still shows the trigger, because the cue is what a retrieval test is made of", () => {
    show([rule({})]);
    expect(screen.getByText(/מבנה הרגלים ליד המלך/)).toBeTruthy();
  });

  it("says out loud that the rule is hidden on purpose", () => {
    // Otherwise a missing rule reads as a rendering fault, and the next person restores it.
    show([rule({})]);
    expect(screen.getByText(/מהזיכרון|מוסתר/)).toBeTruthy();
  });
});

describe("a finished schedule is finished", () => {
  it("does not offer a test for a rule whose retrieval schedule has ended", () => {
    const finished = show([rule({ next_due_at: null, grade: "replicated", retrieval_step: 4 })]);
    const button = finished.container.querySelector("button");
    expect(button?.textContent).toContain("בדיקה");
    expect(
      (button as HTMLButtonElement).disabled,
      'the row said "אין בדיקה נוספת" and enabled the button in the same breath',
    ).toBe(true);
  });

  it("offers a test for a rule that is genuinely due", () => {
    // The control. Without it, a queue that disabled every button would pass the test above.
    const due = show([rule({ next_due_at: "2020-01-01T00:00:00.000Z" })]);
    expect((due.container.querySelector("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not offer a test before the scheduled date", () => {
    const later = show([rule({ next_due_at: "2999-01-01T00:00:00.000Z" })]);
    expect((later.container.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
