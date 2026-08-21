/**
 * Choosing positions for a drill.
 *
 * A drill is a FORWARD test. Re-showing positions the player has already decided and already
 * seen the engine's verdict on is not one -- they may simply recall the answer. So drill
 * positions are drawn from plies in the player's own games where NO decision was recorded.
 *
 * This is the weakest link in the loop and it is stated rather than hidden: the positions come
 * from games the player has played, so familiarity cannot be ruled out, only reduced. See
 * docs/MEASUREMENTS.md.
 */

export interface CandidatePosition {
  fen: string;
  ply: number;
}

/** Fewer than this and a drill is not worth running; its result would be noise. */
export const MIN_DRILL_POSITIONS = 5;
/** More than this and the player abandons it half-way, which is worse than not starting. */
export const MAX_DRILL_POSITIONS = 8;

export interface PositionSelection {
  fens: string[];
  /** Why a drill cannot be built, when it cannot. */
  reason: string | null;
}

/**
 * Pick positions the player has NOT recorded a decision on.
 *
 * Returns a reason rather than a short drill when there are too few: a drill of two positions
 * that reports a verdict is worse than no drill, because the verdict looks like evidence.
 */
export function selectDrillPositions(
  available: CandidatePosition[],
  alreadyDecidedFens: Iterable<string>,
): PositionSelection {
  const decided = new Set(alreadyDecidedFens);
  const seen = new Set<string>();
  const fresh: string[] = [];
  for (const position of available) {
    if (decided.has(position.fen) || seen.has(position.fen)) continue;
    seen.add(position.fen);
    fresh.push(position.fen);
  }
  if (fresh.length < MIN_DRILL_POSITIONS) {
    return {
      fens: [],
      reason:
        `נמצאו ${fresh.length} עמדות שעדיין לא הכרעת בהן, וצריך לפחות ${MIN_DRILL_POSITIONS}. ` +
        `דריל קצר מדי ייתן תוצאה שנראית כמו ראיה ואיננה. טענו עוד משחקים או רשמו עוד החלטות.`,
    };
  }
  return { fens: fresh.slice(0, MAX_DRILL_POSITIONS), reason: null };
}
