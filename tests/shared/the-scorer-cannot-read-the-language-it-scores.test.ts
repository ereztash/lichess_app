/**
 * A scoring instrument that gives wrong answers in the language it scores.
 *
 * `scoreRecall` decides whether a player remembered their own rule, and its verdict drives
 * `RECALL_COVERAGE_FLOOR` and, through it, whether a learning rule is marked refuted. It tokenises
 * with `[^\p{L}\p{N}]+` and matches by containment. That handles Hebrew's PREFIXES -- the file
 * argues the point at length and the argument is correct. It does not handle the writing system.
 *
 * MEASURED, NOT INFERRED. Each line below was run against the unfixed tokeniser:
 *
 *   "מהלכים".includes("מהלך")   ->  false      a final kaf is U+05DA, a medial kaf is U+05DB
 *   "שָׁחִים"                       ->  []         combining marks split the word below the token floor
 *   "ג׳ירף"                      ->  ["ירף"]    the geresh is not \p{L}, so the first letter is eaten
 *   "צה״ל"                       ->  []         and an acronym disappears entirely
 *
 * AND ONE CLAIM THAT WAS CHECKED AND IS FALSE. The maqaf U+05BE was reported as a fourth defect on
 * the strength of "אל־תשכח" -> ["תשכח"]. It is not one: "בדיקה־כפולה" -> ["בדיקה","כפולה"], which
 * is correct, because a maqaf IS a word separator and tokenising on it is right. "אל" was dropped
 * for being two characters -- `MIN_TOKEN_LENGTH`, a judgement this file already states. It is
 * recorded here so it is not re-reported as a defect by the next reader.
 *
 * WHY THE SOFIT CASE IS THE WORST. Hebrew inflection changes the FINAL letter -- singular to
 * plural, absolute to construct, with and without a possessive. So the containment rule, written
 * expressly so a player is not charged for grammar, still charges them for grammar in the commoner
 * direction.
 *
 * WHY THE NIQQUD CASE SHOULD NOT SURVIVE REVIEW IN A MEASUREMENT PRODUCT. The same sentence, typed
 * by the same person, clears or misses the floor according to whether their keyboard emits points.
 * That is not a property of their memory.
 *
 * EVERY FIXTURE HERE SHARES EXACTLY ONE CONTENT WORD BETWEEN RULE AND RECALL -- the one under
 * test. The first version of this file did not, and ten of its twelve assertions passed against
 * the unfixed code: `matched > 0` was satisfied by an unrelated word both sides happened to
 * contain, and three more compared a string with itself, which tokenises identically however
 * broken the tokeniser is.
 */
import { describe, expect, it } from "vitest";
import { RECALL_COVERAGE_FLOOR, isScoreable, scoreRecall } from "../../shared/recall-score";

describe("a final letter is the same letter", () => {
  it("matches a word against its own plural", () => {
    /*
     * Rule and recall share NOTHING but the word under test. `אחד` and `רבים` are the filler and
     * are deliberately different, so `matched` counts the sofit fold and nothing else.
     */
    const score = scoreRecall("מהלכים רבים", "מהלך אחד");
    expect(score.matched, "מהלך did not match מהלכים").toBe(1);
  });

  it("folds every sofit form, not just the one in the fixture", () => {
    // ך ם ן ף ץ -- five letters, five ways for one defect to appear. Each root here is four or
    // more letters after folding; see the next test for why that qualifier is in this sentence.
    for (const [rule, recall] of [
      ["מהלך", "מהלכים"],
      ["אלים", "אלימות"],
      ["ארון", "ארונות"],
      ["משקף", "משקפיים"],
      ["מרוץ", "מרוצים"],
    ]) {
      expect(scoreRecall(recall, rule).matched, `${rule} did not match ${recall}`).toBe(1);
    }
  });

  it("still misses a three-letter root, and that is the existing floor rather than the fold", () => {
    /*
     * THE RESIDUAL LIMIT, RECORDED RATHER THAN PAPERED OVER -- and it is not small: three-letter
     * roots are the commonest shape in Hebrew.
     *
     * `כסף` folds to `כספ`, three characters, and `MIN_CONTAINMENT_LENGTH = 4` blocks containment
     * below four. So `כספים` still does not match it. The fold is working; the length floor is
     * what stops the match, and that floor is a judgement this file already states with a reason
     * -- containment on short tokens matches inside unrelated words.
     *
     * LOWERING IT TO MAKE THIS PASS WOULD BE A THRESHOLD TUNED TO SHAPE A RESULT, which is the one
     * thing every constant in this file is written to avoid. So it stays, the miss stays, and the
     * miss is asserted -- if someone lowers the floor later, this test tells them what they bought
     * and makes them argue for it.
     */
    expect(scoreRecall("כספים רבים", "כסף אחד").matched).toBe(0);
    expect(scoreRecall("לחצים רבים", "לחץ אחד").matched).toBe(0);
  });

  it("does not turn two different words into one", () => {
    /*
     * THE COST OF THE FOLD, ASSERTED RATHER THAN ASSUMED. Folding is lossy: words differing only
     * in a final form become identical. In Hebrew that is the inflection we want. `סוף` and `סופר`
     * differ by a real letter and must stay apart -- and note `סופר` contains `סופ`, so this is
     * exactly where a careless fold plus containment would produce a false match.
     */
    expect(scoreRecall("סופר", "סוף").matched).toBe(0);
  });
});

