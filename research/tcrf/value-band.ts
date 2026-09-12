import { ACCURATE_CP_LOSS, ACCURATE_WIN_PROBABILITY_LOSS } from "../../shared/detector.js";
import { WIN_PROBABILITY_K } from "../../shared/win-probability.js";

/**
 * THE BAND IN WHICH §4.3's MATCHING TEST ACTUALLY HAS RESOLUTION, and the reason it had to be added.
 *
 * §4.3 matches the two arms on winning chances. Winning chances are a logistic, and a logistic is
 * FLAT AT ITS ENDS. `shared/win-probability.ts` says so from the other direction and gives the
 * numbers: 30 centipawns costs 2.76 points of winning chances at a level position and 0.28 at
 * +10.00. Run backwards, that means two positions 200 centipawns apart in a won game differ by less
 * than the tolerance, and the matching test passes them.
 *
 * THIS WAS NOT A HYPOTHETICAL. The first pilot pair in the higher-order-coalition family came back
 * with a delta of EXACTLY 0.0000 under both engine configurations, which read as a perfect match
 * and was nothing of the kind: both arms evaluated at 1.000: White was winning by a queen in both.
 * The pair had passed §4.3 by being decided rather than by being matched.
 *
 * WHAT THIS IS AND IS NOT. It is not a new matching criterion and it does not move §4.3's tolerance.
 * It says when §4.3's test was PERFORMED at all. Outside the band the engine comparison has no
 * resolution, so the honest state of the measurement is `unresolved`, which is the same distinction
 * `NOT_MEASURED` carries one level up and the same one `scripts/run_gates.ts` keeps beside PASS.
 *
 * THE BOUND IS DERIVED, NOT PICKED. It is the winning chance at which the tolerance
 * `ACCURATE_WIN_PROBABILITY_LOSS` stretches to twice its own anchor, `ACCURATE_CP_LOSS`: 60
 * centipawns rather than 30. The factor of two is the one judgement in it and it is stated here
 * rather than buried: beyond it the same tolerance is silently buying a different position.
 */
const cpOfWinProbability = (p: number): number => Math.log(p / (1 - p)) / WIN_PROBABILITY_K;

function deriveResolvableBound(): number {
  let lo = 0.5;
  let hi = 0.999;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    const width = cpOfWinProbability(mid) - cpOfWinProbability(mid - ACCURATE_WIN_PROBABILITY_LOSS);
    if (width < 2 * ACCURATE_CP_LOSS) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** ~0.867. Above it, or below its mirror, the §4.3 comparison cannot discriminate. */
export const VALUE_RESOLVABLE_UPPER = deriveResolvableBound();
export const VALUE_RESOLVABLE_LOWER = 1 - VALUE_RESOLVABLE_UPPER;

export const valueMatchResolvable = (value: number): boolean =>
  value >= VALUE_RESOLVABLE_LOWER && value <= VALUE_RESOLVABLE_UPPER;
