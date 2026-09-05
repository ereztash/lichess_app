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
  splitByBucket,
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
  /**
   * How many more decisions the SMALLER SIDE needs before the split can be read.
   *
   * THE SMALLER SIDE AND NOT `inside`, which is what it used to be and which reported 0 whenever
   * the comparison set was the short one -- a bucket that cannot be read, saying it needs nothing.
   * `whatIsUnclear` renders this figure as "N more decisions", so the wrong side meant a player
   * being told a split was ready when it was not.
   */
  shortBy: number;
  /**
   * Why it cannot be read, when it cannot. THREE REASONS, AND ONLY ONE OF THEM IS A WAIT.
   *
   * "too-few" is a wait. "no-clock-data" is not: the record holds no clock at all, so the bucket
   * can never fill, and telling that player to record more decisions is advice that cannot work.
   * A local game against Stockfish has no clock, and a Lichess export carries none unless the
   * user ticked the option -- so this is the common case, not the edge case.
   *
   * "one-side-empty" IS THE THIRD, AND IT WAS FOUND BY MEASURING RATHER THAN BY READING. On a
   * realistic 3+0 blitz record of 480 decisions -- median think time 3.9 seconds, longest 9.8 --
   * `fast-under-45s` comes out 480 inside and 0 outside, and `slow-over-2m` comes out 0 and 480.
   * Two of the six splits are structurally dead on the route this product built to measure time
   * pressure, and one of them is the bucket the entire product narrative rests on.
   *
   * REPORTED SEPARATELY BECAUSE THE ADVICE IS OPPOSITE. "Too few" says keep going. An empty side on
   * a record this size says the threshold sits outside the range this player's games produce, and
   * no amount of the same play moves it -- so a screen that told them to keep playing would be
   * spending their time on something the instrument cannot give them.
   */
  unmeasurableReason: "too-few" | "no-clock-data" | "one-side-empty" | null;
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
  /**
   * Decisions this reading is computed over: revealed AND carrying a stated confidence.
   *
   * THE SUMMARY LINE USED TO SAY "decisions that have been revealed", and the two are not the
   * same set. `scoreDecisions` drops a revealed decision whose `confidence` is null -- which
   * since the ask rule became a sample is most of them -- so the number is smaller than the
   * revealed count and always will be. Three surfaces spent it on a sentence about reveals: this
   * comment, `RecordDashboard`'s "עוד לא נחשפה אף החלטה", and the ribbon, which recovered a wait
   * by subtracting this from the recorded count. All three told a player that a decision the
   * engine had already answered was still waiting for it.
   *
   * The two counts below are the ones those sentences needed, and they are carried rather than
   * derived precisely so nobody has to subtract again.
   */
  scored: number;
  /**
   * Decisions the engine has not passed verdict on. A wait, and it ends by itself.
   */
  awaitingReveal: number;
  /**
   * Decisions revealed on a position where the confidence question was not put.
   *
   * NOT A WAIT. `scoreDecisions` documents the distinction at source and returns both counts;
   * `RecordReading` did not carry either, so every consumer that wanted one had to invent it.
   * This one never becomes scoreable -- no arrangement of the future changes what was asked at
   * the time -- and a screen that tells the player to keep going describes a problem they do not
   * have.
   */
  withoutConfidence: number;
  /**
   * Decisions of this player's that are read under another heading, with another denominator.
   *
   * THE THIRD REASON `scored` IS ZERO, and the two counts above are both blind to it.
   * `shared/evidence-policy.ts` files `anchor`, `drill`, `transfer` and `import` decisions as
   * `separate` from `descriptive-history` -- correctly: the shared bank has its own denominator,
   * a drill is taken while being taught, an import is a different loop. `recordReading` computes
   * `awaitingReveal` and `withoutConfidence` over the DESCRIBED atoms alone, so a bank decision
   * that was committed, revealed and scored is in neither, and `scored === 0` fell through to
   * "עוד לא נחשפה אף החלטה" -- said to a player on the same screen that had just revealed three.
   *
   * IT MOVES NO DENOMINATOR. `scored` still excludes every decision counted here and `anchor`
   * still carries the bank ones under their own heading. This is the number that makes the
   * SENTENCE correct, not the number any floor is measured against.
   */
  readElsewhere: number;
  /**
   * The measurement regimes this reading is NOT over, each with the decisions it holds.
   *
   * NOT A DENOMINATOR AND NOT A WAIT. Every count above is about decisions this reading could not
   * use; these are decisions it declines to POOL. `shared/evidence-policy.ts` groups the described
   * population by the conditions that make two decisions comparable -- protocol, its version,
   * reveal timing, the engine build that passed the verdict -- and this page reads one of them,
   * for the reason `reveal-timing.ts` gives: a decision taken twenty moves into a coached game was
   * made by somebody who had been told, twenty times, how their last move scored, and one taken in
   * a deferred game was not. An average over the two describes nobody.
   *
   * EMPTY ON EVERY RECORD WITH ONE REGIME, which is every record written before reveal timing
   * existed. Carried rather than dropped because a reading whose `n` shrank has to be able to say
   * what it left out, and "read nowhere" is a different sentence from `readElsewhere`'s.
   */
  setAside: readonly { readonly id: string; readonly n: number }[];
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
  mix: OneThingMix = { n: 0, counts: { "chose-past-it": 0, "confident-and-wrong": 0, outplayed: 0, "trusted-it-too-little": 0 }, silent: 0, eligible: 0, withheld: 0 },
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
  /**
   * What `scoreDecisions` set aside, and why it set each one aside.
   *
   * Carried rather than recomputed here, because this function only ever sees the decisions that
   * survived the filter -- it cannot tell how many did not, or which of the two reasons applied.
   * `ScoringSummary` already separates them and says in as many words that one is a wait and the
   * other is not; the reading dropped the distinction and the ribbon rebuilt it by subtraction,
   * which can only produce the wrong one.
   *
   * DEFAULTS TO TWO ZEROES, which is a silence and not the old behaviour. A caller that has not
   * been updated makes a smaller claim -- nothing is waiting, nothing was passed over -- rather
   * than the previous one, which was that every unscored decision was waiting for the engine.
   */
  unscored: {
    readonly awaitingReveal: number;
    readonly withoutConfidence: number;
    readonly readElsewhere: number;
  } = {
    awaitingReveal: 0,
    withoutConfidence: 0,
    readElsewhere: 0,
  },
  /**
   * The regimes the caller chose not to read, named and counted. See `RecordReading.setAside`.
   *
   * A PARAMETER RATHER THAN A GROUPING DONE HERE, for the reason `anchored` is one: which
   * decisions are one population is `shared/evidence-policy.ts`'s only question to answer, and a
   * second grouping rule living in the reader would be a second authority that could drift from it.
   * `ScoredDecision` deliberately carries only what a bucket may look at, so this reader could not
   * see a regime boundary even if it wanted to.
   */
  setAside: readonly { readonly id: string; readonly n: number }[] = [],
): RecordReading {
  // One pass, not one per bucket: whether any decision carries a clock is a property of the
  // record, and it decides which of the two silences the clock bucket reports.
  const anyClock = decisions.some((d) => d.clockMsRemaining !== null);

  const buckets: BucketReading[] = BUCKETINGS.map((bucketing) => {
    /*
     * `splitByBucket` RATHER THAN TWO FILTERS, AND THIS WAS A LIVE DEFECT.
     *
     * The two filters were `predicate` and `!predicate`, which puts a decision the bucket CANNOT
     * READ into the comparison set. `bucketable` exists precisely to stop that, and its own comment
     * describes the failure in as many words: "we could not measure how long this took" becomes
     * "this took more than 45 seconds", which is the same fabrication pointing the other way, and
     * it moves the baseline the bucket is judged against. The detector was repaired; this reading,
     * which draws the chart the player actually looks at, was still doing it.
     *
     * IT MATTERS MOST ON IMPORTED GAMES, which is where `secondsTaken` is null: a PGN without clock
     * comments has no think times, so every one of those decisions was being counted as slow.
     */
    const sides = splitByBucket(bucketing, decisions);
    const inside = summarise(sides.inside);
    const outside = summarise(sides.outside);
    const measurable = inside.n >= MIN_BUCKET_N && outside.n >= MIN_BUCKET_N;
    const noClock = bucketing.requiresClock === true && !anyClock;
    /*
     * AN EMPTY SIDE ON A RECORD BIG ENOUGH TO HAVE FILLED IT is a division that does not divide,
     * not a shortage. Zero is the test rather than "small", because zero is unambiguous: not one
     * decision in a record of this size fell on that side of the line, so the threshold sits
     * outside the range these games produce.
     *
     * THE SIZE CONDITION IS WHAT KEEPS IT HONEST. A record of ten decisions with nothing over two
     * minutes says nothing about anything; the same record at sixty says the line is in the wrong
     * place for this player.
     */
    const readable = inside.n + outside.n;
    const emptySide =
      readable >= MIN_BUCKET_N * 2 && Math.min(inside.n, outside.n) === 0;
    return {
      key: bucketing.key,
      scope: bucketing.scope,
      inside,
      outside,
      measurable,
      shortBy: Math.max(0, MIN_BUCKET_N - Math.min(inside.n, outside.n)),
      unmeasurableReason: measurable
        ? null
        : noClock
          ? "no-clock-data"
          : emptySide
            ? "one-side-empty"
            : "too-few",
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
    awaitingReveal: unscored.awaitingReveal,
    withoutConfidence: unscored.withoutConfidence,
    readElsewhere: unscored.readElsewhere,
    setAside,
    mix,
  };
}
