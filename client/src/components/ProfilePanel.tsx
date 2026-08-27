/**
 * The game profile: the buckets read as variables, and the variables crossed.
 *
 * WHY THIS PANEL AND THE BUCKET ROWS ABOVE IT SAY DIFFERENT THINGS. Those rows report each bucket
 * against the rest of the record, one row per bucket. This reads them as levels of a VARIABLE and
 * gives each variable one finding -- because three phase rows are three answers to one question,
 * and when one phase is genuinely bad the other two read as findings in the opposite direction.
 * Measured on 400 simulated players with exactly one weakness: 35% were told they had more than
 * one pattern, and every time the clean opening fired it fired as underconfident, 78 times out of
 * 78.
 *
 * AND THEN THE CROSSING, which is the only place a profile can live. "Worse in the middlegame" and
 * "worse when fast" as two separate facts cannot say whether that is two weaknesses or one seen
 * twice -- and a player fine in slow middlegame positions and miscalibrated in fast ones has a
 * weakness no single bucket describes.
 *
 * NOTHING HERE IS A CLAIM, AND THE PANEL SAYS SO. These findings come out of `detect` -- the same
 * candidates a Layer B claim is drawn from -- but they are not claims: none carries a grade, a
 * refutation condition, or a prospective test, and GATE-GRADE therefore does not govern them
 * because they are not `Claim` objects. That is exactly why the sentence has to be here. A row
 * that reads like a finding, in a product whose whole discipline is that a claim renders at its
 * grade, would be the one place a statement about the player escapes the rule -- by not being
 * shaped like the thing the rule checks.
 *
 * WHAT IS PRINTED WHEN NOTHING IS FOUND, which is most of the time on most records. The share of
 * cells that could be read at all, and separately the ones no amount of further play can fill.
 * Silence with a denominator is a state a player can act on; a blank panel is indistinguishable
 * from a bug, and "keep playing" said about a cell that needs clock data a record does not have is
 * worse than saying nothing.
 */
import { MIN_BUCKET_N } from "@shared/detector";
import type { VariableReading } from "@shared/bucket-variable";
import type { CrossedFinding, CrossingReading } from "@shared/crossing";
import { NotMeasured, Rate } from "@/components/Value";

/**
 * Which way this cell sits AGAINST THE REST OF THE RECORD -- not how the player did in it.
 *
 * `gapDifference` is `inside.gap - outside.gap` (shared/detector.ts, shared/crossing.ts): a
 * contrast between two groups. This read it and said "הצהרתם יותר ביטחון ממה שיצא" -- "you stated
 * more confidence than came out" -- which is a statement about the player INSIDE the cell, and the
 * one number it is given cannot support it. The doc comment even claimed it said "what happened".
 *
 * Reproduced through the real record: a player underconfident everywhere and least so in the
 * opening has `inside.gap -0.050`, `outside.gap -0.300`, so `gapDifference +0.250`, and this line
 * told them they had stated more confidence than came out in the one phase where they had stated
 * five points LESS. The same defect and the same cause as `statementFor` in
 * shared/claim-derivation.ts, on a second surface of the same page.
 *
 * `detect` never tests a cell's own gap against zero -- what cleared the separability bar is the
 * contrast -- so the contrast is what may be spoken, and it is spoken as a comparison.
 */
const direction = (gapDifference: number) =>
  gapDifference > 0
    ? "הביטחון המוצהר גבוה יותר ביחס לתוצאה מאשר בשאר הרשומה"
    : "הביטחון המוצהר נמוך יותר ביחס לתוצאה מאשר בשאר הרשומה";

