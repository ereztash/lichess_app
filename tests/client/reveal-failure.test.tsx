// @vitest-environment jsdom
/**
 * The soft lock at the end of the reveal.
 *
 * `setStage("revealed")` runs before the engine is started. If the search threw, or if storing
 * its verdict threw, the session sat in `revealed` with no control that advances -- the header's
 * "ההחלטה הבאה" is gated on `revealedDecisionId`, which is set only after a successful write.
 * The only escape was abandoning the game.
 *
 * That is not a rare path. docs/MEASUREMENTS.md records that the deployed engine has never been
 * observed producing an evaluation, so the least-tested branch in the build ended in a dead end.
 *
 * Two things are asserted here, and the split is deliberate:
 *
 *   - the panel itself is rendered for both kinds, which is a real component test;
 *   - the WIRING in Home.tsx is asserted against its source, the same technique
 *     game-review.test.tsx uses for the R3 gate. Nothing in this repository renders Home end to
 *     end -- it needs an engine, a tRPC client and a record store -- so a source assertion is
 *     what is actually available, and pretending otherwise would be the weaker test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RevealFailure } from "../../client/src/components/RevealFailure";
import { NEXT_POSITION_CTA } from "../../client/src/components/RevealNextPosition";

/** The three sentences a way out of a failed reveal is allowed to say, named once. */
const IN_GAME_CTA = "להחלטה הבאה";
const RECORD_CTA = "חזרה לרשומה";

/**
 * What the caller has to supply, with the bank route left inert.
 *
 * `onContinue` is a spy because a test needs to know whether the press reached it. The bank route
 * is handed to `RevealNextPosition`, which owns its own label, act and press -- so nothing here
 * asserts on its behaviour, only that the failure panel hands the question to it.
 */
function props() {
  return {
    onContinue: vi.fn(),
    bank: { answered: [], onServed: vi.fn(), navigate: vi.fn() },
  };
}

describe("both failures offer a way out", () => {
  for (const kind of ["engine", "write"] as const) {
    it(`renders an advance control on a ${kind} failure`, () => {
      const h = props();
      render(<RevealFailure kind={kind} continues {...h} />);
      const advance = screen.getByRole("button", { name: /להחלטה הבאה/ });
      fireEvent.click(advance);
      expect(h.onContinue).toHaveBeenCalledTimes(1);
    });

    /*
     * THE LABEL AND THE ACT TRAVEL TOGETHER, AND NEITHER IS THE CALLER'S TO STATE.
     *
     * HISTORY, kept because it is the reason this test exists. The label was once the constant
     * "להחלטה הבאה" while the handler was whatever the caller passed. When the caller learned to
     * route to the record, the control named one act and performed another; an adversarial pass
     * walked exactly that. The first repair had the caller pass label, act and handler as one
     * object -- which only moved the mismatch one layer up, where nothing could see it.
     *
     * So what is asserted is the pairing rule itself, over whichever control the panel renders:
     * a control declaring `next-decision` leads to a board and must not wear the record's words;
     * a control declaring `return-record` must. That holds for the in-game way on, for the bank
     * route, and for the exhausted-set case the bank route re-renders into.
     */
    for (const continues of [true, false]) {
      it(`pairs its words with the act it declares (${kind}, continues=${continues})`, () => {
        render(<RevealFailure kind={kind} continues={continues} {...props()} />);
        const ways = screen
          .getAllByRole("button")
          .filter((button) => button.hasAttribute("data-primary-action"));
        expect(ways, "a failed reveal offered no declared way out").toHaveLength(1);
        const act = ways[0].getAttribute("data-primary-action");
        const said = (ways[0].textContent ?? "").trim();
        if (act === "return-record") expect(said).toBe(RECORD_CTA);
        else {
          expect(act, `an undeclared act said "${said}"`).toBe("next-decision");
          expect([IN_GAME_CTA, NEXT_POSITION_CTA], `next-decision said "${said}"`).toContain(said);
        }
      });
    }

    /*
     * AND THE FORWARD CASE IS THE ONE THE PANEL OWNS. Where the game on the board holds another
     * position, the way out is this panel's own control and it stays inside the game. Where it
     * does not, the panel hands the question to the component that can answer it after the press.
     */
    it(`hands the bank route over rather than labelling it early (${kind})`, () => {
      const { unmount } = render(<RevealFailure kind={kind} continues {...props()} />);
      expect(screen.getByRole("button", { name: IN_GAME_CTA }).className).toContain(
        "reveal-failure-next",
      );
      unmount();
      render(<RevealFailure kind={kind} continues={false} {...props()} />);
      // `RevealNextPosition`'s control, brought in whole: it carries its own chrome, so a
      // `.reveal-failure-next` here would be a div wearing a button's border.
      expect(screen.getByRole("button", { name: NEXT_POSITION_CTA }).className).toContain(
        "primary-control",
      );
    });

    it(`says the decision is safe on a ${kind} failure`, () => {
      // The first thing said, on both, because it is the part that is not bad news: the commit
      // is written before the engine is ever started, so a failure here cannot cost it.
      render(<RevealFailure kind={kind} continues {...props()} />);
      expect(screen.getByText(/ההחלטה עצמה נרשמה/)).toBeTruthy();
    });
  }

  it("does not render the two failures with the same words", () => {
    // They are different events. An engine that never answered leaves no evaluation to show; a
    // failed write leaves a valid reveal on screen that simply will not count.
    const engine = render(<RevealFailure kind="engine" continues {...props()} />).container.textContent;
    const write = render(<RevealFailure kind="write" continues {...props()} />).container.textContent;
    expect(engine).not.toBe(write);
    expect(engine).toMatch(/המנוע לא סיים/);
    expect(write).toMatch(/לא נשמרה/);
  });
});

describe("Home reaches the panel from both catches", () => {
  const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const code = home.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("sets a failure kind in each of the two catch blocks", () => {
    expect(code, "the write-failure catch does not set a kind").toMatch(
      /setRevealFailure\("write"\)/,
    );
    expect(code, "the engine-failure catch does not set a kind").toMatch(
      /setRevealFailure\("engine"\)/,
    );
  });

  it("renders the panel, and stops rendering the waiting line when it does", () => {
    expect(code).toMatch(/<RevealFailure/);
    // The forever-spinner was the visible symptom: "המנוע מחשב…" has to be conditional on there
    // being no failure, or the engine branch still shows a calculation that is not happening.
    expect(code, "the waiting line is not gated on the failure state").toMatch(
      /revealFailure === null \?[\s\S]{0,160}reveal-waiting/,
    );
  });

  it("clears the failure when the next decision starts", () => {
    // Otherwise the panel outlives the decision that produced it and the next reveal opens with
    // a stale alarm on screen.
    expect(code.match(/setRevealFailure\(null\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
