/**
 * Engine types and pure predicates, with NO asset imports.
 *
 * This is separate from stockfish.ts on purpose. That module imports the engine JS and the 7MB
 * wasm via `?url`, so any VALUE import of it puts the engine into the initial module graph --
 * which means the engine appears in the network tab while the commitment screen is still up,
 * violating R3. Importing `isStale` from stockfish.ts silently did exactly that.
 *
 * Anything the UI needs at module scope lives here. The implementation stays behind a dynamic
 * import (see Home's ensureEngine).
 */
import { MATE_SCORE } from "@shared/reveal";

export { MATE_SCORE };

export type EngineMode = "loading" | "ready" | "thinking" | "error";

export interface EngineStatus {
  mode: EngineMode;
  detail: string;
}

export interface EngineLine {
  scoreCp: number;
  mate?: number;
  depth: number;
  pv: string[];
  bestMove?: string;
  /**
   * The position this line was computed for. A result that carries its own input makes
   * "rendered against an input it was not computed for" DETECTABLE rather than a matter of
   * discipline -- see isStale() and GATE-STALE.
   */
  fen: string;
  /**
   * Which line this is when the engine was asked for more than one: 1 is the best, 2 the next.
   *
   * Undefined on a single-line search, which is every search this app made until the reveal
   * started asking "why this move and not that one" -- a question MultiPV 1 cannot answer,
   * because the alternative it would be compared against was never computed.
   */
  multipv?: number;
}

/**
 * The subset of Worker the engine client uses. Injecting a factory lets tests drive the UCI
 * conversation directly; jsdom has no real Worker or wasm host, so without this the superseding
 * logic could not be tested at all.
 */
export interface WorkerLike {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}
export type WorkerFactory = () => WorkerLike;

/**
 * What a search rejects with when a later search took the engine away from it.
 *
 * NAMED, AND EXPORTED FROM HERE, because two modules have to agree about it and neither should be
 * matching on a sentence. `StockfishClient` throws it; `analyzePositions` has to tell it apart from
 * a real engine failure, because the two want opposite handling -- a superseded search should be
 * asked again, and a dead worker should not be asked 1,600 times.
 */
export const ANALYSIS_SUPERSEDED = "Analysis superseded";

/** Whether this failure is a search that was taken away rather than an engine that broke. */
export function isSuperseded(error: unknown): boolean {
  return error instanceof Error && error.message === ANALYSIS_SUPERSEDED;
}

/** A result is stale the moment the position it describes is no longer the position on screen. */
export function isStale(line: EngineLine | null, currentFen: string): boolean {
  return line !== null && line.fen !== currentFen;
}

export const emptyLine = (fen: string): EngineLine => ({ scoreCp: 0, depth: 0, pv: [], fen });

/**
 * Whether the engine actually evaluated this position, or whether this is the sentinel.
 *
 * `emptyLine` carries `scoreCp: 0`, and a caller that does arithmetic on it gets a number that
 * reads exactly like a dead-level evaluation. That is not a hypothetical: a search that times
 * out RESOLVES with `emptyLine` rather than rejecting, and every terminal position resolves that
 * way too -- checkmate and stalemate produce no `info ... pv ...` line for the parser to read.
 * So "the engine said nothing" and "the engine said 0.00" were the same value, and the
 * difference is the difference between a measurement and a blank.
 *
 * The parser is what makes `pv` sound as the witness: `parseAnyInfo` refuses any line without a
 * principal variation, so a non-empty `pv` cannot come from anywhere but a real evaluation.
 */
export function hasEvaluation(line: EngineLine): boolean {
  return line.pv.length > 0;
}

/**
 * The one place that decides what a forced mate is worth on the centipawn scale.
 *
 * `scoreCp` on a mate line is NOT a centipawn quantity -- the parser fills it with the mate
 * distance times ten thousand, which makes "mate in nine" score higher than "mate in eight" and
 * therefore makes every step TOWARD mate look like a ten-thousand-centipawn blunder. Reading it
 * as centipawns is the bug this function exists to make impossible; `pv-support.ts` already
 * refuses the same comparison, and the live reveal was the path that did not.
 *
 * `mate 0` is why this is not `Math.sign`. UCI emits it when the side to move is ALREADY
 * checkmated, and `Math.sign(0)` is 0 -- a delivered mate scored as dead level, in the direction
 * that flatters whoever just got mated.
 */
export function comparableCp(line: Pick<EngineLine, "scoreCp" | "mate">): number {
  if (typeof line.mate !== "number") return line.scoreCp;
  return line.mate > 0 ? MATE_SCORE : -MATE_SCORE;
}

/**
 * One UCI `info` line, turned into an EngineLine. Returns undefined for a line that is not a
 * usable evaluation.
 *
 * This lived in stockfish.ts, which cannot be imported for values without pulling the 7MB wasm
 * into the initial module graph. It is pure and has no asset imports, so it belongs here -- and
 * moving it means the self-check can run the SAME parser the application runs, rather than a
 * second copy that could pass while the real one fails.
 */
export function parseInfo(raw: string, fen: string): EngineLine | undefined {
  const line = parseAnyInfo(raw, fen);
  // Single-line callers must keep seeing only the best line. Everything downstream of them --
  // the eval bar, the stale check, batch analysis -- assumes one line per position.
  return line && (line.multipv ?? 1) === 1 ? line : undefined;
}

/**
 * The same parser, without the MultiPV filter.
 *
 * Split out rather than parameterised so the filtering rule stays in exactly one place. The
 * discarding version above was the only parser in the app, which meant an alternative line could
 * not reach the UI even if the engine were asked for one -- the option and the parser had to
 * change together, and only one of them was obvious.
 */
export function parseAnyInfo(raw: string, fen: string): EngineLine | undefined {
  if (!raw.startsWith("info ") || !raw.includes(" score ") || !raw.includes(" pv "))
    return undefined;
  const score = raw.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  const depth = raw.match(/\bdepth\s+(\d+)/);
  const multipv = raw.match(/\bmultipv\s+(\d+)/);
  const pv = raw.split(" pv ")[1]?.trim().split(/\s+/) ?? [];
  if (!score || !depth || !pv.length) return undefined;
  return {
    scoreCp: score[1] === "cp" ? Number(score[2]) : Number(score[2]) * 10000,
    mate: score[1] === "mate" ? Number(score[2]) : undefined,
    depth: Number(depth[1]),
    pv,
    fen,
    multipv: multipv ? Number(multipv[1]) : undefined,
  };
}
