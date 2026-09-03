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

/**
 * One move the engine considered, with the engine's opinion of it. The opinion is consumed HERE
 * and discarded; it exists so the choice among near-equals can be made, and for nothing else.
 */
export interface OpponentCandidate {
  move: string;
  /** Centipawns from the side to move, which is the opponent. Absent means unscored. */
  scoreCp?: number;
  /** A forced mate in this many moves; positive is the opponent's mate. */
  mate?: number;
}

/**
 * What the engine is asked for. Deliberately narrower than EngineLine -- see the module note.
 *
 * `candidates` is the MultiPV set, best first, when the caller has one. Without it the opponent
 * plays `bestMove`, which is what it did until every blitz game answered 1.e4 with the same reply.
 */
export type SearchForMove = (
  fen: string,
  depth: number,
) => Promise<{ bestMove?: string; candidates?: readonly OpponentCandidate[] }>;

/**
 * THE OPPONENT VARIES, WITHIN A STATED BAND, AND THE BAND IS ON THE RECORD.
 *
 * Owner-observed on the deployed build: every blitz game answered 1.e4 with 1...d5. Stockfish is
 * deterministic for a fixed position, depth and hash state, so a player who opened the same way
 * met the same game every time -- a rehearsal of one line, not an opponent. The fix is not
 * randomness for its own sake: the opponent chooses uniformly among the moves the engine itself
 * rates within `withinCp` of its best at this depth, from a MultiPV search of `lines` lines.
 *
 * Recorded in the game's opponent provenance as `OPPONENT_KIND`, so games played against the
 * varied opponent and games played against the single-line one are two populations and never
 * pooled (shared/blitz-strata.ts keys on the kind). The numbers are in the kind because a policy
 * with different numbers is a different opponent.
 */
export const OPPONENT_VARIETY = { lines: 3, withinCp: 30 } as const;
export const OPPONENT_KIND = `engine-varied-${OPPONENT_VARIETY.lines}x${OPPONENT_VARIETY.withinCp}cp`;

/**
 * Which of the engine's candidates to play. Pure, so the choice can be tested exhaustively.
 *
 * - No candidates, or none scored: the engine's `bestMove`.
 * - The best is a forced mate for the opponent: the best, always. Variety is for equals; a mate
 *   and a near-mate are not equals.
 * - Otherwise: uniformly among scored candidates within `withinCp` of the best, mates excluded on
 *   both sides (a candidate that gets the opponent mated is not "within 30cp" of anything).
 */
export function pickAmongCandidates(
  bestMove: string | undefined,
  candidates: readonly OpponentCandidate[] | undefined,
  random: () => number,
  withinCp: number = OPPONENT_VARIETY.withinCp,
): string | undefined {
  if (!candidates?.length) return bestMove;
  const best = candidates[0];
  if (best.mate !== undefined && best.mate > 0) return best.move;
  if (best.scoreCp === undefined) return bestMove ?? best.move;
  const near = candidates.filter(
    (c) => c.mate === undefined && c.scoreCp !== undefined && best.scoreCp! - c.scoreCp <= withinCp,
  );
  if (!near.length) return best.move;
  const index = Math.min(near.length - 1, Math.floor(random() * near.length));
  return near[index].move;
}

export async function chooseOpponentMove(
  fen: string,
  search: SearchForMove,
  depth: number = DEFAULT_OPPONENT_DEPTH,
  random: () => number = Math.random,
): Promise<OpponentMove> {
  const position = new Chess(fen);
  if (position.isGameOver()) return { ok: false, reason: "game-over" };

  let best: string | undefined;
  try {
    const answer = await search(fen, depth);
    best = pickAmongCandidates(answer.bestMove, answer.candidates, random);
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

/**
 * From a MultiPV result to what `chooseOpponentMove` wants. Both pages hand the engine's
 * `analyzeAlternatives` through this, so the depth and the line count are stated in one place and
 * the score never leaves this module in any other shape.
 */
export function searchWithVariety(
  analyzeAlternatives: (
    fen: string,
    depth: number,
    count: number,
  ) => Promise<readonly { bestMove?: string; pv: string[]; scoreCp: number; mate?: number }[]>,
): SearchForMove {
  return async (fen, depth) => {
    const lines = await analyzeAlternatives(fen, depth, OPPONENT_VARIETY.lines);
    const candidates: OpponentCandidate[] = [];
    for (const line of lines) {
      const move = line.bestMove ?? line.pv[0];
      if (move) candidates.push({ move, scoreCp: line.scoreCp, mate: line.mate });
    }
    return { bestMove: lines[0]?.bestMove ?? lines[0]?.pv[0], candidates };
  };
}
