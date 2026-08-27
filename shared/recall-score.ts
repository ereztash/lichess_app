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
 * Function words and generic connectives that survive the length floor.
 *
 * THE FILE USED TO CLAIM "both languages spend their short tokens on function words". That is
 * false above two letters in Hebrew, and an adversarial review turned it into an attack: ONE fixed
 * sentence, typed with no knowledge of any rule --
 *
 *   "לפני שאני בוחר צריך לבדוק תמיד את כל האפשרויות ולחשוב יותר על המהלך הבא"
 *
 * -- cleared the floor on SIX of eight realistic learning rules. `לפני` `צריך` `תמיד` `יותר`
 * `לחשוב` `האפשרויות` are all four letters or more and all carry no content.
 *
 * WHAT THIS LIST IS AND IS NOT. Removing function words from a content-word count is principled:
 * they are not content, in either language. Measured on the same eight rules it takes the attack
 * from 6/8 to **2/8** while verbatim recall stays 8/8.
 *
 * It does NOT take it to zero, and it is not extended until it does. The two that still pass share
 * genuine vocabulary with the attack sentence -- `לבדוק`, `מהלך` -- and adding those would be
 * fitting a parameter to eight examples, which is the thing this file's own comments warn against.
 * The measure cannot be made sound by tuning. What follows from that is structural and lives
 * elsewhere: a score like this must never be able to REFUTE a rule on its own.
 */
const STOP_WORDS = new Set([
  "לפני", "אחרי", "כאשר", "כשיש", "צריך", "תמיד", "יותר", "פחות", "האפשרויות", "אפשרויות",
  "לחשוב", "חושב", "הבא", "הזה", "הזאת", "שאני", "אני", "אתה", "שלי", "שלו", "שלהם", "זה", "זאת",
  "כדי", "כמו", "אבל", "ולא", "גם", "רק", "עוד", "כבר", "להיות", "יכול", "אפשר", "באמת", "ממש",
  "הראשונה", "הראשון", "משהו", "דברים", "בכל", "לכל", "מכל", "ואז", "ואם", "אם", "את", "כל", "על",
  "של", "עם", "לי", "לו", "יש", "לא", "מה", "מי", "כן",
  "the", "and", "for", "before", "after", "when", "should", "always", "more", "less", "this",
  "that", "with", "from", "every", "all", "any", "not", "but", "must", "need", "needs", "have",
]);

/**
 * The fewest of the rule's own content words a recall must reproduce, in absolute terms.
 *
 * A RATIO ALONE IS NOT ENOUGH ON A SHORT RULE. "לספור שחים" has two content words, so one match
 * scored 0.50 and cleared a 0.34 floor -- and a rule repeating one word ("שחים שחים שחים")
 * de-duplicates to a single content word, where any token containing it scored 1.00. Both were
 * found by review, and neither is exotic: a short rule is a well-written rule.
 */
const MIN_MATCHED_WORDS = 2;

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
 * The Hebrew writing system, normalised before anything tries to read it.
 *
 * WHAT WENT WRONG WITHOUT THIS, measured against the tokeniser below rather than reasoned about:
 *
 *   "מהלכים".includes("מהלך")   ->  false      a final kaf is U+05DA, a medial kaf is U+05DB
 *   "שָׁחִים"                       ->  []         the points are not \p{L}, so the word shatters
 *   "ג׳ירף"                      ->  ["ירף"]    the geresh cut the word and the first letter went
 *   "צה״ל"                       ->  []         and an acronym vanished entirely
 *
 * THE SOFIT FOLD IS THE ONE THAT MATTERS MOST, because Hebrew inflects on the FINAL letter --
 * singular to plural, absolute to construct, with and without a possessive suffix. The containment
 * rule below was written expressly so a player is not charged for grammar, and without this it
 * still charged them for grammar in the commoner direction.
 *
 * THE POINTS MATTER FOR A DIFFERENT REASON. Without this, the same sentence typed by the same
 * person scored differently according to whether their keyboard emitted niqqud. A floor that moves
 * with the input method is not measuring memory.
 *
 * THE GERESH AND GERSHAYIM ARE LETTERS' CLOTHING, NOT PUNCTUATION. U+05F3 writes foreign sounds
 * (צ׳ is "ch", ג׳ is "j") and U+05F4 marks an acronym. Both sit INSIDE a word.
 *
 * THE MAQAF IS DELIBERATELY ABSENT FROM THIS LIST. U+05BE is Hebrew's hyphen: it JOINS two words
 * and splitting on it is correct. It was reported as a fourth defect on the strength of
 * "אל־תשכח" -> ["תשכח"]; that is `MIN_TOKEN_LENGTH` dropping a two-letter word, which is a
 * judgement this file already states. "בדיקה־כפולה" -> ["בדיקה","כפולה"] and always did.
 *
 * SCOPED TO THE HEBREW BLOCK, AND THAT IS LOAD-BEARING. A general `\p{M}` strip would fold Latin
 * diacritics too, and `resume` and `résumé` are different words. This touches U+0591-U+05C7 and
 * the two Hebrew marks, and nothing else.
 *
 * WHAT THIS IS NOT: morphology. It does not stem, it does not strip prefixes (containment already
 * handles those, for the reasons argued below), and it invents no dictionary.
 */
