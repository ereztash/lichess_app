/**
 * GATE-MEASURE positive control, run as a Vitest file.
 *
 * It asserts EXACTLY what tests/gates/measurement.test.ts asserts, against the split as it
 * shipped: a missing think time coerced to zero, and no eligibility step before the two sides are
 * taken. It is expected to FAIL, and that failure is the proof the gate is a gate.
 *
 * It lives under tests/fixtures/, which vitest.config.ts excludes from the normal run, so it never
 * breaks `npm test`. The gate runner invokes it explicitly in --positive-controls mode.
 */
import { describe, expect, it } from "vitest";
import { legacySplit, membershipVerdict } from "../measurement-scenario";

describe("GATE-MEASURE control: the split as it shipped", () => {
  it("must keep every bucket unchanged by unmeasured decisions (this is expected to fail)", () => {
    const verdict = membershipVerdict(legacySplit);
    expect(verdict.ok, verdict.detail).toBe(true);
  });
});
