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
  /**
   * THE RULE ITSELF: what you now believe, when it applies, and what you will do (P1.8).
   *
   * SPLIT FROM `ready` RATHER THAN DUPLICATED. Two definitions of "complete" is the defect this
   * repository spends its gates on -- `ready` is still the whole of it, and this is its first half
   * named so the screen can act on it. Neither can drift from the other because the second is
   * written in terms of the first.
   */
  const ruleStated =
    mechanism !== null &&
    wouldChooseAgain !== null &&
    Boolean(fields.revisedRead.trim()) &&
    Boolean(fields.trigger.trim()) &&
    Boolean(fields.missedSignal.trim()) &&
    Boolean(fields.actionRule.trim());
  const ready =
    ruleStated && fields.predictedOutcome.trim() && fields.refutationCondition.trim();

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
      {/*
        * CLOSED UNTIL ASKED FOR, and the reason is mass rather than doubt about the form.
        *
        * Measured on the built app in Chromium at 390x844, first reveal from an empty profile:
        * this section was 877px of a 3315px page -- 26%, the single largest thing on it, and
        * twice the height of the whole reveal panel above it. Nine fields asking a player to
        * state a falsifiable rule, opened by default, seven hundred pixels below the product's
        * own sentence saying "זו החלטה אחת שנרשמה. שום דבר כאן אינו דפוס".
        *
        * NOTHING IS GATED. Writing a rule from one decision is epistemically fine -- it is a
        * hypothesis, and it is graded by testing it forward on new decisions, which is exactly
        * what the product does with it. What was wrong was the weight: the hardest thing on the
        * screen was also the biggest, and it was competing with the reveal for the attention the
        * reveal exists to get. The summary keeps the offer at full visibility and moves the nine
        * fields behind one deliberate press.
        *
        * `<details>` rather than component state, for the reason `.reveal-secondary` is one: the
        * open/closed state is the element's own, it survives without a store, and a screen reader
        * gets a real disclosure with a real name instead of a div that changed height.
        */}
      <details className="learning-composer-body">
        <summary className="learning-heading">
          <BookOpenCheck size={14} />
          <div>
            <span>אחרי החשיפה</span>
            <h3>נסחו כלל שאפשר להפריך</h3>
          </div>
        </summary>
        {/* One box for the fields, so `<details>` itself stays a plain block and keeps its own
            closed-state behaviour rather than depending on a layout mode that fights it. */}
        <div className="learning-composer-fields">

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
      {/*
        * THE SECOND STAGE, AND THE ORDER IS THE ARGUMENT (P1.8).
        *
        * YOU CANNOT SAY WHAT WOULD REFUTE A RULE BEFORE YOU HAVE WRITTEN THE RULE. These three
        * boxes ask for the falsification -- what you expect, and what result would prove you wrong
        * -- and they used to sit open beside the first field, asking a player to falsify something
        * they had not yet stated. The heading of this whole section is "נסחו כלל שאפשר להפריך",
        * and this is the part that makes it refutable; putting it first inverted the sentence.
        *
        * ABSENT AND NOT DISABLED, which is LAW 2's rule and the one `Home.tsx`'s control rail
        * follows: a greyed-out box still says "there is a thing here you could be doing", and what
        * is being removed is exactly that. What stands in its place says which half is missing --
        * an empty gap reads as a rendering fault, and the next person fills it back in.
        */}
      {ruleStated ? (
        <>
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
        </>
      ) : (
        <p className="learning-composer-next">
          אחרי שהכלל ינוסח, תישאלו מה אתם מצפים שיקרה ומה יפריך אותו — זה מה שהופך אותו להשערה.
        </p>
      )}

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
        </div>
      </details>
    </section>
  );
}
