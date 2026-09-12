/**
 * THE ANALYSIS, FROZEN AS CODE BEFORE THERE IS ANYTHING TO ANALYSE.
 *
 * §10 of the preregistration states six models and §5 requires them committed before the first
 * confirmatory participant is opened. A model stated in prose is a model whose specification can
 * drift in the hand of whoever fits it; a model stated as a value cannot, and the value can be
 * hashed, diffed and pointed at afterwards.
 *
 * WHAT THIS FILE IS AND IS NOT. It is the SPECIFICATION -- formulas, holdout schemes, pass rules,
 * covariate lists -- together with the fold construction, which is the part most easily fudged. It
 * is not a fitting library: this repository has no mixed-model implementation and inventing one
 * here would put an untested estimator between the data and the verdict. `EXP_R2_RUNBOOK.md` names
 * the external tool, and the formulas below are what it is handed.
 *
 * THE RULE ABOVE ALL THE OTHERS: no threshold may be chosen after data are seen. Every number in
 * this file is either taken from §10 or derived from a repository constant, and each says which.
 */
import { REPRESENTATION_LEVELS } from "../codebook.js";
import { STIMULUS_FAMILIES } from "../relations.js";
import type { ResourceTrial } from "../trial.js";

/** Bumped on any change. The analysis version travels with every reported verdict. */
export const ANALYSIS_PLAN_VERSION = 1;

export interface HypothesisSpec {
  id: "H1" | "H2" | "H3" | "H4" | "H5" | "H6";
  question: string;
  /** The outcome, named exactly as the coded or trial field it reads. */
  outcome: string;
  /** Wilkinson-notation formula, handed verbatim to the fitting tool. */
  formula: string;
  /** The one coefficient or comparison the verdict rests on. */
  primary_term: string;
  /** Pre-registered direction, or `two_sided` where §10 pre-claims none. */
  direction: "positive" | "negative" | "two_sided";
  /** What must be true to call it PASS. Copied from §10, not restated loosely. */
  pass_rule: string;
  /** Which stop code fires on failure, or null where failure is informative but not terminal. */
  stop_on_failure: string | null;
}

/**
 * THE RANDOM-EFFECTS STRUCTURE IS NOT OPTIONAL AND IS NOT A STYLE CHOICE.
 *
 * Each participant supplies 16 trials and each template is seen by many participants. Fitting
 * these as independent observations would shrink every standard error by roughly the square root
 * of the cluster size and would manufacture significance out of repetition. §10 specifies
 * `(1 | participant) + (1 | template)` and every model here carries it.
 */
const CLUSTERS = "(1 | participant) + (1 | template)";

export const HYPOTHESES: readonly HypothesisSpec[] = [
  {
    id: "H1",
    question: "Does a controlled topology change alter what the player represents as decision-relevant?",
    outcome: "target_structure_mentioned",
    formula:
      `target_structure_mentioned ~ topology_present + time_regime + z_rating + ` +
      `topology_present:z_rating + topology_present:time_regime + ${CLUSTERS}`,
    primary_term: "topology_present",
    direction: "positive",
    pass_rule:
      "positive coefficient whose 95% participant-cluster bootstrap CI excludes 0; same sign in all four leave-one-family-out runs; sign unchanged when engine pair-difference and non-target graph-edit count enter as nuisance covariates",
    stop_on_failure: "STOP-R2-H1",
  },
  {
    id: "H2",
    question: "Does the representation add held-out information about action beyond the condition itself?",
    outcome: "target_affordance_selected",
    formula:
      `target_affordance_selected ~ template + topology_present + time_regime + z_rating + ${CLUSTERS}`,
    primary_term: "held-out log-loss improvement of B1 over B0",
    direction: "positive",
    pass_rule:
      "B1 (B0 plus coded representation features) improves held-out log loss over B0 under BOTH participant-held-out and template-held-out folds, and the participant-cluster bootstrap 95% CI of the improvement excludes 0",
    stop_on_failure: "STOP-R2-H2",
  },
  {
    id: "H3",
    question: "Does rating moderate relational and coalitional representation?",
    outcome: "relation_or_higher_level",
    formula: `relation_or_higher_level ~ topology_present * z_rating + time_regime + ${CLUSTERS}`,
    primary_term: "topology_present:z_rating",
    direction: "positive",
    pass_rule:
      "positive interaction with a 95% participant-cluster bootstrap CI excluding 0. §2: failure does not overturn H1 or H2",
    stop_on_failure: null,
  },
  {
    id: "H4",
    question: "Does the measurement transfer across language contexts?",
    outcome: "target_structure_mentioned",
    formula:
      `target_structure_mentioned ~ topology_present * language + time_regime + z_rating + ${CLUSTERS}`,
    primary_term: "per-language topology_present, plus leave-one-language-out transfer",
    direction: "two_sided",
    pass_rule:
      "no sign reversal of H1 in any adequately sampled language; H2 held-out log-loss improvement non-negative in all three; the pooled result is not driven by a single language. NO mean comparison of holism, analytic cognition or resource sophistication is computed at all",
    stop_on_failure: "STOP-R2-LANGUAGE",
  },
  {
    id: "H5",
    question: "Does the decision budget interact with representation and topology?",
    outcome: "target_structure_mentioned, target_affordance_selected, timeout",
    formula:
      `outcome ~ topology_present * time_regime + z_rating + ${CLUSTERS}`,
    primary_term: "topology_present:time_regime",
    direction: "two_sided",
    pass_rule:
      "reported with its CI in both directions. §10.5: secondary, and a stable interaction motivates a dedicated experiment rather than a claim about optimal metareasoning",
    stop_on_failure: null,
  },
  {
    id: "H6",
    question: "Does being probed at trial t change behaviour at trial t+1?",
    outcome: "log_think_ms, timeout, target_affordance_selected at t+1",
    formula: `outcome_next ~ probed_at_t + topology_present + time_regime + z_rating + ${CLUSTERS}`,
    primary_term: "probed_at_t",
    direction: "two_sided",
    pass_rule:
      "a carry-over effect whose 95% CI excludes 0 is reported as MEASUREMENT_REACTIVITY_PRESENT. §10.6: it does not invalidate H1 for the already committed move, and it forbids calling repeated probes passive telemetry in later work",
    stop_on_failure: "STOP-R2-REACTIVITY",
  },
];

