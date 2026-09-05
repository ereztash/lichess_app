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
import { decisionsHeldElsewhere } from "@shared/plain-reading";
import { MIN_STABILITY_HALF } from "@shared/stability";
import { PHASE_DIFFICULTY_N, PHASE_VARIANCE_EXPLAINED } from "@shared/phase-difficulty";
import type { Control } from "@shared/control";
import type { Sensitivity } from "@shared/sensitivity";
import { ACCURACY_COUPLING, type SensitivityBand } from "@shared/sensitivity-reference";
import type { RecordReading } from "@shared/record-service";
import { CounterfactualPanel } from "./CounterfactualPanel";
import { ProfilePanel } from "./ProfilePanel";
import { NotMeasured, Proportion, SignedProportion, SmallProportion } from "./Value";
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
/**
 * One percentile off a reference band.
 *
 * Throws rather than defaults on a percentile the band was not published at. A missing percentile
 * silently rendering as "0.00" would put a number on the screen that no corpus produced, and the
 * band is generated -- so a percentile that is absent means the generator changed, not that this
 * reader is unusual.
 */
function band(reference: SensitivityBand, p: number): string {
  const at = reference.percentiles.find((entry) => entry.p === p);
  if (!at) throw new Error(`no p${p} in the sensitivity reference band`);
  return at.auroc2.toFixed(2);
}

/**
 * What the control cell says when it has nothing to report, one sentence per cause.
 *
 * `ok` is present so the map is total over the union rather than partial with a cast: a status
 * that gains a member should break the build here, not render `undefined` on the panel.
 */
const CONTROL_SILENCE: Record<NonNullable<Control["reason"]>, string> = {
  ok: "",
  "too-few": `נדרשות ${MIN_BUCKET_N} החלטות בעמדות העוגן כדי למדוד את הקשר הזה.`,
  "flat-time":
    "לקחתם בערך אותו זמן על כל ההחלטות, ולכן אין מה לקשור לביטחון. עוד החלטות באותו קצב לא ישנו את זה.",
  "flat-confidence":
    "אמרתם בערך אותו דבר על כל ההחלטות, ולכן אין שונות בביטחון לקשור אליה. עוד החלטות באותו ביטחון לא ישנו את זה.",
  /*
   * The one that is NOT a missing measurement: it was measured and came out indistinguishable
   * from no association. Simulated on records where time was drawn independently of confidence, a
   * coefficient appeared 100% of the time and reached 0.30 or more on one record in nine.
   */
  "inside-noise":
    "נמדד, והקשר יצא קטן ממה שהרשומה הזו יכולה להבחין בו מאפס. עוד החלטות יחדדו את זה.",
};

/**
 * What the discrimination cell says when it has nothing to report, one sentence per cause.
 *
 * `ok` is present so the map stays total over the union: a status that gains a member should
 * break the build here rather than render `undefined` on the panel.
 */
const SENSITIVITY_SILENCE: Record<NonNullable<Sensitivity["reason"]>, string> = {
  ok: "",
  "too-few-accurate": `נדרשות ${MIN_BUCKET_N} החלטות שיצאו טוב כדי שיהיה מה להפריד מהן. ברשומה הזו יש פחות.`,
  /*
   * Named separately from its mirror because the advice is different and specific: this player
   * needs harder positions, not simply more of them. "Record more decisions" is what they would
   * hear from one shared sentence, and it is the wrong instruction.
   */
  "too-few-inaccurate": `נדרשות ${MIN_BUCKET_N} החלטות שלא יצאו טוב, ואין מספיק כאלה — עמדות קשות יותר יעשו את זה, לא עוד עמדות מאותו סוג.`,
  "too-few-both": `ההבחנה צריכה ${MIN_BUCKET_N} החלטות מכל סוג — כאלה שיצאו טוב וכאלה שלא. בלי שתיהן אין מה להפריד.`,
  /*
   * The one that is NOT a missing measurement. Simulated on records where confidence was drawn
   * independently of the outcome -- true area exactly 0.5 -- a figure appeared every time and
   * landed a tenth of the scale from chance on 18% of them.
   */
  "inside-noise":
    "נמדד, והתוצאה יצאה קרובה מדי למקריות מכדי להבדיל אותה ממנה ברשומה בגודל הזה. עוד החלטות יחדדו את זה.",
};

