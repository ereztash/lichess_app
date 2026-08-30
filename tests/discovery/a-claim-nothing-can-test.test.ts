/**
 * WHAT A CLAIM IS ABOUT DECIDES WHAT COULD TEST IT -- and sometimes the answer is "nothing here".
 *
 * `docs/blitz/ADR-003.md` records the failure this is the machinery for. The product drills a
 * `fast-under-45s` claim on eight static positions and grades it TERMINALLY, and refutation cannot
 * be revisited. `protocolFor` has said since it was written that such a claim needs a timed
 * holdout; nothing consulted it, so the rule was true and inert.
 *
 * WHAT IS AND IS NOT SETTLED HERE. ADR-003 leaves open whether a position drill may grade a
 * think-time claim at all -- three defensible positions, all argued in the repository, and the
 * choice belongs to whoever owns the product. Nothing in these tests settles it. What they hold is
 * narrower and not in dispute: the classification is a VALUE, it is derived from what a subgroup
 * READS rather than from a list of names, and a claim nothing knows how to test gets no verdict
 * rather than the nearest protocol on the shelf.
 */
import { describe, expect, it } from "vitest";
import {
  canBeGraded,
  classifyBucketKey,
  classifyKinds,
  classifyPredicate,
  conditionKindOfBucket,
  protocolForClass,
  protocolForPredicate,
  protocolSatisfies,
  requirementsForKinds,
} from "@shared/discovery/claim-class";
import type { FeatureSpec } from "@shared/discovery/feature-contract";
import type { Predicate } from "@shared/discovery/predicate";
import { protocolFor } from "@shared/validation-protocol";
import { BUCKETINGS } from "@shared/detector";

const feature = (id: string, kind: FeatureSpec["condition_kind"]): FeatureSpec => ({
  id,
  version: 1,
  type: "number",
  role: "PREDICTOR",
  source_class: "DETERMINISTIC",
  missingness_policy: "exclude-decision",
  discovery_eligible: true,
  validation_eligible: false,
  semantic_confidence: "definitional",
  license_origin: "this repository",
  condition_kind: kind,
});

const REGISTRY: FeatureSpec[] = [
  feature("phase", "POSITION"),
  feature("materialAdvantage", "POSITION"),
  feature("clockShare", "ENVIRONMENT"),
  feature("secondsTaken", "ENVIRONMENT"),
  feature("eventRun", "SEQUENCE"),
  feature("humanMoveProbability", "MODEL_DERIVED"),
  feature("mystery", null),
];

const predicate = (...ids: string[]): Predicate => ({
  atoms: ids.map((id) => ({ feature_id: id, op: "lt" as const, value: 1 })),
});

