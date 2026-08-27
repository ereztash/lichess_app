/**
 * The pattern detector (Layer B input).
 *
 * "The single most likely failure of this product is a pattern detector that finds structure in
 * noise and reports it fluently." Everything here is shaped by that sentence.
 *
 * The measure is the CALIBRATION GAP (section 6): the distance between stated confidence and
 * realised accuracy, bucketed by position class. It is the one number worth optimising, because
 * it is a property of the player's decision policy rather than their opening knowledge, and
 * because both halves come from outside the product's own opinion -- confidence is the player's,
 * accuracy is the engine's.
 *
 * A candidate pattern is a bucket whose calibration gap is SEPARABLE from the rest of the
 * record -- further from it than the sampling error of the difference, by a multiplier set so
 * that SHUFFLED labels produce nothing (GATE-SHUFFLE) -- with at least MIN_BUCKET_N decisions on
 * each side.
 *
 * IT USED TO BE A FIXED EFFECT-SIZE FLOOR, and that is the defect this file was rebuilt around.
 * A constant compared against a point estimate has no dependence on n, so as the record grows and
 * the estimate converges the test stops firing on any real effect below the constant. Measured on
 * identical records, a true effect of 0.255 (13 accuracy points plus half a point of stated
 * confidence -- coaching scale):
 *
 *                        n=120   n=300   n=600  n=1200  n=2400
 *     fixed floor 0.45    0.9%    0.2%    0.0%    0.0%    0.0%
 *     separable           4.6%   42.9%   91.0%   99.9%  100.0%
 *
 * The old row is the finding: **the only times the shipped detector fired on a sub-threshold real
 * effect were the times it was wrong**, and it got quieter about the truth the longer you played.
 */
import type { DecisionAtom } from "./decision-atom.js";
import type { Phase } from "./phase.js";
import { winProbabilityLoss } from "./win-probability.js";

/**
 * A decision counts as accurate when it cost no more than this. Engine noise, not skill.
 *
 * NO LONGER THE OUTCOME RULE ITSELF -- see ACCURATE_WIN_PROBABILITY_LOSS below, which is derived
 * from this and is what a decision is actually judged against. Thirty centipawns is not one event:
 * it costs 2.76 points of winning chances at a level position and 0.28 at +10.00, so calibration
 * against it was calibration against a moving target. This constant survives as the anchor that
 * fixes the new threshold at the one evaluation where it was defensible.
 */
export const ACCURATE_CP_LOSS = 30;

/**
 * What a decision is judged against: the share of the player's winning chances it gave away.
 *
 * DERIVED from ACCURATE_CP_LOSS rather than chosen, so the continuity between the old rule and
 * this one is a fact of the code and not a coincidence the next edit could break in silence.
 *
 * ANCHORED AT THE WORST CASE, NOT AT A LEVEL POSITION, and a test is the reason. The win
 * probability a fixed centipawn loss costs is greatest when the interval it spans straddles zero
 * symmetrically -- at an evaluation of half the loss, not at zero:
 *
 *     position stood at   -30cp    0cp   +15cp   +30cp   +120cp
 *     30cp costs          2.742  2.759   2.761   2.759    2.660  points
 *
 * Anchoring at zero would therefore make the new rule very slightly STRICTER than the old one
 * across a narrow band around +15cp, and a decision that used to be accurate would silently stop
 * being so. Anchored at the peak it costs 0.08% more tolerance and buys an invariant worth far
 * more than that: no decision the old rule called accurate is called inaccurate by this one.
 * The change is a pure relaxation, and only where the old rule was over-strict.
 */
export const ACCURATE_WIN_PROBABILITY_LOSS = winProbabilityLoss(
  ACCURATE_CP_LOSS / 2,
  ACCURATE_CP_LOSS,
);
/**
 * The smallest bucket, and the smallest remainder, this detector will read at all.
 *
 * Kept at 30 through the change from a fixed floor to a separability test. It is doing different
 * work now: it is not controlling false positives -- the multiplier below does that at every size
 * -- it is refusing to compute a standard error from a handful of decisions, where the sample
 * variance is itself too noisy for the test built on it to mean anything.
 *
 * It is also what governs cold start now. A bucket like `fast-under-45s` holds roughly a fifth of
 * a record, so 30 inside means well over a hundred decisions before the bucket can be read at all.
 */
