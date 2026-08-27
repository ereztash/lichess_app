/**
 * The reveal graded and printed confidence on the five-level scale the product replaced.
 *
 * `shared/confidence.ts` says exactly why this is fatal, in a comment written when the scale
 * changed: "Their POSITIONS moved: 'בטוח' was 4 of 5 and is 6 of 7. That is precisely why a stored
 * level is meaningless without the scale it was stated on." `normaliseConfidence` exists to do the
 * conversion, `confidence_scale` is stored on every decision to make it possible — and
 * `theOneThing` called neither. It branched on the RAW level with cut points written for five
 * buttons (`confidence >= 4`, `confidence <= 2`) and interpolated that raw number into the
 * sentence as "מתוך 5".
 *
 * MEASURED BEFORE THE FIX, at every button the picker actually offers, on a move costing 150cp:
 *
 *     button 4 (שקול, asserts 50%) -> confident-and-wrong   "אמרת ביטחון 4 מתוך 5"
 *     button 5 (סביר, asserts 65%) -> confident-and-wrong   "אמרת ביטחון 5 מתוך 5"
 *     button 6 (בטוח, asserts 80%) -> confident-and-wrong   "אמרת ביטחון 6 מתוך 5"
 *     button 7 (ודאי, asserts 95%) -> confident-and-wrong   "אמרת ביטחון 7 מתוך 5"
 *
 * `שקול` is `EVEN_ODDS_LEVEL` — the button that exists so a player can decline to claim anything,
 * documented as such — and it was being told the gap between its confidence and the result was the
 * thing to work on. Two of the four printed a denominator smaller than the level beside it, on a
 * screen that at that moment reads "7 · ודאי".
 *
 * The cut points are now stated in probability (`CONFIDENT_ENOUGH_TO_NAME` = 0.75,
 * `UNSURE_ENOUGH_TO_NAME` = 0.25), which reproduces the original five-level meaning exactly and
 * survives the next scale change. That is the point: these assertions are written against the
 * named levels, so they cannot rot the way the fixtures they replaced did.
 */
import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_LABELS,
  CONFIDENCE_LEVELS,
  EVEN_ODDS_LEVEL,
  LEGACY_CONFIDENCE_LEVELS,
  normaliseConfidence,
} from "../../shared/confidence";
import {
  CONFIDENT_ENOUGH_TO_NAME,
  ENGINE_NOISE_CP,
  MATERIAL_LOSS_CP,
  UNSURE_ENOUGH_TO_NAME,
  oneThingMix,
  theOneThing,
  type RevealInputs,
} from "../../shared/reveal";

const costly = (confidence: number, confidenceScale = CONFIDENCE_LEVELS): RevealInputs => ({
  depth: 18,
  cpLoss: MATERIAL_LOSS_CP + 60,
  chosenMove: "e2e4",
  bestMove: "d2d4",
  chosenWasBest: false,
  confidence,
  confidenceScale,
  statedUnknown: "",
  decisionsOnRecord: 40,
  // Empty, so the choice rule cannot fire and the calibration branch is what is under test.
  candidatesConsidered: [],
});

const inTheNoise = (confidence: number, confidenceScale = CONFIDENCE_LEVELS): RevealInputs => ({
  ...costly(confidence, confidenceScale),
  cpLoss: ENGINE_NOISE_CP - 5,
});

