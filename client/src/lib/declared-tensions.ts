/**
 * Tensions between the things the player just said, before the engine says anything.
 *
 * The reveal layer already reports the calibration gap -- stated confidence against realised
 * centipawn loss -- but only AFTER the engine has spoken, which is one position too late to
 * change the decision that produced it. Everything here is derived from the draft alone: the
 * options tapped and the confidence chosen. No engine, no network, no record. That is what lets
 * it render on the commitment screen without touching R3 -- there is nothing here the engine
 * could have contributed.
 *
 * Four rules it follows, and the whole design is in them:
 *
 * - It asks, it does not rule. "על מה מבוסס הביטחון כאן?" is a question the player can answer
 *   with "on this, and I am keeping the move". A verdict from a layer with no access to the
 *   position would be exactly the manufactured certainty the reveal layer refuses to produce.
 * - It never blocks. These are not `draftProblems`: a decision that states a tension is still a
 *   complete decision, and the record wants it recorded rather than tidied up first.
 * - It is display-only. Nothing here is written to the atom, and `shared/detector.ts` never
 *   reads `known` or `unknown` at all, so no bucket, claim or gate can move because of it.
 * - One at a time. Three of these can be true at once; showing all three is the dashboard the
 *   product exists to not be. The list is ordered, and the screen renders the head of it.
 */
import type { DraftDecision } from "./decision-session";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS } from "./read-options";

export interface DeclaredTension {
  id: string;
  /** Always a question. Never a finding. */
  question: string;
  /** Which of the player's own selections produced it. Rendered with it, never without. */
  basis: string;
}

/** Confidence at or above this is a claim strong enough to be worth asking about. */
export const HIGH_CONFIDENCE = 4;
/** The top of the scale -- "ודאי". Held to a stricter standard than 4. */
export const CERTAIN = 5;
/** This many open questions alongside a stated certainty is worth one question back. */
export const MANY_UNKNOWNS = 3;
/** Under this many seconds, a top-of-scale confidence was not deliberated over. */
export const FAST_DECISION_SECONDS = 10;

/**
 * Reads that cannot both describe one position. Ids rather than labels so the wording stays a
 * property of read-options.ts; `tests/client/declared-tensions.test.ts` asserts they resolve.
 */
const EXCLUSIVE_KNOWN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["center-closed", "center-open"],
];

const labelOf = (options: typeof KNOWN_OPTIONS, id: string): string | undefined =>
  options.find((option) => option.id === id)?.label;

/** True when the player tapped the option with this id. Inert if the id no longer exists. */
function selected(tags: string[], options: typeof KNOWN_OPTIONS, id: string): boolean {
  const label = labelOf(options, id);
  return label !== undefined && tags.includes(label);
}

/**
 * Every tension this draft states, most specific first. Empty is the normal case and is not a
 * state the interface has to fill.
 *
 * `secondsElapsed` is the time the position has been on screen, which the commitment screen is
 * already counting for the record. It is passed in rather than read from a clock here so the
 * function stays pure.
 */
export function declaredTensions(draft: DraftDecision, secondsElapsed: number): DeclaredTension[] {
  const tensions: DeclaredTension[] = [];
  const confidence = draft.confidence;
  const unknownCount = draft.unknownTags.length;

  // 1. Two readings of the same feature, both tapped. This one needs no confidence to be a
  //    contradiction -- it is one on its own terms.
  for (const [firstId, secondId] of EXCLUSIVE_KNOWN_PAIRS) {
    const first = labelOf(KNOWN_OPTIONS, firstId);
    const second = labelOf(KNOWN_OPTIONS, secondId);
    if (!first || !second) continue;
    if (draft.knownTags.includes(first) && draft.knownTags.includes(second)) {
      tensions.push({
        id: `exclusive-read:${firstId}:${secondId}`,
        question: `סימנת גם "${first}" וגם "${second}". איזו מהשתיים מתארת את העמדה שלפניך?`,
        basis: "שתי קריאות שאינן יכולות לתאר יחד את אותה עמדה",
      });
    }
  }

  if (confidence === null) return tensions;

  // 2. Top of the scale, quickly, with something still open. A fast confident recapture is a
  //    real thing, which is why the check also wants a stated unknown before it says anything.
  if (confidence === CERTAIN && secondsElapsed < FAST_DECISION_SECONDS && unknownCount > 0) {
    tensions.push({
      id: "fast-certainty",
      question: `אמרת ביטחון ${CERTAIN} מתוך 5 אחרי ${Math.floor(secondsElapsed)} שניות, ולצידו ${unknownCount === 1 ? "דבר אחד שאי אפשר להעריך" : `${unknownCount} דברים שאי אפשר להעריך`}. זו ההחלטה שאתה מתכוון לרשום?`,
      basis: `ביטחון ${CERTAIN}/5 · ${Math.floor(secondsElapsed)} שניות · ${unknownCount} סימוני "לא יודע"`,
    });
  }

  // 3. Certainty alongside not knowing the position at all.
  const theory = labelOf(UNKNOWN_OPTIONS, "theory");
  if (
    confidence >= HIGH_CONFIDENCE &&
    theory &&
    selected(draft.unknownTags, UNKNOWN_OPTIONS, "theory")
  ) {
    tensions.push({
      id: "certainty-without-familiarity",
      question: `סימנת "${theory}", ולצידה ביטחון ${confidence} מתוך 5. על מה מבוסס הביטחון כאן — על העמדה, או על המהלך?`,
      basis: `ביטחון ${confidence}/5 מול "${theory}"`,
    });
  }

  // 4. Certainty in a move alongside not knowing what the position is for.
  const plan = labelOf(UNKNOWN_OPTIONS, "plan");
  if (
    confidence >= HIGH_CONFIDENCE &&
    plan &&
    selected(draft.unknownTags, UNKNOWN_OPTIONS, "plan")
  ) {
    tensions.push({
      id: "certainty-without-plan",
      question: `סימנת "${plan}", ולצידה ביטחון ${confidence} מתוך 5. הביטחון הוא במהלך הזה, או בכך שהוא לא מזיק?`,
      basis: `ביטחון ${confidence}/5 מול "${plan}"`,
    });
  }

  // 5. The count-based one, last: it is the least specific, and it fires for drafts the three
  //    above already described better.
  if (confidence === CERTAIN && unknownCount >= MANY_UNKNOWNS) {
    tensions.push({
      id: "certainty-with-open-questions",
      question: `סימנת ${unknownCount} דברים שאי אפשר להעריך כאן, ולצידם ביטחון ${CERTAIN} מתוך 5. מי מהם היה משנה את המהלך, אילו ידעת אותו?`,
      basis: `ביטחון ${CERTAIN}/5 מול ${unknownCount} סימוני "לא יודע"`,
    });
  }

  return tensions;
}

/** The one to show. Null is the normal case. */
export function foremostTension(
  draft: DraftDecision,
  secondsElapsed: number,
): DeclaredTension | null {
  return declaredTensions(draft, secondsElapsed)[0] ?? null;
}
