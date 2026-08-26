/**
 * What a mistake cost, and why centipawns could not say.
 *
 * Calibration is `P(event | stated confidence)`, and it is undefined unless the event is ONE
 * event. "Cost no more than thirty centipawns" is not one event: thirty centipawns is 2.76 points
 * of winning chances at a level position and 0.28 at +10.00. A player was being charged for a
 * slip in a won game that cost them nothing, on the same rule that correctly charged them at
 * level -- and the number those two produced was pooled into one calibration reading.
 *
 * Every assertion here is about INVARIANCE: the same cost has to mean the same thing wherever the
 * game stood, which is the property centipawns do not have and win probability does.
 */
import { describe, expect, it } from "vitest";
import {
  WIN_PROBABILITY_K,
  winProbability,
  winProbabilityLoss,
} from "@shared/win-probability";
import { ACCURATE_CP_LOSS, ACCURATE_WIN_PROBABILITY_LOSS } from "@shared/detector";
import { MATE_SCORE } from "@/lib/engine-line";

describe("the curve behaves like winning chances", () => {
  it("is even at a level position and stays inside the unit interval on ordinary evaluations", () => {
    expect(winProbability(0)).toBeCloseTo(0.5, 12);
    for (const cp of [-9000, -1000, -30, 0, 30, 1000, 9000]) {
      expect(winProbability(cp), `${cp}cp`).toBeGreaterThan(0);
      expect(winProbability(cp), `${cp}cp`).toBeLessThan(1);
    }
  });

  it("saturates at exactly 1 before it reaches a mate score, which is measured, not assumed", () => {
    /*
     * MEASURED: the curve returns exactly 1.0 from 9,978cp upward, because `1 + exp(-36.7)` is
     * already 1.0 in float64 -- the addend falls below half the spacing above one. MATE_SCORE is
     * 10,000, so EVERY mate-scored position has a win probability of exactly 1.
     *
     * Harmless for what this module does: a loss is a DIFFERENCE of two of these and stays finite
     * and correct, including from a mate score. It is asserted rather than left to be discovered,
     * because a future caller that takes `log(1 - winProbability(cp))` would find infinity there
     * with nothing in the code to warn it.
     *
     * And the saturation is ASYMMETRIC, which is the part that surprises. The low end does not
     * mirror it: at -100,000cp this is still 1.2e-160 rather than zero, because `1/(1 + huge)`
     * stays a small positive number while `1/(1 + tiny)` rounds to one.
     */
    expect(winProbability(9978)).toBe(1);
    expect(winProbability(9977)).toBeLessThan(1);
    expect(winProbability(MATE_SCORE)).toBe(1);
    expect(winProbability(-MATE_SCORE)).toBeGreaterThan(0);
    expect(winProbability(-100_000)).toBeGreaterThan(0);

    // A forced mate that stays a forced mate cost nothing; throwing it away costs nearly half.
    expect(winProbabilityLoss(MATE_SCORE, 30)).toBeLessThan(1e-6);
    expect(winProbabilityLoss(MATE_SCORE, MATE_SCORE - 100)).toBeGreaterThan(0.4);
  });

  it("is symmetric, because an advantage is the opponent's disadvantage", () => {
    for (const cp of [15, 120, 450, 2000]) {
      expect(winProbability(cp) + winProbability(-cp)).toBeCloseTo(1, 12);
    }
  });

  it("rises with the evaluation and never falls", () => {
    let previous = -1;
    for (let cp = -1500; cp <= 1500; cp += 25) {
      const value = winProbability(cp);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});

describe("the same centipawns are not the same cost", () => {
  it("charges thirty centipawns nearly ten times more at level than in a won game", () => {
    /*
     * THE MEASUREMENT THAT MOTIVATED THE CHANGE, held here so it cannot quietly stop being true.
     * These are the numbers the old rule pooled into one "event".
     */
    const atLevel = winProbabilityLoss(0, ACCURATE_CP_LOSS);
    const atWon = winProbabilityLoss(1000, ACCURATE_CP_LOSS);
    expect(atLevel).toBeCloseTo(0.0276, 4);
    expect(atWon).toBeCloseTo(0.0028, 4);
    expect(atLevel / atWon).toBeGreaterThan(9);
  });

  it("takes a far bigger blunder to lose the same chances once you are winning", () => {
    // The same fact from the other side: at +10.00 it takes over two hundred centipawns to give
    // away what thirty gives away at level. Charging both as one event is the defect.
    expect(winProbabilityLoss(1000, 212)).toBeCloseTo(winProbabilityLoss(0, 30), 3);
  });

  it("gives the same answer wherever the game stood, which is the whole point", () => {
    /*
     * The invariance test. For a fixed COST, the outcome rule must fire identically at every
     * evaluation -- that is what makes it one event. Asserted by finding the centipawn loss worth
     * exactly the threshold at each standing and checking the rule flips there and only there.
     */
    for (const standing of [-800, -300, 0, 300, 800]) {
      let low = 0;
      let high = 6000;
      for (let step = 0; step < 60; step += 1) {
        const middle = (low + high) / 2;
        if (winProbabilityLoss(standing, middle) < ACCURATE_WIN_PROBABILITY_LOSS) low = middle;
        else high = middle;
      }
      expect(winProbabilityLoss(standing, low * 0.9)).toBeLessThan(ACCURATE_WIN_PROBABILITY_LOSS);
      expect(winProbabilityLoss(standing, high * 1.1)).toBeGreaterThan(
        ACCURATE_WIN_PROBABILITY_LOSS,
      );
    }
  });
});

describe("the threshold is derived, not chosen", () => {
  it("is exactly what the old centipawn rule cost at a level position", () => {
    /*
     * Continuity, deliberately. The new rule agrees with the old one where the old one was
     * defensible and departs from it only where it was not, so nothing about the accuracy rate on
     * balanced positions moves. Written as a number here instead, that agreement would be a
     * coincidence the next edit could break in silence.
     */
    expect(ACCURATE_WIN_PROBABILITY_LOSS).toBe(
      winProbabilityLoss(ACCURATE_CP_LOSS / 2, ACCURATE_CP_LOSS),
    );
    expect(ACCURATE_WIN_PROBABILITY_LOSS).toBeCloseTo(0.0276, 4);
  });

  it("never calls inaccurate a decision the old centipawn rule called accurate", () => {
    /*
     * THE INVARIANT THE ANCHOR WAS MOVED FOR, and a test is what found it. The cost of a fixed
     * centipawn loss peaks where the interval straddles zero symmetrically -- at half the loss,
     * not at zero -- so anchoring at a level position made the new rule marginally STRICTER
     * around +15cp, and decisions that used to be accurate would have quietly stopped being so.
     *
     * Anchored at the peak the change is a pure relaxation: swept across every evaluation the
     * record can hold, thirty centipawns is accurate everywhere, and the rule departs from the
     * old one only by forgiving losses the old one should never have charged.
     */
    for (let standing = -MATE_SCORE; standing <= MATE_SCORE; standing += 7) {
      expect(
        winProbabilityLoss(standing, ACCURATE_CP_LOSS),
        `${standing}cp: the old rule's accurate decision became inaccurate`,
      ).toBeLessThanOrEqual(ACCURATE_WIN_PROBABILITY_LOSS);
    }
  });

  it("forgives in a decided game what it charges at level, which is the departure", () => {
    // The other half: the new rule is strictly more permissive, and where it is more permissive
    // is exactly where the centipawn rule was measuring the position rather than the player.
    expect(winProbabilityLoss(1000, 150)).toBeLessThan(ACCURATE_WIN_PROBABILITY_LOSS);
    expect(winProbabilityLoss(0, 150)).toBeGreaterThan(ACCURATE_WIN_PROBABILITY_LOSS);
  });
});

describe("a loss is never negative", () => {
  it("returns zero when the move improved the evaluation", () => {
    // A search that came back out of order must not hand a player credit for a mistake.
    expect(winProbabilityLoss(0, -50)).toBe(0);
    expect(winProbabilityLoss(200, -1)).toBe(0);
  });

  it("is zero for a move that cost nothing at all", () => {
    expect(winProbabilityLoss(0, 0)).toBe(0);
    expect(winProbabilityLoss(750, 0)).toBe(0);
  });
});

describe("the constant is the published one, and is not a law of chess", () => {
  it("keeps Lichess's fitted value so a number here can be checked against theirs", () => {
    /*
     * Fitted on games between 2300-rated players. Published estimates for grandmasters are
     * roughly twice as steep, so a given centipawn loss costs a stronger field MORE than this
     * curve says -- every product inheriting it for another population misstates what moves cost,
     * this one included. It is used because it is reproducible, not because it is universal.
     */
    expect(WIN_PROBABILITY_K).toBe(0.00368208);
  });
});
