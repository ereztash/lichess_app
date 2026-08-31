/**
 * `evaluateRefutation` returns `standardError: null` when the comparison could not be made at all
 * — fewer than two decisions on a side, or no variation on either. Its own comment says what that
 * means: "A drill that cannot produce a standard error has not observed anything, in either
 * direction. It must not read as a confirmation."
 *
 * It was not read as a confirmation. It was read as a REFUTATION, which is worse, because
 * refutation is terminal: `applyDrillResult` reads `observed: false` as `survived === false` and
 * writes `refuted`, `shared/claim.ts` will not revive it, `saveDrillResult` is append-only, and
 * `beginDrill` then refuses to test that claim ever again.
 *
 * `gapDifferenceStandardError` HAS FOUR CALLERS AND THIS WAS THE ONLY ONE THAT DID THIS:
 *
 *     shared/stability.ts   null -> readable: false
 *     shared/crossing.ts    null -> silence: "too-few"
 *     shared/detector.ts    null -> skip the bucket
 *     shared/drill.ts       null -> observed: false  ==>  refuted, permanently
 *
 * Three of four treat null as unreadable. The fourth wrote a permanent grade from it.
 *
 * MEASURED BEFORE THE FIX, five decisions with no variation at all:
 *
 *     verdict {"observed":false,"drillGap":-0.2,"gapDifference":-0.3,"standardError":null,"n":5}
 *     GRADE AFTER A DRILL THAT MEASURED NOTHING: refuted
 *     AFTER a later drill that genuinely confirms it: refuted
 *
 * That last line is why this is a guard and not a nicer sentence. A claim killed by a measurement
 * that never happened cannot be revived by one that did.
 */
import { describe, expect, it } from "vitest";
import { evaluateRefutation } from "../../shared/drill";
import { evaluateClaim, type Claim, type ProspectiveDrillResult } from "../../shared/claim";
import { MemoryRecordStore } from "../../server/record";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import * as service from "../../shared/record-service";

/** Five decisions that are identical to each other: no variation, so no standard error. */
const IDENTICAL = Array.from({ length: 5 }, (_, i) => ({
  decision_id: `d${i}`,
  confidence: 0.8,
  accurate: true,
}));

describe("a verdict with no standard error is not a verdict", () => {
  it("produces observed:false, which the grade fold reads as a refutation", () => {
    // The mechanism, isolated. This is the state the guard exists to intercept.
    const verdict = evaluateRefutation(IDENTICAL, {
      baseline: { gap: 0.1, gapVariance: 0, n: 40 },
      predictsOverconfidence: true,
      separabilityK: 3.25,
    });
    expect(verdict.standardError, "the drill measured nothing").toBeNull();
    expect(verdict.observed).toBe(false);
  });

  it("is terminal: a later drill that genuinely confirms the claim cannot revive it", () => {
    /*
     * The payoff, and the reason the fix is a refusal rather than a softer sentence. Everything
     * else in this file would be survivable if the grade could be corrected later. It cannot.
     */
    const claim: Claim = {
      claim_id: "claim-phase-endgame",
      statement: "s",
      scope: "החלטות בסיום",
      supporting_decision_ids: [],
      n: 30,
      grade: "hypothesis",
      refutation_condition: "r",
      predicts_overconfidence: true,
      graded_under: null,
      prospective_tests: [],
      created_at: "2026-01-01T00:00:00.000Z",
      last_evaluated_at: "2026-01-01T00:00:00.000Z",
    };
    const fromNothing: ProspectiveDrillResult = {
      kind: "prospective_drill_result",
      protocol: "position-drill",
      drill_id: "measured-nothing",
      claim_id: claim.claim_id,
      decision_ids: IDENTICAL.map((d) => d.decision_id),
      predicted: true,
      observed: false,
      recorded_at: "2026-02-01T00:00:00.000Z",
    };
    const later: ProspectiveDrillResult = {
      ...fromNothing,
      drill_id: "measured-something",
      observed: true,
      recorded_at: "2026-03-01T00:00:00.000Z",
    };
    expect(evaluateClaim(claim, [fromNothing]).grade).toBe("refuted");
    expect(
      evaluateClaim(claim, [fromNothing, later]).grade,
      "a real confirmation cannot undo a refutation written from a non-measurement",
    ).toBe("refuted");
  });
});

