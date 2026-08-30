/**
 * The one action the import diagnostic is allowed to offer: register the bucket it named.
 *
 * The reading below it says where accuracy fell off across games already played. That is not a
 * finding about the player's calibration and this component must never let it read as one --
 * nobody stated a confidence during a game already over, so the gap column on that table is
 * empty and stays empty. What the reading CAN do is name a place to look before the live loop
 * has looked anywhere, and that is worth exactly one thing, stated on the button: the detector
 * searches one bucket instead of six, so it needs 40 revealed decisions instead of 60.
 *
 * FOUR STATES, AND THEY MUST NOT RENDER ALIKE (section 4.5):
 *
 *   - separable and registrable -> the offer, with what it buys and what would refute it
 *   - separable but import-only -> the bucket has no live twin, so it cannot be registered
 *   - readable but not separable -> a finding: the buckets are closer than their sampling error
 *   - already registered        -> what is on record, and that re-importing replaces it
 *
 * The third is the one most easily lost. "We cannot tell your buckets apart" is a result, not a
 * wait, and a screen that renders it as an absent button would turn it into one.
 */
import { useState } from "react";
import { PREREGISTERED_THRESHOLDS, MIN_BUCKET_N, SEPARABILITY_K } from "@shared/detector";
import { hypothesisFromImport, type PreregOutcome } from "@shared/prereg";
import {
  resolutionFactor,
  RESOLUTION_FACTOR_CEILING,
  type ImportDiagnostic,
} from "@shared/import-diagnostic";
import { useRegisterHypothesis } from "@/lib/record-api";
import { readableFailureText } from "@/lib/commit-error";
import { Proportion } from "./Value";

