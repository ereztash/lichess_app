/**
 * A claim names a DIRECTION, and the verdict is a one-sided test. Nothing carried the sign.
 *
 * `detect` measures `predicts_overconfidence: gapDifference > 0` (shared/detector.ts). Two
 * functions in claim-derivation.ts read it -- one to write "higher than the results justify" or
 * "lower", one to write the matching refutation condition -- and then the boolean went out of
 * scope. `Claim` had no field for it and the `claims` table had no column, so `finishDrill` had
 * nothing to read and passed a constant:
 *
 *     predictsOverconfidence: true,
 *
 * into `evaluateRefutation`, whose entire grading rule is
 *
 *     const directional = options.predictsOverconfidence ? gapDifference : -gapDifference;
 *     observed: standardError !== null && directional >= options.separabilityK * standardError
 *
 * So every UNDERconfidence claim was graded by whether the player turned out OVERconfident. A
 * player who behaved exactly as the claim described produced `observed: false`, which
 * `applyDrillResult` reads as `survived === false`, which is `refuted` -- terminal, kept forever
 * by design, and `beginDrill` refuses the claim from then on.
 *
 * NO FAULT IS NEEDED TO REACH IT. Not a lost write, not a retry, not a second tab. It fired on
 * the ordinary path every time the selected claim pointed that way, and shared/bucket-variable.ts
 * records that as the COMMON direction rather than the rare one: of the 78 mirror claims that
 * file measured, 78 out of 78 were underconfidence.
 *
 * MEASURED BEFORE IT WAS FIXED, through the real service against the real store -- the transcript
 * below is the pre-fix run of the first test in this file:
 *
 *     STATEMENT: ...הביטחון שלך נמוך יותר ממה שהתוצאות מצדיקות...
 *     VERDICT:  {"observed":false,"drillGap":-0.6375,"baselineGap":-0.0667,
 *                "gapDifference":-0.5708,"standardError":0.1357,"n":8}
 *     GRADE AFTER DRILL: refuted
 *
 * Eight fresh positions, 4.2 standard errors in the direction the claim named, reported as a
 * refutation.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "../../shared/confidence";
import { evaluateRefutation, MissingClaimDirection, createDrill } from "../../shared/drill";
import type { Claim } from "../../shared/claim";
import * as service from "../../shared/record-service";

const PLAYED = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 3",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
  "r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 6",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 7",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 8",
];

/** Endgames the player has never decided on, so they are legal drill positions. */
const FRESH = [
  "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
  "8/8/8/4k3/8/4K3/4P3/8 b - - 0 2",
  "8/8/4k3/8/8/4K3/4P3/8 w - - 0 3",
  "8/8/4k3/8/4P3/4K3/8/8 b - - 0 4",
  "8/8/4k3/4P3/8/4K3/8/8 w - - 0 5",
  "8/4k3/8/4P3/8/4K3/8/8 b - - 0 6",
  "8/4k3/4P3/8/8/4K3/8/8 w - - 0 7",
  "4k3/8/4P3/8/8/4K3/8/8 b - - 0 8",
];

async function record(
  store: MemoryRecordStore,
  id: string,
  fen: string,
  o: {
    confidence: number;
    cpLoss: number;
    phase: "opening" | "middlegame" | "endgame";
  },
) {
  await store.commitDecision({
    decisionId: id,
    gameId: "direction-fixture",
    fen,
    ply: 0,
    phase: o.phase,
    clockMsRemaining: 120_000,
    purpose: "play",
    drillId: null,
    transferId: null,
    secondsTaken: 60,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4"],
    statedRead: "המרכז פתוח",
    statedUnknown: "לא ברור מה השחור מאיים",
    confidence: o.confidence,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 20,
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
    cp_loss: o.cpLoss,
  });
}

