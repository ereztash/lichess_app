/**
 * The road not taken: what the player would have played instead, asked before the engine speaks.
 *
 * WHY THIS IS A DIFFERENT MEASUREMENT FROM `candidate_moves_considered`. That field asks "what did
 * you consider?" -- a RECALL question, and people reconstruct. This asks the player to PRODUCE an
 * alternative, and the answer is a chess move, which the engine can score. It is not a belief
 * about one's own process (the class of self-report this project removed on published evidence:
 * Reed et al. 1974; Craig et al. 2020, r = 0.22 [0.14, 0.31]) -- it is an object with a value.
 *
 * WHAT IT MEASURES THAT NOTHING HERE MEASURES YET. de Groot's finding, replicated at 70 years
 * (Connors, Burns & Campitelli 2011), is that masters do not search deeper or wider -- they
 * SELECT better candidates and evaluate them better. So the quality of the alternative is a
 * reading on the half of expertise the accuracy rate cannot see. Four cases, and the third is the
 * reason the whole thing exists:
 *
 *   both-good   chosen accurate, alternative accurate    -- more than one way was available
 *   narrow      chosen accurate, alternative inaccurate  -- right answer, nothing behind it
 *   reachable   chosen INACCURATE, alternative ACCURATE  -- the better move was named, not chosen
 *   neither     both inaccurate                          -- the position was out of reach
 *
 * `reachable` is the Einstellung signature. Bilalić, McLeod & Gobet (PLoS ONE 2013) tracked
 * masters' eyes and found they kept looking at squares belonging to the familiar solution WHILE
 * REPORTING that they were searching for a new one. That is this product's subject -- the gap
 * between what a player did and what they believe they did -- measured in a lab. This is the same
 * gap, measurable without one: the move was in the player's own hand and did not get played.
 *
 * WHAT IT IS NOT. One self-generated alternative is not the player's candidate set, and this file
 * never calls it that.
 */
import { describe, expect, it } from "vitest";
import { ACCURATE_WIN_PROBABILITY_LOSS } from "@shared/detector";
import { winProbabilityLoss } from "@shared/win-probability";
import {
  MIN_LEGAL_MOVES_TO_ASK,
  PROBE_PROBABILITY,
  assignProbe,
  classifyCounterfactual,
  probeEligibility,
} from "@shared/counterfactual";

/** A quiet middlegame position with many legal moves. */
const OPEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5";
/**
 * Black king on h8, white queen h7 giving check, one legal reply: KxQ.
 *
 * The white king is on a1 and that is load-bearing. The first version of this fixture put it on
 * g6, where it DEFENDS h7 -- which makes the capture illegal, the position mate, and the legal
 * move count zero rather than one. It would have passed `eligible === false` for the wrong reason
 * and left the one-move case untested.
 */
const ONE_REPLY = "7k/7Q/8/8/8/8/8/K7 b - - 0 1";

describe("the question is only asked where it can be answered", () => {
  it("refuses a position with a single legal move", () => {
    /*
     * "What would you have done instead" has no answer when there was nothing else to do. Asking
     * anyway would put rows in the probed arm that carry no information and dilute it.
     */
    const eligibility = probeEligibility(ONE_REPLY);
    expect(eligibility.legalMoves).toBe(1);
    expect(eligibility.eligible).toBe(false);
  });

  it("asks where there is a choice", () => {
    const eligibility = probeEligibility(OPEN);
    expect(eligibility.legalMoves).toBeGreaterThan(MIN_LEGAL_MOVES_TO_ASK);
    expect(eligibility.eligible).toBe(true);
  });

  it("records how many moves there were, rather than filtering on a chosen number", () => {
    /*
     * THE DISCIPLINE THAT MATTERS HERE. A position with three legal moves is a thinner question
     * than one with forty, and it would be easy to invent a floor -- "at least eight" -- to make
     * the arm look cleaner. That floor would be a threshold chosen to shape a result. The
     * eligibility rule is DEFINITIONAL (a question with no alternative cannot be asked) and the
     * count is carried as a covariate so an analysis can condition on it instead.
     */
    expect(MIN_LEGAL_MOVES_TO_ASK).toBe(2);
    expect(probeEligibility(OPEN).legalMoves).toBeGreaterThan(10);
  });

  it("says a malformed position is ineligible rather than throwing into the game loop", () => {
    expect(probeEligibility("not a fen").eligible).toBe(false);
    expect(probeEligibility("not a fen").legalMoves).toBe(0);
  });
});

