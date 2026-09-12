/**
 * §8's blindness and §11's controls, as tests rather than as a procedure somebody follows.
 *
 * THE BLINDNESS TESTS ARE DELIBERATELY REDUNDANT WITH `GATE-TCRF-BLIND`. The gate proves the check
 * can fail; these prove what it means when it passes, over inputs the gate does not use. A gate and
 * a test are answering different questions and only one of them survives being pasted into a
 * report.
 */
import { describe, expect, it } from "vitest";
import {
  CODER_FORBIDDEN_FIELDS,
  CODER_VISIBLE_FIELDS,
  CoderExportError,
  blindnessBreaches,
  buildCodingBatch,
  codeable,
  codingToken,
  toCoderPayload,
  undeclaredFields,
  type CodingBatch,
} from "../../../research/tcrf/coder-export";
import {
  contaminationCounts,
  donorSwap,
  familyHoldout,
  permuteTopologyWithinTemplate,
  CONTROLS,
} from "../../../research/tcrf/analysis/controls";
import { foldOf } from "../../../research/tcrf/analysis/plan";
import type { CodedResponse } from "../../../research/tcrf/codebook";
import type { ResourceTrial } from "../../../research/tcrf/trial";
import { coderBatch, revealingTrial } from "../../../scripts/tcrf-scan";
import { leakyCoderPayload } from "../../fixtures/tcrf/leaky-export";

const batch: CodingBatch = coderBatch();

const trialAt = (index: number, patch: Partial<ResourceTrial> = {}): ResourceTrial => ({
  ...revealingTrial(),
  trial_id: `T-${String(index).padStart(4, "0")}`,
  trial_index: index,
  ...patch,
});

describe("what a coder receives", () => {
  it("carries exactly the declared fields, and nothing else", () => {
    const payload = toCoderPayload(batch, revealingTrial());
    expect(undeclaredFields(payload)).toEqual([]);
    expect(Object.keys(payload).sort()).toEqual([...CODER_VISIBLE_FIELDS].sort());
  });

  it("carries none of the fields §8 blinds coders to", () => {
    expect(blindnessBreaches(toCoderPayload(batch, revealingTrial()))).toEqual([]);
  });

  it("blinds the re-identifiers §8 does not name: template, family and position in session", () => {
    /*
     * A COAT-CHECK ARGUMENT. §8 lists condition, evaluation, move quality, rating and result. It
     * does not list `template_id`, and a coder who can see it can group the batch by template, read
     * which responses name a structure the others do not, and recover the arm without ever seeing
     * the word. The whitelist is what closes that, and this test is what says so out loud.
     */
    for (const key of ["template_id", "family", "trial_index", "participant_id"]) {
      expect(CODER_FORBIDDEN_FIELDS).toContain(key);
    }
  });

  it("refuses to export a trial whose template has no frozen coding rule", () => {
    const orphan = revealingTrial();
    expect(() => toCoderPayload({ ...batch, rules: new Map() }, orphan)).toThrow(CoderExportError);
  });

  it("catches the procedurally blinded exporter, which is what a careful team would write", () => {
    const leaked = blindnessBreaches(leakyCoderPayload(batch, revealingTrial()));
    expect(leaked).toContain("is_base_arm");
    expect(leaked).toContain("template_id");
    expect(leaked).toContain("budget_ms");
  });

  it("gives the same trial the same token inside a batch and a different one across batches", () => {
    expect(codingToken(batch, "T-0001")).toBe(codingToken(batch, "T-0001"));
    expect(codingToken({ ...batch, batch_id: "B-2" }, "T-0001")).not.toBe(
      codingToken(batch, "T-0001"),
    );
  });

  it("excludes contaminated, unprobed and unanswered trials before coding rather than after", () => {
    expect(codeable(revealingTrial())).toBe(true);
    expect(
      codeable(
        trialAt(1, {
          contamination: { kind: "reveal_before_probe", detected_at_ms: 10, detail: "" },
        }),
      ),
    ).toBe(false);
    expect(codeable(trialAt(2, { probe_assignment: "not_probed" }))).toBe(false);
  });

  it("orders the batch by the opaque token, so collection order cannot leak session structure", () => {
    const trials = [0, 1, 2, 3, 4, 5].map((i) => trialAt(i));
    const built = buildCodingBatch(batch, trials);
    const tokens = built.map((p) => p.coding_token);
    expect(tokens).toEqual([...tokens].sort());
    expect(new Set(tokens).size).toBe(trials.length);
  });
});

