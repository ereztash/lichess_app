/**
 * One error, of the shape the repository's own types are built around.
 *
 * `LearningRuleGrade` is a closed union, and the whole learning fold turns on it being closed: a
 * grade outside it would render as a word no screen has a wording for. This assigns one anyway.
 * `npm run check:control` requires the compiler to say so.
 */
type LearningRuleGrade = "hypothesis" | "replicated" | "refuted" | "retired";

export const grade: LearningRuleGrade = "mostly-replicated";
