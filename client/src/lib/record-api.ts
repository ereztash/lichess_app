/**
 * One record API, two backings.
 *
 * Signed in, the loop runs on the server against MySQL. Not signed in, it runs in this browser
 * against localStorage. Both go through `shared/record-service.ts`, so R3 (no reveal before a
 * commit), R5 (the refutation condition is stored before the drill runs) and append-only hold
 * identically -- they are not re-implemented for the local path.
 *
 * The local path exists because every record procedure is `protectedProcedure` and sign-in needs
 * an OAuth portal a deployment may not have. Without it the product is unusable rather than
 * degraded: the board takes a move and then cannot record the decision.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StoredBlitzRecord } from "@shared/blitz-record";
import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LocalRecordStore,
  localRecordDurability,
  type RecordDurability,
  setLocalRecordIdentity,
} from "@/lib/local-record-store";
import { trpc } from "@/lib/trpc";
import * as service from "@shared/record-service";
import type { PreregisteredHypothesis } from "@shared/prereg";
import type { StoredImportDiagnostic } from "@shared/import-diagnostic";
import type { DecisionAtom, DecisionResult } from "@shared/decision-atom";
import type {
  LearningRuleDraft,
  LearningTransferObservation,
  ReflectionDraft,
} from "@shared/learning-record";

export const LOCAL_KEYS = {
  count: ["local-record", "count"] as const,
  claim: ["local-record", "claim"] as const,
  reading: ["local-record", "reading"] as const,
  learningRules: ["local-record", "learning-rules"] as const,
  hypothesis: ["local-record", "hypothesis"] as const,
  importReading: ["local-record", "import-reading"] as const,
  /* Used by `blitz-reading-api.ts`, which is deliberately not in this module -- see its header. */
  blitzReading: ["local-record", "blitz-reading"] as const,
  /*
   * The raw blitz rows, read by `use-blitz-analysis.ts`. Here rather than there because the two
   * blitz WRITES have to invalidate them, and a key defined in the module that reads it would mean
   * the writes could not name it without importing their own reader.
   */
  blitzGames: ["local-record", "blitz-games"] as const,
  blitzDecisions: ["local-record", "blitz-decisions"] as const,
};

/**
 * Everything a blitz write makes stale, in one list.
 *
 * NAMED ONCE BECAUSE THE FAILURE IS SILENT. A write that forgets one of these leaves a screen
 * reading a row that no longer exists — and the specific case that caught it was the analysis
 * queue: the pending write did not invalidate the games query, so `hasPending` stayed false and
 * the queue never started. Nothing errored. The game simply stayed pending forever.
 */
const BLITZ_KEYS = [LOCAL_KEYS.blitzGames, LOCAL_KEYS.blitzDecisions, LOCAL_KEYS.blitzReading];

/**
 * Which backing is in use, whether it can hold anything, and WHY NOT when it cannot.
 *
 * A session is NOT sufficient to use the server: the server store throws when DATABASE_URL is
 * unset, so signing in on a deployment without a database moved a working local record onto a
 * broken server one and the loop stopped. Having a session and having storage are different
 * facts. The server is used only when it says it can store; otherwise the record stays local,
 * signed in or not.
 *
 * ONE BOOLEAN WAS NOT ENOUGH, AND THAT WAS THE DEFECT. `ownerProcedure` deliberately answers a
 * refused visitor and an unconfigured deployment differently -- FORBIDDEN and PRECONDITION_FAILED,
 * with two written messages, because one is a browser session and the other is a server the owner
 * has to configure. `serverBroken` collapsed those, plus a dropped connection, into the single
 * sentence "the server has no DATABASE_URL". A person who had been REFUSED was told the database
 * was missing: a cause the client had not measured, reported in place of the one it was handed.
 */
