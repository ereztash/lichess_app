import { describe, expect, it } from "vitest";
import {
  BUILD_LIMIT,
  ENGINE_NOISE_CP,
  inferenceLimits,
  nextQuestion,
  theOneThing,
  type RevealInputs,
} from "@shared/reveal";

const base: RevealInputs = {
  depth: 20,
  cpLoss: 0,
  chosenMove: "g8f6",
  bestMove: "g8f6",
  chosenWasBest: true,
  confidence: 3,
  statedUnknown: "לא יודע אם d5 עובד",
  decisionsOnRecord: 120,
  candidatesConsidered: [],
};
const from = (o: Partial<RevealInputs>): RevealInputs => ({ ...base, ...o });

describe("what cannot be inferred comes first, and is never empty", () => {
  it("always states that the record describes decisions, not the player", () => {
    expect(inferenceLimits(base)[0]).toContain("לא של השחקן");
  });

  it("says so plainly when there is exactly one decision on record", () => {
    const limits = inferenceLimits(from({ decisionsOnRecord: 1 }));
    expect(limits[0]).toContain("שום דבר כאן אינו דפוס");
  });

  it("names a shallow search rather than presenting its number as settled", () => {
    expect(inferenceLimits(from({ depth: 12 })).join(" ")).toContain("עומק 12");
  });

  /*
   * Three tests used to live here, covering `cloudAvailable` and `repertoireGames`. Both fields
   * were hardcoded at the only call site -- false and null -- so one branch fired on EVERY
   * reveal and the other could never fire at all. The first printed "אין הערכת ענן לעמדה הזו",
   * phrased as a finding about that position when it was a constant; the second was dead.
   *
   * The tests passed the whole time, because they supplied values production never did.
   */
  it("states no per-position limit that is really a property of the build", () => {
    // The single-engine fact is true of every position, so it must not be inside this list.
    expect(inferenceLimits(base).join(" ")).not.toContain("אין הערכת ענן");
    expect(BUILD_LIMIT).toContain("מנוע מקומי אחד");
  });

  it("says nothing about a repertoire it never queried", () => {
    expect(inferenceLimits(base).join(" ")).not.toContain("רפרטואר");
  });

  it("calls a within-noise difference what it is, rather than a mistake", () => {
    const limits = inferenceLimits(
      from({ cpLoss: ENGINE_NOISE_CP - 5, chosenWasBest: false, bestMove: "f8e7" }),
    );
    expect(limits.join(" ")).toContain("זו אינה טעות");
  });
});

describe("the one thing to work on is one thing, or nothing", () => {
  it("returns null when nothing measured supports a sentence", () => {
    // Chose the engine's move, moderate confidence, deep search: there is nothing honest here.
    expect(theOneThing(base)).toBeNull();
  });

  it("prefers the calibration gap over the move when confidence was high and loss was real", () => {
    const one = theOneThing(from({ cpLoss: 180, chosenWasBest: false, confidence: 5 }));
    expect(one?.text).toContain("הפער בין הביטחון לתוצאה");
    expect(one?.basis).toContain("ביטחון 5/5");
  });

  it("talks about the move when confidence was not the signal", () => {
    const one = theOneThing(from({ cpLoss: 180, chosenWasBest: false, confidence: 2 }));
    expect(one?.text).toContain("g8f6");
    expect(one?.basis).toContain("180 ס״פ");
  });

  it("does not call a within-noise difference a cost", () => {
    const one = theOneThing(from({ cpLoss: 20, chosenWasBest: false, confidence: 5 }));
    expect(one?.text ?? "").not.toContain("עלה");
  });

  it("carries its basis whenever it says anything at all", () => {
    for (const inputs of [
      from({ cpLoss: 180, chosenWasBest: false, confidence: 5 }),
      from({ cpLoss: 180, chosenWasBest: false, confidence: 2 }),
      from({ cpLoss: 5, confidence: 1 }),
    ]) {
      const one = theOneThing(inputs);
      if (one) expect(one.basis.length).toBeGreaterThan(0);
    }
  });
});

describe("the next question is anchored to what the player could not evaluate", () => {
  it("quotes the player's own stated unknown back to them", () => {
    expect(nextQuestion(base)).toContain("לא יודע אם d5 עובד");
  });

  it("falls back to the decision itself when no unknown was stated", () => {
    /*
     * `chosenWasBest: false` is not padding. This override used to name a DIFFERENT best move
     * while leaving the flag saying the player had chosen it -- a state the product can never
     * produce, and the test passed on it for as long as nothing read the flag. The moment
     * `nextQuestion` did, the contradiction surfaced here rather than in the app.
     */
    const question = nextQuestion(from({ statedUnknown: "", bestMove: "f8e7", chosenWasBest: false }));
    expect(question).toContain("g8f6");
    expect(question).toContain("f8e7");
  });

  it("never asks the player to choose between a move and itself", () => {
    /*
     * THE DEFECT, AS SEEN ON SCREEN: "מה היית צריך לדעת כדי לבחור בין e4d5 ל-e4d5?" -- asked
     * whenever the player picked exactly the move the engine picked. The comparison branch
     * interpolated both moves without ever checking they were two.
     *
     * The test above missed it because its fixture overrides `bestMove` to something different,
     * which is the one case that cannot produce the bug. The default fixture has them EQUAL, so
     * the degenerate sentence was one line away the whole time.
     */
    const question = nextQuestion(from({ statedUnknown: "", chosenMove: "e4d5", bestMove: "e4d5" }));
    expect(question).not.toMatch(/בין e4d5 ל-?e4d5/);
    expect(question, "the question stopped naming the decision at all").toContain("e4d5");
  });

  it("asks what the reason was, rather than congratulating the right move", () => {
    /*
     * Picking the engine's move is not evidence of understanding it, and this product exists to
     * refuse that inference. So the branch does not say "correct" -- it asks whether the reason
     * would have survived the engine choosing differently, which is the only version of the
     * question that could come back false.
     */
    const question = nextQuestion(from({ statedUnknown: "", chosenMove: "e4d5", bestMove: "e4d5" }));
    expect(question).toMatch(/נימוק|למה|מה גרם/);
    expect(question, "the question told the player they were right").not.toMatch(/כל הכבוד|מצוין|נכון!/);
  });

  it("stays non-degenerate even when the chosenWasBest flag contradicts the moves", () => {
    /*
     * The guard reads the STRINGS, because the strings are what the sentence interpolates. The
     * flag and the comparison are computed from the same expression at the only call site, so a
     * guard on the flag alone would be untested by construction -- a positive control confirmed
     * exactly that by flipping it and watching nothing fail.
     */
    const question = nextQuestion(
      from({ statedUnknown: "", chosenMove: "e4d5", bestMove: "e4d5", chosenWasBest: false }),
    );
    expect(question).not.toMatch(/בין e4d5 ל-?e4d5/);
  });

  it("still quotes a stated unknown even when the move was the engine's", () => {
    // The unknown branch comes first and is unaffected: what the player said they could not
    // evaluate is the one thing on screen the engine did not produce, right move or not.
    const question = nextQuestion(from({ chosenMove: "e4d5", bestMove: "e4d5" }));
    expect(question).toContain("לא יודע אם d5 עובד");
  });
});
