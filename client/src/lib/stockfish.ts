import {
  emptyLine,
  // Moved to engine-line.ts, which has no asset imports, so the self-check can run the same
  // parser the application runs instead of keeping a second copy of it.
  parseInfo,
  type EngineLine,
  type EngineStatus,
  type WorkerFactory,
  type WorkerLike,
} from "./engine-line";
import engineJsUrl from "stockfish/bin/stockfish-18-lite-single.js?url";
import engineWasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";

// Re-exported so existing importers keep working. UI modules should import from
// ./engine-line directly -- importing VALUES from here pulls the 7MB wasm into the graph.
export * from "./engine-line";

const ENGINE_JS = engineJsUrl;
const ENGINE_WASM = engineWasmUrl;

const defaultWorkerFactory: WorkerFactory = () => {
  // The hash carries the wasm path and nothing else.
  //
  // This previously appended ",worker". That suffix sends the stockfish.js loader down a branch
  // where it never initialises: the worker script loads, the worker is created, and then nothing
  // happens -- no wasm fetch, no message, not even an error. The engine had therefore never
  // produced a single evaluation in this application. Nothing caught it because there were no
  // tests and CI only ran `npm run build`.
  //
  // Verified empirically against the built asset, four URL variants, one browser:
  //   no hash            -> silent
  //   #<wasm>            -> "Stockfish 18 Lite WASM by the Stockfish developers"
  //   #<wasm>,worker     -> silent   <-- what shipped
  //   #<raw wasm>,worker -> silent
  return new Worker(`${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)}`) as unknown as WorkerLike;
};

export class StockfishClient {
  private worker: WorkerLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((reason?: unknown) => void) | null = null;
  private current: {
    resolve: (line: EngineLine) => void;
    reject: (reason?: unknown) => void;
    timer: number;
    fen: string;
  } | null = null;
  private latest: EngineLine | null = null;
  /**
   * How many `bestmove` replies still owed by searches we have abandoned.
   *
   * UCI tags nothing with a request id, so an aborted search's `bestmove` is indistinguishable
   * from the current one's. Previously it resolved whichever request happened to be in
   * `current` -- so superseding a search handed the NEW caller the OLD search's best move
   * together with a reset `latest`, i.e. { pv: [], depth: 0, bestMove: <previous position> }.
   * The real result was then discarded, because `current` had already been cleared. Fast
   * timeline navigation dropped results permanently and stranded a stale number on screen.
   *
   * Every abandoned search owes exactly one `bestmove`; we count them and throw them away.
   */
  private owedBestMoves = 0;
  constructor(
    private onStatus: (status: EngineStatus) => void,
    private createWorker: WorkerFactory = defaultWorkerFactory,
  ) {}
  start() {
    if (this.readyPromise) return this.readyPromise;
    this.onStatus({ mode: "loading", detail: "טוען את מנוע Stockfish 18" });
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      this.worker = this.createWorker();
      this.worker.onmessage = (event: { data: string }) => this.handleMessage(event.data);
      this.worker.onerror = () => this.fail("טעינת המנוע נכשלה — אפשר להמשיך לנתח את הלוח ידנית.");
      this.worker.postMessage("uci");
      // Plain setTimeout, not window.setTimeout: this class has no reason to require a DOM
      // global, and depending on one made the superseding logic untestable outside jsdom.
      setTimeout(() => {
        if (this.resolveReady) this.fail("המנוע לא הגיב בזמן — בדקו את חיבור הרשת ונסו שוב.");
      }, 15000);
    });
    return this.readyPromise;
  }
  async analyze(fen: string, depth = 14): Promise<EngineLine> {
    await this.start();
    if (!this.worker) throw new Error("Stockfish worker unavailable");
    this.stopCurrent();
    this.latest = null;
    this.onStatus({ mode: "thinking", detail: `מחשב קו לעומק ${depth}` });
    return new Promise<EngineLine>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.current) return;
        // Abandoning this search: it still owes a bestmove that must not resolve a later call.
        this.owedBestMoves += 1;
        this.worker?.postMessage("stop");
        const timeoutLine = this.latest?.pv.length ? this.latest : emptyLine(fen);
        this.current = null;
        this.onStatus({ mode: "ready", detail: "המנוע מוכן" });
        resolve(timeoutLine);
      }, 12000) as unknown as number;
      this.current = { resolve, reject, timer, fen };
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
    if (raw.startsWith("bestmove ")) {
      // Drain replies owed by abandoned searches before considering the live one.
      if (this.owedBestMoves > 0) {
        this.owedBestMoves -= 1;
        return;
      }
      if (!this.current) return;
      const bestMove = raw.split(/\s+/)[1];
      const current = this.current;
      this.current = null;
      clearTimeout(current.timer);
      this.onStatus({ mode: "ready", detail: "Stockfish 18 מוכן" });
      current.resolve({ ...(this.latest ?? emptyLine(current.fen)), bestMove, fen: current.fen });
      return;
    }
    // Info lines from an abandoned search must not pollute the live one's best line.
    if (this.owedBestMoves > 0 || !this.current) return;
    const line = parseInfo(raw, this.current.fen);
    if (line && (!this.latest || line.depth >= this.latest.depth)) this.latest = line;
  }
  private stopCurrent() {
    if (!this.current) return;
    clearTimeout(this.current.timer);
    this.current.reject(new Error("Analysis superseded"));
    this.current = null;
    // This search still owes a bestmove. Count it so it cannot resolve the next request.
    this.owedBestMoves += 1;
    this.worker?.postMessage("stop");
  }
  private fail(message: string) {
    this.onStatus({ mode: "error", detail: message });
    this.rejectReady?.(new Error(message));
    this.resolveReady = null;
    this.rejectReady = null;
  }
}
