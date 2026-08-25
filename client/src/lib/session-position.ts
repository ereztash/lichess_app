/**
 * The game you were on, so the app stops asking you for it twice.
 *
 * Closing the tab lost the loaded game. The record survived -- decisions are written through
 * `RecordStore` -- and so did a usage timestamp, but the position in front of you did not, so
 * every return started at the opening position with five buttons offering to fetch one. That is
 * the app forgetting something it had, which is a different thing from the app not knowing.
 *
 * MEMORY, NOT PREDICTION, and the distinction is the whole licence for this file. Nothing here
 * infers, ranks or suggests: it writes down what was on screen and puts it back. The product's
 * standing refusal is of a recommendation engine, and a bookmark is not one.
 *
 * WHAT IS STORED IS THE MOVES, not the snapshots. `GameSnapshot` carries a FEN per ply and would
 * be four times the size, and it would be a second source of truth for a position that `chess.js`
 * derives from the moves anyway -- so a stored snapshot that disagreed with its own move list
 * would be unresolvable. SAN replays through `buildHistory` exactly as a pasted PGN does.
 *
 * NOT THE DRAFT DECISION. A half-answered commitment is not restored, and that is deliberate:
 * the seconds-taken clock starts when a position is presented, so a draft resumed an hour later
 * would carry an hour of "thinking time" into the record. R2 -- the record must not hold a number
 * nothing measured.
 */
import { ANALYSIS_SOURCES, type AnalysisSource } from "@shared/analysis-source";
import type { OpponentDepth } from "@/lib/opponent";

const KEY = "decision-lab.position.v1";

export interface StoredPosition {
  /** The moves, in SAN, in order. A bare SAN movetext is valid input to `buildHistory`. */
  sans: string[];
  /** Which half-move the board was showing. -1 is the position before anyone has moved. */
  ply: number;
  /*
   * The shared union, not a copy of it. `shared/analysis-source.ts` exists because this value
   * had three divergent local definitions and the fair-play guard keys off it; a fourth, narrowed
   * to the three cases this file happened to think of, would be the same bug again.
   */
  source: AnalysisSource;
  /** Which way the board was facing. */
  orientation: "w" | "b";
  /** The opponent's configuration for a live game, or null for a loaded one. */
  opponent: { playerColor: "w" | "b"; depth: OpponentDepth } | null;
  /** The id decisions in this game were recorded against, so a resumed game stays one game. */
  gameId: string;
  savedAt: string;
}

/** Narrow an unknown blob from storage. A stored shape that changed is not a position. */
function parse(raw: string): StoredPosition | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<StoredPosition>;
  if (!Array.isArray(v.sans) || v.sans.some((s) => typeof s !== "string")) return null;
  if (typeof v.ply !== "number" || !Number.isInteger(v.ply)) return null;
  const source = ANALYSIS_SOURCES.find((known) => known === v.source);
  if (!source) return null;
  if (v.orientation !== "w" && v.orientation !== "b") return null;
  if (typeof v.gameId !== "string" || v.gameId.length === 0) return null;
  if (typeof v.savedAt !== "string") return null;
  const opponent = v.opponent;
  if (opponent !== null && opponent !== undefined) {
    if (typeof opponent !== "object") return null;
    if (opponent.playerColor !== "w" && opponent.playerColor !== "b") return null;
    if (typeof opponent.depth !== "number") return null;
  }
  return {
    sans: v.sans,
    ply: v.ply,
    source,
    orientation: v.orientation,
    opponent: opponent ?? null,
    gameId: v.gameId,
    savedAt: v.savedAt,
  };
}

/**
 * The position from the last visit, or null.
 *
 * Null covers every reason equally -- nothing stored, a shape this build does not understand,
 * storage refused -- because a caller has one thing to do about all of them: start fresh.
 */
export function readPosition(): StoredPosition | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : parse(raw);
  } catch {
    // A private window and blocked site data both throw here. Not worth an error path.
    return null;
  }
}

/**
 * Remember the position. Swallows a failed write for the same reason `LocalRecordStore` does: a
 * full quota must not turn a game into an error screen, and what is lost is a convenience.
 */
export function writePosition(position: Omit<StoredPosition, "savedAt">, now = new Date()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...position, savedAt: now.toISOString() }));
  } catch {
    /* The game is on screen either way; only the return trip is lost. */
  }
}

/** Forget it. Used when a game is abandoned deliberately, so the next visit is not haunted. */
export function clearPosition(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Nothing to do: the entry either goes or it does not. */
  }
}
