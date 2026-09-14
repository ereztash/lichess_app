/**
 * THE CANONICAL NEXT ACT, IN THE VOICE OF SOMEBODY WHO HAS JUST FINISHED A GAME.
 *
 * WHAT THIS REPLACED, and it is the plainest example of a surface overruling the architecture.
 * `postGameWords().action` returned "שחק עוד משחק" unconditionally whenever the game produced no
 * finding. Not "unless something outranks it" -- unconditionally. A player with a drill four
 * positions in, or a rule they wrote and never tested, finished a quiet game and was told the next
 * thing to do was play another one. The engine had no opinion because it was never asked.
 *
 * THE DIFFERENCE FROM `presentOnResume` IS THE MOMENT, NOT THE POLICY. Both call the same ladder and
 * both receive the same action for the same record. What differs is that this reader has a game
 * fresh in mind, so the sentence connects the act to the game they just played rather than to the
 * time they were away. `docs/ARCHITECTURE_UI_STATE_MAP.md` shows the two sentences side by side for
 * the same action, which is the readable proof that presentation stayed local.
 *
 * WHAT DID NOT MOVE HERE. The post-game CARD -- headline, facts, evidence authority, the "this is
 * one event, not a pattern" note -- is a reading of the game just played and stays in
 * `blitz-words.ts`. That is description, and description was never the thing in dispute.
 */
import { actFor, type NextAction } from "./next-action.js";
import type { SurfaceOffer } from "./surface-offer.js";

export function presentOnPostGame(action: NextAction): SurfaceOffer | null {
  const act = actFor(action.kind);
  if (act === null) return null;
  switch (action.kind) {
    case "continue-drill":
      return {
        act,
        label: "חזרה לסט שהתחלתם",
        because: `יש סט פתוח, ${action.done} מתוך ${action.total} עמדות. הוא נרשם מראש, ולכן חצי ממנו לא בודק כלום.`,
      };
    case "continue-transfer":
      return {
        act,
        label: "חזרה לסט שהתחלתם",
        because: `התחלתם לבדוק כלל שכתבתם, ${action.done} מתוך ${action.total} עמדות. חצי בדיקה אינה בדיקה.`,
      };
    case "test-hypothesis":
      return {
        act,
        label: "בדקו את הכלל שכתבתם",
        because: "הכלל שכתבתם עדיין לא נבדק על עמדות חדשות. זה מה שמפריד בין כלל לבין תחושה.",
      };
    case "test-claim":
      return {
        act,
        label: "בדקו את מה שנמצא",
        because: "יש הפרדה שההיסטוריה מצאה ושום בדיקה קדימה עוד לא הכריעה.",
      };
    case "review-event":
      /* Unreachable today; present anyway. See the same note in `resume-presentation.ts`. */
      return { act, label: "ראו את העמדה", because: "נרשם כאן משהו שלא נקרא." };
    case "play-first-decision":
      return {
        act,
        label: "קחו החלטה אחת",
        because: "בלי ביטחון שנאמר לפני המנוע אין מה להשוות, וזה מה שהלולאה הזאת מודדת.",
      };
    case "collect-more-evidence":
      return {
        act,
        label: "המשיכו בסט המשותף",
        because: `${action.anchorAnswered} מתוך ${action.anchorTotal} עמדות. הסט המשותף הוא מה שמאפשר להשוות בין אנשים.`,
      };
    case "play-blitz":
      return {
        act,
        label: "משחק חדש",
        because: "עוד משחק מוסיף החלטות חדשות, וזה מה שמאפשר לבדוק אם משהו חוזר.",
      };
    case "return-record":
      return {
        act,
        label: "להיסטוריה",
        because: "אין בדיקה פתוחה. מה שנמדד נמצא בהיסטוריה.",
      };
    default:
      return null;
  }
}
