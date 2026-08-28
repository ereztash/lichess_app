/**
 * THE REVEAL (section 4.2). The order top to bottom is not negotiable:
 *
 *   1. what cannot be inferred here  -- first, always, before any number
 *   2. the one thing to work on      -- one, not a list
 *   3. the next question
 *   4. everything else               -- secondary disclosure, collapsed by default
 *
 * The evaluation number is the most visually attractive element on this screen and the least
 * useful one. It lives in step 4, inside a collapsed <details>. If it ever becomes the largest
 * thing here, this has been rebuilt into the tool the repo already was.
 */
import { useEffect } from "react";
import { AlertTriangle, ChevronDown, HelpCircle, Target } from "lucide-react";
import { formatEvaluation, sanPrincipalVariation } from "@/lib/game-data";
import {
  BUILD_LIMIT,
  ENGINE_NOISE_CP,
  MATERIAL_LOSS_CP,
  inferenceLimits,
  nextQuestion,
  silenceBasis,
  theOneThing,
  type RevealInputs,
} from "@shared/reveal";
import type { EngineLine } from "@/lib/engine-line";
import { recordTrialEvent, trialEventSeen } from "@/lib/progress-record";
import { NotMeasured, Value } from "./Value";

interface RevealPanelProps {
  inputs: RevealInputs;
  analysis: EngineLine | null;
  /** The position the analysis was computed for. */
  fen: string;
  statedKnown: string;
  /**
   * The decision this reveal is about, or null when it is not being rendered for a real one.
   *
   * The trial's reveal events are keyed on it, and null means "do not record" rather than
   * "record without an id": a reveal that cannot say which decision it belongs to cannot be
   * joined to a commit, so it would enter the funnel as a stage with no denominator. Every test
   * that renders this panel in isolation passes null and records nothing, which is correct --
   * a test is not a reveal a player was shown.
   */
  decisionId?: string | null;
}

