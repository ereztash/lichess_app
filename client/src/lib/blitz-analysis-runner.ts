/**
 * THE QUEUE THAT SURVIVES THE SCREEN (LAW 4).
 *
 * MODULE-LEVEL, NOT COMPONENT-LEVEL, AND THAT IS THE WHOLE POINT. The analysis used to live in a
 * `useEffect` inside `Blitz.tsx` with a `cancelled` flag, so navigating away cancelled the search —
 * and the screen that offered the navigation was `PostGame`, saying "play another game". The state
 * that followed was a stored game with `analysisState: "pending"` that nothing would ever finish.
 *
 * WHAT MAKES IT RESUMABLE IS NOT THIS FILE, it is `pendingAnalyses` reading the STORE. This runner
 * holds no game and no queue of its own: it asks the record what is pending, every time. A page
 * load a week later asks the same question and gets the same answer, which is what "resumes on next
 * launch" means in practice.
 *
 * FOUR THINGS IT REFUSES TO DO:
 *
 *   1. IT DOES NOT BUILD THE ENGINE UNTIL THERE IS WORK. `StockfishClient` pulls 7 MB of wasm; a
 *      runner that constructed one on every page load would make an empty record cost the same as
 *      a full one. The scan is a query and the engine is built after it comes back non-empty.
 *   2. IT DOES NOT RUN TWICE AT ONCE. A second `run()` while one is in flight returns the same
 *      promise. Without that, two screens mounting in the same tick would score the same game
 *      twice — and the second `attachBlitzAnalysis` matches zero rows, so the symptom would be a
 *      silent no-op rather than a visible error.
 *   3. IT DOES NOT RETRY A GAME THAT CANNOT BE SCORED. A record with no decisions, or a stored move
 *      that is illegal in its own stored position, is reported once and remembered — otherwise
 *      every future scan picks it up again and the number of games waiting never falls.
 *   4. IT DOES NOT SWALLOW A FAILED ATTACH. If the write fails the game stays `pending`, which is
 *      true, and the next scan will try again — which is the behaviour wanted, and is different
 *      from marking it broken.
 *
 * THE ENGINE IS RELEASED WHEN THE WORK IS DONE. A blitz player who finished one game should not be
 * holding a Stockfish worker for the rest of their session.
 */
import {
  evaluationsRequired,
  pendingAnalyses,
  scorePending,
  type PendingAnalysis,
  type UnscoreableGame,
} from "@shared/blitz-analysis-queue";
import { attachAnalysis, isRefusal, type StoredBlitzRecord } from "@shared/blitz-record";
import { ENGINE_NAME, engineBuildId } from "@/lib/engine-identity";
import type { StockfishClient } from "@/lib/stockfish";

/**
 * How deep the post-game search goes.
 *
 * THE SAME CONSTANT `Blitz.tsx` USED, MOVED HERE because this is now the only caller. A stored
 * record carries the depth that produced its cp-losses, and a record claiming a depth the search
 * did not use is worse than one claiming nothing: the two are indistinguishable afterwards and
 * every comparison across builds would silently pool them.
 */
export const ANALYSIS_DEPTH = 12;

/**
 * HOW LONG ONE POSITION MAY TAKE BEFORE THE PASS GIVES UP ON THE WORKER.
 *
 * FOUND BY A TEST, AND IT IS A PRODUCTION DEFECT RATHER THAN A TEST ARTEFACT. `run()` returns the
 * in-flight promise so two callers share one pass; with no bound on an evaluation, a search that
 * never settles leaves `inFlight` non-null forever, and every later scan joins a promise that will
 * not resolve. The queue is then permanently wedged with pending games it will never look at —
 * which is LAW 4's failure exactly, reached through the mechanism meant to protect it.
 *
 * A HUNG SEARCH MEANS A WEDGED WORKER, so the recovery is to discard it rather than to wait longer.
 * R-09 established the same thing one level down: `StockfishClient` used to memoise a rejected
 * readiness promise, and the fix was to drop the client rather than retry against it.
 *
 * 30 SECONDS IS A BOUND, NOT A MEASUREMENT, and says so. With the wasm local the engine answers a
 * depth-12 search in well under a second — `uciok` alone was measured at 282 ms — so this is not a
 * budget for thinking. It is the point past which a worker is assumed broken, chosen generously
 * because the cost of being wrong is one wasted pass and the cost of being too generous is a
 * player waiting. The game stays `pending` either way, so a timeout loses nothing.
 */
