/**
 * WHAT A CLAIM IS ABOUT, AND THEREFORE WHAT COULD TEST IT.
 *
 * `shared/validation-protocol.ts` already holds the argument this module generalises: a claim
 * about the decision ENVIRONMENT cannot be tested by a protocol that removes the environment, and
 * "your calibration slips under time pressure" is not tested by showing somebody a position with
 * no clock running. That module answers the question for the six bucket keys the detector ships
 * with, by listing them.
 *
 * A LIST OF KEYS CANNOT SURVIVE A SEARCH. The moment a subgroup is a predicate over features
 * rather than one of six names, "which protocol does this need" has to be DERIVED -- from what the
 * predicate reads. This module derives it, and `validation-protocol.ts` now asks it rather than
 * keeping a second list.
 *
 * THE ANSWER IS SOMETIMES `UNKNOWN`, AND THAT IS A REAL ANSWER. A predicate over a feature nobody
 * has classified is a claim nothing in this product knows how to test, and the correct handling of
 * it is silence -- not a drill chosen because it was the only protocol on the shelf. `docs/blitz/
 * ADR-003` records what the alternative costs: the product drills a `fast-under-45s` claim on
 * eight static positions and grades it TERMINALLY, and refutation cannot be revisited.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DECIDE. ADR-003 leaves open whether a position drill may
 * grade a think-time claim at all -- three defensible positions, all argued in the repository, and
 * the choice belongs to whoever owns the product. Nothing here settles it. What is settled is that
 * the classification is now a VALUE that the grading path can consult, so whichever of the three
 * is chosen becomes an edit to one table instead of an argument reconstructed from scratch.
 */
import type { FeatureSpec } from "./feature-contract.js";
import { canonicalPredicate, type Predicate } from "./predicate.js";

/**
 * The kind of condition one feature names.
 *
 * POSITION is reproducible by choosing a board. ENVIRONMENT is not: no choice of positions puts a
 * player under time pressure. SEQUENCE is a property of an ordered run of decisions, so it can
 * only be observed in a complete game played forward. MODEL_DERIVED is a value some model
 * produced, and a claim resting on one is only reproducible while that model version is pinned.
 */
export const CONDITION_KINDS = ["POSITION", "ENVIRONMENT", "SEQUENCE", "MODEL_DERIVED"] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

/** The taxonomy a claim is classified into. `UNKNOWN` is the answer, not the absence of one. */
export const CLAIM_CLASSES = [
  "POSITION",
  "ENVIRONMENT",
  "POSITION_X_ENVIRONMENT",
  "SEQUENCE",
  "MODEL_DERIVED",
  "UNKNOWN",
] as const;
export type ClaimClass = (typeof CLAIM_CLASSES)[number];

/**
 * The protocol each class requires. One row per class, and every row says what it costs.
 *
 * `no-verdict` IS A PROTOCOL IN THIS TABLE, deliberately. Leaving `UNKNOWN` out and returning null
 * would let a caller treat "we have not classified this" as "the default protocol applies", which
 * is precisely how a clock claim came to be tested with a chessboard.
 */
export type ValidationProtocolKind =
  /** Positions the player has not decided on before, matched to the claim's scope. */
  | "matched-unseen-positions"
  /** Decisions collected as they naturally occur, under the environment the claim names. */
  | "natural-timed-holdout"
  /** A holdout that must match BOTH the position class and the clock condition. */
  | "timed-matching-condition"
  /** Complete games played forward, because the claim is about an order of events. */
  | "future-complete-games"
  /** A holdout whose model version is pinned to the one the claim was derived under. */
  | "model-version-locked-holdout"
  /** Nothing this product can run tests this claim. It does not get a verdict. */
  | "no-verdict";

export const PROTOCOL_FOR_CLASS: Readonly<
  Record<ClaimClass, { protocol: ValidationProtocolKind; because: string }>
