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
 *
 * "ALREADY DECIDED" IS A QUESTION ABOUT A BOARD, AND THIS COMPARED WHOLE FENs. A FEN's last two
 * fields are the halfmove clock and the fullmove number -- a record of the GAME, not of the
 * position (shared/position-key.ts). Two knights out and back reach the identical board with
 * different counters, so a string comparison called it a new position.
 *
 * Every path around this one already knew that. The transfer path keys by board when it chooses
 * boards and again when it reports one; `finishDrill` matches each decision to its registered
 * slot by board. The single place in the drill path that decides whether a position is FRESH was
 * the one place still comparing game history, which cost two things at once: a board the player
 * had already been given the answer for entered the forward test, and one board could occupy two
 * slots of the same drill -- inflating `n` and letting the verdict's standard error treat one
 * board as two independent observations.
 */
import { positionKey } from "./position-key.js";

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
  /**
   * What the caller narrowed `available` to, in the player's words, for the message below.
   *
   * "Too few positions" and "too few positions OF THIS KIND" are different facts and the player
   * can act on them differently -- load another game, or accept that this claim cannot be tested
   * from the games they have. Reporting the first when the second is true is the sentence-sharing
   * this codebase keeps splitting apart.
   */
  scopeLabel?: string,
): PositionSelection {
  const decided = new Set([...alreadyDecidedFens].map(positionKey));
  const seen = new Set<string>();
  const fresh: string[] = [];
  for (const position of available) {
    // Keyed by board on BOTH sides: against the record, so a position already answered cannot
    // come back, and against this drill's own selection, so one board cannot fill two slots.
    const key = positionKey(position.fen);
    if (decided.has(key) || seen.has(key)) continue;
    seen.add(key);
    fresh.push(position.fen);
  }
  if (fresh.length < MIN_DRILL_POSITIONS) {
    const kind = scopeLabel ? `עמדות מ${scopeLabel} ` : "עמדות ";
    return {
      fens: [],
      reason:
        `נמצאו ${fresh.length} ${kind}שעדיין לא הכרעת בהן, וצריך לפחות ${MIN_DRILL_POSITIONS}. ` +
        `דריל קצר מדי ייתן תוצאה שנראית כמו ראיה ואיננה. טענו עוד משחקים או רשמו עוד החלטות.`,
    };
  }
  return { fens: fresh.slice(0, MAX_DRILL_POSITIONS), reason: null };
}
