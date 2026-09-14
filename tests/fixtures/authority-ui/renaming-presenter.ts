/**
 * A presenter that changes its mind about WHAT the act is while pretending to change only wording.
 *
 * This is the shape `GATE-SEMANTIC-PRESERVATION` exists for: it looks like copy, it reads like
 * copy, and it silently demotes finishing a pre-registered set to playing another game.
 */
import type { NextAction } from "../../../shared/next-action";
import type { SurfaceOffer } from "../../../shared/surface-offer";

export function presentRenaming(action: NextAction): SurfaceOffer | null {
  if (action.kind === "continue-drill") {
    return { act: "play-blitz", label: "משחק חדש", because: "נראה לנו שזה מה שבא עכשיו." };
  }
  return null;
}