function CrossedFindingRow({ finding }: { finding: CrossedFinding }) {
  const { strongest } = finding;
  return (
    <li className="profile-panel__crossing">
      <span className="profile-panel__crossing-scope">
        {strongest.left.scope} <bdi>×</bdi> {strongest.right.scope}
      </span>
      <span className="profile-panel__crossing-reading">
        {direction(strongest.gapDifference)}, על <bdi>{strongest.inside.n}</bdi> החלטות.
      </span>
      {finding.mirrored.length > 0 && (
        <span className="profile-panel__mirror">
          {/*
            * NOT A SECOND FINDING. A cell is measured against everything outside it, and the
            * outside contains this weakness -- so its complement reads the opposite way by
            * arithmetic. Saying so is more useful than either hiding it or printing it as news.
            */}
          התא ההפוך נראה טוב יותר כתוצאה מזה, ולא כממצא נפרד.
        </span>
      )}
    </li>
  );
}

export function ProfilePanel({
  variables,
  crossing,
}: {
  variables: VariableReading;
  crossing: CrossingReading;
}) {
  const { findings } = variables;
  const readableShare = crossing.tried > 0 ? crossing.measurable / crossing.tried : 0;

  return (
    <section className="profile-panel">
      <h3 className="profile-panel__title">פרופיל המשחק</h3>
      {/*
        * FIRST, BEFORE ANY OF IT. A reader who takes these for conclusions has been told more than
        * was measured -- and unlike a claim, none of this has a refutation condition or a drill
        * behind it, so nothing here can ever have been wrong in a way the record would notice.
        */}
      <p className="profile-panel__status">
        מה שלמטה הוא תיאור של הרשומה, לא טענה שנבדקה. אין לזה תנאי הפרכה ואף דריל לא העמיד את זה
        במבחן — בשביל זה יש את הטענה שהמוצר מעלה בנפרד.
      </p>

      {findings.length === 0 ? (
        <NotMeasured reason="אף משתנה עדיין לא נפרד משאר הרשומה" />
      ) : (
        <ul className="profile-panel__variables">
          {findings.map((finding) => (
            <li key={finding.variable.key} className="profile-panel__variable">
              <span className="profile-panel__variable-label">{finding.variable.label}</span>
              <span className="profile-panel__variable-reading">
                {finding.strongest.scope}: {direction(finding.strongest.gapDifference)}, על{" "}
                <bdi>{finding.strongest.inside.n}</bdi> החלטות.
              </span>
              {finding.mirrored.length > 0 && (
                <span className="profile-panel__mirror">
                  שאר הרמות של המשתנה הזה נראות טוב יותר כתוצאה מזה. זה אותה מדידה מהצד השני,
                  ולא ממצא נוסף.
                </span>
              )}
              {finding.alongside.length > 0 && (
                <span className="profile-panel__alongside">
                  {/* Same direction is a real second statement, unlike a mirror. */}
                  עוד <bdi>{finding.alongside.length}</bdi> מרמות המשתנה נוטות לאותו כיוון.
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <h4 className="profile-panel__subtitle">הצלבות</h4>
      {crossing.findings.length > 0 ? (
        <ul className="profile-panel__crossings">
          {crossing.findings.map((finding) => (
            <CrossedFindingRow key={finding.pair} finding={finding} />
          ))}
        </ul>
      ) : (
        <NotMeasured reason="אף הצלבה לא נפרדה משאר הרשומה" />
      )}

      <p className="profile-panel__denominator">
        {/*
          * R1: the silence carries the denominator it is a silence over. `Rate` prints the
          * fraction beside the percentage, so "1 of 11" and "7 of 11" cannot read the same.
          */}
        נקראו <Rate value={crossing.measurable} of={crossing.tried} label="תאים מוצלבים" />{" "}
        — תא נבדק רק כשיש בו ומחוצה לו לפחות <bdi>{MIN_BUCKET_N}</bdi> החלטות.
      </p>
      {crossing.impossible > 0 && (
        <p className="profile-panel__impossible">
          {/*
            * The distinction R2 exists for. These cells are not short of decisions; they are
            * unreachable, and telling a player to keep playing toward them would be false.
            */}
          מתוכם <bdi>{crossing.impossible}</bdi> תאים לא יתמלאו לעולם ברשומה הזאת, כי אין בה
          נתוני שעון. זה לא עניין של עוד החלטות.
        </p>
      )}
    </section>
  );
}
