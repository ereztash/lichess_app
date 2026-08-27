/**
 * GATE-PREREG (R5): a drill cannot start without a stored refutation condition AND a direction.
 *
 * THE SECOND HALF WAS ADDED AFTER IT WAS MISSED. This gate asked only for the sentence, and
 * passed for as long as the grading path supplied the missing sign itself -- `finishDrill` passed
 * the constant `predictsOverconfidence: true` into a one-sided test, so every underconfidence
 * claim was graded by whether the player turned out OVERconfident. The claim then read `refuted`
 * on evidence confirming it, refutation is terminal, and `beginDrill` refuses that claim
 * afterwards. The reproduction lives in tests/shared/which-way-the-claim-points.ts.
 *
 * "Written down before the drill runs" is a claim about the whole test. A sentence that says "if
 * the gap is not larger -- refuted", with nothing recording larger in which direction, is half of
 * one.
 */
import { describe, expect, it } from "vitest";
import { completeDrill, createDrill, startDrill, describeResult } from "../../shared/drill";
import { formHypothesis, evaluateClaim } from "../../shared/claim";
import { preregVerdict } from "../fixtures/prereg-scenario";

const claim = formHypothesis({
  claim_id: "c1",
  statement: "בהחלטות מהירות הביטחון גבוה מהתוצאות.",
  scope: "החלטות תחת פחות מ-45 שניות",
  evidence: { kind: "retrospective", decision_ids: ["d1", "d2", "d3"] },
  refutation_condition: "אם הפער בדריל לא יהיה גדול יותר מאשר בשאר ההחלטות — הופרך.",
  predicts_overconfidence: true,
  created_at: "2026-08-21T00:00:00Z",
});
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("GATE-PREREG: no drill starts without a stored refutation condition and direction", () => {
  it("refuses a null condition, a blank condition, and a missing direction alike", () => {
    const verdict = preregVerdict((spec) =>
      startDrill(spec, { predicted: true, started_at: "2026-08-22T00:00:00Z" }),
    );
    expect(verdict.ok, verdict.detail).toBe(true);
  });

  it("copies the condition from the claim rather than referencing it", () => {
    const spec = createDrill(claim, [FEN], { drill_id: "dr1" });
    expect(spec.refutation_condition).toBe(claim.refutation_condition);
    // Editing the claim afterwards must not change what the drill was testing.
    const edited = { ...claim, refutation_condition: "something else entirely" };
    expect(spec.refutation_condition).not.toBe(edited.refutation_condition);
  });

  it("refuses to build a drill from a claim with no condition", () => {
    const bare = { ...claim, refutation_condition: "" };
    expect(() => createDrill(bare, [FEN], { drill_id: "dr2" })).toThrow(/measures nothing/);
  });

  it("copies the direction from the claim too, as one term with the condition", () => {
    const spec = createDrill(claim, [FEN], { drill_id: "dr1b" });
    expect(spec.predicts_overconfidence).toBe(claim.predicts_overconfidence);
    // And a claim that never recorded one cannot be built into a drill at all: the alternative
    // is a spec whose sentence names a direction its sign does not.
    const directionless = { ...claim, predicts_overconfidence: null };
    expect(() => createDrill(directionless, [FEN], { drill_id: "dr2b" })).toThrow(
      /does not record whether it predicts overconfidence/,
    );
  });

  it("refuses a drill with no positions to test", () => {
    expect(() => createDrill(claim, [], { drill_id: "dr3" })).toThrow(/no positions/);
  });
});

describe("a drill reports its result either way", () => {
  const spec = createDrill(claim, [FEN, FEN], { drill_id: "dr4" });
  const started = startDrill(spec, { predicted: true, started_at: "2026-08-22T00:00:00Z" });

  it("fixes the prediction before any position is shown", () => {
    expect(started.predicted).toBe(true);
    expect(started.started_at).toBe("2026-08-22T00:00:00Z");
  });

  it("confirms when the majority of new decisions matched", () => {
    const result = completeDrill(
      started,
      [
        { decision_id: "n1", matchedPrediction: true },
        { decision_id: "n2", matchedPrediction: true },
        { decision_id: "n3", matchedPrediction: false },
      ],
      { recorded_at: "2026-08-23T00:00:00Z" },
    );
    expect(result.observed).toBe(true);
    expect(evaluateClaim(claim, [result]).grade).toBe("replicated");
    expect(describeResult(result)).toContain("שוחזר");
  });

  it("REFUTES, and says so, when the majority did not", () => {
    const result = completeDrill(
      started,
      [
        { decision_id: "n1", matchedPrediction: false },
        { decision_id: "n2", matchedPrediction: false },
        { decision_id: "n3", matchedPrediction: true },
      ],
      { recorded_at: "2026-08-23T00:00:00Z" },
    );
    expect(result.observed).toBe(false);
    const refuted = evaluateClaim(claim, [result]);
    expect(refuted.grade).toBe("refuted");
    expect(describeResult(result)).toContain("הופרך");
    expect(describeResult(result)).toContain("נשמרת לתמיד");
  });

  it("refuses to close a drill that recorded nothing", () => {
    expect(() => completeDrill(started, [], { recorded_at: "x" })).toThrow(/no decisions/);
  });

  it("carries only decisions made during the drill, so it is genuinely prospective", () => {
    const result = completeDrill(started, [{ decision_id: "n1", matchedPrediction: true }], {
      recorded_at: "2026-08-23T00:00:00Z",
    });
    for (const id of result.decision_ids) {
      expect(claim.supporting_decision_ids).not.toContain(id);
    }
  });
});
