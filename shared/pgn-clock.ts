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
  if (previous === undefined || current === undefined) return null;
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
  return facing === undefined ? null : facing * 1000;
}

/** True when this PGN carries no usable clock data at all. */
export function hasClockData(clockTimes: number[]): boolean {
  return clockTimes.length >= 2;
}
