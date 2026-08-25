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
