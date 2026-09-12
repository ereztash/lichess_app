/**
 * WHAT A MATCHED TOPOLOGY PAIR IS, AS A RECORD RATHER THAN AS A SCREENSHOT.
 *
 * The preregistration freezes the stimulus design (§4) and then depends on it everywhere: H1 is a
 * comparison between the two arms of these pairs, C3 and C4 are adjustments for quantities recorded
 * here, and `STOP-R2-STIMULUS` fires on how many of these survive validation. A pair that existed
 * only as UI state, or only as two FEN strings in a spreadsheet, could not carry any of that.
 *
 * HAND-AUTHORED VERSUS DERIVED, AND WHY THE SPLIT IS LOAD-BEARING. Exactly seven fields are written
 * by a researcher: the identity, the family, the three positions, which arm is the unedited base,
 * the target relation and the target-affordance sets. Everything else -- invariants, the graph diff,
 * the engine block -- is COMPUTED by `scripts/build_tcrf_stimuli.ts` and RECOMPUTED by the gate,
 * which compares rather than trusts. This is the same rule `scripts/research-scan.ts` enforces on
 * every other frozen record in this repository: a claim an artefact makes about something outside
 * itself is checked against that thing, or it is not a claim.
 *
 * `base_arm` IS NOT COSMETIC AND IT IS NOT IN THE PREREGISTRATION. §4.4 generates candidate variants
 * from a base position without saying which arm the base is. If PRESENT were the unedited arm for
 * every template, "topology present" and "position nobody edited" would be the same variable, and
 * any H1 coefficient could be an artefact of edited positions looking slightly unnatural. Recording
 * it makes the confound measurable, and `validate-stimulus.ts` requires the primary set to be
 * balanced on it. This is an ambiguity in the frozen design resolved inside the envelope the frozen
 * design left open, not an amendment to it, and `docs/research/TCRF_CONSTRUCT_AUDIT.md` A-3 records
 * it as a finding.
 */
import { z } from "zod";
import { RELATION_TYPES, STIMULUS_FAMILIES, DETECTOR_VERSIONS } from "./relations.js";

/** Bumped when the meaning of any field here changes. Recorded on every trial. */
export const STIMULUS_SCHEMA_VERSION = 1;

/**
 * WHAT A TEMPLATE IS FOR, and it is two different things after Amendment 1.
 *
 * `AFFORDANCE_TEST` is the original design: the pair exists so that `target_affordance_selected`
 * has a positive case and H2 has an outcome. `IDENTIFIABILITY_TEST` is what the amendment adds: the
 * pair exists so that the relational account predicts an observation the object-local account does
 * not, and its primary outcome is what the participant NAMES, not which move they pick.
 *
 * THE TWO CARRY DIFFERENT ADMISSION RULES, which is why this is a field and not a comment. An
 * identifiability template with no affordance is fine and an affordance template with no
 * discriminating element is fine; the reverse of each is not. `validate-stimulus.ts` branches on it.
 */
export const STIMULUS_PURPOSES = ["AFFORDANCE_TEST", "IDENTIFIABILITY_TEST"] as const;
export type StimulusPurpose = (typeof STIMULUS_PURPOSES)[number];

export const TOPOLOGY_ARMS = ["present", "disrupted"] as const;
export type TopologyArm = (typeof TOPOLOGY_ARMS)[number];

const fen = z.string().min(8).max(120);
const uciMove = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
const canonicalRelation = z
  .string()
  .regex(new RegExp(`^[wb]:(?:${RELATION_TYPES.join("|")}):[a-h][1-8](?:>[a-h][1-8])*$`));

/**
 * Whether an engine actually spoke, kept as three states rather than as a nullable number.
 *
 * `NOT_MEASURED` is the state this repository keeps inventing and then needing: `scripts/run_gates.ts`
 * has it beside PASS and FAIL for the same reason. A pair whose engine block is absent has not been
 * shown to be value-matched; it has been shown nothing. Folding that into a null value, or worse
 * into a delta of zero, would let an unscored pair enter the primary set looking perfectly matched.
 */
export const ENGINE_MEASUREMENT_STATES = ["MEASURED", "NOT_MEASURED", "FAILED"] as const;

const engineReading = z.object({
  state: z.enum(ENGINE_MEASUREMENT_STATES),
  /** The engine's own `id name` from the UCI handshake, never a filename. See scripts/uci-engine.ts. */
  identity: z.string().min(1).max(120).nullable(),
  /** Every option that could change the answer, so a rerun is a rerun. */
  configuration: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  /** Winning chances for the side to move, 0..1. The unit shared/win-probability.ts makes invariant. */
  value_present: z.number().min(0).max(1).nullable(),
  value_disrupted: z.number().min(0).max(1).nullable(),
  /** |present - disrupted|, in winning chances. Compared against ACCURATE_WIN_PROBABILITY_LOSS. */
  value_delta: z.number().min(0).max(1).nullable(),
  best_move_present: uciMove.nullable(),
  best_move_disrupted: uciMove.nullable(),
  /**
   * A forced mate seen in one arm only is the discontinuity §4.2 forbids, and it is its own field
   * because a mate score has no honest win-probability: winProbability() saturates long before it.
   */
  mate_present: z.number().int().nullable(),
  mate_disrupted: z.number().int().nullable(),
  /**
   * The winning-chance gap between the best move and the second best, per arm.
   *
   * THIS IS THE MACHINE HALF OF §4.5's "no unrelated one-move tactic introduced by the edit". A
   * position with one move far ahead of every alternative is a position with a tactic in it, and an
   * edit that creates one in a single arm has changed the decision problem rather than the topology.
   * Two matched arms should be about equally forcing. The verdict stays with the two human
   * reviewers §4.5 names -- this quantity is what tells them which pairs to look at.
   */
  best_gap_present: z.number().min(0).max(1).nullable(),
  best_gap_disrupted: z.number().min(0).max(1).nullable(),
});
export type EngineReading = z.infer<typeof engineReading>;

