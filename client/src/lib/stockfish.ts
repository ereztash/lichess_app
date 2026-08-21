import engineJsUrl from "stockfish/bin/stockfish-18-lite-single.js?url";
import engineWasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";

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
}
const ENGINE_JS = engineJsUrl;
const ENGINE_WASM = engineWasmUrl;
const INITIAL_LINE: EngineLine = { scoreCp: 0, depth: 0, pv: [] };

function parseInfo(raw: string): EngineLine | undefined {
  if (!raw.startsWith("info ") || !raw.includes(" score ") || !raw.includes(" pv "))
    return undefined;
  if (/\bmultipv\s+(?!1\b)/.test(raw)) return undefined;
  const score = raw.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  const depth = raw.match(/\bdepth\s+(\d+)/);
  const pv = raw.split(" pv ")[1]?.trim().split(/\s+/) ?? [];
  if (!score || !depth || !pv.length) return undefined;
  return {
    scoreCp: score[1] === "cp" ? Number(score[2]) : Number(score[2]) * 10000,
    mate: score[1] === "mate" ? Number(score[2]) : undefined,
    depth: Number(depth[1]),
    pv,
  };
}

export class StockfishClient {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((reason?: unknown) => void) | null = null;
  private current: {
    resolve: (line: EngineLine) => void;
    reject: (reason?: unknown) => void;
    timer: number;
  } | null = null;
  private latest: EngineLine = INITIAL_LINE;
  constructor(private onStatus: (status: EngineStatus) => void) {}
  start() {
    if (this.readyPromise) return this.readyPromise;
    this.onStatus({ mode: "loading", detail: "טוען את מנוע Stockfish 18" });
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      const workerUrl = `${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)},worker`;
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = (event: MessageEvent<string>) => this.handleMessage(event.data);
      this.worker.onerror = () => this.fail("טעינת המנוע נכשלה — אפשר להמשיך לנתח את הלוח ידנית.");
      this.worker.postMessage("uci");
      window.setTimeout(() => {
        if (this.resolveReady) this.fail("המנוע לא הגיב בזמן — בדקו את חיבור הרשת ונסו שוב.");
      }, 15000);
    });
    return this.readyPromise;
  }
  async analyze(fen: string, depth = 14): Promise<EngineLine> {
    await this.start();
    if (!this.worker) throw new Error("Stockfish worker unavailable");
    this.stopCurrent();
    this.latest = INITIAL_LINE;
    this.onStatus({ mode: "thinking", detail: `מחשב קו לעומק ${depth}` });
    return new Promise<EngineLine>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (!this.current) return;
        this.worker?.postMessage("stop");
        const timeoutLine = this.latest.pv.length ? this.latest : INITIAL_LINE;
        this.current = null;
        this.onStatus({ mode: "ready", detail: "המנוע מוכן" });
        resolve(timeoutLine);
      }, 12000);
      this.current = { resolve, reject, timer };
      this.worker?.postMessage("stop");
      this.worker?.postMessage("setoption name MultiPV value 1");
      this.worker?.postMessage(`position fen ${fen}`);
      this.worker?.postMessage(`go depth ${depth}`);
    });
  }
  dispose() {
    this.stopCurrent();
    this.worker?.postMessage("quit");
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
  }
  private handleMessage(raw: string) {
    if (raw === "uciok") {
      this.worker?.postMessage("isready");
      return;
    }
    if (raw === "readyok") {
      if (this.resolveReady) {
        this.resolveReady();
        this.resolveReady = null;
        this.rejectReady = null;
        this.onStatus({ mode: "ready", detail: "Stockfish 18 מוכן" });
      }
      return;
    }
    const line = parseInfo(raw);
    if (line && (!this.latest.depth || line.depth >= this.latest.depth)) this.latest = line;
    if (raw.startsWith("bestmove ") && this.current) {
      const bestMove = raw.split(/\s+/)[1];
      const current = this.current;
      this.current = null;
      clearTimeout(current.timer);
      this.onStatus({ mode: "ready", detail: "Stockfish 18 מוכן" });
      current.resolve({ ...this.latest, bestMove });
    }
  }
  private stopCurrent() {
    if (!this.current) return;
    clearTimeout(this.current.timer);
    this.current.reject(new Error("Analysis superseded"));
    this.current = null;
    this.worker?.postMessage("stop");
  }
  private fail(message: string) {
    this.onStatus({ mode: "error", detail: message });
    this.rejectReady?.(new Error(message));
    this.resolveReady = null;
    this.rejectReady = null;
  }
}
