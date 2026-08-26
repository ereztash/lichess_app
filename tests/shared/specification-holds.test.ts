/**
 * The specification, held to the code.
 *
 * A document describing what an instrument measures is worth having only while it is true, and
 * the way it stops being true is never a rewrite -- it is a constant changing in one file while
 * the prose describing it stays put. `docs/MEASUREMENTS.md` was already stale in three places
 * when the scale and the outcome rule moved, and nothing failed.
 *
 * So the numbers a reader would quote from the specification are asserted against the values the
 * product actually runs on. Not every sentence -- prose is not testable and pretending otherwise
 * produces tests that break on wording. Only the figures somebody could cite.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CONFIDENCE_CHOICES,
  CONFIDENCE_LABELS,
  CONFIDENCE_LEVELS,
  normaliseConfidence,
} from "@shared/confidence";
import {
  ACCURATE_CP_LOSS,
  ACCURATE_WIN_PROBABILITY_LOSS,
  MIN_BUCKET_N,
  PREREGISTERED_MIN_BUCKET_N,
  PREREGISTERED_SEPARABILITY_K,
  SEPARABILITY_K,
  MAX_SHUFFLED_FALSE_POSITIVE_RATE,
} from "@shared/detector";
import { WIN_PROBABILITY_K } from "@shared/win-probability";
import { ANCHOR_POSITIONS, ANCHOR_SET_VERSION } from "@shared/anchor-set";
import { OPENING_MAX_PLY } from "@shared/phase";
import {
  ACCURACY_COUPLING,
  SENSITIVITY_REFERENCE,
  SENSITIVITY_STRATA,
} from "@shared/sensitivity-reference";
import {
  POPULATION_BASELINE,
  POPULATION_BASELINE_N,
} from "@shared/population-baseline";

const spec = readFileSync(resolve(__dirname, "../../docs/MEASUREMENTS.md"), "utf8");
const section = spec.slice(spec.indexOf("# The instrument, as specified"));

/**
 * Every figure a reader could quote, anchored to the words it appears beside.
 *
 * A BARE `toContain` LET TWO MUTATIONS THROUGH, and the reason is worth keeping. Asserting that
 * the document contains ".08" passes when the grid changes to .08, because "-2.08" is sitting in
 * a comparison table three rows up; asserting it contains "30" passes when the bank halves to 30
 * positions, because "300 cp" is in the position filter. A short number matches somewhere in any
 * document long enough to be worth writing.
 *
 * So each figure is matched WITH its label. The pattern is what a reader would have to read to
 * learn the value, which is the thing that has to stay true.
 */
const CITED: [string, RegExp][] = [
  [
    "the confidence grid",
    new RegExp(
      `Mapped to[^|]*\\|[^|]*${CONFIDENCE_CHOICES.map((level) =>
        normaliseConfidence(level, CONFIDENCE_LEVELS).toFixed(2).replace(/^0/, ""),
      ).join("[^|]*")}`,
    ),
  ],
  [
    "the outcome threshold",
    new RegExp(`Accurate when[^|]*\\|[^|]*${(ACCURATE_WIN_PROBABILITY_LOSS * 100).toFixed(2)}`),
  ],
  ["the centipawn anchor", new RegExp(`Threshold set by[^|]*\\|[^|]*\\(${ACCURATE_CP_LOSS} cp\\)`)],
  ["the logistic constant", new RegExp(`Logistic constant[^|]*\\|[^|]*k = ${WIN_PROBABILITY_K}`)],
  [
    "the anchor set size",
    new RegExp(`Comparable reading[^|]*\\|[^|]*\\b${ANCHOR_POSITIONS.length} positions\\b`),
  ],
  [
    "the shuffled-label ceiling",
    new RegExp(`GATE-SHUFFLE[^|]*\\|[^|]*${MAX_SHUFFLED_FALSE_POSITIVE_RATE * 100}% false-positive`),
  ],
  [
    "the separability multiplier",
    new RegExp(`SEPARABILITY_K = ${SEPARABILITY_K}`),
  ],
  [
    "the pre-registered thresholds",
    new RegExp(
      `n = ${PREREGISTERED_MIN_BUCKET_N}[^|]*k = ${PREREGISTERED_SEPARABILITY_K}`,
    ),
  ],
  ["the opening window", /Past `OPENING_MAX_PLY`/],
  ["the reporting floor", /below `MIN_BUCKET_N` per level/],
];

