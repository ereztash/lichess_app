/**
 * LAW 4, at the level of the thing that actually runs.
 *
 * WHAT THE OLD CODE DID. `Blitz.tsx` ran the post-game search in a `useEffect` with a `cancelled`
 * flag. React calls that cleanup on unmount, so navigating away cancelled the search — and the
 * screen offering the navigation was `PostGame`, whose card says "play another game". The stored
 * game stayed `analysisState: "pending"` and nothing in the product would ever finish it.
 *
 * WHAT MAKES THE REPLACEMENT RESUMABLE IS NOT THIS CLASS. It is that the work is defined over the
 * STORED record: `pendingAnalyses` asks the store what is pending, so a page load a week later asks
 * the same question and gets the same answer. This file drives the runner with a fake port to hold
 * the four properties that the definition alone does not give — one pass at a time, an engine built
 * only when there is work and released when there is none, a game the record cannot score reported
 * once rather than rediscovered forever, and a failed write leaving the game pending rather than
 * marked done.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  BlitzAnalysisRunner,
  blitzAnalysisRunner,
  resetBlitzAnalysisRunner,
  type AnalysisPort,
} from "@/lib/blitz-analysis-runner";
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "@shared/confidence";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import type { StoredBlitzDecision, StoredBlitzGame, StoredBlitzRecord } from "@shared/blitz-record";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const game = (gameId: string, over: Partial<StoredBlitzGame> = {}): StoredBlitzGame => ({
  gameId,
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

const decision = (gameId: string, ply: number): StoredBlitzDecision => ({
  gameId,
  ply,
  side: "w",
  san: ply === 1 ? "e4" : "Nf3",
  fenBefore:
    ply === 1 ? START : "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  thinkMs: 1_200,
  clockBeforeMs: 180_000,
  opponentClockBeforeMs: 180_000,
  wasAsked: true,
  samplingProbability: 0.15,
  confidence: 5,
  confidenceScale: CONFIDENCE_LEVELS,
  confidenceGridVersion: CONFIDENCE_GRID_VERSION,
  instrumentationLatencyMs: 800,
  cpLoss: null,
  standingCp: null,
});

/**
 * A store the test drives, and the counters that make the assertions possible.
 *
 * `analyses` COUNTS EVALUATIONS AND `engines` COUNTS WORKERS, and both are needed: a runner that
 * cached a result would build one engine and evaluate nothing, and one that ran twice would build
 * two. Neither count alone separates the cases.
 */
function fakeStore(games: StoredBlitzGame[], decisions: StoredBlitzDecision[]) {
  const state = { games: [...games], decisions: [...decisions] };
  const counts = { engines: 0, disposed: 0, evaluations: 0, attaches: 0 };
  let attachFails = false;
  let hold: (() => void) | null = null;

  const port: AnalysisPort = {
    listPending: async () => ({ games: state.games, decisions: state.decisions }),
    recordFor: async (gameId) => {
      const g = state.games.find((x) => x.gameId === gameId);
      const rows = state.decisions.filter((d) => d.gameId === gameId).sort((a, b) => a.ply - b.ply);
      return g && rows.length ? { game: g, decisions: rows } : null;
    },
    attach: async (record: StoredBlitzRecord) => {
      counts.attaches += 1;
      if (attachFails) throw new Error("the write failed");
      /* What the real store does: flip the row to complete, so the next scan skips it. */
      state.games = state.games.map((g) =>
        g.gameId === record.game.gameId ? { ...g, ...record.game } : g,
      );
    },
    buildEngine: async () => {
      counts.engines += 1;
      return {
        analyze: async () => {
          counts.evaluations += 1;
          if (hold) await new Promise<void>((done) => (hold = done));
          return { scoreCp: 20, pv: [], depth: 12, fen: "" };
        },
        dispose: () => {
          counts.disposed += 1;
        },
      } as never;
    },
  };
  return {
    port,
    counts,
    state,
    failAttach: () => (attachFails = true),
    pending: () => state.games.filter((g) => g.analysisState === "pending").map((g) => g.gameId),
  };
}

beforeEach(() => resetBlitzAnalysisRunner());

