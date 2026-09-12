/**
 * The third reading: the player had the engine's move on the board and played another.
 *
 * The two readings that existed before both describe a failure to see far enough -- "this cost
 * you 200cp", "you were sure and you were wrong". Neither can describe the case where the move
 * was already in front of the player. That case calls for different work: not seeing further,
 * but choosing better between things already seen. It was invisible because `candidatesConsidered`
 * was collected all the way through the commitment screen and then dropped at the reveal.
 *
 * The field is a record of BOARD INTERACTION, not of thought, and the difference is the whole
 * design. A move in the list was demonstrably in front of the player. A move absent from it may
 * still have been considered in their head. Every assertion here runs in that direction only.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "@shared/confidence";
import {
  ENGINE_NOISE_CP,
  MATERIAL_LOSS_CP,
  PLACEMENT_IS_NOT_CONSIDERATION,
  bestMoveWasPlaced,
  inferenceLimits,
  theOneThing,
  type RevealInputs,
} from "../../shared/reveal";

const base: RevealInputs = {
  depth: 18,
  cpLoss: 0,
  chosenMove: "g8f6",
  bestMove: "g8f6",
  chosenWasBest: true,
  confidence: EVEN_ODDS_LEVEL,
  confidenceScale: CONFIDENCE_LEVELS,
  statedUnknown: "",
  decisionsOnRecord: 12,
  candidatesConsidered: ["g8f6"],
};

/** A costly move, with the engine's preference among the moves the player put on the board. */
const rejected: RevealInputs = {
  ...base,
  cpLoss: 240,
  chosenMove: "f8c5",
  bestMove: "g8f6",
  chosenWasBest: false,
  candidatesConsidered: ["f8c5", "g8f6", "d7d6"],
};

/** The same loss, with the engine's move never placed on the board. */
const missed: RevealInputs = { ...rejected, candidatesConsidered: ["f8c5", "d7d6"] };

describe("the reading itself", () => {
  it("names the choice rule when the engine's move was on the board", () => {
    const one = theOneThing(rejected)!;
    expect(one.kind).toBe("chose-past-it");
    expect(one.text).toContain("g8f6");
    expect(one.text).toContain("f8c5");
    /*
     * THE READING LIVES IN `note`, AND IT NO LONGER SAYS WHICH DIFFICULTY IT WAS.
     *
     * `text` is the chess event -- which move was on the board, which was played, what it cost.
     * The note used to close with "כאן הקושי לא היה למצוא את המהלך, אלא לבחור בינו לבין האחר",
     * which is a statement about the player's mind inferred from one fact about the board: the
     * move was placed. A mis-drag corrected before the commit, and a move dragged to look at and
     * dragged back, are the SAME entry in `candidatesConsidered` as a move weighed and rejected --
     * and the deciding screen invites exactly that, by saying "אפשר לשנות עד הרישום".
     *
     * The two mechanisms call for opposite work, so naming the wrong one sends a player to
     * practise choosing between candidates when nothing was chosen between. What the note does now
     * is hand that discrimination to the only party who can make it.
     */
    expect(one.note, "the note still names which difficulty it was").not.toMatch(
      /הקושי|לבחור בינו|לא היה למצוא/,
    );
    expect(one.note, "the note dropped the reading instead of re-siting it").toMatch(/רק אתם/);
  });

  it("says, above the reading, that a placement is not a consideration", () => {
    /*
     * THE PRESENCE DIRECTION OF A DISTINCTION THIS FILE'S SUBJECT ALREADY MADE IN THE OTHER ONE.
     *
     * `inferenceLimits` has long said that a move weighed WITHOUT being placed is not recorded --
     * absence is not evidence of absence. The reverse was never said anywhere, and it is the
     * direction on which the claim is actually made. The limits render before any number, so this
     * is the caveat arriving ahead of the sentence it qualifies rather than after it.
     *
     * ASSERTED ON THE SAME PREDICATE THE BRANCH USES, not on a neighbouring condition: a caveat
     * that fired on a different set would be qualifying a sentence that was never said.
     */
    expect(bestMoveWasPlaced(rejected)).toBe(true);
    expect(inferenceLimits(rejected)).toContain(PLACEMENT_IS_NOT_CONSIDERATION);
  });

  it("does not say it where no placement licensed a reading", () => {
    // The positive control's other half: the caveat is about a specific record, not a disclaimer
    // printed on every reveal. On `missed` the engine's move was never on the board.
    expect(bestMoveWasPlaced(missed)).toBe(false);
    expect(inferenceLimits(missed)).not.toContain(PLACEMENT_IS_NOT_CONSIDERATION);
  });

  it("says nothing of the kind when the move was never placed", () => {
    // The same numbers, the same confidence. Only the record of what was on the board differs,
    // and it is the only thing that licenses the sentence.
    const one = theOneThing(missed)!;
    expect(one.kind).not.toBe("chose-past-it");
    expect(`${one.text} ${one.note ?? ""}`).not.toMatch(/הנחת על הלוח|לבחור בינו/);
  });

  it("carries a basis that states how many moves the count is out of", () => {
    // "Among 3 moves considered" and "among 12" are different facts, and the sentence leans on
    // the number: with one recorded move there is nothing to have chosen between.
    expect(theOneThing(rejected)!.basis).toContain("3");
  });

  it("outranks the calibration sentence when both apply", () => {
    /*
     * Deliberate, and the one ordering decision in this change. A calibration gap read off a
     * single decision is the aggregate claim at n=1 -- the detector will not make it under
     * MIN_BUCKET_N. "The move was on your board and you played another" needs no aggregation.
     */
    const both = { ...rejected, confidence: CONFIDENCE_LEVELS };
    const one = theOneThing(both)!;
    expect(one.kind).toBe("chose-past-it");
    expect(one.note).toMatch(/רק אתם/);
    expect(`${one.text} ${one.note ?? ""}`).not.toMatch(/אמרת שאתה בטוח/);
  });

  it("stays silent inside engine noise, however the moves were recorded", () => {
    // A 12cp difference is not a choice failure. It is not a difference.
    const noisy = { ...rejected, cpLoss: ENGINE_NOISE_CP - 1 };
    expect(theOneThing(noisy)?.text ?? "").not.toMatch(/מה שהכריע ביניהם/);
  });

  it("stays silent below the material threshold", () => {
    const small = { ...rejected, cpLoss: MATERIAL_LOSS_CP - 1 };
    expect(theOneThing(small)?.text ?? "").not.toMatch(/מה שהכריע ביניהם/);
  });
});

