/**
 * THE OPEN RUN AND THE UNTESTED RULE, SUBSCRIBED FROM OUTSIDE THE ENTRY GRAPH.
 *
 * WHY THIS IS A MODULE AND NOT THREE LINES IN `record-api.ts`. `record-api.ts` is imported by
 * `Record.tsx`, which is the entry route -- so anything reachable from it is downloaded by every
 * arrival before anything renders. On the SHA this was split out, the raw entry ceiling had **0.2
 * kB** of room and the initial-download ceiling had **0.0 kB**; putting the hook there measured
 * **+2.0 kB** and broke both.
 *
 * IT IS THE SAME SPLIT, FOR THE SAME REASON, AS `blitz-reading-api.ts`, whose header says so in as
 * many words: a reading only the lazy surfaces need does not belong in the chunk every visitor
 * downloads. The three callers of this hook are `ResumeScreen` (lazy from `Record.tsx`),
 * `NextActionProbe` (lazy from `Record.tsx`) and `PostGame` (inside the lazy `/blitz` route). None
 * of them is eager, so none of these bytes are.
 *
 * WHAT IS DELIBERATELY LEFT BEHIND IN `record-api.ts`: `LOCAL_KEYS.continuation` and
 * `invalidateContinuation`. The key has to be namable by the WRITES -- starting a drill, recording
 * an observation, finishing a transfer -- and those are on paths the entry chunk genuinely holds. A
 * key defined where it is read would mean the writes could not name it without importing their own
 * reader, which is the argument `LOCAL_KEYS.blitzGames` already makes one comment over.
 */
import { useQuery } from "@tanstack/react-query";
import { continuationReading } from "@shared/continuation";
import { LOCAL_KEYS, useRecordMode, useStore } from "@/lib/record-api";
import { trpc } from "@/lib/trpc";

/**
 * THE RUN IN PROGRESS AND THE UNTESTED RULE, which used to be nowhere a screen could reach.
 *
 * ONE QUERY FOR THREE CANONICAL BRANCHES. `continue-drill`, `continue-transfer` and
 * `test-hypothesis` are the top of `deriveNextAction`'s ladder and every one of them was fabricated
 * as `null` in `productStateFor` -- so the derivation could only ever propose the bottom of its own
 * order. This is the read that makes the top of it reachable.
 *
 * `isLoading` IS PART OF THE ANSWER AND CALLERS MUST USE IT. A reading in flight is not a record
 * with no run in it, and the difference is exactly what `Observed` exists to carry: a caller that
 * passed `data?.active ?? null` while the query was still going would be telling the derivation
 * that no drill is open on the authority of a request that had not come back.
 */
export function useContinuation() {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.continuation.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !local,
  });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.continuation,
    queryFn: () => continuationReading(store),
    enabled: local,
    refetchOnWindowFocus: false,
  });
  const active = local ? localQuery : server;
  return { data: active.data, isLoading: active.isLoading, isError: active.isError };
}
