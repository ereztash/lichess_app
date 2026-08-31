/**
 * THE ANALYSIS OUTLIVES THE SCREEN THAT STARTED IT (LAW 4).
 *
 * WHAT R-02 FIXED AND WHAT IT LEFT. The game is written before the engine runs, so a tab closed
 * during analysis no longer loses the moves, the clocks or the think times. What stayed tied to the
 * screen is the analysis itself: `Blitz.tsx` ran it in a `useEffect` with a `cancelled` flag, so
 * navigating away inside the app cancelled the search and left the game `pending` — and `PostGame`
 * was simultaneously offering "play another game", which is the navigation that cancels it.
 *
 * A pending game is not lost. It is permanently half-recorded, which LAW 4 names as the same
 * failure with a different shape: the player did something in the world, and the product left it in
 * a state nothing will ever finish.
 *
 * SO THE WORK IS DEFINED OVER THE STORED RECORD, NOT OVER COMPONENT STATE. That is the whole design
 * decision, and everything else follows from it: a queue that reads `analysisState === "pending"`
 * can be resumed by a later page load, a second tab, or a screen that never saw the game played.
 * A queue built over `BlitzState` could only ever be resumed by the component holding it.
 *
 * TWO POSITIONS PER DECISION, WHICH IS NOT A SECOND DEFINITION OF CP-LOSS. `analyseFinishedGame`
 * evaluates every position in the game once and reads decision `i`'s "after" off decision `i+1`'s
 * `fenBefore` — correct, and only available while the whole game including the opponent's moves is
 * in memory. The stored record holds the PLAYER's rows only, so the position after their move is
 * reconstructed by applying their own `san` to their own `fenBefore`. Those are the same position,
 * and `tests/shared/an-analysis-that-outlives-its-screen.test.ts` proves the two paths agree on the
 * same game rather than asserting that they should.
 *
 * INV-4 IS STRONGER HERE, NOT WEAKER. `analyseFinishedGame` guards it with `isFinished`, which is a
 * check. This module cannot violate it by construction: a stored record exists only after the game
 * ended, and `analysisState: "pending"` exists only on a stored record.
 */
import { Chess } from "chess.js";
import type { AnalysedDecision, AnalysisRefusal } from "./blitz-post-game.js";
import type { Side } from "./blitz-game-core.js";
import type { StoredBlitzDecision, StoredBlitzGame } from "./blitz-record.js";

/**
 * One decision's two positions, ready to hand to an evaluator.
 *
 * `after` IS DERIVED AND CARRIED, rather than derived at scoring time. The derivation can fail — a
 * stored `san` that is not legal in its own `fenBefore` is a corrupt row — and a failure discovered
 * halfway through a search would leave the engine having done work for a game that cannot be
 * scored. Doing it up front means `pendingAnalyses` either produces a complete unit of work or
 * reports the game as unscoreable before a single evaluation runs.
 */
export interface AnalysisPosition {
  ply: number;
  side: Side;
  san: string;
  before: string;
  after: string;
}

/** One game the engine has not scored, with everything needed to score it. */
export interface PendingAnalysis {
  gameId: string;
  positions: AnalysisPosition[];
}

/**
 * Why a stored game cannot be scored at all. Distinct from `AnalysisRefusal`, which is about a
 * game the engine declined; these are about a record that cannot produce the work.
 */
export type UnscoreableGame =
  | { gameId: string; unscoreable: "no-decisions" }
  | { gameId: string; unscoreable: "illegal-move"; ply: number; san: string };

export interface PendingWork {
  ready: PendingAnalysis[];
  /**
   * Games that are pending and can never be scored. Returned rather than skipped: a queue that
   * silently dropped them would rescan them forever, and the count of games waiting would never
   * fall for a reason nobody could name.
   */
  unscoreable: UnscoreableGame[];
}

/**
 * WHAT IS WAITING FOR THE ENGINE.
 *
 * `pending` ONLY, AND NEVER `legacy-unknown`. A row written before the analysis state existed was
 * analysed — nothing recorded it, which is why it is not `complete` — and scoring it now would
 * write today's engine build onto a verdict produced by another one. `blitz-strata.ts` exists to
 * stop exactly that pooling; a queue that "helpfully" backfilled would defeat it at the source.
 *
 * `refused` IS ALSO LEFT ALONE. The engine ran and the join declined the game. Running it again
 * produces the same refusal, and a queue that retried it would be an infinite loop wearing the
 * costume of resilience.
 */