> = {
  POSITION: {
    protocol: "matched-unseen-positions",
    because: "the condition is a board, and a board can be presented again",
  },
  ENVIRONMENT: {
    protocol: "natural-timed-holdout",
    because: "no choice of positions reproduces a clock; the condition has to occur on its own",
  },
  POSITION_X_ENVIRONMENT: {
    protocol: "timed-matching-condition",
    because: "both halves of the condition have to hold at once, so neither protocol alone will do",
  },
  SEQUENCE: {
    protocol: "future-complete-games",
    because: "an order of events exists only in a game played forward",
  },
  MODEL_DERIVED: {
    protocol: "model-version-locked-holdout",
    because: "the subgroup is defined by a model's output, so the model version is part of the claim",
  },
  UNKNOWN: {
    protocol: "no-verdict",
    because: "nothing here knows what condition this names, so nothing here can reproduce it",
  },
};

/**
 * WHAT A PROTOCOL HAS TO DO, one obligation per condition kind.
 *
 * THE LEVEL THE FIRST VERSION OF THIS FILE WAS MISSING, and it cost a real defect. `classifyKinds`
 * picked ONE class by precedence -- model-derived beats sequence beats the rest -- and this file's
 * own comment said why that was meant to be safe: *"a predicate mixing a model output with a phase
 * needs the model pinned AND the positions matched, and the row that names the pin is the one that
 * would otherwise be lost."* The comment describes a CONJUNCTION. The code implemented a PRIORITY,
 * so it kept the pin and lost the positions -- the same substitution INV-10 forbids, arrived at
 * from the other side. Reported by a review bot on the pull request that introduced it.
 *
 * A requirement is not a protocol. It is the thing a protocol must be able to do, and a predicate's
 * requirements are the UNION over its features. Nothing about a union can silently drop a term.
 */
export const PROTOCOL_REQUIREMENTS = [
  /** Present the same class of board again. */
  "match-position-class",
  /** Have the clock condition actually hold while the decision is made. */
  "reproduce-clock-condition",
  /** Observe an ordered run of decisions, which exists only in a game played forward. */
  "observe-a-complete-game-forward",
  /** Hold the model version the subgroup was defined under. */
  "pin-the-model-version",
] as const;
export type ProtocolRequirement = (typeof PROTOCOL_REQUIREMENTS)[number];

const REQUIREMENT_OF_KIND: Readonly<Record<ConditionKind, ProtocolRequirement>> = {
  POSITION: "match-position-class",
  ENVIRONMENT: "reproduce-clock-condition",
  SEQUENCE: "observe-a-complete-game-forward",
  MODEL_DERIVED: "pin-the-model-version",
};

/**
 * What each protocol can actually do.
 *
 * DECLARED AS A CAPABILITY SET RATHER THAN INFERRED FROM THE NAME, so that adding a protocol means
 * stating what it reproduces. `future-complete-games` deliberately does NOT claim
 * `match-position-class`: a game played forward is not a game whose positions anyone chose.
 */
const PROTOCOL_SATISFIES: Readonly<Record<ValidationProtocolKind, readonly ProtocolRequirement[]>> = {
  "matched-unseen-positions": ["match-position-class"],
  "natural-timed-holdout": ["reproduce-clock-condition"],
  "timed-matching-condition": ["match-position-class", "reproduce-clock-condition"],
  "future-complete-games": ["observe-a-complete-game-forward"],
  "model-version-locked-holdout": ["pin-the-model-version"],
  /** Satisfies nothing, which is what makes it the answer when nothing else does. */
  "no-verdict": [],
};

/** Whether this protocol can do everything this claim needs. */
export function protocolSatisfies(
  protocol: ValidationProtocolKind,
  requirements: readonly ProtocolRequirement[],
): boolean {
  const satisfied = new Set(PROTOCOL_SATISFIES[protocol]);
  return requirements.every((requirement) => satisfied.has(requirement));
}