export type RecordServerStatus =
  /** Nobody is signed in. The local record is the intended path, not a fallback. */
  | "signed-out"
  /** The probe has not answered. Nothing about the server is known yet. */
  | "unknown"
  /** The server holds the record. */
  | "usable"
  /** Signed in, past the gate, and the store reports no database behind it. */
  | "no-database"
  /** FORBIDDEN: the record belongs to the account named by OWNER_OPEN_ID, and this is not it. */
  | "not-this-account"
  /** PRECONDITION_FAILED: the deployment never named an owner, so no account can pass. */
  | "no-owner-configured"
  /**
   * The server is answering, and this session already wrote into the browser record.
   *
   * Not a failure. It says the record stays where this session's decisions went, because moving
   * back would make them unreadable with nothing on screen saying so.
   */
  | "kept-local"
  /** The request failed without saying why. Naming a cause here would be the original defect. */
  | "unreachable"
  /**
   * The server WAS holding this account's record in this session and has stopped answering.
   *
   * Distinct from every cause above because the response is different: the record stays pointed
   * at the server and the failure is reported, rather than the loop quietly continuing against a
   * different store. See `confirmedServerRecords`.
   */
  | "server-lost";

/**
 * Accounts whose record this session has seen the server actually hold.
 *
 * A FAILURE MODE THIS BRANCH INTRODUCED. Until `isAvailable()` measured a live connection it read
 * an environment variable, and an environment variable does not change while somebody is playing,
 * so this hook could not flip mid-session. Now it can: `storageAvailable` has `retry: false` and
 * react-query's `refetchOnReconnect` default is ON, so the probe re-runs exactly when the network
 * has just been flaky and one failed attempt decides it.
 *
 * The flip switches every read hook -- claim, reading, count, learning rules -- in a single
 * render, and the player watches their record shrink to whatever this browser holds. The next
 * commit then lands in localStorage while the earlier ones sit on the server: one record, two
 * stores, nothing said. R2 already covers the shape of this ("a record that could not be READ
 * must not render as a record with nothing in it"); rendering it as a DIFFERENT, smaller record
 * is the same violation with a worse ending, because this one also accepts writes.
 *
 * So the fallback is DIRECTIONAL. Starting local and staying local is the product working as
 * designed and must keep working -- a deployment with no database is supported. Starting on the
 * server and silently landing local is data loss dressed as graceful degradation.
 *
 * Keyed by account, because the next person at this keyboard has no server record to lose and
 * belongs on the local path. Module scope rather than state: it is not rendered, and every writer
 * writes the same value, so it cannot drive a render loop.
 */
const confirmedServerRecords = new Set<string>();

/** Test seam. Nothing in the product clears this -- a session ends by the tab closing. */
export function forgetConfirmedServerRecords(): void {
  confirmedServerRecords.clear();
}

/**
 * Accounts that have WRITTEN into this browser's record during this session.
 *
 * THE MIRROR OF THE LATCH ABOVE, AND IT WAS MISSING. `confirmedServerRecords` blocks
 * server -> local. Nothing blocked local -> server: the latch is written only on success and read
 * only for the usable -> failure transition, so a signed-in session whose probe failed once
 * recorded into localStorage UNDER AN EXPLICIT ON-SCREEN PROMISE that it was doing so -- and when
 * the probe recovered, every read and every write moved back to the server. No notice, because
 * `RecordModeNotice` returns null the moment the status is `usable`. No merge, because no
 * migration code exists.
 *
 * The decisions are not deleted -- `LocalRecordStore` keeps one browser-wide key, so a later
 * local-mode session renders them. They are invisible whenever the server is healthy, which is
 * the same violation this file's other note names: a record that could not be read must not
 * render as a different, smaller record.
 *
 * Keyed by account for the same reason as its mirror, and module scope for the same reason: it is
 * not rendered, and every writer writes the same value.
 */
const keptLocalRecords = new Set<string>();

/**
 * Say that this account has written into the browser record in this session.
 *
 * Called from the write paths rather than from the store, because the store is constructed on
 * every render whether or not anything is written through it.
 */
export function markKeptLocally(openId: string | null | undefined): void {
  if (openId) keptLocalRecords.add(openId);
}

/** Test seam, like `forgetConfirmedServerRecords`. */
export function forgetKeptLocalRecords(): void {
  keptLocalRecords.clear();
}

/**
 * The reason, from the error the tRPC client was handed.
 *
 * `data.code` is what the server sends; `httpStatus` is read as a fallback so a transport that
 * loses the envelope still distinguishes 403 from 412 rather than falling back to "unreachable"
 * -- but anything unrecognised stays unnamed on purpose.
 */
