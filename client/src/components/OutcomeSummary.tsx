/**
 * What came out, before what produced it.
 *
 * WHAT THIS IS FOR. Everything on the Record page is true and almost none of it is an answer. A
 * returning player arrives with one question -- did this find anything about me, and how much
 * should I believe it -- and has to assemble the answer from a calibration decomposition, six
 * bucket rows, a discrimination area, an effort correlation, a split-half check and a claim card.
 * This is the answer, first, in at most three sentences. The instrumentation stays exactly where
 * it is, underneath.
 *
 * IT OWNS NO ACTION, AND THAT IS DELIBERATE. There is no button here. `AnchorRunControl` owns the
 * bank, `ClaimPanel` owns starting a drill, the board owns recording, `ContextRibbon` owns saying
 * where the loop is. A summary that grew a "start a drill" button because it would look decisive
 * there would be a second door to a question that already has one, and the two would drift.
 *
 * EVERY LINE COMES FROM `outcome-summary.ts`, which takes each sentence from the module entitled
 * to say it and carries that module's name in `source`. This file chooses type, order and weight.
 * It does not choose words.
 *
 * THE BADGE IS THE EPISTEMIC TYPE, NOT A SCORE. `hypothesis` and `tested-claim` get visibly
 * different treatment because the difference between them is the one a reader loses first -- a
 * hypothesis rendered with the authority of a replicated finding has been promoted by layout,
 * without anyone writing a stronger sentence.
 */
import type { OutcomeKind, OutcomeStatement } from "@/lib/outcome-summary";
import { SCREEN_QUESTIONS } from "@shared/screen-questions";

/**
 * What each kind is called on screen.
 *
 * A graded claim carries its grade word instead of a kind label -- `GRADE_WORD` is the vocabulary
 * and this must not invent a synonym for it -- so `tested-claim` and `hypothesis` are absent here
 * and read `statement.gradeWord`.
 */
/**
 * What each kind is called on screen.
 *
 * `תיאור`, `תוצאה` and `עוד אין מספיק` are already the words a player would use and are left alone.
 * The other two were the ones exposing the machinery:
 *
 *   `לא נקרא` said the reading failed without saying what a reader should conclude, which is
 *   nothing. `לא הצלחנו לקרוא` names the failure as the product's rather than the record's.
 *
 *   `עקביות פנימית` is a statistical term for a split-half check. `אותו דבר בשתי המחציות` says
 *   exactly what was compared and claims no more: it is still two halves of ONE sitting, still
 *   not a test across time, and the statement itself carries that caveat.
 */
const KIND_LABEL: Record<Exclude<OutcomeKind, "tested-claim" | "hypothesis">, string> = {
  "record-description": "תיאור",
  "no-pattern": "תוצאה",
  insufficient: "עוד אין מספיק",
  unreadable: "לא הצלחנו לקרוא",
  "same-twice": "אותו דבר בשתי המחציות",
};

function label(statement: OutcomeStatement): string {
  if (statement.gradeWord) return statement.gradeWord;
  return KIND_LABEL[statement.kind as Exclude<OutcomeKind, "tested-claim" | "hypothesis">];
}

export function OutcomeSummary({ statements }: { statements: readonly OutcomeStatement[] }) {
  /*
   * NOTHING RATHER THAN A PLACEHOLDER. A record too thin to say anything gets no card: the front
   * door already owns that moment and says the true thing about it, and a summary showing empty
   * slots would be the product promising a shape it has not filled.
   */
  if (statements.length === 0) return null;

  return (
    <section className="outcome-summary" aria-label={SCREEN_QUESTIONS.outcome} dir="rtl">
      {/*
        * THE HEADING IS THE REGION LABEL, from one place. It was a literal beside
        * `aria-label`, which is the same sentence written twice -- and the way that fails is that
        * somebody improves one of them.
        */}
      <h3 className="outcome-summary__title">{SCREEN_QUESTIONS.outcome}?</h3>
      <ol className="outcome-summary__list">
        {statements.map((statement) => (
          <li
            key={`${statement.kind}-${statement.text.slice(0, 24)}`}
            className="outcome-summary__item"
            /*
             * The kind on the element, so the stylesheet cannot accidentally give a hypothesis the
             * treatment of a finding by inheriting a shared class -- and so a test can assert the
             * two are rendered as different things rather than merely worded differently.
             */
            data-kind={statement.kind}
            /*
             * THE GRADE BESIDE THE KIND, because `replicated` and `refuted` share a kind and must
             * not share a weight. They are one kind honestly -- both are claims a forward test has
             * graded -- so a stylesheet with only `kind` to reach for gave the strongest colour on
             * the page to a refutation as well, while the CSS beside it said in as many words that
             * only a survived test carries it. `Claim.grade` stays the source of truth and no new
             * taxonomy is invented; the attribute simply lets the styling see what the word does.
             */
            data-grade={statement.grade ?? undefined}
          >
            <span
              className="outcome-summary__badge"
              data-kind={statement.kind}
              data-grade={statement.grade ?? undefined}
            >
              {label(statement)}
            </span>
            <p className="outcome-summary__text">{statement.text}</p>
            {/* R1: the statement never renders without what it rests on. */}
            {statement.basis && <p className="outcome-summary__basis">{statement.basis}</p>}
          </li>
        ))}
      </ol>
      <p className="outcome-summary__note">
        הפירוט המלא נמצא מתחת. מה שכתוב כאן לא חזק יותר ממה שכתוב שם — זו אותה מדידה, מוצגת קודם.
      </p>
    </section>
  );
}
