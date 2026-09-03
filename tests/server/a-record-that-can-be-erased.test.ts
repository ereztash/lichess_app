/**
 * The server record can be erased, all of it, and `users` is not part of "it".
 *
 * Skips without `DATABASE_URL`, exactly as the store's own suite does, and for the same reason: a
 * purge proven against a mock proves the mock. In CI the workflow sets the variable and this runs
 * against MySQL 8 with every migration applied.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { afterAll, describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { RECORD_TABLES } from "../../shared/tenancy";
import { DrizzleRecordStore } from "../../server/record";
import { purgeRecord, recordCounts } from "../../scripts/purge";

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb("the server record is erased by scripts/purge.ts", () => {
  const db = drizzle(DATABASE_URL ?? "mysql://unset");
  afterAll(async () => {
    await purgeRecord(db);
  });

  it("removes every row of every record table and leaves the identity table alone", async () => {
    const store = new DrizzleRecordStore();
    await store.commitDecision({
      decisionId: "purge-1",
      gameId: "purge-game",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      ply: 1,
      phase: "opening",
      clockMsRemaining: null,
      purpose: "play",
      drillId: null,
      transferId: null,
      secondsTaken: 5,
      chosenMove: "e2e4",
      candidateMovesConsidered: ["e2e4"],
      statedRead: "x",
      statedUnknown: "y",
      confidence: 3,
      confidenceScale: CONFIDENCE_LEVELS,
      probeAssignment: "not-probed",
      legalMoves: 20,
      revealTiming: "per-decision",
      measurementProtocol: null,
      protocolVersion: null,
      analysisTiming: null,
    });
    await db.execute(
      sql.raw("INSERT INTO `users` (openId, name) VALUES ('purge-owner', 'Owner') ON DUPLICATE KEY UPDATE name = 'Owner'"),
    );

    const before = await purgeRecord(db);
    expect(before.decisions).toBeGreaterThan(0);

    const after = await recordCounts(db);
    for (const table of RECORD_TABLES) expect(after[table], table).toBe(0);
    const [users] = await db.execute(sql.raw("SELECT COUNT(*) AS n FROM `users` WHERE openId = 'purge-owner'"));
    expect(Number((users as unknown as { n: number }[])[0].n)).toBe(1);
    await db.execute(sql.raw("DELETE FROM `users` WHERE openId = 'purge-owner'"));
  });
});
