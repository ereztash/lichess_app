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
import { RECALL_COVERAGE_FLOOR, scoreRecall } from "../../shared/recall-score";

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
