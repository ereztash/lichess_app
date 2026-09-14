/**
 * WHETHER A SET THIS PLAYER STARTED OUTRANKS WHATEVER A SCREEN WAS ABOUT TO OFFER.
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
 * IT IS POLICY AND NOT PRESENTATION, WHICH IS WHY IT IS HERE AND NOT IN THE COMPONENT. Three
 * surfaces render this act, each in its own frame -- a bare button on the front door, a card action
 * on the resume screen, the slot under the post-game summary -- and what must be identical across
 * the three is WHICH act they offer and WHEN they stand their own primary down. Those are one
 * function's answer, in a file with no JSX in it, so a gate can ask it directly rather than
 * rendering three screens to find out.
 *
 * THE RANKING IS STILL NOT HERE. `proposeContinuation` is `deriveNextAction`'s branch order asked
 * with everything else honestly unread. This file decides nothing about priority.
 *
 * THE COPY CARRIES NO ARCHITECTURE. Nothing here says "continuation", "canonical", "branch" or
 * "preregistered evidence set". What a player is told is that they started testing something and
 * there is a set to finish, with the two numbers that make that concrete.
 */
import { observed, proposeContinuation, UNOBSERVED, type Observed } from "./next-action.js";
import type {
  CommitmentRun,
  ContinuationReading,
  LiveLearningCommitment,
  UnknownBecause,
} from "./continuation.js";

/**
 * What the record says the player should carry on with, or why nothing is being offered.
 *
 * FIVE RETURNS FOR FIVE STATES, and the two that look like "nothing" are kept apart. `silent` is a
 * surface that has read the record and found no open set; `unreadable` is one whose read failed and
 * which must therefore NOT be taken as evidence that nothing is open. A surface that rendered both
 * as an empty fragment would be answering "you have nothing waiting" on the authority of a request
 * that never came back.
 */
export type ContinuationOffer =
  | { kind: "silent" }
  /**
   * `because` DECIDES WHETHER ANYTHING IS DRAWN, and the distinction was found in a browser rather
   * than reasoned about. A surface that rendered a note for BOTH cases showed "we could not read
   * your record" on every cold arrival for the few hundred milliseconds before the reading came
   * back, then removed it -- a sentence that was not true, and a 0.10 layout shift on the entry
   * route against a 0.02 budget, on the topmost element of the front door.
   *
   * A READ IN FLIGHT SAYS NOTHING. A read that FAILED says so, because the silence would otherwise
   * be indistinguishable from an answer.
   */
  | { kind: "unreadable"; because: UnknownBecause }
  | { kind: "resume"; commitment: Extract<LiveLearningCommitment, { state: "active" }> }
  | { kind: "stuck"; commitment: Extract<LiveLearningCommitment, { state: "active" }> };

/**
 * Ask the ladder, then ask whether the winning run can actually be reopened.
 *
 * TWO QUESTIONS IN THIS ORDER AND NOT THE OTHER. Restorability is a property of one run, so it
 * cannot be consulted before the order has said which run is being talked about; and it must be
 * consulted before a control is drawn, because a primary control the press cannot honour is worse
 * than no control -- it spends the player's attention on an act that fails.
 */
export function continuationOffer(reading: ContinuationReading): ContinuationOffer {
  const proposal = proposeContinuation({
    drill: slot(reading.drill, (run) => ({
      drillId: run.runId,
      done: run.done,
      total: run.total,
    })),
    transfer: slot(reading.transfer, (run) => ({
      transferId: run.runId,
      done: run.done,
      total: run.total,
    })),
  });
  /*
   * THE LADDER'S OWN BLINDNESS REPORT, NARROWED TO THE TWO INPUTS THIS QUESTION IS ABOUT.
   *
   * `soundProposal` WAS TRIED FIRST AND IS THE WRONG PREDICATE HERE, and a test caught it. It asks
   * whether a proposal may be acted on AS THE NEXT ACTION, and `proposeContinuation` deliberately
   * leaves every input below branch 2 unread -- so a record with nothing open comes back unsound
   * for reasons that have nothing to do with the runs. Every surface would then have rendered "we
   * could not read your record" to every player who simply had no set open.
   *
   * `blind` IS THE PREFIX OF `BLINDABLE_INPUTS` THAT WENT UNREAD ABOVE THE BRANCH THAT FIRED, and
   * `drill` and `transfer` are its first two entries -- so their presence in it means exactly what
   * this control needs to know: one of the two things that could be open was not read. Their
   * ABSENCE covers both good cases, and covers the crossed one correctly: an unread drill beside an
   * open transfer leaves `drill` in `blind`, which is right, because the drill outranks it.
   */
  const unreadRun = proposal.blind.some((input) => input === "drill" || input === "transfer");
  if (unreadRun) {
    /* Whichever slot could not be read says why; the drill is asked first because it outranks. */
    const because =
      reading.drill.state === "unknown" ? reading.drill.because : "not-attempted";
    return { kind: "unreadable", because };
  }
  const commitment =
    proposal.action.kind === "continue-drill"
      ? reading.drill
      : proposal.action.kind === "continue-transfer"
        ? reading.transfer
        : null;
  if (commitment === null || commitment.state !== "active") {
    /*
     * READ, AND NOTHING IS OPEN. `none`, `completed` and `abandoned` all land here and all mean the
     * surface may go on offering whatever it was going to offer. They differ in what they are, and
     * `shared/continuation.ts` keeps them apart for readers who need the difference; what they do
     * not differ in is whether there is a set to finish.
     */
    return { kind: "silent" };
  }
  return commitment.restore.ok
    ? { kind: "resume", commitment }
    : { kind: "stuck", commitment };
}

