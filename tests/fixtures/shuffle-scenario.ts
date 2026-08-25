/**
 * The shuffled-label scenario, shared by GATE-SHUFFLE and its positive control (section 6).
 *
 * "Before shipping any detector, run it against SHUFFLED LABELS -- the player's decisions with
 * clock and phase randomly permuted. If it still produces confident-looking patterns, it is a
 * noise generator and the threshold is wrong."
 *
 * Both the gate and the control run this identical harness. Only the thresholds differ.
 */
import {
  MAX_SHUFFLED_FALSE_POSITIVE_RATE,
  normaliseConfidence,
  seededRandom,
  shuffleControl,
  type DetectorThresholds,
  type ScoredDecision,
} from "../../shared/detector";

/** A record with NO relationship between context and calibration. Deterministic by seed. */
export function makeNoise(n: number, seed: number): ScoredDecision[] {
  const random = seededRandom(seed);
  return Array.from({ length: n }, (_, index) => ({
    decision_id: `noise-${index}`,
    confidence: normaliseConfidence(1 + Math.floor(random() * 5)),
    accurate: random() < 0.5,
    phase: (["opening", "middlegame", "endgame"] as const)[Math.floor(random() * 3)],
    secondsTaken: Math.floor(random() * 200),
    clockMsRemaining: Math.floor(random() * 300_000),
  }));
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
 * The first draft's 12 / 0.25 cannot be written in this shape any more -- there is no fixed gap
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
  return worst > MAX_SHUFFLED_FALSE_POSITIVE_RATE
    ? fail(
        `detector finds structure in noise: ${asPct} of shuffled records at n=${worstN} (max ${ceiling})`,
      )
    : pass(`shuffled labels produce ${asPct} false positives, worst case (max ${ceiling})`);
}