function statusFromError(error: unknown): RecordServerStatus {
  const data = (error as { data?: { code?: string; httpStatus?: number } } | null)?.data;
  const code = data?.code ?? { 403: "FORBIDDEN", 412: "PRECONDITION_FAILED" }[data?.httpStatus ?? 0];
  if (code === "FORBIDDEN") return "not-this-account";
  if (code === "PRECONDITION_FAILED") return "no-owner-configured";
  return "unreachable";
}

export function useRecordMode(): {
  local: boolean;
  /** How long a locally-kept decision survives. Always "persistent" on the server path. */
  durability: RecordDurability;
  serverStatus: RecordServerStatus;
} {
  const { user, isAuthenticated } = useAuth();
  const probe = trpc.record.storageAvailable.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  // Until the probe answers, treat the server as unusable. Guessing the other way would send
  // the first decision of a session into a store that may reject it.
  const measured: RecordServerStatus = !isAuthenticated
    ? "signed-out"
    : probe.isError
      ? statusFromError(probe.error)
      : probe.data === undefined
        ? "unknown"
        : probe.data.available
          ? "usable"
          : "no-database";
  const openId = user?.openId ?? null;
  if (measured === "usable" && openId) confirmedServerRecords.add(openId);
  // A record the server was holding does not move into this browser because one probe failed.
  const lost =
    measured !== "usable" && openId !== null && confirmedServerRecords.has(openId);
  /*
   * AND A RECORD THIS SESSION WROTE HERE STAYS HERE.
   *
   * Symmetric with `lost` above. Once decisions have gone into this browser under the promise
   * that they were, a recovered probe must not quietly point every read and write at the server
   * and leave them unreadable -- which is the same "the record changed underneath you" failure,
   * running the other way.
   */
  const keptHere = measured === "usable" && openId !== null && keptLocalRecords.has(openId);
  const serverStatus: RecordServerStatus = lost
    ? "server-lost"
    : keptHere
      ? "kept-local"
      : measured;
  const local = serverStatus !== "usable" && serverStatus !== "server-lost";
  return { local, durability: local ? localRecordDurability() : "persistent", serverStatus };
}

/**
 * The browser-side store, pointed at the signed-in account's record.
 *
 * WHY THE IDENTITY IS SET HERE. `LocalRecordStore` holds its state in module scope -- a store is
 * constructed per hook, so per-instance state would give each hook a private record -- which
 * means the account has to be told to the module rather than to the object. This hook is the one
 * place every local-mode read and write passes through.
 *
 * DURING RENDER RATHER THAN IN AN EFFECT, and that is the point: an effect runs AFTER the render
 * that used the store, so the first read of a session would come off the previous account's key.
 * The call is idempotent and returns immediately when the identity has not changed, so it is safe
 * on every render -- and this is a pointer, not a fetch: nothing is written and nothing is read
 * until a hook below asks.
 */
export function useStore(): LocalRecordStore {
  const { user } = useAuth();
  setLocalRecordIdentity(user?.openId ?? null);
  return useMemo(() => new LocalRecordStore(), []);
}

export function useCommitDecision() {
  const { local } = useRecordMode();
  const { user } = useAuth();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.commitDecision.useMutation();
  return {
    mutateAsync: async (event: service.CommitEvent) => {
      if (!local) return server.mutateAsync(event as never);
      /*
       * SAID BEFORE THE WRITE, so a probe that recovers while this is in flight cannot move the
       * next read to the server ahead of the mark. A decision is the anchor of the record: reveals,
       * rules and drills all hang off one, so marking here covers what would become unreadable.
       */
      markKeptLocally(user?.openId);
      const out = await service.commitDecision(store, event);
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.count });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.claim });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.reading });
      return out;
    },
  };
}

/**
 * The answer to "what would you have played instead", stored before the engine runs.
 *
 * Invalidates nothing: the reading it feeds does not exist until the alternative has been scored
 * at reveal, and refetching a dashboard here would refetch it for a decision that is still
 * mid-flight.
 */
export function useRecordCounterfactual() {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.recordCounterfactual.useMutation();
  return {
    mutateAsync: async (input: { decision_id: string; alternative: string | null }) => {
      if (!local) return server.mutateAsync(input);
      return service.recordCounterfactual(store, input.decision_id, input.alternative);
    },
  };
}

