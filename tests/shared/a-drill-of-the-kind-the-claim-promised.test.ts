/**
 * The claim's refutation condition promises "בדריל של עמדות מ-{scope}". Nothing enforced it.
 *
 * `Home.tsx` offers every position of the loaded game, in ply order, and `selectDrillPositions`
 * took the first fresh ones -- which are the game's opening. So the scope was decided by what a
 * PGN happens to start with rather than by what the claim is about.
 *
 * MEASURED BEFORE THE FIX, through the real service, on a record whose endgame decisions carry
 * the pattern:
 *
 *     CLAIM:   claim-phase-endgame
 *     PROMISE: בדריל של עמדות מ-החלטות בסיום, ...
 *     DRILL BUILT: true   reason: null
 *     PHASES OF THE DRILL POSITIONS: opening, opening, opening, opening,
 *                                    opening, opening, opening, opening
 *
 * And it is not merely off-topic. `finishDrill` builds the baseline by EXCLUDING the claim's own
 * bucket, so the verdict compared opening play against middlegame play and settled a question
 * about the endgame -- terminally, since a `refuted` claim is kept forever and `beginDrill`
 * refuses to test it again.
 *
 * THE SECOND HALF IS THE ONE WITH NO POSITIONS TO PICK, AND IT IS ENFORCED SOMEWHERE ELSE. Three
 * of the six buckets are properties of a position and three are properties of the decision event
 * -- how long the player took, what the clock said. No choice of positions puts a player under
 * time pressure, so selection cannot decide those. The DRILL decides them, and `finishDrill`
 * checks them there, against the same predicate that defines the bucket.
 *
 * REFUSING THEM AT `beginDrill` WAS TRIED FIRST AND WAS WRONG, which is worth recording because
 * it looked more principled than it was. `tests/server/drill-route.test.ts` drills a
 * `fast-under-45s` claim with 12-second decisions -- a genuine test of that claim -- and the
 * refusal broke it. A capability that works is not made honest by withdrawing it; the four
 * failures were the suite saying so.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "../../shared/confidence";
import { BUCKETINGS } from "../../shared/detector";
import { classifyPhase } from "../../shared/phase";
import { plyFromFen } from "../../shared/position-key";
import type { Claim } from "../../shared/claim";
import * as service from "../../shared/record-service";

/** Fresh opening positions: what a loaded game hands over first, in ply order. */
const FRESH_OPENING = [
  "rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
  "rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 3",
  "rnbqkb1r/pppp1ppp/5n2/4p3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 4",
  "rnbqkb1r/pppp1ppp/5n2/4P3/4P3/8/PPP2PPP/RNBQKBNR b KQkq - 0 5",
  "rnbqkb1r/pppp1ppp/8/4P3/4Pn2/8/PPP2PPP/RNBQKBNR w KQkq - 0 6",
  "rnbqkb1r/pppp1ppp/8/4P3/4Pn2/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 7",
  "rnbqkb1r/ppp2ppp/3p4/4P3/4Pn2/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 8",
  "rnbqkb1r/ppp2ppp/3P4/8/4Pn2/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 9",
];

/** Fresh endgame positions: bare kings and pawns, so the material rule classifies them endgame. */
const FRESH_ENDGAME = [
  "8/8/8/4k3/8/4K3/4P3/8 w - - 0 40",
  "8/8/8/4k3/8/4K3/4P3/8 b - - 0 41",
  "8/8/4k3/8/8/4K3/4P3/8 w - - 0 42",
  "8/8/4k3/8/4P3/4K3/8/8 b - - 0 43",
  "8/8/4k3/4P3/8/4K3/8/8 w - - 0 44",
  "8/4k3/8/4P3/8/4K3/8/8 b - - 0 45",
  "8/4k3/4P3/8/8/4K3/8/8 w - - 0 46",
  "4k3/8/4P3/8/8/4K3/8/8 b - - 0 47",
];

