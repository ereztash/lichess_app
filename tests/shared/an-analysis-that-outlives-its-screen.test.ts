/**
 * LAW 4: the analysis is not owned by the screen that started it.
 *
 * WHAT R-02 FIXED AND WHAT IT LEFT. The game is written before the engine runs, so a closed tab no
 * longer loses the moves, the clocks or the think times. The analysis itself stayed in a
 * `useEffect` in `Blitz.tsx` with a `cancelled` flag — so navigating away inside the app cancelled
 * the search, and the screen offering that navigation was `PostGame`, saying "play another game".
 *
 * A pending game is not lost. It is permanently half-recorded, which is the same failure wearing a
 * different face: the player did something in the world and the product left it in a state nothing
 * would ever finish.
 *
 * THE ASSERTION THAT MATTERS IN THIS FILE IS THE EQUIVALENCE. Moving the work to the stored record
 * meant reconstructing each decision's "after" position by applying the stored `san` to the stored
 * `fenBefore`, where `analyseFinishedGame` read it off the next ply. Those are the same position and
 * this file requires them to produce byte-identical verdicts rather than trusting the argument —
 * because the failure mode of a second definition of cp-loss is that both look right and the record
 * quietly holds two populations.
 */
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  evaluationsRequired,
  pendingAnalyses,
  scorePending,
} from "@shared/blitz-analysis-queue";
import { analyseFinishedGame, type FinishedGame } from "@shared/blitz-post-game";
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "@shared/confidence";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import type { BlitzDecision } from "@shared/blitz-game-core";
import type { StoredBlitzDecision, StoredBlitzGame } from "@shared/blitz-record";

const SANS = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"];

/** A real four-ply game, both sides, with the positions chess.js actually produces. */
function playedGame(): { game: FinishedGame; stored: StoredBlitzDecision[] } {
  const board = new Chess();
  const decisions: BlitzDecision[] = [];
  const stored: StoredBlitzDecision[] = [];
  SANS.forEach((san, index) => {
    const fenBefore = board.fen();
    const side = index % 2 === 0 ? ("w" as const) : ("b" as const);
    const decision: BlitzDecision = {
      ply: index + 1,
      side,
      san,
      fenBefore,
      thinkMs: 1_000 + index * 100,
      clockBeforeMs: 180_000 - index * 1_000,
      opponentClockBeforeMs: 180_000 - index * 900,
    };
    decisions.push(decision);
    if (side === "w") {
      stored.push({
        gameId: "g1",
        ply: decision.ply,
        side,
        san,
        fenBefore,
        thinkMs: decision.thinkMs,
        clockBeforeMs: decision.clockBeforeMs,
        opponentClockBeforeMs: decision.opponentClockBeforeMs,
        wasAsked: true,
        samplingProbability: 0.15,
        confidence: 5,
        confidenceScale: CONFIDENCE_LEVELS,
        confidenceGridVersion: CONFIDENCE_GRID_VERSION,
        instrumentationLatencyMs: 800,
        cpLoss: null,
        standingCp: null,
      });
    }
    board.move(san);
  });
  return {
    game: {
      phase: "finished",
      timeControl: { initialMs: 180_000, incrementMs: 0 },
      fen: board.fen(),
      active: "w",
      clocksAtTurnStart: { w: 100_000, b: 100_000 },
      turnStartedAtMs: 0,
      ply: SANS.length,
      decisions,
      outcome: { kind: "resignation", loser: "b" },
    },
    stored,
  };
}

const game = (over: Partial<StoredBlitzGame> = {}): StoredBlitzGame => ({
  gameId: "g1",
  playedAs: "w",
  timeControl: { initialMs: 180_000, incrementMs: 0 },
  outcome: { kind: "resignation", loser: "b" },
  startedAt: "2026-08-31T08:00:00.000Z",
  finishedAt: "2026-08-31T08:03:00.000Z",
  measurementProtocol: "instrumented-blitz",
  protocolVersion: CURRENT_PROTOCOL_VERSION,
  analysisTiming: "after-play",
  samplingPolicyVersion: 1,
  askRate: 0.15,
  analysisState: "pending",
  analysedAt: null,
  analysis: null,
  opponent: { kind: "engine", engine: "stockfish", build: "18-lite", depth: 4 },
  ...over,
});

/**
 * A deterministic evaluator: the same position always scores the same, and different positions
 * differ. Both paths must be handed the SAME function or the comparison measures the evaluator.
 */
