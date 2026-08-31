/**
 * §25's SECOND SECTION: what the record still cannot say, and whether waiting fixes it.
 *
 * THIS IS THE MOST COMMON TRUE STATEMENT THE PRODUCT CAN MAKE. The M0 audit measured the chain as
 * silent on most records most of the time, and until now that silence was scattered across the page
 * as individual cells reading "not enough data" -- one per panel, with no way to tell which of them
 * a player could do something about.
 *
 * THE SPLIT IS THE WHOLE COMPONENT. A bucket eight decisions short and a bucket over a record that
 * holds no clock both render as "cannot be read"; one is a wait and the other is a dead end, and
 * telling a player to keep playing to fix the second is advice that cannot work. `BucketReading`
 * has carried `unmeasurableReason` for exactly this distinction and nothing had ever read it.
 *
 * IT IS NOT A CARD. `FindingCard` is for something the product is saying about the player; this is
 * a list of things it is declining to say, and dressing a refusal in the shape of a finding would
 * give it the weight of one. No evidence mark either, for the same reason -- there is no evidence
 * here to level.
 */
import { UNCLEAR_SENTENCE, type Unclear } from "@shared/record-order";
import { SCREEN_QUESTIONS } from "@shared/screen-questions";

export function WhatIsUnclear({ items }: { items: readonly Unclear[] }) {
  /*
   * NOTHING RATHER THAN "EVERYTHING IS CLEAR". An empty list means every split this record can
   * express is readable, which is a strong statement and is not this section's to make -- the
   * section above it says what was found, and a triumphant empty state here would be a second
   * voice claiming more than the first one did.
   */
  if (items.length === 0) return null;

  const waits = items.filter((item) => item.waitingHelps);
  const deadEnds = items.filter((item) => !item.waitingHelps);

  return (
    <section className="unclear" aria-label={SCREEN_QUESTIONS.unclear} dir="rtl">
      <h3 className="unclear__title">{SCREEN_QUESTIONS.unclear}?</h3>

      {waits.length > 0 && (
        <>
          <p className="unclear__lead">אלה ייפתחו עם עוד החלטות מדודות:</p>
          <ul className="unclear__list">
            {waits.map((item) => (
              <li key={`${item.what}-${item.because}`} className="unclear__item" data-waiting="true">
                <span className="unclear__what">{item.what}</span>
                <span className="unclear__because">{UNCLEAR_SENTENCE[item.because]}</span>
                {/*
                  * THE COUNT IS SEPARATE FROM THE SENTENCE, so the sentence carries no number that
                  * could go stale, and so a screen reader reaches "eight more decisions" as its own
                  * phrase rather than buried mid-clause.
                  */}
                {item.needs !== null && (
                  <span className="unclear__needs">עוד {item.needs} החלטות</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {deadEnds.length > 0 && (
        <>
          <p className="unclear__lead">
            {/*
              * SAID PLAINLY, AND NOT SOFTENED. A player who keeps playing to unlock one of these is
              * spending their time on something the instrument cannot give them, and a gentler
              * sentence here buys nothing except that.
              */}
            אלה לא ייפתחו מעוד משחקים:
          </p>
          <ul className="unclear__list">
            {deadEnds.map((item) => (
              <li key={`${item.what}-${item.because}`} className="unclear__item" data-waiting="false">
                <span className="unclear__what">{item.what}</span>
                <span className="unclear__because">{UNCLEAR_SENTENCE[item.because]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
