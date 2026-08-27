/**
 * The claim surface (Layer B on screen).
 *
 * Section 4.5: empty and blocked are VALID STATES, not failures. "Not enough decisions yet to
 * say anything about your play" is a correct and useful screen, and it is not filled with
 * encouragement, a generic tip, or a pattern derived from four data points.
 *
 * This component has three states and no fourth: a claim, an honest silence with a reason, or
 * the record layer being unreachable. There is no state where it invents something to show.
 *
 * A fourth thing is DISCLOSED across all of them rather than being a state of its own: whether a
 * pre-registered bucket narrowed the search. That is a fact about how the answer was reached, and
 * it applies equally to a claim and to a silence.
 */
import { FlaskConical, Loader2 } from "lucide-react";
import { useClaimView } from "@/lib/record-api";
import { ClaimCard } from "./ClaimCard";
import { NotMeasured, Value } from "./Value";

/*
 * `id="claim-panel"` on all three branches, because the ribbon addresses this panel.
 *
 * `loopPosition` returns `{target: "claim"}` for the one state whose sentence names this surface
 * -- "יש השערה. דריל הוא הדבר היחיד שיכול לדרג אותה" -- and the drill button below is the only
 * control that can act on it. The id is on the loading and error branches too: a player who
 * follows the link while the record is still answering must land on the panel that is going to
 * hold the answer, not on nothing.
 */
export function ClaimPanel({
  onRunDrill,
  drillError,
}: {
  onRunDrill: (claimId: string) => void;
  drillError?: string;
}) {
  const query = useClaimView();

  if (query.isLoading) {
    return (
      <section id="claim-panel" className="claim-panel" aria-label="דפוסים">
        <p className="claim-loading">
          <Loader2 size={14} /> קורא את הרשומה…
        </p>
      </section>
    );
  }

  if (query.isError) {
    // R2: a record we could not read must not look like a record with nothing in it.
    return (
      <section id="claim-panel" className="claim-panel" aria-label="דפוסים">
        <h3>
          <FlaskConical size={14} /> דפוסים
        </h3>
        <NotMeasured reason={`לא ניתן לקרוא את רשומת ההחלטות: ${query.errorMessage}`} />
      </section>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <section id="claim-panel" className="claim-panel" aria-label="דפוסים">
      <h3>
        <FlaskConical size={14} /> דפוסים
      </h3>

      <div className="claim-progress">
        <Value label="החלטות ברשומה" provenance={{ kind: "player", unit: "נרשמו" }}>
          {data.recorded}
        </Value>
        <Value label="מתוכן נחשפו" provenance={{ kind: "player", unit: "יש להן פסק מנוע" }}>
          {data.scored}
        </Value>
      </div>

      {/*
        * HOW this answer was reached, whenever it was not the ordinary scan.
        *
        * A claim found in one bucket named in advance at n = 20 and a claim found by the full
        * six-bucket scan at n = 30 are not the same kind of finding, and a screen that rendered
        * them identically would be the product overstating one of them. Shown on both the claim
        * and the silence, because the narrowing changes what the silence means too: it is a
        * shorter wait, counted only from the import onward.
        */}
      {data.prereg && (
        <p className="claim-prereg">
          החיפוש מצומצם ל<strong>{data.prereg.scope}</strong> — הסוג שהמשחקים המיובאים הצביעו עליו,
          שנרשם לפני שנרשמה כאן החלטה. נבדקות רק החלטות שנרשמו אחרי הרישום. משיישמרו מספיק החלטות
          לסריקה המלאה, החיפוש חוזר לשישה הסוגים והרישום מפסיק לצמצם דבר.
        </p>
      )}

      {data.claim ? (
        <>
          <ClaimCard claim={data.claim} othersWithheld={data.othersWithheld} />
          {/* A hypothesis is the only grade a drill can move. A replicated claim has already
              survived one; a refuted one is final and is never re-tested. */}
          {data.claim.grade === "hypothesis" && (
            <button
              type="button"
              className="claim-run-drill"
              onClick={() => onRunDrill(data.claim!.claim_id)}
            >
              הריצו דריל — בדיקה קדימה שיכולה להפריך
            </button>
          )}
          {data.claim.grade === "refuted" && (
            <p className="claim-silence">
              הטענה הופרכה ונשמרת. אי אפשר לבדוק אותה שוב — הפרכה היא תוצאה, לא טיוטה.
            </p>
          )}
          {drillError && (
            <p className="claim-silence" role="alert">
              {drillError}
            </p>
          )}
        </>
      ) : (
        <p className="claim-silence">{data.reason}</p>
      )}
    </section>
  );
}
