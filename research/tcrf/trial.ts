/**
 * THE EXP-R2 RESEARCH RECORD. Append-only, research-only, and deliberately NOT the `DecisionAtom`.
 *
 * WHY A SEPARATE RECORD RATHER THAN NEW FIELDS ON THE ATOM. `shared/decision-atom.ts` is asserted
 * field-for-field across three runtime layers by GATE-ISO: the screen state, the API event and the
 * session report must carry the same list in the same order. Adding `topology_condition` to it
 * would oblige the product's screen, its event and its report to carry an experimental field, which
 * is exactly what §18 of this task and §1 of the preregistration forbid. The atom is also the thing
 * claims are derived from, and a research column inside it would eventually be read by a claim.
 *
 * WHAT IS BORROWED RATHER THAN REINVENTED. The ordering rule -- commit first, measure after, never
 * add instrument time to decision time -- comes from `shared/blitz-instrument.ts` and is enforced
 * in `protocol.ts`. The three-armed probe idea, where "not asked" and "asked and unanswered" are
 * different rows rather than one null, comes from that module's `probeSchema` and is the reason
 * every free-text field here carries a status beside it.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: NO MISSING MEASUREMENT BECOMES `false`, `0` OR `""`.
 * `shared/measured-duration.ts` and GATE-MEASURE exist in this repository because a missing think
 * time once read as zero. Every optional quantity below is therefore a value PLUS a status, and the
 * statuses distinguish the four cases that have to stay distinguishable:
 *
 *     not_asked          the design did not put the question
 *     asked_unanswered   it was put and the participant produced nothing
 *     answered           there is a response
 *     capture_failed     the instrument lost it
 */
import { z } from "zod";
import { STIMULUS_FAMILIES } from "./relations.js";
import { TOPOLOGY_ARMS } from "./stimulus.js";

/** Bumped when any field here changes meaning. Recorded on every row; §15 reproducibility. */
export const TRIAL_PROTOCOL_VERSION = 1;

/**
 * The measurement languages, which are NOT the product's languages.
 *
 * `shared/interface-language.ts` declares `["he", "en"]` and says in its own docblock that a second
 * language would be a second population needing a field arm. EXP-R2 needs three, and adding Spanish
 * to that union would change the product's type surface for a research purpose -- §18's line. So
 * research carries its own list, and the two are related only by being read side by side here.
 */
export const RESEARCH_LANGUAGES = ["he", "en", "es"] as const;
export type ResearchLanguage = (typeof RESEARCH_LANGUAGES)[number];

/** §7.2. The two randomised decision budgets, derived per template from the discovery cohort. */
export const TIME_REGIMES = ["tight", "roomy"] as const;

/** §7.3. Assignment is drawn before the session and stored; it is not a property of the answer. */
export const PROBE_ASSIGNMENTS = ["probed", "not_probed"] as const;
export type ProbeAssignment = (typeof PROBE_ASSIGNMENTS)[number];

/**
 * What actually happened to a probe, which is a different fact from what was assigned.
 *
 * `blocked_timeout` is why this is not a boolean. A trial that timed out has no committed decision,
 * so "what mattered most to your decision" has no referent: the question is withheld by the
 * protocol rather than skipped by the participant. Recording that as `asked_unanswered` would put
 * a protocol decision into the participant's column.
 */
export const PROBE_DELIVERIES = [
  "answered",
  "asked_unanswered",
  "asked_skipped",
  "not_asked",
  "blocked_timeout",
  "capture_failed",
] as const;
export type ProbeDelivery = (typeof PROBE_DELIVERIES)[number];

export const RESPONSE_STATES = [
  "answered",
  "asked_unanswered",
  "not_asked",
  "capture_failed",
] as const;

/** A free-text response and the state of its measurement, which is never inferred from the text. */
const freeText = z.object({
  state: z.enum(RESPONSE_STATES),
  /**
   * THE SOURCE-LANGUAGE STRING, AND IT IS THE AUTHORITATIVE ONE. §6: machine translation may be
   * stored as a convenience copy and is not the coding source. There is no field here for a
   * translated version, and that absence is the enforcement: a convenience copy lives in the
   * coding workspace, never in the trial row, so nothing downstream can read it by mistake.
   */
  text: z.string().max(2000).nullable(),
  /** Instrument latency for this answer alone. NEVER added to `think_ms`. */
  latency_ms: z.number().int().min(0).nullable(),
});
export type FreeTextResponse = z.infer<typeof freeText>;

/** Why a trial cannot carry an H1/H2 verdict. §7.4 and §11 C6. */
export const CONTAMINATION_KINDS = [
  "reveal_before_probe",
  "reveal_before_commit",
  "probe_before_commit",
  "stimulus_version_drift",
  "clock_anomaly",
] as const;

