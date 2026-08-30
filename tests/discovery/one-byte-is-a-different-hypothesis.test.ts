/**
 * A FROZEN HYPOTHESIS HAS ONE IDENTITY, AND A CHANGED ONE HAS A DIFFERENT IDENTITY.
 *
 * WHY THIS MATTERS MORE THAN IT SOUNDS. Evidence accumulates against an id. If two different
 * hypotheses can share one -- because a threshold moved, or a feature's formula changed, or a
 * field was reordered on the way through a store -- then a claim collects evidence gathered
 * against a claim it is not. That failure is silent, it survives every test of the statistics, and
 * it makes the whole freeze decorative.
 *
 * The two halves below are the two ways it breaks: an id that changes when nothing meaningful did
 * (an unstable identity), and an id that does NOT change when something meaningful did (a
 * collision). Both are tested, because fixing either one carelessly causes the other.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  HYPOTHESIS_SCHEMA_VERSION,
  freeze,
  freezeProblems,
  frozenIsIntact,
  gameIdsHash,
  hypothesisId,
  type FrozenHypothesis,
} from "@shared/discovery/hypothesis-manifest";
import type { FeatureSpec } from "@shared/discovery/feature-contract";
import { canonicalJson } from "@shared/discovery/manifest-hash";
import { sha256Hex } from "@shared/discovery/sha256";

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

/** The registry `freeze` re-derives the required protocol from. It is never optional. */
const REGISTRY: FeatureSpec[] = [
  feature("clockShare", "ENVIRONMENT"),
  feature("materialAdvantage", "POSITION"),
  feature("phase", "POSITION"),
  feature("humanMoveProbability", "MODEL_DERIVED"),
  feature("mystery", null),
];

const MANIFEST: FrozenHypothesis = {
  schema_version: HYPOTHESIS_SCHEMA_VERSION,
  predicate: {
    atoms: [
      { feature_id: "clockShare", op: "lt", value: 0.37 },
      { feature_id: "materialAdvantage", op: "gt", value: 1 },
    ],
  },
  target: "calibration_gap",
  direction: "higher",
  effect_estimate_derivation: 0.18,
  minimum_meaningful_effect: 0.05,
  generator: "pysubgroup",
  generator_version: "0.8.0",
  feature_versions: { clockShare: 1, materialAdvantage: 1 },
  derivation_game_ids_hash: gameIdsHash(["g1", "g2", "g3"]),
  freeze_timestamp: "2026-08-30T12:00:00.000Z",
  validation_protocol: "timed-matching-condition",
  stopping_rule: { kind: "fixed-games", games: 40 },
  error_budget: { alpha: 0.05, spent_before: 0 },
  parent_hypothesis_id: null,
};

describe("the identity of a frozen hypothesis", () => {
  it("is a sha-256 digest of the canonical manifest", () => {
    const id = freeze(MANIFEST, REGISTRY).hypothesis_id;
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).toBe(sha256Hex(canonicalJson({ ...MANIFEST, predicate: MANIFEST.predicate })));
  });

  it("does not change when the atoms of one conjunction are written in the other order", () => {
    const swapped: FrozenHypothesis = {
      ...MANIFEST,
      predicate: { atoms: [...MANIFEST.predicate.atoms].reverse() },
    };
    expect(hypothesisId(swapped)).toBe(hypothesisId(MANIFEST));
  });

  it("does not change when the manifest's own keys are built in a different order", () => {
    const reordered = Object.fromEntries(
      Object.entries(MANIFEST).reverse(),
    ) as unknown as FrozenHypothesis;
    expect(hypothesisId(reordered)).toBe(hypothesisId(MANIFEST));
  });
});

