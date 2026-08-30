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
import { GRADE_WORD, awaitingProtocol, gradeIsSettled, testedUnder } from "@shared/claim";
import { PROTOCOL_WORD } from "@shared/validation-protocol";
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

/**
 * What an unsettled grade says, in one sentence: which protocol ran, and which one still has to.
 *
 * BOTH READS CAN BE NULL AND NEITHER IS EXPECTED TO BE. `gradeIsSettled` is false here, so the
 * claim was graded by a protocol that is not the one its bucket requires -- which means both a
 * tested protocol and a required one exist. The fallbacks are there because a type that admits
 * null should not be read through `!`, and if one ever does come back null the sentence stays
 * grammatical and says less rather than asserting something nobody measured.
 */
function offProtocolMeaning(claim: Claim): string {
  const ran = testedUnder(claim);
  const needed = awaitingProtocol(claim);
  const where = ran ? `נבדק ב${PROTOCOL_WORD[ran]}` : "נבדק בפרוטוקול אחר";
  const close = needed ? ` כדי לסגור את זה צריך ${PROTOCOL_WORD[needed]}.` : "";
  return `${where}, שלא מריץ את התנאי שהטענה מדברת עליו.${close}`;
}

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
      {gradeIsSettled(claim) || claim.grade === "hypothesis" ? (
        <p className="claim-grade-meaning">{GRADE_MEANING[claim.grade]}</p>
      ) : (
        /*
         * THE GRADE NAMES THE PROTOCOL THAT PRODUCED IT (ADR-003), because the same word means two
         * different things depending on what was running while the test happened. A claim about
         * deciding under a clock, checked in a drill with no clock, has been measured -- and not
         * measured under the condition it is about. Printing the bare word here would tell the
         * player a question was settled that the test could not reach.
         */
        <p className="claim-grade-meaning claim-grade-off-protocol">
          {offProtocolMeaning(claim)}
        </p>
      )}

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
