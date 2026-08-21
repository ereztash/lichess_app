import { describe, expect, it } from "vitest";
import { scoreDecisions, silenceReason } from "@shared/scoring";
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
  bounded_action: { seconds_taken: 30, confidence: 4, candidate_moves_considered: ["e2e4"] },
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
    const far = scoreDecisions([atom({ result: { ...atom().result!, cp_loss: 31 } })], ["a"]);
    expect(near.scored[0].accurate).toBe(true);
    expect(far.scored[0].accurate).toBe(false);
  });
});

describe("silence says WHICH kind of not-enough it is", () => {
  it("distinguishes too-few-revealed from too-few-recorded", () => {
    const waiting = scoreDecisions([atom(), atom({ result: null }), atom({ result: null })], [
      "a",
      "b",
      "c",
    ]);
    const reason = silenceReason(waiting, 60)!;
    expect(reason).toContain("ממתינות לחשיפה");

    const allRevealed = scoreDecisions([atom(), atom()], ["a", "b"]);
    expect(silenceReason(allRevealed, 60)!).not.toContain("ממתינות לחשיפה");
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
