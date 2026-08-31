/**
 * PR-11: the blitz route keeps what it measured, and the join refuses rather than guesses.
 *
 * Three sources describe the same plies -- the game core, the instrument, and the engine that ran
 * only after the game ended. Equal lengths are not the same fact as the same decisions, and a
 * best-effort join would produce rows where a confidence belongs to one move and a cp-loss to
 * another, with nothing downstream able to tell: every row would look complete.
 */
import { describe, expect, it } from "vitest";
import {
  toStoredRecord,
  isRefusal,
  storedBlitzRecordSchema,
  type StoredBlitzRecord,
} from "../../shared/blitz-record";
import type { FinishedGame, AnalysedDecision } from "../../shared/blitz-post-game";
import type { InstrumentedDecision } from "../../shared/blitz-instrument";
import { BLITZ_ASK_RATE, BLITZ_SAMPLING_POLICY_VERSION } from "../../shared/blitz-instrument";
import { CURRENT_PROTOCOL_VERSION } from "../../shared/measurement-protocol";
import { MemoryRecordStore } from "../../server/record";
import { LIVE_DECISION_CARRIES_CLOCK } from "../../shared/live-acquisition";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const coreDecision = (ply: number, san: string) => ({
  ply,
  side: (ply % 2 === 1 ? "w" : "b") as "w" | "b",
  san,
  fenBefore: START,
  thinkMs: 1200 + ply,
  clockBeforeMs: 180_000 - ply * 1000,
  opponentClockBeforeMs: 180_000 - ply * 900,
});

const game = (sans: string[]): FinishedGame =>
  ({
    phase: "finished",
    timeControl: { initialMs: 180_000, incrementMs: 0 },
    fen: START,
    active: "w",
    clocksAtTurnStart: { w: 170_000, b: 171_000 },
    turnStartedAtMs: 5_000,
    ply: sans.length + 1,
    decisions: sans.map((san, i) => coreDecision(i + 1, san)),
    outcome: { kind: "checkmate", loser: "b" },
  }) as FinishedGame;

/*
 * THE INSTRUMENT SEES ONLY THE PLAYER'S MOVES, and the first version of this file did not model
 * that: it fed all three sources the same plies, which is the one thing a real game never does.
 * The core records a decision for every move because it runs the whole board, the engine scores
 * every one of them, and `recordCommitted` is called from the move handler that only the player
 * goes through. Requiring all three lengths to match therefore rejected every real game -- found
 * end to end, on a game actually played through the route, not here.
 */
const instrumentedFor = (sans: string[]): InstrumentedDecision[] =>
  sans
    .map((san, i) => ({ san, ply: i + 1 }))
    .filter((d) => d.ply % 2 === 1)
    .map(({ san, ply }, k) => ({
      decision: coreDecision(ply, san),
      wasAsked: k === 0,
      samplingProbability: BLITZ_ASK_RATE,
      samplingPolicyVersion: BLITZ_SAMPLING_POLICY_VERSION,
      confidence: k === 0 ? 5 : null,
      instrumentationLatencyMs: k === 0 ? 800 : null,
    }));

const analysedFor = (sans: string[]): AnalysedDecision[] =>
  sans.map((san, i) => ({ ...coreDecision(i + 1, san), cpLoss: i * 10, standingCp: 40 - i }));

/*
 * THE PROVENANCE IS PART OF THE META NOW, and it is not decoration on a fixture.
 *
 * `toStoredRecord` produces a `complete` game, and a complete game that cannot say what scored it
 * or when is a row whose cp-losses belong to no particular engine at no particular depth. Two
 * builds of Stockfish disagree about the same position by more than the effects this product
 * measures, so pooling their rows is not a small error -- it is the measurement.
 *
 * `ScoredBlitzRecordMeta` makes both required, which is why this fixture stopped compiling rather
 * than stopped validating. That is the whole reason the type exists.
 */
const META = {
  gameId: "g1",
  playedAs: "w" as const,
  startedAt: "2026-08-30T18:00:00Z",
  finishedAt: "2026-08-30T18:03:20Z",
  analysis: { engine: "stockfish", build: "18-lite-single", depth: 12 },
  analysedAt: "2026-08-30T18:03:29Z",
};

const SANS = ["e4", "e5", "Nf3", "Nc6"];
const stored = () => toStoredRecord(game(SANS), instrumentedFor(SANS), analysedFor(SANS), META);

