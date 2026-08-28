/**
 * The detector measures a CONTRAST between two buckets. Two screens spoke it as a LEVEL.
 *
 * `detect` sets `predicts_overconfidence: gapDifference > 0`, where
 * `gapDifference = insideSummary.gap - outsideSummary.gap`. True means the bucket sits ABOVE THE
 * REST of the record on the (confidence − accuracy) quantity. It says nothing about whether the
 * player is over- or underconfident INSIDE the bucket, and `detect` never tests an inside gap
 * against zero — what clears the separability bar is the contrast.
 *
 * `statementFor` (shared/claim-derivation.ts) read that boolean and wrote "הביטחון שלך גבוה יותר
 * ממה שהתוצאות מצדיקות", and `direction` (client/src/components/ProfilePanel.tsx) wrote "הצהרתם
 * יותר ביטחון ממה שיצא". Both are claims about the person in that bucket.
 *
 * MEASURED BEFORE IT WAS FIXED, on the ordinary path with nothing injected. A player who is
 * underconfident EVERYWHERE and least so in the opening — which `shared/bucket-variable.ts`
 * records as the common shape, underconfidence firing 78 times out of 78:
 *
 *     inside : confidence 50%  accuracy 55%   gap -0.050
 *     outside: confidence 35%  accuracy 65%   gap -0.300
 *     gapDifference +0.250  ->  predicts_overconfidence: true
 *
 *     ב-החלטות בפתיחה (300 החלטות) הביטחון שלך גבוה יותר ממה שהתוצאות מצדיקות:
 *     ביטחון ממוצע 50% מול דיוק 55%. בשאר ההחלטות (600) הפער קטן בהרבה — ביטחון 35% מול דיוק 65%.
 *
 * Two falsehoods, each contradicted by a number printed in the same sentence: the player is five
 * points UNDERconfident in the opening, and the rest's gap is six times BIGGER, not "much
 * smaller". That second clause was a template constant — nothing ever compared the magnitudes.
 *
 * THE GRADING PATH WAS NEVER WRONG, and that is why this is a defect in what a human reads rather
 * than in a verdict. `evaluateRefutation` signs `drillGap - baseline.gap`, itself a contrast, and
 * `refutationConditionFor` writes a relative condition. Those are asserted here too, so a later
 * fix to the sentence cannot quietly change the test.
 */
import { describe, expect, it } from "vitest";
import { detect, PREREGISTERED_SEPARABILITY_K, type ScoredDecision } from "../../shared/detector";
import { refutationConditionFor, selectClaim, statementFor } from "../../shared/claim-derivation";

let seq = 0;
const decision = (
  phase: ScoredDecision["phase"],
  confidence: number,
  accurate: boolean,
): ScoredDecision => ({
  decision_id: `d${seq++}`,
  fen: "8/8/8/8/8/8/8/8 w - - 0 1",
  confidence,
  accurate,
  phase,
  secondsTaken: 60,
  clockMsRemaining: null,
});

/**
 * Underconfident everywhere, least so in the opening.
 *
 * Opening: 50% stated against 55% accurate — five points under.
 * Elsewhere: 35% stated against 65% accurate — thirty points under.
 *
 * So the opening separates UPWARD (gapDifference > 0) while remaining, in absolute terms, the
 * less-underconfident of two underconfident groups. That is the case the old sentence inverted.
 */
function underconfidentEverywhereLeastInTheOpening(): ScoredDecision[] {
  seq = 0;
  const all: ScoredDecision[] = [];
  for (let i = 0; i < 300; i += 1) {
    all.push(decision("opening", i < 150 ? 0.35 : 0.65, i < 165));
  }
  for (const phase of ["middlegame", "endgame"] as const) {
    for (let i = 0; i < 300; i += 1) {
      all.push(decision(phase, i < 150 ? 0.2 : 0.5, i < 195));
    }
  }
  return all;
}

