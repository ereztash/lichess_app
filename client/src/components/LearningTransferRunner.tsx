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
        <FlaskConical size={15} />
        <div>
          <span>בדיקה שנרשמה מראש</span>
          <h3>העברה לעמדות חדשות</h3>
        </div>
      </header>
      <div className="transfer-prereg">
        <span>תנאי הפרכה</span>
        <p>{transfer.refutation_condition}</p>
        <small>
          נדרשות {transfer.minimum_successes} הצלחות מתוך {transfer.fens.length}.
        </small>
      </div>

      {stage === "briefing" && (
        <>
          <p>הכלל לא יוצג במהלך הבדיקה. לפני כל החלטה נסו לשלוף אותו מהזיכרון.</p>
          <button type="button" className="learning-save" onClick={onStart}>
            התחלת הבדיקה
          </button>
        </>
      )}

      {stage === "running" && (
        <>
          <p className="transfer-progress">
            עמדה {index + 1} מתוך {transfer.fens.length}
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
          <strong>
            {verdict.observed
              ? "הבדיקה שרדה. הכלל נשאר בתור לחזרה מושהית."
              : "הכלל הופרך ונשמר כתוצאה."}
          </strong>
          <button type="button" onClick={onFinish}>
            חזרה למשחק
          </button>
        </div>
      )}
    </section>
  );
}