describe("C1: permuting the topology label within template", () => {
  const trials = [
    trialAt(0, { template_id: "SD-01", topology_condition: "present", is_base_arm: true }),
    trialAt(1, { template_id: "SD-01", topology_condition: "disrupted", is_base_arm: false }),
    trialAt(2, { template_id: "SD-01", topology_condition: "present", is_base_arm: true }),
    trialAt(3, { template_id: "LA-02", topology_condition: "disrupted", is_base_arm: false }),
    trialAt(4, { template_id: "LA-02", topology_condition: "present", is_base_arm: true }),
  ];

  it("keeps each template's condition counts, so only the pairing is destroyed", () => {
    const shuffled = permuteTopologyWithinTemplate(trials, 12345);
    for (const template of ["SD-01", "LA-02"]) {
      const before = trials.filter((t) => t.template_id === template).map((t) => t.topology_condition).sort();
      const after = shuffled.filter((t) => t.template_id === template).map((t) => t.topology_condition).sort();
      expect(after).toEqual(before);
    }
  });

  it("moves is_base_arm with the label, so the true condition is not recoverable from a leftover column", () => {
    const shuffled = permuteTopologyWithinTemplate(trials, 999);
    for (const row of shuffled) {
      expect(row.is_base_arm).toBe(row.topology_condition === "present");
    }
  });

  it("is reproducible from the seed alone", () => {
    const a = permuteTopologyWithinTemplate(trials, 42).map((t) => t.topology_condition);
    const b = permuteTopologyWithinTemplate(trials, 42).map((t) => t.topology_condition);
    expect(a).toEqual(b);
  });
});

describe("C2: the donor swap", () => {
  const trials = [0, 1, 2, 3].map((i) =>
    trialAt(i, { template_id: "SD-01", topology_condition: i % 2 ? "disrupted" : "present" }),
  );
  const coded = new Map<string, CodedResponse>(
    trials.map((t) => [
      t.trial_id,
      {
        trial_id: t.trial_id,
        coder_id: "C-1",
        codebook_version: 1,
        levels: ["RELATION"],
        first_level: "RELATION",
        target_structure_mentioned: t.topology_condition === "present",
        target_structure_referenced: true,
        target_telos_linked: false,
        named_elements: ["e5"],
        predicate_arity: "two_place",
        coder_uncertain: false,
        coder_comment: t.trial_id,
      } satisfies CodedResponse,
    ]),
  );

  it("gives every trial somebody else's response, never its own", () => {
    const { swapped } = donorSwap(trials, coded, 7);
    for (const trial of trials) {
      const donor = swapped.get(trial.trial_id);
      expect(donor).toBeDefined();
      expect(donor!.coder_comment).not.toBe(trial.trial_id);
    }
  });

  it("draws the donor from the same template AND the same condition", () => {
    const { swapped } = donorSwap(trials, coded, 7);
    for (const trial of trials) {
      const donor = swapped.get(trial.trial_id)!;
      const source = trials.find((t) => t.trial_id === donor.coder_comment)!;
      expect(source.topology_condition).toBe(trial.topology_condition);
      expect(source.template_id).toBe(trial.template_id);
    }
  });

  it("reports a stratum of one as unmatched rather than silently keeping the original", () => {
    const lonely = [trialAt(9, { template_id: "ZZ-99", topology_condition: "present" })];
    const lonelyCoded = new Map<string, CodedResponse>([
      [lonely[0].trial_id, { ...coded.get("T-0000")!, trial_id: lonely[0].trial_id }],
    ]);
    const { swapped, unmatched } = donorSwap(lonely, lonelyCoded, 7);
    expect(swapped.size).toBe(0);
    expect(unmatched).toEqual([lonely[0].trial_id]);
  });
});

describe("holdouts split on the held-out unit, not on the trial", () => {
  it("puts all of one participant's trials in the same fold", () => {
    const rows = [0, 1, 2, 3].map((i) => trialAt(i, { participant_id: "P-7" }));
    const folds = new Set(rows.map((t) => foldOf(t, "participant_held_out", "seed-1")));
    expect(folds.size).toBe(1);
  });

  it("puts all of one template's trials in the same fold", () => {
    const rows = [0, 1, 2].map((i) => trialAt(i, { participant_id: `P-${i}`, template_id: "LA-02" }));
    const folds = new Set(rows.map((t) => foldOf(t, "template_held_out", "seed-1")));
    expect(folds.size).toBe(1);
  });

  it("C7 leaves exactly one family out and trains on the rest", () => {
    const rows = [
      trialAt(0, { family: "support_defence" }),
      trialAt(1, { family: "line_activation" }),
      trialAt(2, { family: "higher_order_coalition" }),
    ];
    const { train, test } = familyHoldout(rows, "line_activation");
    expect(test.map((t) => t.family)).toEqual(["line_activation"]);
    expect(train).toHaveLength(2);
  });
});

describe("contamination is counted by kind", () => {
  it("keeps a broken instrument distinguishable from a broken question", () => {
    const rows = [
      trialAt(0, { contamination: { kind: "reveal_before_commit", detected_at_ms: 1, detail: "" } }),
      trialAt(1, { contamination: { kind: "reveal_before_probe", detected_at_ms: 1, detail: "" } }),
      trialAt(2, { contamination: { kind: "reveal_before_probe", detected_at_ms: 1, detail: "" } }),
      trialAt(3),
    ];
    expect(contaminationCounts(rows)).toEqual({
      reveal_before_commit: 1,
      reveal_before_probe: 2,
    });
  });
});

describe("every control names what failure means, and none of them says re-run", () => {
  it("covers C1 through C9", () => {
    expect(CONTROLS.map((c) => c.id)).toEqual([
      "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9",
    ]);
  });

  it("never offers tuning the experiment as a permitted response to a failed control", () => {
    for (const control of CONTROLS) {
      expect(control.on_failure.toLowerCase()).not.toMatch(/re-?run with|adjust the threshold|loosen/);
    }
  });
});
