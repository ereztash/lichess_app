/**
 * The pointer used to end at `grade`, and the record kept going without it.
 *
 * A player who had graded a claim, written a rule from it and had a delayed retrieval test come due
 * was told "more decisions may produce the next claim". The record knew about the rule and the due
 * date; the one surface that says where you are did not read them.
 */
import { describe, expect, it } from "vitest";
import { loopPosition, type LoopInputs } from "../../client/src/lib/loop-position";

const GRADED = (over: Partial<LoopInputs> = {}): LoopInputs => ({
  drill: null,
  recorded: 200,
  scored: 180,
  awaitingReveal: 0,
  withoutConfidence: 0,
  withoutInstrument: 0,
  readElsewhere: 0,
  claimGrade: "replicated",
  scoredStillNeeded: 0,
  narrowedTo: null,
  ...over,
});

describe("a graded claim is not the end of the loop", () => {
  it("points at the rule that is due rather than at more decisions", () => {
    const due = loopPosition(GRADED({ rules: { due: 1, open: 3 } }));
    expect(due.headline).toContain("בדיקה חוזרת");
    expect(due.headline, "the old terminal sentence is gone when work is waiting").not.toContain(
      "עוד החלטות יכולות להוליד את הבאה",
    );
    expect(due.action, "the queue is a surface, so the sentence says where it is").not.toBeNull();
  });

  it("says how many rules are open, because the pointer names one and there are several", () => {
    const due = loopPosition(GRADED({ rules: { due: 2, open: 5 } }));
    expect(due.basis).toContain("5");
  });

  it("names unprompted counting when nothing is due but rules are live", () => {
    const watching = loopPosition(GRADED({ rules: { due: 0, open: 2 } }));
    expect(watching.headline).toContain("בלי תזכורת");
    expect(
      watching.action,
      "nothing to press: what advances an unprompted count is ordinary play",
    ).toBeNull();
  });

  it("keeps the old sentence when the record genuinely holds no rule", () => {
    const bare = loopPosition(GRADED({ rules: { due: 0, open: 0 } }));
    expect(bare.headline).toContain("עוד החלטות יכולות להוליד את הבאה");
  });

  it("behaves identically when the caller does not pass rules at all", () => {
    /*
     * BACKWARD COMPATIBILITY IS A CORRECTNESS PROPERTY HERE, not a convenience. `rules` is optional
     * and every existing caller omits it; a missing value must read as "this caller does not know"
     * and not as "there are none", because the two would be the same sentence and only one of them
     * would be true.
     */
    expect(loopPosition(GRADED()).headline).toBe(
      loopPosition(GRADED({ rules: { due: 0, open: 0 } })).headline,
    );
  });

  it("still refuses a refuted claim a second test", () => {
    const refuted = loopPosition(GRADED({ claimGrade: "refuted", rules: { due: 1, open: 1 } }));
    expect(refuted.headline).toContain("הופרכה");
    expect(refuted.headline, "and still points at the rule work that is genuinely open").toContain(
      "בדיקה חוזרת",
    );
  });
});

describe("finding nothing is a fact about the instrument", () => {
  it("names what was searched, and says the answer is about the detector", () => {
    const flat = loopPosition(GRADED({ claimGrade: null, scoredStillNeeded: 0 }));
    expect(flat.step).toBe("detect");
    expect(flat.headline).toContain("שישה הסוגים");
    expect(flat.headline).toContain("עליו ולא עליכם");
  });

  it("keeps the contrast with silence, which is a different thing from the scoping", () => {
    /*
     * BOTH, NOT EITHER. A first pass at the scoping replaced "an answer and not a silence" and
     * `said-once.test.ts` caught it: that phrase is what tells a player the product ran and found
     * nothing rather than withholding something, and exactly one surface is allowed to say it.
     */
    const flat = loopPosition(GRADED({ claimGrade: null, scoredStillNeeded: 0 }));
    expect(flat.headline).toContain("תשובה ולא שתיקה");
  });

  it("says in the basis how many things were checked", () => {
    const flat = loopPosition(GRADED({ claimGrade: null, scoredStillNeeded: 0 }));
    expect(flat.basis).toContain("שישה סוגים");
  });
});
