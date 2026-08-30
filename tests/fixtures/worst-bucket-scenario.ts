/**
 * Is "your weakest area" calibrated? The null control for `worstBucketVerdict`, shared by the gate
 * and its positive control.
 *
 * THE TWO REASONS TO DOUBT IT, and they push in opposite directions, so the net can only be
 * measured:
 *
 *   SELECTION. The verdict ranks up to NINE overlapping buckets, takes the lowest, and tests it
 *   against the second lowest. The sampling distribution of a MINIMUM is not the sampling
 *   distribution of a pre-specified rate: with nine noisy numbers, the smallest is systematically
 *   low, so `runnerUp - worst` is systematically positive even when every bucket is identical.
 *   A two-standard-error bar derived for one named comparison does not describe that.
 *
 *   OVERLAP. The formula is the textbook standard error for two INDEPENDENT proportions, and these
 *   are not independent: the same decision is in `phase-middlegame` and `fast-under-45s` and
 *   `standing-level` at once. Shared decisions make the two rates covary, which shrinks the true
 *   variance of their difference below what the formula assumes.
 *
 * THE NULL: each decision keeps its own phase, seconds, clock and standing -- so every bucket keeps
 * its real size and its real overlap with every other -- and only the ACCURACY is permuted across
 * decisions. Bucket membership is then unrelated to outcome by construction, so any verdict of
 * "separable" is a false positive. Permuting the outcome rather than the context is what preserves
 * the overlap exactly; permuting context would rebuild it.
 *
 * The record is resampled from `real-shape.json` -- real decisions from real players -- because the
 * question is whether this comparison is calibrated on the records it will actually meet.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { seededRandom, MAX_SHUFFLED_FALSE_POSITIVE_RATE } from "../../shared/detector";
import {
  diagnosticFromDecisions,
  worstBucketVerdict,
  type ImportedDecision,
} from "../../shared/import-diagnostic";

interface RealShape {
  phases: readonly ["opening", "middlegame", "endgame"];
  standings: readonly ["losing", "level", "winning"];
  tuples: Array<[number, number | null, number | null, number, number]>;
}
const REAL_SHAPE: RealShape = JSON.parse(
  readFileSync(fileURLToPath(new URL("./real-shape.json", import.meta.url)), "utf8"),
);

/** A record of real decisions, resampled to size `n`. Deterministic by seed. */
export function realImportRecord(n: number, seed: number): ImportedDecision[] {
  const random = seededRandom(seed);
  return Array.from({ length: n }, (_, index): ImportedDecision => {
    const [phaseIndex, secondsTaken, clockMsRemaining, accurate, standingIndex] =
      REAL_SHAPE.tuples[Math.floor(random() * REAL_SHAPE.tuples.length)];
    return {
      ply: index + 1,
      phase: REAL_SHAPE.phases[phaseIndex],
      secondsTaken,
      clockMsRemaining,
      cpLoss: 0,
      accurate: accurate === 1,
      standing: REAL_SHAPE.standings[standingIndex],
      speed: "blitz",
      forced: false,
      book: false,
    };
  });
}

/** The same decisions with their outcomes permuted. Sizes and overlaps are untouched. */
export function permuteAccuracy(
  decisions: ImportedDecision[],
  random: () => number,
): ImportedDecision[] {
  const outcomes = decisions.map((d) => d.accurate);
  for (let i = outcomes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
  }
  return decisions.map((d, i) => ({ ...d, accurate: outcomes[i] }));
}

export interface WorstBucketReport {
  runs: number;
  runsWithVerdict: number;
  falsePositiveRate: number;
  /** How often a runner-up existed at all, so a rate of zero cannot be read as "never fired". */
  runsWithComparison: number;
}

/** How often the verdict calls a bucket separable on a record where nothing is. */
export function worstBucketControl(
  decisions: ImportedDecision[],
  runs = 200,
  seed = 20260830,
  verdict: (d: ImportedDecision[]) => boolean = defaultVerdict,
): WorstBucketReport {
  const random = seededRandom(seed);
  let runsWithVerdict = 0;
  let runsWithComparison = 0;
  for (let run = 0; run < runs; run += 1) {
    const permuted = permuteAccuracy(decisions, random);
    const reading = worstBucketVerdict(
      diagnosticFromDecisions(permuted, { anyClock: true, bookLoaded: true }),
    );
    if (reading?.runnerUp) runsWithComparison += 1;
    if (verdict(permuted)) runsWithVerdict += 1;
  }
  return {
    runs,
    runsWithVerdict,
    runsWithComparison,
    falsePositiveRate: runsWithVerdict / runs,
  };
}

function defaultVerdict(decisions: ImportedDecision[]): boolean {
  return verdictAt(2)(decisions);
}

/** The same code at a chosen bar, so the gate and its control differ in one number and nothing else. */
export function verdictAt(standardErrors: number) {
  return (decisions: ImportedDecision[]): boolean =>
    worstBucketVerdict(
      diagnosticFromDecisions(decisions, { anyClock: true, bookLoaded: true }),
      standardErrors,
    )?.separable === true;
}

/**
 * The bar for the positive control: ONE standard error, the textbook one for a named comparison,
 * and the number a reasonable person might have picked without thinking about selection.
 *
 * It is the right control precisely because it is not a straw man. Measured on these records it
 * names a weakest bucket in 3.5%-5.5% of permuted imports against a 2% ceiling -- so the doubling
 * to two standard errors is doing real work rather than decorating the formula.
 */
export const PERMISSIVE_STANDARD_ERRORS = 1;

/** Import-sized records: a 20-game scan lands in the middle of this range. */
export const IMPORT_RECORDS = [200, 400, 800, 1600].map((n) => realImportRecord(n, 4100 + n));

/** Generic in the result type so the gate runner's own GateResult flows through unwidened. */
export function worstBucketVerdictReport<R>(
  records: ImportedDecision[][],
  verdict: (d: ImportedDecision[]) => boolean,
  pass: (detail: string) => R,
  fail: (detail: string) => R,
): R {
  let worst = 0;
  let worstN = 0;
  let comparisons = 0;
  let total = 0;
  for (const record of records) {
    for (let seedOffset = 1; seedOffset <= 3; seedOffset += 1) {
      const report = worstBucketControl(record, 150, 20260830 + seedOffset, verdict);
      comparisons += report.runsWithComparison;
      total += report.runs;
      if (report.falsePositiveRate > worst) {
        worst = report.falsePositiveRate;
        worstN = record.length;
      }
    }
  }
  const asPct = `${(worst * 100).toFixed(1)}%`;
  const ceiling = `${(MAX_SHUFFLED_FALSE_POSITIVE_RATE * 100).toFixed(0)}%`;
  /* A rate of zero means nothing if no comparison was ever available to get wrong. */
  const coverage = `${((comparisons / total) * 100).toFixed(0)}% of runs had a runner-up to compare`;
  return worst > MAX_SHUFFLED_FALSE_POSITIVE_RATE
    ? fail(
        `weakest bucket named on permuted outcomes: ${asPct} of records at n=${worstN} (max ${ceiling}); ${coverage}`,
      )
    : pass(
        `permuted outcomes name a weakest bucket ${asPct} of the time (max ${ceiling}); ${coverage}`,
      );
}
