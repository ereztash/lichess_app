/**
 * Time-to-decide and clock-remaining, from a PGN's `[%clk]` annotations.
 *
 * These are two of the three fields a bucket predicate reads (`BucketableDecision`), and they are
 * the only ones an imported game does not hand over directly. Deriving them is what lets the six
 * buckets be applied to games the player already played -- which is the whole cold-start bridge,
 * because a player arrives with hundreds of past decisions and no stated confidence for any.
 *
 * Extracted rather than reused. `shared/game-features.ts` already computed a version of this at
 * its line 469, but that module is 600 lines of feature extraction that nothing imports, and it
 * is the only importer of `shared/pgn-parser.ts` -- so both are dead. Resurrecting the pair to
 * reach twelve lines would drag the rest along behind it.
 *
 * Two corrections to what that code did:
 *
 *   1. It ignored the increment. In a 300+3 game the clock goes UP by 3 seconds after each move,
 *      so a move that genuinely took 3 seconds shows no change at all and reads as 0 seconds. At
 *      this app's own threshold that silently sorts real thinking into "under 45 seconds".
 *   2. It said nothing about which clock reading `clockMsRemaining` means. Both are defensible
 *      and they are different numbers; the choice is stated below and matched to the live path.
 */

/** No clocks in the PGN at all. Distinguished from "clocks present but this ply has none". */
export const NO_CLOCK_DATA = null;

export interface TimeControl {
  /** Initial seconds on the clock. */
  baseSeconds: number;
  /** Seconds added after each move. Zero when the game has no increment. */
  incrementSeconds: number;
}

/**
 * The same fact in milliseconds, with "nobody said" expressible -- the shape everything downstream
 * of the parser carries.
 *
 * TWO TYPES RATHER THAN ONE, and the difference is not units. `TimeControl` is what a PARSE
 * produced: it exists only when a header was read successfully, so neither field can be absent.
 * `TimeControlMs` is what a RECORD carries, and a record has to be able to say that its source
 * supplied nothing -- a Lichess correspondence game has no clock object, a Chess.com daily game
 * writes "1/259200" whose numerator is not a starting clock. Collapsing the two would force the
 * parser to invent a null it never has, or the record to invent a number it was never given.
 *
 * MILLISECONDS BECAUSE EVERY OTHER CLOCK FIELD IN THIS APP IS. `clockMsRemaining` already is, and a
 * record carrying one clock in seconds and another in milliseconds is a subtraction waiting to be
 * wrong by a factor of a thousand.
 */
export interface TimeControlMs {
  /** Starting clock per player. Null when nothing supplied a usable one. */
  initialMs: number | null;
  /** Added after each move. Zero for 3+0; null when nothing said. */
  incrementMs: number | null;
}

/** Nothing known about the clock. Named once so no caller invents its own empty. */
export const NO_TIME_CONTROL: TimeControlMs = { initialMs: null, incrementMs: null };

/** A successful parse, in the units a record stores. A failed parse stays `NO_TIME_CONTROL`. */
export function toTimeControlMs(parsed: TimeControl | null): TimeControlMs {
  if (!parsed) return NO_TIME_CONTROL;
  return { initialMs: parsed.baseSeconds * 1000, incrementMs: parsed.incrementSeconds * 1000 };
}

/**
 * `[TimeControl "300+3"]` -> { base: 300, increment: 3 }.
 *
 * Returns null for the values a PGN uses when there is no usable clock: "-" (no time control),
 * "?" (unknown), and correspondence games expressed in days. A null increment must not silently
 * become zero -- that is the bug above wearing a default.
 */
export function parseTimeControl(header: string | undefined): TimeControl | null {
  if (!header) return null;
  const match = /^(\d+)(?:\+(\d+))?$/.exec(header.trim());
  if (!match) return null;
  return { baseSeconds: Number(match[1]), incrementSeconds: Number(match[2] ?? 0) };
}

/**
 * Seconds the player spent on the move at `ply`, or null when it cannot be derived.
 *
 * `clockTimes[i]` is the time remaining AFTER ply i, so the same player's previous reading is
 * `clockTimes[i - 2]`. The increment was added to the clock after the move, so it is added back
 * to recover the thinking time:
 *
 *     spent = previous - current + increment
 *
 * Plies 0 and 1 have no previous reading for that player and return null rather than 0. A first
 * move recorded as "0 seconds" is a fabricated data point in the bucket this product cares most
 * about.
 */
export function secondsSpentAt(
  clockTimes: number[],
  ply: number,
  incrementSeconds: number,
): number | null {
  if (ply < 2) return null;
  const previous = clockTimes[ply - 2];
  const current = clockTimes[ply];
  // Non-finite as well as absent: index 0 is NaN when the PGN carried no parseable TimeControl,
  // so the starting clock is genuinely unknown. NaN must become "no reading", never a number.
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
  // Clamped: a clock that appears to go backwards is a malformed PGN, not negative thinking.
  return Math.max(0, previous - current + incrementSeconds);
}