export const EVALUATION_TIMEOUT_MS = 30_000;

/** What the runner needs from the record. Injected so a test drives it without a store. */
export interface AnalysisPort {
  listPending: () => Promise<{
    games: Parameters<typeof pendingAnalyses>[0];
    decisions: Parameters<typeof pendingAnalyses>[1];
  }>;
  /** The stored record for one game, assembled the way the wire expects it. */
  recordFor: (gameId: string) => Promise<StoredBlitzRecord | null>;
  attach: (record: StoredBlitzRecord) => Promise<unknown>;
  buildEngine: () => Promise<StockfishClient>;
}

export interface AnalysisProgress {
  /** Games still waiting, including the one in flight. */
  waiting: number;
  /** The game being scored, or null between games. */
  scoring: string | null;
  /** Evaluations done and required for the game in flight. Zero when nothing is in flight. */
  done: number;
  of: number;
}

export type ProgressListener = (progress: AnalysisProgress) => void;

const IDLE: AnalysisProgress = { waiting: 0, scoring: null, done: 0, of: 0 };

/**
 * The runner. One per page, created by `blitzAnalysisRunner()` below.
 *
 * A CLASS AND NOT A CLOSURE, so a test can construct its own with a fake port instead of reaching
 * past a module singleton. The singleton is a separate, three-line thing at the bottom.
 */
export class BlitzAnalysisRunner {
  /** Injectable so a test can drive the timeout without waiting thirty real seconds. */
  constructor(private readonly evaluationTimeoutMs: number = EVALUATION_TIMEOUT_MS) {}

