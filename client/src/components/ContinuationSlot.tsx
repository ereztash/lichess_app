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
import { primaryAction } from "@shared/primary-action";
import { useContinuationOffer } from "@/lib/use-continuation-offer";
import { useCanonicalAction } from "@/lib/canonical-action";
import { useCanonicalRouting } from "@/lib/canonical-routing";
import { presentOnResume } from "@shared/resume-presentation";
import type { SurfaceOffer } from "@shared/surface-offer";

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
  /**
   * The canonical act for this record, worded for the front door, reported upward.
   *
   * REPORTED RATHER THAN RENDERED HERE, because the front door already has a place for it: the
   * resume card's one action slot. Drawing a second control beside that card would be two controls
   * for one act, which is LAW 2's defect whichever layer chose them. What this slot renders is the
   * continuation affordance; what it REPORTS is the policy's answer for the card to word.
   *
   * IT TRAVELS THROUGH HERE BECAUSE OF WHERE THE BYTES ARE. `Record.tsx` is the entry chunk and
   * `useCanonicalAction` reaches the whole reading chain; this component is already lazy for
   * exactly that reason, so the policy costs the front door nothing until the chunk arrives.
   */
  onCanonical,
  /**
   * Whether this slot must also DRAW the canonical act, or only report it upward.
   *
   * FOUND BY THE BROWSER WALK, NOT BY REASONING. On a return the resume card holds the act in its
   * one action slot and this component only reports it. On a FIRST visit `ResumeScreen` renders
   * nothing at all -- and a first visit is not an empty record: `returning` is `visitsOnRecord() >
   * 1`, browser bookkeeping, so somebody signing in on a second device is a first visit with a full
   * record. The walk reached exactly that stop, the policy proposed `play-blitz`, and no control
   * existed to render it.
   *
   * ONE OF THE TWO DRAWS, NEVER BOTH. The page passes `!returning`, so the card holds it when the
   * card exists and this slot holds it when the card does not. Two controls naming one act is LAW
   * 2's defect whichever layer chose them.
   */
  renderOffer,
}: {
  onStandDown: (standDown: boolean) => void;
  onCanonical: (offer: SurfaceOffer | null, take: () => void) => void;
  renderOffer: boolean;
}) {
  const continuation = useContinuationOffer();
  const canonical = useCanonicalAction(presentOnResume);
  const route = useCanonicalRouting();
  const standDown = continuation.suppressPrimary;
  useEffect(() => {
    onStandDown(standDown);
  }, [standDown, onStandDown]);
  useEffect(() => {
    if (canonical.status !== "sound") {
      onCanonical(null, () => undefined);
      return;
    }
    const action = canonical.action;
    onCanonical(canonical.offer, () => route(action));
  }, [canonical, route, onCanonical]);
  const offer = canonical.status === "sound" ? canonical.offer : null;
  return (
    <>
      {/*
        * THE FRONT DOOR'S VOICE, because that is the surface this is. `presentOnResume` words it
        * and `shared/resume-presentation.ts` says why the front door's sentence differs from the
        * post-game's for the same act.
        */}
      {renderOffer && offer !== null && canonical.status === "sound" && (
        <section className="canonical-offer" dir="rtl">
          <p className="canonical-offer__because">{offer.because}</p>
          <button
            type="button"
            className="primary-control"
            {...primaryAction(offer.act)}
            onClick={() => route(canonical.action)}
          >
            {offer.label}
          </button>
        </section>
      )}
    <ContinueCommitment
      offer={continuation.offer}
      onResume={continuation.resume}
      onClose={continuation.close}
    />
    </>
  );
}
