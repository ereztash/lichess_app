import { describe, expect, it } from "vitest";
import {
  buildCommitEvent,
  centipawnLoss,
  cpLossFromSearches,
  draftProblems,
  emptyDraft,
  engineMayRun,
  isCommittable,
  namedTest,
  type DraftDecision,
  type PositionUnderDecision,
  type SessionStage,
} from "@/lib/decision-session";
import { ATOM_FIELDS } from "@shared/decision-atom";
import type { EngineLine } from "@/lib/engine-line";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";

const POSITION: PositionUnderDecision = {
  gameId: "game-1",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  ply: 7,
  clockMsRemaining: 143_000,
  // Anchor: the purpose where the confidence question IS put. The `play` case has its own file.
  purpose: "anchor",
};

const complete = (): DraftDecision => ({
  chosenMove: "g8f6",
  knownTags: ["המרכז פתוח"],
  known: "והפיתוח שלי מפגר",
  unknownTags: [],
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
    const problems = draftProblems(emptyDraft(), POSITION);
    expect(problems.map((p) => p.field).sort()).toEqual([
      "chosenMove",
      "confidence",
      "known",
      "unknown",
    ]);
  });

  it("requires `unknown` explicitly -- blank is not an answer", () => {
    const draft = { ...complete(), unknown: "   ", unknownTags: [] };
    expect(isCommittable(draft, POSITION)).toBe(false);
    expect(draftProblems(draft, POSITION)[0].field).toBe("unknown");
  });

  /*
   * The read is stated by tapping now, because two mandatory free-text fields is roughly forty
   * written sentences a game and that is why a game did not get finished. These four pin the
   * part that did NOT change: something must still be stated, in each field, before the engine
   * is allowed to speak. One tap is enough; nothing is enough for nothing.
   */
  it("accepts a selection with nothing typed", () => {
    const draft = { ...complete(), known: "", unknown: "", unknownTags: ["לא יודע איך הוא יענה"] };
    expect(isCommittable(draft, POSITION)).toBe(true);
  });

  it("accepts typing with nothing selected", () => {
    const draft = { ...complete(), knownTags: [], unknownTags: [], known: "מרכז", unknown: "לא" };
    expect(isCommittable(draft, POSITION)).toBe(true);
  });

  it("still refuses a field that is neither tapped nor typed", () => {
    const draft = { ...complete(), knownTags: [], known: "" };
    expect(isCommittable(draft, POSITION)).toBe(false);
    expect(draftProblems(draft, POSITION)[0].field).toBe("known");
  });

  it("puts both the tapped and the typed part on the record", () => {
    const draft = {
      ...complete(),
      knownTags: ["המרכז פתוח", "מלך חשוף"],
      known: "וגם יש לי טור פתוח",
    };
    const event = buildCommitEvent("d-2", POSITION, draft, 9, "per-decision");
    // A player who taps two options and adds a sentence stated all three things.
    expect(event.known).toBe("המרכז פתוח · מלך חשוף · וגם יש לי טור פתוח");
  });

  it("keeps a long selection inside the atom's 200-character bound", () => {
    // The schema enforces max 200. Truncating here rather than letting the write fail keeps a
    // long read from becoming a rejection the player cannot act on.
    const draft = { ...complete(), knownTags: Array.from({ length: 40 }, () => "המרכז פתוח") };
    const event = buildCommitEvent("d-3", POSITION, draft, 9, "per-decision");
    expect(event.known.length).toBeLessThanOrEqual(200);
  });

  it("refuses to build an event from an incomplete draft", () => {
    expect(() => buildCommitEvent("id", POSITION, emptyDraft(), 5, "per-decision")).toThrow(/not committable/);
  });

  it("accepts a complete draft", () => {
    expect(isCommittable(complete(), POSITION)).toBe(true);
  });
});

describe("the commit event is the atom, unchanged", () => {
  const event = buildCommitEvent("d-1", POSITION, complete(), 12.4, "per-decision");

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

describe("cp loss across two searches handles the perspective flip", () => {
  /*
   * These pass EngineLines rather than bare numbers, and that is the point of the signature: a
   * `scoreCp` on a mate line is the mate DISTANCE times ten thousand, and a function taking two
   * numbers could not tell one from a centipawn score. `pv` is non-empty because `hasEvaluation`
   * reads it -- an empty one is the sentinel for "the engine said nothing".
   */
  const cp = (scoreCp: number): EngineLine => ({ scoreCp, depth: 14, pv: ["e2e4"], fen: FEN });

  it("is zero when the player played the engine's own move", () => {
    // Player to move: +40. After their (best) move the opponent is to move and sees -40.
    expect(cpLossFromSearches(cp(40), cp(-40))).toBe(0);
  });

  it("measures the drop when the player's move was worse", () => {
    // Player to move: +40. After their move the opponent is to move and sees +60,
    // i.e. -60 for the player. Loss = 40 - (-60) = 100.
    expect(cpLossFromSearches(cp(40), cp(60))).toBe(100);
  });

  it("works through a losing position without changing sign", () => {
    // Player is already worse: -150. After their move the opponent sees +400 => -400 for them.
    expect(cpLossFromSearches(cp(-150), cp(400))).toBe(250);
  });

  it("never reports a negative loss", () => {
    expect(cpLossFromSearches(cp(40), cp(-300))).toBe(0);
  });
});

describe("which named test a decision belongs to", () => {
  /*
   * THE PAIR THAT MUST NOT BE REPRESENTABLE. `commitDecision` refuses a decision carrying both a
   * drill id and a transfer id -- one decision is inside one test, and `EVIDENCE_POLICY` scopes
   * each to its own, so a decision claiming both would leave a later reading to choose silently.
   *
   * Refusing it at the boundary is necessary and not sufficient: the screen still has to be unable
   * to produce it. Both ids come off the ONE purpose here, so a transfer check taken while a drill
   * is open cannot send the drill's id -- not because a second check catches it, but because the
   * value is never constructed. That is the difference between an invariant and a guard.
   */
  const OPEN = { drillId: "drill-7", transferId: "transfer-9" };

  it("names the drill on a drill decision and nothing else", () => {
    expect(namedTest("drill", OPEN)).toEqual({ drillId: "drill-7", transferId: null });
  });

  it("names the transfer on a transfer decision and nothing else", () => {
    expect(namedTest("transfer", OPEN)).toEqual({ drillId: null, transferId: "transfer-9" });
  });

  it("never returns both, whatever is open", () => {
    for (const purpose of ["play", "first", "anchor", "import", "drill", "transfer"] as const) {
      const named = namedTest(purpose, OPEN);
      expect(
        named.drillId === null || named.transferId === null,
        `${purpose} sent a drill id and a transfer id, which the boundary refuses`,
      ).toBe(true);
    }
  });

  it("names nothing on the purposes that claim nothing", () => {
    for (const purpose of ["play", "first", "anchor", "import"] as const) {
      expect(namedTest(purpose, OPEN)).toEqual({ drillId: null, transferId: null });
    }
  });

  it("returns null rather than undefined when nothing is open", () => {
    /* The wire distinguishes "not a drill" from "a drill that named nothing"; both are null here. */
    expect(namedTest("drill", {})).toEqual({ drillId: null, transferId: null });
    expect(namedTest("transfer", {})).toEqual({ drillId: null, transferId: null });
  });
});
