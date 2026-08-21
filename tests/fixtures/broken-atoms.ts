/**
 * Deliberately-broken fixtures for gate positive controls.
 *
 * Excluded from tsconfig on purpose. Nothing here is ever imported by product code; the gate
 * runner reads it only in --positive-controls mode. A gate that has never failed has not been
 * shown to be a gate.
 */
import { ATOM_FIELDS } from "../../shared/decision-atom";

/** GATE-ISO control: an API event that drops `unknown`. */
export const EVENT_MISSING_UNKNOWN = ATOM_FIELDS.filter((field) => field !== "unknown");

/** GATE-COMMIT control: a reveal payload served without a committed decision. */
export const PRE_COMMIT_LEAK = {
  decision_id: "00000000-0000-4000-8000-000000000000",
  result: { engine_eval_cp: 42, engine_best_move: "d2d4", engine_depth: 14 },
};