/** The invariants §4.2 requires a pair to preserve, recorded per arm so the gate can compare them. */
const armInvariants = z.object({
  /** Piece letters sorted, e.g. "BNPPPRRkppr". Equality is the material-inventory test. */
  material: z.string().min(1),
  side_to_move: z.enum(["w", "b"]),
  phase: z.enum(["opening", "middlegame", "endgame"]),
  in_check: z.boolean(),
  castling: z.string(),
  legal_moves: z.number().int().min(0),
  /** Whether the pre-registered target affordance is reachable at all in this arm. */
  target_affordance_available: z.boolean(),
});
export type ArmInvariants = z.infer<typeof armInvariants>;

export const REVIEW_STATUSES = ["DRAFT", "REVIEWED_ADMISSIBLE", "REVIEWED_REJECTED"] as const;

export const stimulusPairSchema = z.object({
  // ---- hand-authored ----
  template_id: z.string().regex(/^[A-Z]{2}-\d{2}$/),
  family: z.enum(STIMULUS_FAMILIES),
  /** Defaulted so records written before Amendment 1 keep parsing as what they were. */
  purpose: z.enum(STIMULUS_PURPOSES).default("AFFORDANCE_TEST"),
  base_fen: fen,
  present_fen: fen,
  disrupted_fen: fen,
  base_arm: z.enum(TOPOLOGY_ARMS),
  /** The one relation the edit is meant to change. Must be present in one arm and absent in the other. */
  target_relation: canonicalRelation,
  /**
   * The moves that count as taking the target affordance, per arm, frozen before recruitment.
   *
   * PER ARM, NOT SHARED, because §4.5 asks reviewers for "the pre-registered target-affordance set
   * for each variant" and the disrupted arm's set is usually EMPTY -- that is what disrupting the
   * structure did. An empty set is a real value here and is distinguished from an unreviewed one by
   * `review_status`, not by emptiness.
   */
  target_affordance_present: z.array(uciMove),
  target_affordance_disrupted: z.array(uciMove),
  /**
   * The natural-language description a participant would see, if any. §4.5 requires reviewers to
   * confirm it does not reveal the manipulation, so it is stored with the pair rather than in the UI.
   */
  description_reveals_manipulation: z.boolean(),

  // ---- derived, written by the curator, recomputed by the gate ----
  invariants_present: armInvariants,
  invariants_disrupted: armInvariants,
  /** Canonical relation strings added and removed going from the present arm to the disrupted arm. */
  graph_diff: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
    size: z.number().int().min(0),
  }),
  /** The diff minus the target relation. §4.4 retains the variant that minimises this. */
  non_target_edit_count: z.number().int().min(0),
  /** How many pieces sit on different squares between the arms. A separate, cruder locality measure. */
  piece_relocations: z.number().int().min(0),
  engine_shipped: engineReading,
  engine_high_budget: engineReading,
  detector_versions: z.record(z.string(), z.number().int().positive()),

  // ---- provenance ----
  review_status: z.enum(REVIEW_STATUSES),
  review_notes: z.string(),
  reviewer_ids: z.array(z.string()),
  stimulus_version: z.number().int().positive(),
  /** The commit the derived fields were computed at. A derived field with no sha is not evidence. */
  derived_at_git_sha: z.string().regex(/^[0-9a-f]{7,40}$/).nullable(),
});
export type StimulusPair = z.infer<typeof stimulusPairSchema>;

/**
 * Which analysis set a pair belongs to. §4.3: only value-matched pairs may carry the H1 verdict.
 *
 * `EXPLORATORY_VALUE_SHIFT` exists so a pair that fails value matching has somewhere to go that is
 * not the bin. §4.3 says such pairs "may be retained in a separately labelled exploratory set and
 * can never carry the primary H1 verdict", and a label the code understands is the only version of
 * that sentence a script cannot forget.
 */
export const STIMULUS_SETS = [
  "PRIMARY_STRUCTURE_ONLY",
  "EXPLORATORY_VALUE_SHIFT",
  /**
   * Structurally admissible, not yet through §4.5's two independent chess reviewers.
   *
   * SEPARATE FROM `REJECTED` BECAUSE THE TWO ARE DIFFERENT FACTS AND THE SHORTFALL COUNT DEPENDS ON
   * WHICH. A pair that failed an invariant will never be primary; a pair waiting for a reviewer is
   * a scheduling state. Collapsing them would make `STOP-R2-STIMULUS` read as "the manipulation is
   * impossible" when it means "nobody has reviewed these yet".
   */
  "PENDING_REVIEW",
  "REJECTED",
] as const;
export type StimulusSet = (typeof STIMULUS_SETS)[number];

export const stimulusManifestSchema = z.object({
  manifest_version: z.number().int().positive(),
  schema_version: z.literal(STIMULUS_SCHEMA_VERSION),
  frozen: z.boolean(),
  /** Set when `frozen` is true. After this, membership may not change; §5 of the preregistration. */
  frozen_at_git_sha: z.string().regex(/^[0-9a-f]{7,40}$/).nullable(),
  detector_versions: z.record(z.string(), z.number().int().positive()),
  pairs: z.array(
    z.object({ set: z.enum(STIMULUS_SETS), pair: stimulusPairSchema }),
  ),
});
export type StimulusManifest = z.infer<typeof stimulusManifestSchema>;

/** The detector versions any manifest written now must record. */
export const currentDetectorVersions = (): Record<string, number> => ({ ...DETECTOR_VERSIONS });
