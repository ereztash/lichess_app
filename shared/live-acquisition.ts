/**
 * What a decision recorded in the live loop can actually carry, which is what decides whether a
 * hypothesis about it can ever be tested.
 *
 * THE DEFECT THIS EXISTS TO CLOSE. Preregistration takes the worst-performing bucket out of a
 * player's imported games and promises to test it on decisions recorded from here on, at a
 * relaxed threshold -- 20 inside and 20 outside instead of 30 -- BECAUSE the bucket was named in
 * advance. `isRegistrableBucket` checked one thing: that the key was one of the six. It never
 * asked whether the live loop can produce a single decision that falls inside it.
 *
 * IT CANNOT, FOR ONE OF THEM, AND THIS IS NOT A MATTER OF DEGREE. `clock-under-1m` is true of a
 * decision whose `clock_ms_remaining` is under a minute. `Home` builds every live decision with
 * `clockMsRemaining: null` -- both construction sites, unconditionally, because a local game
 * against Stockfish has no clock and the board has no other source for one. So the predicate is
 * false for every decision the live loop will ever write. Registering that bucket produced a
 * hypothesis with a stored refutation condition, a countdown on screen, and no possible evidence:
 * not a long wait, an infinite one, and the product said "40 more decisions" the whole time.
 *
 * WHY THE OTHER FIVE ARE FINE, and this changed recently enough to be worth writing down. The
 * two timing buckets read `seconds_taken`, which every decision has. The three phase buckets read
 * the position, and a played game passes through all three phases. That last part is only true
 * because ordinary play decisions carry a confidence again: the shared bank is
 * SIXTY POSITIONS, ALL OF THEM MIDDLEGAME, plies 21-33 -- measured, not assumed -- so under a
 * rule that asked for confidence on the bank alone, `phase-opening` and `phase-endgame` had zero
 * decisions inside and `phase-middlegame` had zero OUTSIDE. Four of the six buckets were
 * unreadable by construction and nothing said so.
 *
 * WHY A CONSTANT AND NOT A CHECK. `shared/` cannot read the client, so this file states the fact
 * and a test holds the client to it: if a clocked live game is ever built, the test that asserts
 * every construction site passes null goes red and names this constant as what to change. The
 * alternative -- inferring it at runtime from the record -- would answer "no clocks yet", which
 * is indistinguishable from "no clocks ever" exactly when it matters, at zero decisions.
 */
import type { Bucketing } from "./detector.js";

/**
 * Whether a decision recorded in the live loop can carry a clock reading.
 *
 * FALSE, and the two places it would have to change are `Home`'s decision construction sites.
 * A game imported from Lichess or Chess.com does carry clocks in its PGN, and the import
 * diagnostic reads them -- but an import produces a READING, not decisions: nothing in it states
 * a confidence before an engine speaks, which is the only thing preregistration can be tested on.
 */
export const LIVE_DECISION_CARRIES_CLOCK = false;

/**
 * Whether the live loop can produce decisions on both sides of this bucket.
 *
 * "Both sides" is the operative part. The detector needs `minBucketN` inside AND outside, so a
 * bucket that can only ever be filled on one side is as untestable as one that cannot be filled
 * at all -- which is what the shared bank did to `phase-middlegame` when it was the only source.
 */
export function collectibleInLiveLoop(bucketing: Bucketing): boolean {
  if (bucketing.requiresClock) return LIVE_DECISION_CARRIES_CLOCK;
  return true;
}
