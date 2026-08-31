/**
 * A candidate bucket set for blitz, defined here and searched by nothing that ships.
 *
 * WHY IT EXISTS. R-18 measured the two absolute time buckets as structurally dead on the route built
 * to measure time pressure: on a forty-game blitz record `fast-under-45s` is usable on 27% of them
 * and recovers a real effect on 0.00%, against 41.75% for `phase-middlegame` on the same worlds.
 * Forty-five seconds is a quarter of the whole clock in a three-minute game.
 *
 * WHY IT IS NOT THE SHIPPED SIX. Two reasons, and both are hard stops rather than caution:
 *
 *   `SEPARABILITY_K = 3.75` IS A MEASUREMENT OF THOSE SIX SEARCHED TOGETHER. A redefined set is a
 *   different multiplicity, so the threshold has to be earned again before anything is searched
 *   under it. That measurement is `q8_relative_time.py`, and this file is its subject.
 *
 *   THE SIX ARE FROZEN IN `hypothesis-manifest.ts`. Changing them changes the hash, and the hash is
 *   what makes a pre-registration mean anything. A candidate that passes earns the right to be
 *   PROPOSED for that manifest; it does not earn its way in.
 *
 * THE CUTS ARE DECLARED IN `docs/decisions/D05-blitz-time.md`, BEFORE THE RUN, and the ordering is
 * the point: the rule was committed with no measurement behind it. They are one constant the product
 * already uses -- the thirty-move planning horizon that gives `budget = initial / 30` -- halved and
 * doubled. An even pace spends 1/30 of the clock in hand on each decision; below half of that is
 * fast, above double it is slow. Neither was chosen by looking at how full the bucket comes out.
 */
import { BUCKETINGS, type BucketableDecision, type Bucketing } from "./detector.js";
import type { BucketVariable } from "./bucket-variable.js";

/** An even pace across the thirty-move horizon: the share one decision costs. */
export const EVEN_SHARE_OF_CLOCK = 1 / 30;
/** Half an even share. */
export const FAST_RELATIVE_CUT = EVEN_SHARE_OF_CLOCK / 2;
/** Double an even share. */
export const SLOW_RELATIVE_CUT = EVEN_SHARE_OF_CLOCK * 2;

/**
 * What share of the clock they had, this decision cost.
 *
 * `shared/blitz-features.ts` computes the same quantity as `thinkFractionOfClockBefore`; this reads
 * it off a `BucketableDecision`, which is the narrow shape a predicate is handed -- the two clock
 * fields and nothing about the outcome, so a bucket cannot see what it is about to be judged on. Null wherever either half is
 * missing or the clock was zero -- an unmeasurable decision must not land in a bucket OR in its
 * comparison set, which is the defect `bucketable` exists to prevent and which R-18 found live.
 */
export function clockShareOfDecision(d: BucketableDecision): number | null {
  if (d.secondsTaken === null || d.clockMsRemaining === null || d.clockMsRemaining <= 0) return null;
  return (d.secondsTaken * 1000) / d.clockMsRemaining;
}

const relative = (
  key: string,
  scope: string,
  inside: (share: number) => boolean,
): Bucketing => ({
  key,
  scope,
  predicate: (d) => {
    const share = clockShareOfDecision(d);
    return share !== null && inside(share);
  },
  /*
   * IT READS THE CLOCK AS WELL AS THE TIME TAKEN, so a decision missing either is unreadable by
   * this bucket -- which is stricter than `fast-under-45s`, and correctly so: a ratio needs both
   * halves and an absolute threshold needs one.
   */
  requiresTime: true,
  requiresClock: true,
});

/** The four buckets R-18 measured as working, unchanged, plus the two candidates. */
export const BLITZ_CANDIDATE_BUCKETINGS: readonly Bucketing[] = [
  relative(
    "fast-relative",
    "החלטות שעלו פחות מחצי מקצב אחיד",
    (share) => share < FAST_RELATIVE_CUT,
  ),
  relative(
    "slow-relative",
    "החלטות שעלו יותר מפי שניים מקצב אחיד",
    (share) => share > SLOW_RELATIVE_CUT,
  ),
  ...BUCKETINGS.filter((b) => b.key !== "fast-under-45s" && b.key !== "slow-over-2m"),
];

/**
 * The same three variables, with `time-taken`'s levels replaced.
 *
 * WITHOUT THIS THE CANDIDATE WOULD MEASURE AS UNREADABLE FOR THE WRONG REASON. `readVariables`
 * matches a cleared bucket to a variable by key, so `fast-relative` under the shipped `VARIABLES`
 * belongs to no variable and is dropped before anything counts it -- a candidate scoring zero
 * because the reading could not see it, which would look exactly like a candidate that failed.
 */
export const BLITZ_CANDIDATE_VARIABLES: readonly BucketVariable[] = [
  { key: "phase", label: "שלב המשחק", levels: ["phase-opening", "phase-middlegame", "phase-endgame"] },
  { key: "time-taken", label: "כמה זמן לקחתם", levels: ["fast-relative", "slow-relative"] },
  { key: "clock", label: "כמה זמן נשאר", levels: ["clock-under-1m"] },
];
