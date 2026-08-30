/**
 * RAW CLOCK OBSERVATIONS TO CANDIDATE FEATURES. It computes; it decides nothing.
 *
 * NOT A DETECTOR AND NOT A BUCKET. Nothing here chooses a threshold, names a group, or has an
 * opinion about which representation is better -- the 117-game study established that the shipped
 * 45s/120s cut puts every blitz decision in one bucket, and it licensed no substitute. Everything
 * below is a number derived from a number that was recorded, offered to a study that has to
 * preregister which of them it will look at.
 *
 * EVERY FIELD IS NULLABLE AND NONE IS EVER ZERO BY DEFAULT. A clock fraction of 0 means the player
 * had none of their clock left; null means nothing recorded what they had. The two have to stay
 * distinguishable or the mean of the column becomes a fiction -- which is the defect this
 * repository already shipped once, when an imported first move with no derivable think time was
 * written out as "0 seconds" and sorted into the bucket the product cares most about.
 *
 * ONE FEATURE IS NOT LOCAL, AND IT IS THE DANGEROUS ONE. `playerRelativeThinkPercentile` needs a
 * distribution, so it cannot be computed from a decision alone -- and a reference drawn from the
 * same decisions being read is leakage wearing a percentile. The reference is therefore an explicit
 * argument that carries where it came from, so a study that fits it on the data it reports has to
 * write that down rather than get it for free.
 */
import type { TimeControlMs } from "./pgn-clock.js";

/**
 * The version of these formulas.
 *
 * BUMP IT WHEN A FORMULA CHANGES, not when a caller does. A stored analysis that does not know
 * which version produced its numbers cannot be compared with a later one, and "clock share" would
 * quietly mean two things.
 */
export const BLITZ_FEATURE_VERSION = 1;

/** What one decision recorded about the clock. Every field may be absent. */
export interface ClockObservation {
  /** Milliseconds the player spent on this decision. */
  thinkMs: number | null;
  /** The player's own clock as they FACED the position, not after their move. */
  clockBeforeMs: number | null;
  /** The opponent's clock at that same moment. */
  opponentClockBeforeMs: number | null;
  /** The clock the game was played on. */
  timeControl: TimeControlMs;
}

/**
 * A distribution of this player's think times, and where it came from.
 *
 * THE LABEL IS NOT DECORATION. A percentile computed against a reference that includes the decision
 * being described, or decisions that came after it, is a feature conditioned on the future. Naming
 * the provenance does not prevent that -- nothing here can -- but it makes a leaky reference
 * visible in the record rather than invisible in a helper.
 */
export interface ThinkTimeReference {
  /** Sorted ascending, in milliseconds. */
  sortedMs: readonly number[];
  /** Where these came from, e.g. "derivation half, games 1-58". Free text, and it is read by people. */
  source: string;
}

export interface BlitzFeatures {
  /** Straight through from the observation, so a consumer needs no second source for it. */
  thinkMs: number | null;
  /** `log(1 + seconds)`, for a distribution whose median is two seconds and whose tail is eighty. */
  logThinkTime: number | null;
  clockBeforeMs: number | null;
  opponentClockBeforeMs: number | null;
  /**
   * The player's clock as a fraction of the starting clock.
   *
   * CAN EXCEED 1, and is not clamped. In a game with an increment the clock genuinely climbs above
   * where it began -- a 300+3 game reaches 306 seconds -- and clamping would turn a real reading
   * into a boundary value that looks like the most common state in the game.
   */
  clockRemainingFraction: number | null;
  /** Own clock minus the opponent's. Positive is ahead. */
  clockBalanceMs: number | null;
  /** Own clock as a share of the two clocks together. 0.5 is level, whatever the time control. */
  clockShare: number | null;
  /** What fraction of the clock they had, they spent on this one decision. */
  thinkFractionOfClockBefore: number | null;
  /** Where this think time falls in the reference distribution, 0 to 1. Null with no reference. */
  playerRelativeThinkPercentile: number | null;
  /** Which reference produced the percentile, so a later reader can ask whether it was fitted here. */
  percentileSource: string | null;
  featureVersion: number;
}

/** A finite number, or null. Every division below goes through it. */
function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/** `a / b`, or null when either side is missing or `b` is zero. */
function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return finite(a / b);
}

/**
 * The share of the reference at or below `ms`, by proportion of the distribution.
 *
 * TIES COUNT AS BELOW, deliberately. On integer-second data -- which is all Lichess gives, since
 * `[%clk]` carries `H:MM:SS` -- ties are not an edge case, they are most of the data: the 117-game
 * corpus has 290 held-out decisions at exactly one second. Counting strictly-below would put the
 * whole of the modal value at the bottom of its own distribution.
 */
export function thinkPercentile(ms: number, reference: ThinkTimeReference): number | null {
  const n = reference.sortedMs.length;
  if (n === 0) return null;
  let below = 0;
  for (const value of reference.sortedMs) {
    if (value <= ms) below += 1;
    else break; // sorted ascending, so nothing after this can qualify
  }
  return below / n;
}

/**
 * Every candidate, from one decision.
 *
 * `reference` is optional because most callers do not have one and should not invent one: a
 * percentile computed against an ad-hoc distribution is worse than no percentile at all.
 */
export function blitzFeatures(
  observation: ClockObservation,
  reference?: ThinkTimeReference,
): BlitzFeatures {
  const { thinkMs, clockBeforeMs, opponentClockBeforeMs, timeControl } = observation;
  const bothClocks =
    clockBeforeMs !== null && opponentClockBeforeMs !== null
      ? clockBeforeMs + opponentClockBeforeMs
      : null;

  return {
    thinkMs,
    logThinkTime: thinkMs === null ? null : finite(Math.log(1 + thinkMs / 1000)),
    clockBeforeMs,
    opponentClockBeforeMs,
    clockRemainingFraction: ratio(clockBeforeMs, timeControl.initialMs),
    clockBalanceMs:
      clockBeforeMs === null || opponentClockBeforeMs === null
        ? null
        : clockBeforeMs - opponentClockBeforeMs,
    clockShare: ratio(clockBeforeMs, bothClocks),
    thinkFractionOfClockBefore: ratio(thinkMs, clockBeforeMs),
    playerRelativeThinkPercentile:
      thinkMs === null || reference === undefined ? null : thinkPercentile(thinkMs, reference),
    percentileSource: reference?.source ?? null,
    featureVersion: BLITZ_FEATURE_VERSION,
  };
}