export function useReveal() {
  const { local } = useRecordMode();
  const { user } = useAuth();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.reveal.useMutation();
  return {
    mutateAsync: async (input: {
      decision_id: string;
      result: DecisionResult;
      alternative_cp_loss?: number | null;
    }): Promise<DecisionAtom> => {
      if (!local) return server.mutateAsync(input as never);
      // Marked here as well as on the commit: a session that resumes a game committed earlier can
      // reach a reveal first, and the reveal is what makes a decision countable.
      markKeptLocally(user?.openId);
      const atom = await service.reveal(
        store,
        input.decision_id,
        input.result,
        input.alternative_cp_loss,
      );
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.claim });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.reading });
      return atom;
    },
  };
}

export function useStartDrill() {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.startDrill.useMutation();
  return {
    mutateAsync: async (input: { claim_id: string; candidate_fens: string[] }) => {
      if (!local) return server.mutateAsync(input);
      return service.beginDrill(store, input, {
        drill_id: `drill-${crypto.randomUUID()}`,
        started_at: new Date().toISOString(),
      });
    },
  };
}

export function useCompleteDrill() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.completeDrill.useMutation();
  return {
    mutateAsync: async (input: { drill_id: string; decision_ids: string[] }) => {
      if (!local) return server.mutateAsync(input);
      const out = await service.finishDrill(store, input, {
        recorded_at: new Date().toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.claim });
      return out;
    },
  };
}

export function useCreateLearningRule() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.createLearningRule.useMutation();
  return {
    mutateAsync: async (input: { reflection: ReflectionDraft; rule: LearningRuleDraft }) => {
      const out = !local
        ? await server.mutateAsync(input)
        : await service.createLearningRule(store, input, {
            rule_id: `rule-${crypto.randomUUID()}`,
            created_at: new Date().toISOString(),
          });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.learningRules });
      return out;
    },
  };
}

export function useLearningRules() {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.learningRules.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !local,
  });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.learningRules,
    queryFn: () => service.learningRules(store),
    enabled: local,
    refetchOnWindowFocus: false,
  });
  const active = local ? localQuery : server;
  return {
    data: active.data,
    isLoading: active.isLoading,
    isError: active.isError,
    refetch: () => void active.refetch(),
  };
}

export function useStartLearningTransfer() {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.startLearningTransfer.useMutation();
  return {
    mutateAsync: async (input: { rule_id: string; candidate_fens: string[] }) => {
      if (!local) return server.mutateAsync(input);
      return service.beginLearningTransfer(store, input, {
        transfer_id: `transfer-${crypto.randomUUID()}`,
        started_at: new Date().toISOString(),
      });
    },
  };
}

/**
 * Record one position's observation, at the moment it is made.
 *
 * Both paths write it down immediately -- the local store as well as the server. Holding these in
 * component state for the length of a run is what lost them on a reload, stranded a run whose
 * reveal write failed, and left the client as their only holder at completion.
 */
export function useRecordTransferObservation() {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.recordTransferObservation.useMutation();
  return {
    mutateAsync: async (input: {
      transfer_id: string;
      observation: LearningTransferObservation;
    }) =>
      !local
        ? server.mutateAsync(input)
        : service.recordLearningTransferObservation(store, input),
  };
}

export function useCompleteLearningTransfer() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.completeLearningTransfer.useMutation();
  return {
    // A transfer id and nothing else. The observations are read from the record, so there is no
    // longer a call that can report a test the player did not sit.
    mutateAsync: async (input: { transfer_id: string }) => {
      const out = !local
        ? await server.mutateAsync(input)
        : await service.finishLearningTransfer(store, input, {
            completed_at: new Date().toISOString(),
          });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.learningRules });
      return out;
    },
  };
}

export function useRetireLearningRule() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.retireLearningRule.useMutation();
  return {
    mutateAsync: async (input: { rule_id: string }) => {
      const out = !local
        ? await server.mutateAsync(input)
        : await service.retireLearningRule(store, input, {
            retired_at: new Date().toISOString(),
          });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.learningRules });
      return out;
    },
  };
}

