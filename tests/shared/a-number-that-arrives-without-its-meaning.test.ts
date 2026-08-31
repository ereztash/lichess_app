/**
 * §6, §8, §9: the number stays, and it stops being the first thing.
 *
 * THREE SEPARATE FAILURES, ONE RULE. A stored `6` reaching a screen as a `6`; a cp-loss reaching it
 * as `47`; a think time reaching it as `14.3%`. In every case a figure arrives without its meaning
 * and the reader is asked to do the interpretation -- which is the work this product exists to do.
 *
 * THE ASSERTIONS THAT MATTER ARE ABOUT WHERE THE BOUNDARIES COME FROM, not about the words. A
 * vocabulary is a design decision and it can be argued about; a band boundary that a designer chose
 * is an opinion inside a sentence the player reads as a measurement, and it cannot be argued about
 * afterwards because nothing on screen says it was a choice. So: the cost boundary between "no real
 * cost" and "a small cost" must BE the accurate/inaccurate boundary -- not near it, not derived
 * from it, the same one -- and the words must be versioned with the grid they describe.
 */
import { describe, expect, it } from "vitest";
import {
  COST_BANDS,
  COST_BAND_WORD,
  CONFIDENCE_WORDS,
  MATERIAL_WIN_PROBABILITY_LOSS,
  MIN_USUAL_RANGE_N,
  PUBLISHED_GRID_VERSIONS,
  WORDED_GRID_VERSIONS,
  confidenceWord,
  costBand,
  timeShape,
} from "@shared/plain-reading";
import { ACCURATE_WIN_PROBABILITY_LOSS, accurateDecision } from "@shared/detector";
import {
  CONFIDENCE_GRID_VERSION,
  CONFIDENCE_LEVELS,
  LEGACY_CONFIDENCE_LEVELS,
  PUBLISHED_GRIDS,
  normaliseConfidence,
} from "@shared/confidence";
import { ENGINE_NOISE_CP, MATERIAL_LOSS_CP } from "@shared/reveal";

