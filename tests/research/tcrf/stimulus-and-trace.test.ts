/**
 * The validator, the value-resolution guard, the frozen wording and the provenance record.
 *
 * THE RESOLUTION TEST IS THE ONE TO READ FIRST. §4.3 matches the two arms on winning chances, and
 * winning chances are flat at their ends: the first pilot pair in the coalition family came back
 * matched to 0.0000 under both engine configurations while both arms evaluated at 1.000. The
 * criterion had not been satisfied, it had failed to run, and nothing in the frozen text
 * distinguishes those.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  VALUE_RESOLVABLE_LOWER,
  VALUE_RESOLVABLE_UPPER,
  computeInvariants,
  materialSignature,
  pieceRelocations,
  validateManifest,
  validatePair,
  valueMatchResolvable,
} from "../../../research/tcrf/validate-stimulus";
import {
  stimulusManifestSchema,
  type StimulusPair,
} from "../../../research/tcrf/stimulus";
import { unmeasured } from "../../../research/tcrf/engine-match";
import {
  WORDINGS,
  forbiddenLexiconHits,
  missingWordings,
} from "../../../research/tcrf/probe-wording";
import {
  STOP_CONDITIONS,
  canonicalStopCode,
  verdict,
} from "../../../research/tcrf/stop-conditions";
import { traceDrift, type ResearchTrace } from "../../../research/tcrf/trace";
import { DETECTOR_VERSIONS } from "../../../research/tcrf/relations";

const root = resolve(__dirname, "../../..");
const manifest = stimulusManifestSchema.parse(
  JSON.parse(readFileSync(resolve(root, "research/tcrf/stimuli/PRIMARY_V1.json"), "utf8")),
);
const pairOf = (id: string): StimulusPair =>
  manifest.pairs.find((entry) => entry.pair.template_id === id)!.pair;

describe("the committed pilot manifest is internally consistent", () => {
  it("recomputes every derived field on every pair and finds no staleness", () => {
    for (const { pair } of manifest.pairs) {
      const stale = validatePair(pair).filter((v) => v.code.endsWith("_STALE"));
      expect(stale, `${pair.template_id}: ${stale.map((s) => s.detail).join("; ")}`).toEqual([]);
    }
  });

  it("puts no pair in the primary set that cannot carry the H1 verdict", () => {
    for (const entry of manifest.pairs) {
      if (entry.set !== "PRIMARY_STRUCTURE_ONLY") continue;
      expect(validatePair(entry.pair).filter((v) => v.severity === "BLOCK")).toEqual([]);
    }
  });

  it("reports STOP-R2-STIMULUS while the pilot is unreviewed, rather than pretending otherwise", () => {
    const report = validateManifest(manifest);
    expect(report.stopStimulus).toBe(true);
    expect(report.violations.map((v) => v.code)).toContain("STOP-R2-STIMULUS");
  });
});

describe("the invariants §4.2 freezes are computed, not trusted", () => {
  it("reads material as a comparable inventory, case carrying the side", () => {
    const fen = "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20";
    expect(materialSignature(fen)).toBe(materialSignature(fen));
    expect(materialSignature(fen)).not.toBe(
      materialSignature("2r3k1/1pp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20"),
    );
  });

  it("counts a relocation as the two squares it changes", () => {
    expect(
      pieceRelocations(
        "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20",
        "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/3R2K1 w - - 0 20",
      ),
    ).toBe(2);
  });

  it("marks the target affordance unavailable when its moves are not legal in that arm", () => {
    const invariants = computeInvariants(
      "2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20",
      ["a1a8"],
    );
    expect(invariants.target_affordance_available).toBe(false);
  });
});

describe("the value-matching test knows when it did not run", () => {
  it("derives a band rather than choosing one", () => {
    expect(VALUE_RESOLVABLE_UPPER).toBeGreaterThan(0.8);
    expect(VALUE_RESOLVABLE_UPPER).toBeLessThan(0.9);
    expect(VALUE_RESOLVABLE_LOWER).toBeCloseTo(1 - VALUE_RESOLVABLE_UPPER, 12);
  });

  it("calls a decided position unresolvable in both directions", () => {
    expect(valueMatchResolvable(0.5)).toBe(true);
    expect(valueMatchResolvable(1)).toBe(false);
    expect(valueMatchResolvable(0)).toBe(false);
  });

  it("blocks the pilot pair that was matched to 0.0000 at winning chances of 1.000", () => {
    const hc = pairOf("HC-02");
    expect(hc.engine_shipped.value_delta).toBe(0);
    const codes = validatePair(hc).map((v) => v.code);
    expect(codes).toContain("VALUE_MATCH_UNRESOLVED");
    expect(codes).not.toContain("VALUE_DELTA_EXCEEDED");
  });

  it("blocks a pair whose engine never ran, rather than reading the absence as a match", () => {
    const pair: StimulusPair = {
      ...pairOf("SD-01"),
      engine_shipped: unmeasured("shipped"),
      engine_high_budget: unmeasured("high_budget"),
    };
    const codes = validatePair(pair).map((v) => v.code);
    expect(codes).toContain("ENGINE_NOT_MEASURED");
    expect(unmeasured("shipped").value_delta).toBeNull();
  });
});

describe("the probe wording contains no part of its own answer", () => {
  it("carries all three questions in all three languages", () => {
    expect(missingWordings()).toEqual([]);
    expect(WORDINGS).toHaveLength(9);
  });

  it("names no relation, no motif, no piece and no example in any language", () => {
    for (const wording of WORDINGS) {
      expect(
        forbiddenLexiconHits(wording),
        `${wording.language}:${wording.slot} -- "${wording.text}"`,
      ).toEqual([]);
    }
  });

  it("does not claim Hebrew or Spanish are frozen before the cognitive interviews have run", () => {
    /*
     * §7.3: "equivalent adapted wording is frozen for Hebrew and Spanish AFTER discovery". Marking
     * them frozen now would assert that a forward translation, an independent back translation and
     * a round of cognitive interviews have happened, and none has.
     */
    for (const wording of WORDINGS.filter((w) => w.language !== "en")) {
      expect(wording.state).not.toBe("FROZEN");
    }
  });
});

