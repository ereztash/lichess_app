/**
 * DrizzleRecordStore against a REAL MySQL-compatible database.
 *
 * Until this file existed, `docs/MEASUREMENTS.md` carried the entry "the record layer against a
 * real database -- DATABASE_URL has never been set in any environment this build has run in, so
 * DrizzleRecordStore has never executed a statement against MySQL". Every record test ran against
 * the in-memory store, which is a different class implementing the same interface. An interface
 * is not a proof: the two classes can satisfy the same types and disagree about what the data
 * does, and one of them already did -- see the ordering assertion below.
 *
 * SKIPPED WITHOUT A DATABASE, and that is deliberate rather than convenient. A test that silently
 * passes when it did not run is exactly the R2 failure this repository is built around, so the
 * skip is explicit and `npm run gates` does not count this as coverage. To run it:
 *
 *     mariadbd --user=mysql &
 *     mariadb -u root -e "CREATE DATABASE decision_lab"
 *     sed 's/--> statement-breakpoint//' drizzle/migrations/0000_*.sql | mariadb -u root decision_lab
 *     DATABASE_URL='mysql://root@127.0.0.1:3306/decision_lab' npx vitest run tests/server/drizzle-store.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleRecordStore } from "../../server/record";
import type { CommitDecisionInput } from "../../shared/record-store";

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

const store = new DrizzleRecordStore();

/** One decision, varying only what the assertions below actually read. */
function decision(index: number, overrides: Partial<CommitDecisionInput> = {}): CommitDecisionInput {
  return {
    decisionId: `d-${String(index).padStart(3, "0")}`,
    gameId: "game-1",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    ply: index,
    phase: "middlegame",
    clockMsRemaining: 120_000,
    secondsTaken: 30,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4", "d2d4"],
    statedRead: "המרכז פתוח",
    statedUnknown: "לא ברור מה השחור מאיים",
    confidence: 3,
    ...overrides,
  };
}

