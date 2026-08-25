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
import { CONFIDENCE_CHOICES, CONFIDENCE_LEVELS, normaliseConfidence } from "./confidence.js";
import {
  BUCKETINGS,
  MIN_BUCKET_N,
  summarise,
  type CalibrationSummary,
  type ScoredDecision,
} from "./detector.js";
import type { OneThingMix } from "./reveal.js";

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
  /**
   * The claim as a percentage -- 5, 20, 35, 50, 65, 80, 95 on the current scale.
   *
   * NOT the button number, which does not survive a scale change: 4 asserted 0.75 on the old
   * five-level scale and asserts 0.50 on this one, so a record holding both would put two
   * different claims on one label.
   */
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
  /**
   * Which of the reveal's four sentences the record actually produced.
   *
   * A reading of the INSTRUMENT, not of the player: `chose-past-it` is the one finding here that
   * no other chess tool can make, and whether it can carry any weight depends on how often it
   * fires -- which nobody has ever measured. Assembled in `recordReading` rather than here,
   * because it needs the atoms and `readRecord` only ever sees scored decisions.
   */
  mix: OneThingMix;
};

/**
 * Read the record.
 *
 * Every bucket is reported, including the ones that cannot be read yet -- silence with a stated
 * reason, not an absent row. A screen that simply omits the buckets it cannot measure looks like
 * a screen that measured everything.
 */
export function readRecord(
  decisions: ScoredDecision[],
  mix: OneThingMix = { n: 0, counts: { "chose-past-it": 0, "confident-and-wrong": 0, outplayed: 0, "trusted-it-too-little": 0 }, silent: 0, eligible: 0 },
): RecordReading {
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

  /*
   * THE LEVELS COME FROM THE SCALE AND FROM THE RECORD, and both halves are load-bearing.
   *
   * From the scale, so every level shows even when nobody stated it -- an unstated level with
   * n = 0 and a null observation is information, and dropping the row would let the chart imply
   * the scale is narrower than it is.
   *
   * From the record, because a record can hold decisions stated on MORE THAN ONE SCALE. The five
   * -level grid ran 0/.25/.5/.75/1 and the seven-level grid is inset at .05/.95; they share only
   * even odds. Plotting the current grid alone would have silently dropped every older decision
   * except that one -- a chart quietly computed over a subset of its own denominator, which is
   * the exact failure GATE-DENOM exists for.
   *
   * `stated` is therefore the claim itself as a percentage, not the button number. A button
   * number is meaningless across scales: 4 asserted 0.75 then and asserts 0.50 now, so two rows
   * would collide on one label and mean different things.
   */
  const claims = new Set<number>(
    CONFIDENCE_CHOICES.map((level) => normaliseConfidence(level, CONFIDENCE_LEVELS)),
  );
  for (const decision of decisions) claims.add(decision.confidence);
  const confidence: ConfidenceReading[] = [...claims]
    .sort((a, b) => a - b)
    .map((claimed) => {
      const at = decisions.filter((d) => Math.abs(d.confidence - claimed) < 1e-9);
      return {
        stated: Math.round(claimed * 100),
        claimed,
        observed: at.length ? at.filter((d) => d.accurate).length / at.length : null,
        n: at.length,
      };
    });

  return { overall: summarise(decisions), buckets, confidence, scored: decisions.length, mix };
}
