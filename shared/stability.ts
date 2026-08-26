/**
 * Whether the number is stable enough to be worth reading -- measured, not asserted.
 *
 * THE QUESTION A SERIOUS READER ASKS FIRST, and this instrument has never been able to answer it:
 * is the calibration gap a property of the PERSON, or of the session they happened to have? The
 * literature is not encouraging by default. Ordinary calibration measures show cross-task
 * correlations of .08 to .39; the one instrument with demonstrated trait reliability reaches
 * r = .53-.77 and gets there by making performance uninformative. A number that does not hold
 * still between two halves of the same sitting will certainly not hold still between sittings.
 *
 * WHAT THIS IS, EXACTLY. A split-half stability check on one player's record: the decisions are
 * split by alternating position, each half's gap is computed, and the two are compared against
 * the sampling error of their difference. It answers "did this record say the same thing twice".
 *
 * WHAT THIS IS NOT, AND THE DISTINCTION IS THE WHOLE POINT. It is NOT test-retest reliability and
 * must never be reported as one. Test-retest separates the two measurements in TIME, which is
 * what distinguishes a trait from a mood, a warm-up, or a run of good positions -- and no split of
 * a single sitting can do that. It is also not a reliability COEFFICIENT: a correlation between
 * halves needs many people, and one player yields one pair of numbers. Spearman-Brown does not
 * apply and is deliberately absent.
 *
 * So a stable reading here is necessary and not sufficient. Failing it means the number is noise;
 * passing it means the number is not obviously noise, and nothing more.
 *
 * ALTERNATING RATHER THAN FIRST-HALF/SECOND-HALF, because the two are not equivalent. Splitting
 * down the middle confounds instability with anything that changes over a sitting -- fatigue,
 * warming up, the anchor set's own order -- and would report a player who simply got tired as a
 * player whose number cannot be trusted. Alternating balances all of those across both halves.
 */
import { summarise, gapDifferenceStandardError, type ScoredDecision } from "./detector.js";

export interface Stability {
  /** Decisions in each half. Equal, or off by one when the record is odd. */
  n: [number, number];
  /** Each half's calibration gap. */
  gap: [number, number];
  /** How far apart the two halves came out. */
  difference: number;
  /**
   * The sampling error of that difference, or null when a half cannot estimate its own variance.
   *
   * Null is the honest answer for a half with no variance in it, not zero -- the same defect the
   * detector was rebuilt around, where a flat bucket produced a standard error of zero and every
   * difference cleared it.
   */
  standardError: number | null;
  /**
   * How many standard errors apart the halves are, or null when that cannot be computed.
   *
   * Small is good and means the record said the same thing twice. There is no threshold here on
   * purpose: turning this into a pass/fail verdict would invite exactly the reading it is meant
   * to prevent -- that a passing record has a number about the person.
   */
  spread: number | null;
  /**
   * Whether the halves are big enough for any of this to mean anything.
   *
   * A split of eight decisions has a standard error wide enough to hide almost any instability,
   * so a comfortable-looking spread there says nothing at all.
   */
  readable: boolean;
}

/** The smallest half this will report on. Below it the check cannot fail, which makes passing meaningless. */
export const MIN_STABILITY_HALF = 25;

/**
 * Split a record in two and see whether it says the same thing twice.
 *
 * Order matters and is the caller's: pass anchor decisions in bank order to compare like with
 * like. Passing a mixed record compares two arbitrary samples of different positions, which is
 * a different and much weaker question.
 */
export function splitHalfStability(decisions: readonly ScoredDecision[]): Stability {
  const first: ScoredDecision[] = [];
  const second: ScoredDecision[] = [];
  decisions.forEach((decision, index) => (index % 2 === 0 ? first : second).push(decision));

  const a = summarise(first);
  const b = summarise(second);
  const standardError = gapDifferenceStandardError(a, b);
  const difference = a.gap - b.gap;

  return {
    n: [a.n, b.n],
    gap: [a.gap, b.gap],
    difference,
    standardError,
    spread: standardError === null ? null : Math.abs(difference) / standardError,
    readable: a.n >= MIN_STABILITY_HALF && b.n >= MIN_STABILITY_HALF && standardError !== null,
  };
}