export const MIN_BUCKET_N = 30;

/**
 * HOW MANY STANDARD ERRORS A BUCKET MUST SIT FROM THE REST BEFORE IT IS REPORTED.
 *
 * SET BY THE SHUFFLED-LABEL CONTROL, NOT BY TASTE -- the same control that set the number it
 * replaced. Shuffling permutes clock, phase and time-taken across decisions, destroying any real
 * relationship while preserving every marginal distribution, so anything the detector reports
 * afterwards is noise by construction.
 *
 * MEASURED ON THE CONTROL'S OWN HARNESS, which is the part that decided this number. GATE-SHUFFLE
 * takes ONE record and permutes it hundreds of times -- the spec's requirement, "the player's
 * decisions with clock and phase randomly permuted" -- and that is a harder null than drawing a
 * fresh record per run, because a single record can be systematically unlucky and the gate reports
 * the WORST cell. Calibrated the easy way first, 3.25 looked clear at 1.1%; on the gate's harness
 * across ten independent base records it touches 2.0%, which is the ceiling exactly. Ten base
 * records per size, 300 shuffles each, worst cell of the ten:
 *
 *     k       n=120   n=300   n=600  n=1200
 *     3.25     2.0%    1.7%    2.0%    1.0%   <- at the ceiling; passes on a strict inequality
 *     3.50     1.7%    0.7%    0.7%    0.7%
 *     3.75     1.0%    0.3%    0.3%    0.3%   <- shipped
 *     4.00     0.3%    0.0%    0.3%    0.0%
 *
 * The ceiling is MAX_SHUFFLED_FALSE_POSITIVE_RATE, 2%. 3.75 is the smallest multiplier measured
 * that leaves half the ceiling as margin; a gate that passes at exactly its limit is one unlucky
 * draw from red and teaches people to re-run it.
 *
 * WHAT IT COSTS, on a planted coach-scale effect, 2000 fresh records per cell: 4.6% at n=120,
 * 42.9% at n=300, 91.0% at n=600, 99.9% at n=1200. The DIRECTION is the point. The number it
 * replaced went 0.9% -> 0.0% over the same range, and on an effect sitting exactly ON the old
 * floor it was a permanent coin flip that no amount of play resolved -- 49.4% at n=300 and 50.3%
 * at n=2400 -- because a point estimate against a line is not a test.
 */
export const SEPARABILITY_K = 3.75;

/**
 * The floor for a bucket that was NAMED IN ADVANCE, and the measurement that set it.
 *
 * A hypothesis registered before the decisions were recorded is tested with `detect`'s
 * `onlyBucketKey`, so the run gets one bucket instead of six. That restriction is what makes a
 * lower n legal, and the number came from the shuffled-label control rather than from wanting
 * the product to speak sooner. Worst case over all six possible pre-named buckets, gap held at
 * MIN_GAP_DIFFERENCE:
 *
 *     n = 30    pre-named 0.7%    six-bucket scan 0.7%
 *     n = 25    pre-named 1.3%    six-bucket scan 2.0%
 *     n = 20    pre-named 1.3%    six-bucket scan 2.7%   <- shipped here
 *     n = 15    pre-named 5.3%    six-bucket scan 6.0%
 *
 * At n = 20 the six-bucket scan is over the 2% ceiling and the pre-named bucket is under it. So
 * the restriction is not a formality attached to a threshold someone wanted anyway -- it is the
 * only reason this row is allowed to exist.
 *
 * Measured cold start on a planted pattern, 20 seeds: median first claim moves from 65 decisions
 * to 45. Both detected it in 20 of 20.
 */
export const PREREGISTERED_MIN_BUCKET_N = 20;