describe("one semantic byte, one new hypothesis", () => {
  /*
   * Each entry changes ONE thing that changes what the hypothesis says, and every one of them
   * must produce a different id. A threshold, a direction, a feature's arithmetic, the games it
   * came from, the rule for when to stop -- change any and the evidence collected under the old
   * id is evidence about something else.
   */
  const variants: [string, FrozenHypothesis][] = [
    [
      "a threshold moves by one part in a hundred thousand",
      {
        ...MANIFEST,
        predicate: {
          atoms: [
            { feature_id: "clockShare", op: "lt", value: 0.37001 },
            { feature_id: "materialAdvantage", op: "gt", value: 1 },
          ],
        },
      },
    ],
    [
      "the comparison changes from < to <=",
      {
        ...MANIFEST,
        predicate: {
          atoms: [
            { feature_id: "clockShare", op: "lte", value: 0.37 },
            { feature_id: "materialAdvantage", op: "gt", value: 1 },
          ],
        },
      },
    ],
    ["the predicted direction flips", { ...MANIFEST, direction: "lower" }],
    ["a feature's formula version moves", { ...MANIFEST, feature_versions: { clockShare: 2, materialAdvantage: 1 } }],
    ["the derivation games change", { ...MANIFEST, derivation_game_ids_hash: gameIdsHash(["g1", "g2"]) }],
    ["the stopping rule changes", { ...MANIFEST, stopping_rule: { kind: "fixed-games", games: 60 } }],
    ["the error budget changes", { ...MANIFEST, error_budget: { alpha: 0.01, spent_before: 0 } }],
    ["the minimum meaningful effect changes", { ...MANIFEST, minimum_meaningful_effect: 0.02 }],
    ["the protocol changes", { ...MANIFEST, validation_protocol: "natural-timed-holdout" }],
    ["it becomes a refinement of another hypothesis", { ...MANIFEST, parent_hypothesis_id: "abc" }],
    ["the target changes", { ...MANIFEST, target: "cp_loss" }],
    ["the generator changes", { ...MANIFEST, generator: "six-bucket" }],
  ];

  const base = hypothesisId(MANIFEST);
  for (const [name, variant] of variants) {
    it(`gives a new id when ${name}`, () => {
      expect(hypothesisId(variant)).not.toBe(base);
    });
  }

  it("gives every variant a distinct id, not merely a different one", () => {
    const ids = new Set([base, ...variants.map(([, variant]) => hypothesisId(variant))]);
    expect(ids.size).toBe(variants.length + 1);
  });
});

describe("what may not be frozen at all", () => {
  it("refuses a conjunction deeper than the declared maximum", () => {
    const deep: FrozenHypothesis = {
      ...MANIFEST,
      predicate: {
        atoms: [
          { feature_id: "clockShare", op: "lt", value: 0.37 },
          { feature_id: "materialAdvantage", op: "gt", value: 1 },
          { feature_id: "phase", op: "eq", value: "endgame" },
        ],
      },
      feature_versions: { clockShare: 1, materialAdvantage: 1, phase: 1 },
    };
    expect(freezeProblems(deep, REGISTRY)).toContainEqual(expect.stringContaining("depth 3"));
    expect(() => freeze(deep, REGISTRY)).toThrow();
  });

  it("refuses a hypothesis whose predicate no protocol can reproduce", () => {
    // A feature nobody has classified makes the whole claim untestable. Freezing it would promise
    // a verdict that no protocol can deliver.
    const untestable: FrozenHypothesis = {
      ...MANIFEST,
      predicate: { atoms: [{ feature_id: "mystery", op: "lt", value: 1 }] },
      feature_versions: { mystery: 1 },
    };
    expect(freezeProblems(untestable, REGISTRY)).toContainEqual(expect.stringContaining("no protocol"));
  });

  it("REFUSES A PROTOCOL THAT REMOVES THE CONDITION THE CLAIM IS ABOUT", () => {
    /*
     * The worst defect this module has had. `validation_protocol` used to be taken on trust and
     * checked only against `no-verdict`, so an ENVIRONMENT predicate could be frozen declaring
     * `matched-unseen-positions` -- a hashed, immutable record whose stated validation removes the
     * one condition the claim is about. INV-10 violated in writing, at the moment the product
     * commits to how the claim will be judged.
     */
    const substituted: FrozenHypothesis = {
      ...MANIFEST,
      predicate: { atoms: [{ feature_id: "clockShare", op: "lt", value: 0.37 }] },
      feature_versions: { clockShare: 1 },
      validation_protocol: "matched-unseen-positions",
    };
    expect(freezeProblems(substituted, REGISTRY)).toContainEqual(
      expect.stringContaining("needs natural-timed-holdout"),
    );
    expect(() => freeze(substituted, REGISTRY)).toThrow();
  });

  it("accepts the protocol the predicate actually needs", () => {
    const honest: FrozenHypothesis = {
      ...MANIFEST,
      predicate: { atoms: [{ feature_id: "clockShare", op: "lt", value: 0.37 }] },
      feature_versions: { clockShare: 1 },
      validation_protocol: "natural-timed-holdout",
    };
    expect(freezeProblems(honest, REGISTRY)).toEqual([]);
  });

  it("re-derives the protocol rather than believing the manifest, even when both are plausible", () => {
    // `natural-timed-holdout` is a real protocol and this is a real predicate. It is still wrong
    // for THIS predicate, which names a board as well as a clock.
    expect(
      freezeProblems({ ...MANIFEST, validation_protocol: "natural-timed-holdout" }, REGISTRY),
    ).toContainEqual(expect.stringContaining("needs timed-matching-condition"));
  });

  it("refuses a predicate that reads a feature with no recorded formula version", () => {
    const unversioned: FrozenHypothesis = { ...MANIFEST, feature_versions: { clockShare: 1 } };
    expect(freezeProblems(unversioned, REGISTRY)).toContainEqual(
      expect.stringContaining("no feature version recorded for materialAdvantage"),
    );
  });

  it("refuses a claim with no floor, because a claim with no floor cannot fail", () => {
    expect(freezeProblems({ ...MANIFEST, minimum_meaningful_effect: 0 }, REGISTRY)).toContainEqual(
      expect.stringContaining("minimum_meaningful_effect"),
    );
  });

  it("refuses a budget that has nothing left to spend", () => {
    expect(
      freezeProblems({ ...MANIFEST, error_budget: { alpha: 0.05, spent_before: 0.05 } }, REGISTRY),
    ).toContainEqual(expect.stringContaining("spent_before"));
  });
});

