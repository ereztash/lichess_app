/**
 * Serving the anchor set -- the positions every player answers, in the same order.
 *
 * WHY AN ORDER AND NOT A CHOICE. A player who could pick which bank position to attempt, or
 * reshuffle until an easy one came up, would be choosing their own result -- the same defect as
 * the app choosing it for them, and the reason the first-decision picker is deterministic. The
 * set is answered in the bank's own order, and the next one is simply the first not yet answered.
 *
 * WHY THE MOVES ARE LOADED LAZILY. `isAnchorFen` is reached from code every arrival loads; the
 * move lists are 13kB and are needed only at the moment a position is actually served. Measured:
 * carrying them in the shared module took the entry bundle from 592kB to 607kB, paid by everyone
 * including the overwhelmingly common visit that serves no position at all.
 */
import { ANCHOR_POSITIONS } from "@shared/anchor-set";

export interface AnchorRun {
  /** The bank position to serve, with the game that produced it. */
  id: string;
  ply: number;
  sans: readonly string[];
  /** How many of the set this player has answered, and how many there are. */
  done: number;
  total: number;
}

/**
 * The next bank position this record has not answered, or null when the set is complete.
 *
 * Null is a real answer and the caller must render it: a player who has answered all sixty has a
 * comparable reading and nothing left to add to it, which is a different state from having none.
 */
export async function nextAnchor(answered: readonly string[]): Promise<AnchorRun | null> {
  const done = new Set(answered);
  const position = ANCHOR_POSITIONS.find((candidate) => !done.has(candidate.id));
  if (!position) return null;
  /*
   * Imported here rather than at the top of the file, which is the whole reason the bank is
   * generated as two files. A static import would put the movetext back in the entry bundle and
   * undo the split.
   */
  const { ANCHOR_MOVES } = await import("@shared/anchor-moves");
  const moves = ANCHOR_MOVES.find((entry) => entry.id === position.id);
  if (!moves) return null;
  return {
    id: position.id,
    ply: moves.ply,
    sans: moves.sans,
    done: done.size,
    total: ANCHOR_POSITIONS.length,
  };
}
