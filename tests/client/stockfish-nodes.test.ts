/**
 * The node-budget search, and the promise that adding it changed nothing above it.
 *
 * Two claims are held here, and the second is the one that matters. The first is that
 * `analyzeNodes` really bounds the search by nodes -- `go nodes N`, not `go depth N`. The second is
 * that the path the application uses is byte-for-byte the conversation it had before: same `go
 * depth`, same MultiPV handling, and NO `ucinewgame`. A research API that quietly clears the
 * transposition table on every application search would be a performance regression nobody would
 * attribute to research code.
 *
 * The hash clearing is asserted rather than commented, because it is the difference between a
 * trajectory and a label: without it, a 50-node search that follows a deep search of the same
 * position reads the deep answer out of the table and every budget agrees.
 *
 * Driven through the injected worker, as tests/client/multipv.test.ts does: jsdom has no Worker.
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
  get goCommands() {
    return this.sent.filter((m) => m.startsWith("go "));
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function client() {
  const worker = new FakeWorker();
  return { worker, engine: new StockfishClient(() => {}, () => worker) };
}

describe("a search bounded by nodes", () => {
  it("asks the engine for a node budget, not a depth", async () => {
    const { worker, engine } = client();
    const pending = engine.analyzeNodes(FEN, 2000, 2);
    await tick();
    worker.reply("info depth 8 multipv 1 score cp 21 nodes 2013 pv e2e4 e7e5");
    worker.reply("info depth 8 multipv 2 score cp 14 nodes 2013 pv d2d4 d7d5");
    worker.reply("bestmove e2e4");
    const lines = await pending;

    expect(worker.goCommands).toEqual(["go nodes 2000"]);
    expect(lines.map((l) => l.pv[0])).toEqual(["e2e4", "d2d4"]);
    expect(lines[0].bestMove).toBe("e2e4");
  });

  it("clears the hash first, so one budget cannot read another budget's answer", async () => {
    const { worker, engine } = client();
    const pending = engine.analyzeNodes(FEN, 50, 1);
    await tick();
    worker.reply("info depth 1 multipv 1 score cp 5 nodes 57 pv d2d4");
    worker.reply("bestmove d2d4");
    await pending;

    const clear = worker.sent.indexOf("ucinewgame");
    const go = worker.sent.indexOf("go nodes 50");
    expect(clear).toBeGreaterThan(-1);
    expect(clear).toBeLessThan(go);
  });

  it("leaves the application's depth search exactly as it was", async () => {
    const { worker, engine } = client();
    const pending = engine.analyze(FEN, 14);
    await tick();
    worker.reply("info depth 14 multipv 1 score cp 30 nodes 90000 pv e2e4 e7e5");
    worker.reply("bestmove e2e4");
    await pending;

    expect(worker.goCommands).toEqual(["go depth 14"]);
    expect(worker.sent).not.toContain("ucinewgame");
  });

  it("keeps MultiPV sticky-safe: a one-line node search resets the option it inherited", async () => {
    const { worker, engine } = client();
    const first = engine.analyzeNodes(FEN, 1000, 3);
    await tick();
    worker.reply("info depth 6 multipv 1 score cp 20 nodes 1004 pv e2e4");
    worker.reply("bestmove e2e4");
    await first;
    const second = engine.analyzeNodes(FEN, 1000, 1);
    await tick();
    worker.reply("info depth 6 multipv 1 score cp 20 nodes 1004 pv e2e4");
    worker.reply("bestmove e2e4");
    await second;

    expect(
      worker.sent.filter((m) => m.startsWith("setoption name MultiPV")).map((m) => m.split(" ").pop()),
    ).toEqual(["3", "1"]);
  });
});
