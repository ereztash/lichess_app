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
 * It is stated once for the table rather than once per row -- see the note above the list for
 * what that changed and what it deliberately did not.
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
  kept = true,
  provenance,
}: {
  diagnostic: Diagnostic;
  /**
   * Whether the reading on screen was persisted (R2).
   *
   * False for a scan the player stopped partway. Such a reading is honest to show right now --
   * the stop just happened -- and dishonest to keep, because reopened later it would be
   * indistinguishable from a complete reading of the same games. When it is false the panel says
   * so, rather than letting the absence of an entry in the rail be the only clue.
   */
  kept?: boolean;
  /**
   * Whose games, how many, and when — present only when this reading came back FROM storage.
   *
   * Omitted at the moment of the scan, where the origin is obvious from the screen the player is
   * standing on. Required afterwards: the same rates reopened days later with no date attached
   * stop being a measurement and become a standing claim about the person (section 4.4).
   */
  provenance?: { username: string; games: number; scannedAt: string };
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

      {/*
        * The provenance line, and the reason it exists only on the way back.
        *
        * At the moment of the scan the player is standing on the screen that ran it, so naming
        * the account and the date would restate what they just did. Reopened from the rail a week
        * later it is the whole difference between a measurement and a verdict: "57% accuracy" is
        * a claim about a person, "57% across 20 games of erez281 read on 24 August" is an
        * observation with an edge. Section 4.4 asks for the triple; this is the source half.
        */}
      {provenance && (
        <p className="import-provenance">
          <span dir="ltr">{provenance.username}</span> · {provenance.games} משחקים · נסרק{" "}
          <time dateTime={provenance.scannedAt}>
            {new Date(provenance.scannedAt).toLocaleDateString("he-IL", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </p>
      )}

      {/*
        * R2. A scan the player stopped is shown but not kept, and the difference has to be on the
        * screen rather than only in the rail: a reader who is not told will assume this reading
        * will be here tomorrow, and it will not.
        */}
      {!kept && (
        <p className="import-not-kept">
          הסריקה נעצרה באמצע, ולכן הקריאה הזו לא נשמרת. היא מתארת רק את המשחקים שהספיקו להיסרק.
          סריקה שתרוץ עד הסוף תישמר ותהיה זמינה שוב מהתפריט.
        </p>
      )}

      {/*
       * The empty column, stated ONCE for the whole table instead of once per row.
       *
       * It used to render inside every `li`, and `.import-diagnostic .bucket-absent` gave it
       * `grid-column: 1 / -1` -- so it was never a column at all. Each bucket occupied two visual
       * rows and the second one carried the identical five words. On the reading that prompted
       * this change, nine buckets, that is nine repetitions of a constant.
       *
       * A value that is the same on every row is not data, and rendering it per row is the
       * redundancy effect with the volume turned up: repeated information competes for attention
       * with the information that differs. What the per-row version protected is real and is kept
       * -- a reader must not conclude that the rows carrying an accuracy also carry a gap -- so
       * the sentence says "in every row" explicitly rather than leaving it to be inferred from
       * nine sightings.
       */}
      <p className="bucket-absent-note">
        פער כיול — <strong>לא נמדד באף שורה</strong>, גם באלה שיש בהן דיוק.
      </p>

      <ul className="bucket-list">
        {diagnostic.buckets.map((b) => (
          <li key={b.key} className={b.measurable ? "" : "unmeasurable"}>
            <span className="bucket-scope">{b.scope}</span>
            {b.measurable && b.accurateRate !== null ? (
              <Proportion value={b.accurateRate} n={b.n} label="דיוק" />
            ) : (
              <Unmeasurable reason={b.unmeasurableReason} n={b.n} />
            )}
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
