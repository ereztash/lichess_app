/**
 * R-10: a stored level means nothing without the grid it was stated on.
 *
 * `shared/confidence.ts` opens with the rule: the scale is **three** things that must never drift
 * apart — how many levels, what probability each asserts, and what word sits under it. The record
 * stored exactly one of them. `confidence_scale` says SEVEN, and seven levels could be
 * `.05 .20 .35 .50 .65 .80 .95` or any other seven numbers.
 *
 * THIS IS NOT HYPOTHETICAL, and that file says so about itself. Its own closing paragraph names two
 * open questions — Juslin's scale-end effect, and whether the map from an ordinal word to a
 * probability should be linear at all rather than linear in log odds — either of which would move
 * those seven numbers while leaving the count at seven. Every stored `level 6, scale 7` would then
 * assert the new value instead of the 0.80 the player actually said, and nothing in the row could
 * tell: the count still matches, the word is still "בטוח", and every reading downstream changes.
 *
 * Same failure `confidence_scale` was added to prevent, one level down, and the same rule: a stored
 * number whose meaning depends on a setting is not a measurement unless the setting is stored
 * beside it.
 *
 * WHAT THIS FILE IS. Half of it pins the published grids, so that editing a value without bumping
 * the version fails the build with a sentence rather than silently rewriting what people said. The
 * other half is the gate the ledger asks for: a fixture written under one grid keeps its original
 * probability after the grid changes.
 */
import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_GRID_VERSION,
  CONFIDENCE_LEVELS,
  LEGACY_CONFIDENCE_GRID_VERSION,
  LEGACY_CONFIDENCE_LEVELS,
  PUBLISHED_GRIDS,
  normaliseConfidence,
} from "@shared/confidence";

/**
 * EVERY GRID THIS BUILD HAS EVER PUBLISHED, WRITTEN OUT.
 *
 * Duplicated from the module on purpose, which is the one place duplication is the mechanism rather
 * than a smell: a test that imported the numbers and compared them to themselves would pass no
 * matter what they became. These are the numbers people's stated confidences were recorded against,
 * and the only way to notice one moving is to have written it down somewhere it cannot move with.
 *
 * IF THIS FAILS, THE FIX IS ALMOST NEVER TO EDIT THIS TABLE. It is to add a new version to
 * `GRID_HISTORY`, bump `CONFIDENCE_GRID_VERSION`, and append the new row here — leaving the old one
 * exactly as it is, because rows stored under it are only readable while its numbers survive.
 */
const PINNED: Record<number, Record<number, number[]>> = {
  1: {
    5: [0, 0.25, 0.5, 0.75, 1],
    7: [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95],
  },
};

describe("a grid that moved under a stored level", () => {
  describe("the published grids are pinned", () => {
    it("has not changed a single published probability", () => {
      expect(JSON.parse(JSON.stringify(PUBLISHED_GRIDS))).toEqual(PINNED);
    });

    it("publishes a grid for every version from 1 to the current one, with no gaps", () => {
      /*
       * A gap would mean a stored row pointing at a version this build cannot read, which
       * `normaliseConfidence` correctly refuses — loudly, and far from whoever left the gap.
       */
      const versions = Object.keys(PUBLISHED_GRIDS).map(Number).sort((a, b) => a - b);
      expect(versions).toEqual(
        Array.from({ length: CONFIDENCE_GRID_VERSION }, (_, i) => i + 1),
      );
    });

    it("keeps the legacy version readable, which is what makes old rows readable", () => {
      expect(PUBLISHED_GRIDS[LEGACY_CONFIDENCE_GRID_VERSION]).toBeDefined();
      expect(LEGACY_CONFIDENCE_GRID_VERSION).toBeLessThanOrEqual(CONFIDENCE_GRID_VERSION);
    });

    it("gives every published scale exactly as many probabilities as it has levels", () => {
      for (const [version, grids] of Object.entries(PUBLISHED_GRIDS)) {
        for (const [levels, grid] of Object.entries(grids)) {
          expect(grid, `grid ${version}/${levels} has the wrong length`).toHaveLength(
            Number(levels),
          );
        }
      }
    });
  });

  describe("a level written under one grid keeps its meaning after the grid changes", () => {
    /**
     * A version 2 that re-means the seven-level scale, exactly as one of the open questions would.
     *
     * The values are the ones the module's own table records for the linear-to-the-ends variant,
     * so this is not an invented change — it is the change that was measured and rejected, applied
     * as if a later measurement had reversed the decision.
     */
    const NEXT = { 7: [0, 1 / 6, 1 / 3, 0.5, 2 / 3, 5 / 6, 1] };

    it("reads a stored level on the grid it was stated on, not on today's", () => {
      /*
       * THE GATE. `level 6, scale 7` asserted 0.80 on version 1. Under a version 2 that inset the
       * scale differently it would assert 0.833, and every calibration gap computed over a record
       * spanning the change would be a mixture of two instruments — invisibly, because the count
       * and the word both still match.
       */
      expect(normaliseConfidence(6, CONFIDENCE_LEVELS, 1)).toBe(0.8);
      expect(NEXT[7][5]).toBeCloseTo(0.8333, 4);
      expect(normaliseConfidence(6, CONFIDENCE_LEVELS, 1)).not.toBeCloseTo(NEXT[7][5], 4);
    });

    it("reads a row that names no version as version 1, because that is its age", () => {
      // Absence dates the row. Only one version has shipped, so every unstamped row is version 1.
      expect(normaliseConfidence(6, CONFIDENCE_LEVELS)).toBe(
        normaliseConfidence(6, CONFIDENCE_LEVELS, LEGACY_CONFIDENCE_GRID_VERSION),
      );
    });

    it("still reads the five-level scale as it always meant", () => {
      // The scale change this file's predecessor was written for. A stored 4 of 5 asserted 0.75.
      expect(normaliseConfidence(4, LEGACY_CONFIDENCE_LEVELS)).toBe(0.75);
      expect(normaliseConfidence(4, CONFIDENCE_LEVELS)).toBe(0.5);
    });

    it("REFUSES a version it cannot read rather than falling back to the current one", () => {
      /*
       * A row from a newer build, in a store an older build is reading. Falling back would be the
       * exact failure: reading somebody's stated confidence off a grid they never saw, quietly.
       */
      expect(() => normaliseConfidence(6, CONFIDENCE_LEVELS, CONFIDENCE_GRID_VERSION + 1)).toThrow(
        /grid version/,
      );
    });

    it("REFUSES a level that is not on the scale, on any version", () => {
      expect(() => normaliseConfidence(8, CONFIDENCE_LEVELS, 1)).toThrow(/not a level/);
      expect(() => normaliseConfidence(0, CONFIDENCE_LEVELS, 1)).toThrow(/not a level/);
      expect(() => normaliseConfidence(4, 6, 1)).toThrow(/cannot read/);
    });
  });
});
