/**
 * THE DECISION ATOM (section 3.1).
 *
 *   entry_state -> known -> unknown -> decision -> bounded_action -> result -> feedback
 *
 * The same atom set, under the same field names, must appear in all three layers: the screen
 * state, the API event, and the session report. This module is the single definition all three
 * derive from, so drift is not expressible. GATE-ISO reflects over the three runtime artifacts
 * and compares them against ATOM_FIELDS.
 *
 * The atom is filled PROGRESSIVELY. At commit time `result` and `feedback` are null: the engine
 * has not spoken (R3) and the player has not revised anything yet. The FIELD is always present;
 * only its value is null. GATE-ISO checks presence, because a field that vanishes between layers
 * is how a product ends up unable to explain its own output six weeks later.
 */
import { z } from "zod";
import { CONFIDENCE_LEVELS } from "./confidence.js";
import { REVEAL_TIMINGS } from "./reveal-timing.js";

export const ATOM_FIELDS = [
  "entry_state",
  "known",
  "unknown",
  "decision",
  "bounded_action",
  "probe",
  "reveal_timing",
  "result",
  "feedback",
] as const;

export type AtomField = (typeof ATOM_FIELDS)[number];

export const PHASES = ["opening", "middlegame", "endgame"] as const;
export const ENGINE_SOURCES = ["local_sf18", "lichess_cloud"] as const;

/** entry_state -- the position the player was handed. FEN plus the constraints that framed it. */
export const entryStateSchema = z.object({
  game_id: z.string().min(1).max(64),
  fen: z.string().min(8).max(200),
  ply: z.number().int().min(0),
  phase: z.enum(PHASES),
  clock_ms_remaining: z.number().int().min(0).nullable(),
});

/**
 * bounded_action -- the act of committing, and the constraints it happened under.
 * seconds_taken is a predictor, not telemetry (section 4.1).
 */
export const boundedActionSchema = z.object({
  seconds_taken: z.number().min(0),
  confidence: z.number().int().min(1).max(CONFIDENCE_LEVELS),
  /*
   * WHICH SCALE THAT CONFIDENCE WAS STATED ON, and why a bare number is not enough.
   *
   * The scale moved from five levels to seven, and the words moved with it: "בטוח" was 4 of 5 and
   * is 6 of 7. A stored `4` therefore asserts 0.75 or 0.50 depending only on when it was written,
   * and nothing in the row itself says which. Recording the scale is what keeps a decision a
   * statement the player actually made rather than one this build inferred on their behalf.
   *
   * Optional because rows written before this field existed do not have it. Absent means five --
   * a fact about that row's age, resolved once where stored rows are read, never defaulted here.
   */
  confidence_scale: z.number().int().min(2).max(CONFIDENCE_LEVELS).optional(),
  candidate_moves_considered: z.array(z.string().min(4).max(6)).max(8),
});

/** result -- what came back from outside the player. Null until reveal. */
export const resultSchema = z.object({
  engine_eval_cp: z.number().int(),
  engine_best_move: z.string().min(4).max(6),
  engine_depth: z.number().int().min(1),
  engine_source: z.enum(ENGINE_SOURCES),
  cp_loss: z.number().int().min(0),
});

/**
 * The three arms of the counterfactual probe, and the third is not a synonym for the second.
 *
 * `ineligible` is a position that could never have carried the question -- fewer than two legal
 * moves. Folding those into `not-probed` would make the control group a mixture of "eligible and
 * not drawn" and "never askable", and any difference between arms would then be a difference
 * between kinds of position.
 */
export const PROBE_ASSIGNMENTS = ["probed", "not-probed", "ineligible"] as const;
export type ProbeAssignment = (typeof PROBE_ASSIGNMENTS)[number];

/**
 * probe -- which arm this decision was randomised into, and what came back if it was asked.
 *
 * PRESENT ON EVERY DECISION, INCLUDING THE ONES NOTHING WAS ASKED ON. A record that holds only
 * the probed decisions has no denominator: "do probed decisions differ from unprobed ones" would
 * become a comparison of probed decisions against the record's own average, which mixes every
 * other difference between the groups into the estimate.
 */
