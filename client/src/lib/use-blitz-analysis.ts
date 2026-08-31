/**
 * THE HOOK THAT KEEPS THE QUEUE ALIVE, and the two things it is careful about.
 *
 * IT IS CHEAP UNTIL THERE IS WORK. Resuming a pending analysis on any page load is the point of
 * LAW 4, and a hook that pulled the runner and its engine into the entry chunk would make an empty
 * record pay for a feature only a blitz player uses. So the order is: a query for the stored games
 * (already on the entry route), a check for `analysisState === "pending"`, and only then a dynamic
 * import of the runner.
 *
 * IT DOES NOT OWN THE RUNNER. `blitzAnalysisRunner()` is a page-level singleton, so two screens
 * mounting this hook get the same one and the second `run()` joins the first pass rather than
 * starting a second. That is what lets `PostGame` and `ResumeScreen` both report progress without
 * either of them owning the work — which is LAW 3 at the level of a background job.
 */
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { LOCAL_KEYS, useAttachBlitzAnalysis, useRecordMode, useStore } from "@/lib/record-api";
import type { AnalysisPort, AnalysisProgress } from "@/lib/blitz-analysis-runner";
import type { StoredBlitzDecision, StoredBlitzGame, StoredBlitzRecord } from "@shared/blitz-record";

const IDLE: AnalysisProgress = { waiting: 0, scoring: null, done: 0, of: 0 };

/*
 * The local-mode keys live in `record-api.ts` beside the writes that invalidate them. A key defined
 * here would mean the two blitz mutations could not name it without importing their own reader.
 */
const LOCAL_GAMES = LOCAL_KEYS.blitzGames;
const LOCAL_DECISIONS = LOCAL_KEYS.blitzDecisions;

/**
 * The stored blitz GAMES, on whichever side the record lives.
 *
 * GAMES ONLY, AND THAT IS A DELIBERATE SPLIT. Deciding whether anything is pending needs the games;
 * building the work needs the decisions, which are an order of magnitude more rows. This hook runs
 * on every page load — that is what makes a pending analysis resumable — so it asks the cheap
 * question, and the port fetches the decisions only once there is something to score.
 */
function useBlitzGames(): StoredBlitzGame[] | undefined {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.blitzGames.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !local,
  });
  const localGames = useQuery({
    queryKey: LOCAL_GAMES,
    queryFn: () => store.listBlitzGames(),
    enabled: local,
    refetchOnWindowFocus: false,
  });
  return local ? localGames.data : server.data;
}

/** The rows for one game. Fetched by the screen that shows a game, not by every page load. */
function useBlitzRows(): { games: StoredBlitzGame[]; decisions: StoredBlitzDecision[] } | undefined {
  const { local } = useRecordMode();
  const store = useStore();
  const games = useBlitzGames();
  const serverDecisions = trpc.record.blitzDecisions.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !local,
  });
  const localDecisions = useQuery({
    queryKey: LOCAL_DECISIONS,
    queryFn: () => store.listBlitzDecisions(),
    enabled: local,
    refetchOnWindowFocus: false,
  });
  const decisions = local ? localDecisions.data : serverDecisions.data;
  if (!games || !decisions) return undefined;
  return { games, decisions };
}

/**
 * ONE STORED GAME, AS THE RECORD HAS IT.
 *
 * WHY A SCREEN READS THIS RATHER THAN KEEPING ITS OWN COPY (LAW 3). `Blitz.tsx` used to hold the
 * assembled record in state and patch it when its own analysis effect finished. That made the
 * screen the source of truth for whether a game had been scored — and the moment the analysis moved
 * to a queue that another page load can finish, the screen's copy would have been the one thing in
 * the product that could still say `pending` about a game that was complete.
 *
 * NULL WHILE THE ROWS ARE LOADING AND NULL FOR A GAME THAT IS NOT THERE, which a caller must
 * distinguish from a game with no decisions — hence `undefined` for "not read yet".
 */
