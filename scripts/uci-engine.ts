/**
 * A UCI driver for a NATIVE Stockfish, for research runs only.
 *
 * WHY THIS EXISTS BESIDE `client/src/lib/stockfish.ts`, which is the engine client the product
 * uses. That one drives the 7MB wasm build inside a browser Worker, searches by DEPTH, and is
 * shaped around one live search at a time being superseded by the next. A research corpus needs
 * the opposite: a long-lived process, searches by NODE COUNT, `searchmoves`, a cleared hash before
 * every search so budgets are independent, and several engines running at once. Bending the
 * product's client into that shape would change behaviour the product depends on, which the
 * preregistration forbids (§6 of the plan: the research API must be additive).
 *
 * WHAT IS NOT DUPLICATED: the `info` parser. `parseAnyInfo` from `client/src/lib/engine-line.ts`
 * is pure and asset-free, and it is the ONE parser in this repository. A second copy here could
 * pass while the real one failed, which is the defect that module was split out to prevent.
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { createInterface } from "node:readline";
import { comparableCp, parseAnyInfo, type EngineLine } from "../client/src/lib/engine-line.js";
import { winProbability } from "../shared/win-probability.js";

export interface SearchRequest {
  fen: string;
  nodes: number;
  multipv?: number;
  /** Restrict the search to these moves (UCI notation). Used to score one named move. */
  searchmoves?: string[];
}

export interface SearchResult {
  /** Best line first. Empty when the position is terminal and the engine reports no PV. */
  lines: EngineLine[];
  bestMove: string | null;
  /** Nodes the engine actually spent. It overshoots a node limit; the real figure is recorded. */
  nodes: number;
  depth: number;
}

/** Winning chances for the side to move, from a line. Mate is a ceiling, not a magnitude. */
export function lineValue(line: EngineLine): number {
  return winProbability(comparableCp(line));
}

export class UciEngine {
  private queue: Array<() => void> = [];
  private busy = false;
  private constructor(
    private readonly child: ChildProcessByStdio<Writable, Readable, null>,
    private readonly onLine: (handler: (line: string) => void) => void,
    private handler: ((line: string) => void) | null,
  ) {}

  static async spawn(binary: string, options: Record<string, string | number> = {}) {
    const child = spawn(binary, [], { stdio: ["pipe", "pipe", "ignore"] });
    let handler: ((line: string) => void) | null = null;
    const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
    reader.on("line", (line) => handler?.(line));
    const engine = new UciEngine(child, (h) => (handler = h), handler);
    await engine.command("uci", (line) => line === "uciok");
    for (const [name, value] of Object.entries(options))
      child.stdin.write(`setoption name ${name} value ${value}\n`);
    await engine.ready();
    return engine;
  }

  private send(text: string) {
    this.child.stdin.write(`${text}\n`);
  }

  /** Sends a command and resolves on the first line the predicate accepts. */
  private command(text: string, done: (line: string) => boolean): Promise<void> {
    return new Promise((resolve) => {
      this.onLine((line) => {
        if (done(line)) resolve();
      });
      this.send(text);
    });
  }

  private ready() {
    return this.command("isready", (line) => line === "readyok");
  }

  /**
   * One search, on a cleared hash.
   *
   * `ucinewgame` before every search is deliberate and load-bearing: without it a 50-node search
   * that follows a 400,000-node search on the same position reads the deep result straight out of
   * the transposition table, and the whole trajectory collapses into the deep answer. The budget
   * would then be a label rather than a constraint.
   */
  async search(request: SearchRequest): Promise<SearchResult> {
    while (this.busy) await new Promise<void>((r) => this.queue.push(r));
    this.busy = true;
    try {
      this.send("ucinewgame");
      await this.ready();
      this.send(`setoption name MultiPV value ${request.multipv ?? 1}`);
      this.send(`position fen ${request.fen}`);
      const lines = new Map<number, EngineLine>();
      let nodes = 0;
      let depth = 0;
      const result = await new Promise<SearchResult>((resolve) => {
        this.onLine((line) => {
          if (line.startsWith("bestmove")) {
            const best = line.split(/\s+/)[1];
            resolve({
              lines: [...lines.entries()].sort(([a], [b]) => a - b).map(([, l]) => l),
              bestMove: best && best !== "(none)" ? best : null,
              nodes,
              depth,
            });
            return;
          }
          if (!line.startsWith("info ")) return;
          // Aspiration-window bounds are not evaluations; a bound read as a score is a fabricated
          // number that moves with the search window rather than with the position.
          if (line.includes(" lowerbound") || line.includes(" upperbound")) return;
          const parsed = parseAnyInfo(line, request.fen);
          if (!parsed) return;
          const seen = Number(line.match(/\bnodes\s+(\d+)/)?.[1] ?? 0);
          if (seen > nodes) nodes = seen;
          if (parsed.depth > depth) depth = parsed.depth;
          const index = parsed.multipv ?? 1;
          const held = lines.get(index);
          if (!held || parsed.depth >= held.depth) lines.set(index, parsed);
        });
        const moves = request.searchmoves?.length ? ` searchmoves ${request.searchmoves.join(" ")}` : "";
        this.send(`go nodes ${request.nodes}${moves}`);
      });
      return result;
    } finally {
      this.busy = false;
      this.queue.shift()?.();
    }
  }

  quit() {
    this.send("quit");
    this.child.kill();
  }
}