describe("a stored record that no longer says what its id names", () => {
  it("is intact when nothing moved", () => {
    expect(frozenIsIntact(freeze(MANIFEST, REGISTRY))).toBe(true);
  });

  it("is not intact when a field changed underneath the id", () => {
    const record = freeze(MANIFEST, REGISTRY);
    expect(frozenIsIntact({ ...record, minimum_meaningful_effect: 0.06 })).toBe(false);
  });
});

describe("canonical json refuses what would make two statements collide", () => {
  it("refuses undefined, which JSON.stringify silently drops", () => {
    // `{a: 1, b: undefined}` and `{a: 1}` stringify identically -- two different manifests, one id.
    expect(() => canonicalJson({ a: 1, b: undefined })).toThrow(/undefined/);
  });

  it("refuses a non-finite number, which JSON.stringify turns into null", () => {
    expect(() => canonicalJson({ effect: Number.NaN })).toThrow(/non-finite/);
  });

  it("refuses negative zero, which is indistinguishable from zero once serialised", () => {
    expect(() => canonicalJson({ effect: -0 })).toThrow(/negative zero/);
  });

  it("keeps null, which is a recorded absence and not a missing key", () => {
    expect(canonicalJson({ parent: null })).toBe('{"parent":null}');
    expect(canonicalJson({ parent: null })).not.toBe(canonicalJson({}));
  });

  it("sorts object keys but never array elements", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson([2, 1])).toBe("[2,1]");
  });
});

describe("the digest is the reference digest", () => {
  /*
   * `shared/discovery/sha256.ts` is a port, and this project's rule for a port is that it is
   * differenced against the thing it was ported from before anything depends on it. The reference
   * is `node:crypto`, which is not importable from `shared/` -- that is the whole reason the port
   * exists -- so the comparison lives here.
   */
  const vectors = [
    "",
    "abc",
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "a".repeat(55),
    "a".repeat(56),
    "a".repeat(63),
    "a".repeat(64),
    "a".repeat(65),
    "a".repeat(119),
    "a".repeat(120),
    "החלטות תחת פחות מ-45 שניות",
    "🙂🙃𝔘𝔫𝔦𝔠𝔬𝔡𝔢",
  ];

  it("matches node:crypto on the published vectors and both padding boundaries", () => {
    for (const vector of vectors) {
      expect(sha256Hex(vector)).toBe(createHash("sha256").update(vector, "utf8").digest("hex"));
    }
  });

  it("matches node:crypto on every length from 0 to 200", () => {
    for (let length = 0; length <= 200; length += 1) {
      const text = "x".repeat(length);
      expect(sha256Hex(text)).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
    }
  });

  it("matches node:crypto on 2,000 random strings, surrogate pairs included", () => {
    // Seeded, because a flaky gate is worse than no gate: it teaches people to re-run it.
    let state = 20260830;
    const random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0x100000000;
    };
    for (let run = 0; run < 2000; run += 1) {
      const length = Math.floor(random() * 200);
      let text = "";
      for (let i = 0; i < length; i += 1) {
        text += String.fromCodePoint(Math.floor(random() * 0x10000) + 32);
      }
      expect(sha256Hex(text)).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
    }
  });

  it("hashes a set of game ids by the set, not by the order it arrived in", () => {
    expect(gameIdsHash(["b", "a"])).toBe(gameIdsHash(["a", "b"]));
    expect(gameIdsHash(["a", "a", "b"])).toBe(gameIdsHash(["a", "b"]));
    // ...and two different sets that concatenate to the same string must not collide.
    expect(gameIdsHash(["ab", "c"])).not.toBe(gameIdsHash(["a", "bc"]));
  });
});
