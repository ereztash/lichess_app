/**
 * THE BLITZ READING HOOK, IN ITS OWN MODULE, FOR A MEASURED REASON.
 *
 * It belongs in `record-api.ts` by every argument except the one that decided it: that module is on
 * the entry route -- every local-mode read and write goes through it -- so a hook there referencing
 * `blitzRecordReading` retained the whole reading chain in the entry chunk. The detector, the six
 * bucketings, `classifyPhase` with chess.js behind it, and the blitz wire schemas.
 *
 * MEASURED IN THREE STEPS, because the first two fixes each recovered only part of it:
 *
 *     eagerly rendered ResumeScreen              +16.1 kB raw   +5.1 kB gzipped
 *     lazy component, hook still in record-api    +8.3 kB        +2.7 kB
 *     lazy component, hook and function split       0            0
 *
 * The middle row is the instructive one. Making the COMPONENT lazy moves the component; it does not
 * move a module the entry still imports, and Rollup hoists anything shared between an eager and a
 * lazy graph back into the entry. The split has to go all the way down -- component, hook, and the
 * store-reading function -- or none of it moves.
 *
 * WHAT IS NOT DUPLICATED HERE: `useStore`, `useRecordMode` and `LOCAL_KEYS` are imported from
 * `record-api.ts` rather than re-created. Those are cheap and they are the identity of the local
 * store; a second copy of any of them would be a second local record.
 */
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { LOCAL_KEYS, useRecordMode, useStore } from "@/lib/record-api";
import { blitzRecordReading } from "@shared/blitz-record-reading";
import type { BlitzReading } from "@shared/blitz-reading";
import type { StoredBlitzGame } from "@shared/blitz-record";

/**
 * WHAT THE BLITZ RECORD SAYS, on whichever side it lives.
 *
 * BOTH BRANCHES CALL THE SAME `blitzRecordReading`, so a player in local mode and a player on the
 * server see one statement about their record rather than two implementations of it.
 *
 * `isLoading` IS RETURNED AND IS NOT COLLAPSED INTO AN EMPTY READING. A resume screen that treated
 * "still fetching" as "nothing here yet" would tell a returning player with forty games that they
 * had never played, for as long as the request took -- and that sentence is the one they would act
 * on.
 */
export function useBlitzReading(): {
  data: { reading: BlitzReading; games: StoredBlitzGame[] } | undefined;
  isLoading: boolean;
} {
  const { local } = useRecordMode();
  const store = useStore();
  const server = trpc.record.blitzReading.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !local,
  });
  const localQuery = useQuery({
    queryKey: LOCAL_KEYS.blitzReading,
    queryFn: () => blitzRecordReading(store),
    enabled: local,
    refetchOnWindowFocus: false,
  });
  const active = local ? localQuery : server;
  return { data: active.data, isLoading: active.isLoading };
}
