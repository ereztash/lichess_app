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
import { LocalRecordStore, localRecordAvailable } from "@/lib/local-record-store";
import { trpc } from "@/lib/trpc";
import * as service from "@shared/record-service";
import type { DecisionAtom, DecisionResult } from "@shared/decision-atom";

const LOCAL_KEYS = {
  count: ["local-record", "count"] as const,
  claim: ["local-record", "claim"] as const,
};

/**
 * Which backing is in use, and whether it can actually hold anything.
 *
 * A session is NOT sufficient to use the server: the server store throws when DATABASE_URL is
 * unset, so signing in on a deployment without a database moved a working local record onto a
 * broken server one and the loop stopped. Having a session and having storage are different
 * facts. The server is used only when it says it can store; otherwise the record stays local,
 * signed in or not.
 */
export function useRecordMode(): { local: boolean; storable: boolean; serverBroken: boolean } {
  const { isAuthenticated } = useAuth();
  const probe = trpc.record.storageAvailable.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  // Until the probe answers, treat the server as unusable. Guessing the other way would send
  // the first decision of a session into a store that may reject it.
  const serverUsable = isAuthenticated && probe.data?.available === true;
  const serverBroken = isAuthenticated && (probe.data?.available === false || probe.isError);
  const local = !serverUsable;
  return { local, storable: local ? localRecordAvailable() : true, serverBroken };
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
      return out;
    },
  };
}

export function useReveal() {
  const { local } = useRecordMode();
  const store = useStore();
  const queryClient = useQueryClient();
  const server = trpc.record.reveal.useMutation();
  return {
    mutateAsync: async (input: { decision_id: string; result: DecisionResult }): Promise<DecisionAtom> => {
      if (!local) return server.mutateAsync(input as never);
      const atom = await service.reveal(store, input.decision_id, input.result);
      await queryClient.invalidateQueries({ queryKey: LOCAL_KEYS.claim });
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

/** Only what the callers read. Exposing the query object would drag in two error types. */
export type CountView = { data: { decisions: number } | undefined; refetch: () => void };

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
