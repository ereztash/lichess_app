/**
 * A HYPOTHESIS, FROZEN BEFORE ANY OF THE EVIDENCE THAT WILL JUDGE IT EXISTS.
 *
 * WHAT A FREEZE IS FOR. A search over a record spends the record's freedom: given enough
 * candidates, something separates. What buys that freedom back is naming ONE candidate, writing
 * down everything about how it will be judged, and then not touching any of it while the evidence
 * arrives. `shared/prereg.ts` already does exactly this for the six shipped buckets and says why
 * -- "a hypothesis tested on the data that suggested it is not a hypothesis". This is the same
 * commitment for a subgroup that a search produced rather than a list.
 *
 * EVERY FIELD IS A COMMITMENT, and each is here because deciding it afterwards would change what
 * the eventual verdict means:
 *
 *   predicate                     what the subgroup IS. Canonical, so it has one form.
 *   target / direction            what is being measured and which way it is predicted to go.
 *                                 A claim with no direction cannot be refuted by one-sided
 *                                 evidence -- `shared/drill.ts` records what that cost.
 *   minimum_meaningful_effect     the size below which a confirmation is not worth telling anyone.
 *                                 Decided now, or it is decided by whatever came back.
 *   validation_protocol           which protocol may judge this (shared/discovery/claim-class.ts).
 *                                 A claim whose class is UNKNOWN carries `no-verdict` and gets none.
 *   stopping_rule / error_budget  when to stop looking and what the looking cost.
 *   feature_versions              the arithmetic behind every feature the predicate reads. A
 *                                 formula change makes this a different quantity with the same name.
 *   derivation_game_ids_hash      WHICH GAMES SUGGESTED IT, as a hash rather than a list. It is
 *                                 what lets a later reader prove the validation games were not
 *                                 among them, without the manifest carrying the whole record.
 *
 * THE ID IS THE HASH OF ALL OF IT. Change one semantic byte -- a threshold, a direction, a feature
 * version, the stopping rule -- and it is a different hypothesis with a different id, which cannot
 * inherit the evidence collected against the old one. That is the invariant this module exists for,
 * and `tests/discovery/one-byte-is-a-different-hypothesis.test.ts` is what holds it.
 */
import type { ValidationProtocolKind } from "./claim-class.js";
import { canonicalJson } from "./manifest-hash.js";
import { canonicalPredicate, predicateProblems, type Predicate } from "./predicate.js";
import { sha256Hex } from "./sha256.js";

/**
 * The version of this manifest's SHAPE.
 *
 * Part of the hashed content on purpose: a manifest written under a later schema is not the same
 * statement as one written under an earlier one even if every shared field matches, because the
 * later schema may commit to something the earlier one left free.
 */
export const HYPOTHESIS_SCHEMA_VERSION = 1;

/** Which way the effect is predicted to go inside the subgroup, relative to the rest. */
export type EffectDirection = "higher" | "lower";

export interface FrozenHypothesis {
  schema_version: number;
  /** Canonical. `freeze` canonicalises before hashing, so a caller cannot make two ids for one set. */
  predicate: Predicate;
  /** The quantity measured. `calibration_gap` is the only one today; naming it keeps that a fact. */
  target: string;
  direction: EffectDirection;
  /** What the derivation half measured. Recorded so the validation can be compared with it. */
  effect_estimate_derivation: number;
  /**
   * The smallest effect worth reporting, decided BEFORE the evidence.
   *
   * WITHOUT IT A CONFIRMATION IS UNFALSIFIABLE IN PRACTICE: with enough decisions any non-zero
   * difference clears a separability bar, and "statistically separable" then does the work of
   * "worth telling a player about" without anyone having agreed that it should.
   */
  minimum_meaningful_effect: number;
  /** What produced the candidate, and which version of it. */
  generator: string;
  generator_version: string;
  /** Every feature the predicate reads, with the formula version that produced its values. */
  feature_versions: Record<string, number>;
  /** SHA-256 over the sorted, newline-joined derivation game ids. See `gameIdsHash`. */
  derivation_game_ids_hash: string;
  freeze_timestamp: string;
  validation_protocol: ValidationProtocolKind;
  /**
   * When to stop collecting. `fixed-games` names a count of GAMES rather than decisions, because
   * a decision count is not a unit of evidence when decisions cluster -- see Q1 of the M0 audit.
   */
  stopping_rule: { kind: "fixed-games"; games: number } | { kind: "none" };
  /** The alpha this test may spend, and what has already been spent from the same budget. */
  error_budget: { alpha: number; spent_before: number };
  /** The hypothesis this one refines, or null. A refinement is a NEW hypothesis, never an edit. */
  parent_hypothesis_id: string | null;
}

