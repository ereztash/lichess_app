/**
 * What the recall check catches, and — as loudly — what it gets wrong.
 *
 * THE DEFECT IT REPLACES: a position counted as a success when the recalled text was NON-EMPTY.
 * A reviewer typed `banana` and got 3/3 with a verdict of "the rule transferred".
 *
 * THIS IS NOT THE FIX THE LITERATURE ASKS FOR. Retrieval-practice studies score free recall
 * against a predefined rubric of idea units, by human raters, at the level of gist, and report an
 * inter-rater coefficient (Roediger & Karpicke 2006 report r = .95 across two raters). Automated
 * scoring reaches human-comparable agreement only where such a rubric and a human-scored
 * validation set already exist. This product has neither, so this measures word overlap and says
 * so in its name.
 *
 * THE FALSE NEGATIVE IS ASSERTED, NOT HIDDEN. A perfect paraphrase in different words fails this
 * check. That is the wrong answer in the safe direction -- claiming too little about someone
 * rather than too much -- and a test that only demonstrated the successes would be advertising.
 */
import { describe, expect, it } from "vitest";
import { RECALL_COVERAGE_FLOOR, isScoreable, scoreRecall } from "../../shared/recall-score";

const RULE = "רשימת שחים, הכאות ואיומים ישירים לפני יצירת מועמדים שקטים";

describe("the check the banana got through", () => {
  it("scores text unrelated to the rule at zero", () => {
    const score = scoreRecall("banana", RULE);
    expect(score.matched).toBe(0);
    expect(score.coverage).toBe(0);
    expect(score.clearedFloor).toBe(false);
  });

  it("scores an empty recall at zero rather than treating it as absent", () => {
    // Empty recall is a FAILED RETRIEVAL and is recorded as one. Dropping it would remove the
    // most informative outcome the test can produce.
    expect(scoreRecall("", RULE).clearedFloor).toBe(false);
    expect(scoreRecall("   ", RULE).clearedFloor).toBe(false);
  });

  it("does not let a one-word echo of the rule clear the floor", () => {
    /*
     * The obvious way to game a lexical check. The denominator is the RULE's vocabulary, not the
     * recall's -- scoring against the recall's own words would give full marks to anyone who
     * typed a single word from the rule and stopped.
     */
    const score = scoreRecall("שחים", RULE);
    expect(score.matched).toBe(1);
    expect(score.clearedFloor).toBe(false);
  });

  it("passes a recall that reproduces the rule", () => {
    expect(scoreRecall(RULE, RULE).coverage).toBe(1);
    expect(scoreRecall(RULE, RULE).clearedFloor).toBe(true);
  });

  it("passes a partial recall that carries most of the rule's own terms", () => {
    const score = scoreRecall("קודם שחים והכאות ואיומים, אחר כך מועמדים", RULE);
    expect(score.coverage).toBeGreaterThanOrEqual(RECALL_COVERAGE_FLOOR);
    expect(score.clearedFloor).toBe(true);
  });
});

describe("what it gets wrong, on the record", () => {
  it("FAILS a correct recall written in the player's own words", () => {
    /*
     * THE HONEST LIMITATION. "Look for forcing moves before quiet ones" is the rule, correctly
     * remembered, in different vocabulary -- and this check marks it wrong.
     *
     * Kept as a passing assertion of the WRONG behaviour, because that is the difference between
     * a known limitation and an undiscovered bug. When a rubric and a reliability coefficient
     * exist, this test should go red and be rewritten. Until then it is what the product does,
     * and the product says so on screen.
     */
    const paraphrase = "לחפש מהלכים כופים לפני מהלכים רגילים";
    expect(scoreRecall(paraphrase, RULE).clearedFloor).toBe(false);
  });

  it("PASSES a wrong answer that happens to borrow the rule's vocabulary", () => {
    // The mirror failure. Word overlap cannot tell a correct recall from a fluent one, and this
    // sentence contradicts the rule while scoring well on it.
    const wrong = "לייצר קודם מועמדים שקטים ורק אחר כך שחים, הכאות ואיומים ישירים";
    expect(scoreRecall(wrong, RULE).clearedFloor).toBe(true);
  });
});

describe("containment is bounded, so a short word does not match inside an unrelated one", () => {
  it("does not match a short rule word inside a longer word that merely contains it", () => {
    /*
     * WHY CONTAINMENT EXISTS: Hebrew glues its prepositions and conjunctions on, so "הכאות" and
     * "והכאות" are one word to a reader and two tokens to a matcher. Containment handles that
     * without needing morphology.
     *
     * WHY IT IS BOUNDED: on short tokens it starts matching inside words with no relation. "אור"
     * (light) sits inside "מאורע" (event), and without the length floor a recall about events
     * would score a point against a rule about light. A positive control found this uncovered by
     * dropping the floor to 1 and watching nothing fail.
     */
    expect(scoreRecall("מאורע חריג בלוח", "אור חזק").matched).toBe(0);
  });

  it("still matches a long rule word carrying a prefix, which is the case it exists for", () => {
    // The control on the control. A floor set high enough to kill the false positive must not
    // also kill the true one.
    expect(scoreRecall("והכאות ואיומים", "הכאות ואיומים").matched).toBe(2);
  });
});

