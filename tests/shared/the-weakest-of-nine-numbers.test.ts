/**
 * Whether "your weakest area" is a finding or the lowest of nine noisy numbers.
 *
 * `worstBucketVerdict` ranks up to NINE overlapping buckets, takes the lowest, and tests it against
 * the second lowest with the textbook standard error for two INDEPENDENT proportions. Two things
 * about that are wrong on their face and they push in opposite directions, so neither can be
 * reasoned to a conclusion:
 *
 *   - the minimum of nine noisy rates is systematically low, so the gap to the runner-up is
 *     systematically positive even when every bucket is identical;
 *   - the buckets are not independent -- one decision is in `phase-middlegame` and `fast-under-45s`
 *     and `standing-level` at once -- which makes the two rates covary and shrinks the true
 *     variance of their difference below what the formula assumes.
 *
 * So it was measured. The null keeps every decision's real bucket memberships and permutes only the
 * OUTCOME, which preserves the overlap exactly; see tests/fixtures/worst-bucket-scenario.ts and
 * GATE-WORST-BUCKET. The answer is that the comparison does not over-claim -- and that it is
 * conservative enough to be nearly silent at the sizes a real import produces, which is the finding
 * this file exists to pin.
 */
import { describe, expect, it } from "vitest";
import {
  diagnosticFromDecisions,
  resolutionFactor,
  worstBucketVerdict,
} from "../../shared/import-diagnostic";
import {
  IMPORT_RECORDS,
  permuteAccuracy,
  realImportRecord,
  worstBucketControl,
} from "../../tests/fixtures/worst-bucket-scenario";
import { seededRandom } from "../../shared/detector";

const read = (decisions: Parameters<typeof diagnosticFromDecisions>[0]) =>
  worstBucketVerdict(diagnosticFromDecisions(decisions, { anyClock: true, bookLoaded: true }));

describe("the bar the product applies", () => {
  it("is two standard errors, and nothing in the product asks for another", () => {
    const record = realImportRecord(400, 77);
    const implicit = read(record);
    const explicit = worstBucketVerdict(
      diagnosticFromDecisions(record, { anyClock: true, bookLoaded: true }),
      2,
    );
    expect(implicit).toEqual(explicit);
  });

  it("names nothing when the outcome carries no relation to the buckets", () => {
    // A short version of the gate, so a regression fails here first and reads as a sentence.
    const report = worstBucketControl(IMPORT_RECORDS[1], 60, 12345);
    expect(
      report.runsWithComparison,
      "a rate of zero means nothing with nothing to get wrong",
    ).toBeGreaterThan(50);
    expect(report.falsePositiveRate).toBeLessThanOrEqual(0.02);
  });

  it("keeps every bucket the same size when the outcome is permuted", () => {
    // What makes the control a control: only the outcome moves, so the overlap between buckets is
    // the real one rather than a rebuilt one.
    const record = realImportRecord(400, 5);
    const before = diagnosticFromDecisions(record, { anyClock: true, bookLoaded: true });
    const after = diagnosticFromDecisions(permuteAccuracy(record, seededRandom(9)), {
      anyClock: true,
      bookLoaded: true,
    });
    expect(after.buckets.map((b) => b.n)).toEqual(before.buckets.map((b) => b.n));
    expect(after.eligible).toBe(before.eligible);
  });
});

describe("what the reading can and cannot resolve", () => {
  it("says how much larger a sample the measured gap would need", () => {
    // Four times the sample halves the bar, so a gap at half the bar needs four times the size.
    expect(resolutionFactor({ separation: 0.05, threshold: 0.1 })).toBeCloseTo(4, 10);
    expect(resolutionFactor({ separation: 0.1, threshold: 0.1 })).toBeCloseTo(1, 10);
  });

  it("has no answer when the two lowest came out level", () => {
    // Zero would read as "no more games needed", which is the opposite of what it means.
    expect(resolutionFactor({ separation: 0, threshold: 0.1 })).toBeNull();
  });

  it("is silent at import sizes even when one bucket is genuinely much worse", () => {
    /*
     * THE FINDING, pinned so it cannot drift unnoticed. A record of 200 decisions -- the size a
     * real 8-to-20-game import produces -- with the middlegame made 20 points worse than the rest.
     * The comparison still refuses, because at that size its bar is wider than the gap.
     *
     * This is not a bug in the arithmetic and the test does not ask for a different threshold. It
     * pins the CONSEQUENCE: the bridge over the cold start does not fire on records this size, and
     * a change that made it fire would have to explain what it did to the false-positive rate.
     */
    const record = realImportRecord(200, 31).map((d, i) =>
      d.phase === "middlegame" && i % 5 === 0 ? { ...d, accurate: false } : d,
    );
    const verdict = read(record);
    expect(verdict).not.toBeNull();
    expect(verdict!.separable).toBe(false);
    expect(verdict!.threshold).toBeGreaterThan(0.1);
  });
});
