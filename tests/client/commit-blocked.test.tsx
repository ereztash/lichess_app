// @vitest-environment jsdom
/**
 * A refusal you can act on.
 *
 * Reported as "I still cannot complete the move", with a screenshot: a chosen move, one field
 * filled, the other empty, 34 seconds on the clock, and nothing happening.
 *
 * The rule was never the problem. A partial decision is not recorded, and that IS the product --
 * an unanswered question and an empty answer must not end up looking the same in the record. What
 * was wrong is that the enforcement was invisible:
 *
 *   - nothing said the fields were required until AFTER a click,
 *   - the button read "רשמו את ההחלטה" whether or not it would do anything,
 *   - clicking set a flag and returned, moving nothing,
 *   - and both the per-field messages and the summary render BELOW the button, which on a laptop
 *     window is below the fold.
 *
 * So the click looked like a dead button. These tests hold the parts that make it legible.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "../../client/src/components/CommitmentScreen";
import { answerEveryStep, openStep } from "../fixtures/commitment-steps";

const position = { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ply: 0 };
const setup = (props: Partial<Parameters<typeof CommitmentScreen>[0]> = {}) =>
  render(
    <CommitmentScreen
      position={position as never}
      chosenMove="e2e4"
      candidatesConsidered={["e2e4"]}
      onCommit={vi.fn()}
      pending={false}
      {...props}
    />,
  );

describe("what is required is visible before you click", () => {
  it("marks every required field", () => {
    setup();
    // known, unknown, confidence.
    expect(screen.getAllByText("חובה")).toHaveLength(3);
  });

  it("names the missing piece on the button itself", () => {
    setup();
    const button = screen.getByRole("button", { name: /חסר/ });
    expect(button.textContent).toMatch(/חסר:/);
    expect(button.textContent).not.toMatch(/רשמו את ההחלטה/);
  });

  it("explains that the refusal is the rule, not a fault", () => {
    setup();
    expect(document.querySelector(".commitment-summary")?.textContent).toMatch(/לא תקלה/);
  });
});

describe("the button becomes the real thing only when the decision is whole", () => {
  it("still refuses with one field left empty", () => {
    const onCommit = vi.fn();
    setup({ onCommit });
    openStep("known");
    fireEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    openStep("confidence");
    fireEvent.click(screen.getByRole("button", { name: /ביטחון 3/ }));
    fireEvent.click(screen.getByRole("button", { name: /חסר/ }));
    expect(onCommit).not.toHaveBeenCalled();
    // And it says which one, rather than a count the player has to go hunting for.
    expect(screen.getByRole("button", { name: /חסר/ }).textContent).toMatch(/אי אפשר להעריך/);
  });

  it("commits once every required field is answered", () => {
    const onCommit = vi.fn();
    setup({ onCommit });
    answerEveryStep({ known: "המרכז פתוח", unknown: "לא יודע איך הוא יענה", confidence: 3 });
    const button = screen.getByRole("button", { name: /רשמו את ההחלטה/ });
    fireEvent.click(button);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const [draft] = onCommit.mock.calls[0];
    expect(draft.knownTags).toEqual(["המרכז פתוח"]);
    expect(draft.unknownTags).toEqual(["לא יודע איך הוא יענה"]);
    expect(draft.confidence).toBe(3);
  });

  it("never records a partial decision, which is the whole point", () => {
    const onCommit = vi.fn();
    setup({ onCommit, chosenMove: undefined });
    fireEvent.click(screen.getByRole("button", { name: /חסר/ }));
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("the refused click takes you to the field", () => {
  it("flags the offending field so it is findable", () => {
    setup();
    openStep("known");
    fireEvent.click(screen.getByRole("button", { name: "המרכז פתוח" }));
    fireEvent.click(screen.getByRole("button", { name: /חסר/ }));
    const flagged = document.querySelectorAll(".commitment-field.has-problem");
    expect(flagged.length).toBeGreaterThan(0);
  });
});
