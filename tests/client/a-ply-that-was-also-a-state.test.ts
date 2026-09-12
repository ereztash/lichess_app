/**
 * `-1` MEANT TWO THINGS, AND THE REAL ONE LOST.
 *
 * `continuationAfter` took the reveal's ply as a number and read any negative value as "no reveal
 * is open". `runReveal` is handed `positionPly = currentPly`, and `currentPly` is `-1` on a board
 * with an empty history, which is every game `newGame` deals. So the opening decision of a live
 * game -- the first decision anybody takes in a game against the engine -- produced `-1`, the
 * sentinel swallowed it, and the reveal offered no continuation.
 *
 * WHAT THAT COST. A live game that cannot advance past its opening decision can only ever record
 * `first`, because `play` is what `decisionPurposeFor` returns for a live decision that is NOT the
 * game's first -- and `shared/evidence-policy.ts` refuses `first` from `discovery`. The counter the
 * record page shows as `0 מתוך 60 החלטות שהחיפוש הזה סופר` could not be moved by the default route
 * into a live game at all.
 *
 * THE FIRST ASSERTION BELOW IS THE REGRESSION, and it reads oddly on purpose: ply `-1` with a
 * reveal open is a real reveal about a real position, and the function must say so.
 *
 * WALKED FIRST, TESTED SECOND. The defect was found in Chromium on the built bundle, by starting a
 * game through `משחק חדש`, committing the opening decision and finding the reveal had no way on.
 * `tests/layout/a-live-game-that-can-reach-its-second-decision.layout.test.ts` holds that walk;
 * this file holds the truth table underneath it.
 */
import { describe, expect, it } from "vitest";
import { continuationAfter } from "@/lib/continuation";
import type { GameSnapshot } from "@/lib/game-data";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const snapshot = (ply: number, fen: string): GameSnapshot => ({
  ply,
  san: "e4",
  from: "e2",
  to: "e4",
  color: ply % 2 === 0 ? "w" : "b",
  fen,
});

describe("a ply that was also a state", () => {
  it("continues a live game whose opening decision was taken at ply -1", () => {
    expect(continuationAfter({ source: "live", history: [], revealPly: -1 })).toEqual({
      kind: "play",
    });
  });

  it("says nothing continues when no reveal is open, whatever the board holds", () => {
    expect(continuationAfter({ source: "live", history: [], revealPly: null })).toBeNull();
    expect(
      continuationAfter({
        source: "finished",
        history: [snapshot(0, START), snapshot(1, START), snapshot(2, START)],
        revealPly: null,
      }),
    ).toBeNull();
  });

  it("still advances a loaded game along itself rather than forking it", () => {
    const history = [0, 1, 2, 3].map((ply) => snapshot(ply, START));
    expect(continuationAfter({ source: "finished", history, revealPly: 1 })).toEqual({
      kind: "advance",
      ply: 3,
    });
  });

  it("still answers null when a loaded game holds no position two plies on", () => {
    expect(
      continuationAfter({ source: "imported", history: [snapshot(0, START)], revealPly: 0 }),
    ).toBeNull();
  });
});