function claimFor(key: string, scope: string): Claim {
  return {
    claim_id: `claim-${key}`,
    statement: `ב-${scope} הביטחון שלך גבוה יותר ממה שהתוצאות מצדיקות`,
    scope,
    supporting_decision_ids: [],
    n: 30,
    grade: "hypothesis",
    refutation_condition: `בדריל של עמדות מ-${scope}, אם הפער לא יהיה גדול יותר — ההשערה הופרכה.`,
    predicts_overconfidence: true,
    prospective_tests: [],
    created_at: "2026-01-01T00:00:00.000Z",
    last_evaluated_at: "2026-01-01T00:00:00.000Z",
  };
}

const ENDGAME_CLAIM = claimFor("phase-endgame", "החלטות בסיום");
const FAST_CLAIM = claimFor("fast-under-45s", "החלטות תחת פחות מ-45 שניות");

/**
 * A claim, and a RECORD FOR IT TO BE COMPARED AGAINST.
 *
 * This used to return a store holding nothing but the claim. Every drill run against it was
 * therefore measured against an empty baseline: `summarise([])` has zero variance, so
 * `gapDifferenceStandardError` returned null and the verdict carried no standard error at all.
 * The two tests below still asserted a verdict, and got one, because `evaluateRefutation` used to
 * hand back `observed: false` in that case — which `applyDrillResult` writes as `refuted`.
 *
 * `finishDrill` now refuses to grade a drill it could not measure
 * (tests/shared/a-drill-that-measured-nothing.test.ts), and that refusal is what exposed this: the
 * fixture was proving that an in-scope drill produces a verdict by producing one from a
 * comparison against nothing. The principle is unchanged and the baseline is now real.
 *
 * Out-of-bucket by construction — middlegame decisions at a slow pace — so it never contaminates
 * the claim's own bucket, and varied on both axes so it has a variance to contribute.
 */
async function withClaim(claim: Claim) {
  const store = new MemoryRecordStore();
  await store.saveClaim(claim);
  for (let i = 0; i < 40; i += 1) {
    await decide(store, `base-${i}`, PLAYED_BASELINE[i % PLAYED_BASELINE.length], {
      secondsTaken: 200,
      confidence: i % 3 === 0 ? EVEN_ODDS_LEVEL : CONFIDENCE_LEVELS - 2,
      cpLoss: i % 4 === 0 ? 300 : 5,
    });
  }
  return store;
}

/**
 * Boards for the baseline. `decide` derives the phase from the board, and these carry full
 * material at plies 12-19 — so they classify as opening, which is outside `phase-endgame`; and
 * they are decided at 200 seconds, which is outside `fast-under-45s`. Outside both claims either
 * way, which is what `finishDrill` requires of a baseline.
 */
const PLAYED_BASELINE = [
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 7",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 8",
  "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQ - 0 9",
  "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b - - 0 10",
];

const begin = (store: MemoryRecordStore, claim: Claim, fens: string[]) =>
  service.beginDrill(
    store,
    { claim_id: claim.claim_id, candidate_fens: fens },
    { drill_id: `drill-${claim.claim_id}`, started_at: "2026-03-01T09:00:00.000Z" },
  );

describe("a drill for a phase claim is built from that phase", () => {
  it("refuses to build an endgame drill out of opening positions", async () => {
    const store = await withClaim(ENDGAME_CLAIM);
    const begun = await begin(store, ENDGAME_CLAIM, FRESH_OPENING);
    expect(begun.drill, "eight opening positions were accepted as an endgame drill").toBeNull();
    // ...and the reason says which kind is missing, not merely "not enough positions": the
    // player has plenty of positions, just none of the kind this claim is about.
    expect(begun.reason).toContain(ENDGAME_CLAIM.scope);
  });

  it("builds it from endgame positions, and every position is one", async () => {
    const store = await withClaim(ENDGAME_CLAIM);
    const begun = await begin(store, ENDGAME_CLAIM, FRESH_ENDGAME);
    expect(begun.drill, begun.reason ?? "no drill").not.toBeNull();
    for (const fen of begun.drill!.fens) {
      expect(classifyPhase(fen, plyFromFen(fen)), `${fen} is not an endgame position`).toBe(
        "endgame",
      );
    }
  });

  it("takes only the in-scope positions when a game carries both", async () => {
    // The realistic case: a full game, offered whole. Selection must not fall back to ply order.
    const store = await withClaim(ENDGAME_CLAIM);
    const begun = await begin(store, ENDGAME_CLAIM, [...FRESH_OPENING, ...FRESH_ENDGAME]);
    expect(begun.drill, begun.reason ?? "no drill").not.toBeNull();
    for (const fen of begun.drill!.fens) {
      expect(classifyPhase(fen, plyFromFen(fen))).toBe("endgame");
    }
  });
});

