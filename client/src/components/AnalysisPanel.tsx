/** Style: Modernist Control Room — structured, instrument-like analysis column; no generic card stack. */
import { Activity, ArrowUpRight, Cpu, Sparkles } from "lucide-react";
import { formatEvaluation, sanPrincipalVariation, type GameSnapshot } from "@/lib/game-data";
import type { EngineLine, EngineStatus } from "@/lib/stockfish";

interface AnalysisPanelProps {
  analysis: EngineLine;
  status: EngineStatus;
  fen: string;
  activeMove?: GameSnapshot;
  material: { white: number; black: number };
  onAnalyze: () => void;
  onApplySuggestion: () => void;
}

const modeLabel: Record<EngineStatus["mode"], string> = {
  loading: "מכין מנוע",
  ready: "מנוע זמין",
  thinking: "מחשב קו",
  error: "ניתוח מקומי",
};

export function AnalysisPanel({
  analysis,
  status,
  fen,
  activeMove,
  material,
  onAnalyze,
  onApplySuggestion,
}: AnalysisPanelProps) {
  const pv = sanPrincipalVariation(fen, analysis.pv);
  const advantage =
    analysis.mate !== undefined
      ? analysis.mate > 0
        ? "לבן בדרך למט"
        : "שחור בדרך למט"
      : analysis.scoreCp > 45
        ? "יתרון מדוד ללבן"
        : analysis.scoreCp < -45
          ? "יתרון מדוד לשחור"
          : "העמדה כמעט מאוזנת";
  return (
    <aside className="analysis-column" aria-label="עמודת ניתוח">
      <section className="analysis-hero">
        <div className="analysis-kicker">
          <Cpu size={14} /> STOCKFISH 18
        </div>
        <div className="score-row">
          <div>
            <p className="score-label">הערכת עמדה</p>
            <strong className="score-number">
              {formatEvaluation(analysis.scoreCp, analysis.mate)}
            </strong>
          </div>
          <span className={`engine-status ${status.mode}`}>
            <i />
            {modeLabel[status.mode]}
          </span>
        </div>
        <p className="score-caption">{status.mode === "error" ? status.detail : advantage}</p>
        <button
          className="analysis-action"
          onClick={onAnalyze}
          disabled={status.mode === "thinking"}
        >
          <Activity size={16} /> {status.mode === "thinking" ? "מנתח…" : "נתח עמדה"}
        </button>
      </section>
      <section className="analysis-section principal-line">
        <div className="section-heading">
          <span>קו עיקרי</span>
          <span className="data-chip">D{analysis.depth || "–"}</span>
        </div>
        <div className="pv-line" dir="ltr">
          {pv.length ? (
            pv.map((move, index) => (
              <span key={`${move}-${index}`} className={index === 0 ? "pv-first" : ""}>
                {move}
              </span>
            ))
          ) : (
            <span className="pv-empty">מחכה לשורת מנוע…</span>
          )}
        </div>
        {analysis.bestMove && analysis.bestMove !== "(none)" && (
          <button className="suggestion-button" onClick={onApplySuggestion}>
            <ArrowUpRight size={15} /> החל את המהלך המומלץ
          </button>
        )}
      </section>
      <section className="analysis-section">
        <div className="section-heading">
          <span>מאזן חומרים</span>
          <span className="data-chip">LIVE</span>
        </div>
        <div className="material-row">
          <span>לבן</span>
          <div className="material-track">
            <i
              style={{
                width: `${(material.white / Math.max(material.white, material.black, 1)) * 100}%`,
              }}
            />
          </div>
          <b>{material.white}</b>
        </div>
        <div className="material-row black">
          <span>שחור</span>
          <div className="material-track">
            <i
              style={{
                width: `${(material.black / Math.max(material.white, material.black, 1)) * 100}%`,
              }}
            />
          </div>
          <b>{material.black}</b>
        </div>
      </section>
      <section className="analysis-section observation-section">
        <div className="section-heading">
          <span>תצפית</span>
          <Sparkles size={14} />
        </div>
        <p>
          {activeMove
            ? `אחרי ${activeMove.san}, ${advantage.toLowerCase()}. בדקו את האיום על המרכז לפני שממשיכים.`
            : "בחרו מהלך או התחילו משחק חדש כדי לקבל קריאת עמדה."}
        </p>
      </section>
    </aside>
  );
}
