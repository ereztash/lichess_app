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
 * A candidate pattern is a bucket whose calibration gap differs from the rest of the record by
 * more than MIN_GAP_DIFFERENCE, with at least MIN_BUCKET_N decisions on each side. Those
 * thresholds are not taste: they are set so that SHUFFLED labels produce nothing (GATE-SHUFFLE).
 */
import type { DecisionAtom } from "./decision-atom.js";

/** A decision counts as accurate when it cost no more than this. Engine noise, not skill. */
export const ACCURATE_CP_LOSS = 30;
/**
 * THESE TWO NUMBERS WERE SET BY THE SHUFFLED-LABEL CONTROL, NOT BY TASTE.
 *
 * The first draft used 12 / 0.25. Run against SHUFFLED labels -- the same decisions with clock,
 * phase and time-taken randomly permuted, which destroys any real relationship while preserving
 * every marginal distribution -- that detector reported a pattern on pure noise:
 *
 *     thresholds        shuffled false-positive rate, by record size
 *                       n=40    n=80   n=120   n=200   n=300
 *     12 / 0.25         53.3%   50.9%   23.6%    9.6%    0.9%     <- first draft
 *     20 / 0.35         28.9%   14.9%    4.2%    0.4%    0.0%
 *     30 / 0.45          0.0%    0.2%    0.2%    0.2%    0.0%     <- shipped
 *     40 / 0.45          0.0%    0.0%    0.0%    0.0%    0.0%
 *
 * A planted, unambiguous pattern is still detected at every setting above, so the stricter
 * thresholds cost sensitivity to a real effect only in how long they take to see it.
 *
 * COLD START, the price paid (section 6): with 30 / 0.45 a strong real pattern is first
 * reported at roughly 60-90 recorded decisions, against roughly 30 with the first draft. For a
 * casual player that is weeks, not days. That is a product finding, and it belongs in the README
 * rather than buried -- see docs/MEASUREMENTS.md.
 *
 * Raising these makes the product quieter. LOWERING THEM MAKES IT A NOISE GENERATOR.
 */
export const MIN_BUCKET_N = 30;
export const MIN_GAP_DIFFERENCE = 0.45;

/**
 * The most false positives on shuffled labels this build tolerates. GATE-SHUFFLE fails above it.
 * Measured worst case at the shipped thresholds is 0.7%.
 */
export const MAX_SHUFFLED_FALSE_POSITIVE_RATE = 0.02;

export interface ScoredDecision {
  decision_id: string;
  /** Stated confidence mapped to 0..1, so it is comparable with an accuracy rate. */
  confidence: number;
  accurate: boolean;
  phase: DecisionAtom["entry_state"]["phase"];
  secondsTaken: number;
  clockMsRemaining: number | null;
}

/** Confidence 1..5 -> 0..1. A 3 means "even odds", which is 0.5. */
export const normaliseConfidence = (confidence: number) => (confidence - 1) / 4;

export interface CalibrationSummary {
  n: number;
  meanConfidence: number;
  accuracyRate: number;
  /** Positive = overconfident. Negative = underconfident. */
  gap: number;
}

export function summarise(decisions: ScoredDecision[]): CalibrationSummary {
  if (decisions.length === 0) return { n: 0, meanConfidence: 0, accuracyRate: 0, gap: 0 };
  const meanConfidence = decisions.reduce((total, d) => total + d.confidence, 0) / decisions.length;
  const accuracyRate = decisions.filter((d) => d.accurate).length / decisions.length;
  return {
    n: decisions.length,
    meanConfidence,
    accuracyRate,
    gap: meanConfidence - accuracyRate,
  };
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
  predicate: (decision: ScoredDecision) => boolean;
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
  { key: "phase-opening", scope: "החלטות בפתיחה", predicate: (d) => d.phase === "opening" },
  {
    key: "phase-middlegame",
    scope: "החלטות באמצע המשחק",
    predicate: (d) => d.phase === "middlegame",
  },
  { key: "phase-endgame", scope: "החלטות בסיום", predicate: (d) => d.phase === "endgame" },
  {
    key: "clock-under-1m",
    scope: "החלטות עם פחות מדקה על השעון",
    predicate: (d) => d.clockMsRemaining !== null && d.clockMsRemaining < 60_000,
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
  minGapDifference: number;
}

export const DEFAULT_THRESHOLDS: DetectorThresholds = {
  minBucketN: MIN_BUCKET_N,
  minGapDifference: MIN_GAP_DIFFERENCE,
};

export function detect(
  decisions: ScoredDecision[],
  thresholds: DetectorThresholds = DEFAULT_THRESHOLDS,
): CandidatePattern[] {
  const candidates: CandidatePattern[] = [];
  for (const bucketing of BUCKETINGS) {
    const inside = decisions.filter(bucketing.predicate);
    const outside = decisions.filter((d) => !bucketing.predicate(d));
    if (inside.length < thresholds.minBucketN || outside.length < thresholds.minBucketN) continue;

    const insideSummary = summarise(inside);
    const outsideSummary = summarise(outside);
    const gapDifference = insideSummary.gap - outsideSummary.gap;
    if (Math.abs(gapDifference) < thresholds.minGapDifference) continue;

    candidates.push({
      key: bucketing.key,
      scope: bucketing.scope,
      inside: insideSummary,
      outside: outsideSummary,
      gapDifference,
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
): ShuffleReport {
  const random = seededRandom(seed);
  let runsWithPatterns = 0;
  for (let run = 0; run < runs; run += 1) {
    if (detect(shuffleLabels(decisions, random), thresholds).length > 0) runsWithPatterns += 1;
  }
  return { runs, runsWithPatterns, falsePositiveRate: runsWithPatterns / runs };
}
