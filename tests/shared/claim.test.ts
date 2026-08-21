import { describe, expect, it } from "vitest";
import { evaluateClaim, formHypothesis, type ProspectiveDrillResult } from "../../shared/claim";
import { deriveClaim, selectClaim, statementFor } from "../../shared/claim-derivation";
import type { CandidatePattern } from "../../shared/detector";

const pattern: CandidatePattern = {
  key: "fast-under-45s",
  scope: "החלטות תחת פחות מ-45 שניות",
  inside: { n: 42, meanConfidence: 0.8, accuracyRate: 0.24, gap: 0.56 },
  outside: { n: 61, meanConfidence: 0.5, accuracyRate: 0.47, gap: 0.03 },
  gapDifference: 0.53,
  supporting_decision_ids: Array.from({ length: 42 }, (_, i) => `d${i}`),
  predicts_overconfidence: true,
};

const now = "2026-08-21T00:00:00Z";

describe("a claim states its n, its scope, and what would refute it", () => {
  const claim = deriveClaim(pattern, { claim_id: "c1", created_at: now });

  it("starts as a hypothesis and cannot start as anything else", () => {
    expect(claim.grade).toBe("hypothesis");
  });

  it("carries n equal to the decisions that produced it", () => {
    expect(claim.n).toBe(42);
    expect(claim.supporting_decision_ids).toHaveLength(42);
  });

  it("puts both n values in the sentence, so neither side is a bare rate", () => {
    const statement = statementFor(pattern);
    expect(statement).toContain("42 החלטות");
    expect(statement).toContain("61");
  });

  it("states in advance what would refute it", () => {
    expect(claim.refutation_condition).toContain("הופרכה");
  });

  it("refuses to form without a refutation condition (R5)", () => {
    expect(() =>
      formHypothesis({
        claim_id: "c2",
        statement: "s",
        scope: "sc",
        evidence: { kind: "retrospective", decision_ids: ["a"] },
        refutation_condition: "   ",
        created_at: now,
      }),
    ).toThrow(/refutation condition/);
  });
});

describe("only a prospective drill can raise a grade", () => {
  const claim = deriveClaim(pattern, { claim_id: "c1", created_at: now });
  const result = (over: Partial<ProspectiveDrillResult> = {}): ProspectiveDrillResult => ({
    kind: "prospective_drill_result",
    drill_id: "dr1",
    claim_id: "c1",
    decision_ids: ["x1", "x2"],
    predicted: true,
    observed: true,
    recorded_at: "2026-08-22T00:00:00Z",
    ...over,
  });

  it("raises to replicated when the drill matched the prediction", () => {
    expect(evaluateClaim(claim, result()).grade).toBe("replicated");
  });

  it("refutes when the drill contradicted the prediction", () => {
    expect(evaluateClaim(claim, result({ observed: false })).grade).toBe("refuted");
  });

  it("keeps a refuted claim refuted forever", () => {
    const refuted = evaluateClaim(claim, result({ observed: false }));
    const retried = evaluateClaim(refuted, result({ drill_id: "dr2", observed: true }));
    expect(retried.grade).toBe("refuted");
    expect(retried.prospective_tests).toHaveLength(2);
  });

  it("rejects a result belonging to another claim", () => {
    expect(() => evaluateClaim(claim, result({ claim_id: "other" }))).toThrow(/different claim/);
  });
});

describe("the unit of output is one claim", () => {
  it("shows the best-supported candidate and counts the rest", () => {
    const second = { ...pattern, scope: "אחר", inside: { ...pattern.inside, n: 31 } };
    const selection = selectClaim([pattern, second], { claim_id: "c1", created_at: now });
    expect(selection?.claim.scope).toBe(pattern.scope);
    expect(selection?.othersWithheld).toBe(1);
  });

  it("returns nothing when there is nothing to say", () => {
    expect(selectClaim([], { claim_id: "c1", created_at: now })).toBeNull();
  });
});
