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

  it("says it once for the queue, not once per rule in it", () => {
    /*
     * IT WAS A `<small>` INSIDE THE ROW. Six due rules printed this identical sentence six times,
     * and it is a statement about the PROTOCOL -- true of every rule in the list and about none of
     * them in particular. `GATE-SAID-ONCE` scans for the shape; this checks the rendering, because
     * a scan that finds no literal in a `.map()` body is equally satisfied by the sentence being
     * deleted.
     */
    show([rule({ rule_id: "a" }), rule({ rule_id: "b" }), rule({ rule_id: "c" })]);
    expect(document.querySelectorAll(".learning-rule-row")).toHaveLength(3);
    expect(screen.getAllByText(/הכלל עצמו מוסתר/)).toHaveLength(1);
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

/**
 * P1.9: what is due is the queue. Everything else is a list, and a list is not a queue.
 *
 * THE SHAPE THIS REPLACES. Every non-retired rule rendered as its own row, each carrying a test
 * button that was disabled on most of them. A retrieval schedule of 1/3/7/21 days means that on
 * almost any visit almost nothing is due -- so the ordinary state of this section was N rows of a
 * control the player could not press, and they had to read each one to find that out.
 *
 * LAW 2 CALLS THAT ABSENT-NOT-DISABLED, and it is the same rule the control rail follows: a
 * greyed-out control still says "there is a thing here you could be doing", which is the whole of
 * what is being removed.
 *
 * AND THE DELAY IS THE MEASUREMENT, so this is not only tidiness. `RETRIEVAL_INTERVAL_DAYS` exists
 * to make the interval the thing under test; a screen that keeps every cue permanently in view is
 * rehearsing them on every visit, which is the same argument that keeps the action rule off these
 * rows in the first place.
 */
describe("what is due is the queue", () => {
  const due = () => rule({ rule_id: "due-1", next_due_at: "2020-01-01T00:00:00.000Z" });
  const later = (rule_id: string, next_due_at: string) => rule({ rule_id, next_due_at });

  it("puts a rule that is not due behind a disclosure, and says how many", () => {
    const { container } = show([
      due(),
      later("wait-1", "2999-01-01T00:00:00.000Z"),
      later("wait-2", "2999-02-01T00:00:00.000Z"),
    ]);
    const waiting = container.querySelector("details.learning-waiting");
    expect(waiting, "everything is still rendered in one flat list").not.toBeNull();
    expect(waiting!.hasAttribute("open"), "the waiting rules open expanded").toBe(false);
    expect(waiting!.querySelector("summary")?.textContent).toContain("2 כללים");
    /* The due one is NOT inside it: it is the thing the player came for. */
    expect(waiting!.querySelector('[data-rule="due-1"]')).toBeNull();
  });

  it("still keeps the waiting rules reachable, because retiring one is a legitimate act", () => {
    /*
     * FOLDED, NOT REMOVED. A player who wants a rule out of their queue must still be able to
     * reach it, and the disclosure is what makes "not now" different from "not here".
     */
    const { container } = show([later("wait-1", "2999-01-01T00:00:00.000Z")]);
    const waiting = container.querySelector("details.learning-waiting");
    expect(waiting).not.toBeNull();
    expect(waiting!.querySelectorAll("article.learning-rule-row").length).toBe(1);
  });

  it("says when the next test opens rather than making the player read every row", () => {
    show([later("wait-1", "2999-03-01T00:00:00.000Z"), later("wait-2", "2999-01-01T00:00:00.000Z")]);
    const line = document.querySelector(".learning-none-due")?.textContent ?? "";
    expect(line, "no sentence at all where every row was disabled").toContain("אין בדיקה פתוחה");
    /* The NEAREST date, which is the one a player would have had to find by reading all of them. */
    expect(line).toContain(new Date("2999-01-01T00:00:00.000Z").toLocaleDateString("he-IL"));
  });

  it("says a finished schedule is finished, not late", () => {
    /*
     * `next_due_at === null` IS THE END OF THE SCHEDULE. Folding it into "the next one opens on…"
     * would promise a date that will never arrive, and the service refuses a test against it.
     */
    show([rule({ next_due_at: null, grade: "replicated", retrieval_step: 4 })]);
    expect(document.querySelector(".learning-none-due")?.textContent).toContain("הסתיים");
  });

  it("says nothing about waiting when something is actually due", () => {
    show([due()]);
    expect(document.querySelector(".learning-none-due")).toBeNull();
    expect(document.querySelector("details.learning-waiting")).toBeNull();
  });
});
