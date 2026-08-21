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
