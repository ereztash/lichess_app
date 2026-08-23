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

describe("both failures offer a way out", () => {
  for (const kind of ["engine", "write"] as const) {
    it(`renders an advance control on a ${kind} failure`, () => {
      const onNext = vi.fn();
      render(<RevealFailure kind={kind} onNext={onNext} />);
      const advance = screen.getByRole("button", { name: /להחלטה הבאה/ });
      fireEvent.click(advance);
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it(`says the decision is safe on a ${kind} failure`, () => {
      // The first thing said, on both, because it is the part that is not bad news: the commit
      // is written before the engine is ever started, so a failure here cannot cost it.
      render(<RevealFailure kind={kind} onNext={vi.fn()} />);
      expect(screen.getByText(/ההחלטה עצמה נרשמה/)).toBeTruthy();
    });
  }

  it("does not render the two failures with the same words", () => {
    // They are different events. An engine that never answered leaves no evaluation to show; a
    // failed write leaves a valid reveal on screen that simply will not count.
    const engine = render(<RevealFailure kind="engine" onNext={vi.fn()} />).container.textContent;
    const write = render(<RevealFailure kind="write" onNext={vi.fn()} />).container.textContent;
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
