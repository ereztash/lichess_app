/**
 * THE DECISION MODEL'S TABLE, HELD AGAINST THE RUN THAT PRODUCED IT.
 *
 * `docs/measurement/ACTION_SET_MODEL.json` is written by `research/measurement/decide_action_set.py`
 * from the engine run, never by hand, and `docs/measurement/ACTION_SET_REANALYSIS.md` quotes it.
 * That arrangement is worth nothing unless something notices when the three come apart -- a row
 * edited to read better, a gate quietly relaxed, a number in the prose that no longer matches the
 * column it came from. This file is that something, and it runs with no Python and no engine.
 *
 * IT ASSERTS CONSISTENCY, NOT RESULTS -- the same rule `measurement-rule-class-screen.test.ts`
 * follows. It does not care which rule class won, whether any did, or whether the decision model
 * agreed with the top-1 screen. A run where nothing is eligible passes, because "nothing is
 * eligible" is a legitimate outcome and pinning a winner would make this file an obstacle to
 * reporting one.
 *
 * IT DOES CHECK ONE INVARIANT THAT IS NOT A CONVENTION. `regret` is defined as V* - V_B with
 * V* := max(V_B, V_notB), so it CANNOT be negative. The first version of the adjudicator took V*
 * from a full-width search and V_B from a root-restricted one at the same node budget; the
 * restricted search goes deeper on fewer root moves and returned V_B > V*, i.e. a negative
 * regret, on real items. That is not a rounding artefact, it is a wrong basis, and it is the kind
 * of defect that reads as a small negative number in a table nobody re-derives. So the sign is
 * held here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

interface Row {
  id: string;
  name: string | null;
  role?: string;
  verdict: string;
  eligible: boolean;
  gates: Record<string, boolean | null>;
  published_gates_this_engine?: Record<string, boolean | null>;
  measurements?: {
    regret_b_xs_mean_t_plus: number | null;
    regret_b_xs_mean_t_minus: number | null;
    separation_regret_xs: number | null;
    advantage_over_chance_t_plus: number | null;
    advantage_over_chance_t_plus_ci95: [number | null, number | null] | null;
    separation_advantage_over_chance_xs: number | null;
    permitted_moves_safe_t_plus: number | null;
    b_valid_t_plus: number | null;
    separation_b_valid: number | null;
    prescription_size_mean_t_plus: number | null;
    position_between_anchors: number | null;
  };
}

interface Model {
  anchors: {
    ceiling: string; ceiling_separation: number | null;
    floor: string; floor_separation: number | null;
  };
  rows: Row[];
  eligible_ranked: string[];
  recommended: string | null;
  verdict_changes: {
    promoted_by_decision_model: string[];
    demoted_by_decision_model: string[];
    agree: string[];
  };
}

const model = JSON.parse(
  readFileSync(resolve(root, "docs/measurement/ACTION_SET_MODEL.json"), "utf8"),
) as Model;
const doc = readFileSync(resolve(root, "docs/measurement/ACTION_SET_REANALYSIS.md"), "utf8");

const GATES = [
  "A1_measurable",
  "A2_beats_chance",
  "A3_efficacious",
  "A4_discriminating",
  "A5_beats_incumbent",
] as const;

const byId = new Map(model.rows.map((r) => [r.id, r]));
const scored = model.rows.filter((r) => r.measurements && !["RC-00", "RC-01"].includes(r.id));

describe("the gates, applied rather than described", () => {
  it("every row carries every gate, so none can be silently skipped", () => {
    for (const row of model.rows) {
      expect(Object.keys(row.gates).sort()).toEqual([...GATES].sort());
    }
  });

  it("eligible means all five passed, and nothing else does", () => {
    for (const row of model.rows) {
      expect(row.eligible).toBe(GATES.every((g) => row.gates[g] === true));
    }
  });

  it("A2 is the chance interval it claims to be", () => {
    /*
     * The gate says the paired advantage over a size-matched RANDOM prescription has a 95%
     * interval strictly above zero. If the flag and the interval disagree, the chance control is
     * decorative and every necessity claim in the document rests on nothing.
     */
    for (const row of scored) {
      const ci = row.measurements?.advantage_over_chance_t_plus_ci95;
      const lower = ci?.[0];
      expect(row.gates.A2_beats_chance).toBe(typeof lower === "number" && lower > 0);
    }
  });

  it("A5 is measured against the incumbent this run recorded, not a remembered one", () => {
    const floor = model.anchors.floor_separation;
    for (const row of scored) {
      const sep = row.measurements?.separation_advantage_over_chance_xs;
      const expected =
        typeof sep === "number" && typeof floor === "number" ? sep > floor : false;
      expect(row.gates.A5_beats_incumbent).toBe(expected);
    }
  });

  it("A3 agrees with the efficacy separation it is read from", () => {
    for (const row of scored) {
      const sep = row.measurements?.separation_regret_xs;
      expect(row.gates.A3_efficacious).toBe(typeof sep === "number" && sep > 0);
    }
  });
});

