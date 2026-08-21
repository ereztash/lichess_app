/**
 * GATE-PREREG positive control: a drill starter with no pre-registration check.
 * Expected to FAIL -- that failure is the proof the gate is a gate.
 */
import { describe, expect, it } from "vitest";
import type { DrillSpec } from "../../../shared/claim";
import { preregVerdict } from "../prereg-scenario";

/** THE DEFECT: starts whatever it is handed. */
function permissiveStartDrill(spec: DrillSpec) {
  return { spec, started_at: "2026-08-22T00:00:00Z", predicted: true };
}

describe("GATE-PREREG control: a drill starter with no check", () => {
  it("must refuse a drill with no refutation condition (this is expected to fail)", () => {
    const verdict = preregVerdict(permissiveStartDrill);
    expect(verdict.ok, verdict.detail).toBe(true);
  });
});
