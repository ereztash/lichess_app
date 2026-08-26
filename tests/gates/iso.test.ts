import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { describe, expect, it } from "vitest";
import { ATOM_FIELDS, atomFieldNames, decisionAtomSchema } from "../../shared/decision-atom";
import { commitEventSchema } from "../../server/recordRouter";
import { MemoryRecordStore } from "../../server/record";

/** Layer 3 of the isomorphism: the assembled session report. */
async function reportFields(): Promise<string[]> {
  const store = new MemoryRecordStore();
  const decisionId = "11111111-1111-4111-8111-111111111111";
  await store.commitDecision({
    decisionId,
    gameId: "g1",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    ply: 0,
    phase: "opening",
    clockMsRemaining: null,
    secondsTaken: 9,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4", "d2d4"],
    statedRead: "needs central space",
    statedUnknown: "cannot judge the resulting pawn structure",
    confidence: 3,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 20,
    revealTiming: "per-decision",
  });
  const atom = await store.getAtom(decisionId);
  return Object.keys(atom!);
}

describe("GATE-ISO: the atom survives all three layers", () => {
  it("screen state (the shared schema) carries every atom field", () => {
    expect(atomFieldNames(decisionAtomSchema)).toEqual([...ATOM_FIELDS]);
  });

  it("the API event carries every atom field", () => {
    const eventFields = atomFieldNames(commitEventSchema).filter((f) => f !== "decision_id");
    expect(eventFields).toEqual([...ATOM_FIELDS]);
  });

  it("the assembled report carries every atom field", async () => {
    expect(await reportFields()).toEqual([...ATOM_FIELDS]);
  });
});
