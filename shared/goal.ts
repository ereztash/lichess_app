/**
 * The goal a player is here for, and the one thing it is not allowed to become.
 *
 * WHY A GOAL IS COPY AND NOT A STATE. The obvious design is a GOAL node at the front of the loop,
 * and it does not survive its own logic: a state machine asserts that its members are ordered and
 * that the player advances through them. A goal whose only content is an aspiration either advances
 * -- and then something is measuring distance to it, which is the denominator this product cannot
 * honestly supply -- or it does not advance, and then it is decoration sitting inside a machine
 * whose whole shape implies progression. Neither is a thing to ship. So the goal is stored, it is
 * said back to the player in words, and it is not a node.
 *
 * WHY THE SAFEGUARD IS A GATE AND NOT AN INTENTION. "The goal is aspiration, never a denominator"
 * is a statement about the product's arithmetic, not about the reader's. Render `1500 -> 1800`
 * beside any count and the eye computes the distance whether or not the code does; the reader
 * supplies the denominator the product withheld. `GATE-DENOM` cannot catch that -- it looks for a
 * percentage in a paragraph, and this defect has no percentage in it. `GATE-GOAL-NOT-A-DENOMINATOR`
 * is the one that can: it refuses a goal rendered in the same element as a count.
 *
 * WHAT THE PRODUCT MAY NOT DO WITH THIS. It may not compute distance to the target, render a
 * fraction or bar against it, place it next to any stage count, or state that anything in the app
 * moves the player toward it. External rating is an OUTCOME, resolvable only at FIELD, and the
 * mechanism research states that CAUSALITY, INTERVENTION and OUTCOME are unreachable by this
 * pipeline under any result.
 */

export interface PlayerGoal {
  /** What the player said they are here for, in their own words. Never parsed for a number. */
  statement: string;
  stated_at: string;
}

/**
 * The longest goal this product will store.
 *
 * A CAP RATHER THAN A FORM. The alternative was a structured goal -- a from-rating, a to-rating and
 * a date -- and structuring it is exactly how it becomes a denominator: three numbers in a row are
 * an arithmetic problem the reader will solve. One sentence in the player's words cannot be
 * subtracted.
 */
export const GOAL_MAX_LENGTH = 140;

export function normaliseGoal(statement: string): string | null {
  const trimmed = statement.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, GOAL_MAX_LENGTH);
}

/**
 * How the goal is said back, and it is deliberately not a target.
 *
 * "מה שאמרתם שאתם כאן בשבילו" AND NOT "היעד שלכם". A target is a thing you are measured against;
 * what the player wrote is a reason they came. The product can repeat a reason honestly and cannot
 * measure against a target, so the words say the first.
 */
export const GOAL_LEAD = "מה שאמרתם שאתם כאן בשבילו";

/**
 * What the product says about the relationship between the goal and everything it measures.
 *
 * Said once, next to the goal, rather than implied by keeping them apart. A player who sees their
 * own sentence at the top of a screen full of counts will assume the counts are about it unless
 * told otherwise, and being told otherwise is cheaper than being wrong about it.
 */
export const GOAL_NOT_MEASURED =
  "אף מספר באפליקציה הזו לא מודד כמה התקרבתם לזה. מה שנמדד כאן הוא ההחלטות שלכם, וזה דבר אחר.";
