/**
 * `reveal` writes twice, and the gate that protects the record is what freezes the loss.
 *
 * Third instance of the shape cycles 31 and 36 closed, and this one was found by a sweep rather
 * than by accident. `reveal` stores the engine's verdict on the chosen move, then the price of the
 * alternative the player named -- two writes, no transaction:
 *
 *     await store.recordReveal(decisionId, result);        // WRITE 1
 *     if (alternativeCpLoss != null) await store.scoreCounterfactual(...)   // WRITE 2
 *
 * The function's own docstring states the invariant it breaks: "A second round trip would let one
 * land without the other, and a record holding a chosen-move score and no alternative score is one
 * where the reading silently does not exist." It IS that second round trip, inside itself.
 *
 * And it cannot be retried. The retry re-enters at `hasReveal`, which is now true, and throws
 * CONFLICT before it can reach the second write. `scoreCounterfactual` has exactly one caller in
 * the product -- that line -- so no other path can ever write the price.
 *
 * WHAT THE PLAYER SEES IS NOTHING, WHICH IS THE WORST PART. `readCounterfactuals` drops an unpriced
 * pair ("Null is not a fifth reading"), so the decision counts in `asked` and `answered` and in
 * none of the four readings: a row of the probe's treatment arm leaves the denominator with no
 * trace and no way back, and the experiment quietly shrinks.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { readCounterfactuals } from "../../shared/counterfactual-reading";
import type { DecisionResult } from "../../shared/decision-atom";
import * as service from "../../shared/record-service";

const ID = "11111111-1111-4111-8111-111111111111";
const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 13";
const RESULT: DecisionResult = {
  engine_eval_cp: 20,
  engine_best_move: "g1f3",
  engine_depth: 18,
  engine_source: "local_sf18",
  engine_build: "sf18-test-build",
  cp_loss: 15,
};

/** A store whose second write can be made to fail exactly once, after the first has landed. */
class LosesThePrice extends MemoryRecordStore {
  crashNextScore = false;
  override async scoreCounterfactual(decisionId: string, cpLoss: number) {
    if (this.crashNextScore) {
      this.crashNextScore = false;
      throw new Error("connection reset by peer");
    }
    return super.scoreCounterfactual(decisionId, cpLoss);
  }
}

async function probedDecision(store: MemoryRecordStore) {
  await store.commitDecision({
    decisionId: ID,
    gameId: "g",
    fen: FEN,
    ply: 24,
    phase: "middlegame",
    clockMsRemaining: 120_000,
    purpose: "play",
    drillId: null,
    transferId: null,
    secondsTaken: 30,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4", "d2d4"],
    statedRead: "המרכז פתוח",
    statedUnknown: "לא ברור מה השחור מאיים",
    confidence: 5,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "probed",
    legalMoves: 30,
    revealTiming: "per-decision",
    measurementProtocol: null,
    protocolVersion: null,
    analysisTiming: null,
  });
  // The question is put and answered BEFORE the reveal -- that window is what R3 defines.
  await service.recordCounterfactual(store, ID, "g1f3");
}

async function halfWritten() {
  const store = new LosesThePrice();
  await probedDecision(store);
  store.crashNextScore = true;
  const crash = await service
    .reveal(store, ID, RESULT, 120)
    .catch((error: unknown) => error as Error);
  return { store, crash };
}

describe("a price that can never be written", () => {
  it("stores the engine's verdict and loses the alternative's price when the second write fails", async () => {
    const { store, crash } = await halfWritten();

    expect((crash as Error).message).toBe("connection reset by peer");
    const atom = await store.getAtom(ID);
    // The engine's verdict on the chosen move IS stored. This is the half-written record.
    expect(atom?.result?.cp_loss).toBe(15);
    expect(atom?.probe?.answered).toBe(true);
    expect(atom?.probe?.alternative).toBe("g1f3");
    expect(atom?.probe?.alternative_cp_loss, "the price survived a failed write").toBeNull();

    // And the reading loses the row without saying so: asked and answered, scored zero.
    const reading = readCounterfactuals(await store.listAtoms());
    expect(reading.asked).toBe(1);
    expect(reading.answered).toBe(1);
    expect(reading.scored, "an unpriced pair counted as a reading").toBe(0);
  });

  it("finishes the write the retry exists to finish, instead of refusing it", async () => {
    const { store } = await halfWritten();

    // The retry the client makes after a failed reveal. Today this throws CONFLICT.
    const atom = await service.reveal(store, ID, RESULT, 120);

    expect(atom.probe?.alternative_cp_loss).toBe(120);
    expect(atom.result?.cp_loss, "the stored verdict was rewritten").toBe(15);
    const reading = readCounterfactuals(await store.listAtoms());
    expect(reading.scored, "the row is still outside the denominator").toBe(1);
  });

  it("still refuses a second reveal once the record is whole, because it is append-only", async () => {
    /*
     * The half of the gate that must survive the repair. Completing a NULL is not overwriting a
     * value; a second reveal of a decision that has both is, and it stays CONFLICT.
     */
    const store = new MemoryRecordStore();
    await probedDecision(store);
    await service.reveal(store, ID, RESULT, 120);

    await expect(service.reveal(store, ID, { ...RESULT, cp_loss: 400 }, 9)).rejects.toThrow(
      /append-only/,
    );
    const atom = await store.getAtom(ID);
    expect(atom?.result?.cp_loss).toBe(15);
    expect(atom?.probe?.alternative_cp_loss).toBe(120);
  });
});
