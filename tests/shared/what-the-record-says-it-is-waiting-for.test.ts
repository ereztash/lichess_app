/**
 * A decision the engine has already answered is not waiting for the engine.
 *
 * WHAT WENT WRONG, AND IT WENT WRONG IN THREE PLACES AT ONCE. `RecordReading` carried one number,
 * `scored`, whose own doc comment called it "decisions that have been revealed". It is not that:
 * `scoreDecisions` also drops any revealed decision carrying no stated confidence, and since the
 * ask rule became a sample that is most of them. Three consumers spent the number on a sentence
 * about reveals anyway --
 *
 *   `RecordDashboard`   "עוד לא נחשפה אף החלטה" whenever `scored === 0`
 *   `loopPosition`      `Math.max(0, recorded - scored)` rendered as "ממתינות לחשיפה"
 *   `ContextRibbon`     the same subtraction again, for the returning-player line
 *
 * -- so a player whose decision had been committed, revealed, and whose engine verdict was on the
 * screen in front of them was told it had not been revealed and was still waiting. Walked in
 * Chromium from an empty profile; the ribbon still said it nine seconds after the reveal painted.
 *
 * THE DISTINCTION ALREADY EXISTED AT SOURCE. `ScoringSummary` returns `awaitingReveal` and
 * `withoutConfidence` separately, with a comment saying in as many words that one is a wait and
 * the other never will be. The reading dropped both and every consumer rebuilt the wrong one by
 * subtraction. This file holds the two counts to the wall between them.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { confidenceIsAsked } from "../../shared/confidence-asked";
import { classifyPhase } from "../../shared/phase";
import { loopPosition } from "../../client/src/lib/loop-position";

/**
 * A game, a position and a ply the draw passes over, pinned as constants.
 *
 * `drawForDecision` is a pure function of the three, so a fixture that happened to land on the
 * asked side of the line would make every assertion below vacuous -- the decisions would carry a
 * confidence and the state under test would never occur. The first assertion holds the pin.
 */
const PASSED_OVER_GAME = "live-1787903252462";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PASSED_OVER_PLY = 0;

/** A middlegame position the draw asks on, for the contrast case. */
const ASKED_GAME = "live-asked";
const MIDDLEGAME = "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12";
const ASKED_PLY = 3;

let seq = 0;
const nextId = () => `22222222-2222-4222-8222-${String(++seq).padStart(12, "0")}`;

async function record(
  store: MemoryRecordStore,
  options: { gameId: string; fen: string; ply: number; confidence: number | null; reveal: boolean },
) {
  const id = nextId();
  await service.commitDecision(store, {
    decision_id: id,
    entry_state: {
      game_id: options.gameId,
      fen: options.fen,
      ply: options.ply,
      phase: classifyPhase(options.fen, options.ply),
      clock_ms_remaining: null,
    },
    purpose: "play",
    known: options.confidence === null ? "" : "המרכז פתוח",
    unknown: options.confidence === null ? "" : "לא יודע איך הוא יענה",
    known_parts: null,
    unknown_parts: null,
    decision: "e2e4",
    bounded_action: {
      seconds_taken: 12,
      confidence: options.confidence,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: ["e2e4"],
    },
    probe: null,
    reveal_timing: "per-decision",
    /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    result: null,
    feedback: null,
  });
  if (options.reveal) {
    await service.reveal(store, id, {
      engine_eval_cp: 33,
      engine_best_move: "e2e4",
      engine_depth: 14,
      engine_source: "local_sf18",
      cp_loss: 0,
    });
  }
  return id;
}

describe("the record separates a wait from a decision nothing will ever score", () => {
  it("pins the draw, so the state under test is the one that actually occurs", () => {
    expect(
      confidenceIsAsked({
        purpose: "play",
        gameId: PASSED_OVER_GAME,
        fen: START,
        ply: PASSED_OVER_PLY,
      }),
      "the fixture position is asked, so nothing below exercises the passed-over branch",
    ).toBe(false);
    expect(
      confidenceIsAsked({ purpose: "play", gameId: ASKED_GAME, fen: MIDDLEGAME, ply: ASKED_PLY }),
      "the contrast position is also passed over; the pair proves nothing",
    ).toBe(true);
  });

  it("counts a revealed decision with no stated confidence as exactly that", async () => {
    const store = new MemoryRecordStore();
    await record(store, {
      gameId: PASSED_OVER_GAME,
      fen: START,
      ply: PASSED_OVER_PLY,
      confidence: null,
      reveal: true,
    });
    const reading = await service.recordReading(store);
    expect(reading.scored, "a decision with no confidence entered the calibration").toBe(0);
    expect(reading.awaitingReveal, "a revealed decision was reported as awaiting reveal").toBe(0);
    expect(reading.withoutConfidence).toBe(1);
  });

  it("still calls an unrevealed decision a wait, so this is not a blanket rename", async () => {
    const store = new MemoryRecordStore();
    await record(store, {
      gameId: ASKED_GAME,
      fen: MIDDLEGAME,
      ply: ASKED_PLY,
      confidence: 5,
      reveal: false,
    });
    const reading = await service.recordReading(store);
    expect(reading.awaitingReveal).toBe(1);
    expect(reading.withoutConfidence).toBe(0);
  });

  it("keeps the two apart in one record that holds both", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 3; i++) {
      await record(store, {
        gameId: PASSED_OVER_GAME,
        fen: START,
        ply: PASSED_OVER_PLY,
        confidence: null,
        reveal: true,
      });
    }
    await record(store, {
      gameId: ASKED_GAME,
      fen: MIDDLEGAME,
      ply: ASKED_PLY,
      confidence: 5,
      reveal: false,
    });
    const reading = await service.recordReading(store);
    expect(reading.awaitingReveal).toBe(1);
    expect(reading.withoutConfidence).toBe(3);
    /*
     * AND THIS IS WHAT THE SUBTRACTION USED TO PRODUCE. Four recorded, none scored: the old
     * `recorded - scored` reported all four as waiting for the engine, when three of them had
     * been answered and one had not.
     */
    expect(reading.awaitingReveal + reading.withoutConfidence).toBe(4);
    expect(reading.awaitingReveal, "the old arithmetic is back").not.toBe(4);
  });
});

describe("the sentence the player reads carries the same distinction", () => {
  const strip = (over: Partial<Parameters<typeof loopPosition>[0]> = {}) =>
    loopPosition({
      drill: null,
      recorded: 4,
      scored: 0,
      awaitingReveal: 0,
      withoutConfidence: 4,
      readElsewhere: 0,
      claimGrade: null,
      scoredStillNeeded: 60,
      narrowedTo: null,
      ...over,
    }).headline;

  it("does not tell a player to wait for an engine that has already answered", () => {
    expect(strip()).not.toContain("ממתינות לחשיפה");
  });

  it("says why those decisions do not count, which is a fact about the protocol", () => {
    expect(strip()).toContain("לא נשאלה שאלת הביטחון");
  });

  it("still announces a real wait", () => {
    expect(strip({ awaitingReveal: 2, withoutConfidence: 0 })).toContain(
      "2 כבר רשומות וממתינות לחשיפה",
    );
  });
});