/**
 * A record whose ENDGAME decisions are underconfident -- low stated confidence, high accuracy --
 * against calibrated play everywhere else. `detect` reads that as `gapDifference < 0`, which is
 * `predicts_overconfidence: false`, which is the half of the space the constant got wrong.
 *
 * The variation inside each group is deliberate: a bucket whose members share one confidence and
 * one outcome has a sample variance of exactly zero, and the detector refuses that.
 */
async function underconfidentInTheEndgame(store: MemoryRecordStore) {
  for (let i = 0; i < 30; i += 1) {
    await record(store, `end-${i}`, PLAYED[i % PLAYED.length], {
      phase: "endgame",
      confidence: i % 10 === 0 ? EVEN_ODDS_LEVEL : 2,
      cpLoss: i % 9 === 0 ? 200 : 5,
    });
  }
  for (let i = 0; i < 60; i += 1) {
    await record(store, `rest-${i}`, PLAYED[i % PLAYED.length], {
      phase: i % 2 === 0 ? "middlegame" : "opening",
      confidence: i % 3 === 0 ? EVEN_ODDS_LEVEL : CONFIDENCE_LEVELS - 2,
      cpLoss: i % 3 === 0 ? 200 : 5,
    });
  }
}

/** Eight fresh endgames played the way the claim says this player plays endgames. */
async function drillAsTheClaimPredicts(store: MemoryRecordStore, fens: string[]) {
  const ids: string[] = [];
  for (const [i, fen] of fens.entries()) {
    const id = `drill-d-${i}`;
    ids.push(id);
    await record(store, id, fen, {
      phase: "endgame",
      confidence: i === 2 ? EVEN_ODDS_LEVEL : 2,
      cpLoss: i === 5 ? 200 : 5,
    });
  }
  return ids;
}

describe("a drill grades the claim in the direction the claim named", () => {
  it("does not refute an underconfidence claim with a player who is underconfident", async () => {
    const store = new MemoryRecordStore();
    await underconfidentInTheEndgame(store);

    const view = await service.currentClaim(store, { created_at: "2026-03-01T00:00:00.000Z" });
    // The fixture has to produce the direction this test is about, or it tests the other half.
    expect(view.claim, view.reason ?? "no claim").not.toBeNull();
    expect(view.claim!.statement, "fixture must yield an UNDERconfidence claim").toContain(
      "נמוך יותר",
    );
    expect(view.claim!.predicts_overconfidence).toBe(false);

    const begun = await service.beginDrill(
      store,
      { claim_id: view.claim!.claim_id, candidate_fens: FRESH },
      { drill_id: "drill-direction", started_at: "2026-03-01T09:00:00.000Z" },
    );
    expect(begun.drill, begun.reason ?? "no drill").not.toBeNull();
    // R5: the sign is written down with the sentence, before a position is shown.
    expect(begun.drill!.predicts_overconfidence).toBe(false);

    const ids = await drillAsTheClaimPredicts(store, begun.drill!.fens);
    const done = await service.finishDrill(
      store,
      { drill_id: "drill-direction", decision_ids: ids },
      { recorded_at: "2026-03-01T10:00:00.000Z" },
    );

    // The evidence points the way the claim said, by several standard errors.
    expect(done.verdict!.gapDifference).toBeLessThan(0);
    expect(done.verdict!.gapDifference).toBeLessThan(-done.verdict!.standardError! * 2);
    // So the claim survives its forward test. It must not read as refuted.
    expect(done.verdict!.observed).toBe(true);
    expect(done.claim.grade).not.toBe("refuted");
    expect(done.claim.grade).toBe("replicated");
  });

  it("still refutes an underconfidence claim when the player is not underconfident", async () => {
    /*
     * The other side of the same fix, and the reason it is not "make drills pass". A claim that
     * fails its forward test must still be refuted -- otherwise the sign would have been fixed by
     * removing the test rather than by correcting it.
     */
    const store = new MemoryRecordStore();
    await underconfidentInTheEndgame(store);
    const view = await service.currentClaim(store, { created_at: "2026-03-01T00:00:00.000Z" });
    expect(view.claim!.predicts_overconfidence).toBe(false);

    const begun = await service.beginDrill(
      store,
      { claim_id: view.claim!.claim_id, candidate_fens: FRESH },
      { drill_id: "drill-contradicts", started_at: "2026-03-01T09:00:00.000Z" },
    );
    // Confident and wrong: the opposite of what the claim predicts about this player.
    const ids: string[] = [];
    for (const [i, fen] of begun.drill!.fens.entries()) {
      const id = `contra-${i}`;
      ids.push(id);
      await record(store, id, fen, {
        phase: "endgame",
        confidence: i === 3 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS,
        cpLoss: i === 6 ? 5 : 300,
      });
    }
    const done = await service.finishDrill(
      store,
      { drill_id: "drill-contradicts", decision_ids: ids },
      { recorded_at: "2026-03-01T10:00:00.000Z" },
    );
    expect(done.verdict!.observed).toBe(false);
    expect(done.claim.grade).toBe("refuted");
  });

  it("is the flag alone that decides it, on identical numbers", async () => {
    /*
     * The mechanism, isolated from the pipeline: one set of decisions, one baseline, two signs.
     * Every reported number is the same; only `observed` moves. That is why a constant here was
     * not a small inaccuracy -- it is the whole verdict.
     */
    const decisions = FRESH.map((_, i) => ({
      decision_id: `d-${i}`,
      confidence: i === 2 ? 0.5 : 0.166,
      accurate: i !== 5,
    }));
    const baseline = { gap: -0.0667, gapVariance: 0.19, n: 60 };
    const asOver = evaluateRefutation(decisions, {
      baseline,
      predictsOverconfidence: true,
      separabilityK: 1,
    });
    const asUnder = evaluateRefutation(decisions, {
      baseline,
      predictsOverconfidence: false,
      separabilityK: 1,
    });
    expect(asOver.gapDifference).toBe(asUnder.gapDifference);
    expect(asOver.standardError).toBe(asUnder.standardError);
    expect(asOver.observed).toBe(false);
    expect(asUnder.observed).toBe(true);
  });
});

