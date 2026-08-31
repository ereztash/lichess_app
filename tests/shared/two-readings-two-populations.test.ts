/**
 * The record page carries two readings, and they may not be computed from one pile of decisions.
 *
 * WHAT WAS ENTANGLED. `recordReading` called `listAtoms()` once and handed everything to
 * `readRecord`, which then recovered the bank subset by filtering on `isAnchorFen`. So one
 * population served two consumers with opposite eligibility rules, and a single drill decision
 * did two wrong things at once: it diluted the description of how the player plays, and -- if it
 * happened to sit on a bank position -- it walked into the only between-player comparison the
 * product has.
 *
 * THE TWO QUESTIONS ARE NOT THE SAME QUESTION. "What does this player's own play look like" is a
 * within-person description and free play is what it is about. "How does this player compare to
 * others" is answerable only on a fixed set everyone answers. Averaging a drill into the first
 * makes it a description of a mixture of protocols; letting it into the second compares a player
 * on positions chosen BECAUSE they were weak against players who met the standard set.
 *
 * `isAnchorFen` ANSWERS A THIRD QUESTION, which is why it is no longer the filter: it asks whether
 * the POSITION is in the bank, not whether the DECISION was a bank answer. A drill may legitimately
 * run on a bank position -- `decisionPurposeFor` ranks `drill` above `anchor` precisely because
 * what is being measured there is the drill.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { registerDrill } from "../fixtures/registered-drill";
import { registerTransfer } from "../fixtures/registered-transfer";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { ANCHOR_POSITIONS } from "../../shared/anchor-set";
import { classifyPhase } from "../../shared/phase";
import { EVIDENCE_POLICY, forAnchorReference, forDescriptiveHistory } from "../../shared/evidence-policy";
import type { DecisionPurpose } from "../../shared/confidence-asked";
import type { DecisionAtom } from "../../shared/decision-atom";

const FREE_PLAY = "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12";
const PLY = 30;

let seq = 0;
const nextId = () => `11111111-1111-4111-8111-${String(++seq).padStart(12, "0")}`;

async function record(
  store: MemoryRecordStore,
  options: { purpose: DecisionPurpose | null; fen: string; accurate: boolean },
) {
  const id = nextId();
  await service.commitDecision(store, {
    decision_id: id,
    entry_state: {
      game_id: "g",
      fen: options.fen,
      ply: PLY,
      phase: classifyPhase(options.fen, PLY),
      clock_ms_remaining: null,
    },
    purpose: options.purpose,
    /*
     * A drill decision names the drill it came from, because the service resolves that rather than
     * trusting the label (R-07). Registered lazily against this position, since the fixture picks
     * the position per case and the binding requires the drill to hold it.
     */
    drill_id:
      options.purpose === "drill" ? await registerDrill(store, [options.fen], `drill-${options.fen}`) : null,
    /* And a transfer check names its transfer, for the same reason and by the same lazy binding. */
    transfer_id:
      options.purpose === "transfer"
        ? await registerTransfer(store, [options.fen], `transfer-${options.fen}`)
        : null,
    known: "המרכז פתוח",
    unknown: "לא יודע איך הוא יענה",
    known_parts: { tapped: ["המרכז פתוח"], typed: "" },
    unknown_parts: { tapped: ["לא יודע איך הוא יענה"], typed: "" },
    decision: options.accurate ? "d4d5" : "d4c4",
    bounded_action: {
      seconds_taken: 20,
      confidence: CONFIDENCE_LEVELS,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: ["d4d5"],
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
  await service.reveal(store, id, {
    engine_eval_cp: 20,
    engine_best_move: "d4d5",
    engine_depth: 18,
    engine_source: "local_sf18",
    engine_build: "sf18-test-build",
    cp_loss: options.accurate ? 0 : 300,
  });
}