describe("a game that does not vanish with the tab", () => {
  it("joins the three sources, each field from the source that owns it", () => {
    const record = stored();
    expect(isRefusal(record)).toBe(false);
    const { decisions } = record as StoredBlitzRecord;
    // Four moves were played; two of them were the player's, and only those are the record.
    expect(decisions).toHaveLength(2);
    expect(decisions.map((d) => d.ply)).toEqual([1, 3]);

    // the core owns the move, the clocks and the think time
    expect(decisions[0].san).toBe("e4");
    expect(decisions[0].thinkMs).toBe(1201);
    expect(decisions[0].clockBeforeMs).toBe(179_000);
    expect(decisions[0].opponentClockBeforeMs).toBe(179_100);
    // the instrument owns the sampling and the confidence
    expect(decisions[0].wasAsked).toBe(true);
    expect(decisions[0].samplingProbability).toBe(BLITZ_ASK_RATE);
    expect(decisions[0].confidence).toBe(5);
    // the engine owns the verdict, and it ran after the game ended
    expect(decisions[1].san).toBe("Nf3");
    expect(decisions[1].cpLoss).toBe(20);
    expect(decisions[1].standingCp).toBe(38);
  });

  it("keeps an unasked decision's confidence and latency NULL rather than zero", () => {
    /*
     * A decision nobody questioned has no confidence and no latency. Zero is a number somebody
     * produced. Storing the first as the second makes the mean of either column a fiction and
     * hides the population the sampler exists to describe.
     */
    const { decisions } = stored() as StoredBlitzRecord;
    expect(decisions[1].wasAsked).toBe(false);
    expect(decisions[1].confidence).toBeNull();
    expect(decisions[1].instrumentationLatencyMs).toBeNull();
  });

  it("stores the regime on the game, so a later reader need not know this week's constants", () => {
    const { game: g } = stored() as StoredBlitzRecord;
    expect(g.measurementProtocol).toBe("instrumented-blitz");
    expect(g.analysisTiming).toBe("after-play");
    expect(g.protocolVersion).toBe(CURRENT_PROTOCOL_VERSION);
    expect(g.samplingPolicyVersion).toBe(BLITZ_SAMPLING_POLICY_VERSION);
    expect(g.askRate).toBe(BLITZ_ASK_RATE);
    expect(g.timeControl).toEqual({ initialMs: 180_000, incrementMs: 0 });
    expect(g.playedAs).toBe("w");
  });

  describe("what it refuses, because a best-effort join is invisible afterwards", () => {
    it("refuses when the three sources disagree on how many decisions there were", () => {
      const r = toStoredRecord(game(SANS), instrumentedFor(SANS).slice(0, 1), analysedFor(SANS), META);
      expect(r).toEqual({ refused: "counts-disagree", core: 2, instrument: 1, analysis: 2 });
    });

    it("refuses a row that is the right COUNT but shifted by one", () => {
      /*
       * The corruption this exists for. Drop one instrument row and duplicate another and the
       * length still matches, but every confidence after the drop belongs to the previous move.
       */
      const shifted = instrumentedFor(SANS);
      const wrong = [shifted[0], shifted[0]];
      const r = toStoredRecord(game(SANS), wrong, analysedFor(SANS), META);
      expect(isRefusal(r)).toBe(true);
      expect((r as { refused: string }).refused).toBe("plies-disagree");
    });

    it("refuses when the engine analysed a different move than the one played", () => {
      // Ply 3 is the player's second move, so corrupting it is corrupting a row that is kept.
      const wrong = analysedFor(SANS).map((d, i) => (i === 2 ? { ...d, san: "Bc4" } : d));
      const r = toStoredRecord(game(SANS), instrumentedFor(SANS), wrong, META);
      expect(r).toMatchObject({ refused: "moves-disagree", at: 1, core: "Nf3", analysis: "Bc4" });
    });

    it("refuses a game with no decisions instead of storing an empty one", () => {
      expect(toStoredRecord(game([]), [], [], META)).toEqual({ refused: "no-decisions" });
    });
  });

  describe("the wire schema, which is checked and not trusted", () => {
    const wire = () => structuredClone(stored() as StoredBlitzRecord);

    it("accepts a record the join produced", () => {
      expect(storedBlitzRecordSchema.safeParse(wire()).success).toBe(true);
    });

    it("REFUSES a game claiming the engine ran during play", () => {
      /*
       * INV-4 at the boundary. A client reporting `during-play` is not a variant to record, it is a
       * client that broke the invariant, and storing the claim would put a row in the dataset whose
       * conditions are a lie. Found as a gap: a mutation loosening this literal stayed green
       * because nothing asked the schema to refuse anything.
       */
      const bad = wire();
      (bad.game as { analysisTiming: string }).analysisTiming = "during-play";
      expect(storedBlitzRecordSchema.safeParse(bad).success).toBe(false);
    });

    it("REFUSES a protocol that is not blitz", () => {
      const bad = wire();
      (bad.game as { measurementProtocol: string }).measurementProtocol = "instrumented-standard";
      expect(storedBlitzRecordSchema.safeParse(bad).success).toBe(false);
    });

    it("REFUSES a decisive outcome that names nobody as having lost", () => {
      const bad = wire();
      (bad.game as { outcome: unknown }).outcome = { kind: "flag" };
      expect(storedBlitzRecordSchema.safeParse(bad).success).toBe(false);
    });

    it("REFUSES two decisions claiming the same ply", () => {
      const bad = wire();
      bad.decisions = [bad.decisions[0], { ...bad.decisions[0] }];
      expect(storedBlitzRecordSchema.safeParse(bad).success).toBe(false);
    });

    it("REFUSES a decision that names a different game", () => {
      const bad = wire();
      bad.decisions[0] = { ...bad.decisions[0], gameId: "somebody-elses-game" };
      expect(storedBlitzRecordSchema.safeParse(bad).success).toBe(false);
    });

    it("distinguishes an absent confidence from one reported as null", () => {
      // `optional()` would make these the same, which is the whole distinction the column exists for.
      const missing = wire();
      delete (missing.decisions[0] as Partial<{ confidence: number | null }>).confidence;
      expect(storedBlitzRecordSchema.safeParse(missing).success).toBe(false);
      /*
       * THE SCALE GOES WITH IT (R-17). A confidence and the scale it was stated on are one fact in
       * three columns: a null confidence beside a populated scale describes an instrument nobody
       * used, and the schema now refuses it. Nulling only the confidence here would be testing that
       * refusal by accident while claiming to test `nullable()`.
       */
      const nulled = wire();
      nulled.decisions[0] = {
        ...nulled.decisions[0],
        confidence: null,
        confidenceScale: null,
        confidenceGridVersion: null,
      };
      expect(storedBlitzRecordSchema.safeParse(nulled).success).toBe(true);
    });
  });

  describe("the store keeps it, and keeps it apart", () => {
    const record = () => stored() as StoredBlitzRecord;

    it("round-trips a game and its decisions", async () => {
      const store = new MemoryRecordStore();
      await store.saveBlitzRecord(record());
      expect(await store.listBlitzGames()).toHaveLength(1);
      const back = await store.listBlitzDecisions();
      expect(back).toHaveLength(2);
      expect(back[1].confidence).toBeNull();
      expect(back[0].confidence).toBe(5);
    });

    it("refuses to store the same game twice", async () => {
      const store = new MemoryRecordStore();
      await store.saveBlitzRecord(record());
      await expect(store.saveBlitzRecord(record())).rejects.toThrow(/append-only/);
    });

    it("does not put a blitz decision into the decision record", async () => {
      /*
       * ADR-004 as an assertion. The atom table is where the commitment loop's decisions live, and
       * a blitz decision has no stated reads to put in it. Storing a game must leave `listAtoms`
       * exactly as it found it -- otherwise the two loops silently share a population.
       */
      const store = new MemoryRecordStore();
      const before = (await store.listAtoms()).length;
      await store.saveBlitzRecord(record());
      expect(await store.listAtoms()).toHaveLength(before);
      expect(await store.listDecisionIds()).toHaveLength(0);
    });

    it("leaves LIVE_DECISION_CARRIES_CLOCK false, because the atoms still carry no clock", () => {
      /*
       * A PREDICTION I GOT WRONG, KEPT AS A TEST. I told the account holder that landing this step
       * would flip the constant and redden two assertions in the reachability gate. That was true
       * of the design where blitz decisions BECOME atoms, and ADR-004 chose the other one: the
       * detector reads atoms, atoms still have no clock, so `clock-under-1m` is still unfillable by
       * anything the detector can see and refusing to preregister it is still correct.
       */
      expect(LIVE_DECISION_CARRIES_CLOCK).toBe(false);
    });
  });
});
