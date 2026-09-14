/**
 * THE FRONT DOOR'S WAY BACK INTO A SET THE PLAYER STARTED, MOUNTED WITHOUT THE BYTES.
 *
 * WHY THIS IS A COMPONENT AND NOT FOUR LINES IN `Record.tsx`. `/` is the entry route, so anything
 * `Record.tsx` imports is downloaded by every arrival before anything renders -- and the reading
 * this control needs (`continuation-api` -> `shared/continuation.ts`) measured **+2.6 kB raw**
 * against a ceiling with 0.2 kB of room. `NextActionProbe` is mounted from that page for exactly
 * this reason and says so; this is the same split one control over.
 *
 * IT REPORTS UPWARD BECAUSE TWO OTHER CONTROLS DEPEND ON THE ANSWER. `ResumeScreen`'s card action
 * and `FirstDecision`'s submit are the front door's primary acts, and `deriveNextAction` ranks a
 * set the player is in the middle of above both. A page that drew this control and left either of
 * them at full weight would be inverting the order in the only place a player reads it.
 *
 * ONE CONTROL FOR BOTH OF THE PAGE'S STATES. `/` is the `record` surface on a first visit and the
 * `resume` surface on a return -- the same route, never both at once -- and a set that is open is
 * open in either. Mounting this above the branch is what lets one element serve both without the
 * two states each growing their own.
 */
import { useEffect } from "react";

import { ContinueCommitment } from "@/components/ContinueCommitment";
import { useContinuationOffer } from "@/lib/use-continuation-offer";

export default function ContinuationSlot({
  /**
   * Told whether the page's own primary controls must stand down.
   *
   * AN EFFECT AND NOT A RENDER-TIME CALL, because it writes the parent's state and a component that
   * sets state during another component's render is a React error rather than a style preference.
   * The cost is one extra frame on the visit where a set is open, during which the page shows its
   * ordinary primary -- which is the same frame the lazy chunk is arriving in anyway.
   */
  onStandDown,
}: {
  onStandDown: (standDown: boolean) => void;
}) {
  const continuation = useContinuationOffer();
  const standDown = continuation.suppressPrimary;
  useEffect(() => {
    onStandDown(standDown);
  }, [standDown, onStandDown]);
  return (
    <ContinueCommitment
      offer={continuation.offer}
      onResume={continuation.resume}
      onClose={continuation.close}
    />
  );
}