/** A manifest with its identity attached. The only shape anything downstream should store. */
export interface FrozenHypothesisRecord extends FrozenHypothesis {
  hypothesis_id: string;
}

/**
 * The hash of the games a candidate was derived from.
 *
 * SORTED AND DEDUPLICATED, so the hash is a fact about the SET rather than about the order the
 * store happened to return. A newline separator rather than a concatenation: ids `["ab", "c"]` and
 * `["a", "bc"]` are different sets and must not collide.
 */
export function gameIdsHash(gameIds: readonly string[]): string {
  return sha256Hex([...new Set(gameIds)].sort().join("\n"));
}

/**
 * The identity of a manifest.
 *
 * The predicate is canonicalised first, so two orderings of the same conjunction cannot produce
 * two ids. Everything else is hashed as written -- normalising a field's VALUE would be this
 * module deciding that two different statements are the same one.
 */
export function hypothesisId(manifest: FrozenHypothesis): string {
  return sha256Hex(canonicalJson({ ...manifest, predicate: canonicalPredicate(manifest.predicate) }));
}

/**
 * Freeze a hypothesis: canonicalise, check, hash.
 *
 * REFUSES RATHER THAN REPAIRS. A predicate too deep, a protocol that cannot produce a verdict, a
 * feature the predicate reads with no version recorded -- each of those is a hypothesis that
 * should not be frozen, and freezing a repaired version of it would freeze something nobody wrote.
 */
export function freeze(manifest: FrozenHypothesis): FrozenHypothesisRecord {
  const problems = freezeProblems(manifest);
  if (problems.length > 0) {
    throw new Error(`this hypothesis cannot be frozen: ${problems.join("; ")}`);
  }
  const canonical: FrozenHypothesis = {
    ...manifest,
    predicate: canonicalPredicate(manifest.predicate),
  };
  return { ...canonical, hypothesis_id: hypothesisId(canonical) };
}

/** Every reason this manifest may not be frozen. Reasons, not a boolean. */
export function freezeProblems(manifest: FrozenHypothesis): string[] {
  const problems = [...predicateProblems(manifest.predicate)];
  if (manifest.schema_version !== HYPOTHESIS_SCHEMA_VERSION) {
    problems.push(
      `schema_version ${manifest.schema_version} is not this build's ${HYPOTHESIS_SCHEMA_VERSION}`,
    );
  }
  if (manifest.validation_protocol === "no-verdict") {
    problems.push("its class admits no protocol, so freezing it would promise a verdict nothing can give");
  }
  if (!(manifest.minimum_meaningful_effect > 0)) {
    problems.push("minimum_meaningful_effect must be positive: a claim with no floor cannot fail");
  }
  if (!(manifest.error_budget.alpha > 0) || manifest.error_budget.alpha >= 1) {
    problems.push("error_budget.alpha must be in (0, 1)");
  }
  if (manifest.error_budget.spent_before < 0 || manifest.error_budget.spent_before >= manifest.error_budget.alpha) {
    problems.push("error_budget.spent_before must be non-negative and leave something to spend");
  }
  /*
   * EVERY FEATURE THE PREDICATE READS NEEDS ITS FORMULA VERSION. Without it the manifest names a
   * subgroup in terms of an arithmetic that could change underneath it, and the evidence collected
   * afterwards would be about a different quantity wearing the same column name.
   */
  for (const atom of canonicalPredicate(manifest.predicate).atoms) {
    if (!(atom.feature_id in manifest.feature_versions)) {
      problems.push(`no feature version recorded for ${atom.feature_id}`);
    }
  }
  if (manifest.derivation_game_ids_hash.length !== 64) {
    problems.push("derivation_game_ids_hash is not a sha-256 digest");
  }
  return problems;
}

/**
 * Whether a stored record still hashes to the id it carries.
 *
 * WHAT THIS CATCHES, and it is not tampering in the security sense. A frozen manifest travels
 * through a store, a serialiser and a migration; any of them can change a number's type, drop a
 * key or reorder a list. The id would then be a name for something the record no longer says, and
 * evidence would keep accumulating against it. This is the check that turns that into a failure
 * instead of a slow divergence.
 */
export function frozenIsIntact(record: FrozenHypothesisRecord): boolean {
  const { hypothesis_id: id, ...manifest } = record;
  return hypothesisId(manifest) === id;
}
