/**
 * ADR-003, RESOLVED: a forward test carries the protocol it ran under, and a protocol the claim
 * does not require may speak about it but never close it.
 *
 * The old rule let a clockless drill do the one thing that cannot be undone -- `refuted` is
 * terminal and `beginDrill` refuses a refuted claim forever. So a claim about deciding under time
 * pressure could be killed permanently by a test with no clock in it. Nothing here withdraws the
 * drill: it still runs, its result is still stored, and it still moves the grade. What it can no
 * longer do is end the question.
 */
import { describe, expect, it } from "vitest";
import { deriveClaim } from "../../shared/claim-derivation";
import {
  awaitingProtocol,
  evaluateClaim,
  gradeIsSettled,
  testedUnder,
  type ProspectiveDrillResult,
} from "../../shared/claim";
import { decidesClaim, LEGACY_VALIDATION } from "../../shared/claim-grade-protocol";
import {
  completeDrill,
  completeDrillAgainstBaseline,
  createDrill,
  startDrill,
} from "../../shared/drill";
import type { CandidatePattern } from "../../shared/detector";
import { MemoryRecordStore } from "../../server/record";

const claimFor = (key: string) => {
  const pattern: CandidatePattern = {
    key,
    scope: `decisions in ${key}`,
    inside: { n: 42, meanConfidence: 0.8, accuracyRate: 0.24, gap: 0.56, gapVariance: 0.18 },
    outside: { n: 61, meanConfidence: 0.5, accuracyRate: 0.47, gap: 0.03, gapVariance: 0.21 },
    gapDifference: 0.53,
    standardError: 0.0973,
    supporting_decision_ids: Array.from({ length: 42 }, (_, i) => `d${i}`),
    predicts_overconfidence: true,
  };
  return deriveClaim(pattern, { claim_id: `claim-${key}`, created_at: "2026-08-30T00:00:00Z" });
};

const test_ = (
  claimId: string,
  over: Partial<ProspectiveDrillResult> & { protocol: ProspectiveDrillResult["protocol"] },
): ProspectiveDrillResult => ({
  kind: "prospective_drill_result",
  drill_id: "t1",
  claim_id: claimId,
  decision_ids: ["x1", "x2"],
  predicted: true,
  observed: true,
  recorded_at: "2026-08-31T00:00:00Z",
  ...over,
});