export function RecordDashboard({ reading }: { reading: RecordReading }) {
  const {
    overall,
    buckets,
    confidence,
    scored,
    calibration,
    sensitivity,
    sensitivityReference,
    control,
    stability,
    setAside,
  } = reading;

  if (scored === 0) {
    /*
     * THE EMPTY STATE HAS TWO CAUSES AND USED TO NAME ONLY ONE.
     *
     * "עוד לא נחשפה אף החלטה" was printed whenever `scored` was zero, and `scored` is not the
     * revealed count -- it is the revealed count that also carries a stated confidence. Walked
     * in Chromium from an empty profile: one decision, committed, revealed, the engine's verdict
     * rendered on the same screen, and this panel said no decision had been revealed. The player
     * is told to do the thing they have already done.
     *
     * The second sentence is about the protocol, not about them, and it does not tell them to
     * keep going: nothing they do makes a decision already recorded without the question
     * scoreable. What it does is make the first number they will ever see here interpretable.
     */
    const reason =
      reading.withoutConfidence > 0
        ? /*
           * "המנוע ענה על N" AND NOT "N החלטות נחשפו". `withoutConfidence` counts decisions with a
           * STORED ENGINE VERDICT and no stated confidence -- a fact about the producer. On a
           * deferred game the engine answers during play and `mayShowVerdictNow` keeps the verdict
           * off the screen, so this sentence was telling a player that decisions had been revealed
           * to them which the product had deliberately not shown. The count is unchanged; the verb
           * is now the one the record can witness.
           */
          `המנוע ענה על ${reading.withoutConfidence} החלטות, אך אף אחת מהן לא נרשמה עם ביטחון מוצהר — ` +
          "שאלת הביטחון נשאלת תמיד בסט המשותף ובתרגול, ובחלק מההחלטות במשחק חופשי. " +
          "פער כיול נקרא רק מהחלטות שנשאלו."
        : /*
           * THE THIRD CAUSE, and it is the one that produced the contradiction on screen.
           *
           * Walked in Chromium at 1440x900 and 390x844 from a clean profile: three complete bank
           * decisions, then the explorer opened from the third reveal. One page then carried
           * `3 נמדדו ונקראות בחלק אחר של הרשומה` at y=108, `נרשמו 4 החלטות` at y=233, and this
           * panel at y=2089 saying no decision had been revealed. Four numbers for one player,
           * the last contradicting the first, on a screen that was itself a reveal.
           *
           * `withoutConfidence` cannot catch it: the bank ALWAYS asks the confidence question, so
           * those three decisions are scored -- in `reading.anchor`, under the bank's own
           * heading. They are simply not in this panel's population, which is free play.
           *
           * IT SAYS WHERE THEY WENT AND NOT MORE. `decisionsHeldElsewhere` is the front door's
           * own clause, from the `N-3` owner decision that this panel was missed by, so the two
           * record surfaces acknowledge the same decisions in the same words. The tail is this
           * screen's, because what this screen measures is a calibration gap and the front door's
           * is games played -- and the state that has decisions elsewhere may not share its
           * primary message with the state that has none, which is what `N-3` says in a line.
           *
           * NOTHING HERE IS A DENOMINATOR. `scored` is unchanged, `anchor` is unchanged, the
           * detector and `MIN_BUCKET_N` are untouched. A sentence that was false became true.
           */
          reading.readElsewhere > 0
          ? `${decisionsHeldElsewhere(reading.readElsewhere)} — הסט המשותף, תרגול או משחקים שיובאו. ` +
            "כאן נקרא פער כיול ממשחקים ששיחקתם, ועוד אין החלטה כזאת."
          : "עוד לא נחשפה אף החלטה, ולכן אין מה למדוד. הרשומה נבנית מהחלטה אחת בכל פעם.";
    return (
      <section className="analysis-section record-dashboard">
        <div className="section-heading">
          <span>הרשומה שלך</span>
          <Gauge size={14} />
        </div>
        <NotMeasured reason={reason} />
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

      {/*
        * WHY `n` IS SMALLER THAN THE PLAYER'S OWN COUNT, when it is.
        *
        * `shared/evidence-policy.ts` groups the described record by the conditions that make two
        * decisions comparable, and this page reads one of them. Without this line the number in the
        * chip would simply be smaller than the record the player remembers building, for a reason
        * no surface stated -- the failure R1 exists to prevent, arriving as an absence.
        *
        * IT IS NOT `readElsewhere`. These decisions are not counted under another heading; they are
        * the same free play, measured under conditions this reading may not average with the rest.
        */}
      {setAside.length > 0 && (
        <p className="dash-note" dir="rtl">
          עוד {setAside.reduce((n, s) => n + s.n, 0)} החלטות מדודות שלכם נרשמו בתנאי מדידה אחרים —
          מועד חשיפה, פרוטוקול או מנוע אחר — ולכן אינן ממוצעות לתוך המספרים כאן. הן אינן ממתינות
          ואינן נקראות בחלק אחר: הן פשוט אינן אותה אוכלוסייה.
        </p>
      )}

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
        /*
         * THE SENTENCE HAD TO CHANGE WITH THE RULE, and this is the only copy the F2 repair forced.
         *
         * `reliable` used to be `some`, so "no confidence level has been stated enough times" was
         * an accurate description of every case that reached here. Under `every` it is not: the
         * record this fix exists for HAS a level stated thirty times, and telling that player no
         * level qualifies would be a false sentence produced by the fix.
         *
         * It names the levels that are short and how many decisions they hold, from `levels`, which
         * already carries both. No new field, no percentage, and the count is what the reader can
         * act on -- a level is short by decisions, and decisions are the thing they make.
         */
        <NotMeasured
          reason={(() => {
            const short = calibration.levels.filter((level) => level.n < MIN_BUCKET_N);
            const held = short.reduce((n, level) => n + level.n, 0);
            return (
              `הפירוק נקרא רק כשכל רמת ביטחון שנאמרה נאמרה לפחות ${MIN_BUCKET_N} פעמים. ` +
              `כרגע ${short.length} מתוך ${calibration.levels.length} הרמות שנאמרו עדיין מתחת לסף, ` +
              `והן מחזיקות ${held} מתוך ${calibration.n} ההחלטות — פירוק שכולל אותן הוא בעיקר ` +
              `רעש הדגימה שלהן, ולא ממצא עליכם.`
            );
          })()}
        />
      )}

      {/*
        * THE TWO FACETS THE GAP CANNOT SEE, and the first one is arguably the most useful number
        * on this screen.
        *
        * SENSITIVITY answers a question a chess player recognises -- can you tell your good moves
        * from your bad ones -- and calibration structurally cannot answer it. Someone
        * systematically far too confident can still rank their own decisions perfectly; someone
        * perfectly calibrated on average can be ranking them at chance. Shifting every stated
        * confidence by the same amount changes the gap completely and leaves this untouched.
        *
        * CONTROL is the half that monitoring alone cannot stand in for: knowing you are unsure
        * matters because of what you do next. Negative is healthy, and the sign is shown rather
        * than an absolute value, because the other direction is a finding about how someone
        * spends their attention.
        */}
      <h4 className="dash-title">מה שהפער לא רואה</h4>
      <dl className="calibration-split">
        <div className="split-row split-mine">
          <dt>ההבחנה שלכם</dt>
          <dd>
            {sensitivity.readable && sensitivity.auroc2 !== null
              ? sensitivity.auroc2.toFixed(2)
              : "—"}
          </dd>
          {/*
            * THE RANGE THE NUMBER IS WORTH READING AGAINST. 0.71 on its own is uninterpretable:
            * nobody knows whether that is good. This is the middle 80% of people who scored about
            * as accurately as this reader, measured on the Confidence Database with this product's
            * own estimator.
            *
            * A SECOND `dd`, NOT A SPAN INSIDE THE FIRST. It began as a span and broke an existing
            * assertion that the discrimination cell holds a bare two-place area and never a
            * percentage -- the cell's text became "0.81במחקר 0.47–0.62". That assertion is right
            * and the markup was wrong: the figure is one value, the range is another, and a
            * definition list is allowed to carry two.
            *
            * Absent rather than defaulted where the corpus has no stratum for their accuracy --
            * the unconditioned range would hand back exactly the confound the conditioning
            * removes, and would do it silently.
            */}
          {sensitivityReference && (
            <dd className="split-band">
              {/*
                * Isolated for the same reason as `.bucket-versus`: a range read left-to-right
                * inside a Hebrew line. Without it "במחקר 0.52–0.69" renders as
                * "0.69–0.52 רקחמב" -- the numbers reversed, so the range reads high-to-low and
                * a reader takes the lower bound for the upper one.
                */}
              במחקר{" "}
              <bdi>
                {band(sensitivityReference, 10)}–{band(sensitivityReference, 90)}
              </bdi>
            </dd>
          )}
        </div>
        <div className="split-row">
          <dt>מאמץ שהולך אחרי הספק</dt>
          <dd>
            {control.readable && control.rho !== null ? control.rho.toFixed(2) : "—"}
          </dd>
          {/*
            * WHY THE CELL IS EMPTY, WHICH THE CELL NEVER SAID. `Control` computes four distinct
            * reasons and this rendered a bare "—" for all of them, so a player who took the same
            * time over every decision and a player with twelve decisions saw the same dash. The
            * distinction was built in the shared code and thrown away at the last step.
            *
            * The advice differs per reason and that is the point: `too-few` and `inside-noise`
            * are waits, `flat-time` and `flat-confidence` are not -- more decisions at the same
            * speed will never make that cell readable.
            */}
          {!control.readable && control.reason !== null && (
            <dd className="split-why">{CONTROL_SILENCE[control.reason]}</dd>
          )}
        </div>
      </dl>
      {/*
        * FIVE CAUSES, FIVE SENTENCES. This was a two-way ternary: the explanation, or one line
        * saying the record needs enough of both kinds. That line is true of three of the four
        * silent cases and false of the fourth -- a record with plenty of both, whose area was
        * computed and came out indistinguishable from chance. Telling that player to record more
        * of both kinds describes a problem they do not have.
        */}
      <p className="dash-note" dir="rtl">
        {sensitivity.readable && sensitivity.auroc2 !== null
          ? "ההבחנה היא בין 0 ל־1, ו־0.5 זה מקריות: כמה טוב הביטחון שלכם מפריד בין ההחלטות שיצאו טוב לאלה שלא. היא לא זזה כשאתם בטוחים מדי או מדי מעט — זה בדיוק מה שהפער כבר מודד."
          : sensitivity.reason !== null
            ? SENSITIVITY_SILENCE[sensitivity.reason]
            : "ההבחנה צריכה מספיק החלטות משני הסוגים — כאלה שיצאו טוב וכאלה שלא. בלי שתיהן אין מה להפריד."}
      </p>
      {/*
        * The caveat is longer than the number, deliberately. Two things here are easy to misread
        * and expensive to misread: that the range is drawn from people of similar accuracy rather
        * than from everyone, and that the task behind it is not chess. A range without them reads
        * as a grade.
        */}
      {sensitivityReference && (
        <p className="dash-note" dir="rtl">
          הטווח נמדד על {sensitivityReference.n.toLocaleString("he-IL")} אנשים ממאגר הביטחון (Rahnev
          ואחרים, 2020) — ורק על מי שדייקו בערך כמוכם. זה לא פרט טכני: ההבחנה עולה עם הדיוק עצמו
          (ρ={ACCURACY_COUPLING.toFixed(2)}), ובלי התנאי הזה שחקן חזק היה מקבל ציון גבוה על עצם
          היותו חזק. והמשימה שם אינה שחמט — ברובה הכרעה בינארית בתפיסה או בזיכרון, ולכן זה טווח
          להשוואה ולא הדירוג שלכם בתוכו.
        </p>
      )}
      <p className="dash-note" dir="rtl">
        המאמץ שלילי כשהשקעתם יותר זמן בהחלטות שהייתם בטוחים בהן פחות. על המשחקים שלכם המספר הזה
        מעורבב עם קושי העמדה — עמדה קשה גם לוקחת יותר זמן וגם מרגישה פחות בטוחה. רק על הסט המשותף
        אפשר להשוות אותו למישהו אחר.
      </p>

      {/*
        * THE QUESTION THAT COMES BEFORE ALL OF THEM, and the one this screen never asked.
        *
        * `splitHalfStability` has been computed on every reading for as long as the dashboard has
        * existed and no component read it. Everything above is a number ABOUT THE PLAYER, and
        * every one of them is worthless if the record does not say the same thing twice -- so the
        * screen was showing five answers and withholding the one that says whether to believe
        * them.
        *
        * NO VERDICT, AND THAT IS DELIBERATE -- `Stability` deliberately ships no threshold, and a
        * "stable" here would manufacture exactly the reading the module was written to prevent:
        * that a passing record has a settled number about the person. The spread is printed and
        * the reader is told which direction is good. Nothing is graded.
        *
        * THE CAVEAT IS LOAD-BEARING, NOT DECORATION. Both halves come from the same record, so
        * this cannot separate a trait from a mood, a warm-up, or a run of kind positions. Read as
        * test-retest reliability it would be a much stronger claim than anything here supports,
        * and the sentence saying so is the reason this block is allowed on screen at all.
        */}
      <h4 className="dash-title">האם הרשומה אמרה את אותו הדבר פעמיים</h4>
      {stability.readable && stability.spread !== null ? (
        <>
          <dl className="calibration-split">
            {/*
              * `SignedProportion` rather than a local formatter, and GATE-DENOM is why.
              *
              * The first version printed the percentage by hand and put each half's n in its own
              * `dd` beside it, matching how the calibration split above lays out its cells. The
              * gate failed the build: those cells are squared-error quantities and carry no
              * denominator to lose, while a gap IS a rate, and a rate whose n sits in a sibling
              * element is a rate the scanner cannot see paired with anything. It was right to.
              * The n belongs to the number, and `Value.tsx` is the one place allowed to say so.
              */}
            <div className="split-row">
              <dt>הפער במחצית האחת</dt>
              <dd>
                <SignedProportion value={stability.gap[0]} n={stability.n[0]} />
              </dd>
            </div>
            <div className="split-row">
              <dt>הפער במחצית השנייה</dt>
              <dd>
                <SignedProportion value={stability.gap[1]} n={stability.n[1]} />
              </dd>
            </div>
            <div className="split-row split-mine">
              <dt>המרחק ביניהן</dt>
              <dd>{stability.spread.toFixed(2)}</dd>
              <dd className="split-band">שגיאות תקן</dd>
            </div>
          </dl>
          <p className="dash-note" dir="rtl">
            הרשומה נחתכה לשתי מחציות לסירוגין — החלטה לכאן, החלטה לשם — ולא לחצי ראשון וחצי שני,
            כדי שעייפות או התחממות לא ייקראו כחוסר יציבות. קטן זה טוב: המספר יצא דומה בשתיהן. אין
            כאן סף ואין מעבר או נכשל, כי הפיכת זה לציון הייתה בדיוק הקריאה שהמדידה הזו נועדה למנוע.
          </p>
          <p className="dash-note" dir="rtl">
            <strong>זו אינה מדידת יציבות לאורך זמן.</strong> שתי המחציות מגיעות מאותה רשומה, ולכן
            הבדיקה הזו לא יכולה להבחין בין תכונה שלכם לבין מצב רוח, התחממות או רצף עמדות נוחות —
            להבחנה הזו צריך מדידה שמופרדת בזמן, ואין כזו כאן. מרחק גדול אומר שהמספרים למעלה הם רעש;
            מרחק קטן אומר שהם לא רעש גלוי, ולא יותר מזה.
          </p>
        </>
      ) : (
        <NotMeasured
          reason={
            stability.n[0] < MIN_STABILITY_HALF || stability.n[1] < MIN_STABILITY_HALF
              ? `לכל מחצית צריך ${MIN_STABILITY_HALF} החלטות מהסט המשותף — ${MIN_STABILITY_HALF * 2} בסך הכול, ויש ${stability.n[0] + stability.n[1]}. מתחת לזה הבדיקה לא יכולה להיכשל, ולכן מעבר שלה לא היה אומר כלום.`
              : "שתי המחציות שטוחות מכדי לחשב מהן שגיאת תקן, ובלי שגיאת תקן למרחק ביניהן אין קנה מידה."
          }
        />
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
                <XAxis dataKey="stated" tick={{ fontSize: "var(--panel-fine)" }} stroke="var(--c-axis)" />
                <YAxis tick={{ fontSize: "var(--panel-fine)" }} stroke="var(--c-axis)" width={40} unit="%" />
                <Tooltip
                  cursor={{ fill: "var(--c-grid)" }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline-strong)",
                    borderRadius: 0,
                    fontSize: "var(--panel-label)",
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
                {/*
                  * WHAT THE BUCKET IS WORTH KNOWING AGAINST. Measured on 693,130 real Lichess
                  * moves: the middlegame is 12.6 points less accurate than everything else FOR
                  * EVERYONE, and decisions over two minutes are 14.2 points worse -- people think
                  * longer because the position is hard. Reporting a player's rate in a bucket
                  * without that is telling them a fact about chess in the second person.
                  *
                  * Absent rather than zero where the corpus has no baseline: a bucket the
                  * population data cannot support renders nothing, not a comparison against a
                  * number nobody measured.
                  */}
                {b.versusPopulation !== null &&
                  (b.versusPopulation.separated ? (
                    <span className="bucket-versus">
                      {/*
                        * `<bdi>` around the number, not a CSS rule on the span.
                        *
                        * This line mixes a signed figure with Hebrew words, so `unicode-bidi:
                        * plaintext` -- which fixed the bare numbers elsewhere -- takes its
                        * direction from the first strong character, resolves the whole run
                        * right-to-left, and leaves the sign 62px from its digits. Measured:
                        * "−4 נק׳ מול כולם" rendered as "םלוכ לומ ׳קנ 4−".
                        *
                        * An isolate is the tool for a mixed run: it fixes the direction of what
                        * is inside it and stops it interacting with what is outside.
                        */}
                      <bdi>
                        {b.versusPopulation.points >= 0 ? "+" : "−"}
                        {Math.abs(Math.round(b.versusPopulation.points * 100))}
                      </bdi>{" "}
                      נק׳ מול כולם
                    </span>
                  ) : (
                    /*
                      * MEASURED, AND THE SAME. Both rates stay on screen -- the population figure
                      * is computed on hundreds of thousands of moves and is the context the whole
                      * baseline exists to supply. What is dropped is the ASSERTION that the
                      * player differs from it, which is the only part that needed this record to
                      * carry it and could not.
                      *
                      * Simulated against the real baselines, a player whose true accuracy EQUALS
                      * the population's was shown a signed figure on 100% of draws at
                      * MIN_BUCKET_N, ten points or more on a quarter of them.
                      */
                    <span className="bucket-versus bucket-versus-flat">
                      אצלכם{" "}
                      <bdi>{Math.round(b.inside.accuracyRate * 100)}%</bdi>, אצל כולם{" "}
                      <bdi>
                        {Math.round(
                          (b.inside.accuracyRate - b.versusPopulation.points) * 100,
                        )}
                        %
                      </bdi>{" "}
                      — ההפרש קטן ממה ש-{b.inside.n} החלטות יכולות להבחין בו, ולכן הוא לא מדווח
                      כהפרש.
                    </span>
                  ))}
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

      {/*
        * WHAT THE PHASE SPLIT IS AND IS NOT, checked against a corpus outside this repository.
        *
        * The baseline these buckets are read against says the middlegame is 12.6 points harder for
        * everyone and the ENDGAME IS THE EASIEST PHASE by a wide margin. That is a statement about
        * the accuracy rule. The Lichess puzzle database carries a Glicko rating per position from
        * real human solve attempts, and on 4.4 million of them the phase label explains 0.35% of
        * the variance in difficulty -- checked at three filter levels, with the best-measured
        * items giving the smallest value, so it is not an effect hidden by noise.
        *
        * The magnitudes are NOT compared on screen and must not be: a puzzle rating is finding a
        * unique winning move in a selected tactical position, and the product's rate is not losing
        * 30 centipawns on an ordinary move. What is said here is made entirely inside the puzzle
        * corpus -- how little the phase label explains -- which needs no bridge between the two.
        */}
      <p className="review-caveat">
        {/*
          * THROUGH `Value`, NOT A HAND-BUILT PERCENT, and GATE-DENOM is what decided that.
          *
          * The first version interpolated `(PHASE_VARIANCE_EXPLAINED * 100).toFixed(2)}%` directly
          * and the gate went red on it: R1 forbids a percentage without its denominator, and the
          * scanner exempts exactly one component -- the one that cannot render a number without
          * its provenance. Widening the exemption for this line would have been answering a gate
          * by moving it. The exemption is per FILE, so wrapping the same hand-built percent in
          * `<Value>` did not satisfy it either -- the formatting itself has to live there.
          * `SmallProportion` does, and it does not round 0.0035 to "0%", which would read as
          * "not measured" rather than "measured, and nearly nothing".
          */}
        החלוקה לשלבים היא תכונה של הכלל שמודד דיוק, לא מדד לקושי. על עמדות שדורגו לפי כמה בני אדם
        באמת פתרו אותן, השלב מסביר{" "}
        <SmallProportion value={PHASE_VARIANCE_EXPLAINED} n={PHASE_DIFFICULTY_N} />{" "}
        מהשונות בקושי — כמעט כלום. ההשוואה לאוכלוסייה כאן מתקנת את הכלל; היא לא אומרת שהעמדות שלכם
        היו קשות יותר.
      </p>
      <p className="review-caveat">
        פער כיול הוא ההפרש בין הביטחון שהצהרת לבין מה שקרה. הוא נמדד על ההחלטות שרשמת ותו לא — הוא
        לא אומר דבר על הדירוג שלך ולא על שיפור.
      </p>
      {/*
        * The probe's own readings, below the calibration ones because they answer a different
        * question about a different facet: calibration is monitoring -- do you know when you are
        * right -- and this is selection, which move you produce. Placing it inside the
        * calibration block would invite reading one as a refinement of the other.
        */}
      {/*
        * Above the probe panel because it reads the SAME decisions the bucket rows above it read,
        * and it exists to correct how those rows are counted. The probe is a separate facet on a
        * different question and belongs after both.
        */}
      <ProfilePanel
        variables={reading.profile.variables}
        crossing={reading.profile.crossing}
      />
      <CounterfactualPanel reading={reading.counterfactual} />
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
  /*
   * THE HEADING DEPENDS ON WHETHER THE TOOL ACTUALLY SPOKE, and until now it did not.
   *
   * `mix.n` counts decisions the ENGINE ANSWERED for. "מה הכלי אמר לכם" is a claim about a person
   * having been told. On a deferred game those are different sets: `reveal-timing.ts` holds the
   * verdict to the end of the game while the engine runs during play, so the panel distributed
   * decisions across four sentences the player had never read and headed the list with a claim
   * that they had.
   *
   * THE SECOND HEADING IS NOT AN APOLOGY AND NOT A LESSER RESULT. The measurement is the same
   * measurement; what changes is whose fact it is. A reading of the instrument -- which of its four
   * sentences this record produces -- is exactly what `oneThingMix` was built to be.
   */
  const spoke = mix.withheld === 0;
  const title = spoke ? "מה הכלי אמר לכם עד כה" : "מה הכלי מצא בהחלטות שלכם";
  if (mix.n < MIN_BUCKET_N) {
    return (
      <div className="mix-block">
        <h4 className="dash-title">{title}</h4>
        <NotMeasured
          reason={`המנוע ענה על ${mix.n} החלטות, ונדרשות ${MIN_BUCKET_N} כדי לדווח על ההתפלגות. עד אז כל אחוז כאן היה רעש.`}
        />
      </div>
    );
  }
  return (
    <div className="mix-block">
      <h4 className="dash-title">{title}</h4>
      {!spoke && (
        <p className="dash-note" dir="rtl">
          הכלי החזיק את המשפטים האלה עד סוף המשחק ב-{mix.withheld} מתוך {mix.n} ההחלטות, ולכן זו
          רשימה של מה שנמדד ולא של מה שהוצג לכם בזמן אמת. הרשומה יודעת מתי המנוע ענה. היא לא מתעדת
          מתי, ואם, קראתם את התשובה.
        </p>
      )}
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