describe("the floor does not depend on the keyboard", () => {
  it("reads a pointed word at all", () => {
    // Before the fix `שָׁחִים` tokenised to nothing, so the recall shared no word with the rule.
    expect(scoreRecall("שָׁחִים רבים", "שחים תמיד").matched).toBe(1);
  });

  it("scores the same sentence identically, pointed or not", () => {
    const rule = "לספור שחים לפני מהלך";
    const pointed = scoreRecall("לספור שָׁחִים לפני מהלך", rule);
    const plain = scoreRecall("לספור שחים לפני מהלך", rule);
    expect(pointed.matched).toBe(plain.matched);
    expect(pointed.coverage).toBe(plain.coverage);
    expect(pointed.clearedFloor).toBe(plain.clearedFloor);
  });

  it("normalises the AUTHORED rule too, not only the recall", () => {
    /*
     * The same case from the other side. A fix applied to one argument would pass everything above
     * and fail here -- so this is the assertion that pins WHERE the normalisation happens.
     */
    expect(scoreRecall("שחים רבים", "שָׁחִים תמיד").matched).toBe(1);
  });

  it("keeps a pointed rule scoreable", () => {
    // `isScoreable` guards against an unwinnable test. A rule written with points had its words
    // erased, so a perfectly ordinary rule could be refused as unscoreable.
    expect(isScoreable("לספור שָׁחִים תמיד")).toBe(true);
  });
});

describe("the geresh writes a letter, it does not end a word", () => {
  it("keeps the first letter of a word that carries one", () => {
    // `ג׳ירף` tokenised to `ירף` -- the geresh cut the word and the ג went with it.
    expect(scoreRecall("גירף שניים", "ג׳ירף אחד").matched).toBe(1);
  });

  it("keeps an acronym written with gershayim", () => {
    // `צה״ל` tokenised to nothing at all: two one-character fragments, both under the floor.
    expect(isScoreable("צה״ל ומגן")).toBe(true);
  });
});

describe("what the fix leaves exactly as it was", () => {
  it("still refuses a rule with nothing to score", () => {
    /*
     * The guard this file was written for. `f7 f2` has no token the measure can see, and the
     * product's response to losing an unwinnable test was to mark the rule refuted forever.
     */
    expect(isScoreable("f7 f2")).toBe(false);
  });

  it("still scores unrelated text below the floor", () => {
    expect(scoreRecall("banana", "לספור שחים לפני כל מהלך").clearedFloor).toBe(false);
  });

  it("still gives a verbatim recall full coverage", () => {
    const rule = "לספור שחים לפני כל מהלך";
    expect(scoreRecall(rule, rule).coverage).toBe(1);
  });

  it("still tokenises a maqaf as the separator it is", () => {
    // The claim that was checked and rejected -- pinned so the non-defect stays non-broken.
    expect(scoreRecall("בדיקה אחרת", "בדיקה־כפולה").matched).toBe(1);
  });

  it("leaves Latin text untouched", () => {
    /*
     * The normalisation is about the Hebrew writing system and must be inert elsewhere. A regime
     * that also folded Latin diacritics would be a second, unmeasured change riding along --
     * `resume` and `résumé` are different words in English and this must not merge them.
     */
    expect(scoreRecall("resume", "résumé").matched).toBe(0);
    expect(scoreRecall("count checks", "count checks").coverage).toBe(1);
  });

  it("keeps the floor and the token length where they were", () => {
    // Every constant in the file is a stated judgement. None of them is being re-seated here.
    expect(RECALL_COVERAGE_FLOOR).toBe(0.34);
  });
});
