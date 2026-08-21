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
import { AlertTriangle, ChevronDown, HelpCircle, Target } from "lucide-react";
import { formatEvaluation, sanPrincipalVariation } from "@/lib/game-data";
import { inferenceLimits, nextQuestion, theOneThing, type RevealInputs } from "@/lib/reveal";
import type { EngineLine } from "@/lib/engine-line";
import { NotMeasured, Value } from "./Value";

interface RevealPanelProps {
  inputs: RevealInputs;
  analysis: EngineLine | null;
  /** The position the analysis was computed for. */
  fen: string;
  statedKnown: string;
}

export function RevealPanel({ inputs, analysis, fen, statedKnown }: RevealPanelProps) {
  const limits = inferenceLimits(inputs);
  const oneThing = theOneThing(inputs);
  const question = nextQuestion(inputs);
  const pv = analysis ? sanPrincipalVariation(fen, analysis.pv) : [];

  return (
    <section className="reveal-panel" aria-label="חשיפה">
      {/* 1 -- before any number */}
      <section className="reveal-block reveal-limits">
        <h3>
          <AlertTriangle size={14} /> מה אי אפשר להסיק מכאן
        </h3>
        <ul>
          {limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>

      {/* 2 -- one thing */}
      <section className="reveal-block reveal-one-thing">
        <h3>
          <Target size={14} /> הדבר האחד לעבוד עליו
        </h3>
        {oneThing ? (
          <>
            <p className="one-thing-text">{oneThing.text}</p>
            <p className="one-thing-basis">מבוסס על: {oneThing.basis}</p>
          </>
        ) : (
          <p className="one-thing-none">
            אין כאן דבר שהמדידה תומכת באמירתו. בחרת בתוך רעש ההערכה והביטחון שלך תאם. זו תוצאה
            תקינה, לא מסך ריק.
          </p>
        )}
      </section>

      {/* 3 -- the next question */}
      <section className="reveal-block reveal-question">
        <h3>
          <HelpCircle size={14} /> השאלה הבאה
        </h3>
        <p>{question}</p>
        {statedKnown.trim() && <p className="reveal-echo">הקריאה שלך הייתה: "{statedKnown}"</p>}
      </section>

      {/* 4 -- everything else, collapsed */}
      <details className="reveal-secondary">
        <summary>
          <ChevronDown size={13} /> מספרים ופרטי מנוע
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
          <div className="reveal-metric">
            <span>עלות ההחלטה</span>
            <Value provenance={{ kind: "engine", source: "local_sf18", depth: inputs.depth }}>
              {inputs.cpLoss} ס״פ
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
