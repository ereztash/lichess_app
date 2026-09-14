/**
 * THE ONE ACT, ASKED FOR ONCE PER SURFACE.
 *
 * WHY A HOOK AND NOT THREE COPIES. Three screens have to answer the same question -- is there a set
 * this player started that outranks whatever I was about to offer -- and the answer has three
 * moving parts: a read that must never be mistaken for an empty record, a ladder that decides which
 * of two runs wins, and a press that has to survive a route change. `docs/decisions/D22` names what
 * three copies of an assembly costs, and this file's own history is the evidence: the shadow's
 * assembly was wrong twice, both times because a second copy of it filled a field differently.
 *
 * THE NAVIGATION IS PART OF THE ACT AND SO IT LIVES HERE. `/play` is the only route with a board,
 * and a surface that wrote the handoff without navigating -- or navigated without writing it --
 * would produce a press that appears to do nothing. `RevealNextPosition` records the same trap from
 * the other side: it is already ON `/play`, so for it `navigate("/play")` moves nothing and the
 * handoff has to be adopted by the component that owns the board.
 */
import { useCallback } from "react";
import { useLocation } from "wouter";

import { continuationOffer, type ContinuationOffer } from "@/components/ContinueCommitment";
import { useContinuation } from "@/lib/continuation-api";
import { useAbandonDrill } from "@/lib/record-api";
import { writeResumeRequest } from "@/lib/commitment-handoff";

export interface ContinuationHandle {
  /** What to render, including the two silences that are not the same silence. */
  offer: ContinuationOffer;
  /**
   * Whether this surface must stand its own primary control down.
   *
   * TRUE ONLY FOR `resume`, and the narrowness is the point. LAW 2 is about how many DIFFERENT acts
   * a state asks the player to choose between, and an open set the player can be put back into is
   * an act that outranks a new game by the derivation's own order -- so offering both at the same
   * weight is the screen overruling the policy. A set that cannot be reopened offers no act at all,
   * so nothing outranks anything and the surface keeps what it had; a read that failed has decided
   * nothing and may not silence a control either.
   */
  suppressPrimary: boolean;
  /** Reopen the run: write the handoff, then go to the board that can adopt it. */
  resume: (run: { kind: "drill" | "transfer"; id: string }) => void;
  /** Close a set that cannot be reopened. The player's decision, recorded as one. */
  close: (drillId: string) => void;
}

export function useContinuationOffer(): ContinuationHandle {
  const continuation = useContinuation();
  const [, navigate] = useLocation();
  const abandon = useAbandonDrill();
  const offer = continuationOffer(continuation.data);

  const resume = useCallback(
    (run: { kind: "drill" | "transfer"; id: string }) => {
      writeResumeRequest(run);
      navigate("/play");
    },
    [navigate],
  );

  const close = useCallback(
    (drillId: string) => {
      /* Not awaited: the invalidation it triggers is what removes the control from the screen. */
      void abandon.mutateAsync({ drill_id: drillId }).catch(() => {
        /* Still open, still shown, still closable. A failed close costs a press. */
      });
    },
    [abandon],
  );

  return { offer, suppressPrimary: offer.kind === "resume", resume, close };
}
