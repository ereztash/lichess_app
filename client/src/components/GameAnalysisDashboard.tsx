import { Activity, AlertTriangle, BarChart3, Target, Zap } from "lucide-react";
import type { GameSnapshot } from "@/lib/game-data";
import type { EngineLine } from "@/lib/stockfish";

interface Props {
  moves: GameSnapshot[];
  analyses: Record<number, EngineLine>;
  currentPly: number;
  isAnalyzing: boolean;
  progress: { done: number; total: number };
  onAnalyzeGame: () => void;
  onNavigate: (ply: number) => void;
}

type Severity = "stable" | "inaccuracy" | "mistake" | "blunder";

interface Point {
  ply: number;
  move: GameSnapshot;
  whiteCp: number;
  lossCp?: number;
  severity?: Severity;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function whitePerspective(line: EngineLine, fen: string) {
  const sideToMove = fen.split(" ")[1];
  return sideToMove === "w" ? line.scoreCp : -line.scoreCp;
}

function classify(lossCp: number): Severity {
  if (lossCp >= 180) return "blunder";
  if (lossCp >= 90) return "mistake";
  if (lossCp >= 45) return "inaccuracy";
  return "stable";
}

function phaseForPly(ply: number) {
  if (ply < 20) return "פתיחה";
  if (ply < 50) return "אמצע";
  return "סיום";
}

export function GameAnalysisDashboard({ moves, analyses, currentPly, isAnalyzing, progress, onAnalyzeGame, onNavigate }: Props) {
  const points: Point[] = moves.flatMap((move, ply) => {
    const line = analyses[ply];
    return line ? [{ ply, move, whiteCp: whitePerspective(line, move.fen) }] : [];
  });

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    if (point.ply !== prev.ply + 1) continue;
    const mover = point.move.color;
    const lossCp = mover === "w"
      ? Math.max(0, prev.whiteCp - point.whiteCp)
      : Math.max(0, point.whiteCp - prev.whiteCp);
    point.lossCp = lossCp;
    point.severity = classify(lossCp);
  }

  const losses = points.map(point => point.lossCp).filter((value): value is number => value !== undefined);
  const avgLoss = losses.length ? Math.round(losses.reduce((sum, value) => sum + value, 0) / losses.length) : 0;
  const mistakes = points.filter(point => point.severity === "mistake").length;
  const blunders = points.filter(point => point.severity === "blunder").length;
  const critical = points
    .filter(point => (point.lossCp ?? 0) >= 45)
    .sort((a, b) => (b.lossCp ?? 0) - (a.lossCp ?? 0))
    .slice(0, 5);

