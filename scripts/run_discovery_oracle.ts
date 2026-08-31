/**
 * THE BRIDGE BETWEEN THE RESEARCH ORACLE AND THE SHIPPED DETECTOR.
 *
 * `research/discovery-oracle/` asks two questions about this product that cannot be answered by
 * reading it: whether the uncertainty it reports is the uncertainty the data support, and whether
 * the six-bucket search survives the same end-to-end harness Discovery V2 would be judged by.
 *
 * BOTH QUESTIONS ARE ABOUT THE SHIPPED CODE, so the harness must run the shipped code. A Python
 * reimplementation of `detect` would be a second definition of the product's own rule, and the
 * first thing it would do is diverge -- quietly, in the direction that makes the audit read
 * better. `research/blitz/dataset.py` already states the division this follows: *"the semantics
 * belong to the modules the product itself uses. Python's job here is statistics, not
 * definitions."*
 *
 * So the split is: Python generates worlds and does inference, THIS runs the product's search on
 * them, and nothing about what a bucket is, what a gap is or what clears a threshold exists twice.
 *
 * COLUMNAR INPUT, and it is not premature optimisation. The null harness pushes several million
 * decisions through this process; a JSON object per decision costs more in `JSON.parse` than the
 * whole detector costs in arithmetic, and the run stops being repeatable in a coffee break.
 *
 *   stdin   one record per line, six parallel arrays plus the derivation/validation split
 *   stdout  one result per line: the six-bucket scan, the claim selected, the prospective test
 *
 * The confidence LEVEL crosses the pipe, never a probability: `normaliseConfidence` is the
 * product's map from a stated level to a number, and the oracle is not entitled to its own.
 */
import { createInterface } from "node:readline";

import { CONFIDENCE_LEVELS, normaliseConfidence } from "../shared/confidence";
import { readVariables } from "../shared/bucket-variable";
import { attribution } from "../shared/discovery/attribution";
import {
  BUCKETINGS,
  DEFAULT_THRESHOLDS,
  PREREGISTERED_THRESHOLDS,
  decisionGap,
  detect,
  splitByBucket,
  summarise,
  type DetectorThresholds,
  type ScoredDecision,
} from "../shared/detector";

/**
 * One simulated record, columnar.
 *
 * `split` is the index where the derivation half ends and the prospective half begins, and it is
 * always a GAME boundary in the generator. A split inside a game would put two halves of one
 * player's afternoon on both sides of a wall the whole experiment exists to enforce.
 */
interface RecordLine {
  id: string;
  world: string;
  /** Game index per decision. The unit the generator clusters on, and the unit Python resamples. */
  g: number[];
  /** Phase per decision: 0 opening, 1 middlegame, 2 endgame. */
  ph: number[];
  /** Seconds taken, or null where nothing measured it. */
  st: (number | null)[];
  /** Clock remaining in ms, or null. */
  cl: (number | null)[];
  /** Stated confidence LEVEL, 1..CONFIDENCE_LEVELS. */
  cf: number[];
  /** Whether the engine's rule called the move accurate. */
  ac: number[];
  split: number;
  /** Emit the per-bucket membership of the derivation half. Off by default: it is the bulk. */
  masks?: boolean;
  /**
   * Emit each bucket's two SIZES on the derivation half, whether or not it cleared.
   *
   * OFF BY DEFAULT AND SEPARATE FROM `masks`, because it answers a different question and costs a
   * different amount. `masks` emits every index, which is the bulk of the output; this emits twelve
   * integers. Both need a second full six-bucket split, which is real work per record on a harness
   * that pushes millions of decisions, so neither is on unless a study asks.
   *
   * WHY ANY STUDY WOULD ASK. `cleared` lists the buckets that PASSED the separability test, and a
   * table of zeroes there cannot tell "never separated" from "never had two sides to compare". On a
   * blitz-only record those are the two different things R-18 is about.
   */
  sides?: boolean;
}

const PHASES = ["opening", "middlegame", "endgame"] as const;

function scoredFrom(line: RecordLine, from: number, to: number): ScoredDecision[] {
  const out: ScoredDecision[] = [];
  for (let i = from; i < to; i += 1) {
    out.push({
      decision_id: String(i),
      // The detector never reads it; ScoredDecision requires it, and an empty string would be a
      // lie about a position rather than an absence.
      fen: "-",
      confidence: normaliseConfidence(line.cf[i], CONFIDENCE_LEVELS),
      accurate: line.ac[i] === 1,
      phase: PHASES[line.ph[i]],
      secondsTaken: line.st[i],
      clockMsRemaining: line.cl[i],
    });
  }
  return out;
}

