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

/** Record sizes spanning cold start through a mature record. */
export const noiseRecord = [40, 60, 80, 120, 200, 300].map((n) => makeNoise(n, 7 + n));

/** The thresholds this build started with. Measured at up to 53% false positives. */
export const PERMISSIVE_THRESHOLDS: DetectorThresholds = {
  minBucketN: 12,
  minGapDifference: 0.25,
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
