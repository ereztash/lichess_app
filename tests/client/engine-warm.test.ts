/**
 * Warming the worker is not the engine speaking, and this is where that claim is held.
 *
 * MEASURED, six consecutive decisions in a browser, submit -> reveal: 1951ms on the first and a
 * 301ms median on the rest. The 1.65s difference is the worker booting -- 7MB of wasm fetched and
 * instantiated, plus the UCI handshake -- and it lands on the FIRST decision a new player records.
 * Home warms the worker when a move is put on the board so that boot overlaps the read and the
 * confidence instead of following the commit.
 *
 * THE RISK THIS FILE EXISTS FOR. R3 says the engine must not speak before a decision is recorded,
 * and "warm the engine early" is exactly the shape of change that erodes it: one `go` added to the
 * boot path and the product is computing an evaluation of a position the player has not committed
 * to. The protection cannot be a comment. It is asserted here on the messages that actually cross
 * to the worker.
 */
import { describe, expect, it } from "vitest";
import { StockfishClient } from "@/lib/stockfish";

/** A worker that records what was posted to it and answers the handshake. */
function recordingWorker() {
  const posted: string[] = [];
  const worker = {
    posted,
    onmessage: null as null | ((event: { data: string }) => void),
    onerror: null as null | (() => void),
    postMessage(message: string) {
      posted.push(message);
      // Answer only the handshake. A real engine would also stream `info`/`bestmove` in reply to
      // `go`; this one deliberately does not, so a test that expects a search would hang rather
      // than pass on a fake result.
      if (message === "uci") queueMicrotask(() => worker.onmessage?.({ data: "uciok" }));
      if (message === "isready") queueMicrotask(() => worker.onmessage?.({ data: "readyok" }));
    },
    terminate() {},
  };
  return worker;
}

describe("warming boots the worker and computes nothing", () => {
  it("completes without a search ever being requested", async () => {
    const worker = recordingWorker();
    const client = new StockfishClient(() => {}, () => worker as never);

    await client.start();

    // The handshake happened, so the boot cost has genuinely been paid.
    expect(worker.posted, "the worker was never asked to boot").toContain("uci");
  });

  it("posts NO `go` — the one message that would make it an evaluation", async () => {
    const worker = recordingWorker();
    const client = new StockfishClient(() => {}, () => worker as never);

    await client.start();

    /*
     * The load-bearing assertion. `go` is the UCI command that starts a search; everything the
     * reveal shows descends from one. If warming ever posts it, the engine has evaluated a
     * position before the decision was written, and R3 is broken whether or not anything was
     * rendered.
     */
    expect(
      worker.posted.filter((m) => m.startsWith("go")),
      "warming issued a search; the engine is now evaluating before the decision is recorded",
    ).toEqual([]);
  });

  it("sends no position either, so there is nothing it could have searched", async () => {
    // Belt and braces, and a different failure mode: `position fen ...` with no `go` computes
    // nothing today, but it means the worker is holding the undecided position. Warming has no
    // business knowing which position the player is looking at.
    const worker = recordingWorker();
    const client = new StockfishClient(() => {}, () => worker as never);

    await client.start();

    expect(worker.posted.filter((m) => m.startsWith("position"))).toEqual([]);
    expect(worker.posted.filter((m) => m.startsWith("setoption"))).toEqual([]);
  });

  it("is idempotent, so warming twice costs one boot", async () => {
    // Home fires this from an effect. A second boot would be a second 7MB instantiation.
    const worker = recordingWorker();
    const client = new StockfishClient(() => {}, () => worker as never);

    await Promise.all([client.start(), client.start()]);
    await client.start();

    expect(worker.posted.filter((m) => m === "uci")).toHaveLength(1);
  });
});