/** What one bucket looked like on one half of one record, whether or not it cleared. */
interface BucketReport {
  key: string;
  insideN: number;
  outsideN: number;
  insideGap: number;
  outsideGap: number;
  insideVar: number;
  outsideVar: number;
  gapDifference: number;
  /** Null where the sample cannot estimate its own error. `detect` skips these, and so does this. */
  standardError: number | null;
  /** Whether it cleared at the thresholds this half was searched under. */
  fired: boolean;
  /** Indices INSIDE the bucket, and the readable indices it was measured against. Only with masks. */
  inside?: number[];
  outside?: number[];
}

function report(
  scored: ScoredDecision[],
  thresholds: DetectorThresholds,
  offset: number,
  wantMasks: boolean,
  onlyKey?: string | null,
): BucketReport[] {
  const searched = onlyKey ? BUCKETINGS.filter((b) => b.key === onlyKey) : BUCKETINGS;
  return searched.map((bucketing) => {
    const { inside, outside } = splitByBucket(bucketing, scored);
    const insideSummary = summarise(inside);
    const outsideSummary = summarise(outside);
    const gapDifference = insideSummary.gap - outsideSummary.gap;
    /*
     * RECOMPUTED HERE RATHER THAN READ OFF `detect`, and the difference is the point of the
     * report: `detect` returns only what CLEARED, and an audit of a null world needs the buckets
     * that did not clear just as much -- they are the denominator of every rate below.
     */
    const se =
      insideSummary.n < 2 ||
      outsideSummary.n < 2 ||
      insideSummary.gapVariance <= 0 ||
      outsideSummary.gapVariance <= 0
        ? null
        : Math.sqrt(
            insideSummary.gapVariance / insideSummary.n + outsideSummary.gapVariance / outsideSummary.n,
          );
    const bigEnough =
      inside.length >= thresholds.minBucketN && outside.length >= thresholds.minBucketN;
    return {
      key: bucketing.key,
      insideN: insideSummary.n,
      outsideN: outsideSummary.n,
      insideGap: insideSummary.gap,
      outsideGap: outsideSummary.gap,
      insideVar: insideSummary.gapVariance,
      outsideVar: outsideSummary.gapVariance,
      gapDifference,
      standardError: se,
      fired: bigEnough && se !== null && Math.abs(gapDifference) >= thresholds.separabilityK * se,
      ...(wantMasks
        ? {
            inside: inside.map((d) => Number(d.decision_id) + offset),
            outside: outside.map((d) => Number(d.decision_id) + offset),
          }
        : {}),
    };
  });
}