describe("finishDrill refuses rather than grading what it could not measure", () => {
  const FRESH = [
    "8/8/8/4k3/8/4K3/4P3/8 w - - 0 40",
    "8/8/8/4k3/8/4K3/4P3/8 b - - 0 41",
    "8/8/4k3/8/8/4K3/4P3/8 w - - 0 42",
    "8/8/4k3/8/4P3/4K3/8/8 b - - 0 43",
    "8/8/4k3/4P3/8/4K3/8/8 w - - 0 44",
    "8/4k3/8/4P3/8/4K3/8/8 b - - 0 45",
    "8/4k3/4P3/8/8/4K3/8/8 w - - 0 46",
    "4k3/8/4P3/8/8/4K3/8/8 b - - 0 47",
  ];

  const CLAIM: Claim = {
    claim_id: "claim-phase-endgame",
    statement: "ב-החלטות בסיום הביטחון המוצהר גבוה יותר ביחס לדיוק בפועל מאשר בשאר ההחלטות",
    scope: "החלטות בסיום",
    supporting_decision_ids: [],
    n: 30,
    grade: "hypothesis",
    refutation_condition: "בדריל של עמדות מ-החלטות בסיום … — ההשערה הופרכה.",
    predicts_overconfidence: true,
    graded_under: null,
    prospective_tests: [],
    created_at: "2026-01-01T00:00:00.000Z",
    last_evaluated_at: "2026-01-01T00:00:00.000Z",
  };

  async function drilledWithNoVariation() {
    const store = new MemoryRecordStore();
    await store.saveClaim(CLAIM);
    const begun = await service.beginDrill(
      store,
      { claim_id: CLAIM.claim_id, candidate_fens: FRESH },
      { drill_id: "drill-no-variation", started_at: "2026-03-01T09:00:00.000Z" },
    );
    const ids: string[] = [];
    for (const [i, fen] of begun.drill!.fens.entries()) {
      const id = `flat-${i}`;
      ids.push(id);
      // Every decision identical: same confidence, same outcome. No variation anywhere.
      await store.commitDecision({
        decisionId: id,
        gameId: "g",
        fen,
        ply: 80,
        phase: "endgame",
        clockMsRemaining: 120_000,
        purpose: "play",
        drillId: null,
        secondsTaken: 30,
        chosenMove: "e2e4",
        candidateMovesConsidered: ["e2e4"],
        statedRead: "r",
        statedUnknown: "u",
        confidence: CONFIDENCE_LEVELS - 1,
        confidenceScale: CONFIDENCE_LEVELS,
        probeAssignment: "not-probed",
        legalMoves: 12,
        revealTiming: "per-decision",
        measurementProtocol: null,
        protocolVersion: null,
        analysisTiming: null,
      });
      await store.recordReveal(id, {
        engine_eval_cp: 10,
        engine_best_move: "e2e4",
        engine_depth: 18,
        engine_source: "local_sf18",
        engine_build: "sf18-test-build",
        cp_loss: 5,
      });
    }
    return { store, ids };
  }

  it("refuses, and says the drill could not be measured", async () => {
    const { store, ids } = await drilledWithNoVariation();
    await expect(
      service.finishDrill(
        store,
        { drill_id: "drill-no-variation", decision_ids: ids },
        { recorded_at: "2026-03-01T10:00:00.000Z" },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("leaves the claim a hypothesis, and writes no result at all", async () => {
    // The point of refusing rather than recording: nothing terminal reaches the record, so the
    // player can drill again. `saveDrillResult` is append-only; a row here would be forever.
    const { store, ids } = await drilledWithNoVariation();
    await service
      .finishDrill(
        store,
        { drill_id: "drill-no-variation", decision_ids: ids },
        { recorded_at: "2026-03-01T10:00:00.000Z" },
      )
      .catch(() => undefined);
    const after = await store.getClaim(CLAIM.claim_id);
    expect(after?.grade).toBe("hypothesis");
    expect(after?.prospective_tests, "a result row would be permanent").toHaveLength(0);
  });
});