/** Only what the callers read. Exposing the query object would drag in two error types. */
export type CountView = {
  data: { decisions: number } | undefined;
  refetch: () => void;
  /**
   * The count as the record holds it NOW, awaited at the point of use. `null` where it could not
   * be read.
   *
   * WHY THIS EXISTS RATHER THAN `data`. `data` is a cache, and a caller that needs the count of a
   * record it has just written to cannot use a cache: it does not know whether the value it is
   * holding was read before or after its own write. `Home.tsx` compensated for that with `+ 1` --
   * correct exactly while the query was one refetch behind, and wrong the moment anything landed a
   * refetch in the window. Measured on the built app: four decisions, and the reveal said
   * `1, 2, 4, 4`.
   *
   * `null` IS NOT ZERO AND IS NOT A COUNT. A read that failed is a state the caller has to decide
   * about; returning `0` would hand it a number the record does not claim.
   */
  countNow: () => Promise<number | null>;
  /**
   * `countForReveal` bound to this view. The rule is there; this is how a caller reaches it.
   *
   * A METHOD RATHER THAN AN IMPORT AT THE CALL SITE, and the reason is a ratchet rather than a
   * preference: `Home.tsx` is held to a line ceiling that `MASTER_PRODUCT_DEBT.md` R-13 says may
   * only go down, and an import line is a line. The rule stays a free function so it can be tested
   * against a literal without rendering anything.
   */
  forReveal: () => Promise<number>;
};

/**
 * Register the bucket an import named, before the live loop records anything (shared/prereg.ts).
 *
 * `decisions_before` is NOT sent. The service reads it from the store, because a caller that
 * could choose the boundary could choose zero and have the hypothesis tested on the very
 * decisions that suggested it. Same rule on both paths, which is the point of routing the local
 * store through the same service function the server calls.
 */
export function useRegisterHypothesis() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.registerHypothesis.useMutation();
  return {
    mutateAsync: async (input: Omit<PreregisteredHypothesis, "decisions_before">) => {
      const out = !local
        ? await server.mutateAsync(input)
        : await service.registerHypothesis(store, input);
      // The claim view changes shape once a hypothesis exists -- it narrows the search -- so the
      // cached answer from before the import is now the wrong answer, not a stale one.
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.claim });
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.hypothesis });
      return out;
    },
  };
}

/**
 * Keep a scan's reading, and read the kept one back.
 *
 * The reading used to live in a `useState` inside the import overlay, so closing it discarded a
 * 43-second scan and the only way back was to run it again. These two hooks are the whole reason
 * the panel can be reopened.
 *
 * `scanned_at` is not sent: the service stamps it, for the same reason it owns `decisions_before`
 * on the hypothesis above.
 */
export function useSaveImportReading() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.saveImportReading.useMutation();
  return {
    mutateAsync: async (input: Omit<StoredImportDiagnostic, "scanned_at">) => {
      const out = !local
        ? await server.mutateAsync(input)
        : await service.saveImportReading(store, input);
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.importReading });
      return out;
    },
  };
}

/**
 * Keep one finished, analysed blitz game.
 *
 * SAME LOCAL/SERVER SPLIT AS EVERY OTHER WRITE HERE. A blitz game is not a special case of storage
 * just because it is a special case of measurement, and giving it its own path would mean a player
 * in local mode silently kept nothing.
 */
export function useSaveBlitzGame() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const server = trpc.record.saveBlitzGame.useMutation();
  return {
    mutateAsync: async (input: StoredBlitzRecord) => {
      const result = !local
        ? await server.mutateAsync(input)
        : await service.saveBlitzGame(store, input);
      await invalidateBlitz(queryClient, utils, local);
      return result;
    },
  };
}

/**
 * Mark every blitz reading stale, on whichever side the record lives.
 *
 * BOTH SIDES ALWAYS, not the active one: signing in mid-session leaves the other side's cache in
 * place, and a screen that switched back would read a row from before the write.
 */
async function invalidateBlitz(
  queryClient: ReturnType<typeof useQueryClient>,
  utils: ReturnType<typeof trpc.useUtils>,
  local: boolean,
): Promise<void> {
  await Promise.all([
    ...BLITZ_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    local
      ? Promise.resolve()
      : Promise.all([
          utils.record.blitzGames.invalidate(),
          utils.record.blitzDecisions.invalidate(),
          utils.record.blitzReading.invalidate(),
        ]),
  ]);
}

