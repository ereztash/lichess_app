/**
 * GATE-PREREG positive control: drill starters that do not pre-register enough.
 * Expected to FAIL -- that failure is the proof the gate is a gate.
 *
 * TWO STARTERS, BECAUSE THE PREDICATE NOW HAS TWO HALVES AND THE FIRST CASE SHORT-CIRCUITS IT.
 * A single starter that checks nothing reddens on the null condition and never reaches the
 * direction, which would leave the newer half of the gate unproven -- the same "control passed
 * for the wrong reason" that this suite exists to rule out.
 */
import { describe, expect, it } from "vitest";
import type { DrillSpec } from "../../../shared/claim";
import { preregVerdict } from "../prereg-scenario";

/** THE DEFECT: starts whatever it is handed. */
function permissiveStartDrill(spec: DrillSpec) {
  return { spec, started_at: "2026-08-22T00:00:00Z", predicted: true };
}

/**
 * THE DEFECT AS IT ACTUALLY SHIPPED: the condition is checked, the direction is not.
 *
 * This is `startDrill` exactly as it stood while `finishDrill` passed the constant
 * `predictsOverconfidence: true`. It refuses a drill that could not have failed and accepts one
 * whose sign nobody wrote down -- which is how an underconfidence claim came to be graded on the
 * overconfidence side and refuted by evidence that confirmed it.
 */
function startDrillCheckingOnlyTheSentence(spec: DrillSpec) {
  const condition = spec?.refutation_condition;
  if (typeof condition !== "string" || condition.trim().length === 0) {
    throw new Error("no stored refutation condition");
  }
  return { spec, started_at: "2026-08-22T00:00:00Z", predicted: true };
}

describe("GATE-PREREG control: a drill starter with no check", () => {
  it("must refuse a drill with no refutation condition (this is expected to fail)", () => {
    const verdict = preregVerdict(permissiveStartDrill);
    expect(verdict.ok, verdict.detail).toBe(true);
  });
});

describe("GATE-PREREG control: a drill starter that checks the sentence but not the sign", () => {
  it("must refuse a drill with no stored direction (this is expected to fail)", () => {
    const verdict = preregVerdict(startDrillCheckingOnlyTheSentence);
    expect(verdict.ok, verdict.detail).toBe(true);
  });
});
