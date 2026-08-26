/**
 * How much of the authored rule a recall reproduced -- and what that number is not.
 *
 * WHAT THIS REPLACES. A position counted as a success when the recalled text was NON-EMPTY, the
 * player ticked "I applied it", and the engine put the move within 30 centipawns. A reviewer typed
 * `banana` and got 3/3 with a verdict of "the rule transferred". Two of those three criteria were
 * not measurements: a non-empty string and a tick.
 *
 * WHAT THE LITERATURE SAYS THE ALTERNATIVE IS. The retrieval-practice studies this feature is
 * modelled on score free recall against a PREDEFINED RUBRIC OF IDEA UNITS, by human raters, at the
 * level of gist rather than wording, and they report an inter-rater reliability coefficient --
 * Roediger & Karpicke (2006) split their passages into 30 idea units and reported r = .95 between
 * two raters. Automated scoring reaches human-comparable agreement (van Genugten & Schacter 2024,
 * r = .67-.89) ONLY where such a rubric and a human-scored validation set already exist. This
 * product has neither.
 *
 * SO THIS IS DELIBERATELY LESS THAN THAT, AND IS NAMED FOR WHAT IT IS. It measures the OVERLAP
 * between the words the player typed now and the words they themselves wrote when they authored
 * the rule. That is a lexical floor, not a memory measure.
 *
 * IT IS BIASED TOWARD FALSE NEGATIVES ON PURPOSE. A player who recalls the rule perfectly in their
 * own words scores low here and the check fails them. That is the wrong answer, and it is the
 * wrong answer in the SAFE direction: this product's failure mode must be claiming too little
 * about someone rather than too much. `banana` passing was the opposite error, and it is the one
 * that makes a verdict worthless.
 *
 * WHAT IT CANNOT DO, stated because the next reader will be tempted to trust it further:
 *   - It cannot tell a correct paraphrase from a wrong one, or from a wrong answer that happens to
 *     share vocabulary with the rule.
 *   - It has no reliability coefficient, because nothing has been double-scored by a human.
 *   - It is not evidence that the rule was USED. That needs positions selected for the trigger and
 *     control positions that do not instantiate it, neither of which exists yet.
 */

/**
 * The shortest token worth comparing.
 *
 * Hebrew carries prefixes as single letters (ו, ב, ל, ה, מ, ש, כ) and both languages spend their
 * short tokens on function words. Three characters is a crude line and is stated rather than
 * tuned: there is no validation set to tune it against, and a threshold fitted by eye to a handful
 * of examples would be a parameter wearing the costume of a measurement.
 */
const MIN_TOKEN_LENGTH = 3;

/**
 * The share of the rule's own content words a recall must reproduce.
 *
 * A FLOOR AGAINST UNRELATED TEXT, not a pass mark for memory. It exists so that `banana` scores
 * zero and a one-word echo of the rule does not clear it. Any specific value here is a judgement
 * call and this one is not backed by data -- which is exactly why it is a named constant with this
 * comment attached, rather than a number inline in a condition.
 */
export const RECALL_COVERAGE_FLOOR = 0.34;

export interface RecallScore {
  /** Distinct content words of the authored rule that appear in the recall. */
  matched: number;
  /** Distinct content words in the authored rule. */
  total: number;
  /** `matched / total`, or 0 when the rule has no content words to match. */
  coverage: number;
  /** Whether the recall cleared the floor. NOT "the player remembered the rule". */
  clearedFloor: boolean;
}

/**
 * Content words, lowercased and stripped of punctuation.
 *
 * `\p{L}` and `\p{N}` rather than `\w`, because `\w` is ASCII-only and would reduce every Hebrew
 * rule in the record to zero tokens -- scoring the entire Hebrew-speaking user base at 0 while the
 * tests, if written in English, all passed.
 */
function contentWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length >= MIN_TOKEN_LENGTH),
    ),
  ];
}

/**
 * The longest token that may be matched by CONTAINMENT rather than by equality.
 *
 * WHY CONTAINMENT AT ALL. Hebrew attaches its prepositions and conjunctions to the word with no
 * space -- "הכאות" and "והכאות" are one word to a reader and two tokens to a matcher. A player
 * whose rule says the first and whose recall says the second loses a point for a GRAMMATICAL
 * reason and it is charged to their MEMORY. Measured here: a genuine partial recall came out at
 * 3/9 instead of 4/9 and fell under the floor by one match.
 *
 * WHY NOT STRIP PREFIXES INSTEAD. That was written first and was worse. Stripping one leading
 * letter cannot tell a prefix from a root ("שחים" became "חים"), and it still missed the case it
 * existed for, because "והכאות" carries TWO prefixes. Containment needs no morphology: a token
 * that merely wears a prefix still contains the word.
 *
 * WHY A LENGTH FLOOR. Containment on short tokens matches inside unrelated words. Four characters
 * is the line, and like every constant in this file it is a stated judgement rather than a fitted
 * one -- there is no validation set to fit against, and a threshold tuned by eye on a handful of
 * examples would be a parameter dressed as a measurement.
 */
const MIN_CONTAINMENT_LENGTH = 4;

function isMatched(ruleWord: string, attempt: readonly string[]): boolean {
  return attempt.some(
    (word) =>
      word === ruleWord ||
      (ruleWord.length >= MIN_CONTAINMENT_LENGTH &&
        (word.includes(ruleWord) || ruleWord.includes(word))),
  );
}

export function scoreRecall(recalled: string, authoredRule: string): RecallScore {
  const target = contentWords(authoredRule);
  const attempt = contentWords(recalled);
  const total = target.length;
  if (total === 0) return { matched: 0, total: 0, coverage: 0, clearedFloor: false };
  const matched = target.filter((word) => isMatched(word, attempt)).length;
  const coverage = matched / total;
  return { matched, total, coverage, clearedFloor: coverage >= RECALL_COVERAGE_FLOOR };
}
