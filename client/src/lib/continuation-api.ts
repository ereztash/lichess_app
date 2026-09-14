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
import {
  COMMITMENT_READ_FAILED,
  COMMITMENT_UNREAD,
  continuationReading,
  type ContinuationReading,
} from "@shared/continuation";
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
  /*
   * `serverStatus` AND NOT JUST `local`, AND THE DIFFERENCE IS A WRONG ROW WRITTEN ONCE AND KEPT.
   *
   * `useRecordMode` answers `local: true` until the storage probe comes back -- deliberately, and
   * it says why: *"Guessing the other way would send the first decision of a session into a store
   * that may reject it."* Right for a WRITE. Wrong for this read: a signed-in player whose record
   * lives on the server would have this query answered from an empty `LocalRecordStore`, and
   * `productStateFor` would stamp that empty answer `observed(null)` -- a positive claim that no
   * drill is open, made from the wrong store.
   *
   * AND IT WOULD BE PERMANENT. `useNextActionShadow` writes once per visit per surface and
   * `trialEventSeenOn` dedupes for the whole surface, so the first proposal is the only one ever
   * recorded. `D22` found this exact shape twice in the shadow already -- `analysisRunning`
   * hard-coded `false`, `offered` a constant -- and named it: a shadow that reports a made-up input
   * is not a weaker shadow, it is one whose disagreements are about itself.
   *
   * `unknown` MEANS THE READ HAS NOT SETTLED, which `productStateFor` turns into `UNOBSERVED`.
   * That is the honest answer and it is exactly what this migration added `Observed` to be able to
   * say.
   */
  const { local, serverStatus } = useRecordMode();
  const resolved = serverStatus !== "unknown";
  const store = useStore();
  const server = trpc.record.continuation.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: resolved && !local,
  });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.continuation,
    queryFn: () => continuationReading(store),
    enabled: resolved && local,
    refetchOnWindowFocus: false,
  });
  const active = local ? localQuery : server;
  const isLoading = !resolved || active.isLoading;
  const isError = resolved && active.isError;
  /*
   * A READING IS ALWAYS RETURNED, AND `undefined` NEVER IS. That is the whole of §16 at this
   * boundary: a caller cannot hold "no data" and decide for itself what that means, because there
   * is no "no data" to hold. A pending read is `not-attempted`, a failed read is `read-failed`, and
   * both are `unknown` -- which `productStateFor` turns into `UNOBSERVED` and a screen renders as
   * silence rather than as an invitation to start something else.
   *
   * THE ERROR CASE IS THE ONE THAT WOULD HAVE COST SOMETHING. `data: undefined` on a failed query
   * is indistinguishable from a query that has not run, and the surfaces would have rendered both
   * as "nothing open" -- to a player four positions into an eight-position set, offering them a new
   * game at the same weight. The record still holds their run; only the request failed.
   */
  return {
    data: (isLoading || isError ? undefined : active.data) ?? readingFor(isError),
    isLoading,
    isError,
  };
}

/** The two honest silences, kept apart. Never a record with no run in it. */
function readingFor(failed: boolean): ContinuationReading {
  return failed ? COMMITMENT_READ_FAILED : COMMITMENT_UNREAD;
}
