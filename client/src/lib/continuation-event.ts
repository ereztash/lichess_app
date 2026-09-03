/**
 * THE ONE PLACE `next_decision_started` IS WRITTEN.
 *
 * WHY IT IS A MODULE AND NOT AN EFFECT INSIDE `Home.tsx`. Owner decision `O-2` makes this the most
 * contestable definition in the trial, and it was living in the middle of a 2,400-line component
 * between the material count and the legal-target memo. `R-13`'s ratchet forced the extraction and
 * the extraction is the right shape anyway: the definition, its guard and its single writer are
 * now one file that a reader can hold in their head, and `GATE-CONTINUATION-IS-A-MOVE` scans for
 * exactly the drift that a second writer elsewhere in `client/src` would be.
 *
 * WHAT `O-2` SAYS, and this hook is the whole of its enforcement at runtime. The event is recorded
 * only when, after a prior reveal, the player was shown a legal position in which it was THEIR
 * turn, and they placed a legal move in it. Not on a route change, not on a press of the way-on
 * control `O-1` added, not on a render, not on entry to a screen, not on selecting a game.
 *
 * WHY IT TAKES `movePlaced` RATHER THAN THE MOVE. The caller owns what a placed move is -- in
 * `Home` it is a candidate the board validated against the actual position before accepting it --
 * and passing the string here would invite a second opinion about legality in a second place.
 */
import { useEffect } from "react";

import { continuationStarted } from "@/lib/acquisition-evidence";
import { recordTrialEvent, revealsPresented, trialEventSeen } from "@/lib/progress-record";

export function useContinuationEvent(input: {
  /** A move the caller has already validated against the position on the board. */
  movePlaced: boolean;
  /** A legal position, in this player's own turn, that the board will accept a move in. */
  positionIsActionable: boolean;
}): void {
  const { movePlaced, positionIsActionable } = input;
  useEffect(() => {
    const reveals = revealsPresented();
    const started = continuationStarted({
      movePlaced,
      /*
       * O-2's first clause. The same predicate gates `first_position_presented`, so the funnel's
       * two behavioural stages cannot disagree about what a position the player could act in is.
       */
      positionWasActionable: positionIsActionable,
      revealsPresented: reveals,
      alreadyRecorded: trialEventSeen("next_decision_started"),
    });
    if (!started) return;
    /*
     * Once per visit. What the trial needs is whether they went on at all; how many times is
     * already in the ledger under `decision_committed`, with an ordinal.
     */
    recordTrialEvent({
      name: "next_decision_started",
      at: new Date().toISOString(),
      afterReveals: reveals,
    });
  }, [movePlaced, positionIsActionable]);
}