describe("a number that arrives without its meaning", () => {
  describe("what a move cost, in words", () => {
    it("puts the first boundary EXACTLY where accurate stops, at every standing", () => {
      /*
       * THE ASSERTION WITH TEETH. Two rules for "was this move fine" is how this repository ended
       * up with three definitions of accuracy, one of which wrote terminal grades. The band is not
       * near the accuracy rule; below the first boundary is exactly `accurateDecision`.
       *
       * SWEPT ACROSS STANDINGS because that is where a centipawn band would come apart: 30cp is
       * 2.76 points of winning chances at a level position and 0.28 at +10.00.
       */
      for (const standing of [-1200, -500, -100, 0, 50, 300, 800, 1500]) {
        for (const cpLoss of [0, 5, 15, 29, 30, 31, 60, 99, 100, 101, 400, 1200]) {
          expect(
            costBand(standing, cpLoss) === "no-real-cost",
            `standing ${standing}, loss ${cpLoss}: the band and the accuracy rule disagree`,
          ).toBe(accurateDecision(standing, cpLoss));
        }
      }
    });

    it("derives its second boundary the same way the first one was derived", () => {
      // Neither number is chosen. Both are a measured centipawn constant, converted once.
      expect(MATERIAL_WIN_PROBABILITY_LOSS).toBeGreaterThan(ACCURATE_WIN_PROBABILITY_LOSS);
      expect(ENGINE_NOISE_CP).toBeLessThan(MATERIAL_LOSS_CP);
    });

    it("has THREE bands, because the contract has two boundaries", () => {
      /*
       * The plan sketches four. A fourth needs a boundary between "noticeable" and "large" that
       * nobody has measured, and a designer's number inside a sentence the player reads as a
       * measurement cannot be argued with afterwards -- nothing on screen says it was a choice.
       */
      expect(COST_BANDS).toEqual(["no-real-cost", "small-cost", "large-cost"]);
    });

    it("moves a move across bands as the position it was made in changes", () => {
      /*
       * The whole reason the bands are on win probability. The same 60cp move, at a level position
       * and at a won one -- one of them cost something, the other is inside what the search does to
       * itself.
       */
      expect(costBand(0, 60)).not.toBe("no-real-cost");
      expect(costBand(1500, 60)).toBe("no-real-cost");
    });

    it("gives every band a word and a sentence that does not restate the number", () => {
      for (const band of COST_BANDS) {
        expect(COST_BAND_WORD[band].word.length).toBeGreaterThan(2);
        expect(COST_BAND_WORD[band].detail).not.toMatch(/\d/);
      }
      expect(new Set(COST_BANDS.map((b) => COST_BAND_WORD[b].word)).size).toBe(COST_BANDS.length);
    });
  });

  describe("what the player said, in words", () => {
    it("publishes a word for every level of every published grid", () => {
      /*
       * THE GATE. `shared/confidence.ts` opens with the rule that the scale is three things that
       * must never drift apart -- the count, the probability, and the word -- and the repository
       * stored two of them and left the third in a component. A grid added without words is a
       * screen that throws, far from whoever added it.
       */
      expect([...WORDED_GRID_VERSIONS].sort()).toEqual([...PUBLISHED_GRID_VERSIONS].sort());
      for (const version of PUBLISHED_GRID_VERSIONS) {
        for (const [levels, probabilities] of Object.entries(PUBLISHED_GRIDS[version])) {
          expect(
            CONFIDENCE_WORDS[version][Number(levels)],
            `grid ${version}/${levels} has probabilities and no words`,
          ).toHaveLength(probabilities.length);
        }
      }
    });

    it("gives level 6 of 7 the word the plan asks for", () => {
      expect(confidenceWord(6, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION)).toBe("בטוח");
      expect(normaliseConfidence(6, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION)).toBe(0.8);
    });

    it("uses a distinct word for every level, on every published scale", () => {
      // Two levels sharing a word is a scale with fewer levels than its buttons.
      for (const version of PUBLISHED_GRID_VERSIONS) {
        for (const levels of Object.keys(CONFIDENCE_WORDS[version])) {
          const words = CONFIDENCE_WORDS[version][Number(levels)];
          expect(new Set(words).size, `grid ${version}/${levels} repeats a word`).toBe(words.length);
        }
      }
    });

    it("claims no certainty at either end, where the grid claims none either", () => {
      /*
       * The scale-end effect `shared/confidence.ts` names as an open question, made worse by a
       * label: a player who reads "certain" at the top will press it for positions they are 90% on.
       * The grid's extremes are 0.05 and 0.95 and the words have to match that.
       */
      const top = confidenceWord(CONFIDENCE_LEVELS, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION);
      const bottom = confidenceWord(1, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION);
      expect(normaliseConfidence(CONFIDENCE_LEVELS, CONFIDENCE_LEVELS)).toBeLessThan(1);
      expect(normaliseConfidence(1, CONFIDENCE_LEVELS)).toBeGreaterThan(0);
      expect(top).not.toMatch(/לגמרי|לחלוטין|בוודאות/);
      expect(bottom).not.toMatch(/בכלל לא|בוודאות/);
    });

    it("REFUSES a grid version it has no words for, rather than using today's", () => {
      expect(() => confidenceWord(6, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION + 1)).toThrow(
        /grid version/,
      );
    });

    it("REFUSES a scale it does not publish, and a level off the scale", () => {
      expect(() => confidenceWord(4, 6, CONFIDENCE_GRID_VERSION)).toThrow(/cannot read/);
      expect(() => confidenceWord(8, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION)).toThrow(/not a level/);
      expect(() => confidenceWord(0, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION)).toThrow(/not a level/);
    });

    it("still words the five-level scale, because rows stated on it are still readable", () => {
      expect(confidenceWord(4, LEGACY_CONFIDENCE_LEVELS)).toBeTruthy();
      expect(confidenceWord(4, LEGACY_CONFIDENCE_LEVELS)).not.toBe(
        confidenceWord(4, CONFIDENCE_LEVELS),
      );
    });
  });

  describe("how long they thought, as a shape", () => {
    it("returns lengths a component can draw, and no percentile", () => {
      const shape = timeShape(34_000, 2_100, [4_000, 5_000, 6_000, 7_000, 9_000]);
      expect(shape.clockBeforeMs).toBe(34_000);
      expect(shape.thinkMs).toBe(2_100);
      expect(shape.usualMs).toEqual({ low: 5_000, high: 7_000, n: 5 });
    });

    it("withholds the usual range below the size at which it excludes anything", () => {
      /*
       * At three observations the interquartile range is two of the three values, so the band would
       * contain every observation there is -- and drawn beside one decision it would say the
       * decision was typical whatever it was.
       */
      expect(timeShape(34_000, 2_100, [1_000, 2_000, 3_000]).usualMs).toBeNull();
      expect(timeShape(34_000, 2_100, []).usualMs).toBeNull();
      expect(timeShape(34_000, 2_100, [1, 2, 3, 4]).usualMs).not.toBeNull();
      expect(MIN_USUAL_RANGE_N).toBe(4);
    });

    it("carries the n, so a caller can decline a range drawn from five", () => {
      expect(timeShape(1, 1, [1, 2, 3, 4, 5])?.usualMs?.n).toBe(5);
    });

    it("does not care what order the reference arrives in", () => {
      const a = timeShape(1, 1, [9_000, 4_000, 7_000, 5_000, 6_000]);
      const b = timeShape(1, 1, [4_000, 5_000, 6_000, 7_000, 9_000]);
      expect(a.usualMs).toEqual(b.usualMs);
    });

    it("uses an observed duration for each bound, never an interpolated one", () => {
      // An interpolated bound is a duration nobody spent, drawn as a length beside one somebody did.
      const reference = [1_000, 2_000, 30_000, 40_000];
      const shape = timeShape(1, 1, reference);
      expect(reference).toContain(shape.usualMs!.low);
      expect(reference).toContain(shape.usualMs!.high);
    });
  });
});
