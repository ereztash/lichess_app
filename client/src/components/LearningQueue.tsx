import { Archive, CalendarClock, FlaskConical, Loader2 } from "lucide-react";
import { useLearningRules, useRetireLearningRule } from "@/lib/record-api";

export function LearningQueue({
  onStart,
  busy,
  error,
}: {
  onStart: (ruleId: string) => void;
  busy: boolean;
  error?: string;
}) {
  const query = useLearningRules();
  const retire = useRetireLearningRule();
  const rules = query.data?.rules.filter((rule) => rule.grade !== "retired") ?? [];

  if (query.isLoading) {
    return (
      <p className="learning-loading">
        <Loader2 size={14} /> קורא את תור הלמידה...
      </p>
    );
  }
  if (!rules.length) return null;

  return (
    <section className="learning-queue" aria-label="תור למידה">
      <header className="learning-heading">
        <CalendarClock size={15} />
        <div>
          <span>בדיקות עתידיות</span>
          <h3>תור למידה</h3>
        </div>
      </header>
      {rules.map((rule) => {
        /*
         * NULL IS THE END OF THE SCHEDULE, NOT PERMISSION. `gradeLearningRule` sets `next_due_at`
         * to null once the last retrieval interval has passed, and this read `!next_due_at` as
         * due -- so the row printed "אין בדיקה נוספת" and enabled the button in the same breath.
         * The service refuses it now too; both had the same hole and either alone would have left
         * a screen that offers something the server declines.
         */
        const due = rule.next_due_at !== null && new Date(rule.next_due_at) <= new Date();
        return (
          <article key={rule.rule_id} className="learning-rule-row">
            <div>
              <span className={`learning-grade ${rule.grade}`}>{rule.grade}</span>
              <p>{rule.trigger}</p>
              {/*
                * THE ACTION RULE IS NOT HERE, and its absence is the measurement.
                *
                * This row used to print it inches from the button that starts a test of whether
                * the player can recall it. What that measures is working memory over a few
                * seconds; the 1/3/7/21 day schedule exists precisely to make the DELAY the thing
                * under test, and a visible answer deletes the delay.
                *
                * The TRIGGER stays, because showing the cue is what a retrieval test is. Saying
                * the rule is withheld on purpose stays too -- an unexplained absence reads as a
                * rendering fault, and the next person restores it.
                */}
              <small className="learning-withheld">הכלל עצמו מוסתר — הבדיקה היא על שליפה מהזיכרון</small>
              <small>
                {rule.next_due_at
                  ? `בדיקה מתוזמנת: ${new Date(rule.next_due_at).toLocaleDateString("he-IL")}`
                  : "לוח החזרות הסתיים — אין בדיקה נוספת"}
              </small>
            </div>
            <div className="learning-rule-actions">
              {rule.grade !== "refuted" && (
                <button
                  type="button"
                  title={
                    due
                      ? "התחלת בדיקת העברה"
                      : rule.next_due_at === null
                        ? "לוח החזרות של הכלל הזה הסתיים"
                        : "הבדיקה תיפתח במועד החזרה"
                  }
                  disabled={busy || !due}
                  onClick={() => onStart(rule.rule_id)}
                >
                  <FlaskConical size={14} /> בדיקה
                </button>
              )}
              <button
                type="button"
                title="הוצאת הכלל מתור הלמידה"
                onClick={() => void retire.mutateAsync({ rule_id: rule.rule_id })}
              >
                <Archive size={14} />
              </button>
            </div>
          </article>
        );
      })}
      {error && (
        <p className="learning-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