export function useStoredBlitzRecord(gameId: string | null): StoredBlitzRecord | null | undefined {
  const rows = useBlitzRows();
  if (!rows) return undefined;
  if (!gameId) return null;
  const game = rows.games.find((g) => g.gameId === gameId);
  if (!game) return null;
  const decisions = rows.decisions
    .filter((d) => d.gameId === gameId)
    .sort((a, b) => a.ply - b.ply);
  return decisions.length === 0 ? null : { game, decisions };
}

/**
 * KEEP THE PENDING ANALYSES MOVING, and report where they are.
 *
 * RETURNS PROGRESS RATHER THAN A BOOLEAN, because the screens that use it have different jobs:
 * `PostGame` says "analysing", and `ResumeScreen` has to distinguish "the engine has not run" from
 * "the engine is running right now" — which are the same stored state and two different sentences.
 */
export function useBlitzAnalysis(): AnalysisProgress {
  const games = useBlitzGames();
  const { local } = useRecordMode();
  const store = useStore();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const attachAnalysis = useAttachBlitzAnalysis();
  const [progress, setProgress] = useState<AnalysisProgress>(IDLE);
  const hasPending = (games ?? []).some((g) => g.analysisState === "pending");

  /*
   * THE PORT IS REBUILT ON EVERY PASS, from the mode that is current right then. Capturing it once
   * would mean a player who signs in mid-session keeps scoring the browser's record and writing the
   * result into a store they have left. `blitzAnalysisRunner()` takes it per run for that reason.
   */
  const port = useCallback(
    (): AnalysisPort => ({
      listPending: async () =>
        local
          ? { games: await store.listBlitzGames(), decisions: await store.listBlitzDecisions() }
          : {
              games: await utils.record.blitzGames.fetch(),
              decisions: await utils.record.blitzDecisions.fetch(),
            },
      recordFor: async (gameId) => {
        const games = local ? await store.listBlitzGames() : await utils.record.blitzGames.fetch();
        const game = games.find((g) => g.gameId === gameId);
        if (!game) return null;
        const all = local
          ? await store.listBlitzDecisions()
          : await utils.record.blitzDecisions.fetch();
        const decisions = all
          .filter((d) => d.gameId === gameId)
          .sort((a, b) => a.ply - b.ply);
        /*
         * A GAME WITH NO DECISIONS IS NOT A RECORD. `storedBlitzRecordSchema` requires at least one,
         * and assembling an empty one here would push the refusal out to the wire, far from the
         * scan that could have reported it as unscoreable.
         */
        return decisions.length === 0 ? null : { game, decisions };
      },
      attach: (record) => attachAnalysis.mutateAsync(record),
      buildEngine: async () => {
        const { StockfishClient } = await import("@/lib/stockfish");
        return new StockfishClient(() => {});
      },
    }),
    [local, store, utils, attachAnalysis],
  );

  useEffect(() => {
    if (!hasPending) return;
    let live = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const { blitzAnalysisRunner } = await import("@/lib/blitz-analysis-runner");
      if (!live) return;
      const runner = blitzAnalysisRunner();
      unsubscribe = runner.subscribe((next) => {
        if (live) setProgress(next);
      });
      await runner.run(port());
      /*
       * THE ROWS ARE REFETCHED AFTER A PASS, so the screens reading them see `complete` rather than
       * a stale `pending`. Without it a player would watch the progress finish and the sentence
       * above it keep saying the engine had not run.
       */
      if (!live) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOCAL_GAMES }),
        queryClient.invalidateQueries({ queryKey: LOCAL_DECISIONS }),
        queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.blitzReading }),
        local
          ? Promise.resolve()
          : Promise.all([
              utils.record.blitzGames.invalidate(),
              utils.record.blitzDecisions.invalidate(),
              utils.record.blitzReading.invalidate(),
            ]),
      ]);
    })();
    return () => {
      live = false;
      unsubscribe?.();
    };
    /*
     * `hasPending` AND NOT `rows`, so a refetch that returns the same games does not restart a pass.
     * The runner's own guard would join the in-flight promise anyway; this keeps the effect from
     * churning subscriptions on every query settle.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPending]);

  return progress;
}