/**
 * Milliseconds left on the player's clock at `ply`, or null.
 *
 * THE CHOICE, stated once: this is the clock as the player FACED it -- the reading before their
 * move, `clockTimes[ply - 2]` -- not what was left after it.
 *
 * Why that one. The bucket is "decisions made with under a minute on the clock", and it is meant
 * to capture the pressure the decision was made under. The after-reading is a consequence of the
 * decision; the before-reading is a condition of it. The live path means the same thing by the
 * field: `clockMsRemaining` is read at the moment the position is presented.
 *
 * Ply 0 and 1 have no before-reading from a `[%clk]` list, which only records post-move times, so
 * they are null. The starting clock is knowable from the TimeControl header, but a decision at
 * ply 0 was made with the full clock and can never fall in the under-a-minute bucket anyway.
 */
export function clockMsRemainingAt(clockTimes: number[], ply: number): number | null {
  if (ply < 2) return null;
  const facing = clockTimes[ply - 2];
  return Number.isFinite(facing) ? facing * 1000 : null;
}

/**
 * Milliseconds left on the OPPONENT's clock while the player was deciding at `ply`, or null.
 *
 * IT WAS ALWAYS IN THE ARRAY. `clockTimes` interleaves both players -- index i is the time
 * remaining after ply i, whoever moved -- so the opponent's readings sit at the alternating
 * indices and nothing has ever read them. That is the whole of what was missing: not a field the
 * source withheld, a field nobody asked the data for.
 *
 * THE INDEX, argued rather than asserted. The player is about to move at `ply`, so the position
 * in front of them was produced by the opponent's move at `ply - 1`, and the opponent's clock at
 * that moment is the reading taken after it: `clockTimes[ply - 1]`.
 *
 * At ply 1 that index is 0, which is the STARTING clock -- and it is correct, not a fallback: the
 * opponent has not moved, so their whole clock is in front of them. It is NaN when the PGN carried
 * no parseable TimeControl header, and NaN becomes null here as it does everywhere else in this
 * file.
 *
 * SAME CHOICE AS `clockMsRemainingAt`, for the same reason: this is the clock as it stood while
 * the decision was being made -- a condition of the decision, not a consequence of it.
 *
 * WHAT IT MAKES DERIVABLE, and why that matters beyond completeness: the difference between the
 * two clocks. A player two minutes down on a three-minute clock is in a different environment from
 * one two minutes up, and until now the record could not tell those apart at all.
 */
export function opponentClockMsRemainingAt(clockTimes: number[], ply: number): number | null {
  if (ply < 1) return null;
  const facing = clockTimes[ply - 1];
  return Number.isFinite(facing) ? facing * 1000 : null;
}

/** True when this PGN carries no usable clock data at all. */
export function hasClockData(clockTimes: number[]): boolean {
  return clockTimes.length >= 2;
}

/** `[TimeControl "300+3"]`, or undefined when the header is absent. */
export function timeControlHeader(pgn: string): string | undefined {
  return /\[TimeControl\s+"([^"]*)"\]/.exec(pgn)?.[1];
}

/** `0:03:00` or `3:00` or `180` -> seconds. Null when it is none of those. */
function clockToSeconds(text: string): number | null {
  const parts = text.trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

/**
 * The `[%clk]` readings in a PGN, indexed the way `secondsSpentAt` expects.
 *
 * `[%clk]` is written AFTER each move, so the comments alone give indices 1..N and say nothing
 * about the clock at the start. Index 0 is the initial clock, taken from the TimeControl header.
 *
 * WHEN THAT HEADER IS MISSING OR UNPARSEABLE, index 0 is NaN rather than a guess. The tempting
 * fill is the first `[%clk]` value, and it is wrong by exactly one move's thinking time -- in the
 * bucket named "under 45 seconds", one move's thinking time is the whole measurement. NaN costs
 * the readings for plies 2 and 3 and nothing else; the two functions above turn it into "no
 * reading" rather than into a number.
 *
 * Returns an empty array when the PGN carries no clock comments at all, which is the common case:
 * Lichess omits them unless the exporter asks.
 */
export function clockSecondsFromPgn(pgn: string): number[] {
  const readings: number[] = [];
  for (const match of pgn.matchAll(/\[%clk\s+([^\]]+)\]/g)) {
    const seconds = clockToSeconds(match[1]);
    if (seconds === null) return [];
    readings.push(seconds);
  }
  if (!readings.length) return [];
  return [parseTimeControl(timeControlHeader(pgn))?.baseSeconds ?? Number.NaN, ...readings];
}