  const coverage = moves.length ? Math.round((points.length / moves.length) * 100) : 0;
  const chartWidth = 760;
  const chartHeight = 220;
  const left = 42;
  const right = 20;
  const top = 22;
  const bottom = 34;
  const innerWidth = chartWidth - left - right;
  const innerHeight = chartHeight - top - bottom;
  const xFor = (ply: number) => left + (moves.length <= 1 ? 0 : (ply / (moves.length - 1)) * innerWidth);
  const yFor = (cp: number) => top + innerHeight / 2 - (clamp(cp, -600, 600) / 600) * (innerHeight / 2 - 6);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(point.ply).toFixed(1)},${yFor(point.whiteCp).toFixed(1)}`).join(" ");
  const activeX = currentPly >= 0 ? xFor(currentPly) : left;

  const phaseStats = ["פתיחה", "אמצע", "סיום"].map(label => {
    const phaseLosses = points
      .filter(point => phaseForPly(point.ply) === label && point.lossCp !== undefined)
      .map(point => point.lossCp as number);
    return {
      label,
      value: phaseLosses.length ? Math.round(phaseLosses.reduce((sum, value) => sum + value, 0) / phaseLosses.length) : null,
    };
  });

  return (
    <section className="analysis-report" aria-label="ניתוח המשחק">
      <div className="report-heading">
        <div>
          <span className="report-kicker"><Activity size={14} /> GAME ANALYSIS</span>
          <h2>מה קרה במשחק — ואיפה הוא השתנה</h2>
          <p>הערכות Stockfish מכל עמדה הופכות כאן לעקומת יתרון, אובדן לפי מהלך ורגעים קריטיים.</p>
        </div>
        <button className="report-action" onClick={onAnalyzeGame} disabled={isAnalyzing || !moves.length}>
          <Zap size={15} />
          {isAnalyzing ? `מנתח ${progress.done}/${progress.total}` : coverage === 100 ? "רענן ניתוח" : "נתח את כל המשחק"}
        </button>
      </div>

      <div className="report-summary-grid">
        <article className="report-stat report-stat-primary"><span>כיסוי</span><strong>{coverage}%</strong><small>{points.length}/{moves.length} עמדות</small></article>
        <article className="report-stat"><span>אובדן ממוצע</span><strong>{losses.length ? avgLoss : "—"}</strong><small>{losses.length ? "centipawns" : "נדרש ניתוח מלא"}</small></article>
        <article className="report-stat"><span>טעויות</span><strong>{mistakes}</strong><small>90–179 cp</small></article>
        <article className="report-stat report-stat-danger"><span>טעויות חמורות</span><strong>{blunders}</strong><small>180+ cp</small></article>
      </div>

      <div className="report-grid">
        <article className="report-card report-chart-card">
          <div className="report-card-title"><BarChart3 size={17} /><div><b>עקומת הערכה</b><span>מעל האפס — יתרון ללבן; מתחת — לשחור</span></div></div>
          <div className="eval-chart-wrap">
            {points.length >= 2 ? (
              <svg className="eval-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="עקומת הערכת Stockfish לאורך המשחק">
                <line x1={left} x2={chartWidth - right} y1={yFor(0)} y2={yFor(0)} className="chart-zero" />
                <line x1={left} x2={chartWidth - right} y1={yFor(300)} y2={yFor(300)} className="chart-guide" />
                <line x1={left} x2={chartWidth - right} y1={yFor(-300)} y2={yFor(-300)} className="chart-guide" />
                <path d={path} className="chart-line" />
                <line x1={activeX} x2={activeX} y1={top} y2={chartHeight - bottom} className="chart-active" />
                {points.map(point => (
                  <circle
                    key={point.ply}
                    cx={xFor(point.ply)}
                    cy={yFor(point.whiteCp)}
                    r={point.ply === currentPly ? 5 : 3}
                    className={`chart-point severity-${point.severity ?? "stable"}`}
                    onClick={() => onNavigate(point.ply)}
                  />
                ))}
                <text x={6} y={yFor(300) + 4} className="chart-label">+3</text>
                <text x={15} y={yFor(0) + 4} className="chart-label">0</text>
                <text x={7} y={yFor(-300) + 4} className="chart-label">−3</text>
              </svg>
            ) : <div className="report-empty">נתח עוד עמדות כדי לראות את צורת המשחק.</div>}
          </div>
          <div className="chart-legend"><span><i className="legend-good" /> יציב</span><span><i className="legend-warn" /> אי־דיוק</span><span><i className="legend-bad" /> טעות</span><span><i className="legend-critical" /> חמורה</span></div>
        </article>

        <article className="report-card critical-card">
          <div className="report-card-title"><Target size={17} /><div><b>רגעים קריטיים</b><span>המהלכים עם אובדן ההערכה הגדול ביותר</span></div></div>
          <div className="critical-list">
            {critical.length ? critical.map(point => (
              <button key={point.ply} onClick={() => onNavigate(point.ply)} className={`critical-row severity-${point.severity}`}>
                <span className="critical-index">{Math.ceil((point.ply + 1) / 2)}.</span>
                <b>{point.move.san}</b>
                <span>{point.lossCp} cp</span>
                <small>{phaseForPly(point.ply)}</small>
              </button>
            )) : <div className="report-empty"><AlertTriangle size={18} /> עדיין אין מספיק נקודות להשוואה.</div>}
          </div>
        </article>
      </div>

      <article className="report-card phase-card">
        <div className="report-card-title"><BarChart3 size={17} /><div><b>איפה האיכות נשברת</b><span>אובדן centipawn ממוצע לפי שלב</span></div></div>
        <div className="phase-grid">
          {phaseStats.map(phase => (
            <div key={phase.label} className="phase-block">
              <span>{phase.label}</span>
              <strong>{phase.value === null ? "—" : phase.value}</strong>
              <div className="phase-track"><i style={{ width: `${phase.value === null ? 0 : Math.min(100, Math.max(6, phase.value / 2))}%` }} /></div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