/**
 * The multiplier for a bucket NAMED IN ADVANCE -- and it overturns what this file used to record.
 *
 * Under the fixed floor, pre-registration bought a lower n and nothing else, and the comment here
 * said so in as many words: "Pre-registration buys n, not gap." That was measured and it was
 * true, and it was true for a reason nobody wrote down -- a fixed effect-size floor does no
 * multiplicity work at all, so removing five of the six chances to clear could not lower it.
 *
 * A separability multiplier IS the multiplicity control, so the same experiment now comes out the
 * other way. Gate harness, ten independent base records per size, 300 shuffles each, one
 * pre-named bucket at minBucketN 20, worst cell of the ten:
 *
 *     k       n=120   n=300   n=600  n=1200  n=2400
 *     2.50     3.3%    3.0%    2.3%    2.3%    2.7%   <- over the 2% ceiling
 *     2.75     1.7%    2.3%    1.3%    1.3%    1.3%   <- over it at n=300
 *     3.00     1.0%    1.0%    1.0%    0.7%    0.7%   <- shipped
 *
 * 3.00 against 3.75 for the scan. Naming the bucket first now buys n AND the bar, which is what
 * the design assumed before the first measurement said otherwise. The earlier finding is left
 * above rather than deleted: it was correct about the detector it was measured on.
 *
 * The margin is real but smaller than the arithmetic of "six tests instead of one" suggests, and
 * the reason is the one already recorded above: the six bucketings are not six independent tests.
 * Three phase buckets partition the same decisions and the two clock buckets overlap heavily.
 *
 * RAISED FROM 3.00 TO 3.25 WHEN THE CONFIDENCE SCALE WENT FROM FIVE LEVELS TO SEVEN, and the
 * reason is worth writing down because it is not obvious: a FINER scale made the detector LESS
 * safe. Confidence drawn uniformly over the levels has variance 0.125 on five and 0.090 on seven
 * -- 72% of what it was -- because the seven-level grid is inset at .05/.95 and no longer reaches
 * the ends. Less variance in the stated half means a smaller standard error of the gap
 * difference, and the separability threshold IS a multiple of that standard error. So the same k
 * became a lower bar, and noise started clearing it.
 *
 * RE-MEASURED ON THE SAME HARNESS THAT SET IT, worst false-positive rate over every bucketing,
 * five record sizes and twelve seeds:
 *
 *     k       3.00    3.05    3.10    3.15    3.20    3.25    3.50    3.75
 *     rate   2.50%   2.50%   2.50%   2.50%   2.50%   1.67%   1.67%   1.67%
 *
 * 3.25 is where it stops breaching the 2% ceiling, and nothing above it measures any better --
 * the rate is 2 fires in 120 shuffles from there all the way up, so a larger k would cost power
 * and buy nothing. THE OLD THREE-SEED NULL WAS TOO WEAK TO SEE THIS: at three seeds 3.10 already
 * looked clean, and it is not. The seed count in the control moved with the constant.
 */
export const PREREGISTERED_SEPARABILITY_K = 3.25;

/**
 * The most false positives on shuffled labels this build tolerates. GATE-SHUFFLE fails above it.
 * Measured worst case at the shipped thresholds is 0.7%.
 */
export const MAX_SHUFFLED_FALSE_POSITIVE_RATE = 0.02;

export interface ScoredDecision extends BucketableDecision {
  decision_id: string;
  /**
   * The position the decision was taken on.
   *
   * Carried so anchor-set membership can be DERIVED rather than stored: a flag written at commit
   * time would go stale the moment the bank changed, and would need a column and a migration to
   * say something the position already says. The detector itself never reads it -- it is here for
   * `readRecord` to split the record on.
   */
  fen: string;
  /** Stated confidence mapped to 0..1, so it is comparable with an accuracy rate. */
  confidence: number;
  accurate: boolean;
}

/**
 * The part of a decision a bucket is allowed to look at.
 *
 * Split out of ScoredDecision because no predicate below reads `confidence` or `accurate` -- they
 * read time, phase and clock, all three of which a finished imported game already carries. The
 * one thing an imported game cannot carry is the stated confidence, which is exactly the thing
 * this product exists to measure.
 *
 * So the same six buckets can be applied to imported games without inventing a second list. A
 * second list would drift, and then two screens in one product would disagree about what "under
 * 45 seconds" means.
 */
export interface BucketableDecision {
  phase: DecisionAtom["entry_state"]["phase"];
  secondsTaken: number;
  clockMsRemaining: number | null;
}

