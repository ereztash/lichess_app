/**
 * The calibration score, decomposed -- what a raw gap cannot tell you.
 *
 * THE PROBLEM WITH THE HEADLINE THIS REPLACES. "Stated confidence minus realised accuracy" is one
 * number standing in for three independent things, and they do not belong to the same owner:
 *
 *   - how hard the positions were, which is a property of the ITEMS and nothing to do with the
 *     player at all;
 *   - how well the player separates the cases they get right from the ones they get wrong, which
 *     is the useful skill;
 *   - whether the numbers they say match what actually happens, which is calibration proper.
 *
 * A player served harder positions gets a worse gap while being no worse a judge of themselves.
 * Reporting the gap alone charges them for the item bank. Murphy (1973) splits it:
 *
 *     BRIER = RELIABILITY - RESOLUTION + UNCERTAINTY
 *
 * UNCERTAINTY is `o(1-o)` on the base rate -- 100% the positions, 0% the player, and it belongs
 * nowhere near a personal score. RESOLUTION is what the player earns by saying different things
 * about cases that turn out differently. RELIABILITY is the calibration error, and it is the only
 * term of the three that answers "do your words mean what they say".
 *
 * Mandel & Barnes (2014, PNAS 111(30):10984) publish exactly these for professional intelligence
 * analysts: VI = 0.240, DI = 0.182, CI = 0.016. Note the shape -- almost all of their Brier is
 * the environment, and their calibration error is tiny. A product that led with their raw gap
 * would have called the best-calibrated professionals on record mediocre.
 *
 * WHY THERE IS NO BINNING PARAMETER HERE, which is not an oversight. The modern standard is CORP
 * (Dimitriadis, Gneiting & Jordan, PNAS 2021), and the problem it exists to solve is that a
 * CONTINUOUS forecast has to be binned before it can be grouped, and the answer moves with the
 * bin edges. This instrument's forecasts are not continuous: a player picks one of seven buttons,
 * so the natural grouping is the scale itself and the decomposition is EXACT rather than
 * estimated. The discrete scale, which is a limitation everywhere else, is what buys that.
 *
 * WHAT IS STILL ESTIMATED, so nobody reads more precision into these than they hold: each level's
 * observed rate comes from however many decisions landed on that level, and a level with three
 * decisions on it contributes a very noisy term. RELIABILITY is biased UPWARD in small samples for
 * exactly this reason -- with one decision per level it is at its maximum by construction. The
 * per-level counts are returned alongside so a caller can see which terms are carrying weight,
 * and `reliable` says whether any of them can be read at all.
 */
import { MIN_BUCKET_N, type ScoredDecision } from "./detector.js";

/** One level of the scale, and what happened at it. */
export interface LevelOutcome {
  /** What this level asserts, 0..1. */
  claimed: number;
  /** How often it actually came true. Null when nobody used this level. */
  observed: number | null;
  n: number;
}

export interface CalibrationScore {
  n: number;
  /**
   * Mean squared distance between what was claimed and what happened. Lower is better; 0 is
   * perfect and 0.25 is what "say 50% to everything" scores.
   */
  brier: number;
  /**
   * RELIABILITY -- calibration error, and the only term the player owns outright. Zero means the
   * things claimed at 65% happen 65% of the time, whatever else is true of them.
   */
  reliability: number;
  /** RESOLUTION -- how far the player's levels pull apart from their own base rate. Higher is better. */
  resolution: number;
  /**
   * UNCERTAINTY -- `o(1-o)` on the base rate. ENTIRELY a property of the positions served, and
   * the reason a raw gap is not comparable between two players who faced different ones.
   */
  uncertainty: number;
  /**
   * Brier skill score against the base rate: `1 - brier / uncertainty`.
   *
   * Positive means the player beat "predict the base rate every time". Null when uncertainty is
   * zero -- a record where every decision went the same way has no base rate to beat, and
   * dividing by it would manufacture a score out of an empty comparison.
   */
  skillScore: number | null;
  /**
   * Logarithmic score, the strictly proper one. Finite ONLY because no level of this scale
   * asserts 0 or 1 -- a single stated certainty that turned out wrong would make this infinite
   * and poison the whole record permanently. See shared/confidence.ts.
   */
  logScore: number;
  levels: LevelOutcome[];
  /**
   * Whether any level carries enough decisions for its term to mean anything.
   *
   * False does NOT mean the numbers above are wrong -- they are exactly right for the data. It
   * means RELIABILITY is dominated by small-sample noise and must not be read as a finding.
   */
  reliable: boolean;
}

const EMPTY: CalibrationScore = {
  n: 0,
  brier: 0,
  reliability: 0,
  resolution: 0,
  uncertainty: 0,
  skillScore: null,
  logScore: 0,
  levels: [],
  reliable: false,
};

/**
 * Murphy's decomposition over the levels the player actually used.
 *
 * Grouping is by the claimed probability rather than by the button number, because a record can
 * hold decisions stated on more than one scale and the same button asserted different things on
 * each. Two decisions belong in one group when they made the same CLAIM.
 */
export function calibrationScore(decisions: readonly ScoredDecision[]): CalibrationScore {
  const n = decisions.length;
  if (n === 0) return EMPTY;

  const baseRate = decisions.filter((d) => d.accurate).length / n;
  const uncertainty = baseRate * (1 - baseRate);

  const groups = new Map<number, { n: number; hits: number }>();
  for (const decision of decisions) {
    const group = groups.get(decision.confidence) ?? { n: 0, hits: 0 };
    group.n += 1;
    if (decision.accurate) group.hits += 1;
    groups.set(decision.confidence, group);
  }

  let reliability = 0;
  let resolution = 0;
  const levels: LevelOutcome[] = [];
  for (const [claimed, group] of [...groups].sort((a, b) => a[0] - b[0])) {
    const observed = group.hits / group.n;
    reliability += (group.n * (claimed - observed) ** 2) / n;
    resolution += (group.n * (observed - baseRate) ** 2) / n;
    levels.push({ claimed, observed, n: group.n });
  }

  /*
   * Computed directly rather than reassembled from the three terms above. The identity
   * `brier = reliability - resolution + uncertainty` is what makes the decomposition meaningful,
   * so it has to be a CHECK the test can run -- deriving one side from the other would make it
   * true by construction and prove nothing.
   */
  let squared = 0;
  let logarithmic = 0;
  for (const decision of decisions) {
    const outcome = decision.accurate ? 1 : 0;
    squared += (decision.confidence - outcome) ** 2;
    logarithmic -= outcome
      ? Math.log(decision.confidence)
      : Math.log(1 - decision.confidence);
  }

  return {
    n,
    brier: squared / n,
    reliability,
    resolution,
    uncertainty,
    skillScore: uncertainty > 0 ? 1 - squared / n / uncertainty : null,
    logScore: logarithmic / n,
    levels,
    reliable: levels.some((level) => level.n >= MIN_BUCKET_N),
  };
}
