import { Activity, LoaderCircle, Sigma } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyzeEval, type MoveEval } from "@shared/eval-analysis";
import { Rate, Score } from "./Value";

/**
 * The two views, in the order they appear, so the tab strip and the arrow keys read one list.
 *
 * A handler that indexed into JSX would drift the moment a third view arrived. This is the list;
 * the strip renders it and the keys walk it.
 */
const TABS = [
  { key: "curve", icon: Activity, label: "מהלך העמדה" },
  { key: "loss", icon: Sigma, label: "אובדן לפי מהלך" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Props = {
  /** White-perspective centipawns per ply, produced by the local engine. */
  evalScores: number[];
  playerColor: "w" | "b";
  /** Half-moves in the game, so phase boundaries are measured against the real length. */
  totalPlies: number;
};

const CLASS_LABEL: Record<MoveEval["classification"], string> = {
  best: "הטוב ביותר",
  excellent: "מצוין",
  good: "טוב",
  inaccuracy: "אי־דיוק",
  mistake: "טעות",
  blunder: "בלאנדר",
};

/** Severity is an ordered scale, so it is one hue stepped by lightness -- not four identities. */
function severityVar(c: MoveEval["classification"]): string {
  if (c === "blunder") return "var(--c-sev-3)";
  if (c === "mistake") return "var(--c-sev-2)";
  if (c === "inaccuracy") return "var(--c-sev-1)";
  return "var(--c-white-edge)";
}

/**
 * The whole game, measured.
 *
 * Every number here comes from the local engine (see lib/batch-analysis.ts), not from `[%eval]`
 * comments, so it works on a game Lichess never analysed.
 *
 * R1: each figure carries the count it was computed from. "45% accuracy" over five moves is a
 * different statement from the same number over eighty, and the screen must not hide which one
 * it is showing.
 */
export function GameReview({ evalScores, playerColor, totalPlies }: Props) {
  const [tab, setTab] = useState<TabKey>("curve");

  /**
   * Arrows walk the strip, Home and End jump to its ends, and focus follows the selection.
   *
   * `aria-selected` follows focus here rather than waiting for Enter, which the APG allows when
   * revealing a panel is cheap. Both panels are already computed -- `curve` and `losses` are
   * memoised above -- so arrowing across costs a re-render and nothing else.
   */
  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const at = TABS.findIndex((t) => t.key === tab);
    let next = at;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (at - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].key);
    document.getElementById(`review-tab-${TABS[next].key}`)?.focus();
  };
  const analysis = useMemo(
    () => analyzeEval(evalScores, playerColor, totalPlies),
    [evalScores, playerColor, totalPlies],
  );

  if (!analysis.hasEvals) {
    return (
      <section className="analysis-section game-review">
        <div className="section-heading">
          <span>סקירת משחק</span>
        </div>
        <p className="layer-muted">
          המשחק קצר מכדי למדוד עליו משהו. נדרשים לפחות ארבעה חצאי־מהלכים.
        </p>
      </section>
    );
  }

  const curve = analysis.evalCurve.map((value, ply) => ({
    ply,
    white: Math.max(0, value),
    black: Math.min(0, value),
    value,
  }));

  const losses = analysis.playerMoveEvals.map((m) => ({
    ply: m.ply,
    moveNumber: m.moveNumber,
    cpl: m.cpl,
    classification: m.classification,
  }));

  const n = analysis.playerMoveEvals.length;
  const worst = [...analysis.playerMoveEvals]
    .filter((m) => m.classification === "blunder" || m.classification === "mistake")
    .sort((a, b) => b.cpl - a.cpl)
    .slice(0, 4);

  return (
    <section className="analysis-section game-review">
      <div className="section-heading">
        <span>סקירת משחק</span>
        <span className="data-chip">STOCKFISH 18</span>
      </div>

      <div className="review-stats">
        {/*
         * "ציון דיוק", not "דיוק". Two different things were both called דיוק: this, the
         * Lichess-style exponential 0-100 score for one game, and the detector's accuracy RATE
         * -- the share of decisions under 30 centipawns of loss, which is what every bucket,
         * claim and calibration gap is built from. Same word, different quantities, both on
         * screen. The detector's keeps "דיוק"; this one is labelled as a score.
         *
         * Rendered through Score rather than by hand: the n used to sit on the next line, which
         * is honest by adjacency and enforceable by nothing.
         */}
        <div className="review-stat">
          <Score label="ציון דיוק למשחק הזה" value={analysis.accuracy} n={n} />
        </div>
        <div className="review-stat">
          <b dir="ltr">{analysis.avgCPL}</b>
          <span>אובדן סנטיפונים ממוצע</span>
        </div>
        <div className="review-stat">
          <Rate label="בלאנדרים" value={analysis.blunders} of={n} />
          <Rate label="טעויות" value={analysis.mistakes} of={n} />
        </div>
      </div>

      {/*
        * A REAL TABLIST, not the word.
        *
        * This declared `role="tablist"` with two `role="tab"` buttons and handled no key, which is
        * the same defect `GATE-KEYBOARD` was written for on the board: the role tells assistive
        * technology that the arrow keys move between tabs, and nothing moved. It was found by that
        * gate on its first run.
        *
        * The pattern, as the APG specifies it: one tab stop for the whole list, arrows between the
        * tabs, `aria-controls` pointing at the panel each one opens, and a `tabpanel` that names
        * the tab it belongs to. Two tabs make the wrap trivial -- either arrow toggles.
        */}
      <div className="review-tabs" role="tablist" aria-label="תצוגות הניתוח">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            id={`review-tab-${key}`}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`review-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onKeyDown={onTabKeyDown}
            onClick={() => setTab(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "curve" ? (
        <div role="tabpanel" id="review-panel-curve" aria-labelledby="review-tab-curve">
          {/* One series split at zero: above the line White stands better, below it Black does. */}
          <p className="chart-legend" dir="rtl">
            <i style={{ background: "var(--c-white-edge)" }} /> יתרון ללבן
            <i style={{ background: "var(--c-black-edge)" }} /> יתרון לשחור
          </p>
          <div className="chart-frame" dir="ltr">
            <ResponsiveContainer width="100%" height={168}>
              <AreaChart data={curve} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--c-grid)" vertical={false} />
                <XAxis dataKey="ply" tick={{ fontSize: "var(--panel-fine)" }} stroke="var(--c-axis)" />
                <YAxis tick={{ fontSize: "var(--panel-fine)" }} stroke="var(--c-axis)" width={38} />
                <ReferenceLine y={0} stroke="var(--c-axis)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline-strong)",
                    borderRadius: 0,
                    fontSize: "var(--panel-label)",
                  }}
                  labelFormatter={(ply) => `חצי־מהלך ${ply}`}
                  formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}`, "הערכה"]}
                />
                <Area
                  type="monotone"
                  dataKey="white"
                  stroke="var(--c-white-edge)"
                  strokeWidth={2}
                  fill="var(--c-white-edge)"
                  fillOpacity={0.22}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="black"
                  stroke="var(--c-black-edge)"
                  strokeWidth={2}
                  fill="var(--c-black-edge)"
                  fillOpacity={0.22}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div role="tabpanel" id="review-panel-loss" aria-labelledby="review-tab-loss">
          <p className="chart-legend" dir="rtl">
            <i style={{ background: "var(--c-sev-1)" }} /> אי־דיוק
            <i style={{ background: "var(--c-sev-2)" }} /> טעות
            <i style={{ background: "var(--c-sev-3)" }} /> בלאנדר
          </p>
          <div className="chart-frame" dir="ltr">
            <ResponsiveContainer width="100%" height={168}>
              <BarChart data={losses} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--c-grid)" vertical={false} />
                <XAxis dataKey="moveNumber" tick={{ fontSize: "var(--panel-fine)" }} stroke="var(--c-axis)" />
                <YAxis tick={{ fontSize: "var(--panel-fine)" }} stroke="var(--c-axis)" width={38} />
                <Tooltip
                  cursor={{ fill: "var(--c-grid)" }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline-strong)",
                    borderRadius: 0,
                    fontSize: "var(--panel-label)",
                  }}
                  labelFormatter={(m) => `מהלך ${m}`}
                  formatter={(v) => [`${Number(v)}`, "אובדן סנטיפונים"]}
                />
                <Bar dataKey="cpl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {losses.map((l) => (
                    <Cell key={l.ply} fill={severityVar(l.classification)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {worst.length > 0 && (
        <div className="review-moments">
          <h4>המהלכים שעלו הכי הרבה</h4>
          <ul>
            {worst.map((m) => (
              <li key={m.ply}>
                <span className="moment-move" dir="ltr">
                  {m.moveNumber}.{m.isWhite ? "" : ".."}
                </span>
                {/* The label carries the classification. Colour is a second encoding, never the only one. */}
                <span className="moment-class" style={{ color: severityVar(m.classification) }}>
                  {CLASS_LABEL[m.classification]}
                </span>
                <span className="moment-cpl" dir="ltr">
                  −{m.cpl}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="review-caveat">
        זו מדידה של העמדות במשחק הזה בלבד. היא לא אומרת דבר על השחמט שלך בכלל, ולא על מגמה — לשם כך
        צריך רשומת החלטות, לא משחק אחד.
      </p>
    </section>
  );
}

export function GameReviewProgress({ done, total }: { done: number; total: number }) {
  return (
    <section className="analysis-section game-review">
      <div className="section-heading">
        <span>סקירת משחק</span>
      </div>
      <p className="layer-loading">
        <LoaderCircle size={14} /> המנוע מנתח עמדה {done} מתוך {total}…
      </p>
      {/*
        Scaled, not sized in percent. GATE-DENOM flagged the earlier `${pct}%` here -- correctly,
        by its own rule -- and the honest fix is to stop producing a percentage rather than to
        teach the gate to ignore this one. The count is stated in the line above either way.
      */}
      <div className="review-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${done / Math.max(total, 1)})` }} />
      </div>
    </section>
  );
}