describe("it works in the language the record is written in", () => {
  it("counts Hebrew tokens, which an ASCII word class would score at zero", () => {
    /*
     * `\\w` is ASCII-only. A tokeniser built on it reduces every Hebrew rule in the record to zero
     * content words -- scoring the entire user base at 0 while an English-language test suite
     * passed. The character classes are Unicode-aware for that reason.
     */
    expect(scoreRecall(RULE, RULE).total).toBeGreaterThan(3);
  });

  it("ignores punctuation and case on both sides", () => {
    expect(scoreRecall("Checks, Captures — and THREATS!", "checks captures and threats").coverage).toBe(1);
  });

  it("reports nothing to match as nothing matched, rather than as success", () => {
    // A rule of only short function words has no content to score against. Returning `true` here
    // would make an unscoreable rule automatically pass.
    const score = scoreRecall("anything at all", "או גם כי");
    expect(score.total).toBe(0);
    expect(score.clearedFloor).toBe(false);
  });
});

describe("one generic sentence must not clear the floor on every rule", () => {
  /*
   * THE ATTACK, from an adversarial review. One fixed sentence, typed with no knowledge of any
   * rule, cleared the floor on SIX of eight realistic learning rules. The file had claimed "both
   * languages spend their short tokens on function words" -- false above two letters in Hebrew,
   * where `לפני` `צריך` `תמיד` `יותר` `לחשוב` all survived a 3-character floor as "content".
   *
   * Removing function words takes it to 2/8 while verbatim recall stays 8/8. It is NOT zero, and
   * the list is deliberately not extended until it is: the two that still pass share real
   * vocabulary with the attack, and adding those words would be fitting a parameter to eight
   * examples. What follows from that is structural and lives in `gradeLearningRule` -- a measure
   * with known false positives AND false negatives must not be able to close a question on its
   * own, and refuting a rule now needs failures on two separate days.
   */
  const GENERIC = "לפני שאני בוחר צריך לבדוק תמיד את כל האפשרויות ולחשוב יותר על המהלך הבא";
  const RULES = [
    "לפני כל מהלך צריך לבדוק תמיד את כל השחים וההכאות",
    "לבדוק את כל ההכאות של היריב לפני שאני בוחר מהלך",
    "לפני מהלך שקט לעבור על כל השחים",
    "צריך לחשוב על המהלך של היריב לפני שאני משחק",
    "לספור את כל האיומים על המלך שלי לפני כל מהלך",
    "כשיש לי יותר זמן לבדוק את כל האפשרויות ולא לבחור את הראשונה",
    "לא לזוז עם הרגלי לפני המלך",
    "לבדוק תמיד אם הכלי תלוי",
  ];

  it("cuts the generic sentence from six rules to at most two", () => {
    const beaten = RULES.filter((rule) => scoreRecall(GENERIC, rule).clearedFloor);
    expect(beaten.length, `still beaten:\n${beaten.join("\n")}`).toBeLessThanOrEqual(2);
  });

  it("still accepts every rule's own words back, which is the cost side of the same change", () => {
    // A stop-list aggressive enough to stop the attack and also stop real recall would be a fix
    // that deletes the measurement. All eight must still pass their own verbatim recall.
    for (const rule of RULES) {
      expect(scoreRecall(rule, rule).clearedFloor, rule).toBe(true);
    }
  });

  it("does not let a single lucky word carry a short rule", () => {
    /*
     * A ratio alone is not enough when the denominator is two. "לספור שחים" has two content words,
     * so one match scored 0.50 against a 0.34 floor -- and a rule repeating one word
     * de-duplicates to a single content word, where any token containing it scored 1.00.
     */
    expect(scoreRecall("שחים", "לספור שחים").clearedFloor).toBe(false);
    expect(scoreRecall("חים", "שחים שחים שחים").clearedFloor).toBe(false);
    expect(scoreRecall("לספור שחים", "לספור שחים").clearedFloor).toBe(true);
  });
});

describe("a rule with nothing to match on is not scoreable", () => {
  it("says so for a rule written only in coordinates", () => {
    // Ordinary ways to write a chess rule that this measure cannot see at all. Testing one is
    // unwinnable, and losing an unwinnable test used to refute the rule permanently.
    for (const rule of ["f7 f2", "0-0", "h2 h3", "e4 e5", "a-b-c"]) {
      expect(isScoreable(rule), rule).toBe(false);
    }
  });

  it("says a rule in ordinary words is scoreable", () => {
    expect(isScoreable("לספור שחים והכאות")).toBe(true);
    expect(isScoreable("check every capture")).toBe(true);
  });
});
