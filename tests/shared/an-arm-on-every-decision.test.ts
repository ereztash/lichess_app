/**
 * A control group only exists if the decisions that were NOT asked are written down too.
 *
 * THE FAILURE THIS FILE EXISTS TO PREVENT, and it is the most ordinary way an experiment inside a
 * product turns into a feature that produces numbers. The obvious implementation records a row
 * when the player is asked what they would have played instead. That record then contains only
 * probed decisions -- so "do probed decisions differ from unprobed ones?" has no denominator, and
 * the only thing measurable is a comparison of probed decisions against the record's own average,
 * which mixes every other difference between the two groups into the estimate.
 *
 * So the arm rides on EVERY decision, assigned before the player is seen, and it has three values
 * rather than two. `ineligible` is not a synonym for the control arm: a position with one legal
 * move could never have carried the question, and folding those into "not-probed" would make the
 * control group a mixture of "eligible and not drawn" and "never askable" -- at which point a
 * difference between arms is a difference between kinds of position.
 *
 * AND A FOURTH STATE, WHICH IS NOT AN ARM. A decision written before this experiment existed
 * carries no assignment at all. It is stored as absent and stays absent: assigning it to any arm
 * retrospectively would put rows in a group they were never randomised into. R2 in the place R2
 * usually is not -- an unmeasured thing must not render as a measured one.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { MemoryRecordStore } from "../../server/record";
import { RecordError, commitDecision, type CommitEvent } from "@shared/record-service";

/** A quiet opening position: many legal moves, so the question could be asked here. */
const OPEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** Black in check with exactly one legal reply. The question has no answer here. */
const MATED = "7k/7Q/8/8/8/8/8/K7 b - - 0 1";

let counter = 0;
const nextId = () => `11111111-1111-4111-8111-${String(++counter).padStart(12, "0")}`;

function event(probe: CommitEvent["probe"], id = nextId()): CommitEvent {
  return {
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
    probe,
    reveal_timing: null,
    /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    result: null,
    feedback: null,
  };
}

const armed = (assignment: "probed" | "not-probed" | "ineligible") => ({
  assignment,
  legal_moves: 20,
  alternative: null,
  answered: false,
  alternative_cp_loss: null,
});

describe("the arm is on the decision, not on the answer", () => {
  it("keeps an unprobed decision in the record, with its arm", async () => {
    /*
     * THE ONE THAT MAKES THE COMPARISON POSSIBLE. Nothing was asked here and nothing was answered,
     * and the row still has to say which arm it was in -- otherwise the control group is the empty
     * set and every "probed decisions are different" reading is a comparison with nothing.
     */
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(armed("not-probed"), id));
    const atom = await store.getAtom(id);
    expect(atom?.probe?.assignment).toBe("not-probed");
  });

  it("keeps the legal-move count as a covariate on every arm", async () => {
    // A position with three legal moves is a thinner question than one with forty. The count is
    // carried so an analysis can condition on it, instead of the instrument having filtered.
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(armed("probed"), id));
    expect((await store.getAtom(id))?.probe?.legal_moves).toBe(20);
  });

  it("does not fold an unaskable position into the control arm", async () => {
    /*
     * The fixture has to be a REALLY unaskable position, and the first version of this was not:
     * it marked the opening position `ineligible`, and the service refused it -- correctly, since
     * a position with twenty legal moves marked unaskable would drop a row out of the experiment
     * for no reason. The guard caught the test.
     */
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, {
      ...event(null, id),
      entry_state: {
        game_id: "g",
        fen: MATED,
        ply: 40,
        phase: "endgame",
        clock_ms_remaining: null,
      },
      decision: "h8h7",
      probe: { ...armed("ineligible"), legal_moves: 1 },
      reveal_timing: null,
      /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
      measurement_protocol: null,
      protocol_version: null,
      analysis_timing: null,
    });
    expect((await store.getAtom(id))?.probe?.assignment).toBe("ineligible");
  });
});

