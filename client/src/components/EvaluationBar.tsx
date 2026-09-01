import { formatEvaluation } from "@/lib/game-data";
import { isStale, type EngineLine } from "@/lib/engine-line";
import { NotMeasured, Value } from "./Value";

/**
 * The evaluation bar. Renders nothing numeric until the engine has spoken about this position.
 *
 * Section 4.2: the evaluation number is the most visually attractive element on the screen and
 * the least useful one. It carries its depth and its source, or it does not render.
 */
export function EvaluationBar({
  analysis,
  currentFen,
}: {
  analysis: EngineLine | null;
  /** The position on screen right now. Staleness is derived here rather than passed in, so a
   *  caller cannot forget to mark it (section 4.3, FRESHNESS). */
  currentFen: string;
}) {
  const stale = isStale(analysis, currentFen);
  if (!analysis) {
    return (
      <div className="evaluation-instrument evaluation-empty" aria-label="אין הערכת מנוע">
        <div className="evaluation-track evaluation-track-empty" />
        <NotMeasured reason="המנוע טרם ניתח את העמדה הזו" />
      </div>
    );
  }
  const { scoreCp, mate, depth } = analysis;
  const whiteShare =
    mate !== undefined
      ? mate > 0
        ? 0.92
        : 0.08
      : Math.max(0.08, Math.min(0.92, 0.5 + scoreCp / 1400));
  return (
    <div
      className={`evaluation-instrument${stale ? " is-stale" : ""}`}
      aria-label={`הערכת מנוע ${formatEvaluation(scoreCp, mate)} בעומק ${depth}${stale ? " (לא מעודכן)" : ""}`}
    >
      <span className="eval-marker top">לבן</span>
      <div className="evaluation-track">
        <div className="evaluation-white" style={{ height: `${whiteShare * 100}%` }} />
      </div>
      {/*
        * THE NUMBER CAME OUT OF THE RAIL, because inside it the number was not readable.
        *
        * It was absolutely positioned in the track, rotated 90 degrees, in a column 16px wide --
        * so the digits were clipped by the track's own borders on both sides, over a ground that
        * is two colours at once and moves with the evaluation. A blind critic, given only the
        * screenshots, called it illegible; that is the correct reading, and no halo fixes a box
        * narrower than the glyphs in it.
        *
        * IT IS A READING, SO IT IS SET LIKE ONE: horizontal, in the reading face, under the thing
        * it measures. Nothing about which number is shown, or when, or from what, has changed --
        * `Value` still carries the engine provenance, and `RevealPanel` still keeps the number
        * itself inside a collapsed disclosure for the reason written there.
        */}
      <span className="evaluation-value">
        <Value provenance={{ kind: "engine", source: "local_sf18", depth, stale }}>
          {formatEvaluation(scoreCp, mate)}
        </Value>
      </span>
      <span className="eval-marker bottom">שחור</span>
    </div>
  );
}
