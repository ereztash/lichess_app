/**
 * The shuffled-label scenario, shared by GATE-SHUFFLE and its positive control (section 6).
 *
 * "Before shipping any detector, run it against SHUFFLED LABELS -- the player's decisions with
 * clock and phase randomly permuted. If it still produces confident-looking patterns, it is a
 * noise generator and the threshold is wrong."
 *
 * Both the gate and the control run this identical harness. Only the thresholds differ.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONFIDENCE_LEVELS, CONFIDENCE_STEP, normaliseConfidence } from "../../shared/confidence";
import {
  BUCKETINGS,
  MAX_SHUFFLED_FALSE_POSITIVE_RATE,
  MIN_BUCKET_N,
  seededRandom,
  shuffleControl,
  splitByBucket,
  type DetectorThresholds,
  type ScoredDecision,
} from "../../shared/detector";

/** A position that is deliberately NOT in the anchor set: these are free-play records. */
const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A record with NO relationship between context and calibration. Deterministic by seed. */
export function makeNoise(n: number, seed: number): ScoredDecision[] {
  const random = seededRandom(seed);
  return Array.from({ length: n }, (_, index) => ({
    decision_id: `noise-${index}`,
    fen: NON_ANCHOR_FEN,
    confidence: normaliseConfidence(1 + Math.floor(random() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS),
    accurate: random() < 0.5,
    phase: (["opening", "middlegame", "endgame"] as const)[Math.floor(random() * 3)],
    secondsTaken: Math.floor(random() * 200),
    clockMsRemaining: Math.floor(random() * 300_000),
  }));
}

/**
 * The shape real decisions actually have, and the half a corpus can never carry.
 *
 * `makeNoise` above draws phase uniformly, seconds uniformly over 0-200 and the clock uniformly
 * over five minutes. Real online chess looks nothing like that: on the 1,572 real decisions in
 * `real-shape.json` the median think time is 2 seconds, 99.9% of decisions fall under 45, and
 * six in a thousand exceed two minutes. A false-positive rate measured on the uniform record is a
 * statement about a world the product does not run in.
 *
 * TUPLES, NOT MARGINALS. Whole (phase, seconds, clock, accurate) rows are resampled, so the joint
 * structure survives -- real endgame decisions do arrive with low clocks, and rebuilding the record
 * from four independent histograms would quietly test an easier world than the real one.
 *
 * CONFIDENCE IS SUPPLIED HERE, drawn independently of everything else, because nobody asked those
 * players how sure they were and nobody ever can. That is the permanent hole in any imported
 * corpus, and it is the right shape for this job anyway: independent confidence means there is no
 * association to find, so anything the detector reports is a false positive by construction.
 */
interface RealShape {
  phases: readonly ["opening", "middlegame", "endgame"];
  tuples: Array<[number, number | null, number | null, number]>;
  source: Record<string, unknown>;
}
const REAL_SHAPE: RealShape = JSON.parse(
  readFileSync(fileURLToPath(new URL("./real-shape.json", import.meta.url)), "utf8"),
);

export const REAL_SHAPE_SOURCE = REAL_SHAPE.source;

/** A record with real context marginals and NO relationship to confidence. Deterministic by seed. */
export function makeRealShaped(n: number, seed: number): ScoredDecision[] {
  const random = seededRandom(seed);
  return Array.from({ length: n }, (_, index) => {
    const [phaseIndex, secondsTaken, clockMsRemaining, accurate] =
      REAL_SHAPE.tuples[Math.floor(random() * REAL_SHAPE.tuples.length)];
    return {
      decision_id: `real-${index}`,
      fen: NON_ANCHOR_FEN,
      confidence: normaliseConfidence(
        1 + Math.floor(random() * CONFIDENCE_LEVELS),
        CONFIDENCE_LEVELS,
      ),
      accurate: accurate === 1,
      phase: REAL_SHAPE.phases[phaseIndex],
      secondsTaken,
      clockMsRemaining,
    };
  });
}

export const realShapedRecord = [40, 60, 80, 120, 200, 300, 600, 1200].map((n) =>
  makeRealShaped(n, 907 + n),
);

/**
 * Which buckets a record can even be asked about: both sides need MIN_BUCKET_N before the detector
 * will compare them.
 *
 * Reported because a false-positive rate is only reassuring if the buckets it covers are the
 * buckets that exist. A bucket that holds every decision has an empty comparison set and is
 * skipped -- silently, and for a reason that has nothing to do with the player.
 */
export function comparableBuckets(record: ScoredDecision[]): string[] {
  return BUCKETINGS.filter((bucketing) => {
    const { inside, outside } = splitByBucket(bucketing, record);
    return inside.length >= MIN_BUCKET_N && outside.length >= MIN_BUCKET_N;
  }).map((b) => b.key);
}

/**
 * Record sizes spanning cold start through a mature record.
 *
 * IT USED TO STOP AT 300, and that is where the detector's worst behaviour was hiding. A fixed
 * effect-size floor is hardest to clear on noise at LARGE n -- the estimate converges on zero --
 * so the gate was testing the region where the old rule looked best and never the region where
 * it went silent on real effects. The separability test has the opposite profile: its false
 * positive rate is roughly flat in n, so the large sizes are exactly where a multiplier set too
 * low would show. They are in the gate now because the rule changed.
 */
export const noiseRecord = [40, 60, 80, 120, 200, 300, 600, 1200].map((n) => makeNoise(n, 7 + n));

/**
 * A multiplier low enough to find structure in noise, for the positive control.
 *
 * The first draft's 12 / CONFIDENCE_STEP cannot be written in this shape any more -- there is no fixed gap
 * floor to set -- so the control is the same idea expressed in the new parameter: two standard
 * errors, which is the textbook bar and is far too permissive for a six-bucket scan. Measured on
 * these records it reports structure in roughly a quarter of shuffled records at every size past
 * cold start, against 2% allowed.
 */
export const PERMISSIVE_THRESHOLDS: DetectorThresholds = {
  minBucketN: 12,
  separabilityK: 2.0,
};

/** Generic in the result type so the gate runner's own GateResult flows through unwidened. */
export function shuffleVerdict<R>(
  records: ScoredDecision[][],
  thresholds: DetectorThresholds,
  pass: (detail: string) => R,
  fail: (detail: string) => R,
): R {
  let worst = 0;
  let worstN = 0;
  for (const record of records) {
    for (let seedOffset = 1; seedOffset <= 3; seedOffset += 1) {
      const report = shuffleControl(record, 150, 20260821 + seedOffset, thresholds);
      if (report.falsePositiveRate > worst) {
        worst = report.falsePositiveRate;
        worstN = record.length;
      }
    }
  }
  const asPct = `${(worst * 100).toFixed(1)}%`;
  const ceiling = `${(MAX_SHUFFLED_FALSE_POSITIVE_RATE * 100).toFixed(0)}%`;
  /*
   * THE CAVEAT TRAVELS WITH THE PASS, because a low false-positive rate is only reassuring if the
   * buckets it covers are the buckets that exist. On real-shaped records `fast-under-45s` and
   * `slow-over-2m` are never comparable at any size -- 99.9% of real decisions take under 45
   * seconds and six in a thousand exceed two minutes, so one side or the other never reaches
   * MIN_BUCKET_N. Part of the reason the rate is low there is that a third of the search space
   * does not exist, and a gate that reported only the rate would be hiding that.
   */
  const largest = records[records.length - 1] ?? [];
  const comparable = comparableBuckets(largest);
  const coverage = `${comparable.length}/${BUCKETINGS.length} buckets comparable at n=${largest.length}`;
  return worst > MAX_SHUFFLED_FALSE_POSITIVE_RATE
    ? fail(
        `detector finds structure in noise: ${asPct} of shuffled records at n=${worstN} (max ${ceiling})`,
      )
    : pass(
        `shuffled labels produce ${asPct} false positives, worst case (max ${ceiling}); ${coverage}`,
      );
}