const SOFIT: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

function normaliseHebrew(text: string): string {
  return text
    // Points and cantillation. Not \p{M}: that would reach Latin.
    .replace(/[\u0591-\u05C7]/g, "")
    // Geresh and gershayim -- inside a word, never ending one.
    .replace(/[\u05F3\u05F4]/g, "")
    .replace(/[ךםןףץ]/g, (letter) => SOFIT[letter]);
}

/**
 * Content words, lowercased and stripped of punctuation.
 *
 * `\p{L}` and `\p{N}` rather than `\w`, because `\w` is ASCII-only and would reduce every Hebrew
 * rule in the record to zero tokens -- scoring the entire Hebrew-speaking user base at 0 while the
 * tests, if written in English, all passed.
 */
/**
 * The stop list, in the SAME NORMALISED SPACE as the tokens it filters.
 *
 * THIS LINE IS HERE BECAUSE ITS ABSENCE WAS A REGRESSION, and an existing test caught it rather
 * than review. Nine entries in `STOP_WORDS` end in a sofit letter -- צריך, שלהם, גם, הראשון,
 * דברים, ואם, אם, עם, כן. Folding the INPUT without folding the LIST meant none of them matched
 * any more, so the stop words silently stopped being removed. Token counts went UP, which a fold
 * can never do, and the adversarial generic sentence in tests/shared/recall-score.test.ts went
 * from beating two of eight rules to beating three.
 *
 * The general shape: a normalisation applied to one side of a comparison and not the other is not
 * a normalisation, it is a mismatch.
 */
const NORMALISED_STOP_WORDS = new Set([...STOP_WORDS].map(normaliseHebrew));

function contentWords(text: string): string[] {
  return [
    ...new Set(
      normaliseHebrew(text)
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length >= MIN_TOKEN_LENGTH && !NORMALISED_STOP_WORDS.has(token)),
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
  return {
    matched,
    total,
    coverage,
    // BOTH conditions. The ratio catches a long recall that shares little; the absolute count
    // catches a short rule where one lucky word is already half of it.
    clearedFloor: matched >= MIN_MATCHED_WORDS && coverage >= RECALL_COVERAGE_FLOOR,
  };
}

/**
 * Whether a rule can be scored by this measure at all.
 *
 * A RULE THAT CANNOT BE SCORED MUST NEVER BE TESTED, because the test it gets is unwinnable and
 * the product's response to losing it was to mark the rule refuted forever. `action_rule = "f7 f2"`
 * is a perfectly ordinary way to write a chess rule and has no token this measure can see: perfect
 * verbatim recall on all three positions, zero centipawns lost, scored 0/3, `refuted`,
 * `next_due_at: null`, and the message blamed the retrieval schedule. Found by review.
 *
 * Checked before a transfer is preregistered, so the unwinnable test is never created.
 */
export function isScoreable(authoredRule: string): boolean {
  return contentWords(authoredRule).length >= MIN_MATCHED_WORDS;
}
