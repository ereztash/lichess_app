import { describe, expect, it } from "vitest";
import {
  BUILD_LIMIT,
  ENGINE_NOISE_CP,
  inferenceLimits,
  nextQuestion,
  theOneThing,
  type RevealInputs,
} from "@/lib/reveal";

const base: RevealInputs = {
  depth: 20,
  cpLoss: 0,
  chosenMove: "g8f6",
  bestMove: "g8f6",
  chosenWasBest: true,
  confidence: 3,
  statedUnknown: "לא יודע אם d5 עובד",
  decisionsOnRecord: 120,
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
    const question = nextQuestion(from({ statedUnknown: "", bestMove: "f8e7" }));
    expect(question).toContain("g8f6");
    expect(question).toContain("f8e7");
  });
});
