/**
 * Gate runner.
 *
 * Two modes:
 *   npm run gates            -- run every gate against the real code. Any FAIL exits non-zero.
 *   npm run gates:controls   -- run every gate against a deliberately-broken fixture.
 *                               Any control that does NOT go red exits non-zero, because a gate
 *                               that has never failed has not been shown to be a gate.
 *
 * A gate that cannot run reports NOT-MEASURED, which is distinct from PASS and is never
 * silently counted as success.
 */

export type GateStatus = "PASS" | "FAIL" | "NOT-MEASURED";
export interface GateResult {
  status: GateStatus;
  detail: string;
}
export interface Gate {
  id: string;
  rule: string;
  description: string;
  /** Run against the real codebase. */
  run: () => Promise<GateResult> | GateResult;
  /** Run against a deliberately-broken fixture. MUST return FAIL for the gate to be valid. */
  positiveControl: () => Promise<GateResult> | GateResult;
}

const notMeasured = (detail: string): GateResult => ({ status: "NOT-MEASURED", detail });

export const GATES: Gate[] = [
  {
    id: "GATE-ISO",
    rule: "3.1",
    description: "Every decision atom present in all three layers under identical field names.",
    run: () => notMeasured("record layer not built yet (step 3)"),
    positiveControl: () => notMeasured("record layer not built yet (step 3)"),
  },
  {
    id: "GATE-NO-FAKE",
    rule: "R2",
    description: "No displayed value without provenance; no placeholder value in a render path.",
    run: () => notMeasured("provenance component not built yet (step 4)"),
    positiveControl: () => notMeasured("provenance component not built yet (step 4)"),
  },
  {
    id: "GATE-DENOM",
    rule: "R1",
    description: "No percentage rendered without its denominator.",
    run: () => notMeasured("provenance component not built yet (step 4)"),
    positiveControl: () => notMeasured("provenance component not built yet (step 4)"),
  },
  {
    id: "GATE-STALE",
    rule: "4.3",
    description: "A result rendered against an input it was not computed for is marked stale.",
    run: () => notMeasured("guards not built yet (step 5)"),
    positiveControl: () => notMeasured("guards not built yet (step 5)"),
  },
  {
    id: "GATE-GRADE",
    rule: "3.3",
    description: "No claim renders above its grade.",
    run: () => notMeasured("claim layer not built yet (step 6)"),
    positiveControl: () => notMeasured("claim layer not built yet (step 6)"),
  },
  {
    id: "GATE-PREREG",
    rule: "R5",
    description: "A drill cannot start without a stored refutation_condition.",
    run: () => notMeasured("drills not built yet (step 7)"),
    positiveControl: () => notMeasured("drills not built yet (step 7)"),
  },
  {
    id: "GATE-EXTERNAL",
    rule: "R4",
    description: "An external pointer cannot raise a claim's grade.",
    run: () => notMeasured("Layer C not built yet (step 8)"),
    positiveControl: () => notMeasured("Layer C not built yet (step 8)"),
  },
  {
    id: "GATE-COMMIT",
    rule: "R3",
    description: "No engine output reaches the client before a decision is recorded.",
    run: () => notMeasured("commitment screen not built yet (step 3)"),
    positiveControl: () => notMeasured("commitment screen not built yet (step 3)"),
  },
  {
    id: "GATE-SHUFFLE",
    rule: "6",
    description: "The pattern detector finds nothing above threshold in shuffled labels.",
    run: () => notMeasured("detector not built yet (step 6)"),
    positiveControl: () => notMeasured("detector not built yet (step 6)"),
  },
];

const ICON: Record<GateStatus, string> = {
  PASS: "PASS ",
  FAIL: "FAIL ",
  "NOT-MEASURED": "N/M  ",
};

async function main() {
  const controlMode = process.argv.includes("--positive-controls");
  const header = controlMode
    ? "Gate positive controls -- every gate must go RED here"
    : "Gates -- real codebase";
  console.log(`\n${header}\n${"-".repeat(header.length)}`);

  const tally: Record<GateStatus, number> = { PASS: 0, FAIL: 0, "NOT-MEASURED": 0 };
  let invalidControls = 0;

  for (const gate of GATES) {
    const result = await (controlMode ? gate.positiveControl() : gate.run());
    tally[result.status] += 1;
    console.log(`${ICON[result.status]} ${gate.id.padEnd(14)} [${gate.rule}] ${result.detail}`);
    // In control mode a gate that does not go red has not been shown to be a gate.
    if (controlMode && result.status === "PASS") {
      invalidControls += 1;
      console.log(`      ^^ control did NOT go red -- ${gate.id} is not proven to be a gate`);
    }
  }

  console.log(
    `\n${GATES.length} gates: ${tally.PASS} pass, ${tally.FAIL} fail, ${tally["NOT-MEASURED"]} not-measured`,
  );

  if (controlMode) {
    if (invalidControls > 0) {
      console.error(`\n${invalidControls} positive control(s) failed to go red.`);
      process.exit(1);
    }
    console.log("All implemented controls went red.");
    return;
  }

  if (tally.FAIL > 0) {
    console.error(`\n${tally.FAIL} gate(s) red.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Gate runner crashed:", error);
  process.exit(1);
});