/**
 * The gap of a SINGLE decision: what the player said, minus what happened.
 *
 * The whole separability test is built on this one quantity rather than on confidence and
 * accuracy separately, and the reason is not tidiness. `gap` is the mean of this over a bucket,
 * so its sampling variance is exactly `variance(this) / n` -- no independence assumption
 * anywhere. Treating the gap as "mean confidence minus accuracy rate" and adding their two
 * variances would assume confidence and accuracy are independent WITHIN a bucket, and the entire
 * premise of this product is that they are not: a player who is overconfident in a position class
 * is one whose confidence and accuracy move apart there.
 */
export const decisionGap = (decision: ScoredDecision): number =>
  decision.confidence - (decision.accurate ? 1 : 0);

export interface CalibrationSummary {
  n: number;
  meanConfidence: number;
  accuracyRate: number;
  /** Positive = overconfident. Negative = underconfident. */
  gap: number;
  /**
   * Sample variance of the per-decision gap, so a caller can compute the standard error of `gap`
   * as `sqrt(gapVariance / n)`. Zero for fewer than two decisions, where there is no variance to
   * estimate rather than no variation.
   */
  gapVariance: number;
}

export function summarise(decisions: ScoredDecision[]): CalibrationSummary {
  if (decisions.length === 0)
    return { n: 0, meanConfidence: 0, accuracyRate: 0, gap: 0, gapVariance: 0 };
  const meanConfidence = decisions.reduce((total, d) => total + d.confidence, 0) / decisions.length;
  const accuracyRate = decisions.filter((d) => d.accurate).length / decisions.length;
  const gap = meanConfidence - accuracyRate;
  // Bessel-corrected: this is an estimate of the population variance from a sample, and at
  // n = MIN_BUCKET_N the difference between /n and /(n-1) is not decorative.
  const gapVariance =
    decisions.length < 2
      ? 0
      : decisions.reduce((total, d) => total + (decisionGap(d) - gap) ** 2, 0) /
        (decisions.length - 1);
  return { n: decisions.length, meanConfidence, accuracyRate, gap, gapVariance };
}

/**
 * The standard error of the DIFFERENCE between two calibration gaps.
 *
 * The two samples are disjoint by construction -- a decision is inside a bucket or outside it, and
 * a drill's decisions are excluded from its own baseline -- so the variances add.
 *
 * EITHER SIDE DEGENERATE IS ENOUGH TO REFUSE, and this used to require BOTH.
 *
 * The old guard was `se > 0`, which only rejects when the sum is zero -- that is, when neither
 * side varies. A bucket where every decision carries the same stated confidence and the same
 * outcome has a sample variance of exactly 0, and if the OTHER side varies normally the sum is
 * comfortably positive. The pooled error then reduces to `sqrt(varOut / nOut)` and the degenerate
 * bucket is treated as though its gap were known exactly, which makes almost any difference clear
 * the threshold.
 *
 * MEASURED, by simulation against a TRUE NULL where both sides have identical gaps: an opening
 * bucket at book-move accuracy, played by someone who anchors on one confidence value there,
 * fires on up to 13% of records -- against this product's own 2% ceiling, and tracking the
 * degeneracy rate one-for-one. The triggering configuration is the most likely real one rather
 * than an exotic corner, which is why the guard is here and not in a caller.
 *
 * A zero sample variance is not certainty about the gap. It is a sample that cannot estimate its
 * own error, and the honest response to that is the same as to a sample of one: say so and stop.
 */
export function gapDifferenceStandardError(
  a: Pick<CalibrationSummary, "n" | "gapVariance">,
  b: Pick<CalibrationSummary, "n" | "gapVariance">,
): number | null {
  if (a.n < 2 || b.n < 2) return null;
  if (a.gapVariance <= 0 || b.gapVariance <= 0) return null;
  return Math.sqrt(a.gapVariance / a.n + b.gapVariance / b.n);
}

