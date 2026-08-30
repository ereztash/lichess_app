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
 * Classify a set of condition kinds.
 *
 * PRECEDENCE, AND WHY IT RUNS IN THIS ORDER. Each rule below answers "what is the strictest thing
 * this claim needs?", and strictness is what has to win: a predicate mixing a model output with a
 * phase needs the model pinned AND the positions matched, and the row that names the pin is the
 * one that would otherwise be lost.
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
): { claimClass: ClaimClass; unclassified: string[] } {
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
  return { claimClass: classifyKinds(kinds), unclassified };
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
