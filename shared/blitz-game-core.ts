/**
 * A CHESS GAME WITH A CLOCK, AND NOTHING ELSE.
 *
 * It knows a legal position, whose turn it is, the time control, how a clock moves, what a commit
 * does, what a flag is, and when a game is over. It does NOT know Stockfish, calibration, the
 * detector, claims, drills, confidence, or that anybody is being measured at all. That ignorance is
 * the design: INV-3 says a committed move advances the board without awaiting any engine, and the
 * cheapest way to guarantee it is a core that has no way to call one.
 *
 * PURE, AND THE CLOCK IS AN ARGUMENT. Every transition takes the current monotonic reading as a
 * parameter rather than reading one. A core that called `performance.now()` itself could only be
 * tested by making time pass, which is how clock tests become slow and flaky and end up asserting
 * "about five seconds".
 *
 * THE CLOCK IS COMPUTED, NEVER ACCUMULATED, and this is the invariant most likely to be broken by
 * an innocent-looking refactor. The state holds what each player had AT THE START OF THE CURRENT
 * TURN plus the mark when that turn began; the remaining time is the subtraction of those two, done
 * on demand. It is never decremented by a tick.
 *
 * The alternative -- subtract a fixed amount every interval -- is wrong in a way that favours the
 * player and hides: a backgrounded tab throttles timers to once a second or less, so a clock built
 * that way stops draining exactly when nobody is looking at it. A player who alt-tabs gets free
 * time, the record says they thought for four seconds when they thought for forty, and nothing
 * anywhere reports an error.
 *
 * SO A FLAG IS A COMPUTATION, NOT AN EVENT. There is no "timeout fired". `at(state, now)` answers
 * whether the clock has run out, and it answers it correctly the first time anybody asks -- on a
 * tick, on a commit attempt, or when a hidden tab comes back. A player whose tab was closed when
 * their clock ran out has still lost on time.
 */
import { Chess } from "chess.js";
import { durationMs } from "./measured-duration.js";
import type { TimeControlMs } from "./pgn-clock.js";

export type Side = "w" | "b";

/** Why a game stopped. `flag` is the clock; the rest are the position. */
export type BlitzOutcome =
  | { kind: "flag"; loser: Side }
  | { kind: "checkmate"; loser: Side }
  | { kind: "draw"; reason: "stalemate" | "insufficient" | "threefold" | "fifty-move" }
  | { kind: "resignation"; loser: Side };

/** One committed move, with the clock context that produced it. Nothing evaluative. */
export interface BlitzDecision {
  ply: number;
  side: Side;
  /** The move in SAN, as the position accepted it. */
  san: string;
  /** The position the player FACED, before their move. */
  fenBefore: string;
  /**
   * How long they took, from the position becoming actionable to the commit.
   *
   * FROZEN HERE AND NOWHERE ELSE (INV-1). Nothing downstream may add to it -- not a confidence
   * question, not an engine, not a screen transition. The core has no way to reopen it because the
   * decision is pushed onto a finished list and never looked up again.
   */
  thinkMs: number;
  /** Their own clock as they faced the position. */
  clockBeforeMs: number;
  /** The opponent's clock at that same moment. */
  opponentClockBeforeMs: number;
}

/**
 * The state machine. Four phases, and the impossible ones are unrepresentable rather than guarded.
 *
 * `idle` has no board, so nothing can move on it. `finished` has an outcome, so nothing can be
 * without one. A `running` game always has a turn mark, because the only way to reach `running` is
 * through a transition that sets one.
 */
export type BlitzState =
  | { phase: "idle" }
  | { phase: "ready"; timeControl: RequiredTimeControl; fen: string }
  | RunningState
  | (Omit<RunningState, "phase"> & { phase: "finished"; outcome: BlitzOutcome });

interface RunningState {
  phase: "running";
  timeControl: RequiredTimeControl;
  fen: string;
  active: Side;
  /** What each side had when the CURRENT turn began. Never decremented in place. */
  clocksAtTurnStart: Record<Side, number>;
  /** The monotonic reading when the current turn began. */
  turnStartedAtMs: number;
  decisions: BlitzDecision[];
  ply: number;
}

/**
 * A time control a game can actually be played on.
 *
 * `TimeControlMs` allows nulls because an IMPORTED game may not have recorded one. A game being
 * played here always has one -- somebody chose it -- so this narrows rather than re-declares, and a
 * null cannot reach the clock arithmetic.
 */
export interface RequiredTimeControl {
  initialMs: number;
  incrementMs: number;
}

