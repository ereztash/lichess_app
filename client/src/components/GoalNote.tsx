/**
 * What the player said they are here for, in their words, next to nothing countable.
 *
 * WHY THIS IS NOT A NODE IN THE LOOP. The obvious design is a GOAL step at the front of the state
 * machine, and it does not survive its own logic. A state machine asserts that its members are
 * ordered and that the player advances through them, so a goal inside one either advances -- and
 * then something is measuring distance to it, which is the denominator this product cannot honestly
 * supply -- or it does not advance, and then it is decoration in a machine whose shape promises
 * progression. `shared/goal.ts` carries the argument at length.
 *
 * WHY IT IS ITS OWN FILE. `GATE-GOAL-NOT-A-DENOMINATOR` refuses a goal in the same element as a
 * count, because two numbers and a direction in one row is a progress bar with the bar left out and
 * the reader supplies the arithmetic the product declined to do. Keeping the sentence in a separate
 * component from every count is the cheapest way to make that impossible rather than merely
 * discouraged.
 *
 * ITS CONTROL IS NOT PRIMARY. LAW 2 permits one primary action per screen and on the record screen
 * that is not this. Writing down why you are here is a thing you may do, not the thing to do.
 */
import { useState } from "react";
import { GOAL_LEAD, GOAL_MAX_LENGTH, GOAL_NOT_MEASURED } from "@shared/goal";
import { readGoal, writeGoal } from "@/lib/player-goal";

/**
 * IT OWNS ITS OWN STORAGE, and that is a byte decision as much as a structural one.
 *
 * Holding the goal in the page meant `player-goal.ts` and `shared/goal.ts` were imported by the
 * front door, so every arrival downloaded them before scrolling to the surface that uses them.
 * Owning it here puts them behind the same lazy boundary as the component, and it removes a prop
 * that existed only to carry state past a component that had no use for it.
 *
 * READ ONCE IN AN INITIALISER. `readGoal` touches `localStorage`, which throws in a private window
 * or with site data blocked; a render that can throw on a storage quirk is a blank screen for a
 * sentence nobody needs. The initialiser runs once and the setter is the only thing that moves it.
 */
export function GoalNote() {
  const [goal, setGoal] = useState<string | null>(() => readGoal());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal ?? "");

  if (editing) {
    return (
      <div className="goal-note" dir="rtl">
        <label className="goal-note__lead" htmlFor="goal-statement">
          למה אתם כאן? במילים שלכם.
        </label>

        <textarea
          id="goal-statement"
          className="goal-note__input"
          value={draft}
          maxLength={GOAL_MAX_LENGTH}
          rows={2}
          onChange={(event) => setDraft(event.target.value)}
        />

        <button
          type="button"
          className="goal-note__save"
          onClick={() => {
            setGoal(writeGoal(draft));
            setEditing(false);
          }}
        >
          שמירה
        </button>
      </div>
    );
  }

  if (goal === null) {
    return (
      <div className="goal-note" dir="rtl">
        <button type="button" className="goal-note__open" onClick={() => setEditing(true)}>
          כתבו למה אתם כאן
        </button>
      </div>
    );
  }

  return (
    <div className="goal-note" dir="rtl">
      <p className="goal-note__lead">{GOAL_LEAD}</p>

      <blockquote className="goal-note__text">{goal}</blockquote>

      <p className="goal-note__limit">{GOAL_NOT_MEASURED}</p>

      <button
        type="button"
        className="goal-note__open"
        onClick={() => {
          setDraft(goal);
          setEditing(true);
        }}
      >
        עריכה
      </button>
    </div>
  );
}
