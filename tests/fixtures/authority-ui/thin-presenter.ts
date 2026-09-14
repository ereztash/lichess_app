/** Renders one kind and declines every other, leaving canonical acts with no renderer. */
import type { NextAction } from "../../../shared/next-action";
import type { SurfaceOffer } from "../../../shared/surface-offer";

export function presentThin(action: NextAction): SurfaceOffer | null {
  return action.kind === "return-record"
    ? { act: "return-record", label: "להיסטוריה", because: "" }
    : null;
}
