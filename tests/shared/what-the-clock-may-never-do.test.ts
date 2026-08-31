/**
 * The clock's invariants, asserted over hundreds of randomised games rather than a few examples.
 *
 * WHY PROPERTIES AND NOT MORE CASES. The example tests beside this file pin down the arithmetic of
 * one move at one time control. What they cannot do is catch a rule that holds for the first move
 * and breaks on the fortieth, or one that holds at 3+0 and not at 5+5, or one that depends on how
 * many times a renderer happened to ask. Those are the shapes a clock bug actually takes, and they
 * are found by playing a lot of games and checking the same five things after every single move.
 *
 * DETERMINISTIC, so a failure is reproducible from the seed printed in the assertion rather than
 * "it went red once on CI".
 */
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  commit,
  hasFlagged,
  newGame,
  observe,
  remainingMs,
  start,
  type BlitzState,
  type RequiredTimeControl,
} from "@shared/blitz-game-core";

const CONTROLS: Record<string, RequiredTimeControl> = {
  "3+0": { initialMs: 180_000, incrementMs: 0 },
  "3+2": { initialMs: 180_000, incrementMs: 2_000 },
  "5+0": { initialMs: 300_000, incrementMs: 0 },
  "5+5": { initialMs: 300_000, incrementMs: 5_000 },
};

/** A small deterministic PRNG, so every failure carries a seed that reproduces it. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Plays randomly until the game ends or `maxPlies` is reached, checking the rules after each move. */
function playChecked(seed: number, tc: RequiredTimeControl, maxPlies: number) {
  const random = rng(seed);
  let state: BlitzState = start(newGame(tc), 0);
  let now = 0;

  for (let i = 0; i < maxPlies && state.phase === "running"; i += 1) {
    const before = state;
    const mover = before.active;
    const opponent = mover === "w" ? "b" : "w";
    const board = new Chess(before.fen);
    const legal = board.moves({ verbose: true });
    if (legal.length === 0) break;
    const pick = legal[Math.floor(random() * legal.length)];

    /* Think times that stay well inside the clock, so the flag path is exercised elsewhere. */
    const think = Math.floor(random() * 4_000) + 1;
    now += think;

    /*
     * A RENDERER ASKING, REPEATEDLY, BEFORE THE MOVE. Zero to five `observe` calls and a handful of
     * `remainingMs` reads, which is what a live UI does between two moves. None of them may change
     * anything: the authoritative clock is a subtraction of two marks, not a running total, so the
     * number of times somebody looked at it is not part of the answer.
     */
    const ticks = Math.floor(random() * 6);
    let observed: BlitzState = before;
    for (let t = 0; t < ticks; t += 1) {
      observed = observe(observed, now);
      remainingMs(observed, "w", now);
      remainingMs(observed, "b", now);
    }
    expect(observed, `seed ${seed}: ${ticks} observations changed the state`).toBe(before);

    const result = commit(before, { from: pick.from, to: pick.to, promotion: "q" }, now);
    if (!result.accepted) break;
    state = result.state;
    if (state.phase !== "running" && state.phase !== "finished") break;
    const after = state as Extract<BlitzState, { decisions: unknown[] }>;
    const recorded = after.decisions[after.decisions.length - 1];

    // 1. The mover's elapsed time is deducted exactly once, and the increment added exactly once.
    expect(
      after.clocksAtTurnStart[mover],
      `seed ${seed} ply ${i}: the mover's clock is not before - think + increment`,
    ).toBe(before.clocksAtTurnStart[mover] - recorded.thinkMs + tc.incrementMs);

    // 2. The inactive player's clock did not move at all.
    expect(
      after.clocksAtTurnStart[opponent],
      `seed ${seed} ply ${i}: the opponent's clock moved on somebody else's turn`,
    ).toBe(before.clocksAtTurnStart[opponent]);

    // 3. Without an increment a clock may only ever fall.
    if (tc.incrementMs === 0) {
      expect(after.clocksAtTurnStart[mover]).toBeLessThanOrEqual(before.clocksAtTurnStart[mover]);
    }

    // 4. A clock may never exceed the start by more than the increments actually earned.
    const movesBy = after.decisions.filter((d) => d.side === mover).length;
    expect(after.clocksAtTurnStart[mover]).toBeLessThanOrEqual(
      tc.initialMs + movesBy * tc.incrementMs,
    );

    // 5. Every decision already recorded is byte-identical to what it was. A commit freezes.
    expect(
      after.decisions.slice(0, -1),
      `seed ${seed} ply ${i}: an earlier decision changed after being committed`,
    ).toEqual(before.decisions);
  }
  return state;
}

