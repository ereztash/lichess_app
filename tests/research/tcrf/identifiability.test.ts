/**
 * The identifiability argument, tested from both sides.
 *
 * THE TESTS THAT MATTER MOST HERE ARE THE ONES WHERE THE SIMPLER ACCOUNT WINS. A discriminator that
 * only ever returns "yes, relational" is not a discriminator, and the first version of this scan
 * did exactly that for two families, because empty squares had no feature vector and so counted as
 * invisible to an account that in fact sees them perfectly well. Every case below where the verdict
 * is `SIMPLER_ACCOUNT_EQUIVALENT` is guarding that failure.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCOUNTS,
  identifiabilityOf,
  familyVerdict,
  objectFeatures,
  objectVisibility,
  valueRole,
} from "../../../research/tcrf/identifiability";
import { stimulusManifestSchema, type StimulusPair } from "../../../research/tcrf/stimulus";
import { validatePair } from "../../../research/tcrf/validate-stimulus";
import { canonicalStopCode } from "../../../research/tcrf/stop-conditions";

const root = resolve(__dirname, "../../..");
const manifest = stimulusManifestSchema.parse(
  JSON.parse(readFileSync(resolve(root, "research/tcrf/stimuli/PRIMARY_V1.json"), "utf8")),
);
const pairOf = (id: string): StimulusPair =>
  manifest.pairs.find((entry) => entry.pair.template_id === id)!.pair;

describe("the object-local account is given its strongest form", () => {
  it("describes empty squares, not only occupied ones", () => {
    const features = objectFeatures("2r3k1/ppp2ppp/5n2/4N3/8/8/PPP2PPP/4R1K1 w - - 0 20");
    expect(features.size).toBe(64);
    const empty = features.get("d5")!;
    expect(empty.color).toBeNull();
    expect(empty.type).toBe("-");
  });

  it("counts control of an empty square, so closing a file is object-visible", () => {
    const vis = objectVisibility(
      "4r1k1/ppp2ppp/5n2/8/8/2P2N2/PP3PPP/3R2K1 w - - 0 20",
      "4r1k1/ppp2ppp/5n2/8/8/3P1N2/PP3PPP/3R2K1 w - - 0 20",
    );
    expect(vis.objectVisible.has("d8")).toBe(true);
    expect(vis.why["d8"].join()).toContain("controlled by white 1->0");
  });

  it("sees a pin as a property of the pinned piece, which the attack map cannot", () => {
    const vis = objectVisibility(
      "r3k2r/ppp2ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 8",
      "r3k2r/1ppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 8",
    );
    expect(vis.why["c6"].join()).toContain("absolutelyPinned true->false");
  });

  it("names all four competing accounts, relational last", () => {
    expect([...ACCOUNTS]).toEqual(["object_local", "scalar_value", "tactical_forcing", "relational"]);
  });
});

describe("ablation cannot identify a relational construct in the first-order families", () => {
  it("SD-01: removing a defence changes the defended piece's own description", () => {
    const report = identifiabilityOf(pairOf("SD-01"));
    expect(report.verdict).toBe("SIMPLER_ACCOUNT_EQUIVALENT");
    expect(report.relational_only_elements).toEqual([]);
    expect(report.surviving_simpler_account).toBe("object_local");
    expect(report.discriminating_observation).toBeNull();
  });

  it("LA-02: closing a file changes how many white pieces control the far square", () => {
    expect(identifiabilityOf(pairOf("LA-02")).verdict).toBe("SIMPLER_ACCOUNT_EQUIVALENT");
  });
});

describe("substitution can identify one, and the pilot pairs prove it", () => {
  it("ID-04: the same knight, defended exactly once in both arms, by a different element", () => {
    const report = identifiabilityOf(pairOf("ID-04"));
    expect(report.verdict).toBe("RELATIONAL_IDENTIFIABILITY_DEMONSTRATED");
    expect(report.relational_only_elements).toEqual(["e5"]);
    expect(report.value_role).toBe("CONFOUND");
    expect(report.surviving_simpler_account).toBeNull();
    expect(report.discriminating_observation).toContain("e5");
  });

  it("ID-01: a coalition aimed at a target whose own description never moves", () => {
    const report = identifiabilityOf(pairOf("ID-01"));
    expect(report.verdict).toBe("RELATIONAL_IDENTIFIABILITY_DEMONSTRATED");
    expect(report.relational_only_elements).toEqual(["d5"]);
    expect(report.value_role).toBe("CONFOUND");
  });

  it("keeps the two demonstrations inside the frozen value tolerance under BOTH engines", () => {
    for (const id of ["ID-01", "ID-04"]) {
      const pair = pairOf(id);
      for (const reading of [pair.engine_shipped, pair.engine_high_budget]) {
        expect(reading.state).toBe("MEASURED");
        expect(reading.value_delta).toBeLessThanOrEqual(0.0276);
      }
    }
  });
});

describe("a discriminating element is not enough on its own", () => {
  it("ID-02 and ID-03: the overload family has one, and value is constitutive in both attempts", () => {
    for (const id of ["ID-02", "ID-03"]) {
      const report = identifiabilityOf(pairOf(id));
      expect(report.relational_only_elements.length).toBeGreaterThan(0);
      expect(report.verdict).toBe("RELATIONAL_IDENTIFIABILITY_PARTIAL");
      expect(report.value_role).toBe("CONSTITUTIVE");
      expect(report.surviving_simpler_account).toBe("scalar_value");
    }
  });

  it("HC-02: a delta of exactly zero at saturation is UNRESOLVED, never CONFOUND", () => {
    const pair = pairOf("HC-02");
    expect(pair.engine_shipped.value_delta).toBe(0);
    expect(valueRole(pair)).toBe("UNRESOLVED");
    expect(identifiabilityOf(pair).verdict).toBe("RELATIONAL_IDENTIFIABILITY_PARTIAL");
  });
});

describe("family verdicts route to the amended branches", () => {
  const byClass = (purpose: StimulusPair["purpose"], family: StimulusPair["family"]) =>
    familyVerdict(
      manifest.pairs
        .filter((e) => e.pair.purpose === purpose && e.pair.family === family)
        .map((e) => identifiabilityOf(e.pair)),
    );

  it("sends an ablated first-order family to STOP and a substituted one to R2-A", () => {
    expect(byClass("AFFORDANCE_TEST", "support_defence").branch).toBe("STOP");
    expect(byClass("IDENTIFIABILITY_TEST", "support_defence").branch).toBe("R2-A");
  });

  it("sends the overload family to R2-B, where value is constitutive rather than a nuisance", () => {
    expect(byClass("IDENTIFIABILITY_TEST", "constraint_overload").branch).toBe("R2-B");
  });
});

describe("the gate refuses an identifiability template that cannot identify anything", () => {
  it("blocks a pair whose every endpoint the object account can see", () => {
    const impostor: StimulusPair = { ...pairOf("SD-01"), purpose: "IDENTIFIABILITY_TEST" };
    expect(validatePair(impostor).map((v) => v.code)).toContain("NO_DISCRIMINATING_ELEMENT");
  });

  it("does not demand an affordance from an identifiability template", () => {
    expect(validatePair(pairOf("ID-04")).map((v) => v.code)).not.toContain("AFFORDANCE_EMPTY_IN_BOTH");
  });

  it("still demands one from an affordance template", () => {
    const stripped: StimulusPair = {
      ...pairOf("SD-01"),
      target_affordance_present: [],
      target_affordance_disrupted: [],
    };
    expect(validatePair(stripped).map((v) => v.code)).toContain("AFFORDANCE_EMPTY_IN_BOTH");
  });
});

describe("the amendment's stop codes exist and cannot be argued out of", () => {
  it("carries a per-family and a study-level construct stop", () => {
    expect(canonicalStopCode("STOP-R2-CONSTRUCT")).toBeDefined();
    expect(canonicalStopCode("STOP-R2-CONSTRUCT-IDENTIFIABILITY")).toBeDefined();
  });

  it("forbids recruiting to separate models that make the same prediction", () => {
    const stop = canonicalStopCode("STOP-R2-CONSTRUCT")!;
    expect(stop.permitted_response).toContain("forbidden");
    expect(stop.consequence).toContain("does not go to human participants");
  });
});
