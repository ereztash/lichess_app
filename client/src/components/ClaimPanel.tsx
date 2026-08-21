/**
 * The claim surface (Layer B on screen).
 *
 * Section 4.5: empty and blocked are VALID STATES, not failures. "Not enough decisions yet to
 * say anything about your play" is a correct and useful screen, and it is not filled with
 * encouragement, a generic tip, or a pattern derived from four data points.
 *
 * This component has three states and no fourth: a claim, an honest silence with a reason, or
 * the record layer being unreachable. There is no state where it invents something to show.
 */
import { FlaskConical, Loader2 } from "lucide-react";
import { useClaimView } from "@/lib/record-api";
import { ClaimCard } from "./ClaimCard";
import { NotMeasured, Value } from "./Value";

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
      <section className="claim-panel" aria-label="דפוסים">
        <p className="claim-loading">
          <Loader2 size={14} /> קורא את הרשומה…
        </p>
      </section>
    );
  }

  if (query.isError) {
    // R2: a record we could not read must not look like a record with nothing in it.
    return (
      <section className="claim-panel" aria-label="דפוסים">
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
    <section className="claim-panel" aria-label="דפוסים">
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