/**
 * H2's two nested feature sets, listed rather than described.
 *
 * B1 MINUS B0 IS EXACTLY THE CODED REPRESENTATION, which is what makes the comparison a test of
 * representation rather than of model capacity. Nothing derived from the move, the engine or the
 * outcome appears in either: a feature computed from the action cannot be used to predict the
 * action.
 */
export const H2_BASELINE_FEATURES = [
  "template",
  "topology_present",
  "time_regime",
  "z_rating",
] as const;

export const H2_REPRESENTATION_FEATURES = [
  "target_structure_mentioned",
  "target_telos_linked",
  "first_level",
  ...REPRESENTATION_LEVELS.map((level) => `level_${level.toLowerCase()}`),
] as const;

/**
 * Holdout construction. §10.2 names two schemes and this is how the folds are actually cut.
 *
 * DETERMINISTIC FROM A SEED, AND THE SEED IS RECORDED. §15 requires "the exact holdout assignments"
 * to be reproducible. A fold drawn from an unseeded generator makes every reported held-out number
 * unrepeatable, and an unrepeatable held-out number is indistinguishable from a chosen one.
 */
export const HOLDOUT_SCHEMES = ["participant_held_out", "template_held_out"] as const;
export type HoldoutScheme = (typeof HOLDOUT_SCHEMES)[number];
export const HOLDOUT_FOLDS = 5;

/** A stable 32-bit hash. Used only to assign folds, never to order anything a human reads. */
function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Which fold a trial's held-out unit falls in.
 *
 * KEYED ON THE UNIT, NOT ON THE TRIAL. A participant-held-out fold that split one participant's
 * trials across folds would leak that participant's idiolect from train into test, and the held-out
 * improvement would be measuring how consistently people write rather than whether representation
 * predicts action.
 */
export function foldOf(trial: ResourceTrial, scheme: HoldoutScheme, seed: string): number {
  const unit = scheme === "participant_held_out" ? trial.participant_id : trial.template_id;
  return stableHash(`${seed}:${scheme}:${unit}`) % HOLDOUT_FOLDS;
}

/** §11 C7: the four leave-one-family-out runs H1's pass rule requires. */
export const FAMILY_HOLDOUTS = STIMULUS_FAMILIES;

/**
 * Which trials may enter the confirmatory analysis at all, and why each exclusion is not a filter
 * chosen after the fact.
 *
 * TIMEOUTS ARE EXCLUDED FROM MOVE-SPECIFIC MODELS AND COUNTED EVERYWHERE ELSE. §7.2 says so in
 * exactly those words, and the reason is that a timeout has no move for H2's outcome to be about
 * while being an outcome in its own right for H5.
 */
export interface EligibilityVerdict {
  h1: boolean;
  h2: boolean;
  h5_timeout_model: boolean;
  reasons: string[];
}

export function eligibility(trial: ResourceTrial): EligibilityVerdict {
  const reasons: string[] = [];
  if (trial.cohort !== "confirmatory") reasons.push("not in the confirmatory cohort");
  if (trial.contamination !== null) reasons.push(`contaminated: ${trial.contamination.kind}`);
  const clean = reasons.length === 0;
  const probed = trial.probe_assignment === "probed" && trial.resource_primary.state === "answered";
  if (!probed) reasons.push("no coded response: H1 and H2 read probed trials only");
  return {
    h1: clean && probed && !trial.timed_out,
    h2: clean && probed && !trial.timed_out && trial.move !== null,
    h5_timeout_model: clean,
    reasons,
  };
}
