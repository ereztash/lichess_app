import {
  emptyLine,
  // Moved to engine-line.ts, which has no asset imports, so the self-check can run the same
  // parser the application runs instead of keeping a second copy of it.
  parseAnyInfo,
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

/** What bounds a search: the depth the application asks for, or the node budget research asks for. */
type SearchLimit = { kind: "depth"; value: number } | { kind: "nodes"; value: number };

export class StockfishClient {
  private worker: WorkerLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((reason?: unknown) => void) | null = null;
  private current: {
    /**
     * Always an array, even for a single-line search, which `analyze` unwraps.
     *
     * One shape rather than two: the alternative was a second resolve field beside this one, and
     * then every early-return in handleMessage would have had to pick the right one.
     */
    resolve: (lines: EngineLine[]) => void;
    reject: (reason?: unknown) => void;
    timer: number;
    fen: string;
  } | null = null;
  /**
   * The deepest line seen so far per MultiPV index. Index 1 is the best line and is the only one
   * present on a single-line search, which is every search outside the reveal.
   */
  private lines = new Map<number, EngineLine>();
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
    const [best] = await this.search(fen, { kind: "depth", value: depth }, 1);
    return best ?? emptyLine(fen);
  }

  /**
   * The best line and the next-best, from ONE search.
   *
   * This is what answers "why this move and not that one". A single-line search cannot: it
   * reports what happens after the engine's choice and never evaluates the move the player was
   * actually weighing against it. Two separate `analyze` calls cannot either -- the second would
   * have to be told which alternative to force, and nothing in the app knows that.
   *
   * MultiPV costs more than a single-line search and NOBODY HERE HAS MEASURED HOW MUCH. The two
   * lines share one search tree, so the true figure is somewhere between 1x and 2x and is
   * probably nearer the bottom of that range; 2x is an upper bound, not an estimate. It is asked
   * for on the reveal, where one position is searched, and deliberately not in the import path,
   * where 971 are -- that decision holds under the upper bound, which is why it can be made
   * without the measurement. See docs/MEASUREMENTS.md.
   */
  async analyzeAlternatives(fen: string, depth = 14, count = 2): Promise<EngineLine[]> {
    return this.search(fen, { kind: "depth", value: depth }, count);
  }

  /**
   * A search bounded by NODES rather than by depth. Additive: nothing above changes.
   *
   * Depth is not a unit of computation. The same `go depth 14` costs a few thousand nodes in a
   * locked position and millions in a sharp one, so a set of depth-bounded searches cannot be read
   * as "the same amount of thinking, applied to different positions" -- which is exactly what the
   * blitz-computation research needs to vary. `go nodes N` is the same amount of thinking by
   * construction.
   *
   * The hash is cleared first, as it now is on every path (see `search`). It matters most here:
   * without `ucinewgame` a 50-node search that follows a 400,000-node search of the same position
   * reads the deep answer straight out of the transposition table, every budget then agrees, the
   * trajectory looks perfectly stable, and the budget has become a label rather than a constraint.
   */
  async analyzeNodes(fen: string, nodes: number, multiPv = 1): Promise<EngineLine[]> {
    return this.search(fen, { kind: "nodes", value: nodes }, multiPv);
  }

  private async search(fen: string, limit: SearchLimit, multipv: number): Promise<EngineLine[]> {
    await this.start();
    if (!this.worker) throw new Error("Stockfish worker unavailable");
    this.stopCurrent();
    this.lines.clear();
    this.onStatus({
      mode: "thinking",
      detail:
        limit.kind === "depth"
          ? `מחשב קו לעומק ${limit.value}`
          : `מחשב קו בתקציב ${limit.value} צמתים`,
    });
    return new Promise<EngineLine[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.current) return;
        // Abandoning this search: it still owes a bestmove that must not resolve a later call.
        this.owedBestMoves += 1;
        this.worker?.postMessage("stop");
        const partial = this.collected(fen);
        this.current = null;
        this.onStatus({ mode: "ready", detail: "המנוע מוכן" });
        // A timeout keeps whatever depth it reached, and keeps it in order.
        resolve(partial.length ? partial : [emptyLine(fen)]);
      }, 12000) as unknown as number;
      this.current = { resolve, reject, timer, fen };
      this.worker?.postMessage("stop");
      /*
       * EVERY SEARCH STARTS FROM AN EMPTY TABLE, and this is a measurement decision rather than a
       * performance one.
       *
       * Without it, a position's evaluation depends on which positions were searched before it:
       * the transposition table survives from one `go` to the next, so an import of the same games
       * in a different order produces different evaluations, different centipawn losses, and a
       * different accuracy rate for the same player.
       *
       * MEASURED, on 5 real Lichess players, 12 real games each, through this product's own import
       * path (`scripts/run_import_harness.ts`): reversing the order of the games moved a bucket's
       * accuracy rate by up to 11.8 PERCENTAGE POINTS, on every player tested. Clearing the table
       * before each position restored order-independence exactly, on every player tested. The
       * product's own `worstBucketVerdict` asks a weakest bucket to clear roughly 25 points at
       * n = 30, so the artefact was approaching half the bar it has to beat.
       *
       * WHAT IT COSTS, measured on the same runs rather than assumed: 1.43x the import's engine
       * time (1.36x-1.49x across the five). That is the price of a number that means the same
       * thing twice, and it is the same trade this file already makes elsewhere -- the timeout
       * keeps partial results, the FEN travels with the line, a bound is not a score.
       */
      this.worker?.postMessage("ucinewgame");
      /*
       * Set every time, including back down to 1. The option is sticky on the worker, so a
       * reveal that asked for two lines would otherwise leave every later single-line search
       * -- the eval bar, batch analysis -- quietly running MultiPV 2 and paying for it.
       */
      this.worker?.postMessage(`setoption name MultiPV value ${multipv}`);
      this.worker?.postMessage(`position fen ${fen}`);
      this.worker?.postMessage(
        limit.kind === "depth" ? `go depth ${limit.value}` : `go nodes ${limit.value}`,
      );
    });
  }

  /** The lines collected so far, best first, gaps closed. */
  private collected(fen: string): EngineLine[] {
    return [...this.lines.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, line]) => line)
      .filter((line) => line.pv.length > 0 && line.fen === fen);
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
      const collected = this.collected(current.fen);
      /*
       * `bestmove` names one move, so it belongs to the best line only. Stamping it onto the
       * runner-up would label the alternative with the move the engine chose instead of it --
       * the one field on that object a reader would trust without checking.
       */
      const lines = collected.length
        ? collected.map((line, i) => (i === 0 ? { ...line, bestMove } : line))
        : [{ ...emptyLine(current.fen), bestMove }];
      current.resolve(lines);
      return;
    }
    // Info lines from an abandoned search must not pollute the live one's best line.
    if (this.owedBestMoves > 0 || !this.current) return;
    const line = parseAnyInfo(raw, this.current.fen);
    if (!line) return;
    const index = line.multipv ?? 1;
    const held = this.lines.get(index);
    if (!held || line.depth >= held.depth) this.lines.set(index, line);
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
