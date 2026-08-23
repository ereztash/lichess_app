/**
 * Evaluating a whole game with the local engine.
 *
 * The load-bearing assertion here is the perspective conversion. UCI reports `score cp` from the
 * side to move, and evalScores is White-relative throughout; CPL is a signed difference between
 * consecutive entries, so an inverted sign does not make the numbers slightly wrong -- it turns
 * every blunder into a best move. Everything else in this file is scaffolding around that.
 */
import { describe, expect, it, vi } from "vitest";
import {
  MATE_SCORE,
  analyzeGame,
  analyzePositions,
  gamePositions,
  toWhitePerspective,
} from "../../client/src/lib/batch-analysis";
import { analyzeEval } from "../../shared/eval-analysis";
import type { EngineLine } from "../../client/src/lib/engine-line";
import { PROGRESS_INTERVAL_MS } from "../../client/src/lib/progress-throttle";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

const line = (over: Partial<EngineLine>): EngineLine => ({
  scoreCp: 0, depth: 12, pv: [], fen: START, ...over,
});

describe("perspective", () => {
  it("keeps the sign when White is to move", () => {
    expect(toWhitePerspective(line({ scoreCp: 55 }), START)).toBe(55);
  });

  it("flips the sign when Black is to move", () => {
    // +55 for Black to move is -55 for White. This is the whole point.
    expect(toWhitePerspective(line({ scoreCp: 55 }), AFTER_E4)).toBe(-55);
  });

  it("reads the side to move from the FEN, not from the caller", () => {
    const withWhite = toWhitePerspective(line({ scoreCp: 30 }), START);
    const withBlack = toWhitePerspective(line({ scoreCp: 30 }), AFTER_E4);
    expect(withWhite).toBe(-withBlack);
  });

  it("encodes mate as ±10000, also flipped", () => {
    expect(toWhitePerspective(line({ mate: 3, scoreCp: 0 }), START)).toBe(MATE_SCORE);
    expect(toWhitePerspective(line({ mate: 3, scoreCp: 0 }), AFTER_E4)).toBe(-MATE_SCORE);
    expect(toWhitePerspective(line({ mate: -2, scoreCp: 0 }), START)).toBe(-MATE_SCORE);
  });
});

describe("positions", () => {
  it("starts before anyone has moved, so evalScores[0] is the initial position", () => {
    const fens = gamePositions("1. e4 e5 2. Nf3 *");
    expect(fens).toHaveLength(4); // start + 3 half-moves
    expect(fens[0]).toBe(START);
    expect(fens[1].split(" ")[1]).toBe("b"); // after White's move it is Black to play
    expect(fens[2].split(" ")[1]).toBe("w");
  });
});

