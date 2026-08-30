/**
 * The blitz core's clock, and the properties that stop it being wrong in the player's favour.
 *
 * Time is an argument here, so none of this sleeps and none of it asserts "about five seconds".
 * Every reading is exact, which is what lets the interesting cases -- a throttled tab, a move made
 * after the flag, an increment applied twice -- be stated as equalities rather than tolerances.
 */
import { describe, expect, it } from "vitest";
import {
  commit,
  hasFlagged,
  newGame,
  observe,
  playable,
  remainingMs,
  resign,
  start,
  type BlitzState,
  type RequiredTimeControl,
} from "@shared/blitz-game-core";
import { NO_TIME_CONTROL } from "@shared/pgn-clock";

const THREE_ZERO: RequiredTimeControl = { initialMs: 180_000, incrementMs: 0 };
const THREE_TWO: RequiredTimeControl = { initialMs: 180_000, incrementMs: 2_000 };

/** A game already running, with the clock started at t = 1000. */
const running = (tc = THREE_ZERO) => start(newGame(tc), 1_000);

const e4 = { from: "e2", to: "e4" };
const e5 = { from: "e7", to: "e5" };

describe("a clock that cannot be fooled", () => {
  it("refuses a time control a game cannot actually be played on", () => {
    expect(playable(NO_TIME_CONTROL)).toBeNull();
    expect(playable({ initialMs: 0, incrementMs: 0 })).toBeNull();
    expect(playable({ initialMs: 180_000, incrementMs: 0 })).toEqual(THREE_ZERO);
  });

  it("does not run anybody's clock before the game starts", () => {
    const ready = newGame(THREE_ZERO);
    expect(remainingMs(ready, "w", 999_999)).toBe(180_000);
    expect(remainingMs(ready, "b", 999_999)).toBe(180_000);
  });

  it("drains only the side to move", () => {
    const g = running();
    expect(remainingMs(g, "w", 6_000)).toBe(175_000); // five seconds gone
    expect(remainingMs(g, "b", 6_000)).toBe(180_000); // untouched
  });

  it("computes the remaining time rather than accumulating it, so a throttled tab loses nothing", () => {
    /*
     * THE PROPERTY THAT MATTERS MOST. A backgrounded tab throttles timers to once a second or less.
     * A clock built by subtracting a fixed amount per tick stops draining exactly when nobody is
     * looking -- the player gets free time, and the record says they thought for four seconds when
     * they thought for forty.
     *
     * Here NO tick happened between t=1000 and t=41000 and the answer is still exactly forty
     * seconds, because the reading is a subtraction of two marks and not a running total.
     */
    const g = running();
    expect(remainingMs(g, "w", 41_000)).toBe(140_000);
  });

  it("freezes the think time at the commit, and the clock at what the player FACED", () => {
    const { state, accepted } = commit(running(), e4, 5_000);
    expect(accepted).toBe(true);
    if (state.phase !== "running") throw new Error("still running");
    const d = state.decisions[0];
    expect(d.thinkMs).toBe(4_000); // t=1000 to t=5000
    expect(d.clockBeforeMs).toBe(180_000); // the clock as faced, not what is left
    expect(d.opponentClockBeforeMs).toBe(180_000);
    expect(d.san).toBe("e4");
  });

  it("applies the increment exactly once, at the commit and nowhere else", () => {
    const first = commit(running(THREE_TWO), e4, 5_000).state;
    // 180 - 4 spent + 2 increment = 178
    expect(remainingMs(first, "w", 5_000)).toBe(178_000);
    // ...and it does not creep afterwards while the opponent thinks.
    expect(remainingMs(first, "w", 60_000)).toBe(178_000);
    const second = commit(first, e5, 9_000).state;
    expect(remainingMs(second, "b", 9_000)).toBe(178_000); // 180 - 4 + 2, same arithmetic
    expect(remainingMs(second, "w", 9_000)).toBe(178_000); // white still untouched
  });

  it("never lets a clock grow except by a legal increment", () => {
    /*
     * The property test the plan asks for, stated over a whole game rather than one move. Without
     * an increment a clock may only ever fall.
     */
    let g: BlitzState = running(THREE_ZERO);
    let previous = 180_000;
    const moves = [e4, e5, { from: "g1", to: "f3" }, { from: "b8", to: "c6" }];
    let t = 2_000;
    for (const move of moves) {
      const before = remainingMs(g, g.phase === "running" ? g.active : "w", t);
      g = commit(g, move, t).state;
      expect(before).toBeLessThanOrEqual(previous);
      previous = 180_000;
      t += 3_000;
    }
    if (g.phase !== "running") throw new Error("should still be running");
    expect(remainingMs(g, "w", t)).toBeLessThan(180_000);
    expect(remainingMs(g, "b", t)).toBeLessThan(180_000);
  });

  describe("the flag, which is a computation and not an event", () => {
    it("is true the instant the clock crosses zero, whether or not anybody asked", () => {
      const g = running();
      expect(hasFlagged(g, 180_000)).toBe(false); // 1000 + 179000 still has a millisecond
      expect(hasFlagged(g, 181_000)).toBe(true);
      expect(hasFlagged(g, 999_999)).toBe(true);
    });

    it("ends the game when a hidden tab comes back long after the clock ran out", () => {
      // No tick fired for ten minutes. The game is over, and it was over at 181_000.
      const ended = observe(running(), 600_000);
      expect(ended.phase).toBe("finished");
      if (ended.phase !== "finished") throw new Error("unreachable");
      expect(ended.outcome).toEqual({ kind: "flag", loser: "w" });
    });

    it("beats a move, so a player cannot win by clicking after their own flag", () => {
      const { state, accepted } = commit(running(), e4, 300_000);
      expect(accepted).toBe(false);
      expect(state.phase).toBe("finished");
      if (state.phase !== "finished") throw new Error("unreachable");
      expect(state.outcome).toEqual({ kind: "flag", loser: "w" });
      expect(state.decisions).toHaveLength(0); // the move was never recorded
    });

    it("is idempotent, so a render loop may ask as often as it likes", () => {
      const once = observe(running(), 600_000);
      expect(observe(once, 700_000)).toBe(once);
    });
  });

  it("rejects an illegal move without ending the game or moving a clock", () => {
    const g = running();
    const { state, accepted } = commit(g, { from: "e2", to: "e5" }, 5_000);
    expect(accepted).toBe(false);
    expect(state).toBe(g); // untouched, not a new state that merely looks the same
    expect(remainingMs(state, "w", 5_000)).toBe(176_000); // the clock kept running, as it should
  });

  it("ends on checkmate, with the loser named", () => {
    let g: BlitzState = start(newGame(THREE_ZERO), 0);
    for (const [i, m] of [
      { from: "f2", to: "f3" },
      { from: "e7", to: "e5" },
      { from: "g2", to: "g4" },
      { from: "d8", to: "h4" },
    ].entries()) {
      g = commit(g, m, (i + 1) * 1_000).state;
    }
    expect(g.phase).toBe("finished");
    if (g.phase !== "finished") throw new Error("unreachable");
    expect(g.outcome).toEqual({ kind: "checkmate", loser: "w" });
    expect(g.decisions).toHaveLength(4); // the record survives the ending
  });

  it("accepts a resignation and refuses everything afterwards", () => {
    const done = resign(running(), "b");
    expect(done.phase).toBe("finished");
    expect(commit(done, e4, 5_000).accepted).toBe(false);
    expect(observe(done, 999_999)).toBe(done);
  });

  it("knows nothing about engines, calibration or claims", () => {
    /*
     * The structural claim, checked against the source. INV-3 says a committed move advances the
     * board without awaiting any engine, and the cheapest guarantee is a module with no way to call
     * one -- not a rule somebody has to keep remembering while editing it.
     */
    const text = require("node:fs").readFileSync(
      new URL("../../shared/blitz-game-core.ts", import.meta.url),
      "utf8",
    ) as string;
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const forbidden of ["stockfish", "engine", "analyze", "confidence", "claim", "await", "async"]) {
      expect(code.toLowerCase(), `the game core must not mention ${forbidden}`).not.toContain(
        forbidden,
      );
    }
  });
});
