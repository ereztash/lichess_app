/**
 * The positive control for `GATE-GOAL-NOT-A-DENOMINATOR`: the goal in the same element as a count.
 *
 * NOT A HYPOTHETICAL. This is the shape the architecture was chosen to avoid and the shape a
 * reasonable person would write: the player's own sentence at the top of the screen, the progress
 * of the record right under it, in one tidy header. No arithmetic is performed anywhere. The reader
 * performs it.
 */
import { GOAL_LEAD } from "@shared/goal";

export function GoalBesideACount({ goal, scored }: { goal: string; scored: number }) {
  return (
    <header>
      <p>{GOAL_LEAD}</p>
      <blockquote>{goal}</blockquote>
      <p>{scored} החלטות מדודות</p>
    </header>
  );
}
