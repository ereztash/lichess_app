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

/** A result is stale the moment the position it describes is no longer the position on screen. */
export function isStale(line: EngineLine | null, currentFen: string): boolean {
  return line !== null && line.fen !== currentFen;
}

export const emptyLine = (fen: string): EngineLine => ({ scoreCp: 0, depth: 0, pv: [], fen });

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
