/**
 * THE BUG EVERY TEST IN THIS REPOSITORY WAS FIXTURED NOT TO SEE.
 *
 * `performance.now()` returns a DOUBLE. `commit()` froze the think time as `nowMs - turnStartedAtMs`
 * and `answer()` froze the instrument latency as `nowMs - askedAtMs`, so a real browser produced
 * `3947.6999999999998` where `storedBlitzRecordSchema` requires `z.number().int()`. Every blitz game
 * played in an actual browser was refused on its way to the record.
 *
 * IT WAS INVISIBLE FROM INSIDE THE PRODUCT, which is the part worth keeping in mind. `Blitz.tsx`
 * held the record it had just assembled in component state and rendered the post-game reading from
 * that copy, so the screen showed a complete reading -- headline, event, the lot -- for a game the
 * store had rejected. The sentence beside it read "המשחק עצמו נשמר". Both halves were false, and no
 * screen anywhere in the product could have told the player otherwise.
 *
 * WHY NO TEST CAUGHT IT. Every jsdom suite mocks `performance.now()` to whole milliseconds, because
 * a test that means "the player thought for four seconds" writes `4000`. The layout audit ran a real
 * browser and asserted a post-game CARD, which the screen rendered from its own copy either way. So
 * the one property separating every fixture from reality was the one property the schema checked.
 *
 * WHAT THIS FILE ASSERTS. That the durations this product freezes are whole milliseconds no matter
 * what the clock hands it -- checked through `storedBlitzRecordSchema` itself, which is the thing
 * that did the refusing, rather than through `Number.isInteger`, which would pass a record the store
 * still would not take.
 *
 * THE FIXTURE HAS TO BE ABLE TO FAIL, so `every reading is fractional` is asserted first. A clock
 * that quietly handed out integers would make everything below vacuously green -- which is exactly
 * the state this repository was in before this file existed.
 */
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  commit,
  newGame,
  resign,
  start,
  type BlitzDecision,
  type BlitzState,
  type RequiredTimeControl,
} from "@shared/blitz-game-core";
import { answer, newSession, recordCommitted, type InstrumentSession } from "@shared/blitz-instrument";
import { isFinished } from "@shared/blitz-post-game";
import { isRefusal, storedBlitzRecordSchema, toPendingRecord } from "@shared/blitz-record";
import { durationMs } from "@shared/measured-duration";

const TC: RequiredTimeControl = { initialMs: 180_000, incrementMs: 0 };
const PLAYER = "w" as const;
const SANS = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"];

/**
 * A CLOCK SHAPED LIKE A BROWSER'S, AND DETERMINISTIC.
 *
 * `performance.now()` is a monotonically increasing double with sub-millisecond resolution. The
 * increments here are irrational multiples so that no two readings differ by a whole number and no
 * reading is one -- and monotone, because a clock that went backwards would be testing something
 * else.
 */
function browserClock(): () => number {
  let t = 1_837.4830000000002;
  let step = 0;
  return () => {
    step += 1;
    t += 613.71 + step * Math.SQRT2;
    return t;
  };
}

interface Played {
  game: BlitzState;
  session: InstrumentSession;
  readings: number[];
  /** The reading `start()` was given, and the reading each `commit()` was given. */
  startedAt: number;
  commitsAt: number[];
}

/** Plays the opening above, asking the player how sure they were after every move of their own. */
function playWithFractionalClock(sans: readonly string[] = SANS): Played {
  const now = browserClock();
  const readings: number[] = [];
  const tick = () => {
    const value = now();
    readings.push(value);
    return value;
  };

  const startedAt = tick();
  let game = start(newGame(TC), startedAt);
  let session = newSession();
  const board = new Chess();
  const commitsAt: number[] = [];

  for (const san of sans) {
    const move = board.move(san);
    const at = tick();
    commitsAt.push(at);
    const before = game;
    const result = commit(game, { from: move.from, to: move.to }, at);
    expect(result.accepted, `${san} was refused by the core`).toBe(true);
    game = result.state;
    if (before.phase === "running" && before.active === PLAYER) {
      const committed = lastDecision(game);
      /* `draw: () => 0` asks every time, so the latency path is exercised on every player move. */
      session = recordCommitted(session, committed, at, () => 0);
      session = answer(session, 4, tick());
    }
  }

  return { game: resign(game, PLAYER), session, readings, startedAt, commitsAt };
}

function lastDecision(state: BlitzState): BlitzDecision {
  if (state.phase !== "running" && state.phase !== "finished") throw new Error("no decisions");
  const decisions = (state as { decisions: BlitzDecision[] }).decisions;
  return decisions[decisions.length - 1];
}

function record(played: Played) {
  if (!isFinished(played.game)) throw new Error("the game did not finish");
  return toPendingRecord(played.game, played.session.decisions, {
    gameId: "fractional-1",
    playedAs: PLAYER,
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:04:00.000Z",
    opponent: { kind: "engine", engine: "stockfish", build: "18-lite-single-abc", depth: 4 },
  });
}