/**
 * The second write: the engine's verdict over a game that is already stored.
 *
 * Separate from `useSaveBlitzGame` because they are different operations with different
 * guarantees -- the first refuses a repeat, the second refuses anything that is not pending.
 */
export function useAttachBlitzAnalysis() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const server = trpc.record.attachBlitzAnalysis.useMutation();
  return {
    mutateAsync: async (input: StoredBlitzRecord) => {
      const result = !local
        ? await server.mutateAsync(input)
        : await service.attachBlitzAnalysis(store, input);
      await invalidateBlitz(queryClient, utils, local);
      return result;
    },
  };
}

/** The newest kept reading, or null. `null` and "still loading" are different states (4.5). */
export function useImportReading(): { reading: StoredImportDiagnostic | null; loading: boolean } {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.importReading.useQuery(undefined, { retry: false, enabled: !local });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.importReading,
    queryFn: () => service.getImportReading(store),
    enabled: local,
  });
  const active = local ? localQuery : server;
  return { reading: active.data ?? null, loading: active.isLoading };
}

/**
 * The number of decisions the reveal may claim are on the record, including the one being revealed.
 *
 * WHY THIS IS A FUNCTION AND NOT `data + 1` AT THE CALL SITE. `Home.tsx` built it as
 * `(decisionCount.data?.decisions ?? 0) + 1` -- the cached count, plus one for the decision being
 * revealed. `onCommit` awaits the write and returns on failure before the engine is ever asked, so
 * by the time the reveal is assembled that decision is ALREADY on the record and the number wanted
 * is simply the number the record holds. `+ 1` produced it only while the query had not caught up.
 *
 * AND WHETHER IT HAD CAUGHT UP WAS THE COUNTERFACTUAL PROBE'S ARM, not a race. `useCommitDecision`
 * above invalidates `LOCAL_KEYS.count` immediately after the write, so:
 *
 *   NOT-PROBED  `onCommit` calls `runReveal` inside the closure it was created in. `data` is still
 *               `k-1` there and `+ 1` lands on `k`. Right, by accident.
 *   PROBED      `onCommit` returns, the invalidated count refetches, React re-creates `runReveal`
 *               (`decisionCount` is in its dependency array), and `onAnswerProbe` calls the LATER
 *               closure, where `data` is already `k`. `+ 1` prints `k+1`.
 *
 * MEASURED ON THE BUILT APP BEFORE THIS EXISTED: 8 of 8 probed runs wrong, 18 of 18 not-probed runs
 * right -- 26 runs, 26/26 agreement with the arm. A probed FIRST decision was told
 * `נרשמו 2 החלטות`, which is also `זו החלטה אחת שנרשמה` not rendering at all, so at `k=1` the
 * defect crossed a copy branch and not only a digit. A four-decision walk read `1, 2, 4, 4`.
 *
 * THE RACE WAS THE FIRST EXPLANATION AND IT IS FALSIFIED, recorded here so it is not re-derived:
 * `useDecisionCount` is one of two reads in this file without `refetchOnWindowFocus: false`, which
 * made a focus refetch look like the cause. It is not. 50-56 synthetic focus events dispatched
 * across the engine wait produced the CORRECT sentence on 5 of 5 not-probed runs: nothing can reach
 * a closure that has already been frozen, and on the probed arm the invalidation had already done
 * the refetching. Adding `refetchOnWindowFocus: false` would have changed nothing.
 *
 * THE FALLBACK IS THE OLD ARITHMETIC, AND ITS LIMITS ARE STATED HERE RATHER THAN ASSUMED AWAY.
 * An earlier version of this paragraph said `data` is "the last value that DID read, which is the
 * count before this decision". That is true on the NOT-PROBED arm and false on the probed one --
 * the paragraph above states that on the probed arm `data` is already `k`. So the fallback is
 * arm-blind, and on the arm every one of the measured failures came from it reproduces the original
 * defect exactly. It is not a safe estimate. It is the old rule, kept only where nothing better
 * exists.
 *
 * AND IT IS UNREACHABLE ON THE PATH THIS PRODUCT ACTUALLY SERVES. On the local path `countNow` calls
 * `service.countDecisions(store)`, and `LocalRecordStore.read()` can neither throw nor return
 * undefined: a `localStorage` that throws, a blob that is not JSON, and a blob from a newer build
 * all resolve through `refuse()`/`empty()` to a `Persisted` carrying a `decisions` array. The store
 * collapses the null-versus-zero distinction before `countNow` can see it, and every production
 * arrival takes the local path because production configures no database. The fallback is dead code
 * there, and the day it stops being dead is the day the arm-blindness above starts to matter.
 *
 * IT IS AWAITED AT THE CAPTURE AND NOT STARTED EARLIER, AND THAT PUTS IT ON THE REVEAL'S PATH.
 * On the local path this is a `localStorage` read through a disabled-server query: it cannot hang,
 * and it is every production arrival, because production configures no database. On the server path
 * it is a request, and a request on the reveal's path is a request that can delay a verdict the
 * player already waited seconds for. `retry: false` bounds the retries and nothing bounds the wait.
 *
 * THE REVERSAL CONDITION IS A DEPLOYED SERVER RECORD, AND IT IS WORSE THAN A DELAY. `main.tsx`
 * configures `httpBatchLink` with no timeout and no `AbortSignal`, so a hung `/api/trpc` makes
 * `refetch()` never settle, `forReveal()` never resolve and the reveal never assemble -- and no
 * failure branch fires, because nothing threw. Not a slow verdict: a lost one.
 *
 * So the day `DATABASE_URL` is configured in production, two things change together and neither is
 * optional: this await is hoisted to the top of `runReveal` so it overlaps the engine search, and
 * the read is bounded so a hung request cannot hold the reveal. `Home.tsx` needs one line freed for
 * the hoist, and `void decisionCount.refetch()` after the reveal is the candidate -- this function
 * already refetches, and it does it earlier.
 */
