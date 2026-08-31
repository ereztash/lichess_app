/**
 * R-17: the same defect R-10 closed, one table over, still open.
 *
 * `decisions` carries `confidence_scale` and `confidence_grid_version`; `blitz_decisions` carried
 * neither and stored a bare `confidence: 6`. Six of what, on which grid, is answerable today only
 * because `CONFIDENCE_LEVELS` happens to be 7 and `CONFIDENCE_GRID_VERSION` happens to be 1 in the
 * build doing the reading -- which is not a property of the row, it is a property of whoever reads
 * it. `shared/confidence.ts` names two open questions that would move the seven probabilities while
 * leaving the count at seven, and on that day every stored blitz level would silently assert a
 * different number.
 *
 * WORSE HERE THAN THERE, which is why this is a P1 and not a P2. The blitz row is the only place a
 * confidence is recorded during a timed game. The whole reason the blitz route exists is to measure
 * calibration under time pressure, and calibration is `confidence - accuracy`: re-mean the first
 * term and the measurement the route was built for changes without a single test failing.
 *
 * FOUND SIDEWAYS, WHICH IS THE ARGUMENT FOR BUILDING THE PROJECTION FIRST. Nothing was reading
 * these rows, so nothing had ever had to answer "what does this integer mean". `BlitzReading` had
 * to, and the answer was a shipped constant.
 */
import { describe, expect, it } from "vitest";
import {
  LEGACY_BLITZ_CONFIDENCE_GRID_VERSION,
  LEGACY_BLITZ_CONFIDENCE_SCALE,
  blitzConfidenceOf,
  storedBlitzRecordSchema,
  toPendingRecord,
  type StoredBlitzDecision,
} from "@shared/blitz-record";
import {
  CONFIDENCE_GRID_VERSION,
  CONFIDENCE_LEVELS,
  LEGACY_CONFIDENCE_LEVELS,
  normaliseConfidence,
} from "@shared/confidence";
import type { FinishedGame } from "@shared/blitz-post-game";
import { BLITZ_SAMPLING_POLICY_VERSION, type InstrumentedDecision } from "@shared/blitz-instrument";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const stored = (over: Partial<StoredBlitzDecision> = {}): StoredBlitzDecision => ({
  gameId: "g1",
  ply: 1,
  side: "w",
  san: "e4",
  fenBefore: START,
  thinkMs: 1200,
  clockBeforeMs: 180_000,
  opponentClockBeforeMs: 180_000,
  wasAsked: true,
  samplingProbability: 0.15,
  confidence: 6,
  confidenceScale: CONFIDENCE_LEVELS,
  confidenceGridVersion: CONFIDENCE_GRID_VERSION,
  instrumentationLatencyMs: 800,
  cpLoss: 30,
  standingCp: 40,
  ...over,
});

const game = (): FinishedGame => ({
  phase: "finished",
  timeControl: { initialMs: 180_000, incrementMs: 0 },
  fen: START,
  active: "b",
  clocksAtTurnStart: { w: 180_000, b: 180_000 },
  turnStartedAtMs: 0,
  ply: 1,
  outcome: { kind: "resignation", loser: "b" },
  decisions: [
    {
      ply: 1,
      side: "w",
      san: "e4",
      fenBefore: START,
      thinkMs: 1200,
      clockBeforeMs: 180_000,
      opponentClockBeforeMs: 180_000,
    },
  ],
});

const instrumented = (confidence: number | null): InstrumentedDecision[] => [
  {
    decision: game().decisions[0],
    wasAsked: confidence !== null,
    samplingProbability: 0.15,
    samplingPolicyVersion: BLITZ_SAMPLING_POLICY_VERSION,
    confidence,
    instrumentationLatencyMs: confidence === null ? null : 800,
  },
];

