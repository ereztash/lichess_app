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

const GRADE_MEANING: Record<Claim["grade"], string> = {
  hypothesis: "נגזר מהחלטות שכבר נרשמו. עוד נתונים מאותו סוג לא יאששו את זה — רק דריל קדימה יכול.",
  replicated: "שרד דריל אחד לפחות שהיה יכול להפריך אותו.",
  refuted: "נבדק קדימה ונכשל. נשמר לתמיד, כדי שאותו דפוס שגוי לא יתגלה מחדש.",
};

export function ClaimCard({ claim, othersWithheld }: { claim: Claim; othersWithheld: number }) {
  return (
    <section className={`claim-card grade-${claim.grade}`} aria-label="טענה על השחקן">
      <header className="claim-header">
        <FlaskConical size={14} />
        {/* The grade and n render together with the claim, never apart from it. */}
        <Value provenance={{ kind: "claim", n: claim.n, grade: claim.grade }}>
          {GRADE_WORD[claim.grade].he}
        </Value>
      </header>

      <p className="claim-statement">{claim.statement}</p>
      <p className="claim-scope">תחום: {claim.scope}</p>
      <p className="claim-grade-meaning">{GRADE_MEANING[claim.grade]}</p>

      <div className="claim-refutation">
        <span>מה יפריך את זה</span>
        <p>{claim.refutation_condition}</p>
      </div>

      {claim.prospective_tests.length > 0 && (
        <p className="claim-tests">נבדק קדימה {claim.prospective_tests.length} פעמים.</p>
      )}

      {othersWithheld > 0 && (
        <p className="claim-withheld">
          נמצאו עוד {othersWithheld} דפוסים אפשריים. הם לא מוצגים — דף שמראה הכול הוא דף שאחריו לא
          משנים כלום.
        </p>
      )}
    </section>
  );
}
