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
import { anchorIdsIn, isAnchorFen } from "./anchor-set.js";
import { populationBucket, type PopulationBucket } from "./population-baseline.js";
import { splitHalfStability, type Stability } from "./stability.js";
import { metacognitiveSensitivity, type Sensitivity } from "./sensitivity.js";
import { sensitivityBand, type SensitivityBand } from "./sensitivity-reference.js";
import { effortFollowsDoubt, type Control } from "./control.js";
import {
  readCounterfactuals,
  type CounterfactualRecordReading,
} from "./counterfactual-reading.js";
import { readVariables, type VariableReading } from "./bucket-variable.js";
import { crossVariables, type CrossingReading } from "./crossing.js";
import { calibrationScore, type CalibrationScore } from "./calibration-score.js";
import { CONFIDENCE_CHOICES, CONFIDENCE_LEVELS, normaliseConfidence } from "./confidence.js";
import {
  BUCKETINGS,
  MIN_BUCKET_N,
  SEPARABILITY_K,
  detect,
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
  /**
   * How this bucket's accuracy compares to the population's, in points, or null when the corpus
   * has no baseline for it.
   *
   * THE POINT OF THIS FIELD. A bucket's accuracy is mostly a property of the bucket: measured on
   * 693,130 real moves, the middlegame is 12.6 points less accurate than everything else FOR
   * EVERYONE, and decisions over two minutes are 14.2 points worse. Telling a player their
   * middlegame accuracy is low is telling them a fact about chess in the second person. Against
   * the baseline it becomes a statement about them.
   *
   * Positive means better than the population in that bucket. Null is not zero: it means nobody
   * measured a baseline here, and a caller must render the two differently.
   */
  versusPopulation: PopulationSeparation | null;
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

/**
 * A bucket's accuracy against the population's, WITH the error on that difference.
 *
 * THE INSTRUMENT WAS HOLDING ITSELF TO TWO STANDARDS ON TWO SCREENS. `findPatterns` will not
 * report a bucket as a finding until its gap sits `SEPARABILITY_K` standard errors from the rest
 * of the record -- that is the whole reason `CalibrationSummary` carries `gapVariance`. This
 * comparison had no standard error anywhere in its path, and the dashboard printed the raw
 * subtraction as a signed figure in the second person: "+14 נק׳ מול כולם".
 *
 * MEASURED. Simulating a player whose true accuracy EQUALS the population's, drawing
 * MIN_BUCKET_N decisions against the real published baselines: a non-zero figure appeared on
 * 100% of draws, five points or more on 71%, ten points or more on 25%. One exactly-average
 * player in four was told they were ten points from everyone.
 *
 * The multiplier is the detector's own, reused rather than invented -- both comparisons run
 * across the same six splits, so the same multiplicity applies, and a fresh constant here would
 * be a threshold chosen to make this screen produce a number.
 */
export type PopulationSeparation = {
  /** Player minus population, in rate units. Positive is better than the population. */
  points: number;
  /** The sampling error of `points`, carried with it because the difference alone is not a claim. */
  standardError: number;
  /**
   * Whether the difference clears the bar. ONLY then is it a statement about the player; below it
   * the two rates are still worth showing side by side, and the difference between them is not.
   */
  separated: boolean;
};

/**
 * Agresti-Coull rather than the textbook `sqrt(p(1-p)/n)`, because of one real record shape.
 *
 * A player accurate on every one of 30 decisions has `p(1-p) = 0`, so the plain estimator returns
 * an error of ZERO and `points / 0` clears any multiplier there is. The bar would then be loudest
 * in exactly the samples that say least. Adding two successes and two failures is the standard
 * remedy and costs nothing away from the boundary.
 */
function proportionStandardError(rate: number, n: number): number {
  const adjustedN = n + 4;
  const adjusted = (rate * n + 2) / adjustedN;
  return Math.sqrt((adjusted * (1 - adjusted)) / adjustedN);
}

export function populationSeparation(
  player: Pick<CalibrationSummary, "n" | "accuracyRate">,
  population: PopulationBucket | null,
): PopulationSeparation | null {
  // Null is not zero: no baseline means nobody measured this bucket, and a caller renders that
  // differently from "measured, and the same".
  if (!population) return null;
  // Below two decisions there is no variance to estimate, which is different from no variation.
  if (player.n < 2) return null;
  const points = player.accuracyRate - population.accuracy;
  /*
   * BOTH SIDES. The corpus is large but finite and a baseline bucket can be as thin as 500 moves,
   * so treating the population rate as exact would understate the error by the most in exactly
   * the buckets where the baseline is weakest.
   */
  const standardError = Math.sqrt(
    proportionStandardError(player.accuracyRate, player.n) ** 2 +
      proportionStandardError(population.accuracy, population.n) ** 2,
  );
  return {
    points,
    standardError,
    separated: Math.abs(points) >= SEPARABILITY_K * standardError,
  };
}

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
  /**
   * What the counterfactual probe has said, with the denominators it came out of.
   *
   * ASSEMBLED FROM THE ATOMS RATHER THAN FROM `ScoredDecision`, for the same reason the branch
   * mix is: the probe lives on the atom, and `ScoredDecision` deliberately carries only what a
   * bucket may look at. Passed in rather than computed here, so this module keeps not knowing
   * about it.
   */
  counterfactual: CounterfactualRecordReading;
  /**
   * The buckets read as VARIABLES rather than as levels, and the variables crossed.
   *
   * Both are readings over `decisions`, computed here rather than passed in, because unlike the
   * probe they need nothing the `ScoredDecision` does not already carry.
   */
  profile: {
    variables: VariableReading;
    crossing: CrossingReading;
  };
  /**
   * The gap above, split into the three things it stands in for.
   *
   * `overall.gap` is one number owned by nobody in particular: it moves when the positions get
   * harder, when the player's judgement changes, and when their willingness to commit changes,
   * and it cannot say which happened. `calibration.uncertainty` is 100% the positions,
   * `calibration.reliability` is the calibration error proper, and only the second is a statement
   * about the player. See shared/calibration-score.ts.
   */
  calibration: CalibrationScore;
  /**
   * The same decomposition over the ANCHOR SET alone -- the positions every player answers.
   *
   * THIS IS THE ONE THAT IS COMPARABLE BETWEEN PLAYERS, and the reason is not statistical
   * sophistication, it is arithmetic: two players who answered the same positions have the same
   * item difficulty, so `uncertainty` is identical for both and whatever separates their scores
   * is the thing this product claims to measure. The reading above it is over whatever positions
   * a player happened to reach, and is comparable to nobody.
   *
   * Empty until a player has taken anchor decisions, and empty is the correct answer there: a
   * comparable reading that nobody has earned yet must not be filled in from the rest.
   */
  anchor: CalibrationScore;
  /**
   * Which bank positions this record has already answered, by id.
   *
   * Carried so the front door can serve the NEXT one without refetching the whole record, and so
   * progress through the set is a fact rather than a guess. Ids rather than positions: the caller
   * that serves them loads the move lists lazily and needs nothing else from here.
   */
  anchorAnswered: readonly string[];
  /**
   * Whether the anchor reading said the same thing twice.
   *
   * Over the ANCHOR subset specifically, because that is the only split that compares like with
   * like: two halves of a free-play record are two different sets of positions, and a difference
   * between them says as much about the positions as about the player. Necessary, not sufficient
   * -- a record that fails this is noise, and one that passes is merely not obviously noise.
   */
  stability: Stability;
  /**
   * The three facets of metacognition this instrument measures, over the anchor set.
   *
   * BIAS is `anchor.reliability` above -- do the words match what happens. SENSITIVITY is whether
   * the confidence separates the accurate decisions from the inaccurate ones, which bias cannot
   * see: a player systematically far too confident can still rank their own decisions perfectly.
   * CONTROL is whether the effort went where the doubt was, which is the half of the faculty the
   * other two do not touch at all.
   *
   * Three of five. Metacognitive EFFICIENCY (meta-d'/d') needs a binary first-order task and
   * choosing a move from thirty options is not one. Metacognitive KNOWLEDGE -- knowing which
   * kinds of position you are bad at -- is not measured here at all.
   *
   * COMPUTED OVER THE WHOLE RECORD, not over the anchor subset, and the difference matters. Both
   * are WITHIN-person questions: whether YOUR confidence separates YOUR right decisions from your
   * wrong ones, and whether YOUR effort went where YOUR doubt was. Neither needs a fixed item
   * bank to be answerable about one player. What the anchor set buys is comparison BETWEEN
   * players, and `anchor` above is where that lives. Restricting these two to the bank as well
   * would leave them empty for everybody in exchange for a comparability they do not claim.
   *
   * The cost is stated on screen: on a player's own games, "took longer" and "felt less sure" are
   * both caused by the position being hard, so `control` in particular is confounded until it is
   * read on shared positions.
   */
  sensitivity: Sensitivity;
  /*
   * What that number looks like in the research literature, among people who were ABOUT AS
   * ACCURATE as this reader.
   *
   * Conditioned on accuracy because that is the dominant term rather than a caveat: across 3,836
   * people in the Confidence Database, Spearman rho between first-order accuracy and AUROC2 is
   * +0.59, and the median climbs 0.53 -> 0.61 -> 0.65 -> 0.73 across accuracy bands. An
   * unconditioned band would tell a strong player they are metacognitively gifted for being good
   * at chess -- the same confound the population baseline removes from the buckets.
   *
   * Null where the corpus has no stratum for this reader's accuracy, or where their own number
   * cannot be read at all. Falling back to the unconditioned band would hand back the confound
   * silently.
   */
  sensitivityReference: SensitivityBand | null;
  control: Control;
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
  /**
   * Defaults to an empty reading rather than to `undefined`, so a caller that has not been
   * updated renders "nothing measured yet" instead of crashing on a missing field -- and so the
   * emptiness is the honest one produced by `readCounterfactuals([])` rather than a shape
   * hand-written here that could drift from it.
   */
  counterfactual: CounterfactualRecordReading = readCounterfactuals([]),
  /**
   * The shared bank's decisions, chosen by the evidence policy and handed in.
   *
   * AN ARGUMENT RATHER THAN A FILTER, and the change is not cosmetic. This used to be
   * `decisions.filter(isAnchorFen)` -- bank membership of the POSITION -- which answers a
   * different question from "was this decision a bank answer". A drill can legitimately run on a
   * bank position, and `decisionPurposeFor` ranks `drill` above `anchor` there because what is
   * being measured is the drill; under the FEN filter that decision walked into the only
   * between-player comparison the product has, where nothing had placed it.
   *
   * DEFAULTS TO EMPTY, NOT TO THE OLD FILTER. A fallback that quietly reproduced the FEN rule
   * would make this parameter dead enforcement: it would read like a boundary while guarding
   * nothing, and a caller that forgot to pass the population would get the old behaviour back
   * without a symptom. Empty produces a visibly unreadable anchor section instead.
   */
  anchored: readonly ScoredDecision[] = [],
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
      /*
       * Only when the split can be read at all. A comparison against a population, computed from
       * eight decisions, is a number with a very confident-looking provenance.
       */
      versusPopulation: measurable
        ? populationSeparation(inside, populationBucket(bucketing.key))
        : null,
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

  const overall = summarise(decisions);
  const sensitivity = metacognitiveSensitivity(decisions);

  return {
    counterfactual,
    profile: {
      variables: readVariables(detect(decisions)),
      crossing: crossVariables(decisions),
    },
    overall,
    calibration: calibrationScore(decisions),
    anchor: calibrationScore(anchored),
    /*
     * FROM THE BANK POPULATION, not from the whole record. This read `anchorIdsIn(decisions)`, so
     * any decision that happened to sit on a bank FEN -- a drill, a transfer check -- counted as
     * that bank position having been answered, and the front door would serve the next one as
     * though the set had progressed.
     */
    anchorAnswered: anchorIdsIn(anchored),
    stability: splitHalfStability(anchored),
    sensitivity,
    /*
     * Only when the reader's own number can be read. A band beside a dash would invite them to
     * read the band as their result, and the literature's median is a very persuasive thing to
     * misread as your own.
     */
    sensitivityReference:
      sensitivity.readable && sensitivity.auroc2 !== null ? sensitivityBand(overall.accuracyRate) : null,
    control: effortFollowsDoubt(decisions),
    buckets,
    confidence,
    scored: decisions.length,
    mix,
  };
}