describeDb("DrizzleRecordStore against MySQL", () => {
  /**
   * Clean BEFORE as well as after, so the suite is idempotent.
   *
   * Cleaning only afterwards works exactly once: a run that crashes, or a developer re-running
   * this file locally, meets rows from last time -- and "the newest hypothesis wins" is an
   * assertion about ordering that a leftover row can flip. A test whose result depends on whether
   * the previous run finished is not measuring the code.
   */
  const wipe = async () => {
    const { getDb } = await import("../../server/db");
    const db = await getDb();
    if (!db) return;
    await db.execute("DELETE FROM decision_reveals");
    await db.execute("DELETE FROM decision_feedback");
    await db.execute("DELETE FROM decisions");
    await db.execute("DELETE FROM preregistered_hypotheses");
  };

  beforeAll(async () => {
    expect(await store.isAvailable(), "DATABASE_URL is set but the driver did not connect").toBe(
      true,
    );
    await wipe();
  });

  afterAll(wipe);

  it("writes a decision and reads the same atom back", async () => {
    await store.commitDecision(decision(1));
    const atom = await store.getAtom("d-001");
    expect(atom).not.toBeNull();
    expect(atom?.entry_state.fen).toContain("rnbqkbnr");
    expect(atom?.known).toBe("המרכז פתוח");
    // Hebrew survives the round trip only if the column collation is utf8mb4. A latin1 column
    // would return mojibake rather than throwing, so this asserts the bytes, not the insert.
    expect(atom?.unknown).toBe("לא ברור מה השחור מאיים");
    expect(atom?.bounded_action.candidate_moves_considered).toEqual(["e2e4", "d2d4"]);
    // Nothing has revealed it, and an unrevealed decision must not carry an invented result (R2).
    expect(atom?.result).toBeNull();
  });

  it("refuses a repeated decision_id rather than updating it", async () => {
    // Append-only is the whole basis of the record. The in-memory store enforces it with an
    // explicit check; here it has to come from the primary key, which is a different mechanism
    // and had never been exercised.
    await expect(store.commitDecision(decision(1))).rejects.toThrow();
  });

  it("returns atoms in INSERTION order, which prereg's prefix slice depends on", async () => {
    /*
     * THE DEFECT THIS CAUGHT, and the first version of this test that did not catch it.
     *
     * Neither Drizzle listing had an ORDER BY. The first assertion here compared the two listings
     * to each other, and its positive control came back GREEN: InnoDB happens to return rows in
     * primary-key order, so both listings agreed anyway and removing the ORDER BY changed
     * nothing. A test that cannot fail is not a test.
     *
     * What actually depends on the order is `shared/prereg.ts`. A registered hypothesis stores
     * `decisions_before`, and `currentClaim` slices that many decisions off the FRONT to get "the
     * decisions recorded after the import". That prefix is only the right decisions if the
     * listing is in insertion order. Primary-key order is a different order whenever ids do not
     * sort the way rows arrived -- and decision ids are uuids in the running product, so they
     * essentially never do.
     *
     * So: insert, then stamp created_at into an order that disagrees with the ids, and require
     * the listing to follow created_at. Without the ORDER BY this returns id order and fails.
     */
    for (const index of [7, 3, 11, 5]) await store.commitDecision(decision(index));

    const { getDb } = await import("../../server/db");
    const db = await getDb();
    if (!db) throw new Error("no database");
    // Arrival order 001, 007, 003, 011, 005 -- deliberately not the id order.
    const arrival = ["d-001", "d-007", "d-003", "d-011", "d-005"];
    for (const [position, id] of arrival.entries()) {
      await db.execute(
        `UPDATE decisions SET created_at = FROM_UNIXTIME(1756000000 + ${position * 60}) WHERE decision_id = '${id}'`,
      );
    }

    const atoms = await store.listAtoms();
    const ids = await store.listDecisionIds();
    expect(ids, "listDecisionIds must return arrival order").toEqual(arrival);
    expect(
      atoms.map((atom) => `d-${String(atom.entry_state.ply).padStart(3, "0")}`),
      "listAtoms must return arrival order, not primary-key order",
    ).toEqual(arrival);
  });

  it("round-trips a pre-registered hypothesis, rates included", async () => {
    /*
     * The rates are stored as per-mille integers. A float column would round a ratio of small
     * counts to something that no longer reproduces the comparison it came from, so this asserts
     * the values that come BACK, not the values that went in.
     */
    const registered_at = "2026-08-24T10:00:00.000Z";
    await store.savePreregisteredHypothesis({
      bucket_key: "fast-under-45s",
      scope: "החלטות תחת פחות מ-45 שניות",
      registered_at,
      decisions_before: 5,
      evidence: {
        accurate_rate: 0.412,
        n: 96,
        runner_up_key: "phase-endgame",
        separation: 0.187,
        threshold: 0.142,
        games: 20,
      },
      refutation_condition: "אם לא יימצא פער כיול בדלי הזה — ההשערה הופרכה.",
    });

    const back = await store.getPreregisteredHypothesis();
    expect(back).not.toBeNull();
    expect(back?.bucket_key).toBe("fast-under-45s");
    expect(back?.decisions_before).toBe(5);
    expect(back?.evidence.accurate_rate).toBeCloseTo(0.412, 3);
    expect(back?.evidence.separation).toBeCloseTo(0.187, 3);
    expect(back?.evidence.threshold).toBeCloseTo(0.142, 3);
    expect(back?.evidence.runner_up_key).toBe("phase-endgame");
    expect(new Date(back?.registered_at ?? 0).toISOString()).toBe(registered_at);
  });

  it("returns the NEWEST hypothesis when a second import registers one", async () => {
    // Append-only: re-importing must not edit the old row, or the record loses what was believed
    // and when, and a pre-registration that cannot be audited afterwards is worth nothing.
    await store.savePreregisteredHypothesis({
      bucket_key: "phase-endgame",
      scope: "החלטות בסיום",
      registered_at: "2026-08-24T12:00:00.000Z",
      decisions_before: 40,
      evidence: {
        accurate_rate: 0.5,
        n: 51,
        runner_up_key: "fast-under-45s",
        separation: 0.2,
        threshold: 0.15,
        games: 25,
      },
      refutation_condition: "אם לא יימצא פער כיול בדלי הזה — ההשערה הופרכה.",
    });
    const back = await store.getPreregisteredHypothesis();
    expect(back?.bucket_key).toBe("phase-endgame");
    expect(back?.decisions_before).toBe(40);
  });
});