describe("a verdict only its own protocol may close", () => {
  describe("a claim about a board, which a drill can reproduce", () => {
    const claim = claimFor("phase-endgame");

    it("is settled by the drill, exactly as it always was", () => {
      const graded = evaluateClaim(claim, [test_(claim.claim_id, { protocol: "position-drill" })]);
      expect(graded.grade).toBe("replicated");
      expect(gradeIsSettled(graded)).toBe(true);
      expect(awaitingProtocol(graded)).toBeNull();
    });

    it("stays refuted forever when the drill contradicted it", () => {
      const graded = evaluateClaim(claim, [
        test_(claim.claim_id, { protocol: "position-drill", observed: false }),
        test_(claim.claim_id, {
          protocol: "position-drill",
          drill_id: "t2",
          recorded_at: "2026-09-01T00:00:00Z",
        }),
      ]);
      expect(graded.grade).toBe("refuted");
    });
  });

  describe("a claim about a clock, which a drill removes", () => {
    const claim = claimFor("fast-under-45s");

    it("is graded by the drill but not settled by it", () => {
      const graded = evaluateClaim(claim, [test_(claim.claim_id, { protocol: "position-drill" })]);
      // The result is not discarded. The drill ran, and what it saw is on the record.
      expect(graded.grade).toBe("replicated");
      expect(graded.prospective_tests).toHaveLength(1);
      // What changed is that the question is still open, and the card says which test would close it.
      expect(gradeIsSettled(graded)).toBe(false);
      expect(testedUnder(graded)).toBe("position-drill");
      expect(awaitingProtocol(graded)).toBe("timed-holdout");
    });

    it("is NOT killed permanently by a drill that contradicted it", () => {
      /*
       * THE WHOLE POINT. Under the old rule this sequence ended at `refuted`, terminally, and
       * `beginDrill` would refuse the claim from then on -- a question about playing under a clock
       * closed forever by a test with no clock in it.
       */
      const graded = evaluateClaim(claim, [
        test_(claim.claim_id, { protocol: "position-drill", observed: false }),
        test_(claim.claim_id, {
          protocol: "timed-holdout",
          drill_id: "t2",
          recorded_at: "2026-09-01T00:00:00Z",
        }),
      ]);
      expect(graded.grade).toBe("replicated");
      expect(gradeIsSettled(graded)).toBe(true);
    });

    it("keeps the holdout's SURVIVING verdict when a later drill contradicts it", () => {
      /*
       * THE CASE THE FIRST VERSION OF THIS FILE MISSED, found by a mutation that stayed green.
       * Deleting the guard against an off-protocol result overwriting an on-protocol one changed
       * nothing, because every sequence tested here stood at `refuted` -- where the terminal branch
       * returns first and the guard is unreachable. It is live only when the standing grade is
       * `replicated`, which is exactly this sequence: the holdout measured the claim under the
       * conditions it is about and it held; a later clockless drill has not, and must not be the
       * one on screen.
       */
      const graded = evaluateClaim(claim, [
        test_(claim.claim_id, { protocol: "timed-holdout" }),
        test_(claim.claim_id, {
          protocol: "position-drill",
          drill_id: "t2",
          recorded_at: "2026-09-01T00:00:00Z",
          observed: false,
        }),
      ]);
      expect(graded.grade).toBe("replicated");
      expect(graded.graded_under).toBe("timed-holdout");
      expect(gradeIsSettled(graded)).toBe(true);
      expect(graded.prospective_tests).toHaveLength(2);
    });

    it("is closed by the holdout, and a later drill cannot reopen or overturn it", () => {
      const graded = evaluateClaim(claim, [
        test_(claim.claim_id, { protocol: "timed-holdout", observed: false }),
        test_(claim.claim_id, {
          protocol: "position-drill",
          drill_id: "t2",
          recorded_at: "2026-09-01T00:00:00Z",
        }),
      ]);
      // The holdout measured it under the conditions the claim is about; the drill did not.
      expect(graded.grade).toBe("refuted");
      expect(graded.prospective_tests).toHaveLength(2);
    });
  });

  describe("where the tag comes from, which is the one input the whole mechanism has", () => {
    /*
     * FOUND BY A MUTATION THAT STAYED GREEN. Retagging every result `shared/drill.ts` builds as a
     * timed holdout left all 2,123 tests passing: nothing anywhere asserted what protocol the drill
     * module stamps on its own output. That single string is where this mechanism gets its input,
     * and if it were wrong every clockless drill would claim to be a holdout and would SETTLE clock
     * claims -- the exact defect ADR-003 exists to remove, reintroduced with nothing going red.
     */
    const claim = claimFor("fast-under-45s");
    const started = startDrill(
      createDrill(claim, ["8/8/8/4k3/8/8/4K3/8 w - - 0 1"], { drill_id: "d-tag" }),
      { predicted: true, started_at: "2026-08-31T00:00:00Z" },
    );

    it("stamps a position drill on a majority-closed result", () => {
      const result = completeDrill(
        started,
        [{ decision_id: "x1", matchedPrediction: true }],
        { recorded_at: "2026-08-31T00:10:00Z" },
      );
      expect(result.protocol).toBe("position-drill");
    });

    it("stamps a position drill on a baseline-closed result, which is the shipped path", () => {
      const result = completeDrillAgainstBaseline(
        started,
        [{ decision_id: "x1", confidence: 0.8, accurate: false }],
        { observed: true, drillGap: 0.6, baselineGap: 0.2, gapDifference: 0.4, standardError: 0.1, n: 1 },
        { recorded_at: "2026-08-31T00:10:00Z" },
      );
      expect(result.protocol).toBe("position-drill");
    });

    it("so a clock claim run through the real drill module comes back unsettled", () => {
      const result = completeDrillAgainstBaseline(
        started,
        [{ decision_id: "x1", confidence: 0.8, accurate: false }],
        { observed: true, drillGap: 0.6, baselineGap: 0.2, gapDifference: 0.4, standardError: 0.1, n: 1 },
        { recorded_at: "2026-08-31T00:10:00Z" },
      );
      const graded = evaluateClaim(claim, [result]);
      expect(gradeIsSettled(graded)).toBe(false);
      expect(awaitingProtocol(graded)).toBe("timed-holdout");
    });
  });

  describe("what must not change underneath claims that already exist", () => {
    it("lets a legacy result go on deciding, so nothing settled comes unsettled", () => {
      const claim = claimFor("fast-under-45s");
      const graded = evaluateClaim(claim, [
        test_(claim.claim_id, { protocol: LEGACY_VALIDATION, observed: false }),
      ]);
      expect(graded.grade).toBe("refuted");
      expect(gradeIsSettled(graded)).toBe(true);
      // ...and it is never printed as though it were a protocol.
      expect(testedUnder(graded)).toBeNull();
    });

    it("grades a bucket nobody classified by the old rule rather than never closing it", () => {
      /*
       * `protocolFor` returns null here, and reading that as "nothing may decide this" makes the
       * claim flip between replicated and refuted with every drill, forever. ADR-003 narrows
       * authority only where a protocol is KNOWN to remove the condition.
       */
      expect(decidesClaim("position-drill", "claim-a-bucket-nobody-classified")).toBe(true);
      const claim = claimFor("a-bucket-nobody-classified");
      const graded = evaluateClaim(claim, [
        test_(claim.claim_id, { protocol: "position-drill", observed: false }),
        test_(claim.claim_id, {
          protocol: "position-drill",
          drill_id: "t2",
          recorded_at: "2026-09-01T00:00:00Z",
        }),
      ]);
      expect(graded.grade).toBe("refuted");
    });

    it("reads a graded row with no protocol the same way in memory as in MySQL", async () => {
      /*
       * The two stores disagreeing on this was a real defect during the change: MySQL mapped a
       * graded row with a null column to LEGACY_VALIDATION and memory returned the null, so
       * `gradeIsSettled` answered differently depending on which store the caller was on. Every
       * test here but the database ones runs against memory, so it would have hidden in the
       * direction that matters.
       */
      const store = new MemoryRecordStore();
      const claim = claimFor("fast-under-45s");
      await store.saveClaim({ ...claim, grade: "refuted", graded_under: null });
      const read = await store.getClaim(claim.claim_id);
      expect(read?.graded_under).toBe(LEGACY_VALIDATION);
      expect(gradeIsSettled(read!)).toBe(true);
    });

    it("leaves a hypothesis with no protocol at all rather than inventing one", async () => {
      const store = new MemoryRecordStore();
      const claim = claimFor("fast-under-45s");
      await store.saveClaim(claim);
      const read = await store.getClaim(claim.claim_id);
      expect(read?.graded_under).toBeNull();
      expect(gradeIsSettled(read!)).toBe(false);
      expect(awaitingProtocol(read!)).toBeNull();
    });
  });
});
