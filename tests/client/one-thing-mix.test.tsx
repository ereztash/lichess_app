// @vitest-environment jsdom
/**
 * How often each of the reveal's four sentences actually fires.
 *
 * WHY THIS MEASUREMENT EXISTS. `chose-past-it` is the only sentence in this product that no other
 * chess tool can write: every engine knows the best move, none of them knows it was already on
 * your board, because none of them makes you commit first. It arrives on decision one and needs
 * no aggregation. None of which matters if it fires three times in a hundred -- and that number
 * has never been measured.
 *
 * WHAT THESE TESTS HOLD SHUT. Two things, and the second is the one that would rot quietly:
 * that each branch is counted as itself, and that the counter calls the REAL branch function
 * rather than a copy of its conditions. A copy would drift the first time a threshold moved, and
 * then the product and the measurement of the product would disagree about what the product does.
 */
import { describe, expect, it } from "vitest";
import {
  silenceBasis,
  type RevealInputs,
  ENGINE_NOISE_CP,
  MATERIAL_LOSS_CP,
  oneThingMix,
  theOneThing,
  type MixableDecision,
} from "@shared/reveal";

/** A revealed decision. Defaults land on "outplayed" so each test moves one thing. */
const d = (over: Partial<MixableDecision> = {}): MixableDecision => ({
  confidence: 3,
  candidatesConsidered: ["g1f3"],
  chosenMove: "g1f3",
  cpLoss: MATERIAL_LOSS_CP + 40,
  bestMove: "e2e4",
  ...over,
});

/** A revealed decision as the panel sees it. */
const inputs = (over: Partial<RevealInputs> = {}): RevealInputs => ({
  depth: 18,
  cpLoss: 60,
  chosenMove: "g1f3",
  bestMove: "e2e4",
  chosenWasBest: false,
  confidence: 3,
  statedUnknown: "",
  decisionsOnRecord: 1,
  candidatesConsidered: ["g1f3"],
  ...over,
});