describe("the arm is assigned before the player is seen, and recorded either way", () => {
  it("marks ineligible positions as ineligible, not as a control", () => {
    /*
     * A position that could not be asked is NOT a member of the unprobed arm. Folding it in would
     * make the control group a mixture of "eligible and not chosen" and "never askable", and the
     * comparison between arms would silently be a comparison between position types.
     */
    expect(assignProbe(ONE_REPLY, () => 0).assignment).toBe("ineligible");
  });

  it("assigns both arms among eligible positions", () => {
    expect(assignProbe(OPEN, () => 0).assignment).toBe("probed");
    expect(assignProbe(OPEN, () => 0.99).assignment).toBe("not-probed");
  });

  it("does not let the position influence the arm", () => {
    /*
     * THE VALIDITY PROPERTY OF THE WHOLE EXPERIMENT. If probing were more likely on rich
     * positions, the probed arm would be harder by construction and every comparison between arms
     * would be a comparison of position difficulty wearing an experiment's clothes.
     *
     * Driven with a counter rather than a random source so the assertion is about the FUNCTION and
     * not about a sample: the same draw sequence must produce the same arm regardless of which
     * position it is handed.
     */
    let calls = 0;
    const draw = () => (calls++ % 4) / 4;
    const wide = Array.from({ length: 40 }, () => assignProbe(OPEN, draw).assignment);
    calls = 0;
    const narrow = Array.from({ length: 40 }, () =>
      assignProbe("8/8/4k3/8/8/4K3/8/6R1 w - - 0 1", draw).assignment,
    );
    expect(wide).toEqual(narrow);
  });

  it("keeps the probe rate a burden parameter in a range a game can carry", () => {
    /*
     * Not a measurement threshold: it changes how much data the arm gets and how often the player
     * is interrupted, never whether a finding is real. Probing everything would make the game
     * unplayable and maximise reactivity; probing almost nothing gives no n.
     */
    expect(PROBE_PROBABILITY).toBeGreaterThan(0.05);
    expect(PROBE_PROBABILITY).toBeLessThan(0.5);
  });
});

describe("the four readings, on the product's own accuracy rule", () => {
  /** A level position, where the accuracy rule is at its strictest. */
  const evalCp = 15;
  const accurate = 20;
  const inaccurate = 300;

  const check = (chosen: number, alternative: number) =>
    classifyCounterfactual({ evalCp, chosenCpLoss: chosen, alternativeCpLoss: alternative });

  it("reads two good moves as two good moves", () => {
    expect(check(accurate, accurate)).toBe("both-good");
  });

  it("reads a right answer with nothing behind it", () => {
    expect(check(accurate, inaccurate)).toBe("narrow");
  });

  it("reads the move that was named and not played", () => {
    /*
     * THE ONE THE FILE EXISTS FOR. The player produced a better move than the one they committed
     * to, before anybody told them anything. Nothing else in this product distinguishes that from
     * "could not see it".
     */
    expect(check(inaccurate, accurate)).toBe("reachable");
  });

  it("reads a position that was out of reach", () => {
    expect(check(inaccurate, inaccurate)).toBe("neither");
  });

  it("uses the rule the rest of the record is scored by, not a copy of it", () => {
    /*
     * `winProbabilityLoss` at the POSITION'S evaluation, not a flat centipawn cut. Thirty
     * centipawns is 2.76 points of winning chances at level and 0.28 at +10.00 -- a tenth of the
     * same event -- so a flat threshold would make "accurate" mean two different things inside one
     * classification, and this reading would not be comparable to the accuracy rate beside it.
     */
    const decided = 1000; // a position already won: a large cp loss costs little there
    const cpLoss = 60;
    expect(winProbabilityLoss(decided, cpLoss)).toBeLessThanOrEqual(ACCURATE_WIN_PROBABILITY_LOSS);
    expect(
      classifyCounterfactual({ evalCp: decided, chosenCpLoss: cpLoss, alternativeCpLoss: cpLoss }),
      "a flat centipawn threshold has replaced the win-probability rule",
    ).toBe("both-good");
  });

  it("says nothing when there is no alternative to compare", () => {
    // Asked and unable to name one is a real answer about the player -- and it is not a reading
    // about the two moves, because there is only one move.
    expect(classifyCounterfactual({ evalCp, chosenCpLoss: 10, alternativeCpLoss: null })).toBeNull();
  });

  it("says nothing before the engine has spoken", () => {
    // R3 from the other side: no reading exists until there is a result to read.
    expect(
      classifyCounterfactual({ evalCp: null, chosenCpLoss: 10, alternativeCpLoss: 10 }),
    ).toBeNull();
  });
});
