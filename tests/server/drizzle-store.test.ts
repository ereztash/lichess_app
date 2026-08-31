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
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleRecordStore, MemoryRecordStore } from "../../server/record";
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
    purpose: "play",
    drillId: null,
    transferId: null,
    secondsTaken: 30,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4", "d2d4"],
    statedRead: "המרכז פתוח",
    statedUnknown: "לא ברור מה השחור מאיים",
    confidence: 3,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 20,
    revealTiming: "per-decision",
    measurementProtocol: null,
    protocolVersion: null,
    analysisTiming: null,
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
    await db.execute("DELETE FROM decision_counterfactuals");
    await db.execute("DELETE FROM decision_reveals");
    await db.execute("DELETE FROM decision_feedback");
    await db.execute("DELETE FROM decisions");
    await db.execute("DELETE FROM preregistered_hypotheses");
    await db.execute("DELETE FROM learning_transfer_observations");
    await db.execute("DELETE FROM learning_transfer_results");
    await db.execute("DELETE FROM learning_transfers");
    await db.execute("DELETE FROM learning_rules");
    // Added with the claim-timestamp test below: these three were accumulating across every run,
    // so a later assertion could have been reading a row an earlier run wrote.
    await db.execute("DELETE FROM drill_results");
    await db.execute("DELETE FROM drills");
    await db.execute("DELETE FROM claims");
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

  it("stores the purpose as an enum and keeps an unstamped decision unstamped", async () => {
    /*
     * THE COLUMN, NOT THE INTERFACE. `purpose` is a MySQL enum, so a value the schema does not
     * list is rejected by the database rather than by TypeScript -- and the in-memory store, which
     * every other test of this field runs against, is a Map that would happily hold anything. What
     * is checked here is that a real column round-trips the value and that an absent one comes
     * back NULL rather than as the enum's first member, which is what MySQL substitutes in a
     * non-strict mode for an invalid value.
     */
    await store.commitDecision(decision(90, { purpose: "drill" }));
    expect((await store.getAtom("d-090"))?.purpose).toBe("drill");

    await store.commitDecision(decision(91, { purpose: null }));
    const unstamped = await store.getAtom("d-091");
    expect(unstamped?.purpose, "an unstamped decision came back as a purpose").toBeNull();
    expect(unstamped?.known, "the rest of the row did not survive alongside a null purpose").toBe(
      "המרכז פתוח",
    );

    /*
     * Its own rows, removed again. The ordering test above asserts the COMPLETE listing, so a
     * decision left behind here fails a test that has nothing to do with this field -- which is
     * how a fixture becomes the reason someone distrusts an assertion about ordering.
     */
    const { getDb } = await import("../../server/db");
    const db = await getDb();
    if (!db) throw new Error("no database");
    await db.execute("DELETE FROM decisions WHERE decision_id IN ('d-090', 'd-091')");
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
      refutation_condition: "אם לא יימצא פער כיול בסוג הזה — ההשערה הופרכה.",
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
      refutation_condition: "אם לא יימצא פער כיול בסוג הזה — ההשערה הופרכה.",
    });
    const back = await store.getPreregisteredHypothesis();
    expect(back?.bucket_key).toBe("phase-endgame");
    expect(back?.decisions_before).toBe(40);
  });

  /*
   * THE OBSERVATION TABLE, AGAINST THE REAL DATABASE.
   *
   * The append-only guarantee here is a COMPOSITE PRIMARY KEY on (transfer_id, position), not a
   * check in TypeScript -- so it can only be proven where the key exists. The in-memory store
   * enforces the same rule with a Map and would agree with a broken migration, which is precisely
   * the "an interface is not a proof" point this file was written for.
   */
  it("records one observation per position, and refuses a second for the same slot", async () => {
    const observation = (id: string) => ({
      decision_id: id,
      recalled_rule: "לספור שחים והכאות לפני מהלך שקט",
      applied_rule: true,
    });
    await store.saveLearningTransferObservation("t-db", 0, observation("d-db-0"));
    await store.saveLearningTransferObservation("t-db", 1, observation("d-db-1"));

    const read = await store.listLearningTransferObservations("t-db");
    expect(read.map((o) => o.decision_id)).toEqual(["d-db-0", "d-db-1"]);
    expect(read[0].recalled_rule, "Hebrew did not survive the round trip").toBe(
      "לספור שחים והכאות לפני מהלך שקט",
    );
    expect(read[0].applied_rule, "boolean came back as 0/1 rather than a boolean").toBe(true);

    await expect(
      store.saveLearningTransferObservation("t-db", 0, observation("d-db-other")),
      "the composite primary key did not reject a second write for position 0",
    ).rejects.toThrow();
  });

  it("keeps one transfer's observations out of another's", async () => {
    // The key is composite, so a query that forgot the transfer id would still look correct on a
    // single-transfer fixture.
    await store.saveLearningTransferObservation("t-db-a", 0, {
      decision_id: "d-a",
      recalled_rule: "a",
      applied_rule: true,
    });
    await store.saveLearningTransferObservation("t-db-b", 0, {
      decision_id: "d-b",
      recalled_rule: "b",
      applied_rule: false,
    });
    expect((await store.listLearningTransferObservations("t-db-a")).map((o) => o.decision_id)).toEqual(["d-a"]);
    expect((await store.listLearningTransferObservations("t-db-b")).map((o) => o.decision_id)).toEqual(["d-b"]);
  });

  it("returns them in position order, not insertion order", async () => {
    // Written 2, 0, 1. A store that returned insertion order would file each observation against
    // the wrong preregistered board while the test still looked complete.
    for (const position of [2, 0, 1]) {
      await store.saveLearningTransferObservation("t-db-order", position, {
        decision_id: `d-${position}`,
        recalled_rule: `r-${position}`,
        applied_rule: true,
      });
    }
    expect((await store.listLearningTransferObservations("t-db-order")).map((o) => o.decision_id)).toEqual([
      "d-0",
      "d-1",
      "d-2",
    ]);
  });

  /*
   * THE PROBE, AGAINST A REAL DATABASE.
   *
   * Every rule below is already asserted against `MemoryRecordStore` in
   * tests/shared/an-arm-on-every-decision.test.ts -- and that is exactly why this block exists.
   * The two implementations are separate code: the in-memory one checks its refusals against a
   * `Map`, this one against three tables and a live driver, and nothing makes them agree except
   * running both. `recordCounterfactual` and `scoreCounterfactual` on this class had never
   * executed once before this file did it.
   */
  describe("the counterfactual probe, on a real database", () => {
    const probed = (index: number) => decision(index, { probeAssignment: "probed" });

    it("stores the arm and the covariate on the decision itself", async () => {
      await store.commitDecision(probed(400));
      const atom = await store.getAtom("d-400");
      expect(atom?.probe?.assignment).toBe("probed");
      expect(atom?.probe?.legal_moves).toBe(20);
      expect(atom?.reveal_timing).toBe("per-decision");
    });

    it("keeps an absent arm absent, rather than defaulting it to a control", async () => {
      await store.commitDecision(
        decision(401, { probeAssignment: null, legalMoves: null, revealTiming: null }),
      );
      const atom = await store.getAtom("d-401");
      expect(atom?.probe).toBeNull();
      expect(atom?.reveal_timing).toBeNull();
    });

    it("keeps 'asked and named nothing' apart from 'never asked'", async () => {
      /*
       * The distinction that a schema storing only the move could never recover. Here it is the
       * difference between a row in `decision_counterfactuals` with a NULL `alternative_move` and
       * no row at all -- which is only true if the read path actually joins on row existence.
       */
      await store.commitDecision(probed(402));
      await store.commitDecision(probed(403));
      await store.recordCounterfactual("d-402", null);

      const answered = (await store.getAtom("d-402"))?.probe;
      const silent = (await store.getAtom("d-403"))?.probe;
      expect(answered?.answered).toBe(true);
      expect(answered?.alternative).toBeNull();
      expect(silent?.answered).toBe(false);
    });

    it("prices a named alternative and hands it back", async () => {
      await store.commitDecision(probed(404));
      await store.recordCounterfactual("d-404", "d2d4");
      await store.scoreCounterfactual("d-404", 240);
      const probe = (await store.getAtom("d-404"))?.probe;
      expect(probe?.alternative).toBe("d2d4");
      expect(probe?.alternative_cp_loss).toBe(240);
    });

    it("refuses an answer on a decision that was never asked", async () => {
      await store.commitDecision(decision(405, { probeAssignment: "not-probed" }));
      await expect(store.recordCounterfactual("d-405", "d2d4")).rejects.toThrow();
    });

    it("refuses an answer once the engine has spoken", async () => {
      // R3 from the other side, and the check here is a SELECT rather than a Map lookup.
      await store.commitDecision(probed(406));
      await store.recordReveal("d-406", {
        engine_eval_cp: 15,
        engine_best_move: "e2e4",
        engine_depth: 14,
        engine_source: "local_sf18",
        engine_build: "sf18-test-build",
        cp_loss: 10,
      });
      await expect(store.recordCounterfactual("d-406", "d2d4")).rejects.toThrow();
    });

    it("answers once", async () => {
      await store.commitDecision(probed(407));
      await store.recordCounterfactual("d-407", "d2d4");
      // Append-only, enforced by the primary key rather than by a guard this class wrote.
      await expect(store.recordCounterfactual("d-407", "g1f3")).rejects.toThrow();
    });

    it("refuses a price for an answer that named no move", async () => {
      await store.commitDecision(probed(408));
      await store.recordCounterfactual("d-408", null);
      await expect(store.scoreCounterfactual("d-408", 240)).rejects.toThrow();
    });

    it("carries the probe through listAtoms as well as getAtom", async () => {
      /*
       * TWO READ PATHS, AND ONLY ONE OF THEM FEEDS THE DASHBOARD. `getAtom` joins one row;
       * `listAtoms` builds a map over the whole table, and it is what `recordReading` calls. A
       * probe that arrived through one and not the other would leave every screen empty while
       * every single-decision test passed.
       */
      await store.commitDecision(probed(409));
      await store.recordCounterfactual("d-409", "g1f3");
      const listed = (await store.listAtoms("game-1")).find((a) => a.decision === "e2e4" && a.probe?.alternative === "g1f3");
      expect(listed, "the probe did not survive listAtoms").toBeTruthy();
      expect(listed?.probe?.answered).toBe(true);
    });
  });

  /**
   * The two stores said different things about when a claim was last evaluated.
   *
   * `claims.last_evaluated_at` carried `ON UPDATE NOW()` and `drill_results.recorded_at` carried
   * `defaultNow()`, and neither write passed a value -- so MySQL stamped the moment the statement
   * ran while MemoryRecordStore kept what the service reported. Probed side by side before this
   * test existed: the service wrote `2026-02-02T10:00:00Z`, memory returned it, MySQL returned
   * the wall clock. Every test in this repository except this file's runs against the in-memory
   * store, so nothing could see it.
   *
   * It matters more since `evaluateClaim` became a fold, because the fold ORDERS BY
   * `recorded_at`. Ordering by when a row was written and grading by when a drill was reported
   * are the same thing only until something is replayed.
   *
   * ASSERTED AS AGREEMENT BETWEEN THE STORES, not as one store's behaviour. An interface is not a
   * proof: two classes can satisfy the same types and disagree about what the data means, and
   * these two did.
   */
  describe("the two stores agree about when a claim was evaluated", () => {
    const CREATED_AT = "2026-01-01T00:00:00.000Z";
    const REPORTED_AT = "2026-02-02T10:00:00.000Z";

    const claim = {
      claim_id: "claim-timestamps",
      statement: "תחת לחץ זמן אתם בטוחים יותר משאתם מדויקים",
      scope: "החלטות מהירות",
      supporting_decision_ids: ["d-001"],
      n: 40,
      grade: "hypothesis" as const,
      refutation_condition: "פער הביטחון לא ישוחזר בבדיקה קדימה",
      // "בטוחים יותר משאתם מדויקים" -- overconfidence, so the flag agrees with the sentence.
      predicts_overconfidence: true,
      graded_under: null,
      prospective_tests: [],
      created_at: CREATED_AT,
      last_evaluated_at: CREATED_AT,
    };
    const result = {
      kind: "prospective_drill_result" as const,
      protocol: "position-drill" as const,
      drill_id: "drill-timestamps",
      claim_id: claim.claim_id,
      decision_ids: ["dd-1", "dd-2", "dd-3"],
      predicted: true,
      observed: true,
      recorded_at: REPORTED_AT,
    };

    async function roundTrip(target: typeof store | InstanceType<typeof MemoryRecordStore>) {
      await target.saveClaim(claim);
      await target.saveDrillResult(result);
      await target.saveClaim({ ...claim, grade: "replicated", last_evaluated_at: REPORTED_AT });
      return target.getClaim(claim.claim_id);
    }

    it("keeps the date the drill was reported, in MySQL as well as in memory", async () => {
      const fromMysql = await roundTrip(store);
      const fromMemory = await roundTrip(new MemoryRecordStore());

      for (const [name, stored] of [["MySQL", fromMysql], ["memory", fromMemory]] as const) {
        expect(stored?.grade, `${name} lost the grade`).toBe("replicated");
        expect(stored?.last_evaluated_at, `${name} stamped its own clock`).toBe(REPORTED_AT);
        expect(stored?.created_at, `${name} rewrote when the claim was formed`).toBe(CREATED_AT);
        expect(stored?.prospective_tests, `${name} lost the drill result`).toHaveLength(1);
        expect(stored?.prospective_tests[0].recorded_at, `${name} restamped the result`).toBe(
          REPORTED_AT,
        );
        /*
         * Named rather than left to the toEqual below, because this one is a SIGN and losing it
         * does not look like a loss. A claim that comes back without its direction cannot be
         * drilled at all, and a claim that comes back with the wrong one is graded backwards --
         * `evaluateRefutation` is one-sided, so the two outcomes are a refusal and a false
         * refutation, not a missing field and a present one.
         */
        expect(stored?.predicts_overconfidence, `${name} lost which way the claim points`).toBe(
          true,
        );
      }
      expect(fromMysql).toEqual(fromMemory);
    });

    it("agrees on a claim that never recorded a direction, rather than one store inventing one", async () => {
      /*
       * The tri-state is the thing to check across stores, and it is exactly where the two
       * timestamp divergences this block was written for came from: a nullable MySQL column and
       * an in-memory object are not obliged to disagree, they just usually do. Absent must arrive
       * as `null` from both, because `createDrill` distinguishes "no direction recorded" from
       * `false`, and `false` is a real direction that would be silently tested.
       */
      const legacy = { ...claim, claim_id: "claim-no-direction", predicts_overconfidence: null };
      await store.saveClaim(legacy);
      await new MemoryRecordStore().saveClaim(legacy);
      const fromMysql = await store.getClaim(legacy.claim_id);
      expect(fromMysql?.predicts_overconfidence, "MySQL invented a direction").toBeNull();

      const memory = new MemoryRecordStore();
      await memory.saveClaim(legacy);
      expect(
        (await memory.getClaim(legacy.claim_id))?.predicts_overconfidence,
        "memory invented a direction",
      ).toBeNull();
    });
  });
});
