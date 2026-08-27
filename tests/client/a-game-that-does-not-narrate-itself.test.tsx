// @vitest-environment jsdom
/**
 * What a silent game puts on screen, and what it must never put there.
 *
 * A PLAYER FORTY MOVES INTO A DEFERRED GAME WITH NOTHING ON SCREEN cannot tell "the engine is
 * quiet by design" from "the engine broke". This product has shipped that confusion once already
 * -- a reveal that sat on "המנוע מחשב…" forever with no control that advanced -- and a
 * `setNotice` call does not fix it, because a notice is transient and this condition lasts the
 * whole game.
 *
 * AND THE PANEL IS THE ONE PLACE THE CONDITION COULD LEAK. Everything else on this screen during
 * a deferred game is a board and a form; this is the only surface with something to say.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SilentGame } from "../../client/src/components/SilentGame";

const setup = (props: Partial<Parameters<typeof SilentGame>[0]> = {}) =>
  render(<SilentGame decisions={7} over={false} onSeeRecord={vi.fn()} {...props} />);

describe("while the game is running", () => {
  it("says the silence is the setting, not a fault", () => {
    setup();
    expect(document.body.textContent).toMatch(/אין תקלה/);
  });

  it("says the decisions are being measured, not merely stored", () => {
    /*
     * The fear this answers is not "am I being recorded" but "is any of this counting". A player
     * who believes the measurement only starts at the end has been given a reason to treat the
     * early moves as practice, which would put a real gradient across the game.
     */
    setup();
    expect(document.body.textContent).toMatch(/נרשמת\s*ונמדדת|נמדדה|נמדדת/);
  });

  it("counts decisions in this game", () => {
    setup({ decisions: 7 });
    expect(document.body.textContent).toContain("7");
  });

  it("offers no way to see a verdict early", () => {
    /*
     * THE ASSERTION THE MODE EXISTS FOR. One button to the record mid-game would let the player
     * out of the condition they chose, and the record would still say `end-of-game` for every
     * decision after it -- a wrong condition, which is worse than an absent one because it looks
     * like a control.
     */
    setup({ over: false });
    expect(document.querySelectorAll("button")).toHaveLength(0);
  });

  it("shows no evaluation of any kind", () => {
    setup();
    expect(document.body.textContent).not.toMatch(/[+-]?\d+\.\d\d|ס״פ|cp/i);
  });
});

describe("once the game is over", () => {
  it("says so, and opens the way to the record", () => {
    const onSeeRecord = vi.fn();
    setup({ over: true, onSeeRecord });
    expect(screen.getByText(/המשחק נגמר/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /לרשומה/ }));
    expect(onSeeRecord).toHaveBeenCalled();
  });

  it("still shows no evaluation on this panel", () => {
    // The record is where the verdicts are. This panel is a door, not a summary.
    setup({ over: true });
    expect(document.body.textContent).not.toMatch(/[+-]?\d+\.\d\d|ס״פ/);
  });
});
