/**
 * The record, measured.
 *
 * Phase 3 of the merge: the part neither repository had. chess-mind-patterns measures positions;
 * lichess_app records decisions. This measures the decisions -- calibration, by the same buckets
 * the detector is allowed to look at, and by the confidence the player actually stated.
 *
 * It reuses `summarise` and `BUCKETINGS` rather than recomputing anything. A dashboard that
 * measured calibration its own way would eventually disagree with the claim panel, and then two
 * screens in the same product would be making different statements about the same record.
 *
 * R1 runs through all of it: every figure carries its n, and a bucket under MIN_BUCKET_N reports
 * that it is not measurable instead of reporting a number. That is the whole credibility of the
 * thing -- a calibration gap over six decisions is noise wearing a percentage sign.
 */
import {
  BUCKETINGS,
  MIN_BUCKET_N,
  summarise,
  type CalibrationSummary,
  type ScoredDecision,
} from "./detector.js";

export type BucketReading = {
  key: string;
  scope: string;
  inside: CalibrationSummary;
  outside: CalibrationSummary;
  /** False when either side is under MIN_BUCKET_N: the split cannot be read yet. */
  measurable: boolean;
  /** How many more decisions inside the bucket are needed before it can be read. */
  shortBy: number;
  /**
   * Why it cannot be read, when it cannot.
   *
   * "too-few" is a wait. "no-clock-data" is not: the record holds no clock at all, so the bucket
   * can never fill, and telling that player to record more decisions is advice that cannot work.
   * A local game against Stockfish has no clock, and a Lichess export carries none unless the
   * user ticked the option -- so this is the common case, not the edge case.
   */
  unmeasurableReason: "too-few" | "no-clock-data" | null;
};

export type ConfidenceReading = {
  /** The 1..5 the player chose, as stated. */
  stated: number;
  /** What that confidence claims, 0..1. */
  claimed: number;
  /** What actually happened, 0..1. Undefined when nothing was decided at this level. */
  observed: number | null;
  n: number;
};

export type RecordReading = {
  overall: CalibrationSummary;
  buckets: BucketReading[];
  confidence: ConfidenceReading[];
  /** Decisions that have been revealed, and so can be scored at all. */
  scored: number;
};

/**
 * Read the record.
 *
 * Every bucket is reported, including the ones that cannot be read yet -- silence with a stated
 * reason, not an absent row. A screen that simply omits the buckets it cannot measure looks like
 * a screen that measured everything.
 */
export function readRecord(decisions: ScoredDecision[]): RecordReading {
  // One pass, not one per bucket: whether any decision carries a clock is a property of the
  // record, and it decides which of the two silences the clock bucket reports.
  const anyClock = decisions.some((d) => d.clockMsRemaining !== null);

  const buckets: BucketReading[] = BUCKETINGS.map((bucketing) => {
    const inside = summarise(decisions.filter(bucketing.predicate));
    const outside = summarise(decisions.filter((d) => !bucketing.predicate(d)));
    const measurable = inside.n >= MIN_BUCKET_N && outside.n >= MIN_BUCKET_N;
    const noClock = bucketing.requiresClock === true && !anyClock;
    return {
      key: bucketing.key,
      scope: bucketing.scope,
      inside,
      outside,
      measurable,
      shortBy: Math.max(0, MIN_BUCKET_N - inside.n),
      unmeasurableReason: measurable ? null : noClock ? "no-clock-data" : "too-few",
    };
  });

  const confidence: ConfidenceReading[] = [1, 2, 3, 4, 5].map((stated) => {
    // normaliseConfidence maps 1..5 onto 0..1; compare against it rather than against the raw 1..5.
    const claimed = (stated - 1) / 4;
    const at = decisions.filter((d) => Math.abs(d.confidence - claimed) < 1e-9);
    return {
      stated,
      claimed,
      observed: at.length ? at.filter((d) => d.accurate).length / at.length : null,
      n: at.length,
    };
  });

  return { overall: summarise(decisions), buckets, confidence, scored: decisions.length };
}