export function playable(tc: TimeControlMs): RequiredTimeControl | null {
  if (tc.initialMs === null || tc.incrementMs === null) return null;
  if (tc.initialMs <= 0) return null;
  return { initialMs: tc.initialMs, incrementMs: tc.incrementMs };
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function newGame(timeControl: RequiredTimeControl, fen = STARTING_FEN): BlitzState {
  return { phase: "ready", timeControl, fen };
}

/** The first move of the game starts the clock. Until then nobody is losing time. */
export function start(state: BlitzState, nowMs: number): BlitzState {
  if (state.phase !== "ready") return state;
  const board = new Chess(state.fen);
  return {
    phase: "running",
    timeControl: state.timeControl,
    fen: state.fen,
    active: board.turn(),
    clocksAtTurnStart: { w: state.timeControl.initialMs, b: state.timeControl.initialMs },
    turnStartedAtMs: nowMs,
    decisions: [],
    ply: 0,
  };
}

/**
 * What a side has left at `nowMs`. The only way to ask, so the subtraction lives in one place.
 *
 * The inactive side's clock does not move, which is the other half of "computed, never
 * accumulated": there is no code path that could decrement it, so no bug can.
 */
export function remainingMs(state: BlitzState, side: Side, nowMs: number): number {
  if (state.phase === "idle") return 0;
  if (state.phase === "ready") return state.timeControl.initialMs;
  if (side !== state.active) return state.clocksAtTurnStart[side];
  return state.clocksAtTurnStart[side] - (nowMs - state.turnStartedAtMs);
}

/** True when the side to move has run out. A question, asked whenever anybody looks. */
export function hasFlagged(state: BlitzState, nowMs: number): boolean {
  if (state.phase !== "running") return false;
  return remainingMs(state, state.active, nowMs) <= 0;
}

function finish(state: RunningState, outcome: BlitzOutcome): BlitzState {
  const { phase: _phase, ...rest } = state;
  return { ...rest, phase: "finished", outcome };
}

function outcomeOf(board: Chess): BlitzOutcome | null {
  if (board.isCheckmate()) return { kind: "checkmate", loser: board.turn() };
  if (board.isStalemate()) return { kind: "draw", reason: "stalemate" };
  if (board.isInsufficientMaterial()) return { kind: "draw", reason: "insufficient" };
  if (board.isThreefoldRepetition()) return { kind: "draw", reason: "threefold" };
  if (board.isDraw()) return { kind: "draw", reason: "fifty-move" };
  return null;
}

/**
 * The only transition that ends a decision.
 *
 * ORDER IS THE WHOLE FUNCTION, and it is ADR-001 §4 in code: the elapsed time is read FIRST, from
 * the mark, before anything else happens. Whatever follows -- legality, the increment, the
 * opponent, a confidence question somewhere far above this module -- cannot change it, because the
 * number was taken before any of it ran.
 *
 * A FLAG BEATS A MOVE. If the clock ran out while the player was choosing, the game was already
 * over when they clicked; accepting the move would let a player win by moving after their flag.
 * Checked before legality, because a move made after the flag is not an illegal move, it is a move
 * in a game that had ended.
 */
export function commit(
  state: BlitzState,
  move: { from: string; to: string; promotion?: string },
  nowMs: number,
): { state: BlitzState; accepted: boolean } {
  if (state.phase !== "running") return { state, accepted: false };

  /*
   * A WHOLE MILLISECOND, AND THE CLOCK IS KEPT IN THE SAME UNITS BY USING THIS ONE VALUE FOR BOTH.
   *
   * `elapsed` is the think time that gets frozen into the decision below AND the amount subtracted
   * from the mover's clock. Rounding it once here keeps those two the same number; rounding only
   * the stored one would let a record say a player spent 3948ms on a move their clock says cost
   * 3947.7ms. `turnStartedAtMs` stays the raw reading, so the rounding does not accumulate: each
   * move is measured from when it actually started, not from a rounded version of it.
   */
  const elapsed = durationMs(state.turnStartedAtMs, nowMs);
  const clockBefore = state.clocksAtTurnStart[state.active];
  const opponent: Side = state.active === "w" ? "b" : "w";

  if (clockBefore - elapsed <= 0) {
    return { state: finish(state, { kind: "flag", loser: state.active }), accepted: false };
  }

  const board = new Chess(state.fen);
  let san: string;
  try {
    const played = board.move(move);
    if (!played) return { state, accepted: false };
    san = played.san;
  } catch {
    // chess.js throws on an illegal move. An illegal move is not a state change and not a flag.
    return { state, accepted: false };
  }

  const decision: BlitzDecision = {
    ply: state.ply + 1,
    side: state.active,
    san,
    fenBefore: state.fen,
    thinkMs: elapsed,
    clockBeforeMs: clockBefore,
    opponentClockBeforeMs: state.clocksAtTurnStart[opponent],
  };

  const next: RunningState = {
    ...state,
    fen: board.fen(),
    active: board.turn(),
    clocksAtTurnStart: {
      ...state.clocksAtTurnStart,
      /* The increment is applied ONCE, here, at the commit. Nowhere else adds to a clock. */
      [state.active]: clockBefore - elapsed + state.timeControl.incrementMs,
    },
    turnStartedAtMs: nowMs,
    decisions: [...state.decisions, decision],
    ply: state.ply + 1,
  };

  const ended = outcomeOf(board);
  return { state: ended ? finish(next, ended) : next, accepted: true };
}

/**
 * Notice that a flag has already happened. Not "make it happen".
 *
 * Idempotent and safe to call from a render loop, a visibility handler, or nothing at all -- the
 * flag is true from the instant the clock crossed zero whether or not anybody has asked yet.
 */
export function observe(state: BlitzState, nowMs: number): BlitzState {
  if (state.phase !== "running") return state;
  if (!hasFlagged(state, nowMs)) return state;
  return finish(state, { kind: "flag", loser: state.active });
}

export function resign(state: BlitzState, side: Side): BlitzState {
  if (state.phase !== "running") return state;
  return finish(state, { kind: "resignation", loser: side });
}
