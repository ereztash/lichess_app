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
        const due = !rule.next_due_at || new Date(rule.next_due_at) <= new Date();
        return (
          <article key={rule.rule_id} className="learning-rule-row">
            <div>
              <span className={`learning-grade ${rule.grade}`}>{rule.grade}</span>
              <p>{rule.trigger}</p>
              <strong>{rule.action_rule}</strong>
              <small>
                {rule.next_due_at
                  ? `בדיקה מתוזמנת: ${new Date(rule.next_due_at).toLocaleDateString("he-IL")}`
                  : "אין בדיקה נוספת"}
              </small>
            </div>
            <div className="learning-rule-actions">
              {rule.grade !== "refuted" && (
                <button
                  type="button"
                  title={due ? "התחלת בדיקת העברה" : "הבדיקה תיפתח במועד החזרה"}
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
