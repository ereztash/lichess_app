/**
 * When the product asks how sure you are, and when asking would be a toll.
 *
 * The confidence question was on every decision, so a game against the app was forty of them.
 * Reported, twice, as the reason a game does not get finished -- and it is not a UX complaint, it
 * is a measurement problem wearing one: an instrument that is too expensive to use produces no
 * readings, and a calibration gap over decisions nobody stayed to record is not a smaller finding
 * than one over a full record, it is no finding at all.
 *
 * THE RULE, AND IT IS THE ONLY ONE: the question is asked exactly where a measurement reads the
 * answer. Nowhere else. Every other decision is recorded in full -- move, what you could read,
 * what you could not -- and simply carries no stated confidence, which is a fact about the
 * protocol rather than a hole in the data.
 *
 * WHY NOT "OPTIONAL EVERYWHERE", which is the obvious way to make it lighter. Whoever skips it
 * skips it BECAUSE OF HOW THEY FEEL ABOUT THE POSITION -- unsure, bored, in a hurry, embarrassed.
 * That makes the confidence data a sample the player curated on exactly the variable being
 * measured, and the calibration gap over a self-selected sample is not a noisier reading of the
 * same thing, it is a reading of something else. It is the one bias this whole product is built to
 * avoid, and it would have been introduced to save a tap.
 *
 * WHY NOT RANDOM SAMPLING, which is unbiased and was the other candidate. It works, but it makes
 * the wait longer in proportion to the sampling rate, and the wait is already 60-90 decisions. The
 * shared bank is better than random on both counts: it is a FIXED set of positions, so the wait is
 * a bounded and visible task rather than an open-ended one, and the readings that need comparing
 * between players -- the anchor calibration score, the split-half stability check -- are computed
 * over that bank and nothing else anyway.
 *
 * WHAT THIS COSTS, STATED: a decision in a player's own game no longer contributes to the
 * calibration gap. The six buckets narrow to the bank plus the drills. That is a real loss of n
 * and it is the price of the instrument being used at all.
 */

/**
 * Why this position is in front of the player, which is what decides whether anyone will read a
 * confidence stated on it.
 *
 * A union rather than a boolean the caller works out, because the rule then lives in one place and
 * a surface added later has to name itself rather than quietly default. `play` and `import` both
 * mean "nothing measures this" and are kept apart anyway: they are different decisions and a
 * count that pools them could not say which loop a player abandoned.
 */
export type DecisionPurpose =
  /** A position from the shared bank. The only reading comparable between players lives here. */
  | "anchor"
  /** A drill position. The verdict IS a calibration gap against the record's baseline. */
  | "drill"
  /** The forward check on a rule the player wrote. Graded the same way. */
  | "transfer"
  /** An ordinary decision in a game being played. */
  | "play"
  /** A position from a game already finished, reached through the import. */
  | "import";

/** The purposes whose decisions a measurement reads a stated confidence from. */
const MEASURED: readonly DecisionPurpose[] = ["anchor", "drill", "transfer"];

export function confidenceIsMeasured(purpose: DecisionPurpose): boolean {
  return MEASURED.includes(purpose);
}
