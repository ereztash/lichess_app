/**
 * A game where the engine says nothing until it is over, and why that is a different measurement
 * rather than a preference about pacing.
 *
 * WHAT THE LOOP DOES TODAY. Commit, then see the engine's verdict, then the next decision. Over
 * one position that is the product: a decision, and then what it cost. Over a FORTY-MOVE GAME it
 * is something else -- by move twenty the player has been told twenty times how their last move
 * scored, and every decision after the first is made by somebody who has been coached, mid-game,
 * by a stronger engine. That is a fine way to learn and it is not a reading of how the player
 * decides on their own.
 *
 * SO THE TWO ARE NOT POOLABLE, and the record has to say which one produced each decision. This
 * is the `confidence_scale` lesson in a second place: a stored number whose meaning depends on a
 * setting nothing recorded is a number that cannot be read back. A calibration figure computed
 * across both modes at once is an average over two different tasks.
 *
 * WHAT MAY NOT BE CLAIMED. Nothing here says the deferred game measures the player "better", or
 * that feedback makes calibration worse, or anything at all about which mode produces a truer
 * number. The claim is only that they are different conditions, and that the record now carries
 * which was in force.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import {
  REVEAL_TIMINGS,
  effectiveTiming,
  mayShowVerdictNow,
  type RevealTiming,
} from "@shared/reveal-timing";
import { MemoryRecordStore } from "../../server/record";
import { commitDecision, type CommitEvent } from "@shared/record-service";

const OPEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let counter = 0;
const nextId = () => `22222222-2222-4222-8222-${String(++counter).padStart(12, "0")}`;

const event = (timing: RevealTiming | null, id = nextId()): CommitEvent => ({
  decision_id: id,
  entry_state: { game_id: "g", fen: OPEN, ply: 0, phase: "opening", clock_ms_remaining: null },
  known: "עמדת פתיחה",
  unknown: "מה השחור מתכנן",
  decision: "e2e4",
  bounded_action: {
    seconds_taken: 5,
    confidence: 4,
    confidence_scale: CONFIDENCE_LEVELS,
    candidate_moves_considered: ["e2e4"],
  },
  probe: null,
  reveal_timing: timing,
  /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
  measurement_protocol: null,
  protocol_version: null,
  analysis_timing: null,
  result: null,
  feedback: null,
});

describe("the rule about when the engine may speak", () => {
  it("lets the verdict show immediately in the coached loop", () => {
    expect(mayShowVerdictNow("per-decision")).toBe(true);
  });

  it("withholds it for the whole game in the deferred one", () => {
    /*
     * THE PROPERTY THE MODE EXISTS FOR. If this were ever true for `end-of-game`, a player would
     * be shown one verdict mid-game and every decision after it would have been made under the
     * other condition while the record still said `end-of-game` -- which is worse than not
     * having the mode, because the field would then be wrong rather than absent.
     */
    expect(mayShowVerdictNow("end-of-game")).toBe(false);
  });

  it("has exactly two timings, so a third cannot appear unrecorded", () => {
    // A third mode would need a column value, a migration and a decision about poolability.
    expect([...REVEAL_TIMINGS]).toEqual(["per-decision", "end-of-game"]);
  });
});

describe("the record says which game a decision came out of", () => {
  it("stores the timing that was in force", async () => {
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event("end-of-game", id));
    expect((await store.getAtom(id))?.reveal_timing).toBe("end-of-game");
  });

  it("keeps the two apart", async () => {
    const store = new MemoryRecordStore();
    const coached = nextId();
    const deferred = nextId();
    await commitDecision(store, event("per-decision", coached));
    await commitDecision(store, event("end-of-game", deferred));
    expect((await store.getAtom(coached))?.reveal_timing).toBe("per-decision");
    expect((await store.getAtom(deferred))?.reveal_timing).toBe("end-of-game");
  });

  it("reads a decision from before the mode existed as unknown, not as coached", async () => {
    /*
     * The same fourth state as the probe arm, for the same reason. Every decision written before
     * this field existed WAS made in the coached loop, because that was the only loop -- and
     * writing `per-decision` into those rows would still be wrong: it would assert that somebody
     * recorded a condition, and nobody did. The difference matters the first time the two modes
     * are compared, because a backfilled majority would make the coached arm look enormous and
     * perfectly measured.
     */
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(null, id));
    expect((await store.getAtom(id))?.reveal_timing).toBeNull();
  });
});

describe("the choice applies to a game, and a drill is not a game", () => {
  it("carries the player's choice through a live game", () => {
    expect(effectiveTiming("end-of-game", "game")).toBe("end-of-game");
    expect(effectiveTiming("per-decision", "game")).toBe("per-decision");
  });

  it("keeps a drill on per-decision whatever the player chose", () => {
    /*
     * A drill reports a verdict against a refutation condition registered before it ran (R5), and
     * that report IS the drill. "The end of the game" is not a moment that exists here -- there
     * is no game, only a set of positions -- so a deferred drill would be one that never reports.
     */
    expect(effectiveTiming("end-of-game", "drill")).toBe("per-decision");
  });

  it("keeps a transfer run on per-decision whatever the player chose", () => {
    // A transfer observation is frozen per position and the run advances on that verdict. A
    // deferred run would advance on nothing.
    expect(effectiveTiming("end-of-game", "transfer")).toBe("per-decision");
  });
});