export function PreregisterBridge({
  diagnostic,
  games,
}: {
  diagnostic: ImportDiagnostic;
  /** How many games this reading came from. Recorded on the hypothesis so it can be audited. */
  games: number;
}) {
  const register = useRegisterHypothesis();
  const [registered, setRegistered] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * `decisions_before` is deliberately absent here. The service reads it from the store: a caller
   * that could choose the boundary could choose zero, and the hypothesis would then be tested on
   * the decisions that suggested it. See shared/prereg.ts.
   */
  const outcome: PreregOutcome = hypothesisFromImport(diagnostic, {
    registered_at: new Date().toISOString(),
    decisions_before: 0,
    games,
  });

  if (outcome.kind === "nothing-readable") return null;

  if (outcome.kind === "only-one-readable") {
    /*
     * One readable bucket. This used to fall through to `not-separable`, which renders
     * `outcome.separation` and `outcome.threshold` -- and for this case `worstBucketVerdict`
     * returns both as literal zeros because there is no runner-up to compare against. The screen
     * printed "the difference is 0 percentage points, and their sampling error is 0" beside a
     * panel showing exactly one bucket: a comparison against something that does not exist,
     * dressed as two measurements.
     */
    return (
      <p className="prereg-note">
        רק סוג אחד נקרא מהמשחקים האלה, ושיעור לבדו אינו השוואה — אין למה להיות גרוע ממנו. כדי
        לרשום מראש צריך שני סוגים עם מספיק החלטות לפחות, כדי שיהיה אפשר להראות שהנמוך מביניהם באמת נבדל.
      </p>
    );
  }

  if (outcome.kind === "not-separable") {
    /*
     * Deliberately not a disabled button. There is nothing to wait for here -- the answer "these
     * buckets are not distinguishable" is the finding.
     *
     * WHAT WAS MISSING, and it is the difference between a refusal and a measurement. The sentence
     * gave the gap and the bar and stopped, which leaves the reader with no way to tell whether
     * they are one game short or a hundred -- and a reader with no number fills it in with the
     * least flattering guess. MEASURED on 6 real players' imports: every one of them lands here,
     * with bars of 13 to 19.5 points against gaps of 1 to 8. So this is not the rare branch; on a
     * real import it is the only branch, and it has to say what this many games can actually
     * resolve.
     */
    const factor = resolutionFactor(outcome);
    return (
      <p className="prereg-note">
        אין סוג אחד שאפשר לרשום מראש: הפרש הדיוק בין הנמוך ביותר לזה שאחריו הוא{" "}
        {Math.round(outcome.separation * 100)} נקודות אחוז, והבר שהוא צריך לעבור — שתי שגיאות
        תקן של ההפרש — הוא {Math.round(outcome.threshold * 100)} נקודות אחוז. כלומר מה שהמשחקים
        האלה מסוגלים להפריד הוא {Math.round(outcome.threshold * 100)} נקודות, וההפרש שנמדד קטן
        מזה.{" "}
        {factor === null
          ? "שני הסוגים הנמוכים יצאו שווים, ואין הפרש שאפשר להגדיל אליו את המדגם."
          : factor > RESOLUTION_FACTOR_CEILING
            ? "כדי שהפרש בגודל הזה ייקרא נדרש מדגם גדול בהרבה ממה שייבוא יכול לספק."
            : `אם השיעורים האלה יישארו במקומם, יידרשו בערך פי ${Math.round(factor)} החלטות כדי שהפרש בגודל הזה ייקרא — וזו הנחה על השיעורים, לא תחזית שההפרש יישאר.`}{" "}
        לרשום את הנמוך מביניהם היה להלביש ניחוש כהשערה.
      </p>
    );
  }

  if (outcome.kind === "not-registrable") {
    return (
      <p className="prereg-note">
        הסוג הנמוך ביותר נקרא רק מתוך משחקים שכבר שוחקו, ואין לו מקבילה בלולאה החיה —
        הערכת המנוע על העמדה שעמדתם מולה קיימת רק במשחק שנגמר. אי אפשר לרשום אותו מראש.
      </p>
    );
  }

  const { hypothesis } = outcome;

  if (registered) {
    return (
      <p className="prereg-registered">
        נרשם מראש: <strong>{registered}</strong>. מכאן הגלאי בודק את הסוג הזה בלבד, על החלטות
        שנרשמו <em>אחרי</em> הרגע הזה. ייבוא נוסף ירשום השערה חדשה במקומה, והישנה תישאר ברשומה.
      </p>
    );
  }

  return (
    <div className="prereg-offer">
      <p>
        המשחקים האלה מצביעים על <strong>{hypothesis.scope}</strong> כמקום לבדוק בו —{" "}
        <Proportion value={hypothesis.evidence.accurate_rate} n={hypothesis.evidence.n} /> דיוק,
        נמוך ב-{Math.round(hypothesis.evidence.separation * 100)} נקודות אחוז מהסוג הבא — יותר
        מהבר של שתי שגיאות תקן, שהוא {Math.round(hypothesis.evidence.threshold * 100)} נקודות אחוז.
      </p>
      {/*
       * What it buys, and what it costs, in the only unit that matters to someone deciding whether
       * to press it.
       *
       * THE LAST SENTENCE WAS THE OPPOSITE OF TRUE. It said in bold that registering would NOT
       * lower the gap threshold, and registering swaps SEPARABILITY_K (3.75) for
       * PREREGISTERED_SEPARABILITY_K (3.25). The comment here used to read "the n comes from the
       * constants so this sentence cannot drift from the detector" -- and the drift-proofing had
       * been applied to the half that did not need it, while the k was typed prose beside it.
       *
       * Both numbers come from the constants now. The lower bar is deliberate and measured
       * (detector.ts records the shuffle rates that chose 3.25), so the sentence says what it is
       * and why rather than denying it: one bucket named in advance is one chance, not six.
       */}
      <p className="prereg-buys">
        אם תרשמו את זה עכשיו — לפני שנרשמה החלטה חיה אחת — הגלאי יבדוק את הסוג הזה בלבד במקום שישה,
        ולכן יספיקו {PREREGISTERED_THRESHOLDS.minBucketN * 2} החלטות מדודות במקום{" "}
        {MIN_BUCKET_N * 2}. הסף של הפער עצמו יורד מ-{SEPARABILITY_K} ל-
        {PREREGISTERED_THRESHOLDS.separabilityK} שגיאות תקן — בדיקה של סוג אחד שנרשם מראש היא
        הזדמנות אחת ולא שש, ולכן היא לא צריכה את אותו בר.
      </p>
      <p className="prereg-refutation">{hypothesis.refutation_condition}</p>
      <button
        type="button"
        className="primary-control"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailure(null);
          try {
            const saved = await register.mutateAsync({
              bucket_key: hypothesis.bucket_key,
              scope: hypothesis.scope,
              registered_at: hypothesis.registered_at,
              evidence: hypothesis.evidence,
              refutation_condition: hypothesis.refutation_condition,
            });
            setRegistered(saved.scope);
          } catch (error) {
            // R2: a registration that failed must not leave the screen looking like it took.
            setFailure(readableFailureText(error, "הרישום לא נשמר."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "רושם…" : "רשום מראש את הסוג הזה"}
      </button>
      {failure && (
        <p className="commitment-error" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
