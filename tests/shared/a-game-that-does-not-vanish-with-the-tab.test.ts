/**
 * PR-11: the blitz route keeps what it measured, and the join refuses rather than guesses.
 *
 * Three sources describe the same plies -- the game core, the instrument, and the engine that ran
 * only after the game ended. Equal lengths are not the same fact as the same decisions, and a
 * best-effort join would produce rows where a confidence belongs to one move and a cp-loss to
 * another, with nothing downstream able to tell: every row would look complete.
 */
import { describe, expect, it } from "vitest";
import { toStoredRecord, isRefusal, type StoredBlitzRecord } from "../../shared/blitz-record";
import type { FinishedGame, AnalysedDecision } from "../../shared/blitz-post-game";
import type { InstrumentedDecision } from "../../shared/blitz-instrument";
import { BLITZ_ASK_RATE, BLITZ_SAMPLING_POLICY_VERSION } from "../../shared/blitz-instrument";
import { CURRENT_PROTOCOL_VERSION } from "../../shared/measurement-protocol";

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

const instrumentedFor = (sans: string[]): InstrumentedDecision[] =>
  sans.map((san, i) => ({
    decision: coreDecision(i + 1, san),
    wasAsked: i === 0,
    samplingProbability: BLITZ_ASK_RATE,
    samplingPolicyVersion: BLITZ_SAMPLING_POLICY_VERSION,
    confidence: i === 0 ? 5 : null,
    instrumentationLatencyMs: i === 0 ? 800 : null,
  }));

const analysedFor = (sans: string[]): AnalysedDecision[] =>
  sans.map((san, i) => ({ ...coreDecision(i + 1, san), cpLoss: i * 10, standingCp: 40 - i }));

const META = {
  gameId: "g1",
  playedAs: "w" as const,
  startedAt: "2026-08-30T18:00:00Z",
  finishedAt: "2026-08-30T18:03:20Z",
};

const SANS = ["e4", "e5", "Nf3"];
const stored = () => toStoredRecord(game(SANS), instrumentedFor(SANS), analysedFor(SANS), META);

describe("a game that does not vanish with the tab", () => {
  it("joins the three sources, each field from the source that owns it", () => {
    const record = stored();
    expect(isRefusal(record)).toBe(false);
    const { decisions } = record as StoredBlitzRecord;
    expect(decisions).toHaveLength(3);

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
    expect(decisions[2].cpLoss).toBe(20);
    expect(decisions[2].standingCp).toBe(38);
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
      const r = toStoredRecord(game(SANS), instrumentedFor(SANS).slice(0, 2), analysedFor(SANS), META);
      expect(r).toEqual({ refused: "counts-disagree", core: 3, instrument: 2, analysis: 3 });
    });

    it("refuses a row that is the right COUNT but shifted by one", () => {
      /*
       * The corruption this exists for. Drop one instrument row and duplicate another and the
       * length still matches, but every confidence after the drop belongs to the previous move.
       */
      const shifted = instrumentedFor(SANS);
      const wrong = [shifted[0], shifted[0], shifted[1]];
      const r = toStoredRecord(game(SANS), wrong, analysedFor(SANS), META);
      expect(isRefusal(r)).toBe(true);
      expect((r as { refused: string }).refused).toBe("plies-disagree");
    });

    it("refuses when the engine analysed a different move than the one played", () => {
      const wrong = analysedFor(SANS).map((d, i) => (i === 1 ? { ...d, san: "c5" } : d));
      const r = toStoredRecord(game(SANS), instrumentedFor(SANS), wrong, META);
      expect(r).toMatchObject({ refused: "moves-disagree", at: 1, core: "e5", analysis: "c5" });
    });

    it("refuses a game with no decisions instead of storing an empty one", () => {
      expect(toStoredRecord(game([]), [], [], META)).toEqual({ refused: "no-decisions" });
    });
  });
});
