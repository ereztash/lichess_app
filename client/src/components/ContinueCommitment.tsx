/**
 * ONE SEMANTIC ACT, RENDERED WHEREVER THE PLAYER HAPPENS TO BE.
 *
 * WHAT THIS IS FOR. A drill and a transfer are pre-registered tests -- eight positions, or three,
 * written down with their refutation condition before the first board is shown. Four of eight
 * answered tests nothing, so finishing the set is the only act that makes the four already
 * committed mean anything, and `deriveNextAction` says so by putting `continue-drill` and
 * `continue-transfer` above every other branch.
 *
 * AND UNTIL NOW THE PRODUCT HAD ONE CONTROL THAT COULD EXPRESS IT, INSIDE THE RUN. `continue-run`
 * appeared once in the whole client -- `Home.tsx`'s header, under `learningTransferStage ===
 * "running"` -- so it was reachable only by somebody who was already there. Navigate away, close
 * the tab, come back tomorrow: the record still held the open run, every screen still offered a new
 * game at full weight, and nothing anywhere said a set was waiting. The commitment survived as a
 * ROW and did not survive as a PRIORITY, which is the difference this component exists to close.
 *
 * IT IS A RENDERER AND NOT A POLICY. Which run outranks, and whether a surface must stand its own
 * primary down, is `continuationOffer`'s answer in `shared/continuation-offer.ts` -- a file with no
 * JSX in it, so a gate can ask it without rendering a screen. This component decides what the act
 * LOOKS like on the surface it is mounted in, which is the one thing a surface is entitled to decide.
 *
 * THE COPY CARRIES NO ARCHITECTURE. Nothing here says "continuation", "canonical", "branch" or
 * "preregistered evidence set". What a player is told is that they started testing something and
 * there is a set to finish, with the two numbers that make that concrete.
 */
import { primaryAction } from "@shared/primary-action";
import {
  CONTINUE_CTA,
  CONTINUE_HEADLINE,
  continueProgress,
  STUCK_CTA,
  STUCK_HEADLINE,
  UNREADABLE_NOTE,
  type ContinuationOffer,
} from "@shared/continuation-offer";

export { continuationOffer, CONTINUE_HEADLINE, CONTINUE_CTA } from "@shared/continuation-offer";
export type { ContinuationOffer } from "@shared/continuation-offer";

/**
 * The control, at whatever weight the surface mounting it says.
 *
 * `variant` IS THE SURFACE'S TO SET AND THE ONLY THING IT SETS. The record's front door draws its
 * primary as a bare button, the resume card draws one inside a finding, and the post-game draws one
 * under a summary; the ACT is identical in all three and `data-primary-action="continue-run"` says
 * so to the gates that count acts. What differs is the frame, and the frame is presentation.
 */
export function ContinueCommitment({
  offer,
  onResume,
  onClose,
  className = "primary-control",
}: {
  offer: ContinuationOffer;
  onResume: (run: { kind: "drill" | "transfer"; id: string }) => void;
  onClose: (drillId: string) => void;
  className?: string;
}) {
  if (offer.kind === "silent") return null;
  if (offer.kind === "unreadable") {
    /*
     * A READ IN FLIGHT DRAWS NOTHING, AND A FAILED ONE SAYS SO. Measured in Chromium: rendering the
     * note for both put an untrue sentence on the front door for the few hundred milliseconds
     * before the reading arrived, and then removed it -- a 0.10 layout shift against a 0.02 budget,
     * on the topmost element of the page. The silence while a request is in flight is momentary and
     * is not an answer; the silence after one fails would be read as one, which is what the note is
     * for.
     */
    if (offer.because !== "read-failed") return null;
    return (
      <p className="continue-commitment__unreadable" role="status">
        {UNREADABLE_NOTE}
      </p>
    );
  }
  const { commitment } = offer;
  if (offer.kind === "stuck") {
    return (
      <section className="continue-commitment continue-commitment--stuck" dir="rtl">
        <p className="continue-commitment__headline">{STUCK_HEADLINE}</p>
        {/*
          * GHOST WEIGHT, DELIBERATELY. Closing a registered test is not the act the product wants
          * and must not be dressed as one; it is the way out of a state the player did not cause.
          */}
        <button
          type="button"
          className="ghost-control"
          onClick={() => onClose(commitment.run.runId)}
        >
          {STUCK_CTA}
        </button>
      </section>
    );
  }
  return (
    <section className="continue-commitment" dir="rtl">
      <p className="continue-commitment__headline">{CONTINUE_HEADLINE[commitment.kind]}</p>
      <p className="continue-commitment__progress">
        {continueProgress(commitment.run.done, commitment.run.total)}
      </p>
      <button
        type="button"
        className={className}
        {...primaryAction("continue-run")}
        onClick={() => onResume({ kind: commitment.kind, id: commitment.run.resumeWith })}
      >
        {CONTINUE_CTA}
      </button>
    </section>
  );
}
