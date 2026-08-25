import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { describe, expect, it } from "vitest";
import { scoreDecisions, silenceReason } from "@shared/scoring";
import { loopPosition } from "@/lib/loop-position";
import type { DecisionAtom } from "@shared/decision-atom";

const atom = (over: Partial<DecisionAtom> = {}): DecisionAtom => ({
  entry_state: {
    game_id: "g",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    ply: 0,
    phase: "opening",
    clock_ms_remaining: 90_000,
  },
  known: "k",
  unknown: "u",
  decision: "e2e4",
  bounded_action: { seconds_taken: 30, confidence: 4, confidence_scale: CONFIDENCE_LEVELS, candidate_moves_considered: ["e2e4"] },
  result: {
    engine_eval_cp: 20,
    engine_best_move: "e2e4",
    engine_depth: 18,
    engine_source: "local_sf18",
    cp_loss: 10,
  },
  feedback: null,
  ...over,
});

describe("only revealed decisions can be scored", () => {
  it("excludes unrevealed decisions and counts them separately", () => {
    const summary = scoreDecisions([atom(), atom({ result: null }), atom()], ["a", "b", "c"]);
    expect(summary.scored).toHaveLength(2);
    expect(summary.awaitingReveal).toBe(1);
    expect(summary.total).toBe(3);
  });

  it("keeps each scored row attached to its own decision id", () => {
    const summary = scoreDecisions([atom(), atom({ result: null }), atom()], ["a", "b", "c"]);
    // "b" was not revealed, so it must not appear.
    expect(summary.scored.map((d) => d.decision_id)).toEqual(["a", "c"]);
  });

  it("treats a loss inside engine noise as accurate, and beyond it as not", () => {
    const near = scoreDecisions([atom({ result: { ...atom().result!, cp_loss: 30 } })], ["a"]);
    const far = scoreDecisions([atom({ result: { ...atom().result!, cp_loss: 400 } })], ["a"]);
    expect(near.scored[0].accurate).toBe(true);
    expect(far.scored[0].accurate).toBe(false);
  });

  it("judges what the move COST, not how many centipawns it shed", () => {
    /*
     * A POSITIVE CONTROL SURVIVED WITHOUT THIS. Reverting the scoring path to the raw centipawn
     * threshold left every test in this file green, because they were all written at a roughly
     * level position -- and the two rules agree there by construction. Nothing asserted that the
     * new rule was the one being used.
     *
     * This is the case they differ on, and it is the case the change exists for. A hundred and
     * fifty centipawns in a game already won costs under half a point of winning chances; the
     * same hundred and fifty at level costs more than eight. The old rule called both a mistake,
     * which is how "accurate" came to mean something different depending on how the game stood.
     */
    const decided = scoreDecisions(
      [atom({ result: { ...atom().result!, engine_eval_cp: 1000, cp_loss: 150 } })],
      ["a"],
    );
    const level = scoreDecisions(
      [atom({ result: { ...atom().result!, engine_eval_cp: 0, cp_loss: 150 } })],
      ["a"],
    );
    expect(decided.scored[0].accurate, "a slip in a won game was charged as a mistake").toBe(true);
    expect(level.scored[0].accurate, "the same slip at level was forgiven").toBe(false);
  });
});

describe("silence says WHICH kind of not-enough it is", () => {
  /*
   * THIS CONTRACT MOVED SURFACES; IT DID NOT GO AWAY.
   *
   * It used to be asserted on `silenceReason`, which said "נרשמו N החלטות, מתוכן M נחשפו... ו-K
   * ממתינות לחשיפה" -- and that was the second copy of a sentence the context ribbon renders at
   * the top of the page from `loopPosition()`. The counts stayed where they are read and the
   * panel's line became the rule behind the floor, so the 4.5 requirement -- that too-few-recorded
   * and too-few-revealed must not render alike -- is now the ribbon's to keep. Asserting it there
   * is the same contract against the surface that now owns it.
   */
  const position = (recorded: number, scored: number) =>
    loopPosition({
      drill: null,
      recorded,
      scored,
      claimGrade: null,
      scoredStillNeeded: 60 - scored,
      narrowedTo: null,
    });

  it("distinguishes too-few-revealed from too-few-recorded, on the surface that carries the counts", () => {
    expect(position(3, 1).headline).toContain("ממתינות לחשיפה");
    expect(position(2, 2).headline).not.toContain("ממתינות לחשיפה");
  });

  it("does not say it a second time in the panel", () => {
    /*
     * The whole point of the split. Two surfaces disagreeing would be a bug; two surfaces
     * agreeing at length is a dashboard, which is the thing this product exists not to be.
     */
    const waiting = scoreDecisions([atom(), atom({ result: null }), atom({ result: null })], [
      "a",
      "b",
      "c",
    ]);
    expect(silenceReason(waiting, 60)!).not.toContain("ממתינות לחשיפה");
  });

  it("stops varying with the record, because the record's numbers are elsewhere", () => {
    /*
     * The strongest form of "it no longer carries the counts", and the one that cannot be
     * satisfied by rewording: two records that differ in every count must produce the SAME
     * string. A single count left in would break this, whatever it was phrased like.
     */
    const few = scoreDecisions([atom()], ["a"]);
    const many = scoreDecisions(
      [...Array.from({ length: 20 }, () => atom()), atom({ result: null })],
      Array.from({ length: 21 }, (_, i) => `d${i}`),
    );
    expect(few.scored.length).not.toBe(many.scored.length);
    expect(few.awaitingReveal).not.toBe(many.awaitingReveal);
    expect(silenceReason(few, 60)).toBe(silenceReason(many, 60));
  });

  it("still says the one number the ribbon does not: the floor, and why it is doubled", () => {
    // A bucket needs decisions inside it AND outside it, so the floor is twice the per-side
    // minimum. Nothing else on the screen says that, which is why this line still earns its space.
    const reason = silenceReason(scoreDecisions([atom()], ["a"]), 60)!;
    expect(reason).toContain("30");
    expect(reason).toContain("60");
  });

  it("never promises a finding, only a hypothesis", () => {
    const reason = silenceReason(scoreDecisions([atom()], ["a"]), 60)!;
    expect(reason).toContain("השערה");
  });

  it("falls silent about silence once there is enough", () => {
    const enough = scoreDecisions(
      Array.from({ length: 60 }, () => atom()),
      Array.from({ length: 60 }, (_, i) => `d${i}`),
    );
    expect(silenceReason(enough, 60)).toBeNull();
  });
});
