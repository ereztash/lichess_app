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
import { PREREGISTERED_THRESHOLDS, MIN_BUCKET_N } from "@shared/detector";
import { hypothesisFromImport, type PreregOutcome } from "@shared/prereg";
import type { ImportDiagnostic } from "@shared/import-diagnostic";
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

  if (outcome.kind === "not-separable") {
    // Deliberately not a disabled button. There is nothing to wait for here -- more games would
    // sharpen the rates, but the answer "these buckets are not distinguishable" is the finding.
    return (
      <p className="prereg-note">
        אין דלי אחד שאפשר לרשום מראש: הפרש הדיוק בין הנמוך ביותר לזה שאחריו הוא{" "}
        {Math.round(outcome.separation * 100)} נקודות אחוז, וטעות הדגימה שלהם היא{" "}
        {Math.round(outcome.threshold * 100)}. לרשום את הנמוך מביניהם היה להלביש ניחוש כהשערה.
      </p>
    );
  }

  if (outcome.kind === "not-registrable") {
    return (
      <p className="prereg-note">
        הדלי הנמוך ביותר הוא מסוג שנקרא רק מתוך משחקים שכבר שוחקו, ואין לו מקבילה בלולאה החיה —
        הערכת המנוע על העמדה שעמדתם מולה קיימת רק במשחק שנגמר. אי אפשר לרשום אותו מראש.
      </p>
    );
  }

  const { hypothesis } = outcome;

  if (registered) {
    return (
      <p className="prereg-registered">
        נרשם מראש: <strong>{registered}</strong>. מכאן הגלאי בודק את הדלי הזה בלבד, על החלטות
        שנרשמו <em>אחרי</em> הרגע הזה. ייבוא נוסף ירשום השערה חדשה במקומה, והישנה תישאר ברשומה.
      </p>
    );
  }

  return (
    <div className="prereg-offer">
      <p>
        המשחקים האלה מצביעים על <strong>{hypothesis.scope}</strong> כמקום לבדוק בו —{" "}
        <Proportion value={hypothesis.evidence.accurate_rate} n={hypothesis.evidence.n} /> דיוק,
        נמוך ב-{Math.round(hypothesis.evidence.separation * 100)} נקודות אחוז מהדלי הבא, כשטעות
        הדגימה היא {Math.round(hypothesis.evidence.threshold * 100)}.
      </p>
      {/*
        * What it buys, in the only unit that matters to someone deciding whether to press it.
        * The n comes from the constants so this sentence cannot drift from the detector.
        */}
      <p className="prereg-buys">
        אם תרשמו את זה עכשיו — לפני שנרשמה החלטה חיה אחת — הגלאי יבדוק את הדלי הזה בלבד במקום שישה,
        ולכן יספיקו {PREREGISTERED_THRESHOLDS.minBucketN * 2} החלטות חשופות במקום{" "}
        {MIN_BUCKET_N * 2}. הוא <em>לא</em> יוריד את הסף של הפער עצמו.
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
        {busy ? "רושם…" : "רשום מראש את הדלי הזה"}
      </button>
      {failure && (
        <p className="commitment-error" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