describe("a claim that never recorded its direction", () => {
  const legacy: Claim = {
    claim_id: "claim-phase-endgame",
    statement: "ב-החלטות בסיום הביטחון שלך נמוך יותר ממה שהתוצאות מצדיקות",
    scope: "החלטות בסיום",
    supporting_decision_ids: [],
    n: 30,
    grade: "hypothesis",
    refutation_condition: "אם הביטחון לא יהיה נמוך מהדיוק יותר מאשר בשאר ההחלטות — ההשערה הופרכה.",
    predicts_overconfidence: null,
    graded_under: null,
    prospective_tests: [],
    created_at: "2026-01-01T00:00:00.000Z",
    last_evaluated_at: "2026-01-01T00:00:00.000Z",
  };

  it("cannot be drilled, rather than being drilled on a guessed direction", () => {
    /*
     * The remedy for a missing sign is NOT to pick one. Re-deriving it from the record as it
     * stands today would let the evidence choose which way its own test points, which is the
     * post-hoc choice R5 exists to forbid; reading it back out of the Hebrew statement would
     * rebuild the prose-carries-the-fact coupling that caused this in the first place. So the
     * drill is refused and the claim keeps whatever grade it has.
     */
    expect(() => createDrill(legacy, FRESH.slice(0, 5), { drill_id: "d" })).toThrow(
      MissingClaimDirection,
    );
  });

  it("refuses through the service, without changing the claim's grade", async () => {
    const store = new MemoryRecordStore();
    await store.saveClaim(legacy);
    await underconfidentInTheEndgame(store);
    await expect(
      service.beginDrill(
        store,
        { claim_id: legacy.claim_id, candidate_fens: FRESH },
        { drill_id: "drill-legacy", started_at: "2026-03-01T09:00:00.000Z" },
      ),
    ).rejects.toThrow(MissingClaimDirection);
    expect((await store.getClaim(legacy.claim_id))?.grade).toBe("hypothesis");
  });
});