  private inFlight: Promise<void> | null = null;
  private progress: AnalysisProgress = IDLE;
  private readonly listeners = new Set<ProgressListener>();
  /** Games the record cannot produce work for. Remembered so a scan does not rediscover them. */
  private readonly unscoreable = new Map<string, UnscoreableGame>();

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    listener(this.progress);
    return () => void this.listeners.delete(listener);
  }

  /** Games this runner has given up on, and why. Read by a screen that wants to say so. */
  giveUps(): UnscoreableGame[] {
    return [...this.unscoreable.values()];
  }

  /**
   * Score everything that is pending, then stop.
   *
   * RETURNS THE SAME PROMISE while a pass is in flight, which is the idempotence guard. It is not
   * a substitute for the store's own: `attachBlitzAnalysis` writes against
   * `WHERE analysis_state = 'pending'`, so a repeat across two tabs is still a no-op there. This
   * one stops a single tab doing the WORK twice, which the store cannot see.
   */
  run(port: AnalysisPort): Promise<void> {
    this.inFlight ??= this.pass(port).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async pass(port: AnalysisPort): Promise<void> {
    const { games, decisions } = await port.listPending();
    const work = pendingAnalyses(games, decisions);
    for (const give of work.unscoreable) this.unscoreable.set(give.gameId, give);

    const ready = work.ready.filter((p) => !this.unscoreable.has(p.gameId));
    if (ready.length === 0) {
      this.emit(IDLE);
      return;
    }

    /*
     * THE ENGINE IS BUILT HERE AND NOWHERE EARLIER — after the scan came back non-empty. A
     * `try/finally` releases it whether the pass finishes or throws, so a failed attach does not
     * leave a worker running for the rest of the session.
     */
    const engine = await port.buildEngine();
    try {
      let waiting = ready.length;
      for (const pending of ready) {
        await this.score(pending, engine, waiting, port);
        waiting -= 1;
      }
    } finally {
      /*
       * A TEARDOWN THAT THROWS MUST NOT REPLACE THE PASS'S OWN OUTCOME. An exception raised inside
       * `finally` discards the one propagating through it, so a client whose `dispose` failed would
       * hide the timeout or the write error that actually stopped the pass — and the caller would
       * be handed a message about teardown for a problem that had nothing to do with it.
       */
      try {
        engine.dispose();
      } catch {
        /* Releasing a worker is best effort; the pass's result is not. */
      }
      this.emit(IDLE);
    }
  }

  private async score(
    pending: PendingAnalysis,
    engine: StockfishClient,
    waiting: number,
    port: AnalysisPort,
  ): Promise<void> {
    const of = evaluationsRequired(pending);
    let done = 0;
    this.emit({ waiting, scoring: pending.gameId, done, of });

    const scored = await scorePending(pending, async (fen) => {
      const line = await withTimeout(
        engine.analyze(fen, ANALYSIS_DEPTH),
        this.evaluationTimeoutMs,
        fen,
      );
      done += 1;
      this.emit({ waiting, scoring: pending.gameId, done, of });
      return line.scoreCp ?? null;
    });
    if ("refused" in scored) return;

    /*
     * THE RECORD IS RE-READ RATHER THAN CARRIED. Between the scan and here the game may have been
     * scored by another tab, and `attachAnalysis` refuses a record whose rows have moved. Reading
     * it now means the join is checked against what is actually stored.
     */
    const record = await port.recordFor(pending.gameId);
    if (record === null) return;

    const complete = attachAnalysis(
      record,
      scored,
      record.game.playedAs,
      { engine: ENGINE_NAME, build: engineBuildId(), depth: ANALYSIS_DEPTH },
      new Date().toISOString(),
    );
    /*
     * A REFUSAL IS NOT A GIVE-UP. It means the stored rows and the scored rows disagree, which on
     * this path means somebody else changed the record underneath — so the game stays pending and
     * the next scan re-reads it. A give-up is reserved for a record that can never produce work.
     */
    if (isRefusal(complete)) return;
    await port.attach(complete);
  }

  private emit(progress: AnalysisProgress): void {
    this.progress = progress;
    for (const listener of this.listeners) listener(progress);
  }
}

/**
 * A promise, or a throw once the bound passes.
 *
 * IT THROWS RATHER THAN RESOLVING NULL, and the difference is what the record ends up saying. A
 * null score is "the evaluator could not answer for this position", which is a fact about a search
 * that ran; a wedged worker answered nothing about anything, and writing forty of those would fill
 * the record with a claim the engine never made. Throwing aborts the pass, the `finally` releases
 * the worker, and the game stays pending for a later pass with a fresh one.
 */
function withTimeout<T>(work: Promise<T>, ms: number, fen: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const bound = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`the engine did not answer for ${fen} within ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([work, bound]).finally(() => clearTimeout(timer)) as Promise<T>;
}

let singleton: BlitzAnalysisRunner | null = null;

/**
 * The page's runner.
 *
 * A SINGLETON BECAUSE LAW 4 IS ABOUT SURVIVING NAVIGATION, and a per-component runner would be
 * cancelled by exactly the navigation this exists to survive.
 *
 * THE PORT IS PASSED TO `run()`, NOT TO THE CONSTRUCTOR, and the first draft had it the other way.
 * A port captured once outlives the thing it closes over: signing in switches the record from the
 * browser to the server, and a runner holding the first port would have gone on scoring the local
 * store and writing analyses into a record the player had left. Per-run means every pass uses the
 * record that is current when it starts.
 */
export function blitzAnalysisRunner(): BlitzAnalysisRunner {
  singleton ??= new BlitzAnalysisRunner();
  return singleton;
}

/** Tests only: forget the singleton so each case starts from nothing. */
export function resetBlitzAnalysisRunner(): void {
  singleton = null;
}