describe("classifying a subgroup by what it reads", () => {
  it("calls a board a board", () => {
    expect(classifyPredicate(predicate("phase"), REGISTRY).claimClass).toBe("POSITION");
  });

  it("calls a clock an environment", () => {
    expect(classifyPredicate(predicate("clockShare"), REGISTRY).claimClass).toBe("ENVIRONMENT");
  });

  it("calls a conjunction of both what it is, and not either half", () => {
    const { claimClass } = classifyPredicate(predicate("phase", "clockShare"), REGISTRY);
    expect(claimClass).toBe("POSITION_X_ENVIRONMENT");
    expect(protocolForClass(claimClass).protocol).toBe("timed-matching-condition");
  });

  it("labels a mixed predicate by its strictest kind", () => {
    expect(classifyPredicate(predicate("phase", "humanMoveProbability"), REGISTRY).claimClass).toBe(
      "MODEL_DERIVED",
    );
    expect(classifyPredicate(predicate("phase", "eventRun"), REGISTRY).claimClass).toBe("SEQUENCE");
  });

  it("KEEPS EVERY REQUIREMENT A MIXED PREDICATE IMPOSES, and does not dispatch on the label", () => {
    /*
     * The defect this replaces. The label is chosen by precedence, so `phase AND
     * humanMoveProbability` is called MODEL_DERIVED -- and dispatching on that label alone sent it
     * to a model-version-locked holdout, which pins the model and never matches the position. The
     * predicate needs BOTH. A union cannot drop a term; a precedence can, and did.
     */
    const mixed = classifyPredicate(predicate("phase", "humanMoveProbability"), REGISTRY);
    expect(mixed.requirements).toEqual(["match-position-class", "pin-the-model-version"]);
    expect(protocolForClass(mixed.claimClass).protocol).toBe("model-version-locked-holdout");
    // ...and the protocol actually dispatched refuses, because nothing in the table does both.
    expect(mixed.protocol).toBe("no-verdict");
  });

  it("refuses rather than approximating when no protocol covers the whole predicate", () => {
    // Not "close enough". When D17 opens and a protocol that both pins a model and matches
    // positions exists, adding one row makes this testable and nothing else changes.
    expect(protocolForPredicate(predicate("clockShare", "eventRun"), REGISTRY)).toBe("no-verdict");
  });

  it("still finds the protocol that DOES cover a mixed predicate", () => {
    const both = classifyPredicate(predicate("phase", "clockShare"), REGISTRY);
    expect(both.requirements).toEqual(["match-position-class", "reproduce-clock-condition"]);
    expect(both.protocol).toBe("timed-matching-condition");
  });

  it("takes the union of requirements, never a winner", () => {
    expect(requirementsForKinds(["POSITION", "ENVIRONMENT", "MODEL_DERIVED"]).requirements).toEqual([
      "match-position-class",
      "reproduce-clock-condition",
      "pin-the-model-version",
    ]);
    expect(requirementsForKinds(["POSITION", null]).unknown).toBe(true);
    expect(requirementsForKinds([]).unknown).toBe(true);
  });

  it("knows which protocol can do what, declared rather than inferred from its name", () => {
    expect(protocolSatisfies("timed-matching-condition", ["match-position-class"])).toBe(true);
    expect(protocolSatisfies("natural-timed-holdout", ["match-position-class"])).toBe(false);
    // A game played forward is not a game whose positions anyone chose.
    expect(protocolSatisfies("future-complete-games", ["match-position-class"])).toBe(false);
    expect(protocolSatisfies("no-verdict", ["match-position-class"])).toBe(false);
  });

  it("gives a single-kind predicate the cheapest protocol that suffices", () => {
    expect(protocolForPredicate(predicate("phase"), REGISTRY)).toBe("matched-unseen-positions");
    expect(protocolForPredicate(predicate("clockShare"), REGISTRY)).toBe("natural-timed-holdout");
  });

  it("makes one unclassified term make the whole claim unknown", () => {
    // Skipping the unrecognised term would classify the claim on what it happens to recognise and
    // then test it as though the rest were not there -- the substitution INV-10 forbids, arrived
    // at by omission instead of by choice.
    const { claimClass, unclassified } = classifyPredicate(predicate("phase", "mystery"), REGISTRY);
    expect(claimClass).toBe("UNKNOWN");
    expect(unclassified).toEqual(["mystery"]);
  });

  it("makes a feature the registry has never heard of unknown, not absent", () => {
    const { claimClass, unclassified } = classifyPredicate(predicate("neverDeclared"), REGISTRY);
    expect(claimClass).toBe("UNKNOWN");
    expect(unclassified).toEqual(["neverDeclared"]);
  });

  it("calls an empty predicate unknown rather than universal", () => {
    expect(classifyKinds([])).toBe("UNKNOWN");
  });
});

describe("a claim nothing can test gets no verdict", () => {
  it("dispatches UNKNOWN to no-verdict and to nothing else", () => {
    expect(protocolForClass("UNKNOWN").protocol).toBe("no-verdict");
    expect(canBeGraded("UNKNOWN")).toBe(false);
  });

  it("gives every other class a protocol that can reproduce its condition", () => {
    for (const claimClass of ["POSITION", "ENVIRONMENT", "POSITION_X_ENVIRONMENT", "SEQUENCE", "MODEL_DERIVED"] as const) {
      expect(canBeGraded(claimClass)).toBe(true);
      expect(protocolForClass(claimClass).because.length).toBeGreaterThan(0);
    }
  });

  it("never sends an environment claim to a protocol built from positions", () => {
    expect(protocolForClass("ENVIRONMENT").protocol).toBe("natural-timed-holdout");
    expect(protocolForClass("POSITION_X_ENVIRONMENT").protocol).not.toBe("matched-unseen-positions");
  });
});

describe("the shipped buckets, through the same table", () => {
  it("classifies every bucket the detector ships with", () => {
    for (const bucketing of BUCKETINGS) {
      expect(conditionKindOfBucket(bucketing.key)).not.toBeNull();
      expect(classifyBucketKey(bucketing.key)).not.toBe("UNKNOWN");
    }
  });

  it("gives a seventh, unclassified bucket no verdict rather than a drill", () => {
    expect(classifyBucketKey("opponent-rating-above-2000")).toBe("UNKNOWN");
    expect(canBeGraded(classifyBucketKey("opponent-rating-above-2000"))).toBe(false);
    expect(protocolFor("opponent-rating-above-2000")).toBeNull();
  });

  it("leaves `protocolFor` answering exactly what it answered before", () => {
    // The two key lists moved into `claim-class.ts`; the answers must not have moved with them.
    expect(protocolFor("phase-endgame")).toBe("position-drill");
    expect(protocolFor("standing-losing")).toBe("position-drill");
    expect(protocolFor("fast-under-45s")).toBe("timed-holdout");
    expect(protocolFor("slow-over-2m")).toBe("timed-holdout");
    expect(protocolFor("clock-under-1m")).toBe("timed-holdout");
    expect(protocolFor("nonsense")).toBeNull();
  });

  it("agrees with itself: every bucket's protocol follows from its class", () => {
    for (const bucketing of BUCKETINGS) {
      const claimClass = classifyBucketKey(bucketing.key);
      const expected = claimClass === "POSITION" ? "position-drill" : "timed-holdout";
      expect(protocolFor(bucketing.key)).toBe(expected);
    }
  });
});
