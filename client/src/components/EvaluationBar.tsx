import { formatEvaluation } from "@/lib/game-data";
import type { EngineLine } from "@/lib/stockfish";
import { NotMeasured, Value } from "./Value";

/**
 * The evaluation bar. Renders nothing numeric until the engine has spoken about this position.
 *
 * Section 4.2: the evaluation number is the most visually attractive element on the screen and
 * the least useful one. It carries its depth and its source, or it does not render.
 */
export function EvaluationBar({ analysis }: { analysis: EngineLine | null }) {
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
      className="evaluation-instrument"
      aria-label={`הערכת מנוע ${formatEvaluation(scoreCp, mate)} בעומק ${depth}`}
    >
      <span className="eval-marker top">לבן</span>
      <div className="evaluation-track">
        <div className="evaluation-white" style={{ height: `${whiteShare * 100}%` }} />
        <span className="evaluation-value">
          <Value provenance={{ kind: "engine", source: "local_sf18", depth }}>
            {formatEvaluation(scoreCp, mate)}
          </Value>
        </span>
      </div>
      <span className="eval-marker bottom">שחור</span>
    </div>
  );
}