export function RevealPanel({
  inputs,
  analysis,
  fen,
  statedKnown,
  decisionId = null,
}: RevealPanelProps) {
  const limits = inferenceLimits(inputs);
  const oneThing = theOneThing(inputs);
  const question = nextQuestion(inputs);
  const pv = analysis ? sanPrincipalVariation(fen, analysis.pv) : [];

  /*
   * THE REVEAL EVENTS ARE EMITTED FROM THE THING THAT RENDERS THE REVEAL, and that placement is
   * the whole of their validity.
   *
   * `reveal_kind_presented` has to answer "which branch did this player actually see". Computed
   * anywhere else -- in `Home`, in the ledger, in an analysis script -- it would be a SECOND
   * implementation of the branch conditions, and the two would part company the first time a
   * threshold moved: the panel would show one sentence and the trial would record another, with
   * nothing failing. Here, `oneThing` is the same value that is rendered five lines below.
   *
   * PRESENTED, NOT COMPUTED. The effect runs after the panel is in the document, which is the
   * distinction between this and "the engine finished": an analysis that completes into a failure
   * branch, a deferred game, or a player who has already navigated away is not a reveal anybody
   * saw.
   *
   * Keyed on the decision so a re-render, a StrictMode double-invoke or a parent update cannot
   * count one reveal twice -- every rate in the funnel has this as its denominator.
   */
  useEffect(() => {
    if (!decisionId) return;
    if (trialEventSeen("reveal_presented", decisionId)) return;
    const at = new Date().toISOString();
    recordTrialEvent({ name: "reveal_presented", at, decisionId });
    recordTrialEvent({
      name: "reveal_kind_presented",
      at,
      decisionId,
      // `silence` is a branch, not an absence: see the type's comment on why it has to be counted.
      kind: oneThing?.kind ?? "silence",
      });
  }, [decisionId, oneThing?.kind]);

  return (
    <section className="reveal-panel" aria-label="חשיפה">
      {/* 1 -- before any number */}
      <section className="reveal-block reveal-limits">
        <h3>
          <AlertTriangle size={14} /> מה ההחלטה הזאת עדיין לא אומרת
        </h3>
        <ul>
          {limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        {/*
         * Separated from the list above on purpose. Everything in that list is derived from
         * this position; this one is a property of the build and is true of every position, so
         * rendering it as a sibling of the others would put a constant among measurements.
         */}
        <p className="reveal-build-limit">{BUILD_LIMIT}</p>
      </section>

      {/* 2 -- one thing */}
      <section className="reveal-block reveal-one-thing">
        <h3>
          <Target size={14} /> מה קרה כאן
        </h3>
        {oneThing ? (
          <>
            <p className="one-thing-text">{oneThing.text}</p>
            {/*
              * The event above, what it points at here. Two elements rather than one sentence,
              * because they are not equally certain: the first is what the record holds, the
              * second is a reading of it. A branch with nothing to point at renders nothing.
              */}
            {oneThing.note && <p className="one-thing-note">{oneThing.note}</p>}
            <p className="one-thing-basis">מבוסס על: {oneThing.basis}</p>
          </>
        ) : (
          /*
           * Two reasons for silence, two sentences. The old single sentence claimed "you chose
           * inside the evaluation noise" on a band where the loss was 31-99cp -- above the noise
           * by the file's own constant -- and asserted the confidence matched even at 5/5, which
           * nothing had measured. Section 4.5: distinct states, distinct rendering.
           */
          <p className="one-thing-none">
            {silenceBasis(inputs) === "inside-noise" ? (
              <>
                אין כאן דבר שהמדידה תומכת באמירתו. בחרת בתוך רעש ההערכה, והביטחון שלך לא היה נמוך
                ממנו. זו תוצאה תקינה, לא מסך ריק.
              </>
            ) : (
              <>
                אין כאן דבר שהמדידה תומכת באמירתו. המהלך עלה {inputs.cpLoss} ס״פ — יותר מרעש
                ההערכה ({ENGINE_NOISE_CP}) ופחות מהסף שממנו הכלי הזה אומר משהו ({MATERIAL_LOSS_CP}).
                בטווח הזה החלטה בודדת לא נבדלת מהחלטה מוצלחת, ולכן אין כאן משפט. זו תוצאה תקינה,
                לא מסך ריק.
              </>
            )}
          </p>
        )}
      </section>

      {/* 3 -- the next question */}
      <section className="reveal-block reveal-question">
        <h3>
          <HelpCircle size={14} /> מה שווה לבדוק
        </h3>
        <p>{question}</p>
        {statedKnown.trim() && <p className="reveal-echo">הקריאה שלך הייתה: "{statedKnown}"</p>}
      </section>

      {/* 4 -- everything else, collapsed */}
      <details className="reveal-secondary">
        <summary>
          <ChevronDown size={13} /> פרטי הניתוח
        </summary>
        <div className="reveal-secondary-body">
          <div className="reveal-metric">
            <span>הערכת המנוע</span>
            {analysis ? (
              <Value provenance={{ kind: "engine", source: "local_sf18", depth: analysis.depth }}>
                {formatEvaluation(analysis.scoreCp, analysis.mate)}
              </Value>
            ) : (
              <NotMeasured reason="לא הושלם ניתוח לעמדה זו" />
            )}
          </div>
          {/*
            * Section 4.5: a measured cost and a cost measured against a ceiling are different
            * states, and "0 ס״פ" is where they look most alike. On a forced mate the number is
            * the distance from MATE_SCORE, so zero means "nothing was better than this" and not
            * "this move changed nothing" -- opposite readings, identical glyphs. The unit says
            * which one it is; the limits list above says what the clamp discarded.
            */}
          <div className="reveal-metric">
            <span>עלות ההחלטה</span>
            <Value provenance={{ kind: "engine", source: "local_sf18", depth: inputs.depth }}>
              {inputs.clampedMate ? `${inputs.cpLoss} ס״פ מול תקרת מט` : `${inputs.cpLoss} ס״פ`}
            </Value>
          </div>
          <div className="reveal-metric">
            <span>מהלך המנוע</span>
            <Value provenance={{ kind: "engine", source: "local_sf18", depth: inputs.depth }}>
              {inputs.bestMove}
            </Value>
          </div>
          <div className="reveal-metric">
            <span>המהלך שלך</span>
            <Value provenance={{ kind: "player", unit: "נרשם לפני החשיפה" }}>
              {inputs.chosenMove}
            </Value>
          </div>
          <div className="reveal-pv" dir="ltr">
            {pv.length ? pv.map((m, i) => <span key={`${m}-${i}`}>{m}</span>) : <span>—</span>}
          </div>
        </div>
      </details>
    </section>
  );
}
