/**
 * RUNNING A DRILL (section 3.5, R5).
 *
 * The drill is the only thing that can change a claim's grade, because it is the only evidence
 * that postdates the claim. It runs with the SAME commit-before-reveal protocol as any other
 * decision -- the CommitmentScreen is reused, not reimplemented, so a drill decision is captured
 * exactly like a normal one and lands in the same record.
 *
 * What would refute the claim is shown FIRST, before the first position, and stays visible while
 * the drill runs. The player is told what they are being tested for. A drill that hides its own
 * refutation condition is a drill the player cannot argue with.
 *
 * The result is reported either way. Especially when it refutes.
 */
import { useState } from "react";
import { AlertTriangle, FlaskConical, Loader2 } from "lucide-react";
import type { DrillSpec } from "@shared/claim";
import { Value } from "./Value";

export type DrillStage = "briefing" | "running" | "reporting" | "done";

export interface DrillProgress {
  /** Positions completed so far. */
  completed: number;
  total: number;
}

interface DrillBriefingProps {
  drill: DrillSpec;
  progress: DrillProgress;
  stage: DrillStage;
  verdict: { description: string; refuted: boolean } | null;
  error?: string;
  onStart: () => void;
  onFinish: () => void;
}

/**
 * The drill's own panel. It does not render positions -- the board and CommitmentScreen do that,
 * unchanged. This carries the pre-registration, the progress, and the verdict.
 */
export function DrillRunner({
  drill,
  progress,
  stage,
  verdict,
  error,
  onStart,
  onFinish,
}: DrillBriefingProps) {
  return (
    <section className="drill-runner" aria-label="דריל">
      <header className="drill-header">
        <FlaskConical size={14} />
        <span>דריל — בדיקה קדימה</span>
      </header>

      {/* R5 on screen: what would disprove this, before the first position and throughout. */}
      <div className="drill-prereg">
        <span>נרשם מראש, לפני העמדה הראשונה</span>
        <p>{drill.refutation_condition}</p>
      </div>

      <p className="drill-explain">
        {drill.fens.length} עמדות שעדיין לא הכרעת בהן. כל אחת נרשמת כמו כל החלטה אחרת — קודם המהלך
        והקריאה שלך, ורק אחר כך המנוע. התוצאה תדווח בין אם היא מאשרת ובין אם היא מפריכה.
      </p>

      {stage === "briefing" && (
        <button type="button" className="drill-start" onClick={onStart}>
          התחילו את הדריל
        </button>
      )}

      {stage === "running" && (
        <div className="drill-progress">
          <Value label="הוכרעו" provenance={{ kind: "player", unit: "בדריל הזה" }}>
            {progress.completed}/{progress.total}
          </Value>
        </div>
      )}

      {/*
        * THE EMERGENCY EXIT (Nielsen heuristic 3, "user control and freedom").
        *
        * A drill is a fixed set of positions and there was no way out of one. Starting it -- by
        * accident, or on a phone about to run out of battery -- committed the player to finishing
        * every position or abandoning the tab. That is the definition of a trap, and it is the one
        * place in this product where a control the player cannot leave sits between them and the
        * rest of the app.
        *
        * WHAT LEAVING MUST NOT DO, and this is why the button carries a sentence rather than an
        * icon. An abandoned drill produces NO result: `ProspectiveDrillResult` has `predicted` and
        * `observed` and no third state, and inventing one would let a partial drill grade a claim
        * on the positions the player happened to reach. R5 is about evidence that postdates the
        * claim AND was bounded in advance; seven of twenty positions is neither.
        *
        * WHAT IT MUST NOT UNDO EITHER. The decisions already recorded stay. They were real
        * decisions, taken under the same commit-before-reveal protocol as any other, and the
        * record is append-only. Deleting them to "clean up" an abandoned drill would be the one
        * thing this codebase never does. The button says both halves, because a player who
        * believes leaving erases their work will finish a drill they wanted to leave.
        */}
      {(stage === "briefing" || stage === "running") && (
        <button type="button" className="drill-abandon" onClick={onFinish}>
          {stage === "briefing"
            ? "לא עכשיו — חזרה בלי להתחיל"
            : `לצאת מהדריל (${progress.completed} מתוך ${progress.total})`}
        </button>
      )}

      {stage === "running" && (
        <p className="drill-abandon-note">
          יציאה עכשיו לא תדרג את הטענה — דריל חלקי אינו ראיה, וזה בדיוק מה שנרשם מראש בא למנוע.
          {progress.completed > 0
            ? ` ${progress.completed} ההחלטות שכבר רשמת נשארות ברשומה; הן החלטות אמיתיות ונספרות ככל האחרות.`
            : " שום החלטה עוד לא נרשמה בדריל הזה."}
        </p>
      )}

      {stage === "reporting" && (
        <p className="drill-loading">
          <Loader2 size={14} /> מודד מול התנאי שנרשם מראש…
        </p>
      )}

      {error && (
        <p className="drill-error" role="alert">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      {stage === "done" && verdict && (
        <div className={`drill-verdict ${verdict.refuted ? "refuted" : "replicated"}`}>
          <p>{verdict.description}</p>
          <button type="button" className="drill-finish" onClick={onFinish}>
            חזרה
          </button>
        </div>
      )}
    </section>
  );
}
