/**
 * The reads a player can state by tapping instead of typing.
 *
 * The commitment screen demanded two free-text fields before any move could be recorded. That is
 * roughly forty sentences per game, and it is why a game does not get finished: "the move is
 * blocked, it asks me to fill in forms" was the report, and it is accurate.
 *
 * What the requirement is actually FOR is the ordering: the player states their read before the
 * engine speaks (R3). Nothing measures the words. The detector buckets on time, phase and clock
 * and scores confidence against centipawn loss -- `shared/detector.ts` never reads `known` or
 * `unknown` at all -- so making the read selectable weakens no gate, no claim and no
 * measurement. It only changes what the player has to type.
 *
 * Three rules this list follows:
 *
 * - Nothing is preselected. A default here would be the machine putting a read in the player's
 *   mouth and then measuring them against it.
 * - Free text stays, alongside. A menu bounds what can be said, and the position the player is
 *   looking at may not be in it.
 * - The options are POSITIONAL FEATURES, not evaluations. "המרכז סגור" is something a player
 *   reads off the board; "העמדה שלי טובה יותר" is a verdict, which is the engine's job after the
 *   commit and not the player's before it.
 *
 * KNOWN LIMIT, recorded rather than hidden: the atom stores `known` and `unknown` as plain
 * strings, so a selected option and the same words typed by hand are indistinguishable in the
 * record. Judged acceptable -- a selection is an assertion the player made, and no measurement
 * reads the text -- but it is a real limit and it is written down in docs/FINDINGS.md.
 */

export interface ReadOption {
  /** Stable id. Not stored -- the label is what goes on the record, in the player's language. */
  id: string;
  label: string;
}

/** What the player can read off this position. Positional features only. */
export const KNOWN_OPTIONS: ReadOption[] = [
  { id: "center-closed", label: "המרכז סגור" },
  { id: "center-open", label: "המרכז פתוח" },
  { id: "space", label: "יש לי יתרון מרחב" },
  { id: "development", label: "פער בפיתוח" },
  { id: "king-exposed", label: "מלך חשוף" },
  { id: "open-file", label: "עמודה או אלכסון פתוחים" },
  { id: "pawn-structure", label: "מבנה הרגלים קובע כאן" },
  { id: "material", label: "יחס החומר קובע כאן" },
  { id: "initiative", label: "היוזמה קובעת כאן" },
  { id: "weak-square", label: "יש נקודה חלשה לתפוס" },
];

/** What the player cannot evaluate here. The point of the field is that it is allowed to be a lot. */
export const UNKNOWN_OPTIONS: ReadOption[] = [
  { id: "depth", label: "לא רואה את הווריאציה עד הסוף" },
  { id: "reply", label: "לא יודע איך הוא יענה" },
  { id: "sacrifice", label: "לא יודע אם הקורבן עובד" },
  { id: "tempo", label: "לא יודע אם זה מהיר מספיק" },
  { id: "theory", label: "לא מכיר את העמדה הזו" },
  { id: "endgame", label: "לא בטוח בהערכת הסיום" },
  { id: "defence", label: "לא יודע אם ההגנה מחזיקה" },
  { id: "plan", label: "לא יודע מה התוכנית הנכונה" },
];

/**
 * One field's statement, from what was tapped and what was typed.
 *
 * Both go on the record together: a player who selects two options AND adds a sentence stated
 * all three things. Capped at the atom's 200 characters, which the schema enforces anyway --
 * truncating here rather than letting the write fail keeps a long selection from becoming an
 * error the player cannot act on.
 */
export function composeStatement(labels: string[], freeText: string): string {
  const typed = freeText.trim();
  const parts = [...labels, ...(typed ? [typed] : [])];
  return parts.join(" · ").slice(0, 200);
}