/**
 * WHAT THIS COSTS, AND WHY THE TIMEOUT IS NAMED RATHER THAN DEFAULTED.
 *
 * Each case plays 40 games of up to 40 plies through the real `chess.js` move generator and checks
 * five invariants after every move -- about 4.2 seconds on a developer machine, measured. Vitest's
 * default is 5 seconds, which left 0.7s of headroom, and a full parallel run consumed it: this file
 * timed out twice in one afternoon on a machine where it passes in 4.2s when run alone.
 *
 * THE ALTERNATIVE WAS FEWER SEEDS, AND THAT IS THE WRONG FIX. The whole argument for this file is
 * in its opening note -- example tests cannot catch a rule that holds for the first move and breaks
 * on the fortieth, and they are found by playing a lot of games. Trading seeds for wall-clock would
 * buy a green run by removing the thing the file is for.
 *
 * 30 SECONDS IS ABOUT SEVEN TIMES THE MEASURED COST. It is not a licence for the case to grow into
 * it: a run that starts taking twenty seconds is a regression in the clock's own arithmetic, and
 * the number is here so somebody notices that rather than raising it again.
 */
const PROPERTY_TIMEOUT_MS = 30_000;

describe("what the clock may never do", () => {
  for (const [name, tc] of Object.entries(CONTROLS)) {
    it(
      `holds every rule across 40 randomised games at ${name}`,
      () => {
        for (let seed = 1; seed <= 40; seed += 1) playChecked(seed, tc, 40);
      },
      PROPERTY_TIMEOUT_MS,
    );
  }

  it("gives the same reading however many times it is asked, and in any order", () => {
    /*
     * "Slow rendering" and "rapid multiple UI ticks" from the manual matrix, as an equality. A
     * clock that accumulated per call would drift by exactly the number of calls -- the bug would
     * be invisible on a fast machine and severe on a slow one, which is the worst way for a bug to
     * be distributed across users.
     */
    const g = start(newGame(CONTROLS["5+0"]), 0);
    const once = remainingMs(g, "w", 12_345);
    for (let i = 0; i < 500; i += 1) {
      remainingMs(g, "b", 999);
      remainingMs(g, "w", 40_000);
      observe(g, 1);
    }
    expect(remainingMs(g, "w", 12_345)).toBe(once);
  });

  it("accepts a move with a millisecond left and refuses one with none", () => {
    // The boundary, from both sides. 300000 - 299999 = 1ms remains, which is a move.
    const g = start(newGame(CONTROLS["5+0"]), 0);
    const justInTime = commit(g, { from: "e2", to: "e4" }, 299_999);
    expect(justInTime.accepted).toBe(true);
    expect(remainingMs(justInTime.state, "w", 299_999)).toBe(1);

    const justTooLate = commit(g, { from: "e2", to: "e4" }, 300_000);
    expect(justTooLate.accepted).toBe(false);
    expect(hasFlagged(g, 300_000)).toBe(true);
  });

  it("ends a game by insufficient material as a draw, not as a flag", () => {
    /*
     * The draw case the manual matrix asks for. Two bare kings: the game is over on the position,
     * and the clock -- which still had time on it -- must not be what ends it.
     */
    // White Ke2 and Rh4, black Ke5. The rook steps to f4, where the black king can take it, and
    // two bare kings cannot mate: chess.js reports insufficient material.
    let g: BlitzState = start(newGame(CONTROLS["3+0"], "8/8/8/4k3/7R/8/4K3/8 w - - 0 1"), 0);
    g = commit(g, { from: "h4", to: "f4" }, 1_000).state;
    g = commit(g, { from: "e5", to: "f4" }, 2_000).state; // Kxf4: bare kings
    expect(g.phase).toBe("finished");
    if (g.phase !== "finished") throw new Error("unreachable");
    expect(g.outcome).toEqual({ kind: "draw", reason: "insufficient" });
    expect(remainingMs(g, "w", 2_000)).toBeGreaterThan(0); // nobody flagged
  });
});
