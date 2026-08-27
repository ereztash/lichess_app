import { describe, expect, it } from "vitest";
import { evaluateClaim, formHypothesis, type ProspectiveDrillResult } from "../../shared/claim";
import { deriveClaim, selectClaim, statementFor } from "../../shared/claim-derivation";
import type { CandidatePattern } from "../../shared/detector";

const pattern: CandidatePattern = {
  key: "fast-under-45s",
  scope: "החלטות תחת פחות מ-45 שניות",
  inside: { n: 42, meanConfidence: 0.8, accuracyRate: 0.24, gap: 0.56, gapVariance: 0.18 },
  outside: { n: 61, meanConfidence: 0.5, accuracyRate: 0.47, gap: 0.03, gapVariance: 0.21 },
  gapDifference: 0.53,
  standardError: 0.0973,
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
    expect(evaluateClaim(claim, [result()]).grade).toBe("replicated");
  });

  it("refutes when the drill contradicted the prediction", () => {
    expect(evaluateClaim(claim, [result({ observed: false })]).grade).toBe("refuted");
  });

  it("keeps a refuted claim refuted forever", () => {
    const history = [
      result({ observed: false }),
      result({ drill_id: "dr2", recorded_at: "2026-08-23T00:00:00Z", observed: true }),
    ];
    const retried = evaluateClaim(claim, history);
    expect(retried.grade).toBe("refuted");
    expect(retried.prospective_tests).toHaveLength(2);
  });

  it("rejects a result belonging to another claim", () => {
    expect(() => evaluateClaim(claim, [result({ claim_id: "other" })])).toThrow(/different claim/);
  });

  /*
   * WHAT THE FOLD BUYS, ASSERTED RATHER THAN ASSUMED.
   *
   * The grade used to be stepped onto whatever claim it was handed, which made it depend on how
   * many times it had been called and in what order -- and that is what a store with no
   * transaction cannot promise. These are the reason the signature changed, so they are tested
   * directly and not only through the crash in
   * `tests/shared/a-verdict-the-drill-cannot-report-twice.test.ts`.
   */
  it("reads the same record the same way, whatever the order and however many times it runs", () => {
    const history = [
      result({ drill_id: "dr1", recorded_at: "2026-08-22T00:00:00Z", observed: true }),
      result({ drill_id: "dr2", recorded_at: "2026-08-25T00:00:00Z", observed: false }),
    ];
    const graded = evaluateClaim(claim, history);
    expect(graded.grade).toBe("refuted");
    expect(graded.last_evaluated_at).toBe("2026-08-25T00:00:00Z");

    // Rows come back in whatever order the store gives them. The verdict is about the drills.
    expect(evaluateClaim(claim, [...history].reverse())).toEqual(graded);

    // And grading an already-graded claim changes nothing, which is what lets the retry path grade
    // unconditionally instead of having to know whether the first attempt got through.
    expect(evaluateClaim(graded, history)).toEqual(graded);
  });

  it("returns a claim with no forward test behind it to the day it was written", () => {
    // Not "never evaluated" and not today: a claim that has been tested zero times has been
    // evaluated exactly as recently as it was formed.
    const untested = evaluateClaim({ ...claim, grade: "replicated" }, []);
    expect(untested.grade).toBe("hypothesis");
    expect(untested.last_evaluated_at).toBe(claim.created_at);
  });
});

describe("the unit of output is one claim", () => {
  /*
   * THIS BLOCK'S FIXTURE WAS WRONG AND THE CHANGE TO `selectClaim` EXPOSED IT.
   *
   * It used to build the second candidate as `{ ...pattern, scope: "אחר" }` -- which copies the
   * KEY as well, so both candidates were the same bucket under two names. `detect` cannot produce
   * that; every key it returns is distinct. The test read as "two candidates, show one, count
   * one" and was really "one bucket, counted twice", and it passed only because the old rule
   * counted rows rather than findings.
   */
  it("counts two levels of ONE variable as one thing to say", () => {
    /*
     * The case the collapse exists for. Fast and slow are two levels of how long the player took;
     * when one separates, the other frequently separates as its mirror, and a record that says
     * "and 1 more" there is printing the same overcount the panel used to.
     */
    const sameVariable = {
      ...pattern,
      key: "slow-over-2m",
      scope: "החלטות אחרי יותר משתי דקות",
      gapDifference: -0.4,
      inside: { ...pattern.inside, n: 31 },
    };
    const selection = selectClaim([pattern, sameVariable], { created_at: now });
    expect(selection?.claim.scope).toBe(pattern.scope);
    expect(selection?.othersWithheld, "a mirror was counted as a second finding").toBe(0);
  });

  it("counts a genuinely separate variable as a second thing to say", () => {
    // A phase finding beside a time finding is two findings, and withholding one is the rule
    // this block has always been about.
    const otherVariable = {
      ...pattern,
      key: "phase-endgame",
      scope: "החלטות בסיום",
      inside: { ...pattern.inside, n: 31 },
    };
    const selection = selectClaim([pattern, otherVariable], { created_at: now });
    expect(selection?.othersWithheld).toBe(1);
  });

  it("shows the level that is furthest out, not the one with the most decisions", () => {
    /*
     * `detect` sorts by support; among levels of one variable that names whichever level the
     * record happens to contain most of. Measured on simulated players, taking the largest level
     * stored a claim about a phase they were FINE in one time in seven.
     */
    const larger = {
      ...pattern,
      key: "slow-over-2m",
      scope: "החלטות אחרי יותר משתי דקות",
      inside: { ...pattern.inside, n: 200 },
      gapDifference: -0.1,
      standardError: 0.09,
    };
    const selection = selectClaim([larger, pattern], { created_at: now });
    expect(selection?.claim.scope).toBe(pattern.scope);
  });

  it("returns nothing when there is nothing to say", () => {
    expect(selectClaim([], { created_at: now })).toBeNull();
  });
});
