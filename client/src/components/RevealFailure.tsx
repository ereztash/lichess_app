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
    detail:
      "המנוע ענה והחשיפה למעלה תקפה, אבל הפסק שלו לא נכתב לרשומה. ההחלטה הזו לא תיספר " +
      "בין ההחלטות החשופות, ולכן לא תיכנס לחישוב הדפוסים.",
  },
};

export function RevealFailure({ kind, onNext }: { kind: RevealFailureKind; onNext: () => void }) {
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
      <button type="button" className="reveal-failure-next" onClick={onNext}>
        להחלטה הבאה
      </button>
    </section>
  );
}
