// @vitest-environment jsdom
/**
 * The two Nielsen heuristics this product scored zero on: user control and freedom (3), and help
 * and documentation (10).
 *
 * They are tested together because they fail together. Both are what a product omits when it is
 * built by someone who already knows how it works: an exit is only obviously necessary to a person
 * who wanted one, and an explanation is only obviously missing to a person who did not have it.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DrillRunner } from "@/components/DrillRunner";
import { WhatThisIs } from "@/components/WhatThisIs";
import { MIN_BUCKET_N, PREREGISTERED_THRESHOLDS } from "@shared/detector";
import type { DrillSpec } from "@shared/claim";

const drill = {
  drill_id: "drill-1",
  claim_id: "claim-1",
  fens: Array.from({ length: 20 }, () => "8/8/8/8/8/8/8/K6k w - - 0 1"),
  refutation_condition: "אם הפער לא יהיה גדול יותר מאשר בשאר ההחלטות — ההשערה הופרכה.",
  scope: "החלטות תחת פחות מ-45 שניות",
} as unknown as DrillSpec;

const runner = (stage: "briefing" | "running" | "reporting" | "done", completed = 0) =>
  render(
    <DrillRunner
      drill={drill}
      progress={{ completed, total: drill.fens.length }}
      stage={stage}
      verdict={stage === "done" ? { description: "שרדה", refuted: false } : null}
      onStart={() => {}}
      onFinish={vi.fn()}
    />,
  );

describe("heuristic 3: a drill can be left", () => {
  it("offers a way out WHILE it is running, which is the state that was a trap", async () => {
    /*
     * The defect: `onFinish` rendered only at `stage === "done"`. A drill is a fixed set of
     * positions, so starting one -- by accident, or on a phone about to die -- committed the
     * player to finishing all twenty or abandoning the tab. It is the one control in this product
     * that the player could not leave.
     */
    runner("running", 7);
    const exit = document.querySelector(".drill-abandon");
    expect(exit, "a running drill still has no exit").not.toBeNull();
    // It names the cost in positions, so leaving is an informed act rather than a guess.
    expect(exit!.textContent).toContain("7");
    expect(exit!.textContent).toContain("20");
  });

  it("offers one before it starts, too", async () => {
    // Opening the briefing by mistake is the cheapest version of the same trap.
    runner("briefing");
    expect(document.querySelector(".drill-abandon")).not.toBeNull();
  });

  it("says leaving will NOT grade the claim", async () => {
    /*
     * R5: a drill's refutation condition is registered before it runs, over a bounded set of
     * positions. Seven of twenty is not that set. `ProspectiveDrillResult` has `predicted` and
     * `observed` and no third state, so an abandoned drill must produce no result at all -- and
     * the player has to be told, or they will assume leaving reports a failure.
     */
    runner("running", 7);
    const note = document.querySelector(".drill-abandon-note")!.textContent ?? "";
    expect(note).toMatch(/לא תדרג/);
    expect(note).toMatch(/דריל חלקי/);
  });

  it("says the decisions already recorded are KEPT, because they are", async () => {
    /*
     * The other half, and the one that decides whether the exit gets used. The record is
     * append-only: decisions taken during a drill were taken under the same commit-before-reveal
     * protocol as any other and they stay. A player who believes leaving erases their work will
     * sit through a drill they wanted to leave.
     */
    runner("running", 7);
    expect(document.querySelector(".drill-abandon-note")!.textContent).toMatch(/נשארות ברשומה/);
  });

  it("says so accurately when nothing has been recorded yet", async () => {
    // Telling someone their 0 decisions are safe is noise, and slightly absurd. Section 4.5: two
    // different situations must not render the same sentence.
    runner("running", 0);
    const note = document.querySelector(".drill-abandon-note")!.textContent ?? "";
    expect(note).toMatch(/שום החלטה עוד לא נרשמה/);
    expect(note).not.toMatch(/נשארות ברשומה/);
  });

  it("calls the exit while running by a different name than the one at the end", async () => {
    // "חזרה" after a verdict and "לצאת" mid-drill are different acts with different consequences.
    runner("done");
    expect(document.querySelector(".drill-abandon"), "the exit lingers past the verdict").toBeNull();
    expect(document.querySelector(".drill-finish")).not.toBeNull();
  });
});

describe("heuristic 10: the product explains itself", () => {
  it("defines the thing it measures, in the first paragraph", async () => {
    /*
     * "פער כיול" was defined in exactly one place -- RecordDashboard -- which is reached only once
     * there is a record worth looking at, i.e. weeks in. The explanation arrived after the thing
     * it explains.
     */
    render(<WhatThisIs onClose={() => {}} />);
    expect(screen.getByText(/כיול/)).toBeTruthy();
  });

  it("explains WHY the engine stays silent, which is the rule that confuses people", async () => {
    // Every other chess tool answers immediately. The inverted order is the product, and a player
    // who reads it as slowness rather than as method will not use it correctly.
    render(<WhatThisIs onClose={() => {}} />);
    expect(document.body.textContent).toMatch(/המנוע שותק|המנוע מדבר ראשון/);
  });

  it("quotes both floors from the constants, so help cannot drift from the detector", async () => {
    // Documentation that restates a number by hand is documentation that will be wrong later.
    render(<WhatThisIs onClose={() => {}} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain(String(MIN_BUCKET_N * 2));
    expect(text).toContain(String(PREREGISTERED_THRESHOLDS.minBucketN * 2));
  });

  it("lists what the product will NEVER say, which is the section help normally omits", async () => {
    /*
     * Each line here is a refusal enforced somewhere in the code -- no score, no streak, no
     * recommendation, no self-grading. Publishing them to the person they protect is a commitment
     * that can be held against a future version.
     */
    render(<WhatThisIs onClose={() => {}} />);
    const never = document.querySelector(".what-never")!.textContent ?? "";
    expect(never).toMatch(/ציון|דירוג/);
    expect(never).toMatch(/רצף/);
    expect(never).toMatch(/לא ידרג את עצמו/);
  });

  it("admits nobody has completed the loop, on the page that introduces it", async () => {
    // The honest half. Everything here was measured against synthetic records and a stub engine.
    // A help page that omitted that would be the one screen in the product overstating itself.
    render(<WhatThisIs onClose={() => {}} />);
    expect(document.querySelector(".what-unverified")!.textContent).toMatch(
      /אף שחקן עדיין לא השלים/,
    );
  });

  it("names the known defect in a number that is on screen", async () => {
    // The imported accuracy rate counts book moves and recaptures. It is inflated, it is shown,
    // and the help page is the right place to say so before someone reads it as a verdict.
    render(<WhatThisIs onClose={() => {}} />);
    expect(document.querySelector(".what-unverified")!.textContent).toMatch(/מנופח|פגם ידוע/);
  });

  it("closes, and does not congratulate anyone for having read it", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WhatThisIs onClose={onClose} />);
    await user.click(screen.getByLabelText("סגור"));
    expect(onClose).toHaveBeenCalled();
    // Not a tour, not a checklist, not a coach-mark with a "got it" that records progress.
    expect(document.body.textContent).not.toMatch(/הבנתי|בוא נתחיל|כל הכבוד/);
  });
});
