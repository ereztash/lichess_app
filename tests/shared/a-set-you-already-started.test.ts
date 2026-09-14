/**
 * WHETHER A COMMITMENT THE PLAYER STARTED SURVIVES AS A PRIORITY, NOT ONLY AS A ROW.
 *
 * WHAT THIS FILE IS ABOUT. `saveDrill` wrote before the first board was shown and always did, so
 * the ROW survived a reload from the day drills shipped. What did not survive was everything that
 * makes the row mean anything: nothing could tell an open drill from one the player had closed,
 * nothing could reconstruct how far in they were, and no screen but the one running it could offer
 * to carry on. A record that remembers a test and cannot resume it has kept a receipt.
 *
 * THE FIVE STATES ARE TESTED AS FIVE, because collapsing any two of them is the failure mode: a
 * failed read rendered as an empty record is how a player four positions into a set gets offered
 * something else instead.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { continuationReading } from "../../shared/continuation";
import { drillProgress, restoreDrillRun } from "../../shared/drill-restore";
import type { DrillSpec } from "../../shared/claim";

const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
];

const spec = (id: string, fens: string[] = FENS): DrillSpec => ({
  drill_id: id,
  claim_id: `claim-${id}`,
  fens,
  refutation_condition: "the drill comes back negative",
  predicts_overconfidence: true,
});

/**
 * A store holding one open drill, plus however many of its boards have been answered.
 *
 * THE DECISIONS ARE WRITTEN THROUGH THE STORE'S OWN `commitDecision`-SHAPED ROWS rather than
 * constructed, so the `drill_id` binding under test is the one the product writes.
 */
async function withDrill(answered: number, drillId = "d1") {
  const store = new MemoryRecordStore();
  await store.saveDrill({
    spec: spec(drillId),
    predicted: true,
    started_at: "2026-01-01T00:00:00.000Z",
    abandoned_at: null,
  });
  for (let i = 0; i < answered; i += 1) {
    await commit(store, { decisionId: `dec-${drillId}-${i}`, fen: FENS[i], drillId });
  }
  return store;
}

/** One committed decision, with every field the store requires and nothing invented beyond them. */
async function commit(
  store: MemoryRecordStore,
  over: { decisionId: string; fen: string; drillId: string | null },
) {
  await store.commitDecision({
    gameId: "g1",
    ply: 8,
    phase: "middlegame",
    clockMsRemaining: null,
    purpose: over.drillId === null ? "play" : "drill",
    transferId: null,
    secondsTaken: 20,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4"],
    statedRead: "a read",
    statedUnknown: "an unknown",
    confidence: 4,
    confidenceScale: 7,
    probeAssignment: "not-probed",
    legalMoves: 30,
    revealTiming: "per-decision",
    measurementProtocol: null,
    protocolVersion: null,
    analysisTiming: null,
    quietWindowExposure: null,
    ...over,
  });
}

describe("the five things a record can say about a set the player started", () => {
  it("never says a record has none when it has never been read", async () => {
    /*
     * THE DEFAULT IS THE WHOLE POINT. Every surface holds this value before its query resolves, and
     * the previous shape of it was `null` -- the same value a record with nothing open produced. A
     * screen cannot tell those apart, so it renders both as an invitation to start something else.
     */
    const { COMMITMENT_UNREAD, COMMITMENT_READ_FAILED } = await import(
      "../../shared/continuation"
    );
    expect(COMMITMENT_UNREAD.drill).toEqual({
      state: "unknown",
      kind: "drill",
      because: "not-attempted",
    });
    expect(COMMITMENT_READ_FAILED.drill).toEqual({
      state: "unknown",
      kind: "drill",
      because: "read-failed",
    });
    /* And neither is `none`, which is the assertion the type exists to make. */
    expect(COMMITMENT_UNREAD.drill.state).not.toBe("none");
    expect(COMMITMENT_READ_FAILED.drill.state).not.toBe("none");
  });

  it("reports a started drill as active, with how far in the player is", async () => {
    const reading = await continuationReading(await withDrill(2));
    expect(reading.drill).toMatchObject({
      state: "active",
      run: { kind: "drill", runId: "d1", resumeWith: "d1", done: 2, total: 3 },
      restore: { ok: true },
    });
  });

  it("separates a set the player closed from one they never had", async () => {
    const store = await withDrill(1);
    await store.abandonDrill("d1", "2026-01-02T00:00:00.000Z");
    expect(await continuationReading(store).then((r) => r.drill)).toEqual({
      state: "abandoned",
      kind: "drill",
      runId: "d1",
    });
    /* And a record that has never drilled says something else entirely. */
    expect(await continuationReading(new MemoryRecordStore()).then((r) => r.drill)).toEqual({
      state: "none",
      kind: "drill",
    });
  });

  it("closes a drill once, and refuses to close one that already reported", async () => {
    const store = await withDrill(0);
    await store.abandonDrill("d1", "2026-01-02T00:00:00.000Z");
    /* Idempotent: a double-click, or a retry after a lost response, is the same fact twice. */
    await expect(store.abandonDrill("d1", "2026-06-01T00:00:00.000Z")).resolves.toBeUndefined();
    const [closed] = await store.listDrills();
    expect(closed.abandoned_at, "the first close is the one that happened").toBe(
      "2026-01-02T00:00:00.000Z",
    );

    const reported = await withDrill(0, "d2");
    await reported.saveDrillResult({
      kind: "prospective_drill_result",
      drill_id: "d2",
      claim_id: "claim-d2",
      decision_ids: ["00000000-0000-4000-8000-000000000000"],
      predicted: true,
      observed: true,
      protocol: "position-drill",
      recorded_at: "2026-01-02T00:00:00.000Z",
    });
    await expect(reported.abandonDrill("d2", "2026-01-03T00:00:00.000Z")).rejects.toThrow();
  });

  it("closing a drill writes no verdict and grades nothing", async () => {
    /*
     * AN ABANDONMENT IS THE ABSENCE OF EVIDENCE, RECORDED. `finishDrill` is the only path that may
     * produce a verdict and it refuses a partial set; a close that wrote one would let a player end
     * a pre-registered test early and have the ending counted as a forward test that ran.
     */
    const store = await withDrill(1);
    await store.abandonDrill("d1", "2026-01-02T00:00:00.000Z");
    const claim = await store.getClaim("claim-d1");
    expect(claim?.prospective_tests ?? []).toHaveLength(0);
  });
});

