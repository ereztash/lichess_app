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
import { groupUnclear, type Unclear, type UnclearGroup } from "@shared/record-order";
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
          <Groups items={waits} waiting />
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
          <Groups items={deadEnds} waiting={false} />
        </>
      )}
    </section>
  );
}

/**
 * THE REASON ONCE, AND THE SPLITS IT BLOCKS UNDER IT.
 *
 * WHAT THIS REPLACES. The sentence was rendered inside every row, and `whatIsUnclear` makes one row
 * per bucket with three possible causes -- so a small record put all six buckets under
 * `too-few-in-bucket` and printed the same sentence six times, and a blitz record printed a
 * hundred-character sentence about a line nothing crossed twice, with a bucket name the only thing
 * differing. A word repeated in every row of a list carries no information in any of them.
 *
 * THE ROW IS STILL THE THING THAT IS UNCLEAR. `.unclear__item` is one split, `data-waiting` is on
 * it, and the count stays beside it -- so what a reader can act on is unchanged and only the
 * repetition is gone. The grouping adds one statement the flat list could not make: these are
 * blocked for the SAME reason.
 */
function Groups({ items, waiting }: { items: readonly Unclear[]; waiting: boolean }) {
  return (
    <ul className="unclear__list">
      {groupUnclear(items).map((group: UnclearGroup) => {
        /*
         * ONE QUANTITY FOR THE GROUP WHEN EVERY ROW IN IT CARRIES THE SAME ONE.
         *
         * THE SAME ARGUMENT THE REASON ALREADY WON, APPLIED TO THE NUMBER. This component exists
         * because a sentence repeated in every row carries no information in any of them; the
         * reason was hoisted to the group and the count was deliberately left beside each split,
         * so that what a reader can act on stayed where it was.
         *
         * On the record every arrival has, that count is the same in every row. All six buckets
         * are empty on both sides, so all six ask for the same figure, and the screen printed it
         * six times over -- a number repeated down a column, which is a progress bar with the bar
         * left out and the reader supplying the arithmetic. `GATE-GOAL-NOT-A-DENOMINATOR` guards
         * against exactly that shape eleven rows further down the page and cannot see this one,
         * because there is no goal in it and no percentage.
         *
         * WHEN THE ROWS DIFFER, NOTHING MOVES. A record far enough along for its buckets to be
         * short by different amounts is one where the per-split number is the information, and it
         * stays exactly where it was.
         */
        /*
         * AMONG THE ROWS THAT HAVE A QUANTITY, AND THE FIRST VERSION MISSED THAT CLAUSE.
         *
         * A group mixes rows that carry a count with rows that carry none: `too-few-in-bucket`
         * holds the five bucket splits, each short by the same amount on a young record, AND
         * "האם המאמץ שלך הולך לאן שהספק הולך", which has no number at all. Testing every row for
         * equality let that one null make the group look mixed, so the hoist never fired and the
         * screen printed `לפחות עוד 59 החלטות` five times down a column -- the exact defect this
         * was written to remove.
         *
         * IT PASSED ITS TEST, AND THE FIXTURE IS WHY. Six rows all carrying the same count is not
         * a shape this product produces. Found by looking at a real 390x844 frame and then reading
         * the rendered DOM, which reported `shared: null` beside five identical strings.
         */
        const counted = group.items.filter((item) => item.needs !== null);
        const shared =
          counted.length > 1 && counted.every((item) => item.needs === counted[0].needs)
            ? counted[0].needs
            : null;
        return (
        <li key={group.because} className="unclear__group" data-waiting={String(waiting)}>
          <span className="unclear__because">{group.sentence}</span>
          {shared !== null && (
            <span className="unclear__needs unclear__needs--shared">{needsLabel(shared)}</span>
          )}
          <ul className="unclear__whats">
            {group.items.map((item) => (
              <li
                key={`${item.what}-${item.because}`}
                className="unclear__item"
                data-waiting={String(waiting)}
              >
                <span className="unclear__what">{item.what}</span>
                {/*
                  * THE COUNT IS SEPARATE FROM THE SENTENCE, so the sentence carries no number that
                  * could go stale, and so a screen reader reaches "eight more decisions" as its own
                  * phrase rather than buried mid-clause.
                  */}
                {item.needs !== null && shared === null && (
                  /*
                   * `לפחות`, AND THE SINGULAR WRITTEN OUT.
                   *
                   * The number is a LOWER BOUND: it assumes every decision the player takes next
                   * lands on the side of the split that needs one, and nothing makes that true --
                   * somebody who keeps playing fast can add a hundred decisions to the comparison
                   * set and close none of the gap. Rendered bare it reads as a countdown that can
                   * only go down, and a player who takes exactly that many and finds the row
                   * unchanged has been told something false by a screen whose job is to say
                   * whether going on helps.
                   *
                   * AND `עוד 1 החלטות` IS NOT HEBREW. It is the last step before a bucket becomes
                   * readable, so the ungrammatical branch was the one at the finish line.
                   */
                  <span className="unclear__needs">{needsLabel(item.needs)}</span>
                )}
              </li>
            ))}
          </ul>
        </li>
        );
      })}
    </ul>
  );
}

/**
 * The figure, said the same way wherever it lands.
 *
 * ONE FUNCTION BECAUSE IT IS RENDERED IN TWO PLACES NOW -- once per split when the splits differ,
 * once for the group when they do not -- and this product has found the same clause drifting
 * between its own copies four times. A shared number and a per-row number that worded themselves
 * differently would be the fifth.
 */
function needsLabel(needs: number): string {
  return needs === 1 ? "עוד החלטה אחת לפחות" : `לפחות עוד ${needs} החלטות`;
}
