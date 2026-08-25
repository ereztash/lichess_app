/**
 * The oracle, and the day it called the engine's own best move a mistake.
 *
 * Centipawn loss used to be a root search minus a search of the position the move PRODUCED. Those
 * are not the same measurement. The child at depth d looks d plies ahead from one ply further
 * along -- a depth d+1 view of the root -- and alpha-beta is parity-sensitive, so the two scores
 * come off different horizons.
 *
 * MEASURED against Stockfish 18 on 110 real positions, with the zero control a sound oracle must
 * pass: take the engine's OWN BEST MOVE at depth 14, and see what the arithmetic charges for it.
 *
 *     root minus child        mean  9.0cp   p90 23   max 159    7.3% scored "inaccurate"
 *     second root search      mean 12.0cp   p90 32   max 228   12.7% scored "inaccurate"
 *     ONE MultiPV search      exactly 0, 110 of 110, by construction
 *
 * The middle row is a route that was tried and abandoned: restricting a second ROOT search to the
 * one move with UCI `searchmoves` looks equivalent to the third and is not. With no sibling moves
 * there are no cutoffs from them, so the window differs -- and it came out worse than the method
 * it was meant to replace, on every statistic. It is recorded here because it is the obvious idea
 * and someone will have it again.
 *
 * The third row is not a smaller error. Both scores come out of the same tree, same window, same
 * iteration, so `best - best` is zero as arithmetic rather than as a measurement. The defect
 * cannot recur without this file changing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MATE_SCORE } from "@/lib/engine-line";
import type { EngineLine } from "@/lib/engine-line";
import { REVEAL_MULTIPV, cpLossFromMultiPv } from "@/lib/decision-session";

const root = resolve(__dirname, "../..");
const code = (path: string) =>
  readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A MultiPV line: the move it starts with, and what the engine scored it. */
const line = (move: string, scoreCp: number, mate?: number): EngineLine => ({
  scoreCp,
  ...(mate === undefined ? {} : { mate }),
  depth: 14,
  pv: [move],
  bestMove: move,
  fen: FEN,
});

describe("the engine's own best move is charged nothing", () => {
  it("returns exactly zero for line 1, whatever the position is worth", () => {
    /*
     * The zero control, as arithmetic. Both operands are the same line out of the same search, so
     * this is `x - x` and there is no horizon for the two sides to disagree about. Measured
     * against real Stockfish it held 110 times out of 110; here it holds by construction.
     */
    for (const score of [-950, -30, 0, 12, 480]) {
      const lines = [line("e2e4", score), line("d2d4", score - 40)];
      expect(cpLossFromMultiPv(lines, "e2e4"), `best move charged for a ${score}cp position`).toBe(0);
    }
  });

  it("charges a worse move exactly what the same search said it costs", () => {
    const lines = [line("e2e4", 30), line("d2d4", 12), line("g1f3", -55)];
    expect(cpLossFromMultiPv(lines, "d2d4")).toBe(18);
    expect(cpLossFromMultiPv(lines, "g1f3")).toBe(85);
  });

  it("never returns a negative loss", () => {
    // MultiPV returns lines in order, so line 2 should never outscore line 1 -- but a search that
    // was cut short can report them out of order, and a negative loss is not a thing that exists.
    const outOfOrder = [line("e2e4", 10), line("d2d4", 60)];
    expect(cpLossFromMultiPv(outOfOrder, "d2d4")).toBe(0);
  });
});

describe("a mate line is not ten thousand centipawns of loss", () => {
  it("compares mates through the same clamp the rest of the record uses", () => {
    /*
     * `scoreCp` on a mate line is the mate distance, not centipawns. Comparing the raw field
     * scored the FASTEST mate available as a 10,000-centipawn blunder. `comparableCp` is what
     * makes that unrepresentable, and it has to be reached from here too.
     */
    const mateInTwo = line("d1h5", 2, 2);
    const mateInNine = line("f1c4", 9, 9);
    expect(cpLossFromMultiPv([mateInTwo, mateInNine], "f1c4")).toBe(0);
    expect(cpLossFromMultiPv([mateInTwo, mateInNine], "d1h5")).toBe(0);
  });

  it("charges a quiet move the whole distance to a mate that was available", () => {
    const lines = [line("d1h5", 3, 3), line("a2a3", 40)];
    expect(cpLossFromMultiPv(lines, "a2a3")).toBe(MATE_SCORE - 40);
  });
});

