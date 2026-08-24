/** Style: Modernist Control Room — structured, instrument-like analysis column. */
import { Activity, Cpu } from "lucide-react";
import { formatEvaluation, sanPrincipalVariation, type GameSnapshot } from "@/lib/game-data";
import { isStale, type EngineLine, type EngineStatus } from "@/lib/engine-line";
import { pvBacking, rootChoice, type RootChoice } from "@/lib/pv-support";
import { NotMeasured, Value } from "./Value";

interface AnalysisPanelProps {
  analysis: EngineLine | null;
  /** The runner-up from the same search, when one was asked for. */
  alternative?: EngineLine | null;
  status: EngineStatus;
  fen: string;
  activeMove?: GameSnapshot;
  material: { white: number; black: number };
  onAnalyze: () => void;
}

/** How many moves of the line the panel has room for. Separate from what the search backs. */
const DISPLAY_LIMIT = 8;

/**
 * What the engine's choice at the root is worth, in one sentence.
 *
 * The panel used to show a line and a number and nothing else, and a reader takes that to mean
 * the first move is right. Often it only means the engine broke a tie, and the panel already
 * says elsewhere that differences under 30 centipawns say nothing here -- it just never applied
 * that to the move it was recommending.
 */
function ChoiceReading({ choice }: { choice: RootChoice }) {
  if (choice.kind === "alone") {
    return (
      <NotMeasured reason="חושב קו אחד בלבד לעמדה הזו, ולכן אין למהלך הזה מול מה להישקל." />
    );
  }
  if (choice.kind === "mate") {
    return <p className="pv-choice">אחד הקווים הוא מט כפוי. ההפרש כאן אינו כמות של סנטיפונים.</p>;
  }
  if (choice.kind === "preference") {
    return (
      <p className="pv-choice pv-choice-tie">
        המנוע מעדיף את {choice.best.move} על פני {choice.runnerUp.move} ב-{choice.gapCp} ס״פ — בתוך
        רעש ההערכה. זו העדפה, לא סיבה: המנוע הכריע בין שתי אפשרויות שהוא לא באמת מבדיל ביניהן.
      </p>
    );
  }
  return (
    <p className="pv-choice">
      {choice.best.move} עדיף על {choice.runnerUp.move} ב-{choice.gapCp} ס״פ. זה מחוץ לרעש
      ההערכה, ולכן זו סיבה — ההפרש הוא מה שהחלופה מפסידה.
    </p>
  );
}

const modeLabel: Record<EngineStatus["mode"], string> = {
  loading: "מכין מנוע",
  ready: "מנוע זמין",
  thinking: "מחשב קו",
  error: "המנוע אינו זמין",
};

export function AnalysisPanel({
  analysis,
  alternative,
  status,
  fen,
  material,
  onAnalyze,
}: AnalysisPanelProps) {
  const stale = isStale(analysis, fen);
  /*
   * The backing is computed on the FULL uci line before anything is trimmed for the screen, so
   * "the search ran out here" and "the panel ran out of room here" stay separable. They were
   * the same silent cut: sanPrincipalVariation sliced at 8 and nothing said so.
   */
  const backing = analysis && !stale ? pvBacking(analysis.pv, analysis.depth) : null;
  const backedMoves = backing?.backed.map((p) => p.move) ?? [];
  // A line computed for another position is not replayed against this one. Doing so produced a
  // short, valid-LOOKING variation via `catch { break }` -- defect 2's second half.
  const pv =
    analysis && !stale ? sanPrincipalVariation(analysis.fen, backedMoves, DISPLAY_LIMIT) : [];
  // The principal variation is replayed against `fen`. If any move is illegal there, the line
  // did not come from this position and the truncated remainder must not be shown as if it had.
  const pvTruncated =
    Boolean(analysis) && !stale && pv.length < Math.min(backedMoves.length, DISPLAY_LIMIT);
  /** Trimmed to fit, which is not the same as unsupported by the search. */
  const hiddenForSpace = Math.max(0, backedMoves.length - pv.length - (pvTruncated ? 1 : 0));
  /*
   * The runner-up is used only when it came from the SAME search as the best line.
   *
   * Structural, not a convention. Home has eight setAnalysis sites and only one of them also
   * sets the alternative; pairing them by hand would work until the ninth. Comparing the fen the
   * lines already carry makes a mismatched pair impossible however the state was written -- the
   * same reason EngineLine carries its own fen at all, and the same rule GATE-STALE enforces.
   */
  const pairedAlternative =
    alternative && analysis && alternative.fen === analysis.fen ? alternative : null;
  const choice =
    analysis && !stale
      ? rootChoice(
          [analysis, pairedAlternative]
            .filter((l): l is EngineLine => Boolean(l))
            .map((l) => ({ move: l.pv[0] ?? "", scoreCp: l.scoreCp, mate: l.mate })),
        )
      : null;

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
                <Value
                  provenance={{
                    kind: "engine",
                    source: "local_sf18",
                    depth: analysis.depth,
                    stale,
                  }}
                >
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
                {/*
                  * The plies of search below THIS move, not the root's depth.
                  *
                  * The chip above says D14 and means the root. The eighth move of the line had
                  * seven plies under it, and every move was printed in the same typeface, so the
                  * fall-off was invisible. Shown rather than cut at some quality bar nobody here
                  * has measured.
                  */}
                <i className="pv-depth" aria-label={`עומק שנותר ${backing!.backed[index].remainingDepth}`}>
                  {backing!.backed[index].remainingDepth}
                </i>
              </span>
            ))
          ) : (
            <NotMeasured
              reason={stale ? "הקו חושב לעמדה אחרת. נתחו מחדש." : "אין קו מנוע לעמדה זו"}
            />
          )}
        </div>
        {pv.length > 0 && (
          <p className="pv-note">
            המספר ליד כל מהלך הוא העומק שנותר מתחתיו. D{analysis!.depth} הוא העומק בשורש בלבד.
          </p>
        )}
        {pvTruncated && (
          <p className="pv-warning">
            הקו נקטע — חלק ממנו אינו חוקי בעמדה הזו, ולכן אינו מוצג. ייתכן שהוא חושב לעמדה אחרת.
          </p>
        )}
        {/*
          * Three different reasons a line can be short, and they used to look identical: the
          * search outran its depth, the panel ran out of room, or the moves were illegal here.
          */}
        {backing !== null && backing.dropped > 0 && (
          <p className="pv-note">
            {backing.dropped} מהלכים בסוף הקו חרגו מעומק החיפוש ואינם מוצגים. אין מאחוריהם חיפוש
            שהעומק שילם עליו.
          </p>
        )}
        {hiddenForSpace > 0 && (
          <p className="pv-note">עוד {hiddenForSpace} מהלכים בקו — לא הוצגו מחוסר מקום.</p>
        )}
        {choice && <ChoiceReading choice={choice} />}
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
