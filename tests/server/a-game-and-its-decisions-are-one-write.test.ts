/**
 * A BLITZ GAME AND ITS DECISIONS ARE ONE WRITE, OR THEY ARE NOT A WRITE.
 *
 * `saveBlitzRecord` used to be two inserts with no transaction, and it said so in its own comment:
 * the game row went first *"so a partial failure leaves a game with no decisions rather than orphan
 * decisions with no conditions."* That is the better of two bad outcomes, not a good one.
 *
 * WHAT THE OLD ORDERING ACTUALLY LEFT BEHIND. A game row with no decisions is a game that was
 * played and measured nothing, and it is indistinguishable from a game whose decisions were all
 * filtered out. `listBlitzGames` returns it, a reading counts it, and the denominator it
 * contributes to is a fiction that nothing downstream can detect — every field on the row is
 * present and plausible.
 *
 * THE FAILURE IS INJECTED, NOT MOCKED. Two decisions claiming the same ply violate the composite
 * primary key `(game_id, ply)`, so the second insert fails inside the real driver, between the two
 * writes, exactly where the tear used to happen. `storedBlitzRecordSchema` refuses that record —
 * but the schema runs in `saveBlitzGame`, one layer above the store, and this test is about the
 * store.
 *
 * SKIPPED WITHOUT A DATABASE, for the reason `drizzle-store.test.ts` gives at length: a test that
 * silently passes when it did not run is the R2 failure this repository is built around. CI sets
 * `DATABASE_URL` against a real MySQL 8, so this runs there.
 */
import { describe, expect, it } from "vitest";
import { DrizzleRecordStore } from "../../server/record";
import type { StoredBlitzRecord } from "../../shared/blitz-record";
import { CURRENT_PROTOCOL_VERSION } from "../../shared/measurement-protocol";

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

const store = new DrizzleRecordStore();

/**
 * A FRESH ID PER RUN, because this store is append-only and has no delete.
 *
 * The alternative — a fixed id and a cleanup step — would need a deletion path that the record
 * layer deliberately does not have. Two runs against the same database must not collide, and a
 * test that depends on its own teardown having worked is a test that reports the teardown.
 */
const GAME_ID = `tear-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const decision = (ply: number) => ({
  gameId: GAME_ID,
  ply,
  side: "w" as const,
  san: "e4",
  fenBefore: START,
  thinkMs: 1200,
  clockBeforeMs: 180_000,
  opponentClockBeforeMs: 180_000,
  wasAsked: false,
  samplingProbability: 0.1,
  confidence: null,
  /* Unasked, so there is no scale: a scale with no confidence names an instrument nobody used. */
  confidenceScale: null,
  confidenceGridVersion: null,
  instrumentationLatencyMs: null,
  cpLoss: null,
  standingCp: null,
});

const record = (decisions: StoredBlitzRecord["decisions"]): StoredBlitzRecord => ({
  game: {
    gameId: GAME_ID,
    playedAs: "w",
    timeControl: { initialMs: 180_000, incrementMs: 0 },
    outcome: { kind: "resignation", loser: "b" },
    startedAt: "2026-08-30T12:00:00.000Z",
    finishedAt: "2026-08-30T12:03:00.000Z",
    measurementProtocol: "instrumented-blitz",
    protocolVersion: CURRENT_PROTOCOL_VERSION,
    analysisTiming: "after-play",
    samplingPolicyVersion: 1,
    askRate: 0.1,
    analysisState: "pending",
    analysedAt: null,
    analysis: null,
    opponent: { kind: "engine", engine: "stockfish", build: "18-lite-single", depth: 4 },
  },
  decisions,
});

describeDb("a partial blitz write", () => {
  it("leaves NOTHING behind when the decisions cannot be written", async () => {
    /*
     * The assertion that fails without the transaction. Before it, the game row was already
     * committed by the time the decisions insert threw, so `listBlitzGames` returned a game with
     * no decisions and no way to know it was a fragment.
     */
    await expect(store.saveBlitzRecord(record([decision(1), decision(1)]))).rejects.toThrow();

    const games = await store.listBlitzGames();
    expect(
      games.some((g) => g.gameId === GAME_ID),
      "the game row survived a failed write — the two inserts are not one transaction",
    ).toBe(false);
  });

  it("stores the game and its decisions together when the write succeeds", async () => {
    // The other half: the rollback must not be achieved by never writing anything.
    await store.saveBlitzRecord(record([decision(1), decision(3)]));

    const games = await store.listBlitzGames();
    expect(games.some((g) => g.gameId === GAME_ID)).toBe(true);

    const mine = (await store.listBlitzDecisions()).filter((d) => d.gameId === GAME_ID);
    expect(mine.map((d) => d.ply).sort()).toEqual([1, 3]);
  });
});