describe("when the move is not in the lines, it says so", () => {
  it("returns null rather than guessing", () => {
    /*
     * Measured at 10% of real played moves at MultiPV 8. Null is what lets the caller fall back
     * to the old arithmetic there, which is safe for a specific reason: a move worse than the
     * eighth-best is nowhere near the 30cp threshold, so a 10cp instrument error cannot change
     * whether it reads as accurate. The covered 90% is exactly the region where it could.
     */
    const lines = [line("e2e4", 30), line("d2d4", 12)];
    expect(cpLossFromMultiPv(lines, "h2h4")).toBeNull();
  });

  it("returns null on an empty or unevaluated search rather than scoring it zero", () => {
    // R2. A timed-out search resolves with an empty line, and reading that as 0.00 is how a
    // position nothing measured turns into a decision that looks measured.
    expect(cpLossFromMultiPv([], "e2e4")).toBeNull();
    const empty: EngineLine = { scoreCp: 0, depth: 0, pv: [], fen: FEN };
    expect(cpLossFromMultiPv([empty], "e2e4")).toBeNull();
    /*
     * The case that isolates the BEST-line guard. `[empty]` alone is already caught by the
     * chosen-move lookup, so it cannot tell whether line 1 is being checked at all -- an earlier
     * version of this test asserted only that and a mutation removing the guard survived it.
     * Here line 1 is unevaluated while the chosen move IS found: without the guard, `comparableCp`
     * reads the empty line as a dead-level 0.00 and the loss comes back as a confident zero.
     */
    expect(
      cpLossFromMultiPv([empty, line("e2e4", 20)], "e2e4"),
      "an unevaluated best line was read as 0.00",
    ).toBeNull();
    expect(cpLossFromMultiPv([line("e2e4", 20), empty], "e2e4")).toBe(0);
  });

  it("asks for enough lines to cover most real moves", () => {
    // 8 was measured, not chosen: the player's actual move was among the lines 90% of the time.
    expect(REVEAL_MULTIPV).toBeGreaterThanOrEqual(8);
  });
});

describe("the reveal reads one root search, and only then falls back", () => {
  const home = code("client/src/pages/Home.tsx");

  it("takes the best line from the MultiPV search rather than searching twice", () => {
    /*
     * Line 1 of the MultiPV search IS the best line, so this replaced the single-line `analyze`
     * rather than joining it. When the move is covered a reveal now costs ONE search where it
     * used to cost two.
     */
    expect(home).toMatch(/analyzeAlternatives\(positionFen, 14, REVEAL_MULTIPV\)/);
    expect(home, "the root is still being searched a second time").not.toMatch(
      /engine\.analyze\(positionFen/,
    );
    expect(home).toMatch(/const best = rootLines\[0\]/);
  });

  it("searches the child position only when the move was not in the lines", () => {
    expect(home).toMatch(/fromMultiPv === null[\s\S]{0,80}engine\.analyze\(after\.fen\(\)/);
  });

  it("prefers the same-search number whenever it has one", () => {
    expect(home).toMatch(/fromMultiPv \?\? cpLossFromSearches\(best, chosen!\)/);
  });

  it("does not reach for a second root search restricted to one move", () => {
    // The measured-worse route. `searchmoves` is not in the engine client and must not come back
    // without the control being re-run: it scored 12.7% "inaccurate" against the old 7.3%.
    expect(code("client/src/lib/stockfish.ts")).not.toMatch(/searchmoves/);
  });
});
