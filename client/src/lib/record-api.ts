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
import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LocalRecordStore,
  localRecordDurability,
  type RecordDurability,
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

const LOCAL_KEYS = {
  count: ["local-record", "count"] as const,
  claim: ["local-record", "claim"] as const,
  reading: ["local-record", "reading"] as const,
  learningRules: ["local-record", "learning-rules"] as const,
  hypothesis: ["local-record", "hypothesis"] as const,
  importReading: ["local-record", "import-reading"] as const,
};

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
  const serverStatus: RecordServerStatus = lost ? "server-lost" : measured;
  const local = serverStatus !== "usable" && serverStatus !== "server-lost";
  return { local, durability: local ? localRecordDurability() : "persistent", serverStatus };
}

function useStore(): LocalRecordStore {
  return useMemo(() => new LocalRecordStore(), []);
}

export function useCommitDecision() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.commitDecision.useMutation();
  return {
    mutateAsync: async (event: service.CommitEvent) => {
      if (!local) return server.mutateAsync(event as never);
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
export type CountView = { data: { decisions: number } | undefined; refetch: () => void };

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
  return { data: active.data, refetch: () => void active.refetch() };
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
