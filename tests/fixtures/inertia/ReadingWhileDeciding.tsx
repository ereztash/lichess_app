/**
 * CONTROL for GATE-DECISION-FOCUS. Not shipped, not imported by anything.
 *
 * The violation LAW 1 is about, in its plainest form: a screen that asks a player how sure they
 * are while a panel describing that player's calibration is beside the question. `Home.tsx` did
 * exactly this on the `deciding` branch, and did it at the counterfactual stage by falling through
 * to the reveal column.
 */
import { ClaimPanel } from "@/components/ClaimPanel";

export function ReadingWhileDeciding() {
  return (
    <aside>
      <ClaimPanel onRunDrill={() => undefined} />
      <button type="button">רשמו את ההחלטה</button>
    </aside>
  );
}
