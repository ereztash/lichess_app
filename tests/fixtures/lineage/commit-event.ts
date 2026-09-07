/**
 * The write half of the same control: a row asserting a condition nobody observed.
 *
 * `quiet_window_exposure` is written as a LITERAL rather than passed through from what the screen
 * did. Under the fixture's ribbon above, this row claims the ribbon was visible on exactly the
 * decisions where it was suppressed -- which is the state the gate makes unreachable, produced
 * deliberately so the control can go red on it.
 */
export function buildCommitEvent() {
  return {
    decision: "e2e4",
    analysis_timing: "during-play",
    quiet_window_exposure: "context-ribbon-visible",
  };
}
