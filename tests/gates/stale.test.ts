/**
 * GATE-STALE (section 4.3): a result rendered against an input it was not computed for is
 * marked stale.
 *
 * The positive control is the race that shipped. UCI tags nothing with a request id, so an
 * aborted search's `bestmove` is indistinguishable from the live one's. The old handleMessage
 * resolved whichever request happened to sit in `current`, which meant superseding a search
 * handed the NEW caller the OLD search's best move with a reset `latest`.
 *
 * This drives the UCI conversation through an injected fake worker. jsdom has no Worker or wasm
 * host, so this is the only way the superseding logic can be exercised at all.
 */
import { describe, expect, it, vi } from "vitest";
import { isStale, StockfishClient, type EngineLine, type WorkerLike } from "@/lib/stockfish";

const FEN_A = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_B = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

/** A worker we drive by hand. Records what was sent; replies only when told to. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly sent: string[] = [];

  postMessage(message: string) {
    this.sent.push(message);
    // Complete the UCI handshake automatically; everything else is driven by the test.
    if (message === "uci") queueMicrotask(() => this.reply("uciok"));
    if (message === "isready") queueMicrotask(() => this.reply("readyok"));
  }
  terminate() {}
  reply(data: string) {
    this.onmessage?.({ data });
  }
  get searches() {
    return this.sent.filter((m) => m.startsWith("position fen "));
  }
}

/**
 * `analyze()` awaits `start()` before registering its search, so its body does not run in the
 * same tick as the call. Replies delivered before that point would arrive at a client with no
 * live search -- a property of the test, not of the code under test.
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function readyClient() {
  const worker = new FakeWorker();
  const client = new StockfishClient(
    () => {},
    () => worker,
  );
  await client.start();
  return { client, worker };
}

describe("GATE-STALE: a superseded search cannot resolve the request that replaced it", () => {
  it("discards the abandoned search's bestmove instead of handing it to the new caller", async () => {
    const { client, worker } = await readyClient();

    const first = client.analyze(FEN_A, 14);
    const firstRejected = first.catch((error: Error) => error.message);
    await tick();

    // Supersede it before it finishes.
    const second = client.analyze(FEN_B, 14);
    await tick();
    expect(await firstRejected).toBe("Analysis superseded");

    // The engine now emits the ABANDONED search's bestmove. Under the old logic this resolved
    // `second` with FEN_A's move and an empty line.
    worker.reply("bestmove a2a3");

    // The live search then reports for real.
    worker.reply("info depth 18 score cp 55 pv d2d4 d7d5");
    worker.reply("bestmove d2d4");

    const line = await second;
    expect(line.bestMove, "resolved with the abandoned search's move").toBe("d2d4");
    expect(line.fen).toBe(FEN_B);
    expect(line.depth).toBe(18);
    expect(line.pv).toEqual(["d2d4", "d7d5"]);
  });

  it("does not let an abandoned search's info lines pollute the live best line", async () => {
    const { client, worker } = await readyClient();
    client.analyze(FEN_A, 14).catch(() => {});
    await tick();
    const second = client.analyze(FEN_B, 14);
    await tick();

    // Deep info from the dead search arrives after the new one started.
    worker.reply("info depth 30 score cp -900 pv h2h4 h7h5");
    worker.reply("bestmove h2h4"); // the abandoned search's owed reply
    worker.reply("info depth 12 score cp 20 pv e2e4 e7e5");
    worker.reply("bestmove e2e4");

    const line = await second;
    expect(line.scoreCp, "took the dead search's evaluation").toBe(20);
    expect(line.pv).toEqual(["e2e4", "e7e5"]);
    expect(line.fen).toBe(FEN_B);
  });

  it("carries the position every result was computed for", async () => {
    const { client, worker } = await readyClient();
    const pending = client.analyze(FEN_A, 14);
    await tick();
    worker.reply("info depth 14 score cp 31 pv e2e4");
    worker.reply("bestmove e2e4");
    expect((await pending).fen).toBe(FEN_A);
  });
});

describe("isStale marks a result shown against a position it does not describe", () => {
  const line: EngineLine = { scoreCp: 31, depth: 18, pv: ["e2e4"], bestMove: "e2e4", fen: FEN_A };

  it("is not stale against its own position", () => {
    expect(isStale(line, FEN_A)).toBe(false);
  });

  it("is stale against any other position", () => {
    expect(isStale(line, FEN_B)).toBe(true);
  });

  it("treats absence as not-stale -- nothing is being shown", () => {
    expect(isStale(null, FEN_A)).toBe(false);
  });
});

describe("timeout path", () => {
  it("resolves against the position it was asked about, not a bare zero", async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const client = new StockfishClient(
        () => {},
        () => worker,
      );
      const started = client.start();
      await vi.advanceTimersByTimeAsync(0);
      await started;

      const pending = client.analyze(FEN_A, 14);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(12_001);
      const line = await pending;
      expect(line.fen, "a timed-out result must still name its position").toBe(FEN_A);
      expect(line.pv).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