export const probeSchema = z.object({
  assignment: z.enum(PROBE_ASSIGNMENTS),
  /**
   * Legal moves in the entry position, carried as a covariate rather than used as a filter.
   *
   * A position with three legal moves is a thinner question than one with forty. Setting a floor
   * -- "ask only where there are at least eight" -- would have made the probed arm look cleaner
   * and would have been a threshold chosen to shape a result. Eligibility stays definitional and
   * the count is stored, so an analysis can condition on it instead.
   */
  legal_moves: z.number().int().min(0),
  /** The move the player named. Null both when unasked and when asked and unable -- see below. */
  alternative: z.string().min(4).max(6).nullable(),
  /**
   * Whether the question was actually put and answered.
   *
   * A FIELD RATHER THAN AN INFERENCE FROM `alternative`, and R2 is the reason. A player who was
   * asked and could not produce an alternative has told the instrument something real -- on the
   * four readings it is arguably the most interesting thing available. A player who was never
   * asked has told it nothing. Both are `alternative === null`, and a record storing only the
   * move can never tell them apart again.
   */
  answered: z.boolean(),
  /** What the alternative cost, measured at reveal. Null until the engine has scored it. */
  alternative_cp_loss: z.number().int().min(0).nullable(),
});

export type Probe = z.infer<typeof probeSchema>;

/** feedback -- what the player revised after seeing the result. Null until they revise. */
export const feedbackSchema = z.object({
  revised_read: z.string().max(200),
  would_choose_again: z.boolean(),
});

/**
 * The full atom. Field order here is the canonical order and is asserted by GATE-ISO.
 *
 * DEVIATION FROM SECTION 3.2, REPORTED: the column list in 3.2 has no `unknown` column, but
 * 3.1 makes `unknown` an atom and GATE-ISO's positive control drops it from the API event.
 * An atom required on screen and in the event that had nowhere to land in storage would be
 * dropped on write -- the exact failure 3.1 warns about. The decisions table therefore carries
 * a `stated_unknown` column.
 */
export const decisionAtomSchema = z.object({
  entry_state: entryStateSchema,
  /** What the player can name about this position. <=200 chars. */
  known: z.string().min(1).max(200),
  /** What the player says they cannot evaluate here. <=200 chars. Required, no default: an
   *  empty answer and an unanswered one must not look the same (R2). */
  unknown: z.string().min(1).max(200),
  /** The chosen move, UCI. */
  decision: z.string().min(4).max(6),
  bounded_action: boundedActionSchema,
  /**
   * NULLABLE, AND NULL IS A FOURTH STATE RATHER THAN A DEFAULT ARM. A decision written before the
   * probe existed was never randomised into anything, and assigning it to an arm on read would
   * enrol it retrospectively into a group it was never part of.
   */
  probe: probeSchema.nullable(),
  /**
   * Which reveal timing was in force -- see shared/reveal-timing.ts for why the two are not
   * poolable.
   *
   * NULLABLE, AND NULL IS NOT `per-decision`. Every decision written before the deferred game
   * existed was in fact made in the coached loop, because that was the only loop -- and writing
   * `per-decision` into those rows would still be wrong. It would assert that a condition was
   * recorded when nobody recorded one, and the first comparison between modes would show a
   * coached arm that is enormous and perfectly measured.
   */
  reveal_timing: z.enum(REVEAL_TIMINGS).nullable(),
  result: resultSchema.nullable(),
  feedback: feedbackSchema.nullable(),
});

export type DecisionAtom = z.infer<typeof decisionAtomSchema>;
export type EntryState = z.infer<typeof entryStateSchema>;
export type DecisionResult = z.infer<typeof resultSchema>;

/**
 * Runtime witness of the atom's field names, for GATE-ISO. TypeScript types are erased, so a
 * gate cannot reflect over them; this reads the zod shape, which survives to runtime.
 */
export function atomFieldNames(schema: { shape: Record<string, unknown> }): string[] {
  return Object.keys(schema.shape);
}
