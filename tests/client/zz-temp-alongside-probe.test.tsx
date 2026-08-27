// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { crossVariables } from "@shared/crossing";
import { readVariables } from "@shared/bucket-variable";
import { detect, type ScoredDecision } from "@shared/detector";
import { ProfilePanel } from "@/components/ProfilePanel";

let i = 0;
const mk = (
  phase: "opening" | "middlegame" | "endgame",
  secondsTaken: number,
  confidence: number,
  accurate: boolean,
): ScoredDecision => ({
  decision_id: `d${i++}`,
  fen: "8/8/8/8/8/8/8/8 w - - 0 1",
  phase,
  secondsTaken,
  clockMsRemaining: null,
  confidence,
  accurate,
});

function report(label: string, decisions: ScoredDecision[]) {
  const crossing = crossVariables(decisions);
  const variables = readVariables(detect(decisions));
  console.log(`\n########## ${label} (n=${decisions.length}) ##########`);
  for (const f of crossing.findings) {
    console.log("CrossedFinding", f.pair,
      "| strongest", f.strongest.key,
      "| mirrored", f.mirrored.map((c) => c.key),
      "| alongside", f.alongside.map((c) => `${c.key} gapDiff=${c.gapDifference.toFixed(3)} n=${c.inside.n}`));
  }
  for (const v of variables.findings) {
    console.log("VariableFinding", v.variable.key,
      "| strongest", v.strongest.key,
      "| mirrored", v.mirrored.map((c) => c.key),
      "| alongside", v.alongside.map((c) => `${c.key} gapDiff=${c.gapDifference.toFixed(3)} n=${c.inside.n}`));
  }
  const { container } = render(<ProfilePanel variables={variables} crossing={crossing} />);
  console.log("-- rendered VARIABLE rows (marginal panel) --");
  for (const li of Array.from(container.querySelectorAll("li.profile-panel__variable"))) {
    console.log("  " + JSON.stringify(li.textContent));
  }
  console.log("-- rendered CROSSING rows --");
  for (const li of Array.from(container.querySelectorAll("li.profile-panel__crossing"))) {
    console.log("  " + JSON.stringify(li.textContent));
  }
  console.log("  .profile-panel__alongside in VARIABLE rows:",
    container.querySelectorAll("li.profile-panel__variable .profile-panel__alongside").length);
  console.log("  .profile-panel__alongside in CROSSING rows:",
    container.querySelectorAll("li.profile-panel__crossing .profile-panel__alongside").length);
  return { crossing, variables, container };
}

describe("alongside: crossing vs marginal", () => {
  it("A: a crossed finding with a same-side second cell", () => {
    const d: ScoredDecision[] = [];
    for (let k = 0; k < 40; k++) d.push(mk("opening", 10, k % 10 === 0 ? 0.9 : 1.0, false));
    for (let k = 0; k < 40; k++) d.push(mk("middlegame", 10, k % 10 === 0 ? 0.9 : 1.0, false));
    for (const p of ["opening", "middlegame", "endgame"] as const)
      for (let k = 0; k < 40; k++) d.push(mk(p, 300, 0.5, k % 2 === 0));
    for (let k = 0; k < 40; k++) d.push(mk("endgame", 10, 0.5, k % 2 === 0));
    const { crossing, container } = report("A: crossing has alongside", d);
    expect(crossing.findings[0].alongside.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("li.profile-panel__crossing .profile-panel__alongside").length).toBe(0);
  });

  it("B: a marginal finding with a same-side second level", () => {
    const d: ScoredDecision[] = [];
    for (let k = 0; k < 60; k++) d.push(mk("opening", 60, k % 10 === 0 ? 0.9 : 1.0, false));
    for (let k = 0; k < 60; k++) d.push(mk("middlegame", 60, k % 12 === 0 ? 0.9 : 1.0, false));
    for (let k = 0; k < 120; k++) d.push(mk("endgame", 60, 0.5, k % 2 === 0));
    const { variables, container } = report("B: marginal has alongside", d);
    expect(variables.findings.some((v) => v.alongside.length > 0)).toBe(true);
    expect(container.querySelectorAll("li.profile-panel__variable .profile-panel__alongside").length).toBeGreaterThan(0);
  });
});
