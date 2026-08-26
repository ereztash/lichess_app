/**
 * The reference class for metacognitive sensitivity, and the two ways it could mislead.
 *
 * An AUROC2 of 0.71 is uninterpretable on its own -- that was the specification's first
 * admission, and for sensitivity it stopped being true in 2020. The Confidence Database (Rahnev
 * et al., Nature Human Behaviour 4, 317-325) carries trial-level confidence and accuracy from
 * ~180 datasets, and AUROC2 needs exactly those two columns.
 *
 * WHAT THESE TESTS DEFEND is not the arithmetic -- `sensitivity.test.ts` already holds that. It
 * is the two claims a band makes just by being on the screen: that the people in it are
 * comparable to the reader, and that a range is a range rather than a grade.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACCURACY_COUPLING,
  SENSITIVITY_REFERENCE,
  SENSITIVITY_REFERENCE_VERSION,
  SENSITIVITY_STRATA,
  sensitivityBand,
} from "../../shared/sensitivity-reference";

const root = resolve(__dirname, "../..");

describe("every band is a distribution over real people", () => {
  it("holds every percentile inside the unit interval and in order", () => {
    for (const source of [SENSITIVITY_REFERENCE, ...SENSITIVITY_STRATA.map((s) => s.band)]) {
      let previous = 0;
      for (const point of source.percentiles) {
        expect(point.auroc2).toBeGreaterThan(0);
        expect(point.auroc2).toBeLessThan(1);
        // Monotone by construction: a percentile grid that is not sorted is not a percentile grid.
        expect(point.auroc2).toBeGreaterThanOrEqual(previous);
        previous = point.auroc2;
      }
    }
  });

  it("carries enough people in each stratum to be a reference class", () => {
    for (const stratum of SENSITIVITY_STRATA) {
      expect(stratum.band.n, `${stratum.from}-${stratum.to}`).toBeGreaterThanOrEqual(200);
      expect(stratum.band.studies, `${stratum.from}-${stratum.to}`).toBeGreaterThan(1);
    }
    expect(SENSITIVITY_REFERENCE.n).toBeGreaterThan(1000);
  });

  it("keeps the strata disjoint and ordered, so one accuracy cannot match two bands", () => {
    // Two matching strata would make `sensitivityBand` return whichever came first in the array,
    // which is a silent choice between two different answers.
    for (let i = 1; i < SENSITIVITY_STRATA.length; i += 1) {
      expect(SENSITIVITY_STRATA[i].from).toBeGreaterThanOrEqual(SENSITIVITY_STRATA[i - 1].to);
    }
  });

  it("is versioned, because a band from another corpus is another number", () => {
    expect(SENSITIVITY_REFERENCE_VERSION).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(SENSITIVITY_REFERENCE_VERSION)).toBe(true);
  });
});

describe("the confound the stratification exists for is real and is in the data", () => {
  it("finds AUROC2 climbing with first-order accuracy, strongly", () => {
    /*
     * THE FINDING THAT JUSTIFIES CONDITIONING AT ALL. It is also the standard criticism of
     * AUROC2, which `shared/sensitivity.ts` has always admitted in prose -- here it is measured.
     * If this ever stops holding, the stratification is costing resolution for nothing and an
     * unconditioned band would be the honest thing to show.
     */
    expect(ACCURACY_COUPLING).toBeGreaterThan(0.3);
  });

  it("shows the climb in the bands themselves, not only in the coefficient", () => {
    // A rank correlation could in principle sit alongside flat medians. These are the numbers a
    // reader is actually shown, so the claim is asserted on them.
    const medians = SENSITIVITY_STRATA.map(
      (s) => s.band.percentiles.find((p) => p.p === 50)!.auroc2,
    );
    for (let i = 1; i < medians.length; i += 1) {
      expect(medians[i], `stratum ${i}`).toBeGreaterThan(medians[i - 1]);
    }
    expect(medians[medians.length - 1] - medians[0]).toBeGreaterThan(0.1);
  });
});

describe("it says nothing where nothing was measured", () => {
  it("returns null for an accuracy no stratum covers", () => {
    /*
     * A REAL CASE, not a hypothetical one: the corpus holds only 161 people above 90% accuracy,
     * under the 200-person floor, so that stratum is absent. Falling back to the unconditioned
     * band there would hand back the confound this function exists to remove -- and would hand it
     * to exactly the readers for whom it is largest.
     */
    expect(sensitivityBand(0.95)).toBeNull();
    expect(sensitivityBand(1)).toBeNull();
  });

  it("returns null rather than guessing on a number that is not one", () => {
    /*
     * THE BEHAVIOUR IS PINNED, THE GUARD IS NOT THERE, and both halves of that are deliberate.
     *
     * A `Number.isFinite` check was written into `sensitivityBand` first and was dead code: every
     * comparison against NaN is false and an infinity clears no half-open interval, so the search
     * already returns null for all of these. A positive control found it by deleting the guard
     * and watching nothing fail -- the same way the closing guard in `sensitivity.ts` was found.
     *
     * The assertion stays because the behaviour is what matters and a future stratum written as
     * `to: Infinity` would silently start matching.
     */
    expect(sensitivityBand(Number.NaN)).toBeNull();
    expect(sensitivityBand(Number.POSITIVE_INFINITY)).toBeNull();
    expect(sensitivityBand(Number.NEGATIVE_INFINITY)).toBeNull();
    expect(sensitivityBand(-1)).toBeNull();
    expect(sensitivityBand(2)).toBeNull();
  });

  it("returns the band for an accuracy a stratum does cover", () => {
    // Where the corpus is at its thickest, and where a chess record will usually land: the
    // population baseline puts the whole Lichess corpus at 64.9% under this product's own rule.
    const at65 = sensitivityBand(0.65);
    expect(at65).not.toBeNull();
    expect(at65!.n).toBeGreaterThanOrEqual(200);
    expect(sensitivityBand(0.75)).not.toBeNull();
  });

  it("picks the stratum the accuracy is actually in", () => {
    expect(sensitivityBand(0.65)).not.toBe(sensitivityBand(0.85));
    expect(sensitivityBand(0.61)).toBe(sensitivityBand(0.69));
  });
});

describe("it was built with the product's own estimator", () => {
  it("reads AUROC2 and the readability floor from the shared modules, not its own copies", () => {
    /*
     * Asserted against the source, because the output cannot show it. A band computed with its
     * own threshold sweep or its own tie rule would look identical in the file and be a
     * distribution of a different statistic -- so comparing a reading against it would be
     * arithmetic between two measurements.
     */
    const script = readFileSync(resolve(root, "scripts/build_sensitivity_reference.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(script).toMatch(/import \{ metacognitiveSensitivity \} from "\.\.\/shared\/sensitivity/);
    expect(script).toMatch(/MIN_BUCKET_N[\s\S]*?from "\.\.\/shared\/detector/);
    expect(script, "the generator computes its own area").not.toMatch(/trapezoid|hitRate|falseAlarm/i);
    expect(script, "the generator hand-parses individual studies").not.toMatch(
      /Matthews|AguilarLleyda|Konishi/,
    );
  });
});