/**
 * `unknown` is the only state that makes the proposal unsound. The other four are answers.
 *
 * THE SAME MAPPING `productStateFor` MAKES, and it is written twice on purpose rather than shared.
 * That one assembles a state for the SHADOW, which must not run unless every reading it needs has
 * settled; this one assembles two fields for a CONTROL, which must render the moment the two fields
 * it is about are known. Factoring them together would couple a visible control to the shadow's
 * gating, and the shadow waits on the blitz reading -- so a failed blitz request would hide a run
 * the record can see perfectly well.
 */
function slot<T>(
  commitment: LiveLearningCommitment,
  shape: (run: CommitmentRun) => T,
): Observed<T | null> {
  if (commitment.state === "unknown") return UNOBSERVED;
  return observed(commitment.state === "active" ? shape(commitment.run) : null);
}

/**
 * WHAT THE PLAYER IS TOLD, AND IT NAMES A SET OF POSITIONS RATHER THAN A MECHANISM.
 *
 * The two kinds get two sentences because they are two tests: a drill checks a pattern the record
 * found about the player, a transfer checks a rule the player wrote themselves. Somebody who wrote
 * a rule three days ago and is being asked to finish testing it should be told that is what this
 * is, not handed a generic "carry on".
 */
export const CONTINUE_HEADLINE: Record<"drill" | "transfer", string> = {
  drill: "התחלתם לבדוק את זה. סיימו את הסט שהתחלתם.",
  transfer: "התחלתם לבדוק את הכלל שכתבתם. סיימו את הסט שהתחלתם.",
};

/** The label on the control. It names where the press lands, not what the press is called. */
export const CONTINUE_CTA = "חזרה לסט";

/** The two numbers, which is the whole of why finishing matters. Positions, not percentages. */
export function continueProgress(done: number, total: number): string {
  return `עניתם על ${done} מתוך ${total} עמדות.`;
}

/**
 * A SET THAT IS OPEN AND CANNOT BE REOPENED FROM HERE, said rather than hidden.
 *
 * §16: never turn "a commitment exists but cannot be restored" into "start a new one". This is that
 * requirement as a sentence. The escape offered is to CLOSE it, which is the player's own decision
 * and is recorded as one -- not a redraw, which would be choosing fresh evidence over a claim whose
 * test was already registered.
 */
export const STUCK_HEADLINE =
  "יש סט שהתחלתם ואי אפשר לפתוח אותו מחדש מכאן, כי ההיסטוריה לא יכולה להגיד על אילו עמדות כבר עניתם.";
export const STUCK_CTA = "סגירת הסט";

/**
 * A READ THAT DID NOT COME BACK, SAID IN ONE LINE.
 *
 * IT IS NOT A PRIMARY CONTROL AND NOT AN ERROR DIALOG. What it protects against is the silence
 * being read as an answer: a player four positions into a set, whose request failed, would
 * otherwise see a screen offering them a new game and nothing else, and would reasonably conclude
 * that nothing was waiting. The record still holds the run. Only the request failed.
 */
export const UNREADABLE_NOTE = "לא הצלחנו לקרוא את ההיסטוריה, אז אם יש סט פתוח הוא לא מוצג כאן.";