describe("each branch is counted as itself", () => {
  it("counts the move that was already on the board", () => {
    // The headline finding: the engine's move was among the ones the player put down.
    const mix = oneThingMix([d({ candidatesConsidered: ["g1f3", "e2e4"] })]);
    expect(mix.counts["chose-past-it"]).toBe(1);
    expect(mix.counts.outplayed).toBe(0);
  });

  it("counts high confidence on a move that cost material", () => {
    const mix = oneThingMix([d({ confidence: 5 })]);
    expect(mix.counts["confident-and-wrong"]).toBe(1);
  });

  it("counts a costly move with nothing else to add", () => {
    const mix = oneThingMix([d()]);
    expect(mix.counts.outplayed).toBe(1);
  });

  it("counts choosing well inside the noise while saying so little", () => {
    const mix = oneThingMix([d({ cpLoss: ENGINE_NOISE_CP - 10, confidence: 1 })]);
    expect(mix.counts["trusted-it-too-little"]).toBe(1);
  });

  it("counts silence as an outcome, not as a gap in the data", () => {
    /*
     * "Nothing here the measurement supports saying" is a valid result and the screen says so.
     * If it were dropped from the denominator every other share would be inflated by exactly the
     * decisions where the product correctly declined to speak -- which would be the product
     * overstating itself in the one place it is proudest of not doing.
     */
    const mix = oneThingMix([d({ cpLoss: ENGINE_NOISE_CP - 10, confidence: 4 })]);
    expect(mix.silent).toBe(1);
    expect(mix.n).toBe(1);
    expect(Object.values(mix.counts).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("puts every revealed decision in exactly one place", () => {
    // The shares are read as a distribution, so they have to be one.
    const decisions = [
      d({ candidatesConsidered: ["g1f3", "e2e4"] }),
      d({ confidence: 5 }),
      d(),
      d({ cpLoss: ENGINE_NOISE_CP - 10, confidence: 1 }),
      d({ cpLoss: ENGINE_NOISE_CP - 10, confidence: 4 }),
    ];
    const mix = oneThingMix(decisions);
    const total = Object.values(mix.counts).reduce((a, b) => a + b, 0) + mix.silent;
    expect(total, "a decision was counted twice or not at all").toBe(mix.n);
    expect(mix.n).toBe(decisions.length);
  });
});

describe("what cannot be counted, and is not", () => {
  it("skips decisions the engine has not answered", () => {
    /*
     * R3 in the arithmetic. Before a reveal there is no centipawn loss and no engine move, so
     * there is nothing to classify -- and such a decision must not land in the denominator, or
     * every share would be diluted by decisions that were never eligible for any of them.
     */
    const mix = oneThingMix([d(), { ...d(), cpLoss: null }, { ...d(), bestMove: null }]);
    expect(mix.n, "an unrevealed decision reached the denominator").toBe(1);
  });

  it("never fires the headline branch for an imported game", () => {
    /*
     * An imported PGN carries no record of what was on the board before the move, so
     * `candidate_moves_considered` is empty for every one of them. This is the whole reason the
     * fire rate needs LIVE decisions and cannot be lifted from the 554 already scanned.
     */
    const imported = Array.from({ length: 50 }, () => d({ candidatesConsidered: [] }));
    const mix = oneThingMix(imported);
    expect(mix.counts["chose-past-it"], "an imported decision produced the headline finding").toBe(0);
    expect(mix.n).toBe(50);
  });
});

describe("the ceiling, which is what stops the first row being read as an estimate", () => {
  it("counts decisions where the loss was big enough for the question to apply at all", () => {
    const mix = oneThingMix([
      d({ cpLoss: MATERIAL_LOSS_CP }),
      d({ cpLoss: MATERIAL_LOSS_CP + 300 }),
      d({ cpLoss: ENGINE_NOISE_CP - 1 }),
      d({ cpLoss: MATERIAL_LOSS_CP - 1 }),
    ]);
    expect(mix.eligible).toBe(2);
    expect(mix.n).toBe(4);
  });

  it("never reports the headline branch above its own ceiling", () => {
    // If this ever inverts, one of the two is computed from different thresholds than the other.
    const mix = oneThingMix(
      Array.from({ length: 30 }, (_, i) =>
        d({
          candidatesConsidered: i % 2 ? ["g1f3", "e2e4"] : ["g1f3"],
          cpLoss: i % 3 ? MATERIAL_LOSS_CP + 50 : ENGINE_NOISE_CP - 5,
        }),
      ),
    );
    expect(mix.counts["chose-past-it"]).toBeLessThanOrEqual(mix.eligible);
  });
});

describe("the counter uses the real branches, not a copy of their conditions", () => {
  it("agrees with theOneThing on every decision it classifies", () => {
    /*
     * The assertion that keeps this honest over time. Restating the four `if`s inside the counter
     * is the obvious way to write it, and it would drift the first time a threshold moved -- and
     * then the measurement OF the product would disagree with the product, silently, in the
     * direction that flatters whichever was edited last.
     */
    /*
     * The fixtures deliberately SIT ON the thresholds, and the first version of this test did not
     * -- every decision was 40cp clear of the material line, so a copied branch set with the line
     * moved by 20 classified all of them identically and this assertion passed against exactly the
     * defect it exists to catch. The control went green, which is the only reason it was found.
     * Anything within a few centipawns of a boundary belongs here.
     */
    const decisions = [
      d({ candidatesConsidered: ["g1f3", "e2e4"] }),
      d({ confidence: 5 }),
      d(),
      d({ cpLoss: ENGINE_NOISE_CP - 10, confidence: 1 }),
      d({ cpLoss: ENGINE_NOISE_CP - 10, confidence: 4 }),
      d({ confidence: 4, candidatesConsidered: ["g1f3", "e2e4"] }),
      // On the material line exactly, and just above it, in each branch that reads that line.
      d({ cpLoss: MATERIAL_LOSS_CP, candidatesConsidered: ["g1f3", "e2e4"] }),
      d({ cpLoss: MATERIAL_LOSS_CP + 1, confidence: 5 }),
      d({ cpLoss: MATERIAL_LOSS_CP + 10 }),
      d({ cpLoss: MATERIAL_LOSS_CP + 19, candidatesConsidered: ["g1f3", "e2e4"] }),
      // And on the noise line, which the other two branches read.
      d({ cpLoss: ENGINE_NOISE_CP, confidence: 2 }),
      d({ cpLoss: ENGINE_NOISE_CP + 1, confidence: 2 }),
    ];
    const expected = { "chose-past-it": 0, "confident-and-wrong": 0, outplayed: 0, "trusted-it-too-little": 0 };
    let expectedSilent = 0;
    for (const one of decisions) {
      const out = theOneThing({
        depth: 0,
        cpLoss: one.cpLoss!,
        chosenMove: one.chosenMove,
        bestMove: one.bestMove!,
        chosenWasBest: one.chosenMove === one.bestMove,
        confidence: one.confidence,
        statedUnknown: "",
        decisionsOnRecord: decisions.length,
        candidatesConsidered: one.candidatesConsidered,
      });
      if (out === null) expectedSilent += 1;
      else expected[out.kind] += 1;
    }
    const mix = oneThingMix(decisions);
    expect(mix.counts, "the counter and the reveal disagree about the same decisions").toEqual(expected);
    expect(mix.silent).toBe(expectedSilent);
  });

  it("puts the choice rule ahead of the confidence sentence, as the reveal does", () => {
    // Both conditions hold at once here. The reveal ranks the choice rule first deliberately --
    // it needs no aggregation and points at different work -- and the count must rank it the same.
    const mix = oneThingMix([d({ confidence: 5, candidatesConsidered: ["g1f3", "e2e4"] })]);
    expect(mix.counts["chose-past-it"]).toBe(1);
    expect(mix.counts["confident-and-wrong"]).toBe(0);
  });
});

describe("silence says WHICH kind of silence, because there are two", () => {
  it("names the band above the noise and below the line", () => {
    /*
     * The defect. `theOneThing` returns null on two disjoint bands and the panel printed one
     * sentence for both -- "you chose within the evaluation noise and your confidence matched".
     * On 31-99cp that is false by the file's own constants, and it was asserted at confidence 5
     * as readily as at 3. Every fixture in the existing reveal tests sat at 4 or 20 centipawns,
     * so the whole band was untested.
     */
    expect(silenceBasis(inputs({ cpLoss: 60 }))).toBe("below-the-line");
    expect(silenceBasis(inputs({ cpLoss: ENGINE_NOISE_CP + 1 }))).toBe("below-the-line");
    expect(silenceBasis(inputs({ cpLoss: MATERIAL_LOSS_CP - 1 }))).toBe("below-the-line");
  });

  it("still names the noise band as the noise band", () => {
    expect(silenceBasis(inputs({ cpLoss: ENGINE_NOISE_CP }))).toBe("inside-noise");
    expect(silenceBasis(inputs({ cpLoss: 0 }))).toBe("inside-noise");
  });

  it("renders a different sentence for each, and never claims noise outside it", async () => {
    // Section 4.5: two different situations must not render as one sentence.
    const { RevealPanel } = await import("@/components/RevealPanel");
    const { render } = await import("@testing-library/react");

    const { container: quiet } = render(
      <RevealPanel inputs={inputs({ cpLoss: 10, confidence: 4 })} analysis={null} fen="8/8/8/8/8/8/8/K6k w - - 0 1" statedKnown="" />,
    );
    const { container: band } = render(
      <RevealPanel inputs={inputs({ cpLoss: 60, confidence: 5 })} analysis={null} fen="8/8/8/8/8/8/8/K6k w - - 0 1" statedKnown="" />,
    );
    const quietText = quiet.querySelector(".one-thing-none")!.textContent ?? "";
    const bandText = band.querySelector(".one-thing-none")!.textContent ?? "";

    expect(quietText).toMatch(/בתוך רעש ההערכה/);
    expect(
      bandText,
      "a 60cp decision is still being told it was inside the engine's noise",
    ).not.toMatch(/בחרת בתוך רעש ההערכה/);
    // It names the two thresholds it sits between, so the silence carries its own basis.
    expect(bandText).toContain(String(ENGINE_NOISE_CP));
    expect(bandText).toContain(String(MATERIAL_LOSS_CP));
    expect(bandText).toContain("60");
    expect(quietText, "the two silences render alike").not.toBe(bandText);
  });
});
