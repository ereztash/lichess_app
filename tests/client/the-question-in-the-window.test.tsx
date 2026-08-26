// @vitest-environment jsdom
/**
 * "אם לא היית עושה את זה, מה כן היית עושה?" -- asked in the one window where the answer means
 * anything.
 *
 * THE WINDOW IS NOT A PREFERENCE. Before the commitment, naming an alternative is choosing one:
 * a player who says "I'd have played Nf3" while their move is still changeable has been handed a
 * second candidate to reconsider, and the decision the record stores is no longer the decision
 * they were going to make. After the reveal, the alternative is a reading of the engine's line
 * rather than the player's own, and nothing in storage can tell the two apart afterwards.
 *
 * Between those, there is exactly one state: committed, engine silent. The product already had a
 * name for it -- `SessionStage`'s `"committed"` -- and `engineMayRun` is already false there.
 *
 * THERE IS NO SKIP BUTTON, AND THAT IS A MEASUREMENT DECISION RATHER THAN A NAG. A dismissable
 * question produces a probed arm made of the decisions where the player HAD an answer, which is
 * the population most likely to differ from the control on exactly the thing being measured. So
 * "I had nothing else" is a first-class answer with its own button: it records an answered probe
 * with no move, which is a fact about the player, not a gap in the data.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CounterfactualProbe } from "../../client/src/components/CounterfactualProbe";
import { engineMayRun } from "@/lib/decision-session";
import { PROBE_STAGE } from "@shared/counterfactual-stage";

const setup = (props: Partial<Parameters<typeof CounterfactualProbe>[0]> = {}) =>
  render(
    <CounterfactualProbe
      chosenMove="e2e4"
      alternative={null}
      pending={false}
      onAnswer={vi.fn()}
      {...props}
    />,
  );

describe("the window", () => {
  it("asks in a stage where the engine may not run", () => {
    /*
     * THE ASSERTION THAT TIES THE QUESTION TO R3, and it is a fact about the two modules rather
     * than a comment. If the probe ever moved to a stage the engine may speak in, this fails --
     * which is the only way that move can happen without somebody noticing.
     */
    expect(engineMayRun(PROBE_STAGE)).toBe(false);
  });
});

describe("what the screen says", () => {
  it("asks the question in the player's own words", () => {
    setup();
    expect(screen.getByText(/אם לא היית עושה את זה, מה כן היית עושה\?/)).toBeTruthy();
  });

  it("shows the move that was committed, because the question is about that move", () => {
    setup({ chosenMove: "e2e4" });
    expect(document.body.textContent).toContain("e2e4");
  });

  it("carries no evaluation of any kind", () => {
    /*
     * R2 AND R3 TOGETHER. There is nothing to show yet -- the engine has not run -- so a number
     * on this panel could only be a placeholder, and a placeholder here is indistinguishable from
     * a reading the player would then be answering against.
     */
    setup({ alternative: "g1f3" });
    expect(document.body.textContent).not.toMatch(/[+-]?\d+\.\d\d|צנטיפיון|cp/i);
  });
});

describe("the two answers, and there is no third", () => {
  it("offers no skip, dismiss or later", () => {
    /*
     * A dismissable probe makes the treatment arm self-selected: it fills with the decisions where
     * the player had an answer ready, which is precisely the population that differs from the
     * control on the thing being measured.
     */
    setup();
    const labels = [...document.querySelectorAll("button")].map((b) => b.textContent ?? "");
    expect(labels.some((t) => /דלג|אחר כך|סגור|בטל/.test(t))).toBe(false);
  });

  it("records 'I had nothing else' as an answer, not as an absence", () => {
    const onAnswer = vi.fn();
    setup({ onAnswer });
    fireEvent.click(screen.getByRole("button", { name: /לא היה לי מהלך אחר/ }));
    expect(onAnswer).toHaveBeenCalledWith(null);
  });

  it("records the move the player put on the board", () => {
    const onAnswer = vi.fn();
    setup({ alternative: "g1f3", onAnswer });
    fireEvent.click(screen.getByRole("button", { name: /רשמו/ }));
    expect(onAnswer).toHaveBeenCalledWith("g1f3");
  });

  it("cannot confirm a move before one has been named", () => {
    // The confirm button with no move behind it would send `null` down the same path as the
    // deliberate "I had nothing else", and those are different answers.
    const onAnswer = vi.fn();
    setup({ alternative: null, onAnswer });
    const confirm = screen.queryByRole("button", { name: /רשמו/ });
    if (confirm) fireEvent.click(confirm);
    expect(onAnswer).not.toHaveBeenCalledWith(null);
  });

  it("says how to name a move, because there is no move field", () => {
    // The alternative is played on the board, the same way the committed move was chosen.
    setup();
    expect(document.body.textContent).toMatch(/לוח/);
  });

  it("refuses the committed move as its own alternative", () => {
    /*
     * "What would you have played instead" cannot be answered with the move that was played, and
     * a board interaction can easily produce it -- the piece is already there. Accepting it would
     * put a row in the record whose two moves are the same, and `classifyCounterfactual` would
     * then read every such row as `both-good` or `neither` depending only on the chosen move.
     */
    const onAnswer = vi.fn();
    setup({ chosenMove: "e2e4", alternative: "e2e4", onAnswer });
    const confirm = screen.queryByRole("button", { name: /רשמו/ });
    if (confirm) fireEvent.click(confirm);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/אותו מהלך|המהלך שנרשם/);
  });
});

describe("while the answer is being stored", () => {
  it("stops a second answer going out", () => {
    const onAnswer = vi.fn();
    setup({ alternative: "g1f3", onAnswer, pending: true });
    for (const button of document.querySelectorAll("button")) fireEvent.click(button);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