describe("the limit, when there is only one recorded candidate", () => {
  it("says the record cannot separate not-seeing from seeing-and-rejecting", () => {
    const one = { ...missed, candidatesConsidered: ["f8c5"] };
    const limits = inferenceLimits(one).join("\n");
    expect(limits).toMatch(/רק מהלך אחד נרשם כנשקל/);
  });

  it("says that moves considered off the board were never recorded", () => {
    /*
     * The load-bearing half. Without it the sentence reads as "you only looked at one move",
     * which is a claim about the player's thinking that nothing here measured.
     */
    const one = { ...missed, candidatesConsidered: ["f8c5"] };
    expect(inferenceLimits(one).join("\n")).toMatch(/בלי להניח אותם על הלוח/);
  });

  it("does not fire when the player chose the engine's move", () => {
    // Nothing was missed, so there is no distinction to be unable to make.
    expect(inferenceLimits(base).join("\n")).not.toMatch(/רק מהלך אחד נרשם/);
  });

  it("does not fire once a second move was placed on the board", () => {
    expect(inferenceLimits(missed).join("\n")).not.toMatch(/רק מהלך אחד נרשם/);
  });

  it("still comes before any number, like every other limit", () => {
    const one = { ...missed, candidatesConsidered: ["f8c5"] };
    // Section 4.2: limits are step 1. The list is what the panel renders first, in order.
    expect(inferenceLimits(one)[0]).toMatch(/נרשמו 12 החלטות/);
    expect(inferenceLimits(one).length).toBeGreaterThan(1);
  });
});

describe("the wiring, which is where this was lost", () => {
  it("takes the candidates from the draft and not from React state", async () => {
    /*
     * Home.tsx calls setCandidatesConsidered([]) at the start of the reveal, clearing it for the
     * next decision, and builds RevealInputs further down the same closure. Anything reading the
     * state variable there gets an empty array on every single decision -- the choice-rule
     * sentence would never fire, and the one-candidate limit would fire on every reveal. Both
     * failures are silent. Nothing in this repository renders Home end to end, so the assertion
     * is against the source, as game-review.test.tsx does for the R3 gate.
     */
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    const at = source.indexOf("const inputs: RevealInputs = {");
    expect(at, "no RevealInputs literal in Home.tsx").toBeGreaterThan(-1);
    const literal = source.slice(at, source.indexOf("};", at));
    expect(literal, "RevealInputs does not pass candidatesConsidered at all").toContain(
      "candidatesConsidered:",
    );
    expect(literal, "RevealInputs reads the reset React state").toMatch(
      /candidatesConsidered:\s*draft\.candidatesConsidered/,
    );

    // And the trap itself is still there, so this assertion keeps meaning something.
    const reset = source.indexOf("setCandidatesConsidered([])");
    expect(reset, "the reset is gone; this test now guards nothing").toBeGreaterThan(-1);
    expect(reset, "the reset no longer precedes the reveal inputs").toBeLessThan(at);
  });
});
