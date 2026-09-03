/**
 * A REVEAL WITH NOWHERE TO GO, SAID RATHER THAN LEFT BLANK.
 *
 * WHY IT EXISTS. The front door hands over exactly one position on purpose --
 * `pickFirstDecision` trims the game to the ply before the decision *"so nothing after it can
 * leak"* -- so a loaded handoff has no second decision in it. Before this, the continuation was
 * offered anyway, and pressing it played the committed move into a game with no opponent: the
 * board went from `תור לבן` to `תור שחור` and asked the player to decide for the other side. The
 * answer was accepted and recorded. Measured in Chromium at `c1d72935c038`.
 *
 * ONE ACT, AND ONE THAT CAN BE TAKEN. `return-record` and deliberately not `next-decision`:
 * `docs/ACQUISITION_EVIDENCE.md` defines the continuation step as *"board accepts the next move"*,
 * and this is not that. `/` is where the record lives and where a position is handed over, so the
 * act invents no destination and is already in `PRIMARY_ACTIONS`.
 *
 * WHERE A FIRST-TIME VISITOR'S SECOND DECISION SHOULD COME FROM is a product question this does
 * not answer: `docs/user-loop-integrity/FALSIFICATION_REGISTER.md` `O-1`.
 */
import { primaryAction } from "@shared/primary-action";

export const NO_FURTHER_POSITION =
  "למשחק שנטען אין עמדה נוספת להחליט בה. הרשומה שומרת את ההחלטה הזאת, ומשם אפשר לבחור עמדה אחרת.";

export function RevealNoContinuation({ onReturnToRecord }: { onReturnToRecord: () => void }) {
  return (
    <>
      <p className="reveal-no-continuation" role="status">
        {NO_FURTHER_POSITION}
      </p>
      <button
        type="button"
        className="primary-control"
        {...primaryAction("return-record")}
        onClick={onReturnToRecord}
      >
        חזרה לרשומה
      </button>
    </>
  );
}