describe("a decision from before the experiment is not retrospectively enrolled", () => {
  it("accepts a decision with no arm at all", async () => {
    /*
     * DELIBERATELY UNLIKE `confidence_scale`, WHICH IS REFUSED WHEN ABSENT, and the difference is
     * the point rather than an inconsistency. A confidence with no scale CORRUPTS an existing
     * measurement -- a stored `4` reads as 0.75 or 0.50 depending on nothing the row contains --
     * so it has to fail at the boundary. A decision with no arm corrupts nothing: it is simply not
     * in the experiment. Refusing it would throw away a perfectly good calibration decision to
     * protect an experiment it was never part of.
     */
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(null, id));
    const atom = await store.getAtom(id);
    expect(atom).not.toBeNull();
    expect(atom?.probe).toBeNull();
  });

  it("never reads an absent arm as a control", async () => {
    // The whole reason the fourth state exists. `null` is not `"not-probed"`.
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(null, id));
    expect((await store.getAtom(id))?.probe?.assignment).toBeUndefined();
  });
});

describe("the answer is a later event, and it may not arrive early or late", () => {
  const commitProbed = async (store: MemoryRecordStore) => {
    const id = nextId();
    await commitDecision(store, event(armed("probed"), id));
    return id;
  };

  it("refuses an answer to a decision that was never committed", async () => {
    // Same rule as reveal: nothing may be recorded against a decision that does not exist.
    const store = new MemoryRecordStore();
    await expect(store.recordCounterfactual(nextId(), "d2d4")).rejects.toThrow();
  });

  it("refuses an answer on a decision that was never asked", async () => {
    /*
     * An answer arriving on an unprobed decision means the client asked anyway. Storing it would
     * move a row from the control arm into the probed one AFTER the position was seen -- which is
     * the one thing the randomisation exists to prevent.
     */
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(armed("not-probed"), id));
    await expect(store.recordCounterfactual(id, "d2d4")).rejects.toThrow();
  });

  it("refuses an answer after the engine has spoken", async () => {
    /*
     * R3 IN THE DIRECTION IT IS USUALLY NOT WRITTEN. The rule normally stops the engine speaking
     * before a commitment. Here it stops a PLAYER'S answer arriving after the engine has: an
     * alternative named once the evaluation is on screen is not a self-generated candidate, it is
     * a reading of the engine's, and the two are indistinguishable in storage.
     */
    const store = new MemoryRecordStore();
    const id = await commitProbed(store);
    await store.recordReveal(id, {
      engine_eval_cp: 15,
      engine_best_move: "e2e4",
      engine_depth: 14,
      engine_source: "local_sf18",
      cp_loss: 10,
    });
    await expect(store.recordCounterfactual(id, "d2d4")).rejects.toThrow();
  });

  it("answers once", async () => {
    const store = new MemoryRecordStore();
    const id = await commitProbed(store);
    await store.recordCounterfactual(id, "d2d4");
    await expect(store.recordCounterfactual(id, "g1f3")).rejects.toThrow();
  });
});

describe("asked and named nothing is a different fact from not asked", () => {
  it("keeps the two apart", async () => {
    /*
     * R2, and the reason `answered` is a field rather than an inference from `alternative`. A
     * player who was asked and could not produce an alternative has told the instrument something
     * real -- arguably the most interesting thing in the four readings. A player who was never
     * asked has told it nothing. Both are `alternative === null`, and a record that stores only
     * the move cannot ever tell them apart again.
     */
    const store = new MemoryRecordStore();
    const asked = nextId();
    const unasked = nextId();
    await commitDecision(store, event(armed("probed"), asked));
    await commitDecision(store, event(armed("probed"), unasked));
    await store.recordCounterfactual(asked, null);

    const answered = (await store.getAtom(asked))?.probe;
    const silent = (await store.getAtom(unasked))?.probe;
    expect(answered?.answered).toBe(true);
    expect(answered?.alternative).toBeNull();
    expect(silent?.answered).toBe(false);
    expect(silent?.alternative).toBeNull();
  });
});

