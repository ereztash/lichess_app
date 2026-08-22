/**
 * The opponent.
 *
 * Until this module existed there was no game to play. "משחק חדש" produced a starting position
 * and then asked the player to decide for BOTH sides, one full commit-and-reveal cycle per
 * half-move. Verified in a browser against the deployed build: white's committed move was
 * played, the turn passed to black, and twelve seconds later nothing had replied. The board had
 * no one on the other side of it.
 *
 * THIS MODULE RETURNS A MOVE, NEVER A LINE. Choosing a move means searching the position, and
 * that search also contains the engine's opinion of the reply the player is about to be asked
 * for. Putting its score or its principal variation on screen would be the machine speaking
 * before the decision -- R3, precisely. Throwing everything but the move away HERE, at the
 * boundary, makes that leak impossible downstream instead of leaving it to downstream
 * discipline. A caller cannot render an evaluation it was never handed.
 */
import { Chess } from "chess.js";

/**
 * Search depth, offered as a search depth.
 *
 * It is not a rating and this codebase does not claim one: no measurement here supports mapping
 * a depth onto an Elo, and R1 says a claim may not be wider than its measurement. Depth 1 is
 * offered because an opponent that always wins is not a game a player can learn in.
 */
export const OPPONENT_DEPTHS = [1, 4, 8] as const;
export type OpponentDepth = (typeof OPPONENT_DEPTHS)[number];
export const DEFAULT_OPPONENT_DEPTH: OpponentDepth = 4;

/** Each refusal names its own cause. "The opponent did not move" would erase all four. */
export type OpponentFailure = "game-over" | "no-move" | "illegal" | "engine-failed";

export type OpponentMove =
  | { ok: true; from: string; to: string; promotion?: string }
  | { ok: false; reason: OpponentFailure };

/** What the engine is asked for. Deliberately narrower than EngineLine -- see the module note. */
export type SearchForMove = (fen: string, depth: number) => Promise<{ bestMove?: string }>;

export async function chooseOpponentMove(
  fen: string,
  search: SearchForMove,
  depth: number = DEFAULT_OPPONENT_DEPTH,
): Promise<OpponentMove> {
  const position = new Chess(fen);
  if (position.isGameOver()) return { ok: false, reason: "game-over" };

  let best: string | undefined;
  try {
    best = (await search(fen, depth)).bestMove;
  } catch {
    return { ok: false, reason: "engine-failed" };
  }
  if (!best || best.length < 4) return { ok: false, reason: "no-move" };

  const from = best.slice(0, 2);
  const to = best.slice(2, 4);
  const promotion = best.length > 4 ? best[4] : undefined;
  try {
    // Played against a private copy: a move the engine returns for a position it was not asked
    // about, or that is simply not legal, must never reach the board as if it were a move.
    position.move({ from, to, promotion: promotion ?? "q" });
  } catch {
    return { ok: false, reason: "illegal" };
  }
  return promotion ? { ok: true, from, to, promotion } : { ok: true, from, to };
}

/** Said to the player. Each cause reads differently because each cause IS different. */
export const OPPONENT_FAILURE_TEXT: Record<OpponentFailure, string> = {
  "game-over": "המשחק נגמר. אין ליריב מהלך לשחק.",
  "no-move": "המנוע לא החזיר מהלך לעמדה הזו. היריב לא שיחק.",
  illegal: "המנוע החזיר מהלך שאינו חוקי בעמדה הזו, ולכן הוא לא שוחק. זו תקלה, לא מהלך.",
  "engine-failed": "המנוע נכשל, ולכן היריב לא שיחק. אפשר לשחק את שני הצדדים בינתיים.",
};