/**
 * The requirements a set of condition kinds imposes. A UNION, never a winner.
 *
 * `null` in the list means a feature nobody has classified, and it makes the whole set unknown --
 * one unclassified term makes the claim untestable, because nothing can say what reproducing it
 * would involve.
 */
export function requirementsForKinds(kinds: readonly (ConditionKind | null)[]): {
  requirements: ProtocolRequirement[];
  unknown: boolean;
} {
  if (kinds.length === 0 || kinds.some((kind) => kind === null)) {
    return { requirements: [], unknown: true };
  }
  const required = new Set<ProtocolRequirement>();
  for (const kind of kinds as ConditionKind[]) required.add(REQUIREMENT_OF_KIND[kind]);
  return {
    requirements: PROTOCOL_REQUIREMENTS.filter((requirement) => required.has(requirement)),
    unknown: false,
  };
}

/**
 * The protocol that can do EVERYTHING a claim needs, or `no-verdict`.
 *
 * REFUSES RATHER THAN APPROXIMATES. A predicate over a phase and a model output needs both the
 * positions matched and the model pinned, and no protocol in the table does both -- so the honest
 * answer is that this product cannot test that claim yet, not that a model-locked holdout is close
 * enough. When D17 opens and such a protocol exists, adding a row here makes the claim testable and
 * nothing else has to change.
 *
 * The first protocol in declaration order that covers the set, so the answer is deterministic and
 * the cheapest sufficient protocol wins over a stricter one that would also do.
 */
export function protocolSatisfying(requirements: readonly ProtocolRequirement[]): ValidationProtocolKind {
  if (requirements.length === 0) return "no-verdict";
  for (const protocol of PROTOCOL_ORDER) {
    if (protocolSatisfies(protocol, requirements)) return protocol;
  }
  return "no-verdict";
}

/** Cheapest first, so a claim needing one thing is not sent to a protocol that does two. */
const PROTOCOL_ORDER: readonly ValidationProtocolKind[] = [
  "matched-unseen-positions",
  "natural-timed-holdout",
  "future-complete-games",
  "model-version-locked-holdout",
  "timed-matching-condition",
];

/**
 * Classify a set of condition kinds into the taxonomy's headline label.
 *
 * THE LABEL IS A NAME, NOT THE DISPATCH. It answers "what kind of claim is this" for a reader and
 * for the six shipped bucket keys, each of which has exactly one kind. It is NOT what decides the
 * protocol -- `protocolSatisfying(requirementsForKinds(...))` is, and the difference is the defect
 * described above. Anything choosing a protocol from this label alone for a MIXED predicate is
 * reintroducing it.
 *
 *   1. anything unclassified  -> UNKNOWN. One unknown term makes the whole claim untestable.
 *   2. any model-derived      -> MODEL_DERIVED
 *   3. any sequence           -> SEQUENCE
 *   4. position and environment together -> POSITION_X_ENVIRONMENT
 *   5. otherwise the one kind present
 */
export function classifyKinds(kinds: readonly (ConditionKind | null)[]): ClaimClass {
  if (kinds.length === 0) return "UNKNOWN";
  if (kinds.some((kind) => kind === null)) return "UNKNOWN";
  const present = new Set(kinds as ConditionKind[]);
  if (present.has("MODEL_DERIVED")) return "MODEL_DERIVED";
  if (present.has("SEQUENCE")) return "SEQUENCE";
  if (present.has("POSITION") && present.has("ENVIRONMENT")) return "POSITION_X_ENVIRONMENT";
  if (present.has("ENVIRONMENT")) return "ENVIRONMENT";
  return "POSITION";
}

/**
 * Classify a predicate against a registry.
 *
 * A FEATURE THE REGISTRY DOES NOT CARRY MAKES THE WHOLE CLAIM UNKNOWN, rather than being skipped.
 * Skipping it would classify the claim on the terms it happens to recognise and then test it as
 * though the unrecognised term were not there -- which is the same substitution INV-10 forbids,
 * arrived at by omission instead of by choice.
 */