export interface Bucketing {
  /**
   * Stable ASCII identifier. A claim's id is derived from this, so the same pattern keeps the
   * same claim across queries and can accumulate prospective drill results rather than being
   * rediscovered as a fresh hypothesis every time.
   */
  key: string;
  /** What distinguishes this bucket, in the player's terms. Becomes the claim's scope. */
  scope: string;
  predicate: (decision: BucketableDecision) => boolean;
  /**
   * True when the bucket cannot be filled at all without clock data. A record with no clocks
   * makes this bucket structurally unreadable, which is a different fact from "not enough
   * decisions yet" and must not render as the same sentence.
   */
  requiresClock?: true;
  /**
   * The phase a drill position must classify as for it to be inside this bucket -- and, by its
   * absence, whether a drill can be built for this bucket AT ALL.
   *
   * WHY A BUCKET NEEDS TO SAY THIS. A claim's stored refutation condition promises "בדריל של
   * עמדות מ-{scope}". Three of these buckets are properties of a POSITION, so a drill can honour
   * that by choosing positions. The other three are properties of the DECISION EVENT -- how long
   * the player took, what the clock said -- and no choice of positions can put a player under
   * time pressure. Selection ignored the distinction and simply took the first fresh positions of
   * the loaded game, which are its opening; an endgame claim was drilled on eight opening
   * positions and graded terminally on the result.
   *
   * So this field is what `beginDrill` filters on when it is set, and what it refuses on when it
   * is not. It is deliberately not a general predicate: a predicate over positions would invite
   * the same over-reach, because the honest answer for a time bucket is that there is no such
   * predicate.
   */
  drillPhase?: Phase;
}

/**
 * The buckets the detector is allowed to look at.
 *
 * This list is FIXED and short on purpose. A detector free to invent its own splits will find
 * one that separates any dataset, which is the definition of finding structure in noise.
 */
export const BUCKETINGS: Bucketing[] = [
  {
    key: "fast-under-45s",
    scope: "החלטות תחת פחות מ-45 שניות",
    predicate: (d) => d.secondsTaken < 45,
  },
  {
    key: "slow-over-2m",
    scope: "החלטות אחרי יותר משתי דקות",
    predicate: (d) => d.secondsTaken > 120,
  },
  {
    key: "phase-opening",
    scope: "החלטות בפתיחה",
    predicate: (d) => d.phase === "opening",
    drillPhase: "opening",
  },
  {
    key: "phase-middlegame",
    scope: "החלטות באמצע המשחק",
    predicate: (d) => d.phase === "middlegame",
    drillPhase: "middlegame",
  },
  {
    key: "phase-endgame",
    scope: "החלטות בסיום",
    predicate: (d) => d.phase === "endgame",
    drillPhase: "endgame",
  },
  {
    key: "clock-under-1m",
    scope: "החלטות עם פחות מדקה על השעון",
    predicate: (d) => d.clockMsRemaining !== null && d.clockMsRemaining < 60_000,
    requiresClock: true,
  },
];

export interface CandidatePattern {
  /** Stable identifier for the bucketing that produced this. */
  key: string;
  scope: string;
  inside: CalibrationSummary;
  outside: CalibrationSummary;
  /** How far the bucket's gap sits from the rest of the record. */
  gapDifference: number;
  /**
   * The sampling error of `gapDifference`, carried with it because the difference alone is not a
   * finding. `gapDifference / standardError` is how many standard errors this bucket sits from
   * the rest, and it is the quantity that had to clear the multiplier -- section 4.4 asks a value
   * to arrive with what makes it readable, and for this one that is its own error.
   */
  standardError: number;
  supporting_decision_ids: string[];
  /** What the claim predicts, and therefore what would refute it (R5). */
  predicts_overconfidence: boolean;
}

/**
 * Find candidate patterns. Returns nothing when nothing clears the thresholds, which is the
 * common and correct outcome on a small record.
 */
export interface DetectorThresholds {
  minBucketN: number;
  /** How many standard errors of the difference a bucket must sit from the rest. */
  separabilityK: number;
}

export const DEFAULT_THRESHOLDS: DetectorThresholds = {
  minBucketN: MIN_BUCKET_N,
  separabilityK: SEPARABILITY_K,
};

/**
 * Thresholds for a bucket named in advance. Legal ONLY together with `detect`'s `onlyBucketKey`
 * -- see PREREGISTERED_MIN_BUCKET_N and PREREGISTERED_SEPARABILITY_K for the two measurements.
 */
export const PREREGISTERED_THRESHOLDS: DetectorThresholds = {
  minBucketN: PREREGISTERED_MIN_BUCKET_N,
  separabilityK: PREREGISTERED_SEPARABILITY_K,
};

