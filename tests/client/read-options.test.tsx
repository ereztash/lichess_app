// @vitest-environment jsdom
/**
 * Stating a read without writing one.
 *
 * The commitment screen required two free-text fields before any move could be recorded, which
 * is roughly forty written sentences per game. Reported as "the move is blocked, it asks me to
 * fill in forms -- these should be options, not forced writing", and that is a fair description
 * of what it was.
 *
 * What the requirement is FOR is the ordering: a read stated before the engine speaks (R3). It
 * was never for the prose. `shared/detector.ts` buckets on time, phase and clock and scores
 * confidence against centipawn loss; it does not read `known` or `unknown` at all. So the change
 * is a change to what the player must type, and to nothing that is measured.
 *
 * These assertions hold the line where it actually is: something must still be stated, nothing
 * may be stated on the player's behalf, and writing must remain possible for the position the
 * menu cannot describe.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "@/components/CommitmentScreen";
import { answerEveryStep, openStep } from "../fixtures/commitment-steps";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS, composeStatement } from "@/lib/read-options";
import type { PositionUnderDecision } from "@/lib/decision-session";

const POSITION: PositionUnderDecision = {
  gameId: "g",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  ply: 7,
  clockMsRemaining: null,
  // Anchor: the purpose where the confidence question IS put. The `play` case has its own file.
  purpose: "anchor",
};

const renderScreen = (overrides: Partial<Parameters<typeof CommitmentScreen>[0]> = {}) =>
  render(
    <CommitmentScreen
      position={POSITION}
      chosenMove="g8f6"
      candidatesConsidered={[]}
      onCommit={vi.fn()}
      pending={false}
      {...overrides}
    />,
  );

describe("a decision can be made without typing anything", () => {
  it("records a move from four taps", async () => {
    const onCommit = vi.fn();
    renderScreen({ onCommit });
    /*
     * The move is already chosen on the board; three taps still finish the decision. The steps
     * are an accordion now, so reaching each one costs a header tap -- but a player who works
     * straight through never pays it: the panel opens the first unanswered step by itself, the
     * move step advances on its own when a move arrives, and "הבא" moves between the two read
     * steps. `answerEveryStep` taps the headers because a test cannot rely on that ordering.
     */
    answerEveryStep({ known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 3 });
    await userEvent.click(screen.getByRole("button", { name: /רשמו את ההחלטה/ }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("shows no textarea until one is asked for", () => {
    renderScreen();
    // Open by default, the box reads as the real field and the chips as a shortcut -- which is
    // the arrangement that made a game unfinishable.
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    // Both read steps carry one, collapsed or not: `hidden` takes a step out of the accessible
    // tree, so this counts what is in the DOM rather than what is currently reachable.
    expect(document.querySelectorAll(".read-write-toggle")).toHaveLength(2);
  });

  it("opens a box when one is asked for, and keeps it open", async () => {
    renderScreen();
    openStep("known");
    await userEvent.click(screen.getAllByRole("button", { name: /להוסיף במילים שלכם/ })[0]);
    const boxes = document.querySelectorAll("textarea");
    expect(boxes).toHaveLength(1);
    await userEvent.type(boxes[0] as HTMLTextAreaElement, "הצריח שלי על טור פתוח");
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "הצריח שלי על טור פתוח",
    );
  });
});

describe("nothing is stated on the player's behalf", () => {
  it("preselects no option in either field", () => {
    renderScreen();
    /*
     * Every option, in both fields, checked through the header a player would tap. The panel
     * collapses the steps it is not on; it does not remove an option from any of them, and this
     * walks the whole list to say so.
     */
    for (const [step, options] of [["known", KNOWN_OPTIONS], ["unknown", UNKNOWN_OPTIONS]] as const) {
      openStep(step);
      for (const option of options) {
        const chip = screen.getByRole("button", { name: option.label });
        // A default read would be the machine stating one and then measuring the player against it.
        expect(chip.getAttribute("aria-pressed")).toBe("false");
      }
    }
  });

  it("still refuses a decision with neither field answered", async () => {
    const onCommit = vi.fn();
    renderScreen({ onCommit });
    openStep("confidence");
    await userEvent.click(screen.getByRole("button", { name: /ביטחון 3/ }));
    await userEvent.click(screen.getByRole("button", { name: /חסר:/ }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /חסר:/ }).textContent).toMatch(/סמנו/);
  });

  it("lets a selection be taken back", async () => {
    renderScreen();
    openStep("known");
    const chip = screen.getByRole("button", { name: "מלך חשוף" });
    await userEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("the options are reads, not verdicts", () => {
  it("offers no option that evaluates the position", () => {
    // "המרכז סגור" is something read off the board. "העמדה שלי טובה יותר" is the engine's job,
    // after the commit -- an option like that would have the player pre-committing to the
    // machine's own output, which is the one thing R3 exists to prevent.
    // Hebrew inflects: the first draft of this pattern read /טוב יותר/ and did NOT catch
    // "העמדה שלי טובה יותר", so the control it was written for stayed green. \S* covers the
    // gender and number endings.
    const verdicts = /טוב\S*\s+יותר|עדיף|מנצח\S*|מפסיד\S*|שקול\S*|יתרון מכריע|ההערכה/;
    for (const option of [...KNOWN_OPTIONS, ...UNKNOWN_OPTIONS]) {
      expect(option.label, `"${option.label}" reads as a verdict`).not.toMatch(verdicts);
    }
  });

  it("keeps the two lists disjoint", () => {
    // A label in both would mean the same words counted as a read and as a gap in one decision.
    const known = new Set(KNOWN_OPTIONS.map((o) => o.label));
    expect(UNKNOWN_OPTIONS.filter((o) => known.has(o.label))).toEqual([]);
  });

  it("gives every option a distinct id and label", () => {
    const all = [...KNOWN_OPTIONS, ...UNKNOWN_OPTIONS];
    expect(new Set(all.map((o) => o.id)).size).toBe(all.length);
    expect(new Set(all.map((o) => o.label)).size).toBe(all.length);
  });
});

describe("what ends up on the record", () => {
  it("joins taps and typing into one statement", () => {
    expect(composeStatement(["א", "ב"], " ג ")).toBe("א · ב · ג");
  });

  it("is empty when nothing was said, so the refusal has something to refuse", () => {
    expect(composeStatement([], "   ")).toBe("");
  });

  it("stays inside the atom's 200-character bound", () => {
    const long = composeStatement(Array.from({ length: 60 }, () => "המרכז פתוח"), "ועוד");
    expect(long.length).toBeLessThanOrEqual(200);
  });
});
