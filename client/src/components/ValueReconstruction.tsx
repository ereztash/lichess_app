/**
 * One question, asked once, in the player's own words back.
 *
 * WHY BEHAVIOUR IS NOT ENOUGH, which is the whole reason this component exists. The ledger can
 * say a player received a `chose-past-it` reveal and then made another decision. It cannot say
 * whether they understood what they were shown, whether they noticed it was different from what
 * an engine would have told them, or whether they continued for that reason or out of politeness.
 * Two players who click identically can have had opposite experiences, and the difference is the
 * entire subject of the trial.
 *
 * So: free text, and deliberately not a scale. "Was this useful? 1-5" measures agreeableness and
 * produces a number that looks like evidence. What is wanted is VALUE RECONSTRUCTION -- can the
 * player say back, unprompted, the thing the product does that ordinary analysis does not? An
 * answer of "the engine showed me the best move" is a real result and a negative one; it must
 * survive to the analysis intact rather than being averaged into a 3 out of 5.
 *
 * WHAT THE WORDING MAY NOT DO, and every clause here was chosen against it:
 *
 *   - it may not name the answer. "Did you notice that the move you wanted was already among the
 *     ones you put on the board?" teaches the reply and then records it as though the player
 *     produced it. Every reveal branch is unnameable here for the same reason.
 *   - it may not praise the reveal. "Interesting, wasn't it?" is a leading question with a smile.
 *   - it may not evaluate the player. Nothing here refers to their move, their confidence or
 *     their result.
 *   - it may not be asked before a commit. See POST_COMMIT_ONLY: putting the idea of a
 *     differentiated finding in front of somebody who is still deciding contaminates the decision
 *     and the answer at once.
 *
 * WHY AFTER THE SECOND REVEAL, and the tradeoff is real either way. Asking after the FIRST gives
 * the closest attribution -- the reveal is still on screen -- but it interrupts the player at
 * precisely the moment the trial is measuring whether they continue, and `next_decision_started`
 * would then be measuring the question rather than the reveal. Asking later gives a richer basis
 * and buys selection bias: whoever left after one reveal never answers. The second reveal is
 * where the first cost disappears and the second is still small -- continuation after reveal one
 * has ALREADY been recorded before this component can exist, so the number that matters most is
 * taken cleanly, and a player who got that far has seen enough to answer.
 *
 * NOT A MODAL, NOT A NAG. Inline, dismissible, once per browser. A dismissal is recorded as a
 * dismissal and may never be coded as "no value articulated": there is no text to code.
 */
import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { ANSWER_MAX, shouldAskValueQuestion } from "@/lib/acquisition-evidence";
import {
  recordTrialEvent,
  trialEventEverSeen,
  trialEventSeen,
} from "@/lib/progress-record";

/**
 * The question, as one constant.
 *
 * Here rather than inline so the test that holds it to the non-leading rules is testing the
 * string the player is shown, and so a rewrite has to pass that test rather than a paraphrase of
 * it somewhere else in the file.
 */
export const VALUE_QUESTION = "מה קיבלת כאן שלא היית מקבל מניתוח רגיל של המשחק?";

export function ValueReconstruction({ revealsPresented }: { revealsPresented: number }) {
  /*
   * Decided once, on mount, and held. Recomputing it from the ledger on every render would let
   * the panel disappear underneath the player the moment their own submission was written -- and
   * a question that vanishes mid-sentence is worse than one never asked.
   */
  const [state, setState] = useState<"asking" | "done">("asking");
  const [text, setText] = useState("");
  const eligible = useRef(
    shouldAskValueQuestion({
      revealsPresented,
      everPrompted: trialEventEverSeen("value_reconstruction_prompted"),
    }),
  );

  useEffect(() => {
    if (!eligible.current) return;
    if (trialEventSeen("value_reconstruction_prompted")) return;
    recordTrialEvent({
      name: "value_reconstruction_prompted",
      at: new Date().toISOString(),
      afterReveals: revealsPresented,
    });
    // Deliberately not in the dependency list: this fires for the mount that was eligible, and a
    // later reveal in the same session must not put the question a second time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!eligible.current || state === "done") return null;

  const close = (outcome: "answered" | "dismissed") => {
    recordTrialEvent({
      name: "value_reconstruction_submitted",
      at: new Date().toISOString(),
      outcome,
      /*
       * Trimmed and capped, and otherwise exactly what they wrote. No spell-check, no
       * normalisation, no classification: a coding scheme is applied later, offline, against
       * preregistered categories, and it is kept apart from this string so nobody can read a
       * coder's label as something the player said.
       */
      answer: outcome === "answered" ? text.trim().slice(0, ANSWER_MAX) : null,
    });
    setState("done");
  };

  return (
    <section className="value-reconstruction" aria-label="שאלה אחת על מה שקיבלתם">
      <header className="value-reconstruction-head">
        <MessageSquare size={14} />
        <span>שאלה אחת, פעם אחת</span>
      </header>
      <label htmlFor="value-reconstruction-answer">{VALUE_QUESTION}</label>
      <textarea
        id="value-reconstruction-answer"
        value={text}
        maxLength={ANSWER_MAX}
        rows={3}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="value-reconstruction-actions">
        {/* Disabled on empty rather than sending a blank: an empty answer is a dismissal, and
            the two are recorded as different things because they are different things. */}
        <button
          type="button"
          className="primary-control"
          disabled={text.trim().length === 0}
          onClick={() => close("answered")}
        >
          שליחה
        </button>
        <button type="button" className="ghost-control" onClick={() => close("dismissed")}>
          לא עכשיו
        </button>
      </div>
      <p className="value-reconstruction-note">
        התשובה נשמרת בדפדפן הזה בלבד, יחד עם שאר יומן הניסוי, ולא נשלחת לשום מקום. אפשר להעתיק
        אותה ולשלוח מתוך „בדיקה עצמית”.
      </p>
    </section>
  );
}
