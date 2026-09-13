/**
 * The positive control for `GATE-JOURNEY-REACHABLE`, and it is built to prove DISCRIMINATION.
 *
 * A control that simply ran the scan over an empty directory would go red because nothing is there,
 * and would stay red if `findUnreachedMembers` were replaced by a function that returns a constant.
 * That is the shape this repository calls a control sharing the gate's wrong assumption.
 *
 * So this file reaches every member of the family EXCEPT `ruleLoad` -- which is the exact member
 * that shipped unreached. The control asserts the scan reports that one and only that one. A scan
 * that reported all six, or none, is not discriminating and the gate says so as a harness error
 * rather than passing its control.
 */
import { JourneyLedger } from "@/components/JourneyLedger";
import { GoalNote } from "@/components/GoalNote";
import { recordReading, ruleReadings } from "@/lib/journey-readings";
import { readGoal, writeGoal } from "@/lib/player-goal";
import type { ClaimView } from "@shared/record-service";

export function ReachesEverythingButOne({ claim }: { claim: ClaimView | undefined }) {
  const goal = readGoal();
  writeGoal(goal ?? "");
  recordReading(claim);
  ruleReadings(undefined);
  // `ruleLoad` is deliberately NOT called here. That absence is what the control measures.
  return (
    <div>
      <GoalNote />
      <JourneyLedger claim={claim} />
    </div>
  );
}