describe("a game that finishes analysing after you leave", () => {
  it("scores a pending game and marks it complete", async () => {
    const store = fakeStore([game("g1")], [decision("g1", 1), decision("g1", 3)]);
    await new BlitzAnalysisRunner().run(store.port);
    expect(store.counts.attaches).toBe(1);
    expect(store.pending()).toEqual([]);
    /* Two positions per decision: before, and after the stored move. */
    expect(store.counts.evaluations).toBe(4);
  });

  it("finishes the first game even though a second was started immediately", async () => {
    /*
     * THE SCENARIO THE OLD CODE FAILED. The player finishes a game and presses "play another"
     * before the search returns. Under the effect, unmounting cancelled it. Here the runner holds
     * no game — it holds the record's answer to "what is pending" — so starting another game is
     * simply another row, and the first still completes.
     */
    const store = fakeStore(
      [game("g1"), game("g2")],
      [decision("g1", 1), decision("g2", 1)],
    );
    await new BlitzAnalysisRunner().run(store.port);
    expect(store.pending()).toEqual([]);
    expect(store.counts.attaches).toBe(2);
  });

  it("picks up a game left pending by an earlier session, with no memory of it", async () => {
    /*
     * "RESUMES ON NEXT LAUNCH", MODELLED HONESTLY: a brand-new runner, told nothing, over a store
     * that already holds a pending game. If resumability depended on anything the previous runner
     * remembered, this case could not pass.
     */
    const store = fakeStore([game("old")], [decision("old", 1)]);
    await new BlitzAnalysisRunner().run(store.port);
    expect(store.pending()).toEqual([]);
  });

  it("does not run two passes at once", async () => {
    const store = fakeStore([game("g1")], [decision("g1", 1)]);
    const runner = new BlitzAnalysisRunner();
    await Promise.all([runner.run(store.port), runner.run(store.port)]);
    expect(store.counts.engines).toBe(1);
    expect(store.counts.attaches).toBe(1);
  });

  it("builds no engine at all when nothing is pending", async () => {
    /*
     * `StockfishClient` pulls 7 MB of wasm. A runner that built one on every page load would make
     * an empty record cost what a full one costs, and this hook runs at the app root.
     */
    const store = fakeStore(
      [game("g1", { analysisState: "complete", analysedAt: "x", analysis: { engine: "s", build: "b", depth: 12 } })],
      [decision("g1", 1)],
    );
    await new BlitzAnalysisRunner().run(store.port);
    expect(store.counts.engines).toBe(0);
  });

  it("releases the engine when the pass ends", async () => {
    const store = fakeStore([game("g1")], [decision("g1", 1)]);
    await new BlitzAnalysisRunner().run(store.port);
    expect(store.counts.disposed).toBe(1);
  });

  it("releases the engine even when the write throws", async () => {
    // A blitz player who finished one game should not hold a Stockfish worker for the session.
    const store = fakeStore([game("g1")], [decision("g1", 1)]);
    store.failAttach();
    await expect(new BlitzAnalysisRunner().run(store.port)).rejects.toThrow();
    expect(store.counts.disposed).toBe(1);
  });

  it("leaves a game pending when the write fails, so the next pass retries it", async () => {
    const store = fakeStore([game("g1")], [decision("g1", 1)]);
    store.failAttach();
    await expect(new BlitzAnalysisRunner().run(store.port)).rejects.toThrow();
    expect(store.pending()).toEqual(["g1"]);
  });

  it("gives up on a record that can never produce work, and does not rescan it", async () => {
    /*
     * A pending game with no decisions. Skipped silently it would be rediscovered on every scan
     * forever, and the number of games waiting would never fall for a reason nobody could name.
     */
    const store = fakeStore([game("empty")], []);
    const runner = new BlitzAnalysisRunner();
    await runner.run(store.port);
    expect(runner.giveUps()).toEqual([{ gameId: "empty", unscoreable: "no-decisions" }]);
    expect(store.counts.engines).toBe(0);

    await runner.run(store.port);
    expect(store.counts.engines).toBe(0);
  });

  it("reports progress against the game being scored, not against the backlog", async () => {
    const store = fakeStore([game("g1")], [decision("g1", 1), decision("g1", 3)]);
    const runner = new BlitzAnalysisRunner();
    const seen: string[] = [];
    runner.subscribe((p) => seen.push(`${p.scoring ?? "-"} ${p.done}/${p.of}`));
    await runner.run(store.port);
    expect(seen).toContain("g1 0/4");
    expect(seen).toContain("g1 4/4");
    /* And it ends idle, so a screen does not keep showing a bar for finished work. */
    expect(seen[seen.length - 1]).toBe("- 0/0");
  });

  it("gives up on a worker that never answers, instead of wedging the queue forever", async () => {
    /*
     * FOUND BY A TEST AND IT WAS A PRODUCTION DEFECT. `run()` returns the in-flight promise so two
     * callers share one pass; with no bound on an evaluation, a search that never settles leaves
     * that promise unresolved forever and every later scan joins it. The queue is then permanently
     * stuck holding pending games it will never look at — LAW 4's failure, reached through the
     * mechanism meant to protect it.
     *
     * THE GAME STAYS PENDING, WHICH IS THE POINT. A timeout loses nothing: the next pass gets a
     * fresh worker, and the record still says exactly what is true of it.
     */
    const store = fakeStore([game("g1")], [decision("g1", 1)]);
    const never: AnalysisPort = {
      ...store.port,
      buildEngine: async () => {
        store.counts.engines += 1;
        return {
          analyze: () => new Promise(() => {}),
          dispose: () => {
            store.counts.disposed += 1;
          },
        } as never;
      },
    };
    const runner = new BlitzAnalysisRunner(5);
    await expect(runner.run(never)).rejects.toThrow(/did not answer/);
    expect(store.counts.disposed, "the wedged worker was not released").toBe(1);
    expect(store.pending()).toEqual(["g1"]);

    /* And the queue is not stuck: a later pass with a working engine finishes the job. */
    await runner.run(store.port);
    expect(store.pending()).toEqual([]);
  });

  it("hands every screen the same runner, so two of them do not score the same game twice", () => {
    expect(blitzAnalysisRunner()).toBe(blitzAnalysisRunner());
  });
});