describe("regret is a distance and cannot be negative", () => {
  it("holds in both cells of every scored rule class", () => {
    /*
     * V* := max(V_B, V_notB) makes this true by construction. A negative mean here means the
     * adjudicator went back to taking V* from a search that does not cover the same partition,
     * which is the defect this instrument was rebuilt to remove.
     */
    for (const row of scored) {
      for (const v of [
        row.measurements?.regret_b_xs_mean_t_plus,
        row.measurements?.regret_b_xs_mean_t_minus,
      ]) {
        if (typeof v === "number") expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("the anchors, which every placement is a ratio over", () => {
  it("names both anchors and they appear as rows", () => {
    expect(byId.has(model.anchors.ceiling)).toBe(true);
    expect(byId.has(model.anchors.floor)).toBe(true);
  });

  it("the anchor separations are the ones on the anchor rows", () => {
    for (const [id, sep] of [
      [model.anchors.ceiling, model.anchors.ceiling_separation],
      [model.anchors.floor, model.anchors.floor_separation],
    ] as const) {
      const row = byId.get(id);
      expect(row?.measurements?.separation_advantage_over_chance_xs ?? null).toBe(sep);
    }
  });

  it("does NOT require the ceiling to out-separate the floor", () => {
    /*
     * Deliberate, and the one place this file diverges from its sibling. Under `b_valid` the
     * ceiling out-separating the floor is a sanity condition. Under the decision model it is a
     * RESULT: if the sharpest rule class chess allows does not beat the refuted incumbent once
     * value replaces argmax agreement, that is the finding, and a test that forbade it would be
     * a test that forbids the run from reporting what it found. What is checked is that the
     * document states which way it came out.
     */
    const stated =
      /ceiling (?:out-separates|does not out-separate|no longer out-separates)/i.test(doc) ||
      /RC-00[^\n]*RC-01/.test(doc);
    expect(stated).toBe(true);
  });
});

describe("the ranking and the recommendation follow from the gates", () => {
  it("eligible_ranked is exactly the eligible non-anchor rows", () => {
    const eligible = scored.filter((r) => r.eligible).map((r) => r.id).sort();
    expect([...model.eligible_ranked].sort()).toEqual(eligible);
  });

  it("eligible_ranked is ordered by placement between the anchors, best first", () => {
    const placements = model.eligible_ranked.map(
      (id) => byId.get(id)?.measurements?.position_between_anchors ?? 0,
    );
    for (let i = 1; i < placements.length; i += 1) {
      expect(placements[i - 1]).toBeGreaterThanOrEqual(placements[i]);
    }
  });

  it("the recommendation is the top of that ranking, or nothing", () => {
    expect(model.recommended).toBe(model.eligible_ranked[0] ?? null);
  });
});

describe("the comparison against the published screen", () => {
  it("partitions the scored rows, so no class can be counted twice or dropped", () => {
    const { promoted_by_decision_model: up, demoted_by_decision_model: down, agree } =
      model.verdict_changes;
    const all = [...up, ...down, ...agree];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(scored.map((r) => r.id).sort());
  });

  it("a promoted class really is eligible here and not under the published gates", () => {
    for (const id of model.verdict_changes.promoted_by_decision_model) {
      const row = byId.get(id);
      expect(row?.eligible).toBe(true);
      const g = row?.published_gates_this_engine ?? {};
      expect(g.G4_beats_chance === true && g.G5_beats_incumbent === true).toBe(false);
    }
  });

  it("a demoted class really is ineligible here and eligible under the published gates", () => {
    for (const id of model.verdict_changes.demoted_by_decision_model) {
      const row = byId.get(id);
      expect(row?.eligible).toBe(false);
      const g = row?.published_gates_this_engine ?? {};
      expect(g.G4_beats_chance).toBe(true);
      expect(g.G5_beats_incumbent).toBe(true);
    }
  });
});

describe("the document quotes the run", () => {
  it("every rule class in the model appears in the document's table", () => {
    const tabulated = new Set(
      [...doc.matchAll(/^\|\s*\**(RC-\d\d)\**\s*\|/gm)].map((m) => m[1]),
    );
    for (const row of model.rows) expect(tabulated.has(row.id)).toBe(true);
  });

  it("names the engine it ran on, because it is not the published engine", () => {
    /*
     * The published screen ran Stockfish 17.1. This run did not. Every number here is therefore
     * within-run, and a document that omitted the engine would invite exactly the subtraction it
     * must not support.
     */
    expect(/Stockfish\s*1[0-9]/i.test(doc)).toBe(true);
    expect(/within[- ]run|same run|not the published engine/i.test(doc)).toBe(true);
  });

  it("states the recommendation the model derived, or that there is none", () => {
    if (model.recommended) {
      expect(doc.includes(model.recommended)).toBe(true);
    } else {
      expect(/no candidate|nothing is eligible|none eligible/i.test(doc)).toBe(true);
    }
  });
});

/**
 * C10, ON THE JSON SIDE.
 *
 * The criterion's real guard is `RuleClass.__post_init__`, which refuses at import any class that
 * concedes a gap between its name and its predicate without handing over the predicate. That guard
 * runs in Python, so nothing in the TypeScript build would notice if `trigger_scope.json` were
 * hand-edited to say something the register does not — which is the exact failure mode C10 exists
 * to prevent, one file away.
 *
 * So the invariant is asserted again here, against the published artefact.
 */
interface ScopeRow {
  rule_class: string;
  verdict: string;
  why: string;
  has_predicate: boolean;
  share_in_scope?: number;
  b_valid_gap?: number | null;
}

interface Scope {
  verdict_counts: Record<string, number>;
  asserted_and_unchecked: string[];
  declared_and_separately_tested: string[];
  tested_by_the_trigger: string[];
  results: Record<string, ScopeRow>;
}

const scope = JSON.parse(
  readFileSync(resolve(root, "research/measurement/results/trigger_scope.json"), "utf8"),
) as Scope;

const C10_GRADES = [
  "tested-by-the-trigger",
  "declared-and-separately-tested",
  "asserted-and-unchecked",
] as const;

describe("C10 — the predicate detects the condition the class is named after", () => {
  it("every scored rule class carries a grade from the register's own vocabulary", () => {
    for (const row of Object.values(scope.results)) {
      expect(C10_GRADES).toContain(row.verdict as (typeof C10_GRADES)[number]);
    }
  });

  it("every class states its claim — silence is not a grade", () => {
    for (const row of Object.values(scope.results)) {
      expect(row.why.trim().length).toBeGreaterThan(0);
    }
  });

  it("a conceded gap arrives with the predicate that measures it", () => {
    /*
     * The whole content of C10's enforced half. A class may say its trigger does not test
     * everything it is named for — but not without the code that shows how far off it is, which
     * is the comment nobody verified that let RC-21 through.
     */
    for (const row of Object.values(scope.results)) {
      if (row.verdict !== "tested-by-the-trigger") expect(row.has_predicate).toBe(true);
    }
  });

  it("the grade says whether a gap exists and never whether it matters", () => {
    /*
     * RC-13 is why these are two columns. It concedes `asserted-and-unchecked`, and the split it
     * concedes to moves `b_valid` by nothing at all. A test that required a conceded gap to show a
     * measurable effect would force the register to lie about RC-13 to stay green.
     */
    const conceded = scope.asserted_and_unchecked.map((id) => scope.results[id]);
    expect(conceded.length).toBeGreaterThan(0);
    expect(conceded.some((r) => (r.b_valid_gap ?? 0) === 0)).toBe(true);
  });

  it("the three verdict lists partition the scored classes", () => {
    const all = [
      ...scope.asserted_and_unchecked,
      ...scope.declared_and_separately_tested,
      ...scope.tested_by_the_trigger,
    ];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(Object.keys(scope.results).sort());
  });

  it("the document reports the audit it is derived from", () => {
    for (const id of scope.asserted_and_unchecked) expect(doc.includes(id)).toBe(true);
  });
});
