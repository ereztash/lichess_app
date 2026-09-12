/**
 * WHAT A CODER IS ALLOWED TO SEE, BUILT SO THAT SEEING MORE IS NOT POSSIBLE RATHER THAN NOT ALLOWED.
 *
 * §8 requires confirmatory responses to be coded by two coders blind to topology condition, engine
 * evaluation, move quality, rating and later result. §11's control C2 restates it as a property of
 * the payload: "coders cannot recover condition from metadata supplied to them BECAUSE condition
 * metadata is absent".
 *
 * PROCEDURAL BLINDNESS IS THE FAILURE MODE THIS FILE EXISTS TO PREVENT. A dataset that contains the
 * condition and an instruction not to look at it is blind until somebody sorts by a column. So the
 * export is CONSTRUCTED, field by field, from a whitelist -- never the trial object with fields
 * deleted. A spread with omissions silently re-admits every field added later; a constructor does
 * not compile when a required field is missing and cannot leak one that was never named.
 *
 * THE TEMPLATE ID IS THE HARD CASE AND IT IS NOT EXPORTED. §8 does not list it, and it is worse
 * than it looks: a coder who sees `SD-01` on two responses knows they are the same template, and a
 * template has a target relation, so a coder coding the whole set can reconstruct which arm each
 * response came from by noticing which responses mention a structure the others do not. A per-batch
 * salted token replaces it, which preserves what coding actually needs -- knowing which target
 * structure the rule is about -- while carrying no cross-batch identity.
 *
 * WHAT REMAINS VISIBLE, and why each is safe:
 *   - the response text, which is the thing being coded;
 *   - the language, because the coder must be bilingual in it and §8 codes in the source language;
 *   - the target-structure rule for this template, because `target_structure_mentioned` is defined
 *     per template and a coder who does not know the rule is coding something else;
 *   - a stable opaque token, so two coders can be compared response by response.
 */
import { createHash } from "node:crypto";
import type { ResearchLanguage } from "./trial.js";
import type { ResourceTrial } from "./trial.js";

/**
 * The complete list of what a coder receives. If a field is not here, it is not exported.
 *
 * THIS ARRAY IS THE CONTRACT AND A TEST READS IT. `tests/research/tcrf/coder-blindness.test.ts`
 * asserts that every key of a built payload appears here and that none of the forbidden keys does,
 * over a trial deliberately loaded with values that would give the condition away.
 */
export const CODER_VISIBLE_FIELDS = [
  "coding_token",
  "response_primary",
  "response_secondary",
  "response_telos",
  "language",
  "target_structure_rule",
  "codebook_version",
] as const;

/**
 * What may never reach a coder, named so the test can be written in the same words §8 uses.
 *
 * `template_id` AND `family` ARE ON THIS LIST THOUGH §8 DOES NOT NAME THEM, for the reason in the
 * docblock: they are re-identifiers. `trial_index` is here too -- H6's variable -- because a coder
 * who can see position-in-session can see the participant's trajectory.
 */
export const CODER_FORBIDDEN_FIELDS = [
  "topology_condition",
  "is_base_arm",
  "move",
  "fen",
  "think_ms",
  "timed_out",
  "rating_snapshot",
  "engine_eval_cp",
  "cp_loss",
  "best_move",
  "target_affordance",
  "template_id",
  "family",
  "participant_id",
  "trial_id",
  "trial_index",
  "time_regime",
  "budget_ms",
  "probe_assignment",
  "cohort",
] as const;

export interface CoderPayload {
  /** Opaque, stable within a batch, meaningless across batches. */
  coding_token: string;
  response_primary: string | null;
  response_secondary: string | null;
  response_telos: string | null;
  language: ResearchLanguage;
  /**
   * The frozen per-template rule for `target_structure_mentioned`, in prose, WITHOUT the arm.
   *
   * A rule reads "the response asserts that the rook on e1 covers e5". It does not read "in this
   * condition the rook does cover e5", which would hand the coder the answer with the question.
   */
  target_structure_rule: string;
  codebook_version: number;
}

export interface CodingBatch {
  batch_id: string;
  /**
   * The salt that makes `coding_token` opaque. KEPT OUT OF THE PAYLOAD AND OUT OF THE REPOSITORY.
   *
   * A salt committed beside the export would make the token reversible by anyone who can read the
   * tree, which is every state except the one this is for.
   */
  salt: string;
  codebook_version: number;
  /** Per template, the frozen prose rule. Missing entries are an error, not an empty string. */
  rules: Map<string, string>;
}

export const codingToken = (batch: CodingBatch, trialId: string): string =>
  createHash("sha256").update(`${batch.salt}:${batch.batch_id}:${trialId}`).digest("hex").slice(0, 16);

export class CoderExportError extends Error {}

/**
 * One trial to one payload, constructed rather than filtered.
 *
 * THROWS ON A MISSING RULE instead of exporting an empty one. A coder handed a blank rule would
 * code `target_structure_mentioned` from their own idea of what the target structure is, and two
 * coders' own ideas agreeing is not the reliability §8 is measuring.
 */
export function toCoderPayload(batch: CodingBatch, trial: ResourceTrial): CoderPayload {
  const rule = batch.rules.get(trial.template_id);
  if (!rule) {
    throw new CoderExportError(
      `no frozen target-structure rule for ${trial.template_id}; §8 requires the rule before confirmatory coding`,
    );
  }
  return {
    coding_token: codingToken(batch, trial.trial_id),
    response_primary: trial.resource_primary.text,
    response_secondary: trial.resource_secondary.text,
    response_telos: trial.telos.text,
    language: trial.language,
    target_structure_rule: rule,
    codebook_version: batch.codebook_version,
  };
}

/**
 * Which trials may be coded at all.
 *
 * A CONTAMINATED TRIAL IS EXCLUDED BEFORE CODING, NOT AFTER. §7.4 excludes it from H1/H2 anyway, and
 * coding it would spend two coders' attention on a row that cannot carry a verdict while inflating
 * the reliability denominator with rows nobody will use.
 */
export const codeable = (trial: ResourceTrial): boolean =>
  trial.contamination === null &&
  trial.probe_assignment === "probed" &&
  trial.resource_primary.state === "answered";

/** The batch, in a stable order that carries no information about condition. */
export function buildCodingBatch(batch: CodingBatch, trials: ResourceTrial[]): CoderPayload[] {
  return trials
    .filter(codeable)
    .map((trial) => toCoderPayload(batch, trial))
    /*
     * SORTED BY THE OPAQUE TOKEN, WHICH IS THE POINT. Input order is collection order, and
     * collection order carries session structure: consecutive rows are one participant, and a
     * participant's arm assignment is balanced, so the sequence itself leaks. Sorting by a salted
     * hash destroys that without needing a random number generator anybody has to seed and store.
     */
    .sort((a, b) => a.coding_token.localeCompare(b.coding_token));
}

/** Every forbidden key a payload actually carries. Empty is the only admissible answer. */
export function blindnessBreaches(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if ((CODER_FORBIDDEN_FIELDS as readonly string[]).includes(key)) found.push(key);
      walk(value);
    }
  };
  walk(payload);
  return [...new Set(found)].sort();
}

/** Keys a payload carries that the whitelist does not name. A new field is a finding, not a default. */
export function undeclaredFields(payload: CoderPayload): string[] {
  return Object.keys(payload)
    .filter((key) => !(CODER_VISIBLE_FIELDS as readonly string[]).includes(key))
    .sort();
}
