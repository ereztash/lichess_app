/**
 * ONE SCREEN, ONE QUESTION (§14), AS A TABLE RATHER THAN AS A RULE.
 *
 * THE PLAN STATES IT AS A LAW AND LAWS DRIFT. "If a screen answers four questions, it should be
 * split" is a thing everybody agrees with and nobody checks, and the way it fails is not that
 * somebody adds a fourth question deliberately -- it is that a panel grows a helpful extra section
 * over six commits and nobody ever reads the whole screen at once again.
 *
 * SO THE QUESTION IS DECLARED, AND THE SURFACE HAS TO CARRY IT. Each region below names the one
 * question it answers, and `tests/client/one-screen-one-question.test.tsx` asserts that the
 * component renders exactly that string as its accessible region label. The declaration and the
 * label cannot drift, because one of them IS the other.
 *
 * IT IS ALSO THE ACCESSIBLE NAME, WHICH IS NOT A COINCIDENCE. A screen reader announcing "what
 * happened in this game" as it enters the region is telling its user precisely what §14 wants every
 * user told, and the fact that the same string serves both is the strongest evidence that the rule
 * is about comprehension rather than about tidiness. A region whose label is a noun -- "record",
 * "dashboard", "analysis" -- names a container; a region whose label is a question names its job.
 *
 * WHAT IS NOT HERE. Controls, dialogs and the board are not surfaces in this sense: they do not
 * answer a question, they take an action or show a position. This table is for the places that make
 * a STATEMENT, which are the places §14 is about.
 *
 * THE RESUME SCREEN CARRIES THREE ANSWERS AND STILL HAS ONE QUESTION, and that is worth being
 * explicit about because it looks like the first exception. §28 asks a returning player to be able
 * to answer what changed, what is known, and what to do -- and the first two are there because the
 * third is unanswerable without them. Its question is §14's own: what should I do next.
 */
export const SCREEN_QUESTIONS = {
  /** §13, §28. The three answers on it exist to make this one answerable. */
  resume: "מה הדבר הבא שכדאי לי לעשות",
  /** §24. One game. Not a trait, not a trend. */
  postGame: "מה קרה במשחק הזה",
  /** §25's second section. The most common true statement this product can make. */
  unclear: "מה עדיין לא ברור",
  /** §25's third. Answered by what would END the test, not by naming the claim. */
  underTest: "מה נבדק עכשיו",
  /** §25's first, already shipped as `OutcomeSummary`. */
  outcome: "מה יצא מזה עד עכשיו",
} as const;

export type ScreenKey = keyof typeof SCREEN_QUESTIONS;

/**
 * Every declared question, for the gate.
 *
 * A QUESTION MUST BE A QUESTION, which the gate checks and which is not pedantry: "the record" and
 * "analysis" are the labels these regions had, and both name a container. A reader who cannot tell
 * what a region is FOR reads all of it or none of it, and on this product they read none of it.
 */
export const SCREEN_QUESTION_LIST: readonly string[] = Object.values(SCREEN_QUESTIONS);
