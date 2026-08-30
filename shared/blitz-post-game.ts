/**
 * THE ENGINE RUNS AFTER THE GAME, OR IT DOES NOT RUN.
 *
 * INV-4, enforced by construction rather than by discipline: this is the only module that may hand
 * a blitz position to an evaluator, and it REFUSES a game that has not finished. A caller who wires
 * an engine into the move loop cannot route it through here, and a caller who tries to analyse
 * mid-game gets a refusal rather than a number.
 *
 * WHY THAT IS NOT PARANOIA. The product has never had a mode where the engine stayed quiet during
 * play. `Home.tsx` says so about its own deferred game, in its own words: "THE ENGINE RUNS IN BOTH
 * MODES; ONLY THE TELLING DIFFERS." The reasoning there is sound for an untimed loop -- a deferred
 * game storing no evaluations would be forty decisions nothing ever scored -- and it is exactly
 * what a timed game cannot afford. An engine competing for the machine while somebody's clock is
 * running does not merely risk a slow frame; it puts the measurement and the thing being measured
 * on the same processor.
 *
 * SO THE ORDER IS: play the whole game, then read the positions off the record, then score them.
 * The record is complete before the first evaluation exists, which is what makes the think times
 * unarguable -- nothing that happened during the game could have been waiting on an engine, because
 * there was no engine to wait on.
 */
import { Chess } from "chess.js";
import type { BlitzDecision, BlitzState } from "./blitz-game-core.js";

/** A game that has ended. The only input this module accepts. */
export type FinishedGame = Extract<BlitzState, { phase: "finished" }>;

export function isFinished(state: BlitzState): state is FinishedGame {
  return state.phase === "finished";
}

/**
 * Why an analysis did not happen. A refusal names itself rather than returning an empty list, which
 * a caller could mistake for "the game had no decisions".
 */
export type AnalysisRefusal = { refused: "game-not-finished" | "no-decisions" };

export interface AnalysedDecision extends BlitzDecision {
  /**
   * Centipawns lost against the engine's line, from the mover's side. Never negative, and null when
   * the evaluator could not answer for one of the two positions.
   */
  cpLoss: number | null;
  /** The engine's verdict on the position the player FACED, from the player's side. */
  standingCp: number | null;
}

/**
 * Every position the analysis needs, in order: the position before each decision, and the one after
 * the last.
 *
 * SEPARATE FROM THE SCORING so a caller can see the size of the job before starting it -- a
 * forty-move game is eighty-one searches, and an interface that discovers that halfway through has
 * no way to show progress or to stop.
 */
export function positionsToScore(game: FinishedGame): string[] {
  if (game.decisions.length === 0) return [];
  const fens = game.decisions.map((d) => d.fenBefore);
  return [...fens, game.fen];
}

/** Evaluations are white-relative, as everywhere else in this repository. */
type Evaluate = (fen: string) => Promise<number | null>;

/**
 * Score a finished game.
 *
 * THE GUARD IS THE FIRST LINE AND IT IS THE POINT. Everything below it is ordinary arithmetic; the
 * refusal above it is the invariant.
 */
export async function analyseFinishedGame(
  game: BlitzState,
  evaluate: Evaluate,
): Promise<AnalysedDecision[] | AnalysisRefusal> {
  if (!isFinished(game)) return { refused: "game-not-finished" };
  if (game.decisions.length === 0) return { refused: "no-decisions" };

  const fens = positionsToScore(game);
  const scores: (number | null)[] = [];
  for (const fen of fens) scores.push(await evaluate(fen));

  return game.decisions.map((decision, index) => {
    const before = scores[index];
    const after = scores[index + 1];
    if (before === null || before === undefined || after === null || after === undefined) {
      return { ...decision, cpLoss: null, standingCp: null };
    }
    /*
     * White wants the number to go up and Black wants it down, so the sign flips with the mover --
     * the same convention as shared/eval-analysis.ts and shared/import-diagnostic.ts. Clamped at
     * zero: a move that IMPROVES on the engine's line has lost nothing, and a negative loss would
     * pull an average down as if it were an unusually good decision rather than a rounding of the
     * search.
     */
    const raw = decision.side === "w" ? before - after : after - before;
    return {
      ...decision,
      cpLoss: Math.max(0, raw),
      /* The standing the player faced, from THEIR side, so "winning" means winning for them. */
      standingCp: decision.side === "w" ? before : -before,
    };
  });
}

/**
 * The moves of a finished game in SAN, which is what a PGN wants.
 *
 * Recomputed from the recorded moves rather than accumulated during play: the core's job is the
 * clock and the position, and a game that also had to maintain a movetext would have a second
 * representation of the same fact that could drift from the first.
 */
export function movetext(game: FinishedGame): string {
  const board = new Chess();
  for (const decision of game.decisions) board.move(decision.san);
  return board.pgn();
}
