/**
 * What the road not taken said, on the screen where a reading has to be to count.
 *
 * THIS PANEL IS THE HALF THAT MAKES THE PROBE A MEASUREMENT. Everything before it -- the arm on
 * every decision, the answer, the alternative priced off the same root search -- is collection.
 * This session's recurring defect, found nine times, is a distinction measured and then discarded
 * before display, and a probe nobody can read back is that defect with the expensive half paid.
 *
 * WHAT IS ON IT, AND WHY IT IS SO LITTLE. Counts with the denominators they came out of. No rate
 * until `MIN_BUCKET_N` scored answers exist, and the panel says how many are still missing rather
 * than going blank -- an absence with a number in it is a state a player can act on, and a blank
 * one is indistinguishable from a bug.
 */
import { MIN_BUCKET_N } from "@shared/detector";
import type { CounterfactualRecordReading } from "@shared/counterfactual-reading";
import { NotMeasured, Rate } from "@/components/Value";

/**
 * One sentence per reading, and each says what the PAIR OF MOVES was -- never what the player is.
 *
 * "reachable" is the one the whole thing exists for and it is the easiest to overstate. It says a
 * better move was named after the commitment; it does not say the player "knew" it, "had it and
 * talked themselves out of it", or any other account of a mind. What happened is that two moves
 * were compared and one of them scored better.
 */
const READING_LABEL = {
  reachable: "המהלך שנקבתם אחרי הרישום היה טוב יותר מזה שרשמתם",
  narrow: "רשמתם מהלך מדויק, והחלופה שנקבתם לא הייתה",
  "both-good": "שני המהלכים היו מדויקים",
  neither: "שני המהלכים לא היו מדויקים",
} as const;

/** The order is the interesting one first, not the alphabet. */
const ORDER = ["reachable", "narrow", "both-good", "neither"] as const;

export function CounterfactualPanel({ reading }: { reading: CounterfactualRecordReading }) {
  const { asked, answered, namedNothing, scored, readings, arms, measurable, shortBy } = reading;

  return (
    <section className="counterfactual-panel">
      <h3 className="counterfactual-panel__title">השאלה על החלופה</h3>
      <p className="counterfactual-panel__what">
        אחרי חלק מההחלטות נשאלתם מה הייתם עושים במקום המהלך שרשמתם. השאלה נשאלת אחרי שהמהלך
        ננעל ולפני שהמנוע מדבר, והחלופה נמדדת באותו חיפוש שמדד את המהלך שבחרתם.
      </p>

      {asked === 0 ? (
        <NotMeasured reason="עדיין לא נשאלתם את השאלה הזאת" />
      ) : (
        <>
          <ul className="counterfactual-panel__denominators">
            <li>
              נשאלתם ב־<bdi>{asked}</bdi> החלטות מתוך <bdi>{arms.probed + arms["not-probed"]}</bdi>{" "}
              שהיו כשירות לשאלה.
            </li>
            <li>
              עניתם ב־<bdi>{answered}</bdi> מהן; ב־<bdi>{namedNothing}</bdi> אמרתם שלא היה מהלך
              אחר.
            </li>
            <li>
              ב־<bdi>{scored}</bdi> מהן נקבתם מהלך שהמנוע תמחר, ורק הן נכנסות לקריאות שלמטה.
            </li>
          </ul>

          {scored === 0 ? (
            <NotMeasured reason="אין עדיין חלופה שנמדדה" />
          ) : (
            <ul className="counterfactual-panel__readings">
              {ORDER.map((key) => (
                <li key={key} className={`counterfactual-panel__reading is-${key}`}>
                  <span className="counterfactual-panel__reading-label">{READING_LABEL[key]}</span>
                  {/*
                   * A RATE ONLY ONCE THERE ARE ENOUGH, and a count with its denominator either
                   * way. `Rate` renders "n/of" beside the percentage, so the reader can see that
                   * 1/1 and 156/300 are not the same claim -- which is what R1 is about.
                   */}
                  {measurable ? (
                    <Rate value={readings[key]} of={scored} />
                  ) : (
                    <span className="counterfactual-panel__count">
                      <bdi>{readings[key]}</bdi> מתוך <bdi>{scored}</bdi>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!measurable && scored > 0 && (
            <p className="counterfactual-panel__short">
              עוד <bdi>{shortBy}</bdi> חלופות שנמדדו ואפשר יהיה לומר שיעור ולא רק ספירה (
              <bdi>{MIN_BUCKET_N}</bdi> זה הרף שכל הרשומה עובדת לפיו).
            </p>
          )}
        </>
      )}

      {/*
       * THE NEGATIVE CONTROL, said out loud rather than kept for a maintainer.
       *
       * The arm is drawn after the decision is complete, so being asked cannot have changed the
       * decision it is attached to. Two arms that read differently here are chance or a broken
       * randomisation -- and a player looking at their own numbers is entitled to know which
       * comparison is the one that is supposed to come out empty.
       */}
      <p className="counterfactual-panel__control">
        ההגרלה נעשית אחרי שההחלטה ננעלה, ולכן היא לא יכולה להשפיע עליה. דיוק בהחלטות שנשאלו:{" "}
        <ArmRate arm={reading.accuracyByArm.probed} />; בהחלטות שלא נשאלו:{" "}
        <ArmRate arm={reading.accuracyByArm["not-probed"]} />. אלה אמורים לצאת דומים.
      </p>
    </section>
  );
}

/**
 * The same floor as the readings above, and this line is where the panel broke its own rule.
 *
 * The first version rendered `<Rate>` unconditionally, so a record with three probed decisions
 * printed "0% (0/3)" as the randomisation check -- a rate from three, in the very sentence that
 * asks the reader to compare two numbers and judge whether they match. A reader comparing 0% with
 * "no data" would conclude the randomisation was broken. Its own render test caught it.
 *
 * `Rate` already refuses a zero denominator with "אין נתונים" rather than a division; what it
 * does not know is `MIN_BUCKET_N`, which is a property of this record and not of a fraction.
 */
function ArmRate({ arm }: { arm: { accurate: number; n: number } }) {
  if (arm.n > 0 && arm.n < MIN_BUCKET_N) {
    return (
      <span className="counterfactual-panel__count">
        <bdi>{arm.accurate}</bdi> מתוך <bdi>{arm.n}</bdi>
      </span>
    );
  }
  return <Rate value={arm.accurate} of={arm.n} />;
}
