/** The caller half of the control: the way-on press counted as the player's behaviour. */
import { continuationStarted } from "../lib/acquisition-evidence";

export function onWayOnPressed(revealsPresented: number, alreadyRecorded: boolean) {
  const started = continuationStarted({
    movePlaced: true,
    positionWasActionable: true,
    revealsPresented,
    alreadyRecorded,
  });
  if (!started) return;
  recordTrialEvent({ name: "next_decision_started", at: "", afterReveals: revealsPresented });
}

declare function recordTrialEvent(event: { name: string; at: string; afterReveals: number }): void;
