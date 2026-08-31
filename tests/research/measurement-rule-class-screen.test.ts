/**
 * THE RECOMMENDATION HAS TO FOLLOW FROM THE MEASUREMENTS, AND THIS IS WHAT CHECKS IT.
 *
 * `docs/measurement/RULE_CLASS_SCREEN.json` is produced by `research/measurement/decide_rule_class.py`
 * from the engine screen, not written by hand. That is only worth anything if something notices
 * when the two come apart -- a hand-edited row, a gate quietly relaxed, a recommendation for a
 * candidate that failed one. This file is that something, and it runs on every build with no
 * Python and no engine in the loop.
 *
 * IT ASSERTS CONSISTENCY, NOT RESULTS. It does not care which rule class won or whether any did;
 * a screen where nothing is eligible passes this file, because "nothing is eligible" is a
 * legitimate outcome and pinning a winner would make the test an obstacle to reporting one.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface Row {
  id: string;
  name: string;
  role: string;
  verdict: string;
  eligible: boolean;
  gates: Record<string, boolean | null>;
  measurements?: {
    b_valid_t_plus: number | null;
    chance_rate_t_plus: number | null;
    lift_over_chance_t_plus: number | null;
    separation: number | null;
    position_between_anchors: number | null;
    base_rate_t_plus: number | null;
  };
}

interface Screen {
  anchors: { ceiling: string; ceiling_separation: number; floor: string; floor_separation: number };
  rows: Row[];
  eligible_ranked: string[];
  recommended: string | null;
}

const screen = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../docs/measurement/RULE_CLASS_SCREEN.json", import.meta.url)),
    "utf8",
  ),
) as Screen;

const GATES = [
  "G1_structural",
  "G2_testable",
  "G3_occurs",
  "G4_beats_chance",
  "G5_beats_incumbent",
] as const;

describe("the anchor scale, without which every ranking below is meaningless", () => {
  it("the ceiling is sharper than the floor", () => {
    /*
     * If the sharpest rule class chess allows did not out-separate the rule class already shown
     * to be uninterpretable, the measurement would not be measuring sharpness at all, and
     * `position_between_anchors` would be a ratio over a meaningless interval.
     */
    expect(screen.anchors.ceiling_separation).toBeGreaterThan(screen.anchors.floor_separation);
  });

  it("names both anchors and they appear as rows", () => {
    const ids = screen.rows.map((r) => r.id);
    expect(ids).toContain(screen.anchors.ceiling);
    expect(ids).toContain(screen.anchors.floor);
  });

  it("an anchor is never a candidate for adoption", () => {
    for (const r of screen.rows) {
      if (r.role !== "candidate") {
        expect(r.eligible).toBe(false);
        expect(screen.eligible_ranked).not.toContain(r.id);
      }
    }
  });
});

describe("every row states every gate", () => {
  it.each(screen.rows.map((r) => [r.id, r] as const))("%s", (_id, row) => {
    for (const g of GATES) expect(row.gates).toHaveProperty(g);
    expect(["ANCHOR", "ELIGIBLE", "FAILS-A-GATE", "UNTESTED"]).toContain(row.verdict);
  });
});

describe("eligibility follows from the gates, and the gates follow from the measurements", () => {
  it("no eligible row failed a gate", () => {
    for (const r of screen.rows.filter((x) => x.eligible)) {
      for (const g of GATES) expect(r.gates[g]).toBe(true);
    }
  });

  it("a candidate whose trigger is defined by a chosen action can never be eligible", () => {
    /*
     * G1 is the Lichess `hangingPiece` failure as a gate: that theme is computed from the
     * solution's first move, so a trigger graded that way contains the behaviour it is supposed
     * to predict. Nothing graded so may be recommended, whatever else it scores.
     */
    for (const r of screen.rows) {
      if (r.gates.G1_structural === false) {
        expect(r.eligible).toBe(false);
        expect(screen.eligible_ranked).not.toContain(r.id);
        expect(screen.recommended).not.toBe(r.id);
      }
    }
  });

  it("G4 is the item's own chance rate, recomputed here rather than trusted", () => {
    for (const r of screen.rows) {
      const m = r.measurements;
      if (!m || m.b_valid_t_plus === null || m.chance_rate_t_plus === null) continue;
      expect(r.gates.G4_beats_chance).toBe(m.b_valid_t_plus > m.chance_rate_t_plus);
    }
  });

  it("G5 is measured against the incumbent floor, recomputed here", () => {
    for (const r of screen.rows) {
      const m = r.measurements;
      if (!m || m.separation === null) continue;
      expect(r.gates.G5_beats_incumbent).toBe(m.separation > screen.anchors.floor_separation);
    }
  });

  it("the recommendation is the top of the ranking, or nothing", () => {
    if (screen.recommended === null) {
      expect(screen.eligible_ranked).toHaveLength(0);
    } else {
      expect(screen.eligible_ranked[0]).toBe(screen.recommended);
    }
  });

  it("the ranking is ordered by distance from the incumbent toward the ceiling", () => {
    const scores = screen.eligible_ranked.map(
      (id) => screen.rows.find((r) => r.id === id)?.measurements?.position_between_anchors ?? 0,
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });
});

describe("the outcome this file must not obstruct", () => {
  it("accepts a screen in which nothing is eligible", () => {
    /*
     * "No rule class in any family tried has an identifiable knowledge-to-action link" is a real
     * and important result. A test that required a winner would make it unreportable, which is
     * the same failure mode as a research program that cannot say REJECT.
     */
    expect(Array.isArray(screen.eligible_ranked)).toBe(true);
    expect(screen.recommended === null || typeof screen.recommended === "string").toBe(true);
  });
});
