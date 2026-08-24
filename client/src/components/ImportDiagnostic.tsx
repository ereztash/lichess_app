/**
 * What the games you already played can say about you, and the column that stays empty.
 *
 * This is the same table as the record dashboard, deliberately. Same six buckets, same order,
 * same rule for when a bucket may show a number. One column differs: the record measures a
 * calibration gap, and this cannot, because a gap needs a confidence stated before the engine
 * spoke and nobody was asked during a game already played.
 *
 * That empty column is the product's argument, and it is made by showing it rather than by
 * claiming it. A screen that quietly dropped the column would read as a complete diagnosis.
 *
 * WHAT THIS DELIBERATELY DOES NOT RENDER, because each would be a claim nothing here measured:
 *
 *   - A baseline, a target, or a verdict on the player.
 *   - A comparison to other players. Nothing in this app has ever measured another player.
 *   - A weakest bucket that is merely the lowest of six numbers. `worstBucketVerdict` decides
 *     whether the lowest is separable from the next one, and when it is not this screen says so
 *     instead -- a distinct state from "not enough decisions", and it has to read as one.
 */
import { MIN_BUCKET_N } from "@shared/detector";
import {
  worstBucketVerdict,
  type ImportDiagnostic as Diagnostic,
} from "@shared/import-diagnostic";
import type { ReactNode } from "react";
import { NotMeasured, Proportion } from "./Value";

/** Why a bucket shows no rate. Two kinds, and only one of them is a wait. */
function Unmeasurable({ reason, n }: { reason: "too-few" | "no-clock-data" | null; n: number }) {
  if (reason === "no-clock-data") {
    return (
      <span className="bucket-short">
        אין נתוני שעון במשחקים האלה, ולכן לא ניתן למדוד את הדלי הזה. ליצ׳ס מייצא שעונים רק אם
        ביקשתם אותם בייצוא — ייבוא של עוד משחקים מאותו מקור לא יעזור.
      </span>
    );
  }
  return (
    <span className="bucket-short">
      לא ניתן למדוד — {n} החלטות בדלי, נדרשות {MIN_BUCKET_N}
    </span>
  );
}

/**
 * The one observation, or the stated reason there is none.
 *
 * One sentence, one shape, filled from the reading. Not chosen from a set of phrasings and not
 * generated: the same numbers always produce the same sentence, which is what makes it checkable.
 */
function Observation({ diagnostic }: { diagnostic: Diagnostic }) {
  const verdict = worstBucketVerdict(diagnostic);

  if (!verdict) {
    return (
      <NotMeasured
        reason={
          diagnostic.scored === 0
            ? "לא נקראה אף החלטה שלכם מהמשחקים האלה."
            : `נקראו ${diagnostic.scored} החלטות, ואף דלי לא הגיע ל-${MIN_BUCKET_N}. אין עדיין מה לומר.`
        }
      />
    );
  }

  if (!verdict.separable) {
    /*
     * Enough decisions, no pattern -- and that is a result. The rates differ, because six
     * measurements always differ; they do not differ by more than their own sampling error, so
     * naming the lowest one would be naming the noise.
     */
    return (
      <NotMeasured
        reason={
          verdict.runnerUp === null
            ? "רק דלי אחד ניתן לקריאה, ואין לו למה להשוות את עצמו."
            : "הדליים שנקראו קרובים זה לזה יותר מטעות הדגימה שלהם. יש מספר נמוך ביותר, אבל הוא לא נבדל מהשאר."
        }
      />
    );
  }

  return (
    <p className="import-observation">
      הדיוק הנמוך ביותר שנמדד הוא ב<strong>{verdict.worst.scope}</strong>:{" "}
      <Proportion value={verdict.worst.accurateRate} n={verdict.worst.n} /> — לעומת{" "}
      <Proportion value={verdict.runnerUp.accurateRate} n={verdict.runnerUp.n} /> בדלי הבא אחריו.
    </p>
  );
}