describe("the alternative is scored, and until it is the reading does not exist", () => {
  it("carries no score before the engine has run", async () => {
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(armed("probed"), id));
    await store.recordCounterfactual(id, "d2d4");
    expect((await store.getAtom(id))?.probe?.alternative_cp_loss).toBeNull();
  });

  it("stores the score the reveal measured", async () => {
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(armed("probed"), id));
    await store.recordCounterfactual(id, "d2d4");
    await store.scoreCounterfactual(id, 240);
    expect((await store.getAtom(id))?.probe?.alternative_cp_loss).toBe(240);
  });

  it("refuses a score when the question was never answered", async () => {
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(armed("probed"), id));
    await expect(store.scoreCounterfactual(id, 240)).rejects.toThrow();
  });

  it("refuses a score for an answer that named no move", async () => {
    /*
     * THIS ASSERTION USED TO BE THE ONE ABOVE, AND IT PASSED WITHOUT REACHING THE RULE IT NAMES.
     * It scored a decision with no answer row at all, so it stopped at "nothing to score" and
     * never touched the "answered, but no move" branch -- a mutation that deleted that branch
     * entirely left the file green. Reaching it requires an answer that exists and is empty.
     *
     * The rule matters because the two nulls are different facts: a player who was asked and
     * could not name a move has no alternative to have scored, so a centipawn figure attached
     * here measured a move that was never on the board.
     */
    const store = new MemoryRecordStore();
    const id = nextId();
    await commitDecision(store, event(armed("probed"), id));
    await store.recordCounterfactual(id, null);
    await expect(store.scoreCounterfactual(id, 240)).rejects.toThrow();
  });
});

describe("the service refuses an arm that contradicts itself", () => {
  it("refuses an answer carried on the commit event", async () => {
    /*
     * The commit event is sent BEFORE the question is put. An alternative arriving with it means
     * the client asked first and committed after -- and naming a move before committing to one is
     * how naming the alternative turns into choosing it.
     */
    const store = new MemoryRecordStore();
    const early = { ...armed("probed"), alternative: "d2d4", answered: true };
    await expect(commitDecision(store, event(early))).rejects.toThrow(RecordError);
  });

  it("refuses an arm whose legal-move count cannot be true of the position", async () => {
    /*
     * The count is a covariate an analysis will condition on, so a client that sends the wrong one
     * silently biases every conditional estimate. Re-derived from the FEN, exactly as the phase
     * already is -- the caller's label is not trusted for anything the record will later divide by.
     */
    const store = new MemoryRecordStore();
    const wrong = { ...armed("probed"), legal_moves: 3 };
    await expect(commitDecision(store, event(wrong))).rejects.toThrow(RecordError);
  });

  it("refuses a probed arm on a position that cannot carry the question", async () => {
    // "probed" on a one-legal-move position is a client that ignored the eligibility rule.
    const store = new MemoryRecordStore();
    const impossible = {
      decision_id: nextId(),
      entry_state: {
        game_id: "g",
        fen: MATED,
        ply: 40,
        phase: "endgame" as const,
        clock_ms_remaining: null,
      },
      known: "מט",
      unknown: "אין",
      decision: "h8h7",
      bounded_action: {
        seconds_taken: 1,
        confidence: 7,
        confidence_scale: CONFIDENCE_LEVELS,
        candidate_moves_considered: ["h8h7"],
      },
      probe: { ...armed("probed"), legal_moves: 1 },
      reveal_timing: null,
      /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
      measurement_protocol: null,
      protocol_version: null,
      analysis_timing: null,
      result: null,
      feedback: null,
    };
    await expect(commitDecision(store, impossible)).rejects.toThrow(RecordError);
  });
});
