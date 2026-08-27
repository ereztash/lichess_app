/**
 * `finishDrill` has the shape that cost a learning rule its grade, and it is worse here.
 *
 * Cycle 31 found `finishLearningTransfer` writing the evidence and the verdict in two statements
 * with no transaction, and its retry branch handing back the ungraded rule. The same three lines
 * are in `finishDrill` (shared/record-service.ts): `saveDrillResult`, then `getClaim`, then
 * `saveClaim`. What is worse is the recovery: the transfer path at least HAD an idempotent replay
 * branch. This one has none, and `saveDrillResult` is append-only in both stores -- Memory throws
 * "append-only: drill already reported", Drizzle hits a primary-key violation on `drill_results`.
 *
 * So the retry does not return a stale verdict. It raises, forever, and the drill can never be
 * completed. Reproduced against a real MariaDB before this file was written:
 *
 *     duplicate save : THREW
 *       Failed query: insert into `drill_results` (`drill_id`, `claim_id`, ...) values (?, ?, ...)
 *
 * WHAT THIS DOES NOT CLAIM. That message carries the bound values, but it does not reach the
 * client: `server/_core/trpc.ts`'s `errorFormatter` rebuilds the shape and replaces the message
 * for every error the product did not author, which is a fix that was deliberately made once,
 * globally, rather than per-procedure. The player gets a 500 with a generic sentence -- and a
 * verdict they can never see.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "../../shared/confidence";
import type { Claim } from "../../shared/claim";
import * as service from "../../shared/record-service";

const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 3",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
  "r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 6",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 7",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 8",
];

const CLAIM: Claim = {
  claim_id: "claim-drill-crash",
  statement: "תחת לחץ זמן אתם בטוחים יותר משאתם מדויקים",
  scope: "החלטות מהירות",
  supporting_decision_ids: [],
  n: 40,
  grade: "hypothesis",
  refutation_condition: "פער הביטחון לא ישוחזר בבדיקה קדימה",
  prospective_tests: [],
  created_at: "2026-01-01T00:00:00.000Z",
  last_evaluated_at: "2026-01-01T00:00:00.000Z",
};

/** A store whose claim write can be made to fail exactly once, after the result is already in. */
class LosesTheClaimWrite extends MemoryRecordStore {
  crashNextClaimWrite = false;
  override async saveClaim(claim: Parameters<MemoryRecordStore["saveClaim"]>[0]) {
    if (this.crashNextClaimWrite) {
      this.crashNextClaimWrite = false;
      throw new Error("connection reset by peer");
    }
    return super.saveClaim(claim);
  }
}

async function record(
  store: MemoryRecordStore,
  id: string,
  fen: string,
  { confidence, cpLoss, seconds }: { confidence: number; cpLoss: number; seconds: number },
) {
  await store.commitDecision({
    decisionId: id,
    gameId: "drill-fixture",
    fen,
    ply: 0,
    phase: "middlegame",
    clockMsRemaining: 120_000,
    secondsTaken: seconds,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4"],
    statedRead: "המרכז פתוח",
    statedUnknown: "לא ברור מה השחור מאיים",
    confidence,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 20,
    revealTiming: "per-decision",
  });
  await store.recordReveal(id, {
    engine_eval_cp: 10,
    engine_best_move: "e2e4",
    engine_depth: 18,
    engine_source: "local_sf18",
    cp_loss: cpLoss,
  });
}

/**
 * A claim, a started drill over five positions, and a baseline behind it.
 *
 * The baseline varies on both axes for the reason `drill-route.test.ts` spells out: a bucket whose
 * every member carries the identical confidence and the identical outcome has a sample variance of
 * exactly zero, and the detector refuses that. It is a fixture for a verdict, not for a pattern.
 */