export function detect(
  decisions: ScoredDecision[],
  thresholds: DetectorThresholds = DEFAULT_THRESHOLDS,
  /**
   * Search ONE named bucket instead of all six.
   *
   * This is not a filter applied to the results -- it is a narrower search, and the difference
   * is the whole point. Scanning six buckets and reporting the one that cleared is six chances
   * to clear; testing a bucket named in advance is one. That is why the thresholds this is run
   * with can be lower than DEFAULT_THRESHOLDS without the false-positive rate rising, and why
   * `PREREGISTERED_THRESHOLDS` is a measurement rather than a preference.
   *
   * A key that names no bucketing throws. A hypothesis pointing at a bucket that no longer
   * exists is a bug in whatever stored it, and returning "no patterns" would hide it behind the
   * most ordinary result this function has.
   */
  onlyBucketKey?: string | null,
): CandidatePattern[] {
  const searched = onlyBucketKey
    ? BUCKETINGS.filter((bucketing) => bucketing.key === onlyBucketKey)
    : BUCKETINGS;
  if (onlyBucketKey && !searched.length) {
    throw new Error(`detect: no bucketing named "${onlyBucketKey}"`);
  }
  const candidates: CandidatePattern[] = [];
  for (const bucketing of searched) {
    const inside = decisions.filter(bucketing.predicate);
    const outside = decisions.filter((d) => !bucketing.predicate(d));
    if (inside.length < thresholds.minBucketN || outside.length < thresholds.minBucketN) continue;

    const insideSummary = summarise(inside);
    const outsideSummary = summarise(outside);
    const gapDifference = insideSummary.gap - outsideSummary.gap;
    /*
     * SEPARABLE, not merely different. Six measurements always differ; the question is whether
     * this one differs by more than the sampling error of the difference itself -- the same test
     * `worstBucketVerdict` has always applied on the import screen, which was statistically sound
     * while the detector the product LEADS on was not.
     *
     * A null standard error is a degenerate sample, not overwhelming evidence, and is skipped.
     */
    const standardError = gapDifferenceStandardError(insideSummary, outsideSummary);
    if (standardError === null) continue;
    if (Math.abs(gapDifference) < thresholds.separabilityK * standardError) continue;

    candidates.push({
      key: bucketing.key,
      scope: bucketing.scope,
      inside: insideSummary,
      outside: outsideSummary,
      gapDifference,
      standardError,
      supporting_decision_ids: inside.map((d) => d.decision_id),
      predicts_overconfidence: gapDifference > 0,
    });
  }
  // The unit of output is ONE claim (section 3.5). Ordering by support makes "the one with the
  // most supporting decisions" well defined; the caller shows that one and counts the rest.
  return candidates.sort((a, b) => b.inside.n - a.inside.n);
}

/**
 * A seeded generator, so the shuffled-label control is deterministic. A flaky gate is worse
 * than no gate: it teaches people to re-run until it passes.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/**
 * Permute the LABELS (clock, phase, time taken) across decisions while leaving confidence and
 * accuracy attached to their original decision.
 *
 * This destroys any real relationship between context and calibration while preserving every
 * marginal distribution. A detector that still reports patterns here is a noise generator.
 */
export function shuffleLabels(decisions: ScoredDecision[], random: () => number): ScoredDecision[] {
  const labels = decisions.map((d) => ({
    phase: d.phase,
    secondsTaken: d.secondsTaken,
    clockMsRemaining: d.clockMsRemaining,
  }));
  for (let i = labels.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return decisions.map((d, i) => ({ ...d, ...labels[i] }));
}

export interface ShuffleReport {
  runs: number;
  runsWithPatterns: number;
  falsePositiveRate: number;
}

/** Run the detector against shuffled labels. Used by GATE-SHUFFLE and callable in the app. */
export function shuffleControl(
  decisions: ScoredDecision[],
  runs = 200,
  seed = 20260821,
  thresholds: DetectorThresholds = DEFAULT_THRESHOLDS,
  /** Measure a single pre-named bucket rather than the six-bucket scan. See `detect`. */
  onlyBucketKey?: string | null,
): ShuffleReport {
  const random = seededRandom(seed);
  let runsWithPatterns = 0;
  for (let run = 0; run < runs; run += 1) {
    if (detect(shuffleLabels(decisions, random), thresholds, onlyBucketKey).length > 0) {
      runsWithPatterns += 1;
    }
  }
  return { runs, runsWithPatterns, falsePositiveRate: runsWithPatterns / runs };
}
