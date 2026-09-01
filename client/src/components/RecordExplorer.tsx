/**
 * THE REVEAL IS A PATH. THIS IS EVERYTHING ELSE, AND IT IS BEHIND ONE STEP (LAW 2, P1.7).
 *
 * WHAT IT REPLACES. The reveal column rendered nine things at once: the reveal, the value question,
 * the engine's lines, a rule composer, a drill runner, the whole-game review, the claim panel, the
 * learning queue, the record dashboard and the Lichess layers. Every one of them is worth having
 * and none of them is what the player came to that screen for -- they came to find out what the
 * decision they just made turned out to be. A column of nine sections does not offer nine things;
 * it offers a search.
 *
 * SO THE MODE IS THE STRUCTURE. `shared/interaction-mode.ts` distinguishes `REVEAL` -- whose one
 * central thing is "the one thing this decision showed" -- from `EXPLORE`, whose central thing is
 * "the position being looked at". They are different states of the same screen and they now render
 * as different states of the same screen.
 *
 * `EXPLORE` IS THE ONE MODE WITH NOTHING AT STAKE, and that is what makes it safe to put everything
 * in it. The decision is committed, revealed and stored; the engine has already spoken. Nothing on
 * this surface can change what any of those said, which is exactly why it may show all of it at
 * once when the player has asked for it.
 *
 * WHAT IS NOT HERE, AND WHY. The rule composer stays with the reveal: it acts on the decision that
 * was just revealed, and burying the one thing the product wants a player to do with a finding
 * would break its own loop. A running drill or transfer stays too -- a run in progress is `TEST`,
 * not `EXPLORE`, and its progress is not something to go looking for.
 *
 * SEVEN PROPS AND NOT TWENTY-TWO, grouped by the thing each describes. A component whose parameter
 * list is a flat spill of its parent's state has not been extracted; it has been relocated.
 */
import { Suspense } from "react";
import { Activity } from "lucide-react";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ClaimPanel } from "@/components/ClaimPanel";
import { LearningQueue } from "@/components/LearningQueue";
import { LichessLayersPanel } from "@/components/LichessLayersPanel";
import { EXPERIMENTAL_LEARNING_ENABLED } from "@/lib/features";
import { lazyChunk } from "@/lib/lazy-chunk";
import type { EngineLine, EngineStatus } from "@/lib/stockfish";
import type { AnalysisSource } from "@shared/analysis-source";
import type { RecordReading } from "@shared/record-service";
import type { GameSnapshot, Orientation } from "@/lib/game-data";

/*
 * THE SAME LAZY CHUNKS THE PAGE USED, and they matter more here: this surface renders only when a
 * player asks for it, so the dashboard's charting library and the review's curve are now behind a
 * click as well as behind an import. A record that is never explored never fetches either.
 */
const GameReview = lazyChunk(() =>
  import("@/components/GameReview").then((m) => ({ default: m.GameReview })),
);
const GameReviewProgress = lazyChunk(() =>
  import("@/components/GameReview").then((m) => ({ default: m.GameReviewProgress })),
);
const RecordDashboard = lazyChunk(() =>
  import("@/components/RecordDashboard").then((m) => ({ default: m.RecordDashboard })),
);

export interface RecordExplorerProps {
  /** The position on the board, and where it came from. */
  position: { fen: string; activeMove?: GameSnapshot; material: { white: number; black: number } };
  /** The engine's reading of that position, and the way to ask for one. */
  engine: {
    analysis: EngineLine | null;
    alternative: EngineLine | null;
    status: EngineStatus;
    onAnalyze: () => void;
  };
  /** The whole-game review: its progress, its result, or the button that starts it. */
  review: {
    progress: { done: number; total: number } | null;
    scores: number[] | null;
    error: string | null;
    orientation: Orientation;
    totalPlies: number;
    onRun: () => void;
  };
  /** The dashboard's reading, or undefined while the record has not answered. */
  record: RecordReading | undefined;
  /** The layers that need an account, and the source that decides whether they may be asked. */
  lichess: { source: AnalysisSource; enabled: boolean; onConnect: () => void };
  /**
   * The claim panel's one action.
   *
   * `undefined` AND NOT `null` FOR THE ERRORS, matching the panels' own props. The two mean the
   * same thing here -- nothing went wrong -- and a component that took one and passed the other
   * would be converting between them on every render for no reason.
   */
  claims: { onRunDrill: (claimId: string) => void; drillError?: string };
  /** The learning queue's. */
  learning: { onStart: (ruleId: string) => void; busy: boolean; error?: string };
}

export function RecordExplorer({
  position,
  engine,
  review,
  record,
  lichess,
  claims,
  learning,
}: RecordExplorerProps) {
  return (
    <div className="record-explorer">
      <AnalysisPanel
        analysis={engine.analysis}
        alternative={engine.alternative}
        status={engine.status}
        fen={position.fen}
        activeMove={position.activeMove}
        material={position.material}
        onAnalyze={engine.onAnalyze}
      />

      {/*
        THE GATE THAT USED TO BE HERE IS NOW THE SURFACE ITSELF. The whole-game review was offered
        only at `stage === "revealed"` -- after a decision in this game had been committed and the
        engine had spoken -- because showing it on import would put the machine first. This
        component renders only in `EXPLORE`, which is only reachable from a reveal, so the
        condition is the same one stated once instead of twice.
      */}
      {review.progress ? (
        <Suspense fallback={null}>
          <GameReviewProgress done={review.progress.done} total={review.progress.total} />
        </Suspense>
      ) : review.scores ? (
        <Suspense fallback={null}>
          <GameReview
            evalScores={review.scores}
            playerColor={review.orientation}
            totalPlies={review.totalPlies}
          />
        </Suspense>
      ) : (
        <section className="analysis-section game-review">
          <div className="section-heading">
            <span>סקירת משחק</span>
          </div>
          <p className="layer-intro">
            המנוע יעבור על כל העמדות במשחק וימדוד כמה עלה כל מהלך. זה רץ מקומית ולוקח זמן — ולכן זה
            כפתור, לא משהו שקורה מעצמו.
          </p>
          {review.error && <p className="layer-error">{review.error}</p>}
          <button className="layer-action" onClick={review.onRun}>
            <Activity size={14} /> נתחו את המשחק כולו
          </button>
        </section>
      )}

      {/*
        * THE READINGS OF THE RECORD, ALL IN THE ONE MODE THAT MAY SHOW THEM.
        *
        * The claim panel and the learning queue used to sit on the `deciding` branch, which is the
        * only state where they could contaminate what was being recorded (LAW 1). Here the decision
        * is on the record and the engine has answered it, so what is worth doing next is a question
        * this evidence can legitimately inform.
        */}
      <ClaimPanel onRunDrill={claims.onRunDrill} drillError={claims.drillError} />
      {EXPERIMENTAL_LEARNING_ENABLED && (
        <LearningQueue onStart={learning.onStart} busy={learning.busy} error={learning.error} />
      )}
      {record && (
        <Suspense fallback={null}>
          <RecordDashboard reading={record} />
        </Suspense>
      )}

      <LichessLayersPanel
        fen={position.fen}
        source={lichess.source}
        enabled={lichess.enabled}
        onConnect={lichess.onConnect}
      />
    </div>
  );
}
