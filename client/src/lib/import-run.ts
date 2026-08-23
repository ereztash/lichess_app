/**
 * From a list of the player's Lichess games to one reading, with the engine in between.
 *
 * The three pieces already existed and nothing joined them: `gamePositions` turns a PGN into
 * positions, `analyzePositions` scores them, `diagnoseImportedGames` reads the six buckets. This
 * is the join, and it is deliberately the only place that knows the order.
 *
 * `analyze` is injected, not imported. stockfish.ts pulls 7MB of wasm at module scope and
 * importing it here would put the engine back into the initial module graph -- the R3 regression
 * GATE-COMMIT exists to catch. The caller already holds a lazily-created engine.
 *
 * Progress is counted across the whole run rather than per game, because that is the number a
 * person waiting is actually asking about. All PGNs are parsed up front -- cheap, no engine -- so
 * the denominator is known before the first search rather than growing as it goes.
 */
import { analyzePositions, gamePositions } from "@/lib/batch-analysis";
import type { EngineLine } from "@/lib/engine-line";
import {
  diagnoseImportedGames,
  type ImportDiagnostic,
  type ImportedGameInput,
} from "@shared/import-diagnostic";
import { clockSecondsFromPgn, timeControlHeader } from "@shared/pgn-clock";

/** Only the fields this needs, so a test does not have to build a whole ImportedGame. */
export interface AnalysableGame {
  id: string;
  white: string;
  black: string;
  pgn: string;
  /**
   * Lichess's time class: bullet, blitz, rapid, classical.
   *
   * Already fetched for the game list and previously dropped here. It is what stops the
   * clock-derived buckets averaging a 45-second move in a 3+0 game together with one in 30+0 --
   * the same number meaning opposite things.
   */
  speed?: string;
}

export interface ImportRunProgress {
  /** Positions scored so far, across every game. */
  done: number;
  /** Positions in the whole run, known before the first search. */
  total: number;
  /** Games finished. The other number a person waiting actually asks about. */
  gamesDone: number;
  games: number;
}

export interface ImportRunOptions {
  onProgress?: (progress: ImportRunProgress) => void;
  signal?: AbortSignal;
}

export interface ImportRunResult {
  diagnostic: ImportDiagnostic;
  /** Games whose PGN produced no positions at all, so they contributed nothing. */
  unreadable: number;
  /** True when the run was stopped early. The diagnostic then covers only what was scored. */
  aborted: boolean;
}

/**
 * Which side the player was, or null when neither name matches.
 *
 * Lichess usernames are case-insensitive; a game where neither side matches is not the player's
 * game and must not be scored as one. Returning null rather than defaulting to white is the whole
 * point: a default here would silently diagnose the opponent.
 */
export function playerColour(game: AnalysableGame, username: string): "w" | "b" | null {
  const name = username.trim().toLowerCase();
  if (!name) return null;
  if (game.white.toLowerCase() === name) return "w";
  if (game.black.toLowerCase() === name) return "b";
  return null;
}

/** A game reduced to positions and clocks, with no engine involved yet. */
interface Prepared {
  fens: string[];
  clockTimes: number[];
  timeControl?: string;
  playerColor: "w" | "b";
  speed?: string;
}

function prepare(game: AnalysableGame, username: string): Prepared | null {
  const colour = playerColour(game, username);
  if (colour === null) return null;
  let fens: string[];
  try {
    fens = gamePositions(game.pgn);
  } catch {
    // A PGN chess.js will not load is not a run-ending error; it is one game that says nothing.
    return null;
  }
  if (fens.length < 2) return null;
  return {
    fens,
    clockTimes: clockSecondsFromPgn(game.pgn),
    timeControl: timeControlHeader(game.pgn),
    playerColor: colour,
    speed: game.speed,
  };
}

export async function runImportDiagnostic(
  games: AnalysableGame[],
  username: string,
  analyze: (fen: string, depth: number) => Promise<EngineLine>,
  options: ImportRunOptions = {},
): Promise<ImportRunResult> {
  const prepared = games.map((g) => prepare(g, username));
  const readable = prepared.filter((p): p is Prepared => p !== null);
  const total = readable.reduce((sum, p) => sum + p.fens.length, 0);

  const inputs: ImportedGameInput[] = [];
  let done = 0;
  let gamesDone = 0;

  for (const p of readable) {
    if (options.signal?.aborted) break;
    const before = done;
    const evalScores = await analyzePositions(p.fens, analyze, {
      signal: options.signal,
      onProgress: ({ done: withinGame }) => {
        done = before + withinGame;
        options.onProgress?.({ done, total, gamesDone, games: readable.length });
      },
    });
    /*
     * An aborted game gives a short array. It is kept rather than dropped: the positions really
     * were scored, and the decisions drawn from them are real. `decisionsFromGame` stops at the
     * end of evalScores on its own.
     */
    inputs.push({
      fens: p.fens,
      evalScores,
      clockTimes: p.clockTimes,
      timeControl: p.timeControl,
      playerColor: p.playerColor,
      speed: p.speed,
    });
    gamesDone += 1;
    options.onProgress?.({ done, total, gamesDone, games: readable.length });
  }

  return {
    diagnostic: diagnoseImportedGames(inputs),
    unreadable: games.length - readable.length,
    aborted: options.signal?.aborted === true,
  };
}
