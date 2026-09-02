/**
 * THE LANGUAGE THE INTERFACE IS IN, AND THE DIRECTION THAT FOLLOWS FROM IT.
 *
 * WHY THIS EXISTS. `client/index.html` carried `lang="he" dir="rtl"` as two literals, and every
 * layout rule that had to know which way the page runs either read `direction` at runtime or
 * guessed with a physical side. So the product's direction was a fact stated in one file, relied
 * on in fifty, and derivable from nothing.
 *
 * THAT COST SOMETHING REAL, and it is the defect this module was written for: on a right-to-left
 * page the surface a player WRITES INTO sat at the far left, last in reading order, because the
 * grid's first track is the right edge and the board was declared first. Nothing was wrong with
 * the grid. What was missing was a rule saying where a writing surface goes, which cannot be
 * written without a single answer to "which way does this interface run".
 *
 * WHAT THIS IS NOT. It is not an i18n layer and it does not translate anything. There are 931
 * Hebrew strings across 115 files in `client/src` and `shared`, and translating them is not a
 * formatting question: the copy IS the measurement stimulus. `shared/promise.ts` exists so that
 * one promise cannot become two, `docs/VALUE_CLARITY.md` asserts vocabulary on the Hebrew, and
 * `VALUE_CLARITY_FIELD_PROTOCOL` interviews in Hebrew. Two languages would be two populations and
 * would need a field arm each. That is a programme; this is the rule it would need first.
 *
 * SO WHAT IT BUYS TODAY: the direction is derived rather than repeated, every writing surface is
 * placed against the reading start rather than against a compass point, and the day a second
 * language is a decision somebody has made, the layout is already correct for it.
 */

/** The languages the interface could be in. One is declared; the other is here so the type is a union. */
export const INTERFACE_LANGUAGES = ["he", "en"] as const;
export type InterfaceLanguage = (typeof INTERFACE_LANGUAGES)[number];

export type TextDirection = "rtl" | "ltr";

/**
 * The direction each language runs in.
 *
 * A TABLE RATHER THAN A CONDITIONAL, for the reason `MODE_CONTRACT` is one: a rule that lives in
 * an `if` is a rule no test can read back.
 */
export const DIRECTION_OF: Readonly<Record<InterfaceLanguage, TextDirection>> = {
  he: "rtl",
  en: "ltr",
};

/**
 * The language this build's interface is written in.
 *
 * NOT A SETTING, and deliberately not a runtime toggle. A toggle with nothing to switch to is a
 * control that lies, and switching it would change the measurement stimulus rather than the
 * chrome. It is a constant so that the one place it would have to change is one place.
 */
export const INTERFACE_LANGUAGE: InterfaceLanguage = "he";

/** The direction this build runs in. */
export const INTERFACE_DIRECTION: TextDirection = DIRECTION_OF[INTERFACE_LANGUAGE];

/**
 * Whether a direction puts the reading start on the right.
 *
 * Used by nothing in the running app on purpose: CSS logical properties already do this, and a
 * component that branches on the direction is a component that will be wrong in the other one.
 * It exists so a TEST can say what it expects without repeating the table above.
 */
export const readingStartsOnTheRight = (direction: TextDirection): boolean => direction === "rtl";