function handle(line: RecordLine): unknown {
  const derivation = scoredFrom(line, 0, line.split);
  const validation = scoredFrom(line, line.split, line.g.length);

  /*
   * THE SHIPPED CHAIN, IN THE ORDER THE PRODUCT RUNS IT.
   *
   *   detect          -- the six-bucket scan, DEFAULT_THRESHOLDS
   *   readVariables   -- three variables, not six buckets, and one level of each survives
   *   selectClaim     -- one claim, the strongest surviving level (claim-derivation.ts)
   *
   * `selectClaim` itself is not called: it builds Hebrew sentences and a refutation condition,
   * none of which the harness reads, and calling it would drag a claim id and a timestamp through
   * a simulation that has neither. What IS reproduced is its selection rule, which is
   * `readVariables(...).findings[0].strongest` -- the same expression, on the same input.
   */
  const patterns = detect(derivation, DEFAULT_THRESHOLDS);
  const findings = readVariables(patterns).findings;
  const selected = findings.length > 0 ? findings[0].strongest : null;

  /*
   * THE PROSPECTIVE HALF. One bucket, named before these decisions were looked at, tested at the
   * thresholds the product reserves for exactly that case -- `detect`'s `onlyBucketKey` with
   * PREREGISTERED_THRESHOLDS. This is not a second search. It is the one test the freeze bought.
   */
  const confirmation =
    selected === null
      ? null
      : report(validation, PREREGISTERED_THRESHOLDS, line.split, false, selected.key)[0];

  /*
   * VALIDATED means: it cleared prospectively AND IN THE SAME DIRECTION. A bucket that separated
   * one way on the derivation games and the other way on the validation games has been refuted,
   * not replicated, and counting it as a confirmation is how a chain with a 5% error rate reports
   * a 2.5% one.
   */
  const validated =
    selected !== null &&
    confirmation !== null &&
    confirmation.fired &&
    Math.sign(confirmation.gapDifference) === Math.sign(selected.gapDifference);

  /*
   * THE ATTRIBUTION STATISTIC, AND NOT ITS VERDICT.
   *
   * `attribution()` takes a `k` and answers yes or no. What crosses this pipe is the underlying
   * quantity -- the largest |z| over the readable splits of the claimed bucket -- so Python can
   * sweep every candidate threshold from ONE run of the chain. Emitting a verdict would fix `k`
   * here and make the sweep a sweep of re-runs, each one paying for the whole search again.
   *
   * It is the same split this repository already makes elsewhere: `discoverySearchPopulation`
   * separates the engineering fix from the scientific choice so that one cannot ride inside the
   * other. Reporting the statistic and choosing the threshold in the experiment is that rule
   * applied to the harness.
   *
   * ON THE VALIDATION HALF, which is the only half it may read. Run on the derivation games it
   * would be asking whether the search that chose this bucket could have chosen a narrower one --
   * a question about the search, inheriting the search's own selection.
   *
   * `k = 0` makes every readable split "break", which is how the report is coaxed into ranking
   * them by |z| regardless of any threshold. The number this reads off is `worst.z`.
   */
  const attributionReport = selected === null ? null : attribution(selected.key, validation, 0);
  const readableSplits = attributionReport?.splits.filter((s) => s.unreadable === null) ?? [];
  const worst = readableSplits
    .slice()
    .sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0))[0];

  return {
    id: line.id,
    world: line.world,
    derivation: report(derivation, DEFAULT_THRESHOLDS, 0, line.masks === true),
    /*
     * Null when no claim was formed, or when the claimed bucket was too small to split, or when
     * every split of it was one-sided. Those are three different silences and Python counts them
     * apart: "we could not look" must not be read as "we looked and it was fine".
     */
    attribution:
      attributionReport === null
        ? null
        : {
            n: attributionReport.n,
            readable: readableSplits.length,
            maxAbsZ: worst?.z === undefined || worst.z === null ? null : Math.abs(worst.z),
            splitBy: worst?.key ?? null,
            /* True when the split's own inside is the more overconfident half: the region carrying it. */
            carriesExcess: worst ? worst.gapDifference > 0 : null,
            unreadableBecause:
              attributionReport.verdict.kind === "unreadable"
                ? attributionReport.verdict.because
                : null,
          },
    /*
     * THE SIZES, WHEN ASKED. Computed from the same `report` the rest of this file uses, so a
     * bucket that is empty here is empty by the product's own `splitByBucket` -- including its
     * `bucketable` guard, which is the whole reason a decision with no think time is in neither
     * side rather than in the comparison set.
     */
    sides:
      line.sides !== true
        ? undefined
        : Object.fromEntries(
            report(derivation, DEFAULT_THRESHOLDS, 0, false).map((b) => [
              b.key,
              { inside: b.insideN, outside: b.outsideN },
            ]),
          ),
    cleared: patterns.map((p) => p.key),
    findings: findings.length,
    selected: selected === null ? null : selected.key,
    selectedGapDifference: selected?.gapDifference ?? null,
    selectedStandardError: selected?.standardError ?? null,
    selectedInsideN: selected?.inside.n ?? null,
    confirmation,
    validated,
    /*
     * The per-decision gap, so the clustered estimator in Python is measuring the SAME quantity
     * this file measured. Recomputing `confidence - accurate` there would put the confidence
     * scale in two places, and the scale has already moved once.
     */
    gap: line.masks === true ? [...derivation, ...validation].map(decisionGap) : undefined,
  };
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const out: string[] = [];
  for await (const raw of rl) {
    if (!raw.trim()) continue;
    out.push(JSON.stringify(handle(JSON.parse(raw) as RecordLine)));
    // Flush in blocks: one write per record makes the syscalls the bottleneck, and holding every
    // result to the end makes the process's memory a function of the experiment's size.
    if (out.length >= 256) {
      process.stdout.write(out.join("\n") + "\n");
      out.length = 0;
    }
  }
  if (out.length) process.stdout.write(out.join("\n") + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
