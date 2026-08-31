/**
 * Step 11: every screen answers "should I believe this?" in the same five words.
 *
 * THE FAILURE THIS GATE IS AGAINST is not a wrong number. It is a reader who cannot tell, by
 * looking, whether the sentence in front of them is a fact about one move, a pattern found by
 * rummaging through their own record, or something that was written down in advance and then
 * survived a test that could have killed it. Rendered in the same card at the same weight, all
 * three read as "the product knows this about me".
 *
 * SO THE ASSERTIONS BELOW ARE ABOUT DISTINGUISHABILITY, not about correctness of prose: five
 * distinct marks, five distinct words, no level able to borrow another's vocabulary, and -- the
 * one that actually catches drift -- the three claim levels wearing exactly the words the claim
 * ledger already owns.
 */
import { describe, expect, it } from "vitest";
import {
  AUTHORITY,
  AUTHORITY_ORDER,
  AUTHORITY_WORDS,
  GRADE_AUTHORITY,
  authorityOfClaim,
  authorityOfRecordReading,
  mayBeSpokenAs,
  type EvidenceAuthority,
} from "@shared/evidence-authority";
import { CLAIM_GRADES, GRADE_WORD, type Claim, type ClaimGrade } from "@shared/claim";

const claimWith = (grade: ClaimGrade): Claim => ({
  claim_id: "c1",
  statement: "כשנשאר מעט זמן, הביטחון גבוה מהתוצאה",
  scope: "fast-under-45s",
  supporting_decision_ids: ["d1", "d2"],
  n: 2,
  grade,
  refutation_condition: "אם הפער לא יהיה גדול יותר בבדיקה קדימה — הופרך.",
  predicts_overconfidence: true,
  prospective_tests: [],
  graded_under: null,
  created_at: "2026-01-01T00:00:00.000Z",
  last_evaluated_at: "2026-01-01T00:00:00.000Z",
});

describe("one word for how much this counts", () => {
  it("gives every level its own mark, so two levels never look alike", () => {
    const marks = AUTHORITY_ORDER.map((a) => AUTHORITY[a].mark);
    expect(new Set(marks).size).toBe(AUTHORITY_ORDER.length);
  });

  it("gives every level its own word", () => {
    expect(new Set(AUTHORITY_WORDS).size).toBe(AUTHORITY_ORDER.length);
  });

  it("keeps the three claim levels on the claim ledger's own words", () => {
    /*
     * THE ASSERTION THAT WOULD HAVE CAUGHT THE FIRST DRAFT OF THIS MODULE, which invented
     * "השערה לבדיקה" / "חזר גם בבדיקה" / "לא חזר בבדיקה" beside the three that already shipped.
     * Better sentences, and a second vocabulary for three states that had one -- exactly the drift
     * the module was written to stop, arriving inside the module written to stop it.
     */
    for (const grade of CLAIM_GRADES) {
      expect(AUTHORITY[GRADE_AUTHORITY[grade]].word).toBe(GRADE_WORD[grade].he);
    }
  });

  it("maps every claim grade onto exactly one authority, and never collides", () => {
    const mapped = CLAIM_GRADES.map((g) => GRADE_AUTHORITY[g]);
    expect(new Set(mapped).size).toBe(CLAIM_GRADES.length);
    for (const grade of CLAIM_GRADES) {
      expect(authorityOfClaim(claimWith(grade))).toBe(GRADE_AUTHORITY[grade]);
    }
  });

  it("leaves two levels that no claim can reach, which is why they exist", () => {
    /*
     * `one-event` and `recurred` are the two the product had no name for. If a claim could reach
     * either, the retrospective/prospective line would have a hole in it: something found by
     * looking at the record could arrive wearing a claim's standing.
     */
    const reachableByClaim = new Set<EvidenceAuthority>(CLAIM_GRADES.map((g) => GRADE_AUTHORITY[g]));
    expect(reachableByClaim.has("one-event")).toBe(false);
    expect(reachableByClaim.has("recurred")).toBe(false);
  });

  it("calls one decision an event and more than one a description, and nothing else", () => {
    expect(authorityOfRecordReading(1)).toBe("one-event");
    expect(authorityOfRecordReading(0)).toBe("one-event");
    expect(authorityOfRecordReading(2)).toBe("recurred");
    expect(authorityOfRecordReading(900)).toBe("recurred");
  });

  it("does NOT promote a retrospective reading however large it gets", () => {
    /*
     * R5, stated at the level of what may be rendered. A bigger retrospective gap is a bigger
     * retrospective gap; the region was still chosen after seeing the data it is measured on.
     */
    expect(authorityOfRecordReading(10_000)).toBe("recurred");
    expect(AUTHORITY[authorityOfRecordReading(10_000)].mayPrescribe).toBe(false);
    expect(AUTHORITY[authorityOfRecordReading(10_000)].settled).toBe(false);
  });

  it("lets exactly one level tell the player to play differently", () => {
    /*
     * Section 23. Coaching arrives last and only behind evidence that could have come back
     * negative. Anything else may ask for another measurement, which is a request the product
     * makes of itself rather than an instruction about somebody's chess.
     */
    const prescribing = AUTHORITY_ORDER.filter((a) => AUTHORITY[a].mayPrescribe);
    expect(prescribing).toEqual(["tested"]);
  });

  it("treats a refutation as settled, and still refuses to prescribe from it", () => {
    // Both settled outcomes are successes; only one of them has something to recommend.
    expect(AUTHORITY.refuted.settled).toBe(true);
    expect(AUTHORITY.tested.settled).toBe(true);
    expect(AUTHORITY.refuted.mayPrescribe).toBe(false);
    const unsettled = AUTHORITY_ORDER.filter((a) => !AUTHORITY[a].settled);
    expect(unsettled).toEqual(["one-event", "recurred", "hypothesis"]);
  });

  it("refuses to let any level be spoken as any other, in either direction", () => {
    for (const actual of AUTHORITY_ORDER) {
      for (const spoken of AUTHORITY_ORDER) {
        expect(mayBeSpokenAs(actual, spoken)).toBe(actual === spoken);
      }
    }
  });

  it("says what each level means in terms of what was DONE, not how sure anyone feels", () => {
    /*
     * A weak-looking assertion guarding a real failure mode: `means` is the line that opens behind
     * progressive disclosure, and the temptation there is to write confidence adverbs. Every one of
     * these sentences has to name an act -- it happened, it repeats, we wrote it down, we checked.
     */
    for (const level of AUTHORITY_ORDER) {
      expect(AUTHORITY[level].means.length).toBeGreaterThan(20);
      expect(AUTHORITY[level].means).not.toMatch(/\d+(\.\d+)?%/);
    }
  });
});