async function seed(store: MemoryRecordStore) {
  await store.saveClaim(CLAIM);
  for (let i = 0; i < 40; i += 1) {
    const fast = i % 2 === 0;
    await record(store, `base-${i}`, FENS[i % FENS.length], {
      confidence: fast ? (i % 10 === 4 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS) : EVEN_ODDS_LEVEL,
      cpLoss: fast ? (i % 8 === 0 ? 5 : 200) : i % 3 === 0 ? 120 : 5,
      seconds: fast ? 10 : 200,
    });
  }
  const drillIds = ["dr-0", "dr-1", "dr-2", "dr-3", "dr-4"];
  for (const [index, id] of drillIds.entries()) {
    await record(store, id, FENS[index], {
      confidence: index === 1 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS,
      cpLoss: index === 3 ? 5 : 200,
      seconds: 10,
    });
  }
  await store.saveDrill({
    spec: {
      drill_id: "drill-1",
      claim_id: CLAIM.claim_id,
      fens: drillIds.map((_, index) => FENS[index]),
      refutation_condition: CLAIM.refutation_condition,
    },
    predicted: true,
    started_at: "2026-02-01T09:00:00.000Z",
  });
  return drillIds;
}

const RECORDED_AT = "2026-02-01T10:00:00.000Z";

/**
 * R5: the verdict must be decided over the positions that were written down.
 *
 * `finishDrill` intersected the posted decision ids with the REVEALED decisions and reported
 * whatever survived. A five-position pre-registered drill whose third reveal write was lost came
 * back as a four-decision result, and nothing anywhere recorded that a registered position went
 * unmeasured: `ProspectiveDrillResult` has no such field, `describeResult` reports the smaller n as
 * the test's size, and `evaluateRefutation` computes its standard error from the survivors. The
 * only guard was `length === 0`.
 *
 * THE SIBLING IN THE SAME FILE SETTLES WHAT WAS INTENDED. `finishLearningTransfer` refuses when
 * `observations.length !== transfer.fens.length` and refuses any decision without a reveal. Both
 * are pre-registered tests; only one of them checked that the test it graded was the test it
 * registered.
 *
 * And it is terminal: a false `observed` grades the claim `refuted`, refutation is terminal, and
 * `beginDrill` then refuses to test that claim again — so a truncated run could close a question
 * permanently.
 */