export const resourceTrialSchema = z.object({
  trial_id: z.string().min(1).max(64),
  participant_id: z.string().min(1).max(64),
  /**
   * Position in the participant's own sequence, 0-based.
   *
   * REQUIRED BY H6 AND BY NOTHING ELSE, which is why it is a field rather than an array index.
   * "Did a probe at trial t change behaviour at t+1" cannot be asked of rows whose order was the
   * order they happened to be written in.
   */
  trial_index: z.number().int().min(0),
  template_id: z.string().regex(/^[A-Z]{2}-\d{2}$/),
  family: z.enum(STIMULUS_FAMILIES),

  topology_condition: z.enum(TOPOLOGY_ARMS),
  /** Whether this arm is the unedited base. The confound `base_arm` exists to make measurable. */
  is_base_arm: z.boolean(),
  language: z.enum(RESEARCH_LANGUAGES),
  time_regime: z.enum(TIME_REGIMES),
  /** The budget in force, in milliseconds. Derived from discovery; §7.2 caps it at 3s..45s. */
  budget_ms: z.number().int().min(3000).max(45000),

  probe_assignment: z.enum(PROBE_ASSIGNMENTS),
  probe_delivery: z.enum(PROBE_DELIVERIES),

  fen: z.string().min(8).max(120),
  /** The committed move in UCI, or null. Null is explained by `timed_out` or by a commit failure. */
  move: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/).nullable(),
  /**
   * Decision time, frozen AT COMMIT. Null when nothing was committed.
   *
   * NULL, NEVER ZERO, AND NEVER THE BUDGET. A timeout is not a 45,000 ms decision: nobody decided.
   * Writing the budget here would make the mean think time a function of how many people gave up.
   */
  think_ms: z.number().int().min(0).nullable(),
  timed_out: z.boolean(),
  /** Set when the client could not record a commit that happened. Distinct from a timeout. */
  commit_failed: z.boolean(),

  /** §7.3's three questions, in order. Each carries its own state. */
  resource_primary: freeText,
  resource_secondary: freeText,
  telos: freeText,

  /**
   * Which reveal-ordering regime this row ran under, in the repository's own vocabulary.
   *
   * A STRING FROM `shared/reveal-timing.ts` RATHER THAN A NEW ENUM, because the failure it guards
   * against is the same one: a row that cannot say whether the engine had spoken before the
   * question was answered is a row no later reader can interpret.
   */
  reveal_timing: z.string().min(1).max(40),
  contamination: z
    .object({
      kind: z.enum(CONTAMINATION_KINDS),
      detected_at_ms: z.number().int().min(0),
      detail: z.string().max(300),
    })
    .nullable(),

  // ---- provenance. §15, and `trace.ts` builds it. ----
  protocol_version: z.number().int().positive(),
  stimulus_version: z.number().int().positive(),
  git_sha: z.string().regex(/^[0-9a-f]{7,40}$/),
  detector_versions: z.record(z.string(), z.number().int().positive()),
  language_version: z.number().int().positive(),
  randomisation_seed: z.string().min(1).max(64),
  /** Rating at the moment of the session, not now. A rating read later is a different number. */
  rating_snapshot: z.number().int().min(0).max(4000).nullable(),
  cohort: z.enum(["discovery", "confirmatory"]),
});
export type ResourceTrial = z.infer<typeof resourceTrialSchema>;

/**
 * The cross-field rules a single row must satisfy.
 *
 * SEPARATE FROM THE SCHEMA AND RETURNING A LIST, rather than a `superRefine` that throws on the
 * first problem. A research row that violates three rules has told you three things, and an
 * importer that reports one of them makes the repair iterative for no reason.
 */
export function trialContradictions(trial: ResourceTrial): string[] {
  const out: string[] = [];
  if (trial.move === null && !trial.timed_out && !trial.commit_failed) {
    out.push("no move, and neither timed_out nor commit_failed explains it");
  }
  if (trial.move !== null && trial.timed_out) {
    out.push("a move was committed on a trial marked timed_out");
  }
  if (trial.think_ms === null && trial.move !== null) {
    out.push("a move was committed with no decision time; a commit is what freezes the clock");
  }
  if (trial.think_ms !== null && trial.move === null) {
    out.push("a decision time exists with no move to have frozen it");
  }
  if (trial.timed_out && trial.probe_delivery !== "blocked_timeout") {
    out.push(
      "a timed-out trial must record its probe as blocked_timeout: there was no decision to ask about",
    );
  }
  if (trial.probe_assignment === "not_probed" && trial.probe_delivery !== "not_asked") {
    out.push("an unassigned probe recorded a delivery other than not_asked");
  }
  for (const [name, response] of [
    ["resource_primary", trial.resource_primary],
    ["resource_secondary", trial.resource_secondary],
    ["telos", trial.telos],
  ] as const) {
    if (response.state === "answered" && (response.text === null || response.text.length === 0)) {
      out.push(`${name} is marked answered and carries no text`);
    }
    if (response.state !== "answered" && response.text !== null) {
      out.push(`${name} carries text while marked ${response.state}`);
    }
    if (trial.probe_assignment === "not_probed" && response.state !== "not_asked") {
      out.push(`${name} is ${response.state} on a trial the probe was not assigned to`);
    }
  }
  /*
   * §7.3's SECOND QUESTION IS OPTIONAL AND THAT IS NOT THE SAME AS UNASKED. "What mattered next, if
   * anything?" invites an empty answer, and a participant who says "nothing else" has answered.
   * The rule is only that it cannot be `answered` while the first question was never put.
   */
  if (
    trial.resource_secondary.state === "answered" &&
    trial.resource_primary.state === "not_asked"
  ) {
    out.push("the follow-up question was answered on a trial where the first was never asked");
  }
  return out;
}
