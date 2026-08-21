/**
 * GATE-STALE positive control: the superseding logic exactly as it shipped.
 *
 * This is a faithful reduction of the original handleMessage/stopCurrent pair. UCI tags nothing
 * with a request id, and this version resolves whichever request happens to sit in `current`,
 * so an abandoned search's `bestmove` resolves the request that replaced it.
 *
 * Never imported by product code. The gate runner loads it only in --positive-controls mode.
 */
import type { WorkerLike } from "../../client/src/lib/stockfish";

export interface LegacyLine {
  scoreCp: number;
  depth: number;
  pv: string[];
  bestMove?: string;
}

const INITIAL_LINE: LegacyLine = { scoreCp: 0, depth: 0, pv: [] };

function parseInfo(raw: string): LegacyLine | undefined {
  if (!raw.startsWith("info ") || !raw.includes(" score ") || !raw.includes(" pv "))
    return undefined;
  const score = raw.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  const depth = raw.match(/\bdepth\s+(\d+)/);
  const pv = raw.split(" pv ")[1]?.trim().split(/\s+/) ?? [];
  if (!score || !depth || !pv.length) return undefined;
  return { scoreCp: Number(score[2]), depth: Number(depth[1]), pv };
}

export class LegacyStockfishClient {
  private current: {
    resolve: (line: LegacyLine) => void;
    reject: (reason?: unknown) => void;
  } | null = null;
  private latest: LegacyLine = INITIAL_LINE;

  constructor(private worker: WorkerLike) {
    this.worker.onmessage = (event) => this.handleMessage(event.data);
  }

  analyze(fen: string): Promise<LegacyLine> {
    this.stopCurrent();
    this.latest = INITIAL_LINE;
    return new Promise<LegacyLine>((resolve, reject) => {
      this.current = { resolve, reject };
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage("go depth 14");
    });
  }

  private handleMessage(raw: string) {
    const line = parseInfo(raw);
    if (line && (!this.latest.depth || line.depth >= this.latest.depth)) this.latest = line;
    // THE DEFECT: no notion of which search this bestmove belongs to.
    if (raw.startsWith("bestmove ") && this.current) {
      const bestMove = raw.split(/\s+/)[1];
      const current = this.current;
      this.current = null;
      current.resolve({ ...this.latest, bestMove });
    }
  }

  private stopCurrent() {
    if (!this.current) return;
    this.current.reject(new Error("Analysis superseded"));
    this.current = null;
    this.worker.postMessage("stop");
  }
}
