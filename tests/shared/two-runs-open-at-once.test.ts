/**
 * WHAT THE CONTINUATION READ SAYS WHEN THE RECORD HOLDS MORE THAN ONE ANSWER.
 *
 * THE DEFECT THIS FILE EXISTS FOR was found by review, not by a test, and it is the migration's own
 * defect reintroduced one layer up. The read used to pre-rank the two runs into a single `active`
 * value, and the assembly split it back apart -- so a record with a drill AND a transfer open
 * reported `transfer: observed(null)`: a POSITIVE claim that no transfer is open, made by an
 * assembly that had just been handed one.
 *
 * `Observed<T>` exists so that "I did not read this" cannot be written as "there is none". A
 * pre-ranking that discards the loser writes exactly that, with the type's blessing, because the
 * value really was observed -- just not reported.
 *
 * The ranking was in two places as well. `deriveNextAction` puts `continue-drill` above
 * `continue-transfer` and always did; the read ranking them again made the order a fact two modules
 * had to agree about. The read now reports what it found and the derivation decides.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { continuationReading, drillProgress } from "../../shared/continuation";
import type { DrillSpec } from "../../shared/claim";

const spec = (id: string, fens: string[]): DrillSpec => ({
  drill_id: id,
  claim_id: `claim-${id}`,
  fens,
  refutation_condition: "the drill comes back negative",
  predicts_overconfidence: true,
});

const FEN_A = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_B = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("the continuation read, when the record holds more than one open run", () => {
  it("reports the drill and the transfer separately instead of ranking them", async () => {
    const store = new MemoryRecordStore();
    await store.saveDrill({
      spec: spec("d1", [FEN_A, FEN_B]),
      predicted: true,
      started_at: "2026-01-01T00:00:00.000Z",
    });

    const reading = await continuationReading(store);
    expect(reading.drill).toMatchObject({ kind: "drill", runId: "d1" });
    /*
     * NULL HERE IS AN OBSERVED ABSENCE AND IT IS TRUE: this record holds no open transfer. The
     * defect was the case below, where it held one and this field said null anyway.
     */
    expect(reading.transfer).toBeNull();
  });

  it("never reports a run it was handed as absent", async () => {
    /*
     * THE REGRESSION. Before the fix the read returned one `active` run, the drill won the
     * pre-ranking, and the transfer -- which the read had just loaded -- was reported as not
     * existing. A shadow row written from that state asserted something the read knew to be false.
     */
    const store = new MemoryRecordStore();
    await store.saveDrill({
      spec: spec("d1", [FEN_A]),
      predicted: true,
      started_at: "2026-01-01T00:00:00.000Z",
    });
    await store.saveLearningRule({
      rule_id: "r1",
      authored_by: "player",
      grade: "hypothesis",
      retrieval_step: 0,
      next_due_at: "2026-01-02T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      last_evaluated_at: "2026-01-01T00:00:00.000Z",
      source_decision_id: "00000000-0000-4000-8000-000000000000",
      trigger: "t",
      mechanism_class: "calculation",
      missed_signal: "m",
      action_rule: "a",
      exception_rule: null,
      predicted_outcome: "p",
      refutation_condition: "r",
    });
    await store.saveLearningTransfer({
      transfer_id: "t1",
      rule_id: "r1",
      fens: [FEN_A, FEN_B, FEN_A],
      rule_snapshot: { trigger: "t", mechanism_class: "calculation", action_rule: "a", predicted_outcome: "p" },
      refutation_condition: "r",
      minimum_successes: 2,
      retrieval_step: 0,
      scheduled_for: "2026-01-02T00:00:00.000Z",
      started_at: "2026-01-02T00:00:00.000Z",
    });

    const reading = await continuationReading(store);
    expect(reading.drill, "the drill went missing").toMatchObject({ runId: "d1" });
    expect(reading.transfer, "a transfer the read loaded was reported as absent").toMatchObject({
      kind: "transfer",
      runId: "t1",
      done: 0,
      total: 3,
    });
    /* A rule whose test is already running is branch 2, not branch 5. */
    expect(reading.untestedRule).toBeNull();
  });

  it("lets the newest open drill outrank a stale one", async () => {
    /*
     * `closeDrill` RESETS COMPONENT STATE AND WRITES NO RESULT ROW, so a drill drawn at the briefing
     * and dismissed stays open in the record forever and nothing distinguishes it from one the
     * player means to finish. This read cannot invent that distinction -- but it can refuse to let
     * the stale one mask the live one, which taking the newest does.
     */
    const store = new MemoryRecordStore();
    await store.saveDrill({
      spec: spec("stale", [FEN_A]),
      predicted: true,
      started_at: "2026-01-01T00:00:00.000Z",
    });
    await store.saveDrill({
      spec: spec("live", [FEN_A, FEN_B]),
      predicted: true,
      started_at: "2026-06-01T00:00:00.000Z",
    });
    expect((await continuationReading(store)).drill).toMatchObject({ runId: "live" });
  });

  it("omits a drill whose direction was never recorded, in every store", async () => {
    /*
     * `getDrill` throws `MissingClaimDirection` rather than hand back a spec that cannot be graded.
     * A LIST may not throw for one bad row, so the interface says it omits them -- and the effect
     * is the honest one: an ungradeable drill is unfinishable, so proposing that a player finish it
     * would be proposing an act with no outcome.
     */
    const store = new MemoryRecordStore();
    await store.saveDrill({
      spec: { ...spec("legacy", [FEN_A]), predicts_overconfidence: null as unknown as boolean },
      predicted: true,
      started_at: "2026-01-01T00:00:00.000Z",
    });
    expect((await continuationReading(store)).drill).toBeNull();
  });
});

describe("how far into a drill the record says the player is", () => {
  it("counts matched positions rather than matches", () => {
    /* Two slots sharing a fen must not report a run twice as finished as it is. */
    expect(drillProgress(spec("d", [FEN_A, FEN_A, FEN_B]), [FEN_A])).toEqual({ done: 2, total: 3 });
    expect(drillProgress(spec("d", [FEN_A, FEN_B]), [])).toEqual({ done: 0, total: 2 });
    expect(drillProgress(spec("d", [FEN_A, FEN_B]), [FEN_A, FEN_B])).toEqual({ done: 2, total: 2 });
  });
});
