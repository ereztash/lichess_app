/**
 * Asking the engine for the move it did NOT choose.
 *
 * The app printed a next-question -- "what would you have needed to know to choose between e5f5
 * and h7h5?" -- while running an instrument that could not answer it. `setoption MultiPV 1` was
 * sent on every search, and the parser discarded any `info` line tagged with another index, so
 * the alternative was refused twice over: never computed, and unparseable if it had been.
 *
 * Driven through the injected worker, as tests/gates/stale.test.ts does. jsdom has no Worker and
 * no wasm host, so a real UCI conversation is the only way to exercise this.
 */
import { describe, expect, it } from "vitest";
import { StockfishClient, type WorkerLike } from "@/lib/stockfish";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly sent: string[] = [];

  postMessage(message: string) {
    this.sent.push(message);
    if (message === "uci") queueMicrotask(() => this.reply("uciok"));
    if (message === "isready") queueMicrotask(() => this.reply("readyok"));
  }
  terminate() {}
  reply(data: string) {
    this.onmessage?.({ data });
  }
  /** Every MultiPV value the client asked for, in order. */
  get multipvSettings() {
    return this.sent
      .filter((m) => m.startsWith("setoption name MultiPV"))
      .map((m) => Number(m.split(" ").pop()));
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function client() {
  const worker = new FakeWorker();
  return { worker, engine: new StockfishClient(() => {}, () => worker) };
}

describe("two lines from one search", () => {
  it("asks the engine for two and returns both, best first", async () => {
    const { worker, engine } = client();
    const pending = engine.analyzeAlternatives(FEN, 14, 2);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp -44 pv h7h5 d1h5 g8f6");
    worker.reply("info depth 14 multipv 2 score cp -56 pv e5f5 d1h5");
    worker.reply("bestmove h7h5");
    const lines = await pending;

    expect(worker.multipvSettings).toContain(2);
    expect(lines).toHaveLength(2);
    expect(lines[0].pv[0]).toBe("h7h5");
    expect(lines[1].pv[0]).toBe("e5f5");
    expect(lines[0].scoreCp).toBe(-44);
    expect(lines[1].scoreCp).toBe(-56);
  });

  it("orders by the engine's index, not by arrival", async () => {
    // UCI emits info lines in whatever order the search finishes them; nothing guarantees
    // multipv 1 arrives first, and "best first" is the one property the caller relies on.
    const { worker, engine } = client();
    const pending = engine.analyzeAlternatives(FEN, 14, 2);
    await tick();
    worker.reply("info depth 14 multipv 2 score cp -56 pv e5f5 d1h5");
    worker.reply("info depth 14 multipv 1 score cp -44 pv h7h5 d1h5");
    worker.reply("bestmove h7h5");
    const lines = await pending;
    expect(lines.map((l) => l.pv[0])).toEqual(["h7h5", "e5f5"]);
  });

  it("keeps the deepest report for each line, not the last", async () => {
    const { worker, engine } = client();
    const pending = engine.analyzeAlternatives(FEN, 14, 2);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp 50 pv a2a3");
    worker.reply("info depth 14 multipv 2 score cp 10 pv b2b3");
    // A shallower re-report must not overwrite what depth 14 already established.
    worker.reply("info depth 6 multipv 1 score cp 999 pv h2h4");
    worker.reply("bestmove a2a3");
    const lines = await pending;
    expect(lines[0].scoreCp).toBe(50);
    expect(lines[0].depth).toBe(14);
  });

  it("puts bestmove on the best line only", async () => {
    /*
     * `bestmove` names one move. Stamping it onto the runner-up would label the alternative with
     * the move the engine played INSTEAD of it -- and bestMove is the one field on that object a
     * reader would trust without checking.
     */
    const { worker, engine } = client();
    const pending = engine.analyzeAlternatives(FEN, 14, 2);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp -44 pv h7h5");
    worker.reply("info depth 14 multipv 2 score cp -56 pv e5f5");
    worker.reply("bestmove h7h5");
    const lines = await pending;
    expect(lines[0].bestMove).toBe("h7h5");
    expect(lines[1].bestMove).toBeUndefined();
  });
});

describe("the single-line path is unchanged", () => {
  it("still asks for one line and still returns one", async () => {
    const { worker, engine } = client();
    const pending = engine.analyze(FEN, 14);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp 30 pv e2e4 e7e5");
    worker.reply("bestmove e2e4");
    const best = await pending;
    expect(worker.multipvSettings).toEqual([1]);
    expect(best.bestMove).toBe("e2e4");
    expect(best.scoreCp).toBe(30);
  });

  it("sets the option back down to 1 after a two-line search", async () => {
    /*
     * The leak this prevents. MultiPV is sticky on the worker, so one reveal asking for two
     * lines would leave every later search -- the eval bar, and batch analysis over 971
     * positions -- silently running MultiPV 2 and paying for it.
     */
    const { worker, engine } = client();
    const first = engine.analyzeAlternatives(FEN, 14, 2);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp 10 pv a2a3");
    worker.reply("bestmove a2a3");
    await first;

    const second = engine.analyze(FEN, 14);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp 20 pv b2b3");
    worker.reply("bestmove b2b3");
    await second;

    expect(worker.multipvSettings).toEqual([2, 1]);
  });

  it("ignores a stray second line when only one was asked for", async () => {
    // Everything downstream of analyze() -- the eval bar, the stale check, batch analysis --
    // assumes one line per position.
    const { worker, engine } = client();
    const pending = engine.analyze(FEN, 14);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp 30 pv e2e4");
    worker.reply("info depth 14 multipv 2 score cp -900 pv a2a4");
    worker.reply("bestmove e2e4");
    const best = await pending;
    expect(best.scoreCp).toBe(30);
    expect(best.pv[0]).toBe("e2e4");
  });
});

describe("a search that does not finish", () => {
  it("hands back what it had rather than nothing", async () => {
    const { worker, engine } = client();
    const first = engine.analyzeAlternatives(FEN, 14, 2);
    await tick();
    worker.reply("info depth 9 multipv 1 score cp 15 pv c2c4");
    worker.reply("info depth 9 multipv 2 score cp 5 pv d2d4");
    // Superseded before bestmove: the first call rejects, and the abandoned search still owes a
    // bestmove that must not resolve the next one.
    const second = engine.analyzeAlternatives(FEN, 14, 2);
    await expect(first).rejects.toThrow(/superseded/i);
    await tick();
    worker.reply("bestmove c2c4");
    worker.reply("info depth 14 multipv 1 score cp 40 pv g1f3");
    worker.reply("bestmove g1f3");
    const lines = await second;
    expect(lines[0].pv[0]).toBe("g1f3");
  });
});

describe("the parser's own contract", () => {
  it("hands the single-line parser only the best line", async () => {
    /*
     * Asserted directly, because the path that used to protect this no longer does. `analyze()`
     * now takes the first entry of an index-sorted collection, so removing the filter from
     * `parseInfo` leaves every test above green -- the first control run for this proved it.
     *
     * The filter still matters: self-check.ts imports `parseInfo` by name and runs it over raw
     * `info` lines with no MultiPV option set, so it is the last caller relying on the rule.
     */
    const { parseInfo, parseAnyInfo } = await import("@/lib/engine-line");
    const second = "info depth 14 multipv 2 score cp -56 pv e5f5 d1h5";
    expect(parseInfo(second, FEN), "an alternative line reached a single-line caller").toBeUndefined();
    expect(parseAnyInfo(second, FEN)?.multipv).toBe(2);
  });

  it("treats an untagged line as the best one, which is what MultiPV 1 emits", () => {
    // Stockfish omits the tag entirely at MultiPV 1, so an undefined index must not be dropped.
    const untagged = "info depth 12 score cp 25 pv e2e4 e7e5";
    return import("@/lib/engine-line").then(({ parseInfo, parseAnyInfo }) => {
      expect(parseInfo(untagged, FEN)?.scoreCp).toBe(25);
      expect(parseAnyInfo(untagged, FEN)?.multipv).toBeUndefined();
    });
  });
});