export function pendingAnalyses(
  games: readonly StoredBlitzGame[],
  decisions: readonly StoredBlitzDecision[],
): PendingWork {
  const ready: PendingAnalysis[] = [];
  const unscoreable: UnscoreableGame[] = [];

  for (const game of games) {
    if (game.analysisState !== "pending") continue;
    const mine = decisions
      .filter((d) => d.gameId === game.gameId)
      .sort((a, b) => a.ply - b.ply);
    if (mine.length === 0) {
      unscoreable.push({ gameId: game.gameId, unscoreable: "no-decisions" });
      continue;
    }

    const positions: AnalysisPosition[] = [];
    let broken: UnscoreableGame | null = null;
    for (const decision of mine) {
      const after = positionAfter(decision.fenBefore, decision.san);
      if (after === null) {
        broken = { gameId: game.gameId, unscoreable: "illegal-move", ply: decision.ply, san: decision.san };
        break;
      }
      positions.push({
        ply: decision.ply,
        side: decision.side,
        san: decision.san,
        before: decision.fenBefore,
        after,
      });
    }
    if (broken) unscoreable.push(broken);
    else ready.push({ gameId: game.gameId, positions });
  }

  return { ready, unscoreable };
}

/**
 * The position a move leads to, or null when the move is not legal there.
 *
 * NULL RATHER THAN A THROW, because the caller is a scan over a whole record and one corrupt row
 * must not stop the other games from being scored. `chess.js` throws on an illegal move, so the
 * throw is caught here and turned into the absence the scan can act on.
 */
function positionAfter(fen: string, san: string): string | null {
  try {
    const board = new Chess(fen);
    board.move(san);
    return board.fen();
  } catch {
    return null;
  }
}

/** Evaluations are white-relative, as everywhere else in this repository. */
type Evaluate = (fen: string) => Promise<number | null>;

/**
 * SCORE ONE PENDING GAME.
 *
 * THE ARITHMETIC IS `analyseFinishedGame`'S, COPIED DELIBERATELY AND PROVED EQUAL. White wants the
 * number to go up and Black wants it down, so the sign flips with the mover; the loss is clamped at
 * zero because a move that improves on the engine's line has lost nothing; and the standing is
 * reported from the mover's side so "winning" means winning for them.
 *
 * Copying rather than importing looks like the drift this repository keeps closing, so it is worth
 * saying why it is not: the other function's shape is `(FinishedGame, Evaluate)` and it reads the
 * whole game including the opponent's plies, which a stored record does not carry. Sharing the
 * three lines would mean exporting a helper whose only job is to be shared. What holds them
 * together is a test that runs both over the same game and requires identical output — which is
 * stronger than a shared helper, because it would also catch a divergence in how the POSITIONS are
 * chosen, and a shared helper would not.
 */
export async function scorePending(
  pending: PendingAnalysis,
  evaluate: Evaluate,
): Promise<AnalysedDecision[] | AnalysisRefusal> {
  if (pending.positions.length === 0) return { refused: "no-decisions" };

  const scored: AnalysedDecision[] = [];
  for (const position of pending.positions) {
    const before = await evaluate(position.before);
    const after = await evaluate(position.after);
    /*
     * THE DECISION IS REBUILT ONLY AS FAR AS `attachAnalysis` READS IT. That function matches on
     * `ply` and `san` and takes `cpLoss` and `standingCp`; the clock fields are already stored and
     * are not re-derived here, because re-deriving a think time from anything would be inventing a
     * measurement the core froze at commit.
     */
    const base = {
      ply: position.ply,
      side: position.side,
      san: position.san,
      fenBefore: position.before,
      thinkMs: 0,
      clockBeforeMs: 0,
      opponentClockBeforeMs: 0,
    };
    if (before === null || after === null) {
      scored.push({ ...base, cpLoss: null, standingCp: null });
      continue;
    }
    const raw = position.side === "w" ? before - after : after - before;
    scored.push({
      ...base,
      cpLoss: Math.max(0, raw),
      standingCp: position.side === "w" ? before : -before,
    });
  }
  return scored;
}

/** How many evaluations a unit of work costs, so a caller can show progress before starting. */
export function evaluationsRequired(pending: PendingAnalysis): number {
  return pending.positions.length * 2;
}
