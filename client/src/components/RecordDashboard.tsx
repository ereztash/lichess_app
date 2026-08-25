import { Gauge, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MIN_BUCKET_N } from "@shared/detector";
import type { RecordReading } from "@shared/record-service";
import { NotMeasured, Proportion, SignedProportion } from "./Value";
import type { OneThingKind, OneThingMix } from "@shared/reveal";

/**
 * The record, laid out.
 *
 * This is the screen that measures the PLAYER rather than the position, and it is the reason the
 * merge is worth doing at all -- chess-mind-patterns can chart a game, but it has no record of
 * what you believed before you saw the answer, so it cannot draw any of this.
 *
 * R1 is the whole design here. Every figure states its n. A bucket that has not reached
 * MIN_BUCKET_N reports that it cannot be read, and stays on screen saying so, because a row that
 * simply disappears makes the remaining rows look like the complete picture.
 */
export function RecordDashboard({ reading }: { reading: RecordReading }) {
  const { overall, buckets, confidence, scored, calibration } = reading;

  if (scored === 0) {
    return (
      <section className="analysis-section record-dashboard">
        <div className="section-heading">
          <span>הרשומה שלך</span>
          <Gauge size={14} />
        </div>
        <NotMeasured reason="עוד לא נחשפה אף החלטה, ולכן אין מה למדוד. הרשומה נבנית מהחלטה אחת בכל פעם." />
      </section>
    );
  }

  // Only levels the player actually used. A level with n=0 is absent, not a zero -- plotting it
  // as 0% would draw a claim about a confidence never stated.
  const used = confidence.filter((c) => c.n > 0);
  const curve = used.map((c) => ({
    stated: c.stated,
    claimed: Math.round(c.claimed * 100),
    observed: Math.round((c.observed ?? 0) * 100),
    n: c.n,
  }));

  return (
    <section className="analysis-section record-dashboard">
      <div className="section-heading">
        <span>הרשומה שלך</span>
        <span className="data-chip">n={scored}</span>
      </div>

      <div className="review-stats">
        <div className="review-stat">
          <Proportion value={overall.meanConfidence} n={scored} label="הביטחון שהצהרת" />
        </div>
        <div className="review-stat">
          <Proportion value={overall.accuracyRate} n={scored} label="מה שקרה בפועל" />
        </div>
        <div className="review-stat">
          <SignedProportion
            value={overall.gap}
            n={scored}
            label={overall.gap > 0 ? "ביטחון־יתר" : "ביטחון־חסר"}
          />
        </div>
      </div>

      {/*
        * THE SPLIT, and three things it had to get right that the first version did not.
        *
        * THE UNIT. These are squared-error quantities, not rates. Rendering them through
        * `Proportion` printed a reliability of 0.016 as "2%" -- a percentage of nothing, in a
        * product whose whole discipline is that a number carries what produced it. They are
        * printed as the literature prints them, to three places.
        *
        * THE WEIGHT. Three more bordered cells directly under the headline row read as three more
        * headline figures, and these are a BREAKDOWN of the row above rather than a rival to it.
        * One quiet panel of rows, no borders per cell.
        *
        * THE SEPARATION. `uncertainty` is a property of the positions and says nothing about the
        * player; a rule above it and a dimmed treatment do that structurally, so the reader sees
        * it before reading the sentence underneath.
        */}
      <h4 className="dash-title">ממה מורכב הפער</h4>
      {calibration.reliable ? (
        <>
          <dl className="calibration-split">
            <div className="split-row split-mine">
              <dt>שגיאת הכיול</dt>
              <dd>{calibration.reliability.toFixed(3)}</dd>
            </div>
            <div className="split-row">
              <dt>כוח ההבחנה</dt>
              <dd>{calibration.resolution.toFixed(3)}</dd>
            </div>
            <div className="split-row split-theirs">
              <dt>קושי העמדות</dt>
              <dd>{calibration.uncertainty.toFixed(3)}</dd>
            </div>
          </dl>
          <p className="dash-note" dir="rtl">
            רק שגיאת הכיול מדברת עליכם. קושי העמדות הוא תכונה של מה שפגשתם — עמדות קשות מגדילות
            את הפער בלי שנעשיתם שופטים גרועים יותר של עצמכם.
          </p>
        </>
      ) : (
        <NotMeasured reason="עוד לא נאמרה אף רמת ביטחון מספיק פעמים כדי לפרק את הפער. בגודל כזה הפירוק הוא רעש, לא ממצא." />
      )}

      {curve.length > 0 && (
        <>
          <h4 className="dash-title">מה שאמרת מול מה שקרה</h4>
          <p className="chart-legend" dir="rtl">
            <i style={{ background: "var(--c-axis)" }} /> הצהרת
            <i style={{ background: "var(--c-white-edge)" }} /> קרה בפועל
          </p>
          <div className="chart-frame" dir="ltr">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={curve} margin={{ top: 6, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--c-grid)" vertical={false} />
                <XAxis dataKey="stated" tick={{ fontSize: 9 }} stroke="var(--c-axis)" />
                <YAxis tick={{ fontSize: 9 }} stroke="var(--c-axis)" width={40} unit="%" />
                <Tooltip
                  cursor={{ fill: "var(--c-grid)" }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline-strong)",
                    borderRadius: 0,
                    fontSize: 11,
                  }}
                  labelFormatter={(s) => `ביטחון ${s}`}
                  formatter={(v, name, item) => [
                    `${Number(v)}%  (n=${item?.payload?.n ?? 0})`,
                    name === "claimed" ? "הצהרת" : "קרה בפועל",
                  ]}
                />
                <Bar
                  dataKey="claimed"
                  fill="var(--c-axis)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar dataKey="observed" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {curve.map((c) => (
                    // Below the line you claimed is overconfidence; above it is the other way.
                    <Cell
                      key={c.stated}
                      fill={c.observed < c.claimed ? "var(--c-black-edge)" : "var(--c-white-edge)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <h4 className="dash-title">לפי סוג ההחלטה</h4>
      <ul className="bucket-list">
        {buckets.map((b) => (
          <li key={b.key} className={b.measurable ? "" : "unmeasurable"}>
            <span className="bucket-scope">{b.scope}</span>
            {b.measurable ? (
              <>
                {/* Scaled, not sized in percent -- the figure beside it is the claim. */}
                <span className="bucket-bar" aria-hidden="true">
                  <i
                    style={{
                      transform: `scaleX(${Math.min(1, Math.abs(b.inside.gap) * 2)})`,
                      background: b.inside.gap > 0 ? "var(--c-black-edge)" : "var(--c-white-edge)",
                    }}
                  />
                </span>
                <SignedProportion value={b.inside.gap} n={b.inside.n} />
              </>
            ) : b.unmeasurableReason === "no-clock-data" ? (
              /*
               * Not a wait. This record carries no clock at all, so the bucket can never fill,
               * and "record more decisions" is advice that cannot work. A local game against
               * Stockfish has no clock, and a Lichess export carries none unless the user
               * ticked the option -- so the message names the fix that actually exists.
               */
              <span className="bucket-short">
                לא ניתן למדוד במצב הזה — אין נתוני שעון ברשומה. משחק מקומי מול Stockfish הוא בלי
                שעון, וייצוא מליצ׳ס נושא שעונים רק אם ביקשתם אותם בייצוא.
              </span>
            ) : (
              <span className="bucket-short">
                לא ניתן למדוד — {b.inside.n} החלטות בפנים, נדרשות {MIN_BUCKET_N}
              </span>
            )}
          </li>
        ))}
      </ul>

      <MixBlock mix={reading.mix} />

      <p className="review-caveat">
        פער כיול הוא ההפרש בין הביטחון שהצהרת לבין מה שקרה. הוא נמדד על ההחלטות שרשמת ותו לא — הוא
        לא אומר דבר על הדירוג שלך ולא על שיפור.
      </p>
    </section>
  );
}

export function RecordDashboardLoading() {
  return (
    <section className="analysis-section record-dashboard">
      <p className="claim-loading">
        <Loader2 size={14} /> קורא את הרשומה…
      </p>
    </section>
  );
}

const MIX_LABEL: Record<OneThingKind, string> = {
  "chose-past-it": "המהלך של המנוע היה על הלוח שלכם ובחרתם אחר",
  "confident-and-wrong": "ביטחון גבוה, והמהלך עלה חומר",
  outplayed: "המהלך עלה חומר",
  "trusted-it-too-little": "בחרתם נכון בתוך הרעש, ואמרתם ביטחון נמוך",
};

/**
 * WHICH OF ITS FOUR SENTENCES THE RECORD ACTUALLY PRODUCED.
 *
 * Not a finding about the player -- a reading of the instrument. `chose-past-it` is the only
 * sentence in this product that no other chess tool can write, it arrives on decision one, and
 * whether it can carry any weight depends entirely on how often it fires. Nobody has ever
 * measured that, and it cannot be taken from imported games: a PGN carries no record of what was
 * on the board before the move, so the branch can never fire for one.
 *
 * The floor is MIN_BUCKET_N, reused rather than invented. A fresh threshold here would be exactly
 * the unjustified number this product spends its whole time refusing -- and a mix over nine
 * decisions is noise wearing four percentage signs.
 */
function MixBlock({ mix }: { mix: OneThingMix }) {
  if (mix.n < MIN_BUCKET_N) {
    return (
      <div className="mix-block">
        <h4 className="dash-title">מה הכלי אמר לכם עד כה</h4>
        <NotMeasured
          reason={`נחשפו ${mix.n} החלטות, ונדרשות ${MIN_BUCKET_N} כדי לדווח על ההתפלגות. עד אז כל אחוז כאן היה רעש.`}
        />
      </div>
    );
  }
  return (
    <div className="mix-block">
      <h4 className="dash-title">מה הכלי אמר לכם עד כה</h4>
      <ul className="bucket-list">
        {(Object.keys(MIX_LABEL) as OneThingKind[]).map((kind) => (
          <li key={kind}>
            <span className="bucket-scope">{MIX_LABEL[kind]}</span>
            <Proportion value={mix.counts[kind] / mix.n} n={mix.n} />
          </li>
        ))}
        <li>
          <span className="bucket-scope">לא היה מה לומר — בחרתם בתוך הרעש והביטחון תאם</span>
          <Proportion value={mix.silent / mix.n} n={mix.n} />
        </li>
      </ul>
      {/*
        * The ceiling, and the reason the first row can never reach it. Without this the reader
        * takes the first row for "how often I see it and choose past it", and it is not that.
        */}
      <p className="mix-note">
        מתוך {mix.n} ההחלטות, ב-{mix.eligible} ההפסד עבר את רעש המנוע והגיע לכדי חומר — רק בהן
        השאלה "ראיתם את המהלך?" בכלל חלה. <strong>השורה הראשונה היא רצפה, לא הערכה:</strong> היא
        סופרת רק מהלכים שהנחתם פיזית על הלוח. מהלך ששקלתם בראש ולא נגעתם בו אינו נרשם, ולכן מספר
        האמיתי של "ראיתי ובחרתי אחרת" גבוה ממנו ולא ידוע כמה.
      </p>
    </div>
  );
}
