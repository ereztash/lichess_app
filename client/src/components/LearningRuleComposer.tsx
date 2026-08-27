import { useState } from "react";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { MECHANISM_CLASSES, type MechanismClass } from "@shared/learning-record";
import { useCreateLearningRule } from "@/lib/record-api";
import { readableFailureText } from "@/lib/commit-error";

const MECHANISM_LABELS: Record<MechanismClass, string> = {
  threat_scan: "סריקת איומים",
  candidate_generation: "יצירת מועמדים",
  calculation: "חישוב",
  evaluation: "הערכת עמדה",
  time_allocation: "ניהול זמן",
};

export function LearningRuleComposer({
  sourceDecisionId,
  onSaved,
}: {
  sourceDecisionId: string;
  onSaved: () => void;
}) {
  const createRule = useCreateLearningRule();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  /*
   * BOTH START UNANSWERED, and that is a correctness fix rather than a nicety.
   *
   * `mechanism` opened on "threat_scan" and `wouldChooseAgain` on `false`, neither was required to
   * save, and both rendered with `aria-pressed` already set -- so a screen reader announced
   * answers the player had not given. Every rule carries `authored_by: "player"`, which is the
   * product's claim about where its content came from, and two of its fields were the form's.
   *
   * The mechanism is the worse of the two: it is the rule's own account of WHAT WENT WRONG, so a
   * default meant every untouched rule in the record blamed threat scanning.
   */
  const [mechanism, setMechanism] = useState<MechanismClass | null>(null);
  const [wouldChooseAgain, setWouldChooseAgain] = useState<boolean | null>(null);
  const [fields, setFields] = useState({
    revisedRead: "",
    trigger: "",
    missedSignal: "",
    actionRule: "",
    exceptionRule: "",
    predictedOutcome: "",
    refutationCondition: "",
  });

  const set = (key: keyof typeof fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));
  const ready =
    mechanism !== null &&
    wouldChooseAgain !== null &&
    fields.revisedRead.trim() &&
    fields.trigger.trim() &&
    fields.missedSignal.trim() &&
    fields.actionRule.trim() &&
    fields.predictedOutcome.trim() &&
    fields.refutationCondition.trim();

  /**
   * The reflection the record already held, when this save kept it instead of the one on screen.
   *
   * Null while nothing has been kept, which is every ordinary save.
   */
  const [keptEarlier, setKeptEarlier] = useState<string | null>(null);

  const submit = async () => {
    // The narrowing is load-bearing, not defensive: `ready` is what proves both choices were made,
    // and TypeScript will not let the two nullable values through without it.
    if (!ready || mechanism === null || wouldChooseAgain === null || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const outcome = await createRule.mutateAsync({
        reflection: {
          revised_read: fields.revisedRead,
          would_choose_again: wouldChooseAgain,
        },
        rule: {
          source_decision_id: sourceDecisionId,
          trigger: fields.trigger,
          mechanism_class: mechanism,
          missed_signal: fields.missedSignal,
          action_rule: fields.actionRule,
          exception_rule: fields.exceptionRule.trim() || null,
          predicted_outcome: fields.predictedOutcome,
          refutation_condition: fields.refutationCondition,
        },
      });
      /*
       * THE EARLIER REFLECTION IS SAID OUT LOUD, not silently kept.
       *
       * `createLearningRule` writes the reflection and the rule in two statements with no
       * transaction. Lose the second and the record holds a reflection and no rule -- and this
       * form keeps every field on screen after a failure, so a player who edits one word of the
       * revised-read box and presses save again is sending a DIFFERENT reflection. The service
       * used to refuse the whole operation, which locked that decision out of ever carrying a
       * rule; it now keeps the reflection already on the record and writes the rule.
       *
       * Which means the text in this box may not be what the record holds, and the player has to
       * be told. Keeping one version while the screen shows another is the thing this product
       * exists not to do.
       */
      if (outcome.reflection === "kept-earlier") {
        setKeptEarlier(outcome.storedReflection?.revised_read ?? null);
        return;
      }
      onSaved();
    } catch (cause) {
      setError(readableFailureText(cause, "הכלל לא נשמר."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="learning-composer" aria-label="כלל למידה חדש">
      <header className="learning-heading">
        <BookOpenCheck size={15} />
        <div>
          <span>אחרי החשיפה</span>
          <h3>נסחו כלל שאפשר להפריך</h3>
        </div>
      </header>

      <label>
        <span>מה אתם מבינים עכשיו אחרת?</span>
        <textarea
          value={fields.revisedRead}
          onChange={(event) => set("revisedRead", event.target.value)}
          maxLength={200}
        />
      </label>

      <div className="learning-choice" role="group" aria-label="האם הייתם בוחרים שוב באותו מהלך">
        <span>הייתם בוחרים שוב באותו מהלך?</span>
        {/*
          * `=== true` and `=== false`, not the value and its negation. `aria-pressed={!wouldChooseAgain}`
          * was true while the answer was `null`, so "לא" announced itself as chosen before anyone
          * had answered -- the defect this pair exists to remove, reproduced in the markup.
          */}
        <button
          type="button"
          aria-pressed={wouldChooseAgain === true}
          onClick={() => setWouldChooseAgain(true)}
        >
          כן
        </button>
        <button
          type="button"
          aria-pressed={wouldChooseAgain === false}
          onClick={() => setWouldChooseAgain(false)}
        >
          לא
        </button>
      </div>

      <fieldset className="mechanism-picker">
        <legend>איזה מנגנון דורש שינוי?</legend>
        {MECHANISM_CLASSES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mechanism === value}
            onClick={() => setMechanism(value)}
          >
            {MECHANISM_LABELS[value]}
          </button>
        ))}
      </fieldset>

      <label>
        <span>מתי הכלל אמור לפעול?</span>
        <input
          value={fields.trigger}
          onChange={(event) => set("trigger", event.target.value)}
          maxLength={200}
        />
      </label>
      <label>
        <span>איזה סימן פספסתם?</span>
        <input
          value={fields.missedSignal}
          onChange={(event) => set("missedSignal", event.target.value)}
          maxLength={200}
        />
      </label>
      <label>
        <span>מה תעשו בפעם הבאה?</span>
        <textarea
          value={fields.actionRule}
          onChange={(event) => set("actionRule", event.target.value)}
          maxLength={300}
        />
      </label>
      <label>
        <span>מתי הכלל לא תקף? (רשות)</span>
        <input
          value={fields.exceptionRule}
          onChange={(event) => set("exceptionRule", event.target.value)}
          maxLength={200}
        />
      </label>
      <label>
        <span>איזו תוצאה אתם מצפים לראות?</span>
        <textarea
          value={fields.predictedOutcome}
          onChange={(event) => set("predictedOutcome", event.target.value)}
          maxLength={300}
        />
      </label>
      <label>
        <span>איזו תוצאה תפריך את הכלל?</span>
        <textarea
          value={fields.refutationCondition}
          onChange={(event) => set("refutationCondition", event.target.value)}
          maxLength={500}
        />
      </label>

      {error && (
        <p className="learning-error" role="alert">
          {error}
        </p>
      )}
      {/*
        * WHAT THE RECORD KEPT, when it is not what this form shows.
        *
        * `role="status"` rather than `alert`: nothing failed. The rule was saved. What the player
        * needs to know is that the reflection above is not the one on the record, because a
        * reflection is what you said BEFORE seeing more and this decision already had one.
        *
        * It names the stored text rather than saying "an earlier version was kept", so the player
        * can see what the record actually holds instead of being asked to remember.
        */}
      {keptEarlier !== null && (
        <div className="learning-kept" role="status">
          <p>
            הכלל נשמר. הרפלקציה שכתבתם עכשיו לא נשמרה — על ההחלטה הזו כבר נרשמה רפלקציה, ומה
            שנכתב לפני שראיתם עוד אינו משתנה בדיעבד.
          </p>
          <p className="learning-kept-text">מה שנשמר: „{keptEarlier}”</p>
          <button type="button" className="learning-kept-ok" onClick={onSaved}>
            הבנתי
          </button>
        </div>
      )}
      <button
        type="button"
        className="learning-save"
        disabled={!ready || saving}
        onClick={() => void submit()}
      >
        {saving ? <Loader2 size={14} /> : <BookOpenCheck size={14} />}
        שמירת כלל כהשערה
      </button>
    </section>
  );
}