describe("putting the player back inside the set", () => {
  it("restores the registered positions, the decisions and the cursor", async () => {
    const store = await withDrill(2);
    const outcome = await restoreDrillRun(store, "d1");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { spec: restored, decisionIds, cursor, done, total } = outcome.restore;
    /* THE TERMS ARE THE STORED ONES. Nothing is re-selected and nothing is re-ordered. */
    expect(restored.fens).toEqual(FENS);
    expect(restored.refutation_condition).toBe("the drill comes back negative");
    expect(restored.predicts_overconfidence).toBe(true);
    /*
     * `finishDrill` TAKES THESE IDS AND REFUSES ANY SET WHOSE SIZE IS NOT THE REGISTERED SIZE, so a
     * resume that could not reconstruct them would be a run that can be continued and never
     * reported -- a claim frozen with no path that could test it.
     */
    expect(decisionIds).toHaveLength(2);
    /* And the third board is where the player left off, not the first. */
    expect({ cursor, done, total }).toEqual({ cursor: 2, done: 2, total: 3 });
  });

  it("refuses to reopen a set the player closed, rather than reviving it", async () => {
    const store = await withDrill(1);
    await store.abandonDrill("d1", "2026-01-02T00:00:00.000Z");
    const outcome = await restoreDrillRun(store, "d1");
    expect(outcome.ok).toBe(false);
  });

  it("says a run cannot be restored rather than guessing where it got to", async () => {
    /*
     * THE REAL CASE. `decisions.drill_id` shipped in migration 0015 and
     * `drills.predicts_overconfidence` in 0006, so a drill started between them is gradeable, still
     * open, and its decisions carry no binding to it. Guessing by board would either re-serve a
     * position whose engine verdict the player has already read, or drop one of the registered
     * positions from a test `finishDrill` then refuses as incomplete.
     */
    const store = new MemoryRecordStore();
    await store.saveDrill({
      spec: spec("legacy", [FENS[1], FENS[2]]),
      predicted: true,
      started_at: "2026-01-01T00:00:00.000Z",
      abandoned_at: null,
    });
    /* Bound to the drill, on a board the drill never registered: one binding, zero answered slots. */
    await commit(store, { decisionId: "stray", fen: FENS[0], drillId: "legacy" });
    const atoms = await store.listAtoms();
    expect(drillProgress(spec("legacy", [FENS[1], FENS[2]]), atoms)).toMatchObject({ done: 0 });
    const restored = await restoreDrillRun(store, "legacy");
    expect(restored, "a count that cannot be reconciled is said, not guessed").toEqual({
      ok: false,
      because: { ok: false, because: "progress-ambiguous" },
    });

    const reading = await continuationReading(store);
    expect(reading.drill, "an open run is still the record's highest-priority fact").toMatchObject({
      state: "active",
    });
  });

  it("refuses a drill id the record does not hold", async () => {
    const outcome = await restoreDrillRun(new MemoryRecordStore(), "nope");
    expect(outcome).toEqual({ ok: false, because: { ok: false, because: "terms-unreadable" } });
  });
});
