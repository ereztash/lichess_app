import { AlertTriangle, Check, FlaskConical, Loader2, X } from "lucide-react";
import type { LearningTransfer } from "@shared/learning-record";

export type LearningTransferStage = "briefing" | "running" | "reporting" | "done";

export function LearningTransferRunner({
  transfer,
  stage,
  index,
  revealed,
  recall,
  applied,
  verdict,
  error,
  onRecall,
  onApplied,
  onStart,
  onFinish,
}: {
  transfer: LearningTransfer;
  stage: LearningTransferStage;
  index: number;
  revealed: boolean;
  recall: string;
  applied: boolean | null;
  verdict: { observed: boolean; successes: number } | null;
  error?: string;
  onRecall: (value: string) => void;
  onApplied: (value: boolean) => void;
  onStart: () => void;
  onFinish: () => void;
}) {
  return (
    <section className="learning-transfer" aria-label="בדיקת העברה">
      <header className="learning-heading">
        <FlaskConical size={14} />
        <div>
          <span>בדיקה שנרשמה מראש</span>
          <h3>העברה לעמדות חדשות</h3>
        </div>
      </header>
      {/*
        * THE REFUTATION CONDITION IS SHOWN AT THE BRIEFING AND NOWHERE ELSE.
        *
        * It used to sit outside every stage conditional, so it stayed on screen for the whole
        * test. That undid the change that hid `action_rule` from the queue: a refutation
        * condition is written by answering "איזו תוצאה תפריך את הכלל?", and a player answers
        * that by restating the behaviour the rule prescribes. Pasting it as the recall was
        * measured clearing the floor at 0.556 -- the answer key, rendered inside the exam.
        *
        * It stays visible during the briefing because that is what preregistration MEANS: the
        * condition is fixed and shown before any position is drawn. What it must not do is stay
        * up while the player is being asked to recall the rule from memory.
        */}
      {stage === "briefing" && (
        <>
          <div className="transfer-prereg">
            <span>תנאי הפרכה</span>
            <p>{transfer.refutation_condition}</p>
            <small>
              נדרשות {transfer.minimum_successes} הצלחות מתוך {transfer.fens.length}.
            </small>
          </div>
          <p>הכלל לא יוצג במהלך הבדיקה. לפני כל החלטה נסו לשלוף אותו מהזיכרון.</p>
          <button type="button" className="learning-save" onClick={onStart}>
            התחלת הבדיקה
          </button>
        </>
      )}

      {stage === "running" && (
        <>
          <p className="transfer-progress">
            עמדה {index + 1} מתוך {transfer.fens.length} · נדרשות {transfer.minimum_successes}{" "}
            הצלחות
          </p>
          {/*
            * BOTH HALVES BEFORE THE REVEAL, and the second one moved here from after it.
            *
            * This used to ask "אחרי החשיפה: האם יישמתם את הכלל בהחלטה הזו?" -- literally after
            * the engine had answered. Once you have been told the move was good, "did I apply my
            * rule?" is answered by the outcome rather than by any memory of process, and it runs
            * in the flattering direction. That answer feeds `successes`, so the number the test
            * reports was contaminated by the result it was meant to be independent of.
            *
            * This is R3 one layer out: the engine must not speak before the decision is recorded,
            * and an observation ABOUT the decision collected after it speaks is the same leak in
            * different clothes.
            *
            * PRESENT TENSE, because that is the difference. "האם אתם מיישמים אותו" asks what you
            * are doing, which you can answer; "יישמתם" asks what you did, which by then you have
            * been given the answer to.
            */}
          {!revealed ? (
            <>
              <label>
                <span>לפני החשיפה: מהו כלל הפעולה שאתם זוכרים?</span>
                <textarea
                  value={recall}
                  onChange={(event) => onRecall(event.target.value)}
                  maxLength={300}
                />
              </label>
              <div className="transfer-applied">
                <span>ולפני החשיפה גם: האם אתם מיישמים אותו בהחלטה הזו?</span>
                <button
                  type="button"
                  aria-pressed={applied === true}
                  onClick={() => onApplied(true)}
                >
                  <Check size={14} /> כן
                </button>
                <button
                  type="button"
                  aria-pressed={applied === false}
                  onClick={() => onApplied(false)}
                >
                  <X size={14} /> לא
                </button>
              </div>
            </>
          ) : (
            /*
             * Nothing to collect. Both answers were written down before the engine spoke, and a
             * control here -- even a disabled one -- would invite the next change to make it
             * editable again.
             */
            <p className="transfer-frozen">
              שתי התשובות נרשמו לפני החשיפה ואינן ניתנות לשינוי.
            </p>
          )}
        </>
      )}

      {stage === "reporting" && (
        <p className="learning-loading">
          <Loader2 size={14} /> בודק מול התנאי שנרשם מראש...
        </p>
      )}
      {error && (
        <p className="learning-error" role="alert">
          <AlertTriangle size={14} /> {error}
        </p>
      )}
      {stage === "done" && verdict && (
        <div className={`transfer-verdict ${verdict.observed ? "replicated" : "refuted"}`}>
          <p>
            {verdict.successes} מתוך {transfer.fens.length} עמדות עברו את תנאי ההצלחה.
          </p>
          {/*
            * WHAT THE VERDICT IS ALLOWED TO SAY.
            *
            * It used to say "הכלל הופרך" and "הבדיקה שרדה" -- claims about the RULE. The evidence
            * cannot carry them, and three separate literatures say so in different words. Three
            * positions is below every single-case standard consulted (the WWC asks for six
            * baseline points and three demonstrations of an effect). The positions were not
            * selected for the rule's trigger, so the rule may not even apply in them. And there
            * are no control positions that DON'T instantiate the trigger, which is the comparison
            * that would show the rule is doing any work at all -- in this exact domain, chess
            * training effects measured against passive controls collapsed from 0.25 SD to 0.03 SD
            * once an active control was added.
            *
            * So the sentence now describes what happened: the preregistered condition held, or it
            * did not. That is true, and it is all that is true.
            */}
          <strong>
            {verdict.observed
              ? "התנאי שנרשם מראש התקיים. הכלל נשאר בתור לחזרה מושהית."
              : "התנאי שנרשם מראש לא התקיים, ונשמר כתוצאה."}
          </strong>
          <p className="transfer-limits">
            זו לא קביעה על הכלל עצמו. שלוש עמדות הן מתחת לכל סף מקובל למחקר יחיד; העמדות נבחרו
            כעמדות שלא הכרעתם בהן, לא לפי הטריגר של הכלל; ואין כאן עמדות ביקורת שהטריגר לא חל בהן —
            בלעדיהן אי אפשר לדעת אם הכלל עשה משהו או שפשוט שיחקתם טוב. השליפה נמדדת כחפיפת מילים מול
            מה שכתבתם, ולכן ניסוח נכון במילים אחרות ייספר כשגוי.
          </p>
          <button type="button" onClick={onFinish}>
            חזרה למשחק
          </button>
        </div>
      )}
    </section>
  );
}
