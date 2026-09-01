/**
 * GATE-TWO-HANDS: the machine's colour is never something a player can press, and the machine's
 * own surfaces are never drawn in the player's material.
 *
 * WHY IT IS A GATE AND NOT A PREFERENCE. `client/src/index.css`'s semantic layer is the
 * `MODE_CONTRACT` written as colour: `engineMayRun` is false in every mode where the player is
 * producing evidence, the type system makes a commitment event carrying an evaluation
 * unbuildable, and the engine is a dynamic import so it cannot reach the network tab before a
 * decision is recorded. Three enforcements of one rule, and until now none of them reached the
 * stylesheet -- where the engine's arrow and the player's own selected square were the same hue,
 * on the same board, in the same state.
 *
 * BOTH DIRECTIONS, because a one-directional check cannot fail the way the design fails. See the
 * note at the top of `scripts/two-hands-scan.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  MACHINE_SURFACES,
  controlsSpeakingInTheMachinesColour,
  isInteractive,
  machineSurfacesNotSpeakingInIt,
  stylesheet,
} from "../../scripts/two-hands-scan";

describe("the machine may speak and may not ask for anything", () => {
  it("no rule a player can press paints in the machine's colour", () => {
    const found = controlsSpeakingInTheMachinesColour(stylesheet());
    expect(
      found.map((b) => `${b.selector} (line ${b.line})`),
      "a control wearing the engine's hue",
    ).toEqual([]);
  });

  it("every surface the engine owns paints in it", () => {
    expect(machineSurfacesNotSpeakingInIt(stylesheet()), "engine output in the page's ink").toEqual(
      [],
    );
  });

  it("the list of machine surfaces is not empty, so the second assertion can fail", () => {
    /*
     * A LIST THAT EMPTIED ITSELF would make the assertion above pass forever. This repository has
     * already shipped a suite that reported green having evaluated one node in forty; a gate whose
     * subject can vanish is the same defect with fewer moving parts.
     */
    expect(MACHINE_SURFACES.length).toBeGreaterThanOrEqual(8);
  });
});

describe("what the predicate calls a control", () => {
  it("sees elements, states and the naming conventions this product uses", () => {
    for (const selector of [
      ".primary-control",
      ".commitment-submit",
      ".read-chip.selected",
      "button:focus-visible",
      '.import-source[aria-pressed="true"]',
      ".context-why summary",
      ".blitz-control--again:hover",
    ]) {
      expect(isInteractive(selector), selector).toBe(true);
    }
  });

  it("leaves the board's own marks and the engine's own surfaces alone", () => {
    for (const selector of [
      ".board-vectors line",
      ".evaluation-track",
      ".analysis-column",
      ".light-square",
      ":root",
    ]) {
      expect(isInteractive(selector), selector).toBe(false);
    }
  });
});
