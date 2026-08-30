/**
 * R-09: the engine failed to load once, and the page never asked again.
 *
 * WHAT A PLAYER REPORTED: games would not load from Lichess or Chess.com, with
 * *"הסריקה נעצרה לפני שהספיקה למדוד משהו."* on screen. Neither API was at fault — both answer
 * public, CORS-open endpoints, and the import itself was fine. The scan was failing, and the scan's
 * `catch` in `ImportGames.tsx` is generic, so the screen said the same sentence whatever went wrong
 * underneath.
 *
 * WHAT WAS UNDERNEATH. `StockfishClient.start()` memoised `readyPromise` and nothing cleared it on
 * failure. `Home.tsx` keeps ONE client in a ref for the life of the page, so the first readiness
 * failure became that client's permanent answer: every later search awaited the same rejected
 * promise and failed immediately, with no worker built and no request sent. The failure message
 * said *"check your network connection and try again"*, and trying again was the one thing that
 * could not help — only a full page reload could.
 *
 * WHY READINESS FAILED IN THE FIRST PLACE, measured rather than guessed. Driving the real built
 * bundle in headless Chromium: with the bytes already local the engine answers `uciok` in **282 ms**
 * (37 ms to fetch the 7,295,411-byte wasm from disk, 5 ms to compile). The old 15-second bound was
 * therefore never about the engine thinking — it was a budget for the download, and 5.6 MB gzipped
 * inside 15 s needs 3.0 Mbit/s sustained. At 1 Mbit/s that payload takes 45 s.
 *
 * SO THERE ARE TWO CHANGES AND ONLY ONE OF THEM IS A THRESHOLD. The bound moved, which is a
 * judgement about connections. The retry works, which is not: a client that gives up permanently on
 * a transient failure is wrong at any bound, and it is the half this file gates.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { StockfishClient } from "@/lib/stockfish";

/**
 * A worker that answers the handshake only when told to, and counts how many were built.
 *
 * THE COUNT IS THE ASSERTION. "Did the retry work?" is not answerable from a resolved promise
 * alone — a client that cached a good result would also look fine. What distinguishes a real
 * retry from a cached anything is that a NEW worker exists, which is a new fetch of the engine.
 */
function engineFactory() {
  const built: { posted: string[]; terminated: boolean }[] = [];
  let answering = false;
  const factory = () => {
    const worker = {
      posted: [] as string[],
      terminated: false,
      onmessage: null as null | ((event: { data: string }) => void),
      onerror: null as null | (() => void),
      postMessage(message: string) {
        worker.posted.push(message);
        if (!answering) return;
        if (message === "uci") queueMicrotask(() => worker.onmessage?.({ data: "uciok" }));
        if (message === "isready") queueMicrotask(() => worker.onmessage?.({ data: "readyok" }));
      },
      terminate() {
        worker.terminated = true;
      },
    };
    built.push(worker);
    return worker;
  };
  return {
    factory,
    built,
    /** The engine has arrived: from here on, workers answer the handshake. */
    connect: () => {
      answering = true;
    },
  };
}

const statuses: { mode: string; detail: string }[] = [];
const client = (factory: () => unknown) =>
  new StockfishClient((s) => statuses.push(s), factory as never);

beforeEach(() => {
  statuses.length = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * Start the engine, run the readiness deadline out, and assert it gave up.
 *
 * THE HANDLER IS ATTACHED BEFORE THE TIMERS RUN, and that ordering is not a style choice: a
 * rejection with no handler yet attached is an unhandled rejection, which vitest reports as an
 * error even though every assertion passed. Written the obvious way round, this file was green and
 * noisy at the same time -- the state in which somebody eventually stops reading the output.
 */
async function refusedToStart(engine: StockfishClient) {
  const started = engine.start();
  const rejected = expect(started).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(61_000);
  await rejected;
}

describe("an engine that gave up once", () => {
  it("fails when the engine never arrives, which is the honest end of a download that did not finish", async () => {
    const { factory } = engineFactory();
    const engine = client(factory);
    await refusedToStart(engine);
    /* The player is told what did not happen, and the sentence names the size rather than blaming them. */
    expect(statuses.at(-1)?.mode).toBe("error");
    expect(statuses.at(-1)?.detail).toContain("5.6MB");
  });

  it("TRIES AGAIN, building a new worker, which is the whole of R-09", async () => {
    /*
     * THE GATE. Before this, the second `start()` returned the first one's rejected promise: no
     * worker, no request, no wait — an instant failure that looked exactly like the network being
     * broken a second time. A player on a slow connection could press the button all day.
     */
    const { factory, built, connect } = engineFactory();
    const engine = client(factory);

    await refusedToStart(engine);
    expect(built, "the first attempt did not build a worker").toHaveLength(1);

    connect(); // the link recovered, or the player is on wifi now
    await expect(engine.start()).resolves.toBeUndefined();
    expect(built, "the retry reused the dead attempt instead of starting a new one").toHaveLength(2);
    expect(built[1].posted).toContain("uci");
  });

  it("terminates the worker it gave up on, so a late download cannot arrive into nothing", async () => {
    /*
     * A slow worker is not a dead one. Left running, its wasm keeps downloading into a worker
     * nobody is listening to — competing for the bandwidth the retry needs, on exactly the
     * connection that was already too slow.
     */
    const { factory, built } = engineFactory();
    const engine = client(factory);
    await refusedToStart(engine);
    expect(built[0].terminated, "the abandoned worker was left running").toBe(true);
  });

  it("does not give up before the download plausibly could have finished", async () => {
    /*
     * The threshold, asserted at the only two points that matter rather than at its exact value:
     * 15 s must NOT be enough to fail (that was the old bound, and 5.6 MB does not fit through a
     * mobile link in 15 s), and the client must not wait forever either.
     */
    const { factory } = engineFactory();
    const engine = client(factory);
    let settled = false;
    const first = engine.start();
    const rejected = expect(first).rejects.toThrow();
    void first.catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(20_000);
    expect(settled, "gave up while the engine could still plausibly be downloading").toBe(false);

    await vi.advanceTimersByTimeAsync(45_000);
    await rejected;
  });

  it("still returns ONE promise while a start is in flight, so a scan does not race itself", async () => {
    /*
     * The property the cache was there for, and it is kept. `runImportDiagnostic` calls `analyze`
     * for every position of every game; if each call built its own worker the first scan would
     * fetch the engine hundreds of times.
     */
    const { factory, built, connect } = engineFactory();
    connect();
    const engine = client(factory);
    const [a, b] = [engine.start(), engine.start()];
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all([a, b]);
    expect(built).toHaveLength(1);
    expect(a).toBe(b);
  });

  it("keeps a READY client cached, so success is not re-fetched either", async () => {
    const { factory, built, connect } = engineFactory();
    connect();
    const engine = client(factory);
    await engine.start();
    await engine.start();
    await engine.start();
    expect(built, "a ready engine was rebuilt").toHaveLength(1);
  });
});