describe("the specification quotes the values the product runs on", () => {
  for (const [what, pattern] of CITED) {
    it(`states ${what}`, () => {
      expect(section, `${what}: the specification and the code disagree`).toMatch(pattern);
    });
  }

  it("names every level of the scale, in order", () => {
    // The words are half the scale: a level whose number moved and whose word stayed put is a
    // player saying something they did not mean, and the specification is where that is checked.
    let cursor = -1;
    for (const label of CONFIDENCE_LABELS) {
      const at = section.indexOf(label);
      expect(at, `the specification does not name ${label}`).toBeGreaterThan(-1);
      expect(at, `${label} is out of order in the specification`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("carries the instrument version, because readings across versions do not pool", () => {
    expect(section).toContain(`Instrument version ${ANCHOR_SET_VERSION}`);
  });

  it("uses the same opening window the picker and the bank do", () => {
    expect(OPENING_MAX_PLY).toBe(20);
    expect(MIN_BUCKET_N).toBeGreaterThan(0);
  });
});

describe("the specification says what the instrument cannot do", () => {
  it("keeps the limits section, and keeps it specific", () => {
    /*
     * A specification that lists only strengths is advertising, and the limits are the part most
     * likely to be quietly dropped when the document is next tidied. Each of these is a live,
     * known gap -- not one of them is rhetorical.
     */
    const limits = section.slice(section.indexOf("What this instrument cannot do"));
    expect(limits, "the limits section was dropped").not.toBe("");
    for (const admission of [
      "No reference class exists",
      "Trait status is unproven",
      "Nothing external has checked it",
      "confounded",
    ]) {
      expect(limits, `the specification stopped admitting: ${admission}`).toContain(admission);
    }
    expect(limits).toContain("380,310");
  });
});

describe("the specification claims exactly the facets it measures", () => {
  it("names all three measured facets and points each at its module", () => {
    /*
     * GATE-GRADE, turned on the product's own name. "Metacognition" is broader than what is
     * measured, and the way a specification stops being true is not a rewrite -- it is a facet
     * quietly implied by a heading. Each measured one has to name where it lives.
     */
    const facets = section.slice(section.indexOf("Which facets of metacognition"));
    for (const [facet, where] of [
      ["Bias / calibration", "RELIABILITY"],
      ["Sensitivity / discrimination", "shared/sensitivity.ts"],
      ["Control", "shared/control.ts"],
    ]) {
      expect(facets, `the specification stopped naming ${facet}`).toContain(facet);
      expect(facets, `${facet} does not say where it is computed`).toContain(where);
    }
  });

  it("keeps admitting the two facets it does NOT measure", () => {
    /*
     * The rows most likely to be dropped when the table is next tidied, and the ones that make
     * the difference between a scoped claim and an overclaim.
     */
    const facets = section.slice(section.indexOf("Which facets of metacognition"));
    expect(facets).toContain("Metacognitive efficiency");
    expect(facets).toContain("Metacognitive knowledge");
    expect(facets, "the specification stopped saying meta-d-prime is unavailable").toMatch(
      /meta-d′ is absent|meta-d′` is absent/,
    );
  });

  it("says why meta-d-prime cannot be computed, rather than that it was not wanted", () => {
    // The reason is specific and checkable: d' needs a binary first-order task, and choosing a
    // move from thirty options is not one. A specification that just omitted it would read as a
    // choice rather than a constraint.
    const facets = section.slice(section.indexOf("Which facets of metacognition"));
    expect(facets).toMatch(/binary\*? first-order task|\*binary\* first-order task/);
    expect(facets, "the cost of the anchor-set route is no longer stated").toContain(
      "existing literature",
    );
  });
});

describe("the specification's population table is the module's, not a copy that drifted", () => {
  const baseline = section.slice(section.indexOf("What a bucket is reported against"));

  it("keeps the section, and quotes the denominator the module was built from", () => {
    /*
     * ANCHORED TO ITS OWN LINE, not to the section. The corpus size appears twice in this section
     * -- once as the headline denominator and once inside a sentence about small samples -- and
     * a `toContain` over the whole section passed while the headline said 690,000 and the module
     * said 693,130. That is exactly the drift this file exists to catch, and it survived.
     */
    expect(baseline, "the population baseline section was dropped").not.toBe("");
    const headline = baseline.split("\n").find((line) => line.includes("**Measured, on"));
    expect(headline, "the section stopped stating its denominator up front").toBeTruthy();
    expect(headline).toContain(POPULATION_BASELINE_N.toLocaleString("en-US"));
  });

  it("states every bucket's rate to the same figure the code will subtract", () => {
    /*
     * THE DRIFT THIS FILE EXISTS FOR, on the newest numbers. The table is the part of the
     * document a reader would quote, and regenerating the baseline from a different corpus would
     * change every one of these while the prose sat still.
     *
     * Anchored to the bucket key on its own row, never to a bare figure: `.08` matches inside
     * `-2.08` and `30` inside `300 cp`, which is how two mutations got through this file before.
     */
    for (const bucket of POPULATION_BASELINE) {
      const row = baseline.split("\n").find((line) => line.includes(`\`${bucket.key}\``));
      expect(row, `no row for ${bucket.key}`).toBeTruthy();
      expect(row, `${bucket.key} inside`).toContain(`${(bucket.accuracy * 100).toFixed(2)}%`);
      expect(row, `${bucket.key} outside`).toContain(`${(bucket.outsideAccuracy * 100).toFixed(2)}%`);
      expect(row, `${bucket.key} n`).toContain(bucket.n.toLocaleString("en-US"));
    }
  });

  it("keeps saying the two things that stop it being read as more than it is", () => {
    /*
     * Both are load-bearing and both are exactly the kind of caveat a tidy-up drops.
     *
     * The first: this baselines ACCURACY. The games it was built from never asked anyone how
     * sure they were, so nothing here references the calibration gap, and a reader who takes the
     * section as a reference class for confidence has been misled by the document.
     *
     * The second: a bucket the corpus cannot support is ABSENT. Zero would read as "exactly
     * average", which is a measurement nobody made.
     */
    expect(baseline, "the specification stopped saying there is no confidence half").toMatch(
      /no confidence half/i,
    );
    expect(baseline, "the specification stopped saying an absent bucket is not a zero").toMatch(
      /absent, not zero/i,
    );
  });

  it("still admits the confound the baseline only partly removes", () => {
    // The baseline subtracts what a bucket costs ON AVERAGE. It cannot say whether the positions
    // this player met in that bucket were the average ones -- and at thirty decisions they often
    // are not. A limits section that upgraded to "solved" would be the advertising this document
    // exists not to be.
    const limits = section.slice(section.indexOf("What this instrument cannot do"));
    expect(limits).toContain("The confound is not gone");
    expect(limits, "the reference-class admission was quietly closed by the baseline").toMatch(
      /No reference class exists for the calibration gap/,
    );
  });
});

describe("the specification's reference band is the module's, not a copy that drifted", () => {
  const reference = section.slice(section.indexOf("What the discrimination figure is read against"));

  it("keeps the section, and quotes the people and the coupling the module carries", () => {
    /*
     * Anchored to their own lines. The corpus size and the coupling each appear more than once in
     * this document, and a `toContain` over a whole section passed while a headline figure and
     * the module disagreed -- that drift is what this file exists to catch and it survived once.
     */
    expect(reference, "the sensitivity reference section was dropped").not.toBe("");
    const headline = reference.split("\n").find((line) => line.includes("**Measured on"));
    expect(headline, "the section stopped stating its denominator up front").toBeTruthy();
    expect(headline).toContain(SENSITIVITY_REFERENCE.n.toLocaleString("en-US"));
    expect(headline).toContain(String(SENSITIVITY_REFERENCE.studies));

    const coupling = reference.split("\n").find((line) => line.includes("Spearman"));
    expect(coupling, "the section stopped stating the coupling it stratifies for").toBeTruthy();
    expect(coupling).toContain(ACCURACY_COUPLING.toFixed(2));
  });

  it("states every stratum to the figures a reader is actually shown", () => {
    for (const stratum of SENSITIVITY_STRATA) {
      const at = (p: number) => stratum.band.percentiles.find((entry) => entry.p === p)!.auroc2.toFixed(3);
      const row = reference
        .split("\n")
        .find((line) => line.startsWith("|") && line.includes(`| ${stratum.band.n.toLocaleString("en-US")} |`));
      expect(row, `no row for the ${stratum.from}-${stratum.to} stratum`).toBeTruthy();
      expect(row, `${stratum.from}-${stratum.to} p10`).toContain(at(10));
      expect(row, `${stratum.from}-${stratum.to} median`).toContain(at(50));
      expect(row, `${stratum.from}-${stratum.to} p90`).toContain(at(90));
    }
  });

  it("keeps saying the three things that stop a range being read as a grade", () => {
    /*
     * Each is exactly the kind of caveat a tidy-up drops, and each is the difference between a
     * reference class and a score.
     *
     * That the band is people of SIMILAR ACCURACY -- without it, being good at chess reads as
     * being metacognitively gifted. That the TASK IS NOT CHESS -- conditioning narrows that and
     * does not close it. And that a missing stratum is ABSENT -- the fallback would hand the
     * unconditioned band to precisely the readers for whom the confound is largest.
     */
    expect(reference, "the specification stopped saying it is a band and not a rank").toMatch(
      /band, never a percentile rank/i,
    );
    expect(reference, "the specification stopped saying the task is not this one").toMatch(
      /task is not this instrument's task/i,
    );
    expect(reference, "the specification stopped saying a missing stratum is absent").toMatch(
      /absent, not interpolated/i,
    );
  });

  it("states its own coverage, so a dropped dataset is visible", () => {
    // A reference class that quietly drops the studies it cannot parse is a curated one, and the
    // curation would be invisible in the output.
    expect(reference).toMatch(/132 of\s*\n?180 datasets|132 of 180 datasets/);
    expect(reference, "the specification stopped promising no dataset is hand-parsed").toMatch(
      /No dataset is hand-parsed/i,
    );
  });

  it("still admits that the reference class is borrowed from another task", () => {
    const limits = section.slice(section.indexOf("What this instrument cannot do"));
    expect(limits).toContain("borrowed from another task");
    expect(limits, "the calibration gap was quietly declared referenced").toContain(
      "remain un-referenced",
    );
  });
});
