/**
 * Evaluating a whole game with the local engine.
 *
 * This is the piece neither repository had. chess-mind-patterns could only read evaluations that
 * Lichess had already written into the PGN as `[%eval …]` comments, so a game Lichess never
 * analysed produced `hasEvals: false` and half its dashboard went dark. lichess_app has a real
 * Stockfish and no way to point it at more than one position.
 *
 * The output is the exact shape `shared/eval-analysis.ts` already consumes: centipawns from
 * WHITE's perspective, one entry per position starting with the initial one, mate as ±10000.
 */
import { Chess } from "chess.js";
import type { EngineLine } from "@/lib/engine-line";

/** What `%eval #3` means in the ported analysis: a forced mate, clamped far outside any cp range. */
export const MATE_SCORE = 10000;

export type BatchProgress = { done: number; total: number };

export type BatchOptions = {
  /** Depth per position. Lower than the single-position default: this runs dozens of times. */
  depth?: number;
  onProgress?: (progress: BatchProgress) => void;
  /** Aborting leaves the positions already evaluated intact; the caller gets a short array. */
  signal?: AbortSignal;
};

/**
 * Every position in the game, in order: the starting position, then the position after each
 * half-move. That indexing is what `evalScores[ply]` means -- ply 0 is before anyone has moved.
 */
export function gamePositions(pgn: string): string[] {
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const replay = new Chess();
  const fens = [replay.fen()];
  for (const move of history) {
    replay.move(move.san);
    fens.push(replay.fen());
  }
  return fens;
}

/**
 * Convert one engine line into a White-perspective centipawn score.
 *
 * THE detail that matters here: UCI reports `score cp` from the perspective of the side to move,
 * so the same position evaluated after White's move and after Black's move carries opposite
 * signs for the same advantage. `evalScores` is White-relative throughout, and CPL is computed
 * as a signed difference between consecutive entries -- so getting this backwards does not
 * produce slightly wrong numbers, it inverts every blunder and every best move.
 *
 * The FEN is the source of truth for whose turn it is, not the caller.
 */
export function toWhitePerspective(line: EngineLine, fen: string): number {
  const blackToMove = fen.split(" ")[1] === "b";
  const raw = typeof line.mate === "number" ? Math.sign(line.mate) * MATE_SCORE : line.scoreCp;
  return blackToMove ? -raw : raw;
}

/**
 * Evaluate each position with the engine.
 *
 * `analyze` is injected rather than imported: stockfish.ts pulls in 7MB of wasm at module scope,
 * and importing it here would put the engine back into the initial module graph -- the exact R3
 * regression GATE-COMMIT exists to catch. It also lets this be tested without a wasm host.
 */
export async function analyzePositions(
  fens: string[],
  analyze: (fen: string, depth: number) => Promise<EngineLine>,
  options: BatchOptions = {},
): Promise<number[]> {
  const depth = options.depth ?? 12;
  const scores: number[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (options.signal?.aborted) break;
    const line = await analyze(fens[i], depth);
    scores.push(toWhitePerspective(line, fens[i]));
    options.onProgress?.({ done: i + 1, total: fens.length });
  }
  return scores;
}

/** Convenience: a PGN straight to the array eval-analysis consumes. */
export async function analyzeGame(
  pgn: string,
  analyze: (fen: string, depth: number) => Promise<EngineLine>,
  options: BatchOptions = {},
): Promise<number[]> {
  return analyzePositions(gamePositions(pgn), analyze, options);
}
