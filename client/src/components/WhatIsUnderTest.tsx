/**
 * §25's THIRD SECTION: what the product has committed to checking, and what would end it.
 *
 * THE REFUTATION CONDITION IS THE CONTENT, not a detail. "What is being tested" is not answered by
 * naming the claim -- it is answered by saying what result would end it the other way, which is the
 * only thing that distinguishes a test from a search for confirmation. It is stored before the test
 * runs (R5) precisely so it can be shown while the test is running, and this is the screen that
 * shows it.
 *
 * IT OWNS NO CONTROL. `ClaimPanel` starts drills and `ContextRibbon` says where the loop is; a
 * "run the drill" button here would be a second door to a question that already has one, and the
 * two would drift. Same rule `OutcomeSummary` states about itself.
 */
import { EvidenceMark } from "./EvidenceMark";
import type { UnderTest } from "@shared/record-order";
import { SCREEN_QUESTIONS } from "@shared/screen-questions";

export function WhatIsUnderTest({ test }: { test: UnderTest | null }) {
  /*
   * NOTHING RATHER THAN "NOTHING IS BEING TESTED". That sentence is true and it is already implied
   * by the section above, which says what is unclear and why; repeating it here as its own heading
   * would give a returning player two paragraphs of absence to read.
   */
  if (test === null) return null;

  return (
    <section className="under-test" aria-label={SCREEN_QUESTIONS.underTest} dir="rtl">
      <h3 className="under-test__title">{SCREEN_QUESTIONS.underTest}?</h3>
      <p className="under-test__statement">{test.statement}</p>
      <div className="under-test__authority">
        <EvidenceMark authority={test.authority} />
      </div>
      <dl className="under-test__terms">
        <dt>איפה</dt>
        <dd>{test.scope}</dd>
        <dt>מה יפריך את זה</dt>
        <dd>{test.refutationCondition}</dd>
        <dt>נבדק עד עכשיו</dt>
        {/*
          * ZERO IS ORDINARY AND IS PRINTED. A hypothesis with no forward tests yet is the normal
          * state of a hypothesis, and hiding the row until it is non-zero would make the section
          * appear only once it had good news.
          */}
        <dd>{test.testsRecorded === 0 ? "עוד לא" : `${test.testsRecorded} בדיקות קדימה`}</dd>
      </dl>
    </section>
  );
}