export function classifyPredicate(
  predicate: Predicate,
  registry: readonly FeatureSpec[],
): {
  claimClass: ClaimClass;
  unclassified: string[];
  /** Everything a protocol must be able to do for this predicate. A union over its features. */
  requirements: ProtocolRequirement[];
  /**
   * THE ANSWER CALLERS SHOULD USE. Derived from the requirement SET, not from `claimClass` -- a
   * mixed predicate's label names only its strictest kind, and dispatching on the label is how the
   * other kind's requirement gets dropped.
   */
  protocol: ValidationProtocolKind;
} {
  const byId = new Map(registry.map((spec) => [spec.id, spec]));
  const unclassified: string[] = [];
  const kinds: (ConditionKind | null)[] = [];
  for (const atom of canonicalPredicate(predicate).atoms) {
    const spec = byId.get(atom.feature_id);
    if (!spec || !spec.condition_kind) {
      unclassified.push(atom.feature_id);
      kinds.push(null);
      continue;
    }
    kinds.push(spec.condition_kind);
  }
  const { requirements, unknown } = requirementsForKinds(kinds);
  return {
    claimClass: classifyKinds(kinds),
    unclassified,
    requirements,
    protocol: unknown ? "no-verdict" : protocolSatisfying(requirements),
  };
}

/** The protocol a predicate needs, or `no-verdict`. The one call a freeze or a judge should make. */
export function protocolForPredicate(
  predicate: Predicate,
  registry: readonly FeatureSpec[],
): ValidationProtocolKind {
  return classifyPredicate(predicate, registry).protocol;
}

/** The protocol a claim of this class requires, with the reason it requires it. */
export function protocolForClass(claimClass: ClaimClass): {
  protocol: ValidationProtocolKind;
  because: string;
} {
  return PROTOCOL_FOR_CLASS[claimClass];
}

/** Whether a claim of this class may receive a verdict at all. */
export const canBeGraded = (claimClass: ClaimClass): boolean =>
  PROTOCOL_FOR_CLASS[claimClass].protocol !== "no-verdict";

/**
 * The six shipped bucket keys, as condition kinds.
 *
 * THIS IS THE BRIDGE, NOT A SECOND LIST. `shared/validation-protocol.ts` used to hold two sets of
 * bucket keys and derive its protocol from them; it now derives them from here, so there is one
 * place where "a clock is not a property of a board" is written down. The `standing-*` keys are
 * POSITION for the reason that module already gives: a standing is the engine's verdict on the
 * position, and a position where the player is losing can be presented again.
 *
 * NULL FOR AN UNRECOGNISED KEY, which becomes `UNKNOWN` and therefore `no-verdict`. A seventh
 * bucket added without deciding how it can be validated is a bucket whose claims cannot be
 * validated, and saying so is better than quietly testing a clock with a chessboard.
 */
const BUCKET_CONDITION_KIND: Readonly<Record<string, ConditionKind>> = {
  "phase-opening": "POSITION",
  "phase-middlegame": "POSITION",
  "phase-endgame": "POSITION",
  "standing-winning": "POSITION",
  "standing-level": "POSITION",
  "standing-losing": "POSITION",
  "fast-under-45s": "ENVIRONMENT",
  "slow-over-2m": "ENVIRONMENT",
  "clock-under-1m": "ENVIRONMENT",
};

export function conditionKindOfBucket(bucketKey: string): ConditionKind | null {
  return BUCKET_CONDITION_KIND[bucketKey] ?? null;
}

/** The class of a claim named by one of the shipped bucket keys. */
export function classifyBucketKey(bucketKey: string): ClaimClass {
  return classifyKinds([conditionKindOfBucket(bucketKey)]);
}
