/**
 * The two ways a reveal can fail, and the way out of both.
 *
 * Before this, either failure left the session in `stage === "revealed"` with no control that
 * advances. The only escape was abandoning the game. That matters more than it reads, because
 * docs/MEASUREMENTS.md records that the deployed engine has never been observed producing an
 * evaluation -- the least-tested path in the build ended in a soft lock.
 *
 * The two failures are NOT the same event and must not render the same:
 *
 *   engine  -- the search never returned. There is no evaluation, so there is no reveal to show.
 *   write   -- the search returned and the reveal rendered; storing the engine's verdict failed.
 *
 * Both share one fact, and it is the first thing said: the decision itself is on the record. It
 * is written by `commitDecision` before the engine is ever started (R3), so a failure here can
 * never cost the player the thing they actually did.
 */
import { primaryAction } from "@shared/primary-action";
import { RevealNextPosition } from "./RevealNextPosition";
import type { StoredPosition } from "@/lib/session-position";
import { CircleAlert } from "lucide-react";

export type RevealFailureKind = "engine" | "write";

const COPY: Record<RevealFailureKind, { what: string; detail: string }> = {
  engine: {
    what: "המנוע לא סיים את החישוב.",
    detail:
      "אין הערכה לעמדה הזו, ולכן אין מה להציג עליה. זו תקלה במנוע שרץ בדפדפן שלכם — " +
      "כפתור הבדיקה העצמית בכותרת יגיד אם הוא נטען בכלל.",
  },
  write: {
    what: "תוצאת המנוע לא נשמרה.",
    /*
     * IT NO LONGER SAYS THE DECISION IS NOT COUNTED, because it could not know that.
     *
     * The reveal is two writes. When the first landed and the second did not, this panel was
     * telling the player the opposite of what had happened: the engine's verdict WAS stored and
     * the decision WAS counted among the revealed ones. The client cannot tell the two failures
     * apart from here -- after a failed write and a failed retry, either is possible -- so it
     * says what is certain and points at the surface that holds the answer.
     */
    detail:
      "המנוע ענה והחשיפה למעלה תקפה, אבל הכתיבה לרשומה נכשלה — גם בניסיון החוזר. " +
      "מסך הרשומה יראה אם ההחלטה הזו נספרת בין אלה שנמדדו; אם לא, היא לא תיכנס לחישוב הדפוסים.",
  },
};

/**
 * THE WAY OUT, NAMED BY WHAT IT DOES, AND WHY THE PAIRING IS NOT THE CALLER'S TO STATE.
 *
 * The label used to be the constant "להחלטה הבאה" while the handler was whatever the caller passed
 * -- and once the caller learned to route elsewhere, the control said "to the next decision" and
 * went somewhere else. An adversarial pass walked it. A control that names one act and performs
 * another is the defect `shared/primary-action.ts` exists to see.
 *
 * The first repair had the caller pass label, act and handler together as one object. That only
 * moved the mismatch one layer up, where nothing checked it. So the caller now says WHICH CASE it
 * is, and the words belong to whichever component owns the act.
 *
 * AND FOR THE BANK ROUTE THAT IS NOT THIS COMPONENT. Whether the anchor set still holds a position
 * is only knowable after the press -- `serveNextBankPosition` has to be asked -- so a control
 * labelled before the press can be wrong, and on an exhausted set it would say *"to the next
 * position"* and land on the record. `RevealNextPosition` already resolves that by re-rendering
 * with the record's own words once the set comes back complete. It is therefore rendered here
 * rather than re-implemented: one authority for the question *"where does this player go next"*,
 * whether or not the engine answered (`RNL-05`).
 */
export function RevealFailure({
  kind,
  continues,
  onContinue,
  bank,
}: {
  kind: RevealFailureKind;
  /** Is there a next decision inside the game on the board, or does the way on come from the bank? */
  continues: boolean;
  onContinue: () => void;
  /** What `RevealNextPosition` needs, passed through untouched. */
  bank: {
    answered: readonly string[];
    onServed: (position: StoredPosition) => void;
    navigate: (to: string) => void;
  };
}) {
  const copy = COPY[kind];
  return (
    <section className="reveal-failure" role="alert" aria-label="החשיפה נכשלה">
      <p className="reveal-failure-what">
        <CircleAlert size={14} aria-hidden="true" /> {copy.what}
      </p>
      {/* Said before the detail, and before the control: it is the part that is not bad news. */}
      <p className="reveal-failure-safe">
        ההחלטה עצמה נרשמה. היא נכתבת לרשומה לפני שהמנוע מופעל בכלל, כך שכשל כאן לא מוחק אותה.
      </p>
      <p className="reveal-failure-detail">{copy.detail}</p>
      {continues ? (
        <button
          type="button"
          className="reveal-failure-next"
          {...primaryAction("next-decision")}
          onClick={onContinue}
        >
          להחלטה הבאה
        </button>
      ) : (
        /* NO `.reveal-failure-next` WRAPPER. That class is button chrome, and this branch's
           control brings its own (`.primary-control`, already inside the tap floor). A div
           wearing a button's border was the first thing this looked like. */
        <RevealNextPosition {...bank} />
      )}
    </section>
  );
}