/** Commit and reveal one drill decision, at a chosen pace. */
async function decide(
  store: MemoryRecordStore,
  id: string,
  fen: string,
  o: { secondsTaken: number; confidence: number; cpLoss: number },
) {
  await store.commitDecision({
    decisionId: id,
    gameId: "g",
    fen,
    ply: plyFromFen(fen),
    phase: classifyPhase(fen, plyFromFen(fen)),
    clockMsRemaining: 600_000,
    secondsTaken: o.secondsTaken,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4"],
    statedRead: "r",
    statedUnknown: "u",
    confidence: o.confidence,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 12,
    revealTiming: "per-decision",
  });
  await store.recordReveal(id, {
    engine_eval_cp: 10,
    engine_best_move: "e2e4",
    engine_depth: 18,
    engine_source: "local_sf18",
    cp_loss: o.cpLoss,
  });
}

describe("a claim about how you decided, not about which positions", () => {
  it("runs the drill, because the drill is what decides whether it is in scope", async () => {
    // Positions cannot be selected for "under 45 seconds", and that is not a reason to refuse:
    // the player's pace during the drill settles it, and it is knowable when the drill closes.
    const store = await withClaim(FAST_CLAIM);
    const begun = await begin(store, FAST_CLAIM, [...FRESH_OPENING, ...FRESH_ENDGAME]);
    expect(begun.drill, begun.reason ?? "no drill").not.toBeNull();
  });

  it("produces no verdict when the drill's decisions fall outside the claim's scope", async () => {
    const store = await withClaim(FAST_CLAIM);
    const begun = await begin(store, FAST_CLAIM, FRESH_OPENING);
    const ids: string[] = [];
    for (const [i, fen] of begun.drill!.fens.entries()) {
      const id = `slow-${i}`;
      ids.push(id);
      // Four minutes a move. Whatever this measures, it is not decisions under 45 seconds.
      await decide(store, id, fen, {
        secondsTaken: 240,
        confidence: i === 3 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS,
        cpLoss: i === 6 ? 5 : 250,
      });
    }
    await expect(
      service.finishDrill(
        store,
        { drill_id: `drill-${FAST_CLAIM.claim_id}`, decision_ids: ids },
        { recorded_at: "2026-03-01T10:00:00.000Z" },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    // The claim is untouched: no verdict is the honest outcome, and `refuted` is terminal.
    expect((await store.getClaim(FAST_CLAIM.claim_id))?.grade).toBe("hypothesis");
  });

  it("replays a verdict already written, rather than refusing it under the new rule", async () => {
    /*
     * THE NEW GUARD MUST NOT REACH BACKWARDS. A drill graded before this rule existed has a
     * `drill_results` row, and that row is append-only and terminal. The replay branch sits ahead
     * of the scope check for exactly that reason: a retry after a lost response has to return the
     * stored verdict, not discover a new objection to it.
     *
     * Set up here the only way it can be: write the result directly, as a store that had already
     * graded this drill would hold it, then ask the service to finish the drill again.
     */
    const store = await withClaim(FAST_CLAIM);
    const begun = await begin(store, FAST_CLAIM, FRESH_OPENING);
    const ids: string[] = [];
    for (const [i, fen] of begun.drill!.fens.entries()) {
      const id = `legacy-${i}`;
      ids.push(id);
      // Out of scope by the rule that now applies -- four minutes a move.
      await decide(store, id, fen, {
        secondsTaken: 240,
        confidence: i === 3 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS,
        cpLoss: i === 6 ? 5 : 250,
      });
    }
    await store.saveDrillResult({
      kind: "prospective_drill_result",
      drill_id: `drill-${FAST_CLAIM.claim_id}`,
      claim_id: FAST_CLAIM.claim_id,
      decision_ids: ids,
      predicted: true,
      observed: true,
      recorded_at: "2026-02-01T10:00:00.000Z",
    });

    const done = await service.finishDrill(
      store,
      { drill_id: `drill-${FAST_CLAIM.claim_id}`, decision_ids: ids },
      { recorded_at: "2026-03-01T10:00:00.000Z" },
    );
    // Null verdict is the replay's honest answer -- the numbers were measured against a baseline
    // that has since grown -- and the grade the stored result produced still stands.
    expect(done.verdict).toBeNull();
    expect(done.claim.grade).toBe("replicated");
  });

  it("grades it when the drill's decisions are in scope", async () => {
    // The other side, so the guard above cannot be satisfied by refusing everything.
    const store = await withClaim(FAST_CLAIM);
    const begun = await begin(store, FAST_CLAIM, FRESH_OPENING);
    const ids: string[] = [];
    for (const [i, fen] of begun.drill!.fens.entries()) {
      const id = `fast-${i}`;
      ids.push(id);
      await decide(store, id, fen, {
        secondsTaken: 12,
        confidence: i === 3 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS,
        cpLoss: i === 6 ? 5 : 250,
      });
    }
    const done = await service.finishDrill(
      store,
      { drill_id: `drill-${FAST_CLAIM.claim_id}`, decision_ids: ids },
      { recorded_at: "2026-03-01T10:00:00.000Z" },
    );
    expect(done.verdict, "an in-scope drill still produces a verdict").not.toBeNull();
    expect(done.verdict!.n).toBe(begun.drill!.fens.length);
  });

  it("marks exactly the three buckets a position can be selected for", () => {
    /*
     * The list is the thing that decides, so it is asserted rather than trusted. A bucket that
     * gained a `drillPhase` it should not have would put the drill back to testing the wrong
     * claim; one that lost the one it should have would withdraw a drill that works.
     */
    const selectable = BUCKETINGS.filter((b) => b.drillPhase).map((b) => b.key);
    expect(selectable.sort()).toEqual(["phase-endgame", "phase-middlegame", "phase-opening"]);
    for (const bucketing of BUCKETINGS) {
      if (!bucketing.drillPhase) continue;
      // The marker and the predicate have to agree, or selection and grading disagree about
      // what the bucket is.
      expect(
        bucketing.predicate({
          phase: bucketing.drillPhase,
          secondsTaken: 60,
          clockMsRemaining: 120_000,
        }),
        `${bucketing.key}'s drillPhase does not satisfy its own predicate`,
      ).toBe(true);
    }
  });
});

describe("the decisions the drill is graded against are the ones it registered", () => {
  it("runs end to end on an in-scope drill", async () => {
    // Guarding the fix against the easy failure mode: refusing everything would pass every
    // assertion above about refusals.
    const store = await withClaim(ENDGAME_CLAIM);
    const begun = await begin(store, ENDGAME_CLAIM, FRESH_ENDGAME);
    const ids: string[] = [];
    for (const [i, fen] of begun.drill!.fens.entries()) {
      const id = `dr-${i}`;
      ids.push(id);
      await store.commitDecision({
        decisionId: id,
        gameId: "g",
        fen,
        ply: plyFromFen(fen),
        phase: "endgame",
        clockMsRemaining: 120_000,
        secondsTaken: 30,
        chosenMove: "e2e4",
        candidateMovesConsidered: ["e2e4"],
        statedRead: "r",
        statedUnknown: "u",
        confidence: i === 3 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS,
        confidenceScale: CONFIDENCE_LEVELS,
        probeAssignment: "not-probed",
        legalMoves: 12,
        revealTiming: "per-decision",
      });
      await store.recordReveal(id, {
        engine_eval_cp: 10,
        engine_best_move: "e2e4",
        engine_depth: 18,
        engine_source: "local_sf18",
        cp_loss: i === 6 ? 5 : 250,
      });
    }
    const done = await service.finishDrill(
      store,
      { drill_id: `drill-${ENDGAME_CLAIM.claim_id}`, decision_ids: ids },
      { recorded_at: "2026-03-01T10:00:00.000Z" },
    );
    expect(done.verdict, "an in-scope drill still produces a verdict").not.toBeNull();
    expect(done.verdict!.n).toBe(begun.drill!.fens.length);
  });
});
