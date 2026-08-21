import { describe, expect, it } from "vitest";
import {
  buildCommitEvent,
  centipawnLoss,
  draftProblems,
  emptyDraft,
  engineMayRun,
  isCommittable,
  type DraftDecision,
  type PositionUnderDecision,
  type SessionStage,
} from "@/lib/decision-session";
import { ATOM_FIELDS } from "@shared/decision-atom";

const POSITION: PositionUnderDecision = {
  gameId: "game-1",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  ply: 7,
  clockMsRemaining: 143_000,
};

const complete = (): DraftDecision => ({
  chosenMove: "g8f6",
  known: "המרכז פתוח והפיתוח שלי מפגר",
  unknown: "לא יודע אם d5 עובד מיד",
  confidence: 3,
  candidatesConsidered: ["g8f6", "f8e7"],
});

describe("R3: the engine may not run before the decision is recorded", () => {
  const stages: SessionStage[] = ["deciding", "committing", "committed", "revealed", "blocked"];

  it("permits the engine in exactly one stage", () => {
    expect(stages.filter(engineMayRun)).toEqual(["revealed"]);
  });

  it("does not permit the engine while the write is still in flight", () => {
    // A write in flight is not a completed write.
    expect(engineMayRun("committing")).toBe(false);
    expect(engineMayRun("committed")).toBe(false);
  });
});

describe("an incomplete decision is not recordable", () => {
  it("names every missing part rather than returning a bare boolean", () => {
    const problems = draftProblems(emptyDraft());
    expect(problems.map((p) => p.field).sort()).toEqual([
      "chosenMove",
      "confidence",
      "known",
      "unknown",
    ]);
  });

  it("requires `unknown` explicitly -- blank is not an answer", () => {
    const draft = { ...complete(), unknown: "   " };
    expect(isCommittable(draft)).toBe(false);
    expect(draftProblems(draft)[0].field).toBe("unknown");
  });

  it("refuses to build an event from an incomplete draft", () => {
    expect(() => buildCommitEvent("id", POSITION, emptyDraft(), 5)).toThrow(/not committable/);
  });

  it("accepts a complete draft", () => {
    expect(isCommittable(complete())).toBe(true);
  });
});

describe("the commit event is the atom, unchanged", () => {
  const event = buildCommitEvent("d-1", POSITION, complete(), 12.4);

  it("carries every atom field under the atom's own names", () => {
    const fields = Object.keys(event).filter((k) => k !== "decision_id");
    expect(fields).toEqual([...ATOM_FIELDS]);
  });

  it("carries result and feedback as present-and-null, not absent", () => {
    expect(event).toHaveProperty("result", null);
    expect(event).toHaveProperty("feedback", null);
  });

  it("derives the phase from the position rather than accepting one", () => {
    expect(event.entry_state.phase).toBe("opening");
  });

  it("records time-to-decide as a predictor, not a rounded afterthought", () => {
    expect(event.bounded_action.seconds_taken).toBeCloseTo(12.4);
  });

  it("always includes the chosen move among the candidates considered", () => {
    expect(event.bounded_action.candidate_moves_considered).toContain("g8f6");
  });

  it("does not duplicate the chosen move when it was already a candidate", () => {
    const moves = event.bounded_action.candidate_moves_considered;
    expect(new Set(moves).size).toBe(moves.length);
  });
});

describe("centipawn loss", () => {
  it("is the gap between the best line and the chosen one", () => {
    expect(centipawnLoss(40, -60)).toBe(100);
  });

  it("is never negative -- beating the engine at this depth means the depth was short", () => {
    expect(centipawnLoss(-20, 35)).toBe(0);
  });
});
