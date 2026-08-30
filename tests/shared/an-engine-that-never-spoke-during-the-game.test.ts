/**
 * INV-4: zero engine calls before the game is over. The regression test the plan calls critical.
 *
 * WHAT MAKES THIS TEST NON-VACUOUS, because the obvious version is not. "Assert the spy was called
 * zero times during a game" passes trivially if nothing in the path could ever call it -- which is
 * exactly the shape of assertion this repository has been burned by before, where a control stayed
 * green because it was never able to go red.
 *
 * So the SAME spy is used for both halves. It counts zero while a whole game is played, and then a
 * non-zero number the moment the analyser runs on the finished game. The second half is what proves
 * the first half means anything: the spy works, it would have counted, and during the game there
 * was nothing to count.
 */
import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import {
  commit,
  newGame,
  observe,
  remainingMs,
  resign,
  start,
  type BlitzState,
} from "@shared/blitz-game-core";
import {
  analyseFinishedGame,
  isFinished,
  movetext,
  positionsToScore,
} from "@shared/blitz-post-game";

const THREE_ZERO = { initialMs: 180_000, incrementMs: 0 };

/** Scholar's mate: a complete game, ending on the position rather than on the clock. */
const SCHOLARS = [
  { from: "e2", to: "e4" },
  { from: "e7", to: "e5" },
  { from: "f1", to: "c4" },
  { from: "b8", to: "c6" },
  { from: "d1", to: "h5" },
  { from: "g8", to: "f6" },
  { from: "h5", to: "f7" },
];

function playWholeGame(onEachStep?: (state: BlitzState) => void): BlitzState {
  let g: BlitzState = start(newGame(THREE_ZERO), 0);
  let t = 0;
  for (const move of SCHOLARS) {
    t += 3_000;
    /* What a live UI does between moves: look at the clock, notice nothing, render. */
    g = observe(g, t);
    remainingMs(g, "w", t);
    remainingMs(g, "b", t);
    onEachStep?.(g);
    g = commit(g, move, t).state;
    onEachStep?.(g);
  }
  return g;
}

describe("an engine that never spoke during the game", () => {
  it("makes ZERO calls while a whole game is played, and then makes them all at once", async () => {
    const engine = vi.fn(async (_fen: string) => 20);

    const finished = playWholeGame(() => {
      // Asserted at EVERY step, not only at the end: a single call anywhere fails here.
      expect(engine).not.toHaveBeenCalled();
    });

    expect(isFinished(finished)).toBe(true);
    expect(engine, "the engine spoke during the game").toHaveBeenCalledTimes(0);

    const analysed = await analyseFinishedGame(finished, engine);
    /*
     * AND NOW IT SPEAKS. This is the half that makes the half above meaningful -- eight positions
     * for seven decisions, so the spy demonstrably counts, and its zero was a real zero.
     */
    expect(engine).toHaveBeenCalledTimes(8);
    expect(Array.isArray(analysed)).toBe(true);
    if (!Array.isArray(analysed)) throw new Error("unreachable");
    expect(analysed).toHaveLength(7);
  });

  it("refuses a game still in progress, rather than scoring it quietly", async () => {
    const engine = vi.fn(async (_fen: string) => 0);
    let g: BlitzState = start(newGame(THREE_ZERO), 0);
    g = commit(g, { from: "e2", to: "e4" }, 2_000).state;

    const result = await analyseFinishedGame(g, engine);
    expect(result).toEqual({ refused: "game-not-finished" });
    // The refusal is not a slow yes: the engine was never touched.
    expect(engine).not.toHaveBeenCalled();
  });

  it("names an empty game rather than returning an empty list", async () => {
    /*
     * A resignation before any move. An empty array here would be indistinguishable from "scored
     * nothing because the engine failed", which is a different fact.
     */
    const engine = vi.fn(async (_fen: string) => 0);
    const resigned = resign(start(newGame(THREE_ZERO), 0), "w");
    expect(await analyseFinishedGame(resigned, engine)).toEqual({ refused: "no-decisions" });
    expect(engine).not.toHaveBeenCalled();
  });

  it("asks for one more position than there are decisions, and says so before starting", async () => {
    const finished = playWholeGame();
    if (!isFinished(finished)) throw new Error("unreachable");
    const positions = positionsToScore(finished);
    expect(positions).toHaveLength(finished.decisions.length + 1);
    // The first is the position of the first decision; the last is where the game ended.
    expect(positions[0]).toBe(finished.decisions[0].fenBefore);
    expect(positions[positions.length - 1]).toBe(finished.fen);
  });

  it("flips the sign with the mover, so a loss is a loss for whoever moved", async () => {
    /*
     * Black plays a move that drops the white-relative score, which is GOOD for Black. Scored from
     * the mover's side it must be no loss at all -- the failure this guards is an evaluation
     * convention applied without the flip, which makes every one of Black's best moves look like a
     * blunder and every blunder look like brilliance.
     */
    const finished = playWholeGame();
    if (!isFinished(finished)) throw new Error("unreachable");
    /*
     * The score is 0 with White to move and +100 with Black to move. So EVERY White move takes it
     * from 0 to +100 -- up, which is good for White -- and every Black move takes it from +100 to
     * 0 -- down, which is good for Black. Both sides only ever improve their own position, so a
     * correct scorer charges nobody anything.
     */
    const engine = vi.fn(async (fen: string) => (fen.includes(" w ") ? 0 : 100));
    const analysed = await analyseFinishedGame(finished, engine);
    if (!Array.isArray(analysed)) throw new Error("unreachable");
    for (const d of analysed) {
      expect(d.cpLoss, `${d.side} ${d.san} was charged for a move in its own favour`).toBe(0);
      // The standing is from the MOVER's side: White faced 0, Black faced +100 for White = -100.
      expect(d.standingCp).toBe(d.side === "w" ? 0 : -100);
    }
  });

  it("carries the think time through untouched, because analysis may not revise it", async () => {
    const finished = playWholeGame();
    if (!isFinished(finished)) throw new Error("unreachable");
    const before = finished.decisions.map((d) => d.thinkMs);
    const analysed = await analyseFinishedGame(finished, vi.fn(async () => 0));
    if (!Array.isArray(analysed)) throw new Error("unreachable");
    expect(analysed.map((d) => d.thinkMs)).toEqual(before);
    expect(before.every((ms) => ms === 3_000)).toBe(true);
  });

  it("says nothing rather than zero when the evaluator could not answer", async () => {
    const finished = playWholeGame();
    if (!isFinished(finished)) throw new Error("unreachable");
    const analysed = await analyseFinishedGame(finished, vi.fn(async () => null));
    if (!Array.isArray(analysed)) throw new Error("unreachable");
    for (const d of analysed) {
      expect(d.cpLoss).toBeNull();
      expect(d.standingCp).toBeNull();
    }
  });

  it("reconstructs the movetext from the record rather than keeping a second copy", () => {
    const finished = playWholeGame();
    if (!isFinished(finished)) throw new Error("unreachable");
    const pgn = movetext(finished);
    expect(pgn).toContain("1. e4 e5");
    expect(pgn).toContain("Qxf7#");
    // And it agrees with the position the core arrived at, which is the check that matters.
    expect(new Chess(finished.fen).history()).toEqual([]);
    const replayed = new Chess();
    replayed.loadPgn(pgn);
    expect(replayed.fen()).toBe(finished.fen);
  });
});