describe("a bucket that separates upward while the player is underconfident in it", () => {
  const patterns = detect(underconfidentEverywhereLeastInTheOpening());
  const opening = patterns.find((p) => p.key === "phase-opening");

  it("is the case the fixture is for: separating upward, still underconfident inside", () => {
    // Guard the fixture itself. Every assertion below is vacuous if this shape is not produced.
    expect(opening, "the opening did not separate; the fixture measures nothing").toBeDefined();
    expect(opening!.predicts_overconfidence, "should separate upward").toBe(true);
    expect(opening!.inside.gap, "but be underconfident inside the bucket").toBeLessThan(0);
    expect(
      Math.abs(opening!.outside.gap),
      "and the rest's gap must be the BIGGER of the two, so 'much smaller' is false",
    ).toBeGreaterThan(Math.abs(opening!.inside.gap));
  });

  it("does not tell the player they stated more confidence than their results justify", () => {
    const statement = statementFor(opening!);
    expect(
      statement,
      "asserted overconfidence about a player who is underconfident in this very bucket",
    ).not.toContain("הביטחון שלך גבוה יותר ממה שהתוצאות מצדיקות");
    expect(statement).not.toContain("הביטחון שלך נמוך יותר ממה שהתוצאות מצדיקות");
  });

  it("does not claim the rest's gap is much smaller when it is six times bigger", () => {
    expect(
      statementFor(opening!),
      "a template constant that was never computed from the two summaries",
    ).not.toContain("הפער קטן בהרבה");
  });

  it("says the comparison it actually made, and prints both pairs of numbers", () => {
    const statement = statementFor(opening!);
    // The contrast — the thing that cleared the separability bar.
    // The comparison, in whatever words: the claim is a contrast between two groups, not a level.
    expect(statement).toContain("ביחס למה שיצא בפועל");
    expect(statement).toContain("מאשר בשאר ההחלטות");
    /*
     * Both pairs on the screen, so the absolute direction is visible rather than asserted. The
     * words around them moved into player language; the four numbers and their pairing did not.
     */
    expect(statement).toContain("אמרת 50% ויצא 55%");
    expect(statement).toContain("אמרת 35% ויצא 65%");
    // And a reader who finishes "higher relative to accuracy here" as "I am overconfident here"
    // is told, in the same paragraph, that this is not what was measured.
    expect(statement).toContain("ההשוואה היא בין שתי הקבוצות");
  });

  it("keeps saying which way the contrast goes, rather than going silent", () => {
    // The cheap way to pass every assertion above is to say nothing. The direction is real and
    // measured; it is the referent that was wrong.
    expect(statementFor(opening!)).toContain("גבוה יותר");
    const down = patterns.find((p) => p.key !== "phase-opening" && !p.predicts_overconfidence);
    if (down) expect(statementFor(down)).toContain("נמוך יותר");
  });

  it("still writes a refutation condition, and it was always relative", () => {
    // R5 is untouched by this fix, and the drill grades the contrast the condition names.
    const condition = refutationConditionFor(opening!);
    expect(condition).toContain("מאשר בשאר ההחלטות");
    expect(condition).toContain("הופרכה");
  });

  it("names the bar the grader actually applies, not a plain comparison", () => {
    /*
     * The condition promised "if the gap is not larger than in the rest — refuted", while
     * `evaluateRefutation` requires the difference to clear PREREGISTERED_SEPARABILITY_K standard
     * errors of itself first. A player who reads the stored sentence, meets it on the drill, and
     * is then told the claim is refuted has been held to a condition nobody showed them — and
     * refutation is terminal.
     *
     * The multiplier is asserted from the constant rather than typed, so the sentence and the test
     * cannot drift from the grader together.
     */
    for (const pattern of [opening!, { ...opening!, predicts_overconfidence: false }]) {
      const condition = refutationConditionFor(pattern);
      expect(condition).toContain(String(PREREGISTERED_SEPARABILITY_K));
      expect(condition).toContain("שגיאות תקן");
    }
  });

  it("carries the same direction onto the stored claim, so grading is unaffected", () => {
    const selection = selectClaim(patterns, { created_at: "2026-08-27T00:00:00.000Z" });
    expect(selection).not.toBeNull();
    const pattern = patterns.find((p) => p.key === selection!.key)!;
    expect(selection!.claim.predicts_overconfidence).toBe(pattern.predicts_overconfidence);
  });
});

describe("the ordinary case, where contrast and level agree", () => {
  it("still reads as a finding rather than being hedged into nothing", () => {
    // A player genuinely overconfident when fast and calibrated otherwise: here the contrast and
    // the inside level point the same way, and the sentence must still be worth reading.
    seq = 0;
    const all: ScoredDecision[] = [];
    for (let i = 0; i < 300; i += 1) {
      all.push({ ...decision("middlegame", i < 150 ? 0.8 : 0.95, i < 60), secondsTaken: 10 });
    }
    for (let i = 0; i < 300; i += 1) {
      all.push({ ...decision("middlegame", i < 150 ? 0.35 : 0.5, i < 195), secondsTaken: 200 });
    }
    const fast = detect(all).find((p) => p.key === "fast-under-45s");
    expect(fast, "fixture did not separate").toBeDefined();
    expect(fast!.predicts_overconfidence).toBe(true);
    expect(fast!.inside.gap, "and genuinely overconfident inside, unlike the case above").toBeGreaterThan(0);
    const statement = statementFor(fast!);
    expect(statement).toContain("גבוה יותר");
    expect(statement).toContain(String(fast!.inside.n));
    expect(statement).toContain(String(fast!.outside.n));
  });
});
