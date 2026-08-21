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
import { trpc } from "@/lib/trpc";
import { ClaimCard } from "./ClaimCard";
import { NotMeasured, Value } from "./Value";

export function ClaimPanel() {
  const query = trpc.record.claim.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

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
        <NotMeasured reason={`לא ניתן לקרוא את רשומת ההחלטות: ${query.error.message}`} />
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
        <ClaimCard claim={data.claim} othersWithheld={data.othersWithheld} />
      ) : (
        <p className="claim-silence">{data.reason}</p>
      )}
    </section>
  );
}
