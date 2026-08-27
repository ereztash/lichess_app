/**
 * The other half of metacognition: does the player DO anything with what they notice?
 *
 * MONITORING WITHOUT CONTROL IS HALF THE FACULTY, and until now this product measured only the
 * first half. Knowing that you are unsure is worth something; spending longer on the positions
 * where you are unsure is what makes it worth something. In the literature these are distinct and
 * separately measurable: monitoring is whether the confidence tracks the outcome, control is
 * whether effort tracks the monitoring.
 *
 * The measure is the association between how long a decision took and how confident the player
 * ended up. A negative association is the healthy direction -- longer on the ones they were less
 * sure of -- and it is reported signed rather than as a magnitude, because the opposite pattern
 * is a real and legible finding rather than an error: a player who spends longest on the
 * decisions they are most certain about is polishing what they already know.
 *
 * SPEARMAN, NOT PEARSON. Time taken is heavily right-skewed -- most decisions are quick and a few
 * are enormous -- so a Pearson correlation would be a statement about the three slowest decisions
 * in the record. Ranks are immune to that, and neither variable has a meaningful unit anyway: the
 * confidence scale is ordinal by construction.
 *
 * WHY IT IS COMPUTED ON THE ANCHOR SET. On a player's own games, "spent longer" and "was less
 * sure" are both caused by the position being harder, and a correlation between them says mostly
 * that hard positions are hard. Holding the items fixed does not remove that -- a hard anchor
 * position is hard for everyone -- but it makes the comparison BETWEEN players meaningful, which
 * is what the number is for. What it cannot do is turn one player's coefficient into a statement
 * about that player alone, and it does not claim to.
 */
import { MIN_BUCKET_N, SEPARABILITY_K, type ScoredDecision } from "./detector.js";

export interface Control {
  n: number;
  /**
   * Spearman rank correlation between seconds taken and stated confidence, or null when it is
   * not defined.
   *
   * NEGATIVE IS THE HEALTHY DIRECTION: longer on the decisions they were less sure of. Reported
   * signed, because the positive pattern -- longest on what they were most certain about -- is a
   * finding and not a fault in the measurement.
   */
  rho: number | null;
  /**
   * Whether either variable is too flat to correlate.
   *
   * A player who took the same time over everything, or said the same thing about everything, has
   * no association to measure. Zero would be a claim that effort and confidence are unrelated for
   * them; null is the truth, which is that this record cannot say.
   */
  /**
   * The standard error of `atanh(rho)`, or null where no coefficient exists.
   *
   * CARRIED BECAUSE THE COEFFICIENT ALONE IS NOT A FINDING, the same rule the detector applies to
   * a bucket's gap. A rank correlation from 30 pairs has a standard error near 0.19, and this cell
   * printed two decimals of it under a label that says a player's effort follows their doubt.
   *
   * Measured: with time drawn INDEPENDENTLY of confidence -- no association by construction --
   * over 20,000 records, a figure appeared 100% of the time, |rho| >= 0.20 on 29% of them at
   * MIN_BUCKET_N and >= 0.30 on 11%. One player in nine with nothing to find was handed "−0.31".
   *
   * Fisher's z rather than an error on rho itself: the sampling distribution of a correlation is
   * skewed and bounded at ±1, and `1/sqrt(n-3)` on the transformed scale is the standard remedy.
   */
  standardError: number | null;
  /**
   * Why the cell is empty, when it is -- and every value here is a DIFFERENT fact with different
   * advice.
   *
   * A player who took the same time over everything, or said the same thing about everything, has
   * no association to measure and never will: more decisions at the same speed cannot help, so
   * "keep playing" is advice that cannot work. `too-few` is a wait. `inside-noise` is a wait too,
   * but a different one -- the coefficient was computed and came out indistinguishable from none.
   *
   * ALL FOUR OF THESE EXISTED AND NONE REACHED A SCREEN. The dashboard rendered a bare "—" for
   * every one of them, so the distinction was built and discarded at the last step.
   */
  reason: "ok" | "too-few" | "flat-time" | "flat-confidence" | "inside-noise" | null;
  /** Whether the coefficient is a statement about this player rather than about this sample. */
  readable: boolean;
}

const EMPTY: Control = { n: 0, rho: null, standardError: null, reason: null, readable: false };

/** Ranks, averaging ties -- which is what makes this Spearman rather than an approximation of it. */
function ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1;
    const shared = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) out[order[k].index] = shared;
    i = j + 1;
  }
  return out;
}

/**
 * Whether the player spent their time where they were least sure.
 *
 * Pass anchor decisions: the coefficient is only comparable between players who faced the same
 * positions.
 */
export function effortFollowsDoubt(decisions: readonly ScoredDecision[]): Control {
  const n = decisions.length;
  if (n === 0) return EMPTY;
  if (n < MIN_BUCKET_N)
    return { n, rho: null, standardError: null, reason: "too-few", readable: false };

  const times = decisions.map((d) => d.secondsTaken);
  const said = decisions.map((d) => d.confidence);
  if (new Set(times).size < 2)
    return { n, rho: null, standardError: null, reason: "flat-time", readable: false };
  if (new Set(said).size < 2)
    return { n, rho: null, standardError: null, reason: "flat-confidence", readable: false };

  const a = ranks(times);
  const b = ranks(said);
  const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
  const ma = mean(a);
  const mb = mean(b);
  let top = 0;
  let leftSq = 0;
  let rightSq = 0;
  for (let i = 0; i < n; i += 1) {
    top += (a[i] - ma) * (b[i] - mb);
    leftSq += (a[i] - ma) ** 2;
    rightSq += (b[i] - mb) ** 2;
  }
  /*
   * Guarded rather than assumed. With every tie averaged, a variable can be non-constant and
   * still produce zero rank variance in principle; dividing by it would return Infinity dressed
   * as a correlation.
   */
  if (leftSq <= 0 || rightSq <= 0) {
    return {
      n,
      rho: null,
      standardError: null,
      reason: leftSq <= 0 ? "flat-time" : "flat-confidence",
      readable: false,
    };
  }

  const rho = top / Math.sqrt(leftSq * rightSq);
  /*
   * THE BAR IS THE DETECTOR'S OWN, reused rather than invented, for the same reason the
   * population comparison reuses it: the panel must not hold itself to two standards, and a
   * constant chosen here would be one picked to make this cell produce a number.
   *
   * `atanh` is clamped away from ±1 first. A perfectly monotone record gives rho = 1 exactly and
   * `atanh(1)` is Infinity, which clears any multiplier there is -- so the bar would be loudest
   * on the record with the fewest distinct ranks behind it.
   */
  const standardError = 1 / Math.sqrt(n - 3);
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, rho)));
  const readable = Math.abs(z) >= SEPARABILITY_K * standardError;
  return { n, rho, standardError, reason: readable ? "ok" : "inside-noise", readable };
}