function evaluator(): (fen: string) => Promise<number | null> {
  return async (fen: string) => {
    let hash = 0;
    for (const ch of fen) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
    return hash - 498;
  };
}

describe("an analysis that outlives its screen", () => {
  describe("the same verdict from the record as from the game in memory", () => {
    it("agrees with analyseFinishedGame on every player decision", async () => {
      /*
       * THE ASSERTION THE WHOLE MOVE RESTS ON. `analyseFinishedGame` evaluates every position once
       * and reads decision i's "after" off decision i+1's `fenBefore`; the queue applies the stored
       * `san` to the stored `fenBefore`. If those ever stopped being the same position, the record
       * would hold two populations of cp-loss and nothing downstream could tell.
       */
      const { game: played, stored } = playedGame();
      const evaluate = evaluator();

      const inMemory = await analyseFinishedGame(played, evaluate);
      expect("refused" in inMemory).toBe(false);
      if ("refused" in inMemory) return;

      const work = pendingAnalyses([game()], stored);
      expect(work.ready).toHaveLength(1);
      const fromRecord = await scorePending(work.ready[0], evaluate);
      expect("refused" in fromRecord).toBe(false);
      if ("refused" in fromRecord) return;

      const mine = inMemory.filter((d) => d.side === "w");
      expect(fromRecord.map((d) => d.ply)).toEqual(mine.map((d) => d.ply));
      expect(fromRecord.map((d) => d.cpLoss)).toEqual(mine.map((d) => d.cpLoss));
      expect(fromRecord.map((d) => d.standingCp)).toEqual(mine.map((d) => d.standingCp));
    });

    it("produces a cp-loss that is not trivially zero, so the case above can fail", async () => {
      // A comparison of two lists of nulls agrees perfectly and proves nothing.
      const { stored } = playedGame();
      const work = pendingAnalyses([game()], stored);
      const scored = await scorePending(work.ready[0], evaluator());
      if ("refused" in scored) throw new Error("the fixture refused");
      expect(scored.some((d) => (d.cpLoss ?? 0) > 0)).toBe(true);
    });
  });

  describe("what the queue picks up", () => {
    const { stored } = playedGame();

    it("takes a pending game", () => {
      expect(pendingAnalyses([game()], stored).ready.map((p) => p.gameId)).toEqual(["g1"]);
    });

    it("leaves a complete game alone, so a second pass cannot rescore it", () => {
      const done = game({
        analysisState: "complete",
        analysedAt: "2026-08-31T08:04:00.000Z",
        analysis: { engine: "stockfish", build: "18-lite", depth: 12 },
      });
      expect(pendingAnalyses([done], stored).ready).toEqual([]);
    });

    it("leaves a REFUSED game alone rather than retrying it forever", () => {
      /*
       * The engine ran and the join declined. Running it again produces the same refusal, so a
       * queue that retried would be an infinite loop wearing the costume of resilience.
       */
      expect(pendingAnalyses([game({ analysisState: "refused" })], stored).ready).toEqual([]);
    });

    it("leaves a legacy-unknown game alone, which is the one that would corrupt the record", () => {
      /*
       * Those rows WERE analysed; nothing recorded by what. Scoring them now would write today's
       * engine build onto a verdict another build produced, which is exactly the pooling
       * `blitz-strata.ts` exists to prevent — arriving through a helpful backfill.
       */
      expect(pendingAnalyses([game({ analysisState: "legacy-unknown" })], stored).ready).toEqual([]);
    });

    it("reports a game with no decisions as unscoreable rather than skipping it", () => {
      // Skipped, it would be rediscovered on every scan and the count of waiting games would never fall.
      const work = pendingAnalyses([game()], []);
      expect(work.ready).toEqual([]);
      expect(work.unscoreable).toEqual([{ gameId: "g1", unscoreable: "no-decisions" }]);
    });

    it("reports a stored move that is illegal in its own stored position, and names the ply", () => {
      const corrupt = stored.map((d, i) => (i === 1 ? { ...d, san: "Qh8" } : d));
      const work = pendingAnalyses([game()], corrupt);
      expect(work.ready).toEqual([]);
      expect(work.unscoreable[0]).toMatchObject({ unscoreable: "illegal-move", san: "Qh8" });
    });

    it("says how much work a game is before any of it runs", () => {
      const work = pendingAnalyses([game()], stored);
      expect(evaluationsRequired(work.ready[0])).toBe(stored.length * 2);
    });
  });
});