describe("the calibration sentence fires on what the player asserted, not on a button number", () => {
  it("does not tell a player who said even odds that their confidence was the problem", () => {
    // The button that exists so a player can decline to claim anything. It asserts 50%.
    expect(normaliseConfidence(EVEN_ODDS_LEVEL, CONFIDENCE_LEVELS)).toBe(0.5);
    expect(theOneThing(costly(EVEN_ODDS_LEVEL))?.kind).not.toBe("confident-and-wrong");
  });

  it("fires at exactly the levels that assert CONFIDENT_ENOUGH_TO_NAME or more", () => {
    for (let level = 1; level <= CONFIDENCE_LEVELS; level += 1) {
      const asserted = normaliseConfidence(level, CONFIDENCE_LEVELS);
      const kind = theOneThing(costly(level))?.kind;
      const label = `${level} (${CONFIDENCE_LABELS[level - 1]}, ${asserted})`;
      if (asserted >= CONFIDENT_ENOUGH_TO_NAME) {
        expect(kind, `${label} asserts enough and should be named`).toBe("confident-and-wrong");
      } else {
        expect(kind, `${label} does not assert enough to be called overconfident`).not.toBe(
          "confident-and-wrong",
        );
      }
    }
  });

  it("never prints a denominator that is not the scale the level was stated on", () => {
    for (let level = 1; level <= CONFIDENCE_LEVELS; level += 1) {
      for (const inputs of [costly(level), inTheNoise(level)]) {
        const one = theOneThing(inputs);
        if (!one) continue;
        expect(one.text, `"${one.text}" prints a five-level denominator`).not.toContain("מתוך 5");
        expect(one.basis).not.toMatch(/\/5\b/);
        if (one.text.includes("מתוך")) {
          expect(one.text).toContain(`${level} מתוך ${CONFIDENCE_LEVELS}`);
        }
      }
    }
  });

  it("names the noise branch at exactly the levels asserting UNSURE_ENOUGH_TO_NAME or less", () => {
    for (let level = 1; level <= CONFIDENCE_LEVELS; level += 1) {
      const asserted = normaliseConfidence(level, CONFIDENCE_LEVELS);
      const kind = theOneThing(inTheNoise(level))?.kind;
      if (asserted <= UNSURE_ENOUGH_TO_NAME) {
        expect(kind, `level ${level} asserts ${asserted}`).toBe("trusted-it-too-little");
      } else {
        expect(kind, `level ${level} asserts ${asserted}`).not.toBe("trusted-it-too-little");
      }
    }
  });
});

describe("a record written on the old scale is read on the old scale", () => {
  /*
   * The whole reason `confidence_scale` is stored per decision. A stored 4 from the five-level era
   * asserted 75%; a 4 pressed today asserts 50%. Pooling them on one raw threshold counts two
   * different claims as the same one, which is what `oneThingMix` was doing over the whole record.
   */
  it("grades a legacy level by what it asserted then, not by what the number means now", () => {
    // 4 of 5 asserted 75% -- the top of the old "confident" band.
    expect(normaliseConfidence(4, LEGACY_CONFIDENCE_LEVELS)).toBe(0.75);
    expect(theOneThing(costly(4, LEGACY_CONFIDENCE_LEVELS))?.kind).toBe("confident-and-wrong");
    // ...and the same integer pressed today asserts 50%, which is not the same claim.
    expect(normaliseConfidence(4, CONFIDENCE_LEVELS)).toBe(0.5);
    expect(theOneThing(costly(4, CONFIDENCE_LEVELS))?.kind).not.toBe("confident-and-wrong");
  });

  it("prints each level against its own scale, so neither reads as the other", () => {
    expect(theOneThing(costly(4, LEGACY_CONFIDENCE_LEVELS))?.text).toContain(
      `4 מתוך ${LEGACY_CONFIDENCE_LEVELS}`,
    );
    expect(theOneThing(costly(CONFIDENCE_LEVELS))?.text).toContain(
      `${CONFIDENCE_LEVELS} מתוך ${CONFIDENCE_LEVELS}`,
    );
  });

  it("does not pool the two scales onto one threshold in the branch mix", () => {
    /*
     * `oneThingMix` runs over the WHOLE record, which is where a scale change actually bites. One
     * legacy decision at 4 of 5 (75%) and one current decision at 4 of 7 (50%), identical in every
     * other field. They are different claims and must land in different branches.
     */
    const shared = {
      candidatesConsidered: [],
      chosenMove: "e2e4",
      cpLoss: MATERIAL_LOSS_CP + 60,
      bestMove: "d2d4",
    };
    const mix = oneThingMix([
      { ...shared, confidence: 4, confidenceScale: LEGACY_CONFIDENCE_LEVELS },
      { ...shared, confidence: 4, confidenceScale: CONFIDENCE_LEVELS },
    ]);
    expect(mix.n).toBe(2);
    expect(mix.counts["confident-and-wrong"], "the legacy 75% one, and only it").toBe(1);
    expect(mix.counts.outplayed, "the current 50% one").toBe(1);
  });
});