describe("stop codes and the verdict matrix", () => {
  it("resolves either naming scheme to one condition, so two documents cannot name two events", () => {
    expect(canonicalStopCode("STOP-R2-H1")).toBe(canonicalStopCode("STOP-R2-A"));
    expect(canonicalStopCode("STOP-R2-CONFOUND")).toBe(canonicalStopCode("STOP-R2-D"));
  });

  it("covers every code this study is allowed to stop on", () => {
    const codes = STOP_CONDITIONS.map((s) => s.code);
    for (const required of [
      "STOP-R2-SAMPLE", "STOP-R2-STIMULUS", "STOP-R2-CODE", "STOP-R2-H1",
      "STOP-R2-H2", "STOP-R2-LANGUAGE", "STOP-R2-REACTIVITY", "STOP-R2-CONFOUND",
      "STOP-R2-TEMPLATE",
    ]) {
      expect(codes).toContain(required);
    }
  });

  it("never permits a threshold change as the response to a stop", () => {
    for (const stop of STOP_CONDITIONS) {
      expect(stop.permitted_response.toLowerCase()).not.toMatch(/lower the threshold|relax the/);
    }
  });

  it("has no verdict that means build something", () => {
    expect(verdict({ h1: false, h2: true, h4_established: true })).toBe("STOP");
    expect(verdict({ h1: true, h2: false, h4_established: true })).toBe("RESEARCH_ONLY");
    expect(verdict({ h1: true, h2: true, h4_established: false })).toBe("CONDITIONAL_RESEARCH");
    expect(verdict({ h1: true, h2: true, h4_established: true })).toBe("UNLOCK_EXP_R3");
  });
});

describe("provenance drift is reported per field", () => {
  const trace: ResearchTrace = {
    git_sha: "abc1234",
    protocol_version: 1,
    stimulus_version: 1,
    stimulus_schema_version: 1,
    detector_versions: { ...DETECTOR_VERSIONS },
    language_version: 1,
    codebook_version: 1,
    analysis_plan_version: 1,
    engine_identity: "Stockfish 18 Lite WASM",
    engine_options: { limit: "nodes 2000000" },
    randomisation_seed: "seed-1",
    recorded_at: "2026-01-01T00:00:00.000Z",
  };

  it("is silent when the trace matches the tree", () => {
    expect(traceDrift(trace)).toEqual([]);
  });

  it("names the one detector that moved rather than calling the whole run stale", () => {
    const drift = traceDrift({
      ...trace,
      detector_versions: { ...DETECTOR_VERSIONS, overload: 99 },
    });
    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain("overload");
  });

  it("notices a detector the run recorded and the tree no longer has", () => {
    expect(
      traceDrift({ ...trace, detector_versions: { ...DETECTOR_VERSIONS, initiative: 1 } }),
    ).toContain("detector initiative: recorded, and the tree no longer has it");
  });

  it("notices a detector the tree has and the run never recorded", () => {
    const partial = { ...DETECTOR_VERSIONS } as Record<string, number>;
    delete partial.battery;
    expect(traceDrift({ ...trace, detector_versions: partial })).toContain(
      "detector battery: not recorded at all",
    );
  });
});
