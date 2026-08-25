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

export const ATOM_FIELDS = [
  "entry_state",
  "known",
  "unknown",
  "decision",
  "bounded_action",
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
