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
 * - It is display-only, AND it reads nothing the detector measures. Nothing here is written to
 *   the atom, and `shared/detector.ts` never reads `known` or `unknown` at all, so no bucket,
 *   claim or gate can move because of it. That guarantee used to be stated over the two read
 *   fields alone, and one rule slipped through the gap: `fast-certainty` fired only on a draft
 *   under ten seconds old, and `secondsTaken` IS a detector variable -- `fast-under-45s` is the
 *   bucket the product's worked example is written about. A question shown only to fast deciders
 *   is a treatment applied to one arm of the measurement the screen exists to take, its exposure
 *   was recorded nowhere, so it could not be stratified out of the analysis afterwards either.
 *   The rule is gone and the parameter with it: every input here is now something the player
 *   SAID. What it used to catch, the time-free rules still catch -- certainty against an unknown
 *   opening, against an unknown plan, or against three open questions -- at any speed. What is
 *   no longer asked is the case of a top-of-scale confidence beside one or two unknowns that are
 *   neither, which was only ever asked because it arrived quickly.
 * - One at a time. Three of these can be true at once; showing all three is the dashboard the
 *   product exists to not be. The list is ordered, and the screen renders the head of it.
 */
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import type { DraftDecision } from "./decision-session";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS } from "./read-options";

export interface DeclaredTension {
  id: string;
  /** Always a question. Never a finding. */
  question: string;
  /** Which of the player's own selections produced it. Rendered with it, never without. */
  basis: string;
}

/**
 * A claim strong enough to be worth asking about, in STATED PROBABILITY rather than in buttons.
 *
 * This was `HIGH_CONFIDENCE = 4`, written when the scale had five buttons, where 4 asserted 75%.
 * The scale now has seven and 4 is `EVEN_ODDS_LEVEL` -- 50%, the button that exists so a player
 * can decline to claim anything. Measured, with three unknowns tapped:
 *
 *     button 4 (שקול, asserts 50%) -> certainty-without-familiarity
 *         "סימנת "לא מכיר את העמדה הזו", ולצידה ביטחון 4 מתוך 5. על מה מבוסס הביטחון כאן"
 *
 * A player who had just said they were 50/50 was asked what their certainty rested on. 0.75
 * reproduces the original meaning exactly and does not move again when the scale does; it is the
 * same cut point `shared/reveal.ts` uses for the same reason.
 */
export const HIGH_CONFIDENCE_ASSERTION = 0.75;
/**
 * The top of the scale -- "ודאי". Held to a stricter standard, and compared with `===`.
 *
 * This was the literal `5`, whose doc comment already named it "ודאי". On the seven-level scale
 * button 5 is `סביר` and asserts 65%; `ודאי` is button 7. Because the comparison is `===`, the two
 * rules built on it fired at `סביר` and were SILENT at both `בטוח` and `ודאי` -- the rules written
 * for the top of the scale could not fire at the top of the scale. Derived from the scale now, so
 * it cannot drift from it again.
 */
export const CERTAIN = CONFIDENCE_LEVELS;
/**
 * The lowest BUTTON whose assertion clears `HIGH_CONFIDENCE_ASSERTION`.
 *
 * Derived from the scale, never written down. It exists so tests and fixtures can say "the lowest
 * confidence that counts as high" without planting an integer -- which is precisely how the old
 * `HIGH_CONFIDENCE = 4` survived the move from five buttons to seven while quietly coming to mean
 * even odds.
 */
export const HIGH_CONFIDENCE_LEVEL = (() => {
  for (let level = 1; level <= CONFIDENCE_LEVELS; level += 1) {
    if (normaliseConfidence(level, CONFIDENCE_LEVELS) >= HIGH_CONFIDENCE_ASSERTION) return level;
  }
  return CONFIDENCE_LEVELS;
})();
/** This many open questions alongside a stated certainty is worth one question back. */
export const MANY_UNKNOWNS = 3;

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
 * It takes no clock, and see the module note on why that is a rule rather than a simplification:
 * the one rule that read the time fired selectively on the population the detector measures.
 */
export function declaredTensions(draft: DraftDecision): DeclaredTension[] {
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
  /*
   * What the player ASSERTED, not which button they pressed. The commitment screen always states
   * on the current scale, so it is named here rather than threaded through -- but the comparison
   * is against a probability, so a scale change moves the buttons and not the meaning.
   */
  const asserted = normaliseConfidence(confidence, CONFIDENCE_LEVELS);

  // 2. Certainty alongside not knowing the position at all.
  const theory = labelOf(UNKNOWN_OPTIONS, "theory");
  if (
    asserted >= HIGH_CONFIDENCE_ASSERTION &&
    theory &&
    selected(draft.unknownTags, UNKNOWN_OPTIONS, "theory")
  ) {
    tensions.push({
      id: "certainty-without-familiarity",
      question: `סימנת "${theory}", ולצידה ביטחון ${confidence} מתוך ${CONFIDENCE_LEVELS}. על מה מבוסס הביטחון כאן — על העמדה, או על המהלך?`,
      basis: `ביטחון ${confidence}/${CONFIDENCE_LEVELS} מול "${theory}"`,
    });
  }

  // 3. Certainty in a move alongside not knowing what the position is for.
  const plan = labelOf(UNKNOWN_OPTIONS, "plan");
  if (
    asserted >= HIGH_CONFIDENCE_ASSERTION &&
    plan &&
    selected(draft.unknownTags, UNKNOWN_OPTIONS, "plan")
  ) {
    tensions.push({
      id: "certainty-without-plan",
      question: `סימנת "${plan}", ולצידה ביטחון ${confidence} מתוך ${CONFIDENCE_LEVELS}. הביטחון הוא במהלך הזה, או בכך שהוא לא מזיק?`,
      basis: `ביטחון ${confidence}/${CONFIDENCE_LEVELS} מול "${plan}"`,
    });
  }

  // 4. The count-based one, last: it is the least specific, and it fires for drafts the three
  //    above already described better.
  if (confidence === CERTAIN && unknownCount >= MANY_UNKNOWNS) {
    tensions.push({
      id: "certainty-with-open-questions",
      question: `סימנת ${unknownCount} דברים שאי אפשר להעריך כאן, ולצידם ביטחון ${CERTAIN} מתוך ${CONFIDENCE_LEVELS}. מי מהם היה משנה את המהלך, אילו ידעת אותו?`,
      basis: `ביטחון ${CERTAIN}/${CONFIDENCE_LEVELS} מול ${unknownCount} סימוני "לא יודע"`,
    });
  }

  return tensions;
}

/** The one to show. Null is the normal case. */
export function foremostTension(draft: DraftDecision): DeclaredTension | null {
  return declaredTensions(draft)[0] ?? null;
}
