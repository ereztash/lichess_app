/**
 * POSITIVE CONTROL for GATE-TWO-HANDS. Expected to FAIL, twice.
 *
 * The predicates are the gate's own, run over `tests/fixtures/two-hands` -- a stylesheet in
 * miniature in exactly the shape the shipped one was in before this pass: a primary control
 * wearing the engine's hue, and the engine's largest object drawn in the page's ink.
 *
 * TWO ASSERTIONS BECAUSE THE GATE HAS TWO DIRECTIONS. A control that only reddened one of them
 * would leave the other unproven, which is the argument `GATE-NO-DUPLICATE-ACTION` already makes
 * for having been split off from `GATE-ONE-PRIMARY-ACTION`.
 */
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  controlsSpeakingInTheMachinesColour,
  machineSurfacesNotSpeakingInIt,
  stylesheet,
} from "../../../scripts/two-hands-scan";

const css = () => stylesheet(resolve(__dirname, "../two-hands"));

describe("GATE-TWO-HANDS control", () => {
  it("notices a control wearing the engine's hue", () => {
    const found = controlsSpeakingInTheMachinesColour(css());
    expect(found.map((b) => `${b.selector} (line ${b.line})`)).toEqual([]);
  });

  it("notices the engine's largest object drawn in the page's ink", () => {
    expect(machineSurfacesNotSpeakingInIt(css())).toEqual([]);
  });
});
