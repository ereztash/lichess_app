/**
 * THE CONTROL FOR `GATE-SHADOW-SURFACE-LIVE`: the product as it actually was.
 *
 * `SHADOW_SURFACES` named three screens and exactly one of them had a call site. `post-game` and
 * `record` were declared, measured by nothing, and nothing said so -- which is the state this gate
 * exists to make impossible and therefore the state its control has to reproduce.
 */
import { useNextActionShadow, useProductState } from "@/lib/next-action-shadow";

export function OnlyTheFrontDoor() {
  useNextActionShadow("resume", useProductState());
  return null;
}
