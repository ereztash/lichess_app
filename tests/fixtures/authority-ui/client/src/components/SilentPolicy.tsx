/**
 * A SURFACE THAT DECIDES FOR ITSELF WHAT THE PLAYER SHOULD DO NEXT.
 *
 * Copied in shape from `PostGame.tsx` as it stood before this migration: a local branch over local
 * state, ending in a hardcoded product act, with no reference to the canonical policy anywhere.
 * `GATE-NO-LOCAL-PRODUCT-POLICY` scans for exactly this and this fixture is the proof it can.
 */
import { primaryAction } from "@shared/primary-action";

export function SilentPolicy({ hasFinding, onPlayAgain }: { hasFinding: boolean; onPlayAgain: () => void }) {
  if (hasFinding) return null;
  return (
    <button type="button" {...primaryAction("play-blitz")} onClick={onPlayAgain}>
      משחק חדש
    </button>
  );
}