describe("a drill grades the positions it registered, or none", () => {
  it("refuses a run that lost a position, naming what was registered and what was measured", async () => {
    const store = new MemoryRecordStore();
    const drillIds = await seed(store);
    // Four of the five decisions reached a reveal. The fifth is committed and unrevealed, which is
    // what a lost reveal write leaves behind.
    await store.commitDecision({
      decisionId: "dr-unrevealed",
      gameId: "drill-fixture",
      fen: FENS[5],
      ply: 0,
      phase: "middlegame",
      clockMsRemaining: 120_000,
      secondsTaken: 10,
      chosenMove: "e2e4",
      candidateMovesConsidered: ["e2e4"],
      statedRead: "המרכז פתוח",
      statedUnknown: "לא ברור מה השחור מאיים",
      confidence: CONFIDENCE_LEVELS,
      confidenceScale: CONFIDENCE_LEVELS,
      probeAssignment: "not-probed",
      legalMoves: 20,
      revealTiming: "per-decision",
    });

    const outcome = await service
      .finishDrill(
        store,
        { drill_id: "drill-1", decision_ids: [...drillIds.slice(0, 4), "dr-unrevealed"] },
        { recorded_at: RECORDED_AT },
      )
      .catch((error: unknown) => error as Error);

    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toContain("5");
    expect((outcome as Error).message).toContain("4");
    // And nothing was written: a refusal must not leave a verdict behind.
    expect((await store.getClaim(CLAIM.claim_id))?.prospective_tests).toHaveLength(0);
  });

  it("refuses a decision recorded against a board this drill never registered", async () => {
    /*
     * The other half of "the test it graded is the test it registered": the right NUMBER of
     * revealed decisions is not the same as the right positions. Without this the completion
     * believes whatever the client sends, which is the thing the per-position write was introduced
     * to stop on the transfer path.
     */
    const store = new MemoryRecordStore();
    const drillIds = await seed(store);
    await record(store, "dr-elsewhere", FENS[7], { confidence: 4, cpLoss: 20, seconds: 12 });

    await expect(
      service.finishDrill(
        store,
        { drill_id: "drill-1", decision_ids: [...drillIds.slice(0, 4), "dr-elsewhere"] },
        { recorded_at: RECORDED_AT },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((await store.getClaim(CLAIM.claim_id))?.prospective_tests).toHaveLength(0);
  });

  it("still grades a run that measured every registered position", async () => {
    // The half a refusal can break. A guard that rejects everything protects nothing.
    const store = new MemoryRecordStore();
    const drillIds = await seed(store);
    const outcome = await service.finishDrill(
      store,
      { drill_id: "drill-1", decision_ids: drillIds },
      { recorded_at: RECORDED_AT },
    );
    expect(outcome.claim.grade).not.toBe("hypothesis");
    expect((await store.getClaim(CLAIM.claim_id))?.prospective_tests).toHaveLength(1);
  });
});

describe("a verdict the drill cannot report twice", () => {
  it("leaves the claim ungraded when the write after the result is lost", async () => {
    const store = new LosesTheClaimWrite();
    const drillIds = await seed(store);

    store.crashNextClaimWrite = true;
    const crash = await service
      .finishDrill(store, { drill_id: "drill-1", decision_ids: drillIds }, { recorded_at: RECORDED_AT })
      .catch((error: unknown) => error as Error);

    expect((crash as Error).message).toBe("connection reset by peer");
    // The evidence is on the record: the drill was run, the positions were decided, the verdict
    // was computed. Only the last write is missing.
    const claim = await store.getClaim(CLAIM.claim_id);
    expect(claim?.prospective_tests).toHaveLength(1);
    // And the claim carries no trace of it.
    expect(claim?.grade).toBe("hypothesis");
    expect(claim?.last_evaluated_at).toBe(CLAIM.last_evaluated_at);
  });

  it("draws the verdict the record already supports when the report is retried", async () => {
    const store = new LosesTheClaimWrite();
    const drillIds = await seed(store);
    store.crashNextClaimWrite = true;
    await service
      .finishDrill(store, { drill_id: "drill-1", decision_ids: drillIds }, { recorded_at: RECORDED_AT })
      .catch(() => undefined);

    // The retry a lost response makes inevitable. Today this raises "append-only: drill already
    // reported" and the verdict is unreachable forever.
    const retry = await service.finishDrill(
      store,
      { drill_id: "drill-1", decision_ids: drillIds },
      // Later than the write it is retrying. The verdict must still be dated by the drill.
      { recorded_at: "2026-02-01T12:00:00.000Z" },
    );

    expect(retry.claim.grade).not.toBe("hypothesis");
    expect(retry.claim.last_evaluated_at).toBe(RECORDED_AT);
    const stored = await store.getClaim(CLAIM.claim_id);
    expect(stored?.grade).toBe(retry.claim.grade);
    // One drill, one result. A retry must not write a second verdict.
    expect(stored?.prospective_tests).toHaveLength(1);
  });

  it("returns the first report rather than raising when a drill is reported twice", async () => {
    // No crash at all -- just a lost response. The honest case, and the one the transfer path was
    // already fixed for.
    const store = new MemoryRecordStore();
    const drillIds = await seed(store);
    const once = await service.finishDrill(
      store,
      { drill_id: "drill-1", decision_ids: drillIds },
      { recorded_at: RECORDED_AT },
    );
    const twice = await service.finishDrill(
      store,
      { drill_id: "drill-1", decision_ids: drillIds },
      { recorded_at: "2026-02-01T12:00:00.000Z" },
    );

    expect(twice.claim.grade).toBe(once.claim.grade);
    expect(twice.description).toBe(once.description);
    expect((await store.getClaim(CLAIM.claim_id))?.prospective_tests).toHaveLength(1);
  });
});