export async function countForReveal(count: CountView): Promise<number> {
  return (await count.countNow()) ?? (count.data?.decisions ?? 0) + 1;
}

export function useDecisionCount(): CountView {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.count.useQuery(undefined, { retry: false, enabled: !local });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.count,
    queryFn: () => service.countDecisions(store),
    enabled: local,
  });
  const active = local ? localQuery : server;
  const view: CountView = {
    data: active.data,
    refetch: () => void active.refetch(),
    /*
     * THE RESULT OF THE REFETCH, NOT `active.data` AFTER IT. `data` on this object is the value
     * captured when the component last rendered; awaiting a refetch does not change it, and a
     * caller reading it back would get the same stale number it started with. The promise carries
     * the fresh one.
     *
     * IT RESOLVES, ALWAYS, AND THAT IS LOAD-BEARING RATHER THAN DEFENSIVE. This is awaited inside
     * the block that assembles the reveal, so a rejection would cost the player the verdict they
     * waited seconds for because a number beside it could not be read. A count that cannot be read
     * is `null`. It is not an exception, and it is not a reason to lose a reveal.
     */
    countNow: async () => {
      try {
        return (await active.refetch()).data?.decisions ?? null;
      } catch {
        return null;
      }
    },
    forReveal: () => countForReveal(view),
  };
  return view;
}

export type ClaimQueryView = {
  data: service.ClaimView | undefined;
  isLoading: boolean;
  isError: boolean;
  /** R2: a record that could not be READ must not render as a record with nothing in it. */
  errorMessage: string;
};

export function useClaimView(): ClaimQueryView {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.claim.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !local,
  });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.claim,
    queryFn: () => service.currentClaim(store, { created_at: new Date().toISOString() }),
    enabled: local,
    refetchOnWindowFocus: false,
  });
  const active = local ? localQuery : server;
  return {
    data: active.data,
    isLoading: active.isLoading,
    isError: active.isError,
    errorMessage: active.error?.message ?? "סיבה לא ידועה.",
  };
}

export type ReadingView = {
  data: service.RecordReading | undefined;
  isLoading: boolean;
  isError: boolean;
};

/** The record dashboard, from whichever store is in use. */
export function useRecordReading(): ReadingView {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.reading.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !local,
  });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.reading,
    queryFn: () => service.recordReading(store),
    enabled: local,
    refetchOnWindowFocus: false,
  });
  const active = local ? localQuery : server;
  return { data: active.data, isLoading: active.isLoading, isError: active.isError };
}