describe("a blitz confidence with no scale", () => {
  describe("what a fresh row must carry", () => {
    it("writes the scale and the grid version beside every stated confidence", () => {
      const record = toPendingRecord(game(), instrumented(6), {
        gameId: "g1",
        playedAs: "w",
        startedAt: "2026-08-30T12:00:00.000Z",
        finishedAt: "2026-08-30T12:03:00.000Z",
      });
      expect("refused" in record).toBe(false);
      if ("refused" in record) return;
      expect(record.decisions[0].confidenceScale).toBe(CONFIDENCE_LEVELS);
      expect(record.decisions[0].confidenceGridVersion).toBe(CONFIDENCE_GRID_VERSION);
    });

    it("writes NEITHER on a decision nobody was asked about", () => {
      /*
       * A scale on a row with no confidence describes an instrument nobody used, and it would count
       * as a stated confidence to anything that tested for the scale's presence.
       */
      const record = toPendingRecord(game(), instrumented(null), {
        gameId: "g1",
        playedAs: "w",
        startedAt: "2026-08-30T12:00:00.000Z",
        finishedAt: "2026-08-30T12:03:00.000Z",
      });
      expect("refused" in record).toBe(false);
      if ("refused" in record) return;
      expect(record.decisions[0].confidence).toBeNull();
      expect(record.decisions[0].confidenceScale).toBeNull();
      expect(record.decisions[0].confidenceGridVersion).toBeNull();
    });
  });

  describe("what the boundary refuses", () => {
    const wire = (decisions: StoredBlitzDecision[]) => ({
      game: {
        gameId: "g1",
        playedAs: "w" as const,
        timeControl: { initialMs: 180_000, incrementMs: 0 },
        outcome: { kind: "resignation" as const, loser: "b" as const },
        startedAt: "2026-08-30T12:00:00.000Z",
        finishedAt: "2026-08-30T12:03:00.000Z",
        measurementProtocol: "instrumented-blitz" as const,
        protocolVersion: 3,
        analysisTiming: "after-play" as const,
        samplingPolicyVersion: 1,
        askRate: 0.15,
        analysisState: "complete" as const,
        analysedAt: "2026-08-30T12:03:20.000Z",
        analysis: { engine: "stockfish", build: "18-lite", depth: 12 },
        opponent: { kind: "engine", engine: "stockfish", build: "18-lite", depth: 4 },
      },
      decisions,
    });

    it("accepts a row that says what its level was stated on", () => {
      expect(storedBlitzRecordSchema.safeParse(wire([stored()])).success).toBe(true);
    });

    it("REFUSES a stated confidence with no scale", () => {
      const bad = storedBlitzRecordSchema.safeParse(wire([stored({ confidenceScale: null })]));
      expect(bad.success).toBe(false);
    });

    it("REFUSES a stated confidence with no grid version", () => {
      const bad = storedBlitzRecordSchema.safeParse(wire([stored({ confidenceGridVersion: null })]));
      expect(bad.success).toBe(false);
    });

    it("REFUSES a scale on a decision that stated no confidence", () => {
      const bad = storedBlitzRecordSchema.safeParse(wire([stored({ confidence: null })]));
      expect(bad.success).toBe(false);
    });
  });

  describe("what an already-stored row means", () => {
    it("dates a row with no scale rather than reading it on today's grid", () => {
      /*
       * THE GATE. A row from before the columns existed is read on the scale the blitz route has
       * always shipped -- and it says that it was dated rather than read, so a denominator can
       * report how much of itself rests on an inference about age.
       */
      const reading = blitzConfidenceOf(
        { confidence: 6, confidenceScale: null, confidenceGridVersion: null },
        normaliseConfidence,
      );
      expect(reading).toEqual({
        read: 0.8,
        scale: LEGACY_BLITZ_CONFIDENCE_SCALE,
        gridVersion: LEGACY_BLITZ_CONFIDENCE_GRID_VERSION,
        dated: true,
      });
    });

    it("does NOT date a row that says what it was stated on", () => {
      const reading = blitzConfidenceOf(stored(), normaliseConfidence);
      expect(reading).toEqual({
        read: 0.8,
        scale: CONFIDENCE_LEVELS,
        gridVersion: CONFIDENCE_GRID_VERSION,
        dated: false,
      });
    });

    it("keeps the blitz legacy scale at SEVEN, which is not the record's legacy scale", () => {
      /*
       * The two tables have different histories and one constant covering both would be wrong for
       * one of them. `decisions` predates the seven-level scale; the blitz route has rendered
       * [1..7] since its first commit and has never shipped another.
       */
      expect(LEGACY_BLITZ_CONFIDENCE_SCALE).toBe(7);
      expect(LEGACY_CONFIDENCE_LEVELS).toBe(5);
      expect(LEGACY_BLITZ_CONFIDENCE_SCALE).not.toBe(LEGACY_CONFIDENCE_LEVELS);
    });

    it("reads a stored 6 as 0.8 and NOT as the five-level scale's 0.75-shaped answer", () => {
      // What reading a blitz row on the record's legacy scale would have produced: a throw.
      expect(() => normaliseConfidence(6, LEGACY_CONFIDENCE_LEVELS, 1)).toThrow(/not a level/);
    });

    it("reports a row from a NEWER build as unreadable rather than re-reading it", () => {
      const reading = blitzConfidenceOf(
        { confidence: 6, confidenceScale: 7, confidenceGridVersion: CONFIDENCE_GRID_VERSION + 1 },
        normaliseConfidence,
      );
      expect(reading).toEqual({ unreadable: "unknown-grid" });
    });

    it("separates 'nobody was asked' from 'stated on a grid we cannot read'", () => {
      const unasked = blitzConfidenceOf(
        { confidence: null, confidenceScale: null, confidenceGridVersion: null },
        normaliseConfidence,
      );
      expect(unasked).toEqual({ unreadable: "not-asked" });
    });
  });
});
