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

  /*
   * WHAT IS DUE, AND WHAT IS MERELY ON THE LIST (P1.9).
   *
   * THE QUEUE LISTED EVERY RULE, each with a test button that was disabled on most of them. A
   * retrieval schedule of 1/3/7/21 days means that on any given visit almost nothing is due -- so
   * the common shape of this section was N rows of a control the player could not press, which is
   * exactly what LAW 2 means by "absent, not disabled": a greyed-out button still says there is
   * something here you could be doing, and the player has to read each row to find out there is
   * not.
   *
   * THE DELAY IS THE MEASUREMENT, so this is not merely tidier. `RETRIEVAL_INTERVAL_DAYS` exists
   * to make the interval the thing under test; a screen that keeps every rule permanently in view
   * is rehearsing the cue on every visit, which is the same argument that keeps the action rule
   * itself off these rows.
   */
  const isDue = (rule: (typeof rules)[number]) =>
    rule.next_due_at !== null && new Date(rule.next_due_at) <= new Date();
  const due = rules.filter(isDue);
  const waiting = rules.filter((rule) => !isDue(rule));

  return (
    <section className="learning-queue" aria-label="תור למידה">
      <header className="learning-heading">
        <CalendarClock size={15} />
        <div>
          <span>בדיקות עתידיות</span>
          <h3>תור למידה</h3>
        </div>
      </header>
      {due.length === 0 && (
        /*
         * ONE LINE INSTEAD OF N ROWS. The nearest date is what a player would have read every row
         * to work out, and `null` means a schedule that has ended rather than one that is late.
         */
        <p className="learning-none-due">{nothingDueSentence(waiting)}</p>
      )}
      {renderRules(due)}
      {waiting.length > 0 && (
        <details className="learning-waiting">
          <summary>
            {waiting.length === 1 ? "כלל אחד ממתין למועד" : `${waiting.length} כללים ממתינים למועד`}
          </summary>
          {renderRules(waiting)}
        </details>
      )}
      {error && (
        <p className="learning-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );

  function renderRules(shown: typeof rules) {
    return shown.map((rule) => {
        /*
         * NULL IS THE END OF THE SCHEDULE, NOT PERMISSION. `gradeLearningRule` sets `next_due_at`
         * to null once the last retrieval interval has passed, and this read `!next_due_at` as
         * due -- so the row printed "אין בדיקה נוספת" and enabled the button in the same breath.
         * The service refuses it now too; both had the same hole and either alone would have left
         * a screen that offers something the server declines.
         */
        const dueNow = isDue(rule);
        return (
          <article key={rule.rule_id} className="learning-rule-row" data-rule={rule.rule_id}>
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
                    dueNow
                      ? "התחלת בדיקת העברה"
                      : rule.next_due_at === null
                        ? "לוח החזרות של הכלל הזה הסתיים"
                        : "הבדיקה תיפתח במועד החזרה"
                  }
                  disabled={busy || !dueNow}
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
      });
  }
}

/**
 * When the next test opens, in one sentence.
 *
 * A SCHEDULE THAT HAS ENDED IS NOT A SCHEDULE THAT IS LATE, and the two produce different
 * sentences: `next_due_at === null` means the last retrieval interval has passed and there is
 * nothing more to ask, which `gradeLearningRule` sets deliberately and the service refuses to
 * start a test against.
 */
function nothingDueSentence(waiting: { next_due_at: string | null }[]): string {
  const dates = waiting
    .map((rule) => rule.next_due_at)
    .filter((at): at is string => at !== null)
    .map((at) => new Date(at).getTime())
    .filter((at) => Number.isFinite(at));
  if (dates.length === 0) return "לוח החזרות של כל הכללים הסתיים — אין בדיקה שממתינה.";
  const next = new Date(Math.min(...dates)).toLocaleDateString("he-IL");
  return `אין בדיקה פתוחה כרגע. הבאה נפתחת ב-${next}.`;
}
