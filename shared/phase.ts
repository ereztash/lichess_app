/**
 * Game-phase classification.
 *
 * This is a HEURISTIC, not a fact about the position, and it is documented as one in
 * docs/MEASUREMENTS.md because claims get scoped by phase. A crude rule here would manufacture
 * structure downstream, so the rule is fixed, stated, and derived only from material and ply.
 *
 * Rule, applied in order:
 *   1. endgame     -- non-pawn, non-king material (both sides) <= 13 points
 *   2. opening     -- ply <= 20 (i.e. within the first ten full moves)
 *   3. middlegame  -- everything else
 */
import { Chess } from "chess.js";
import type { PHASES } from "./decision-atom";

export type Phase = (typeof PHASES)[number];

const PIECE_VALUE: Record<string, number> = { p: 0, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const ENDGAME_MATERIAL_THRESHOLD = 13;
export const OPENING_MAX_PLY = 20;

export function nonPawnMaterial(fen: string): number {
  return new Chess(fen)
    .board()
    .flat()
    .reduce((total, square) => (square ? total + PIECE_VALUE[square.type] : total), 0);
}

export function classifyPhase(fen: string, ply: number): Phase {
  if (nonPawnMaterial(fen) <= ENDGAME_MATERIAL_THRESHOLD) return "endgame";
  if (ply <= OPENING_MAX_PLY) return "opening";
  return "middlegame";
}
