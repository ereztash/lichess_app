/**
 * Rendering a claim about the player (section 3.3, GATE-GRADE).
 *
 * A claim NEVER renders above its grade. The word for a hypothesis is never the word for a
 * replicated finding, and n is always on screen. This component cannot render a statement
 * without both -- there is no branch through it that omits them.
 *
 * The statement is deliberately NOT the largest thing here. What the claim is worth is carried
 * by its grade and its n, and those are what the reader must not be able to skip.
 */
import { FlaskConical } from "lucide-react";
import type { Claim } from "@shared/claim";
import { GRADE_WORD } from "@shared/claim";
import { Value } from "./Value";

/**
 * What each grade means, in the words a player would use.
 *
 * `refuted` IS DELIBERATELY UNCHANGED. The tri-state test verdict -- supports / contradicts /
 * inconclusive -- does not exist yet, so today a test that fails to support a claim marks it
 * refuted. Any plainer rewrite ("it did not come back", "the pattern is gone") would read as clean
 * evidence of absence, which is a stronger statement than the mechanism behind it can make.
 *
 * TODO: player-language rewrite of the refuted wording is blocked until tri-state test verdict
 * semantics exist. Rewriting it before then would strengthen the statistical meaning.
 */
const GRADE_MEANING: Record<Claim["grade"], string> = {
  hypothesis:
    "עלה מהחלטות שכבר שיחקת. עוד החלטות מאותו סוג לא יחזקו את זה — רק בדיקה על החלטות חדשות.",
  replicated: "עמד בבדיקה אחת לפחות על החלטות חדשות, שיכלה להפיל אותו.",
  refuted: "נבדק קדימה ונכשל. נשמר לתמיד, כדי שאותו דפוס שגוי לא יתגלה מחדש.",
};

export function ClaimCard({ claim, othersWithheld }: { claim: Claim; othersWithheld: number }) {
  return (
    <section className={`claim-card grade-${claim.grade}`} aria-label="מה חוזר אצלך">
      <header className="claim-header">
        <FlaskConical size={14} />
        {/* The grade and n render together with the claim, never apart from it. */}
        <Value provenance={{ kind: "claim", n: claim.n, grade: claim.grade }}>
          {GRADE_WORD[claim.grade].he}
        </Value>
      </header>

      <p className="claim-statement">{claim.statement}</p>
      <p className="claim-scope">איפה זה הופיע: {claim.scope}</p>
      <p className="claim-grade-meaning">{GRADE_MEANING[claim.grade]}</p>

      <div className="claim-refutation">
        <span>מה צריך לקרות כדי לדעת שזה לא מחזיק</span>
        <p>{claim.refutation_condition}</p>
      </div>

      {claim.prospective_tests.length > 0 && (
        /*
         * "פעם אחת" rather than "1 פעמים". The count is the evidence and it stays; what changed is
         * that Hebrew does not pluralise one, and a sentence a player trips over is a sentence they
         * stop reading. The number leads for every other count, which is also where it belongs.
         */
        <p className="claim-tests">
          {claim.prospective_tests.length === 1
            ? "נבדק פעם אחת על החלטות חדשות."
            : `נבדק ${claim.prospective_tests.length} פעמים על החלטות חדשות.`}
        </p>
      )}

      {othersWithheld > 0 && (
        <p className="claim-withheld">
          נמצאו עוד {othersWithheld} דברים שאולי חוזרים. הם לא מוצגים — דף שמראה הכול הוא דף
          שאחריו לא משנים כלום.
        </p>
      )}
    </section>
  );
}
