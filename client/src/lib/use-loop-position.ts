/**
 * Where the record is in its loop, computed once for the two surfaces that show it.
 *
 * `loopPosition` answers "record, detect, drill, grade: which is live, and what stands between
 * here and the next one". That answer has two halves and they belong in different places:
 *
 *   - the RAIL is a picture of the four steps, and it belongs beside the record it describes;
 *   - the SENTENCE is what the player needs before they do anything, and it belongs at the top.
 *
 * They used to be one block. `LoopStrip` rendered both, first inside the decision column and then
 * -- once the panel took that slot -- below it, which on a phone put the one line that says what
 * is standing between you and the next step at y=1368, five hundred pixels below the fold.
 *
 * THIS IS A HOOK RATHER THAN A SECOND CALL because the alternative is two components deriving the
 * same position from the same query and drifting the first time either is edited. `LoopStrip`'s
 * own note refuses "a fourth copy of any of those"; two copies is where four starts.
 */
import { useClaimView } from "@/lib/record-api";
import {
  loopPosition,
  remainingBeforeClaim,
  type LoopPosition,
} from "@/lib/loop-position";

/** Progress of a running drill, or null. It lives in Home's state, so it is passed in. */
export type DrillProgress = { completed: number; total: number } | null;

export interface LoopView {
  position: LoopPosition | null;
  /** True while the record has not answered. Neither surface may guess in the meantime. */
  loading: boolean;
}

export function useLoopPosition(drill: DrillProgress): LoopView {
  const query = useClaimView();
  const data = query.data;

  // Until the record answers, show nothing rather than a guessed position.
  if (query.isLoading) return { position: null, loading: true };

  const scored = data?.scored ?? 0;
  /*
   * The floor and the count must come from the same side of the registration boundary; the
   * arithmetic lives beside the thresholds it uses. See `remainingBeforeClaim`.
   */
  const narrowing = data?.prereg ?? null;
  const stillNeeded = remainingBeforeClaim({
    scored,
    preregScored: data?.preregScored ?? null,
    unreadable: query.isError || !data,
  });

  return {
    position: loopPosition({
      drill,
      recorded: data?.recorded ?? 0,
      scored,
      /*
       * From the view rather than from `recorded - scored`. Zero when the record has not answered
       * is a silence: the strip says nothing about a wait it cannot see, which is the one honest
       * thing to say before the counts arrive.
       */
      awaitingReveal: data?.awaitingReveal ?? 0,
      withoutConfidence: data?.withoutConfidence ?? 0,
      claimGrade: data?.claim?.grade ?? null,
      scoredStillNeeded: stillNeeded,
      narrowedTo: narrowing?.scope ?? null,
    }),
    loading: false,
  };
}
