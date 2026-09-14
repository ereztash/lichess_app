/**
 * THE CANONICAL NEXT ACT, LIVE, FOR A SURFACE THAT INTENDS TO ACT ON IT.
 *
 * WHY THIS IS NOT `useNextActionShadow`. That hook exists to RECORD what the policy would have said
 * beside what the screen actually offered, once per visit per surface, into a local trial ledger.
 * It is measurement. This is authority: what a surface renders. They read the same state through
 * the same assembly and they are deliberately separate calls, because the day a surface acts on the
 * policy is the day the shadow stops being able to measure disagreement on that surface -- and
 * conflating them would have hidden that transition instead of marking it.
 *
 * THE THREE ANSWERS, AND THE MIDDLE ONE IS THE POINT.
 *
 *   `unknown`  -- the readings have not settled. Render nothing and do not substitute anything.
 *   `unsound`  -- an input that could have OUTRANKED this answer went unread. The policy still
 *                 returns an action; acting on it would be acting on a ranking computed without a
 *                 competitor. The surface must not present it and must not invent a replacement.
 *   `sound`    -- every input above the branch that fired was actually read. Act.
 *
 * `unsound` USED TO BE EVERY STATE, and the repair that changed it is not in this file. `unseenEvent`
 * sits at branch 4 of the ladder and nothing in this product can produce it, so modelling it as
 * merely unread put a phantom competitor above eight of the eleven kinds forever. `shared/next-
 * action.ts` now separates "unread" from "unimplementable" and only the first counts as blindness.
 * No seen-set was built and `review-event` is still unreachable; what changed is that its
 * unreachability stopped being charged to the branches beneath it.
 *
 * WHAT A CALLER MAY NOT DO WITH `unknown` OR `unsound`: fall back to a product act of its own
 * choosing. That is the parallel policy this whole migration removes, arriving through the error
 * path. A surface with no canonical answer renders its description and no primary control.
 */
import { useMemo } from "react";

import {
  actFor,
  proposeNextAction,
  soundProposal,
  type BlindableInput,
  type NextAction,
} from "@shared/next-action";
import type { SurfaceOffer, SurfacePresenter } from "@shared/surface-offer";
import { useProductState } from "@/lib/next-action-shadow";

export type CanonicalAction =
  | { readonly status: "unknown" }
  | { readonly status: "unsound"; readonly action: NextAction; readonly blind: readonly BlindableInput[] }
  | { readonly status: "sound"; readonly action: NextAction; readonly offer: SurfaceOffer | null };

/**
 * Ask the canonical policy, then let this surface word the answer.
 *
 * THE PRESENTER IS AN ARGUMENT RATHER THAN A LOOKUP, so the surface supplies its own voice at the
 * call site and no table anywhere maps surfaces to sentences. `presentOnResume` and
 * `presentOnPostGame` word the same act differently and neither can change which act it is --
 * `SurfaceOffer.act` is copied from `actFor` and `GATE-SEMANTIC-PRESERVATION` holds it there.
 *
 * `offer: null` ON A SOUND ANSWER IS NOT A FAILURE. `wait-analysis` and `none` have no control on
 * any surface by design: the engine still running is a sentence, and a record with nothing
 * outstanding is a state. The caller renders its description and draws no primary control.
 */
export function useCanonicalAction(present: SurfacePresenter): CanonicalAction {
  const state = useProductState();
  return useMemo<CanonicalAction>(() => {
    if (state === null) return { status: "unknown" };
    const proposal = proposeNextAction(state);
    if (!soundProposal(proposal)) {
      return { status: "unsound", action: proposal.action, blind: proposal.blind };
    }
    return { status: "sound", action: proposal.action, offer: present(proposal.action) };
  }, [state, present]);
}

/** The act a canonical answer names, or null when there is nothing to press. For the act gates. */
export function offeredAct(answer: CanonicalAction): string | null {
  return answer.status === "sound" ? (actFor(answer.action.kind) ?? null) : null;
}
