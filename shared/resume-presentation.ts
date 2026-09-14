/**
 * THE CANONICAL NEXT ACT, IN THE RETURNING PLAYER'S VOICE.
 *
 * WHAT THIS REPLACED. `resume-reading.ts` used to answer two questions at once: what does the record
 * say (`changed`, `knows`) and what should the player do (`next`). The second was a lookup table of
 * two kinds -- `play` and `wait` -- keyed on `BlitzBlocker`, which meant the front door could not
 * express a drill in progress, a transfer in progress, a rule nobody has tested, or a claim awaiting
 * its forward test. A player four positions into an eight-position set was offered "play another
 * game", because "play another game" was one of only two things this screen could say.
 *
 * THE DESCRIPTION LAYER STAYED AND THE POLICY LAYER LEFT. `readResume` still answers what the record
 * says; it no longer answers what to do. That split is the whole point -- the mission's own words,
 * *"the state-description layer and next-action layer must remain distinct"* -- and it is why this
 * is a new module rather than an edit to that one.
 *
 * THE VOICE IS THE RETURNING PLAYER'S, and it differs from the post-game's on purpose. Somebody
 * arriving at the front door after a day away is being told what is waiting; somebody who has just
 * finished a game is being told what this game changed. Same act, two sentences, no disagreement.
 */
import { actFor, type NextAction } from "./next-action.js";
import type { SurfaceOffer } from "./surface-offer.js";

/**
 * Present the canonical action on the returning front door.
 *
 * `null` FOR `wait-analysis` AND `none`, and both have the same reason: there is nothing to press.
 * The engine still running is a sentence, not a button -- P1.5 argued that and `readResume`'s
 * `wait` branch already renders it. A record with nothing outstanding is likewise a state, not an
 * invitation. Returning `null` here leaves those to the description layer, which is where they
 * belong.
 */
export function presentOnResume(action: NextAction): SurfaceOffer | null {
  const act = actFor(action.kind);
  if (act === null) return null;
  switch (action.kind) {
    case "continue-drill":
      return {
        act,
        label: "חזרה לסט",
        because: `התחלתם לבדוק את זה ועניתם על ${action.done} מתוך ${action.total} עמדות. סט חלקי לא בודק כלום.`,
      };
    case "continue-transfer":
      return {
        act,
        label: "חזרה לסט",
        because: `התחלתם לבדוק את הכלל שכתבתם, ${action.done} מתוך ${action.total} עמדות. סט חלקי לא בודק כלום.`,
      };
    case "test-hypothesis":
      return {
        act,
        label: "בדקו את הכלל שכתבתם",
        because: "כתבתם כלל ואף פעם לא נבדק קדימה. בדיקה שיכולה לחזור שלילית היא מה שהופכת אותו לידע.",
      };
    case "test-claim":
      return {
        act,
        label: "בדקו את מה שנמצא",
        because: "ההיסטוריה הפרידה משהו, ואף בדיקה קדימה עוד לא הכריעה אם זה חוזר.",
      };
    case "review-event":
      /*
       * UNREACHABLE TODAY AND PRESENTED ANYWAY. Nothing in this product writes a seen-set, so
       * `review-event` cannot fire -- `shared/next-action.ts` marks the input `UNIMPLEMENTED` and
       * says so. The presenter exists because `GATE-CANONICAL-ACTION-REACHABLE` asks whether every
       * kind HAS a renderer, and a kind that becomes reachable later must not find the surfaces
       * silent. It costs one branch and it is the honest place to pay it.
       */
      return {
        act,
        label: "ראו את העמדה",
        because: "יש כאן משהו שנרשם ולא נקרא.",
      };
    case "play-first-decision":
      return {
        act,
        label: "קחו החלטה אחת",
        because: "החלטה אחת עם ביטחון שנאמר מראש היא המינימום שאפשר למדוד ממנו משהו.",
      };
    case "collect-more-evidence":
      return {
        act,
        label: "המשיכו בסט המשותף",
        because: `עניתם על ${action.anchorAnswered} מתוך ${action.anchorTotal} עמדות הסט. השוואה בין אנשים צריכה את אותן עמדות.`,
      };
    case "play-blitz":
      return {
        act,
        label: "שחקו משחק קצר",
        because: "עוד החלטות מדודות הן מה שמאפשר את הבדיקה הראשונה.",
      };
    case "return-record":
      return {
        act,
        label: "להיסטוריה",
        because: "אין כרגע בדיקה פתוחה. מה שנמדד נמצא בהיסטוריה.",
      };
    default:
      return null;
  }
}
