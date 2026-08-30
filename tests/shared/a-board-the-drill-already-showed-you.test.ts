/**
 * A drill selects positions by RAW FEN STRING, while every path around it compares boards.
 *
 * `shared/position-key.ts` exists because a FEN's last two fields -- the halfmove clock and the
 * fullmove number -- are a record of the GAME, not of the POSITION. Its own doc comment says what
 * that costs a pre-registered test: "a rule that 'transferred' to a board they had already seen
 * and been told the answer for is measuring recall of that answer."
 *
 * That was written for the learning-transfer path, and the transfer path uses it -- twice when
 * choosing boards (`record-service.ts:526,601`) and again when reporting one (`:704,:818`).
 * `finishDrill` uses it too, matching each decision to a registered slot (`:1070`).
 *
 * `beginDrill` does not. `selectDrillPositions` builds `new Set(alreadyDecidedFens)` and asks
 * `decided.has(position.fen)` -- whole strings. So the one place in the drill path that decides
 * whether a position is FRESH is the one place that compares game history instead of boards.
 *
 * Two things follow, and neither needs a fault:
 *
 *   1. A board the player has already decided, and already seen the engine's verdict for, is
 *      admitted into the forward test whenever the counters differ. The drill then measures
 *      recall of an answer they were given.
 *   2. One board is registered TWICE inside a single drill, because the de-duplication in the
 *      same loop is also by whole string. The verdict's `n` counts it twice and its standard
 *      error treats the two as independent -- which is the defect cycle 42 fixed for transfers,
 *      still open here.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { selectDrillPositions } from "../../shared/drill-positions";
import { positionKey } from "../../shared/position-key";
import type { Claim } from "../../shared/claim";
import * as service from "../../shared/record-service";

/**
 * One board, two histories. Identical board, side to move, castling rights and en-passant square;
 * different halfmove clock and fullmove number -- the two fields `positionKey` drops.
 */
const BOARD = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -";
const AS_DECIDED = `${BOARD} 4 5`;
const AS_OFFERED = `${BOARD} 9 14`;

const OTHER = [
  "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
  "8/8/8/4k3/8/4K3/4P3/8 b - - 0 2",
  "8/8/4k3/8/8/4K3/4P3/8 w - - 0 3",
  "8/8/4k3/8/4P3/4K3/8/8 b - - 0 4",
  "8/8/4k3/4P3/8/4K3/8/8 w - - 0 5",
  "8/4k3/8/4P3/8/4K3/8/8 b - - 0 6",
  "8/4k3/4P3/8/8/4K3/8/8 w - - 0 7",
];

describe("selectDrillPositions compares boards, not game histories", () => {
  it("excludes a board the player already decided, whatever the move counters say", () => {
    const selection = selectDrillPositions(
      [AS_OFFERED, ...OTHER].map((fen, ply) => ({ fen, ply })),
      [AS_DECIDED],
    );
    expect(selection.reason).toBeNull();
    const keys = selection.fens.map(positionKey);
    expect(keys, "a decided board was offered back as a fresh drill position").not.toContain(
      positionKey(AS_DECIDED),
    );
  });

  it("registers one board once, even when a game reached it twice", () => {
    // A repetition: the same board, two plies apart, two different clocks.
    const selection = selectDrillPositions(
      [AS_DECIDED, AS_OFFERED, ...OTHER].map((fen, ply) => ({ fen, ply })),
      [],
    );
    const keys = selection.fens.map(positionKey);
    expect(new Set(keys).size, "one board occupies two slots of the same drill").toBe(keys.length);
  });

  it("still counts a genuinely different position as different", () => {
    // The guard against over-merging: `positionKey` keeps the en-passant square precisely because
    // dropping it would merge two boards that offer different legal moves.
    const noEp = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const withEp = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2";
    const selection = selectDrillPositions(
      [noEp, withEp, ...OTHER].map((fen, ply) => ({ fen, ply })),
      [],
    );
    expect(selection.fens).toContain(noEp);
    expect(selection.fens).toContain(withEp);
  });
});

describe("through the service, a drill is not built on a board already answered", () => {
  const CLAIM: Claim = {
    claim_id: "claim-board-identity",
    statement: "בהחלטות מהירות הביטחון שלך גבוה ממה שהתוצאות מצדיקות",
    scope: "החלטות תחת פחות מ-45 שניות",
    supporting_decision_ids: [],
    n: 30,
    grade: "hypothesis",
    refutation_condition: "אם הפער לא יהיה גדול יותר מאשר בשאר ההחלטות — ההשערה הופרכה.",
    predicts_overconfidence: true,
    graded_under: null,
    prospective_tests: [],
    created_at: "2026-01-01T00:00:00.000Z",
    last_evaluated_at: "2026-01-01T00:00:00.000Z",
  };

  it("does not offer back a position whose engine verdict the player has seen", async () => {
    const store = new MemoryRecordStore();
    await store.saveClaim(CLAIM);
    await store.commitDecision({
      decisionId: "already-decided",
      gameId: "g1",
      fen: AS_DECIDED,
      ply: 8,
      phase: "middlegame",
      clockMsRemaining: 120_000,
      purpose: "play",
      secondsTaken: 20,
      chosenMove: "e1g1",
      candidateMovesConsidered: ["e1g1"],
      statedRead: "המרכז סגור",
      statedUnknown: "לא ברור מה השחור מאיים",
      confidence: CONFIDENCE_LEVELS - 2,
      confidenceScale: CONFIDENCE_LEVELS,
      probeAssignment: "not-probed",
      legalMoves: 30,
      revealTiming: "per-decision",
      measurementProtocol: null,
      protocolVersion: null,
      analysisTiming: null,
    });
    // ...and they were told the answer.
    await store.recordReveal("already-decided", {
      engine_eval_cp: 15,
      engine_best_move: "e1g1",
      engine_depth: 18,
      engine_source: "local_sf18",
      cp_loss: 140,
    });

    const begun = await service.beginDrill(
      store,
      { claim_id: CLAIM.claim_id, candidate_fens: [AS_OFFERED, ...OTHER] },
      { drill_id: "drill-board-identity", started_at: "2026-03-01T09:00:00.000Z" },
    );
    expect(begun.drill, begun.reason ?? "no drill").not.toBeNull();
    const keys = begun.drill!.fens.map(positionKey);
    expect(
      keys,
      "the forward test includes a board the player was already given the verdict for",
    ).not.toContain(positionKey(AS_DECIDED));
  });
});
