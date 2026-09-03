/**
 * Hand a bank position to the board. ONE COPY, THREE CALLERS.
 *
 * WHY IT MOVED HERE. It was a private function in `pages/Record.tsx` whose own comment already
 * argued for this: *"a second transcription of this handoff is a second chance for the two routes
 * to disagree about what a bank decision is"*. Owner decision `O-1` added the third caller -- the
 * reveal itself -- so the function is now the shared thing its comment said it was.
 *
 * WHAT `O-1` DECIDED, and it is a product decision rather than an engineering one. After a reveal
 * whose game holds no further position, the player is routed **directly** to the anchor set's next
 * unanswered position, in one press, instead of being sent to the record to find it. The route
 * that was there before is recorded in `docs/user-loop-integrity/FALSIFICATION_REGISTER.md` `O-1`
 * together with the reason it was replaced.
 *
 * WHAT THIS FUNCTION IS NOT. It is navigation, and navigation is not continuation. Nothing here
 * records `next_decision_started`, and nothing may: `O-2` fixes that event to a legal move placed
 * by the player on their own side, and a route change that recorded it would be counting the
 * product's own button press as the player's behaviour. `lib/acquisition-evidence.ts`
 * `continuationStarted` is where that requirement lives, and it takes no argument this module
 * could supply.
 *
 * `firstDecisionPly: null` IS LOAD-BEARING, carried over verbatim: an anchor is always asked on
 * its own purpose, and stamping it `first` as well would put two names on one decision.
 */
import { nextAnchor } from "@/lib/anchor-run";
import { writePosition } from "@/lib/session-position";

/**
 * `served` -- a position was written to the handoff store and the caller navigated to it.
 * `set-complete` -- this record has answered all of the bank. A real answer the caller must
 * render, and the reason the reveal keeps a way back to the record for that one case.
 */
export type HandoverOutcome = "served" | "set-complete";

export async function handOverBankPosition(
  answered: readonly string[],
  navigate: (to: string) => void,
): Promise<HandoverOutcome> {
  const next = await nextAnchor(answered);
  if (!next) return "set-complete";
  /*
   * The same handoff a first decision uses. The board restores from this store on mount, so an
   * anchor position arrives by the path a returning player's own game already takes.
   */
  writePosition({
    sans: [...next.sans],
    ply: next.ply,
    source: "finished",
    // An anchor position is one decision, so the coached loop -- the same as the handoff above.
    revealTiming: "per-decision",
    firstDecisionPly: null,
    orientation: next.sans.length % 2 === 0 ? "w" : "b",
    opponent: null,
    gameId: `anchor-${next.id}`,
  });
  navigate("/play");
  return "served";
}

/**
 * What the board says when the loaded game itself holds no further position.
 *
 * SEPARATE FROM `NO_FURTHER_POSITION`, which is about the bank being exhausted. Before `O-1` one
 * sentence served both, because both ended at the record. They no longer end in the same place,
 * and one sentence for two states is how a screen starts telling a player something untrue.
 */
export const NO_CONTINUATION_IN_THIS_GAME =
  "למשחק שנטען אין עמדה נוספת להחליט בה.";