describe("a clock that does not tick in whole milliseconds", () => {
  it("hands out readings no fixture in this repository would have produced", () => {
    const { readings } = playWithFractionalClock();
    expect(readings.length).toBeGreaterThan(8);
    expect(readings.every((r) => !Number.isInteger(r)), JSON.stringify(readings.slice(0, 3))).toBe(
      true,
    );
    /*
     * AND THE GAPS ARE FRACTIONAL TOO, which is the property that actually matters: a clock whose
     * readings are fractional but whose DIFFERENCES are whole would leave every duration an integer
     * and this file would prove nothing.
     */
    const gaps = readings.slice(1).map((r, i) => r - readings[i]);
    expect(gaps.every((g) => !Number.isInteger(g))).toBe(true);
    expect(gaps.every((g) => g > 0), "the clock went backwards").toBe(true);
  });

  it("stores the game, which is the whole of it", () => {
    /*
     * THE ONE ASSERTION THIS FILE EXISTS FOR. `saveBlitzGame` refuses on exactly this parse, so a
     * record that fails it is a game that never reached the store -- which is what was happening to
     * every game, every time, in every real browser.
     */
    const pending = record(playWithFractionalClock());
    expect(isRefusal(pending), JSON.stringify(pending)).toBe(false);
    const parsed = storedBlitzRecordSchema.safeParse(pending);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 4))).toBe(true);
  });

  it("keeps the think time whole, because that is the measurement", () => {
    const pending = record(playWithFractionalClock());
    if (isRefusal(pending)) throw new Error(`refused: ${pending.refused}`);
    expect(pending.decisions.length).toBeGreaterThan(0);
    for (const d of pending.decisions) {
      expect(Number.isInteger(d.thinkMs), `ply ${d.ply} think time ${d.thinkMs}`).toBe(true);
      expect(d.thinkMs).toBeGreaterThan(0);
    }
  });

  it("keeps the instrument's own cost whole, and separate", () => {
    /*
     * `instrumentationLatencyMs` is the second duration this product freezes and it failed the same
     * way -- but only on the 15% of moves where the question fires, so it would have looked like a
     * flake rather than a defect. It is asked on every move here.
     */
    const pending = record(playWithFractionalClock());
    if (isRefusal(pending)) throw new Error(`refused: ${pending.refused}`);
    const latencies = pending.decisions.map((d) => d.instrumentationLatencyMs);
    expect(latencies.every((l) => l !== null)).toBe(true);
    for (const l of latencies) {
      expect(Number.isInteger(l), `latency ${l}`).toBe(true);
    }
    /* Still its own field. Nothing here adds it to the think time and nothing ever may. */
    expect(pending.decisions.every((d) => d.thinkMs !== d.instrumentationLatencyMs)).toBe(true);
  });

  it("keeps both clocks whole, so a rounded think time cannot desynchronise them", () => {
    /*
     * WHY THE ROUNDING IS AT THE COMMIT AND NOT AT THE STORE. The same `elapsed` is frozen into the
     * decision and subtracted from the mover's clock. Round only the stored copy and the record says
     * a player spent 3948ms on a move their own clock says cost 3947.7 -- two numbers for one event,
     * which is the shape of defect this product exists to not have.
     */
    const pending = record(playWithFractionalClock());
    if (isRefusal(pending)) throw new Error(`refused: ${pending.refused}`);
    for (const d of pending.decisions) {
      expect(Number.isInteger(d.clockBeforeMs), `clock ${d.clockBeforeMs}`).toBe(true);
      expect(Number.isInteger(d.opponentClockBeforeMs), `opp ${d.opponentClockBeforeMs}`).toBe(true);
    }
  });

  it("still measures each move from when it really started, so the rounding cannot accumulate", () => {
    /*
     * A ROUNDED DURATION IS NOT A ROUNDED TIMEBASE. `turnStartedAtMs` keeps the raw reading, so the
     * error on any one think time is under half a millisecond and the error on the twentieth is
     * still under half a millisecond. Rounding the timebase instead would let it walk.
     */
    const played = playWithFractionalClock();
    if (!isFinished(played.game)) throw new Error("the game did not finish");
    /*
     * The think times CHAIN: each move is measured from the previous commit, and the first from the
     * start. So their sum is the span from `start()` to the last commit, and the only difference is
     * the rounding of each term -- under half a millisecond apiece, however long the game runs.
     */
    const total = played.game.decisions.reduce((sum, d) => sum + d.thinkMs, 0);
    const span = played.commitsAt[played.commitsAt.length - 1] - played.startedAt;
    expect(span).toBeGreaterThan(4_000);
    expect(Math.abs(total - span)).toBeLessThan(played.game.decisions.length * 0.5 + 1e-9);
  });
});

describe("durationMs", () => {
  it("rounds rather than truncates, so a population of durations is not biased downward", () => {
    /*
     * FLOOR WOULD PASS THE SCHEMA TOO. It would also shave a mean of half a millisecond off every
     * observation in the study -- a bias, not noise, applied to every row.
     */
    expect(durationMs(0, 1.6)).toBe(2);
    expect(durationMs(0, 1.4)).toBe(1);
    expect(durationMs(1_000.75, 4_947.9)).toBe(3947);
  });

  it("never returns a negative duration, whatever it is handed", () => {
    /* Impossible from a monotonic clock; every field it feeds forbids one, so it is floored here. */
    expect(durationMs(10, 5)).toBe(0);
  });
});
