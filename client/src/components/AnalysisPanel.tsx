/** Style: Modernist Control Room — structured, instrument-like analysis column. */
import { Activity, Cpu } from "lucide-react";
import { formatEvaluation, sanPrincipalVariation, type GameSnapshot } from "@/lib/game-data";
import type { EngineLine, EngineStatus } from "@/lib/stockfish";
import { NotMeasured, Value } from "./Value";

interface AnalysisPanelProps {
  analysis: EngineLine | null;
  status: EngineStatus;
  fen: string;
  activeMove?: GameSnapshot;
  material: { white: number; black: number };
  onAnalyze: () => void;
}

const modeLabel: Record<EngineStatus["mode"], string> = {
  loading: "מכין מנוע",
  ready: "מנוע זמין",
  thinking: "מחשב קו",
  error: "המנוע אינו זמין",
};

export function AnalysisPanel({ analysis, status, fen, material, onAnalyze }: AnalysisPanelProps) {
  const pv = analysis ? sanPrincipalVariation(fen, analysis.pv) : [];
  // The principal variation is replayed against `fen`. If any move is illegal there, the line
  // did not come from this position and the truncated remainder must not be shown as if it had.
  const pvTruncated = Boolean(analysis) && pv.length < Math.min(analysis!.pv.length, 8);

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
              {analysis ? (
                <Value provenance={{ kind: "engine", source: "local_sf18", depth: analysis.depth }}>
                  {formatEvaluation(analysis.scoreCp, analysis.mate)}
                </Value>
              ) : (
                <NotMeasured reason="טרם נותחה עמדה זו" />
              )}
            </strong>
          </div>
          <span className={`engine-status ${status.mode}`}>
            <i />
            {modeLabel[status.mode]}
          </span>
        </div>
        {status.mode === "error" && <p className="score-caption">{status.detail}</p>}
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
          {analysis && <span className="data-chip">D{analysis.depth || "–"}</span>}
        </div>
        <div className="pv-line" dir="ltr">
          {pv.length ? (
            pv.map((move, index) => (
              <span key={`${move}-${index}`} className={index === 0 ? "pv-first" : ""}>
                {move}
              </span>
            ))
          ) : (
            <NotMeasured reason="אין קו מנוע לעמדה זו" />
          )}
        </div>
        {pvTruncated && (
          <p className="pv-warning">
            הקו נקטע — חלק ממנו אינו חוקי בעמדה הזו, ולכן אינו מוצג. ייתכן שהוא חושב לעמדה אחרת.
          </p>
        )}
      </section>

      <section className="analysis-section">
        <div className="section-heading">
          <span>מאזן חומרים</span>
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
          <b>
            <Value provenance={{ kind: "player", unit: "נספר מהלוח" }}>{material.white}</Value>
          </b>
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
          <b>
            <Value provenance={{ kind: "player", unit: "נספר מהלוח" }}>{material.black}</Value>
          </b>
        </div>
      </section>
    </aside>
  );
}