export function ImportDiagnosticPanel({
  diagnostic,
  bridge,
}: {
  diagnostic: Diagnostic;
  /**
   * The registration offer, passed in rather than constructed here.
   *
   * This panel is pure: given a diagnostic it renders the same thing every time, and its tests
   * mount it with no providers at all. `PreregisterBridge` needs the record -- a tRPC context or
   * the local store -- and building it inside would have made every test of this table depend on
   * a provider it has nothing to do with. The slot keeps the placement without the coupling.
   */
  bridge?: ReactNode;
}) {
  return (
    <section className="import-diagnostic">
      <h4 className="dash-title">מה שנמדד במשחקים שייבאתם</h4>

      <ul className="bucket-list">
        {diagnostic.buckets.map((b) => (
          <li key={b.key} className={b.measurable ? "" : "unmeasurable"}>
            <span className="bucket-scope">{b.scope}</span>
            {b.measurable && b.accurateRate !== null ? (
              <Proportion value={b.accurateRate} n={b.n} label="דיוק" />
            ) : (
              <Unmeasurable reason={b.unmeasurableReason} n={b.n} />
            )}
            {/*
             * The empty column, on every row including the measurable ones. It is not an error
             * state and it does not fill in later from this data: no confidence was ever stated,
             * so no gap exists to be measured.
             */}
            <span className="bucket-absent">פער כיול — לא נמדד</span>
          </li>
        ))}
      </ul>

      {/*
        * Said out loud for the same reason as the speed restriction below: excluding these
        * lowers every n, and a smaller n with no explanation reads as "not enough games yet".
        *
        * The second sentence is the honest half. This removes a handful of moves a game and
        * leaves opening book and every recapture that is forced in practice but not in law --
        * which is most of the inflation. Saying only the first half would let the reader take
        * the rate for corrected.
        */}
      {diagnostic.forced > 0 && (
        <p className="pv-note">
          {diagnostic.forced} מתוך {diagnostic.scored} ההחלטות היו עמדות עם מהלך חוקי אחד בלבד, ולכן
          לא נספרו באף דלי — לא בחרתם בהן דבר. זה לא מנקה מהלכי ספר בפתיחה ולא לקיחות-חזרה שיש
          להן חלופה חוקית, והם עדיין מעלים את שיעורי הדיוק.
        </p>
      )}

      {/*
        * The restriction, said out loud. Narrowing the clock buckets to one time class without
        * saying so would be the quiet kind of dishonesty this screen exists to avoid: the n
        * would drop and the reader would read it as "not enough games yet".
        */}
      {diagnostic.excludedForSpeed > 0 && diagnostic.timeBucketSpeed && (
        <p className="pv-note">
          דליי הזמן נקראו רק על משחקי <span dir="ltr">{diagnostic.timeBucketSpeed}</span> שלכם.{" "}
          {diagnostic.excludedForSpeed} החלטות מסוגי משחק אחרים לא נכללו בהם — 45 שניות בבליץ ו-45
          שניות בקלאסי אינם אותה החלטה. דליי השלב והעמדה נקראו על כל המשחקים.
        </p>
      )}

      <Observation diagnostic={diagnostic} />

      {/*
        * The one action this screen offers, and the reason it is no longer terminal. See
        * PreregisterBridge for what it may and may not claim.
        */}
      {bridge}

      <p className="review-caveat">
        זהו דיוק מהלכים מול המנוע, ולא פער כיול. פער כיול דורש ביטחון שהצהרתם <em>לפני</em> שהמנוע
        דיבר, ובמשחק שכבר שיחקתם לא נשאלתם — לכן העמודה הזו ריקה בכל השורות, וכך היא תישאר עד
        שתרשמו החלטות. זו תצפית על {diagnostic.scored} החלטות שכבר קיבלתם, ולא אבחנה עליכם.
      </p>
    </section>
  );
}