describe("the description of how a player plays reads free play and nothing else", () => {
  it("does not pool drills, transfer checks or imported positions into the calibration", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 10; i++) await record(store, { purpose: "play", fen: FREE_PLAY, accurate: true });
    for (const purpose of ["drill", "transfer", "import"] as const) {
      for (let i = 0; i < 10; i++) await record(store, { purpose, fen: FREE_PLAY, accurate: false });
    }
    const reading = await service.recordReading(store);
    /*
     * 10, not 40. The thirty interventions and imports were all inaccurate, so pooling them would
     * also have dragged the accuracy rate down -- a description of this player's play, made worse
     * by decisions taken while the product was trying to change it.
     */
    expect(reading.scored, "interventions were averaged into the description").toBe(10);
    expect(reading.calibration.n).toBe(10);
    expect(reading.overall.accuracyRate).toBe(1);
  });

  it("keeps a row that never recorded why it existed out of the description", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 6; i++) await record(store, { purpose: "play", fen: FREE_PLAY, accurate: true });
    for (let i = 0; i < 6; i++) await record(store, { purpose: null, fen: FREE_PLAY, accurate: false });
    const reading = await service.recordReading(store);
    expect(reading.scored).toBe(6);
  });

  it("still admits the front door's handoff, which is the player's own play", async () => {
    // `first` is refused by discovery and admitted here: it is not comparable, but it did happen.
    const store = new MemoryRecordStore();
    await record(store, { purpose: "first", fen: FREE_PLAY, accurate: true });
    await record(store, { purpose: "play", fen: FREE_PLAY, accurate: true });
    expect((await service.recordReading(store)).scored).toBe(2);
  });
});

describe("the between-player reading reads the bank and nothing else", () => {
  const bank = (i: number) => ANCHOR_POSITIONS[i % ANCHOR_POSITIONS.length].fen;

  it("counts bank answers and leaves free play out of them", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 4; i++) await record(store, { purpose: "anchor", fen: bank(i), accurate: true });
    for (let i = 0; i < 9; i++) await record(store, { purpose: "play", fen: FREE_PLAY, accurate: true });
    const reading = await service.recordReading(store);
    expect(reading.anchor.n, "the bank reading borrowed from free play").toBe(4);
    expect(reading.anchorAnswered).toHaveLength(4);
    expect(reading.scored, "bank answers were pooled into the description").toBe(9);
  });

  it("does not count a drill as a bank answer merely because it used a bank position", async () => {
    /*
     * THE DEFECT THE FEN FILTER HAD. `isAnchorFen` asks whether the POSITION is in the bank. A
     * drill that runs on a bank position is still a drill: the position was chosen because of a
     * weakness, and counting it as a bank answer both enters it into the between-player comparison
     * and tells the front door that bank slot is done, so the player is never served it.
     */
    const store = new MemoryRecordStore();
    for (let i = 0; i < 5; i++) await record(store, { purpose: "drill", fen: bank(i), accurate: false });
    const reading = await service.recordReading(store);
    expect(reading.anchor.n, "a drill entered the between-player comparison").toBe(0);
    expect(reading.anchorAnswered, "a drill marked a bank position answered").toHaveLength(0);
  });

  it("stays empty rather than borrowing from a record with no bank answers in it", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 12; i++) await record(store, { purpose: "play", fen: FREE_PLAY, accurate: true });
    const reading = await service.recordReading(store);
    expect(reading.anchor.n).toBe(0);
    expect(reading.stability.spread).toBeNull();
  });
});

describe("the two consumers are separate entries in one table", () => {
  const atoms = (purposes: (DecisionPurpose | null)[]) =>
    purposes.map((purpose) => ({ purpose })) as unknown as DecisionAtom[];

  it("admits different contexts to each", () => {
    // If these ever coincided, one of the two readings would be answering the other's question.
    const all: (DecisionPurpose | null)[] = ["play", "first", "anchor", "drill", "transfer", "import", null];
    const ids = all.map((_, i) => `d${i}`);
    expect(forDescriptiveHistory(atoms(all), ids).ids).toEqual(["d0", "d1"]);
    expect(forAnchorReference(atoms(all), ids).ids).toEqual(["d2"]);
  });

  it("files the contexts it will not pool as separate rather than as refused", () => {
    /*
     * The distinction the table would lose if these were flattened to a boolean: a bank answer is
     * not unreadable, it is not part of THIS reading. Something can still report it under its own
     * heading with its own denominator, which is what `separate` licenses and `refused` does not.
     */
    for (const context of ["anchor", "drill", "transfer", "import"] as const) {
      expect(EVIDENCE_POLICY["descriptive-history"][context].kind).toBe("separate");
    }
    expect(EVIDENCE_POLICY["anchor-reference"].drill.kind).toBe("refused");
  });
});
