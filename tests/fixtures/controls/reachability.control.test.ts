// @vitest-environment jsdom
/**
 * GATE-REACHABILITY positive control: the product as it stood, where a newcomer could not get in.
 * Expected to FAIL -- that failure is the proof the gate is a gate.
 *
 * TWO DEFECTS, BECAUSE THE GATE MAKES TWO CLAIMS and one control would leave the other unproven.
 * Both are the shipped code, not inventions:
 *
 *   1. THE FRONT DOOR AS IT WAS. Every decision that is not an anchor, a drill or a transfer check
 *      is `play`, and `play` is drawn at ASK_RATE. The position `pickFirstDecision` hands over
 *      comes from a game the player played, so it is `play`, so three times in four it carried no
 *      confidence -- and `scored` stayed at zero, which is the exact condition that put the same
 *      screen back in front of them.
 *
 *   2. REGISTRABILITY AS IT WAS. `isRegistrableBucket` asked one question: is the key one of the
 *      six. `clock-under-1m` is one of the six, and no decision the live loop writes can ever fall
 *      inside it, because both places `Home` builds a decision pass `clockMsRemaining: null`.
 *
 * WHY THE FIRST CONTROL IS NOT PROBABILISTIC. Reverting the purpose gives a defect that shows up
 * on three plies in four, and a control that fails three times in four is a flaky test rather than
 * a proof. The ply below is SEARCHED FOR: it is one the shipped draw actually passes over, so the
 * failure is deterministic and is the real defect rather than an unlucky roll.
 */
import { describe, expect, it } from "vitest";
import { ASK_RATE, confidenceIsAsked, drawForDecision } from "../../../shared/confidence-asked";
import { BUCKETINGS } from "../../../shared/detector";

const FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const GAME = "lichess-first";

/** A ply the shipped draw skips, so the control fails for the reason it names. */
const QUIET_PLY = (() => {
  for (let ply = 0; ply < 400; ply += 1) {
    if (drawForDecision(GAME, FEN, ply) >= ASK_RATE) return ply;
  }
  throw new Error("no ply in 400 was passed over; the draw or ASK_RATE changed");
})();

/**
 * THE DEFECT: the front door's position is an ordinary play decision.
 *
 * This is the purpose derivation exactly as it stood -- no `first`, so the handoff is invisible
 * and the draw decides whether the newcomer's one decision measures anything.
 */
function purposeWithoutTheFrontDoor(): "play" {
  return "play";
}

/** THE DEFECT: registrable means "one of the six", with no question about collecting it. */
function registrableByMembershipAlone(key: string): boolean {
  return BUCKETINGS.some((bucketing) => bucketing.key === key);
}

describe("GATE-REACHABILITY control: the front door hands over an ordinary decision", () => {
  it("must ask the newcomer for a confidence (this is expected to fail)", () => {
    expect(
      confidenceIsAsked({
        purpose: purposeWithoutTheFrontDoor(),
        gameId: GAME,
        fen: FEN,
        ply: QUIET_PLY,
      }),
      "the front door produced a decision carrying no confidence, so `scored` stayed at zero " +
        "and the shared bank stayed locked behind it",
    ).toBe(true);
  });
});

describe("GATE-REACHABILITY control: registrable means nothing but membership", () => {
  it("must refuse a bucket the live loop cannot fill (this is expected to fail)", () => {
    const uncollectible = BUCKETINGS.filter((bucketing) => bucketing.requiresClock);
    expect(uncollectible.length, "no clock-bearing bucket to test against").toBeGreaterThan(0);
    for (const bucketing of uncollectible) {
      expect(
        registrableByMembershipAlone(bucketing.key),
        `${bucketing.key} was registered, and every live decision carries clockMsRemaining: null, ` +
          "so the countdown to its 20 observations never finishes",
      ).toBe(false);
    }
  });
});