describe("running the engine over a game", () => {
  it("produces one score per position, and every position when asked for every position", async () => {
    const seen: number[] = [];
    const scores = await analyzeGame("1. e4 e5 2. Nf3 Nc6 *", async () => line({ scoreCp: 20 }), {
      onProgress: (p) => seen.push(p.done),
      progressIntervalMs: 0,
    });
    expect(scores).toHaveLength(5);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it("stops when aborted and keeps what it already measured", async () => {
    const controller = new AbortController();
    const analyze = vi.fn(async () => line({ scoreCp: 10 }));
    const scores = await analyzePositions(
      gamePositions("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *"),
      analyze,
      {
        signal: controller.signal,
        // Every callback: this test aborts FROM the progress callback, so a throttle that held
        // `done === 2` would swallow the abort and quietly measure the whole game instead.
        progressIntervalMs: 0,
        onProgress: (p) => { if (p.done === 2) controller.abort(); },
      },
    );
    // Aborted work is short, not empty and not fabricated.
    expect(scores).toHaveLength(2);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("announces far fewer times than it measures, by default", async () => {
    /*
     * The reason the default exists. A 971-position import at 45ms a position is 43 seconds of
     * engine time, and one React render per callback puts 971 renders on the same thread the
     * search is running on. The interval is set high here so the assertion does not depend on how
     * fast the machine running it happens to be.
     */
    const seen: number[] = [];
    const fens = gamePositions("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *");
    await analyzePositions(fens, async () => line({ scoreCp: 5 }), {
      onProgress: (p) => seen.push(p.done),
      progressIntervalMs: 60_000,
    });
    expect(fens.length).toBeGreaterThan(5);
    expect(seen.length).toBeLessThan(fens.length);
  });

  it("throttles by default, not only when a caller remembers to ask", async () => {
    /*
     * The control that matters. Every other throttle assertion here passes an explicit interval,
     * so a default quietly reset to 0 would ship 971 renders with the whole suite still green.
     * The clock is injected so this measures the default rather than the test machine.
     */
    const seen: number[] = [];
    let t = 0;
    const fens = gamePositions("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *");
    await analyzePositions(
      fens,
      async () => { t += 45; return line({ scoreCp: 5 }); }, // the measured 45ms per position
      { onProgress: (p) => seen.push(p.done), now: () => t },
    );
    // 9 positions x 45ms is 405ms of engine time: at 200ms that is a handful of updates, not nine.
    expect(seen.length).toBeLessThan(fens.length);
    expect(seen.length).toBeLessThanOrEqual(Math.ceil((fens.length * 45) / PROGRESS_INTERVAL_MS) + 1);
  });

  it("still ends on the true final count", async () => {
    // A bar that stops at 968 of 971 looks broken. The last value always arrives.
    const seen: number[] = [];
    const fens = gamePositions("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *");
    await analyzePositions(fens, async () => line({ scoreCp: 5 }), {
      onProgress: (p) => seen.push(p.done),
      progressIntervalMs: 60_000,
    });
    expect(seen.at(-1)).toBe(fens.length);
  });

  it("starts the bar on the first position rather than an interval later", async () => {
    const seen: number[] = [];
    await analyzePositions(
      gamePositions("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *"),
      async () => line({ scoreCp: 5 }),
      { onProgress: (p) => seen.push(p.done), progressIntervalMs: 60_000 },
    );
    expect(seen[0]).toBe(1);
  });

  it("reports where an aborted run actually stopped", async () => {
    // Throttled AND aborted: the flush has to report 2, not the last value that got through.
    const controller = new AbortController();
    const seen: number[] = [];
    let done = 0;
    const scores = await analyzePositions(
      gamePositions("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *"),
      async () => {
        done += 1;
        if (done === 2) controller.abort();
        return line({ scoreCp: 5 });
      },
      { signal: controller.signal, onProgress: (p) => seen.push(p.done), progressIntervalMs: 60_000 },
    );
    expect(scores).toHaveLength(2);
    expect(seen.at(-1)).toBe(2);
  });

  it("uses a lower depth than a single position, and passes it through", async () => {
    const analyze = vi.fn(async (_f: string, _d: number) => line({}));
    await analyzeGame("1. e4 *", analyze);
    expect(analyze.mock.calls[0][1]).toBe(12);
  });
});

describe("end to end: an engine-scored game reaches eval-analysis", () => {
  it("classifies a real blunder from engine output alone, with no %eval in the PGN", async () => {
    // White is fine, then hangs everything. Scored as the engine would: from the side to move.
    const perPosition: Record<number, Partial<EngineLine>> = {
      0: { scoreCp: 20 },   // start, White to move: +20 white
      1: { scoreCp: -20 },  // after 1.e4, Black to move: -20 black => +20 white
      2: { scoreCp: 15 },   // after 1...e5, White to move: +15 white
      3: { scoreCp: -15 },  // after 2.Nf3, Black to move => +15 white
      4: { scoreCp: 10 },   // after 2...Nc6 => +10 white
      5: { scoreCp: 900 },  // after 3.Bb5?? Black to move at +900 => -900 white: a blunder
    };
    let i = 0;
    const scores = await analyzeGame("1. e4 e5 2. Nf3 Nc6 3. Bb5 *", async (fen) => {
      const l = line({ ...perPosition[i], fen });
      i += 1;
      return l;
    });

    expect(scores).toEqual([20, 20, 15, 15, 10, -900]);

    const analysis = analyzeEval(scores, "w");
    expect(analysis.hasEvals).toBe(true);
    const last = analysis.playerMoveEvals.at(-1);
    expect(last?.classification).toBe("blunder");
    expect(analysis.blunders).toBe(1);
  });
});
