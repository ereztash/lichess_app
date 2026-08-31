// @vitest-environment jsdom
/**
 * R-05: no record, an old record, a damaged record and a record from a newer build are four
 * different facts, and this store used to answer all four with "you have never played".
 *
 * WHAT THE OLD READ DID. `{ ...empty(), ...(JSON.parse(raw) as Partial<Persisted>) }` inside a
 * `try` whose `catch` returned `empty()`. Three consequences, in increasing order of harm:
 *
 *   A key holding the wrong kind of thing passed straight through, so `decisions: "oops"` reached
 *   every reader as a string where an array was declared and threw somewhere far away.
 *
 *   A blob that would not parse READ AS EMPTY. The screen showed a new player.
 *
 *   And then the next write OVERWROTE IT. That is the only place in this product where a player's
 *   record could be destroyed rather than merely mis-read, and it needed no failure of its own --
 *   one damaged byte plus one ordinary commit.
 *
 * A RECORD FROM A NEWER BUILD IS THE SAME MECHANISM WITH NO DAMAGE AT ALL. Load a cached older
 * bundle and the shallow merge reads what it recognises, drops what it does not, and saves the
 * result back. Everything the newer build knew is gone, and nothing failed.
 *
 * WHAT REFUSING COSTS, and why it is the right cost: the blob stays on disk untouched and the
 * session runs from memory. `localRecordDurability()` already reports that as `session-only`, so
 * the player is told the scope of what they are doing, and a later build -- or a repair -- still
 * has the bytes.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  LocalRecordStore,
  LOCAL_RECORD_VERSION,
  localRecordDurability,
  localRecordHealth,
  resetSessionFallbackForTests,
  setLocalRecordIdentity,
} from "../../client/src/lib/local-record-store";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import * as service from "../../shared/record-service";

const KEY = "decision-lab.record.v1";
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const event = (id: string): service.CommitEvent => ({
  decision_id: id,
  entry_state: { game_id: "g1", fen: FEN, ply: 0, phase: "opening", clock_ms_remaining: null },
  known: "המרכז פתוח",
  unknown: "לא יודע אם e5 עובד",
  decision: "e2e4",
  bounded_action: {
    seconds_taken: 12,
    confidence: 3,
    confidence_scale: CONFIDENCE_LEVELS,
    candidate_moves_considered: ["e2e4"],
  },
  probe: null,
  reveal_timing: null,
  measurement_protocol: null,
  protocol_version: null,
  analysis_timing: null,
  result: null,
  feedback: null,
});

/**
 * A version 0 blob: exactly what every build before this one wrote.
 *
 * NOT A GUESS AT THE OLD SHAPE -- it is the shape, minus the keys that arrived later, which is the
 * situation a real browser is in. `counterfactuals`, `blitzGames` and `blitzDecisions` are absent
 * here because they were absent then, and reading them as empty is TRUE of that build rather than
 * a default: it never recorded a counterfactual and never kept a blitz game.
 */
const v0 = () => ({
  decisions: [
    {
      decisionId: "d-old",
      gameId: "g1",
      fen: FEN,
      ply: 0,
      phase: "opening" as const,
      clockMsRemaining: null,
      known: "ידע",
      unknown: "לא ידע",
      decision: "e2e4",
      secondsTaken: 9,
      confidence: 4,
      candidateMovesConsidered: ["e2e4"],
    },
  ],
  reveals: {},
  feedbacks: {},
  claims: {},
  drills: {},
  drillResults: [],
  learningRules: {},
  learningTransfers: {},
  learningTransferObservations: {},
  learningTransferResults: [],
  preregs: [],
  importReadings: [],
});

const store = () => new LocalRecordStore();

beforeEach(() => {
  localStorage.clear();
  setLocalRecordIdentity(null);
  resetSessionFallbackForTests();
});

describe("four things that are not an empty record", () => {
  describe("absent", () => {
    it("says the record is ABSENT, which is the only one of the four that is really empty", async () => {
      expect(await store().listAtoms()).toHaveLength(0);
      expect(localRecordHealth()).toEqual({ kind: "absent" });
      expect(localRecordDurability()).toBe("persistent");
    });
  });

  describe("an old record", () => {
    it("loads a version 0 blob and keeps the meaning it was written with", async () => {
      localStorage.setItem(KEY, JSON.stringify(v0()));
      const atoms = await store().listAtoms();
      expect(atoms).toHaveLength(1);
      /*
       * THE FIELDS THAT DID NOT EXIST THEN RESOLVE TO WHAT THEIR ABSENCE MEANT, not to a default.
       * A row with no `purpose` is not a `play` decision -- it comes from the era when the purpose
       * was derived at render time and thrown away -- and a row with no `confidence_scale` was
       * answered on the five-level scale, which is a fact about its age.
       */
      expect(atoms[0].purpose).toBeNull();
      expect(atoms[0].bounded_action.confidence_scale).toBeUndefined();
      expect(atoms[0].bounded_action.confidence).toBe(4);
      expect(atoms[0].result).toBeNull();
      expect(localRecordHealth()).toEqual({ kind: "loaded", version: 0, unreadableKeys: [] });
    });

    it("stamps the version on the way out, so it is only read as version 0 once", async () => {
      localStorage.setItem(KEY, JSON.stringify(v0()));
      await service.commitDecision(store(), event("d-new"));
      const written = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      expect(written.version).toBe(LOCAL_RECORD_VERSION);
      // And the upgrade did not cost the row that was already there.
      expect(written.decisions).toHaveLength(2);
    });

    it("keeps the keys a later build added out of the blob's meaning", async () => {
      /*
       * The half that makes the version worth having. `blitzGames` absent from a version 0 blob is
       * not "this player has no blitz games recorded yet" reached by a default -- that build could
       * not keep one at all. Reading it as empty is the only true statement available, and it
       * happens to be the same value, which is exactly why the version has to be written down:
       * the next change will not be so lucky.
       */
      localStorage.setItem(KEY, JSON.stringify(v0()));
      expect(await store().listBlitzGames()).toEqual([]);
      expect(localRecordHealth()).toMatchObject({ version: 0 });
    });
  });

  describe("a damaged record", () => {
    it("REFUSES a blob that is not JSON, and says so rather than reporting an empty record", async () => {
      localStorage.setItem(KEY, "{not json at all");
      expect(await store().listAtoms()).toHaveLength(0);
      expect(localRecordHealth()).toEqual({
        kind: "unreadable",
        because: "not-json",
        version: null,
      });
    });

    it("DOES NOT OVERWRITE IT when the session goes on writing", async () => {
      /*
       * THE ASSERTION THIS FILE EXISTS FOR. The old code read the damaged blob as empty and the
       * next commit saved an empty record over it, so one damaged byte plus one ordinary move
       * destroyed everything the player had. Nothing else in this product can lose a record.
       */
      const damaged = '{"decisions":[{"decisionId":"d-old"';
      localStorage.setItem(KEY, damaged);
      await service.commitDecision(store(), event("d-new"));
      expect(localStorage.getItem(KEY), "the damaged record was overwritten").toBe(damaged);
    });

    it("still lets the player use the product, and says the scope out loud", async () => {
      // Refusing to read must not refuse to work: the session runs from memory and reports it.
      localStorage.setItem(KEY, "{not json at all");
      await service.commitDecision(store(), event("d-new"));
      expect(await store().listAtoms()).toHaveLength(1);
      expect(localRecordDurability()).toBe("session-only");
    });

    it("refuses JSON that is not an object, which parses perfectly and means nothing", async () => {
      localStorage.setItem(KEY, JSON.stringify([1, 2, 3]));
      expect(await store().listAtoms()).toHaveLength(0);
      expect(localRecordHealth()).toMatchObject({ kind: "unreadable", because: "not-an-object" });
    });

    it("refuses a blob whose version is not a version", async () => {
      localStorage.setItem(KEY, JSON.stringify({ ...v0(), version: "one" }));
      expect(localStorage.getItem(KEY)).toContain('"one"');
      expect(await store().listAtoms()).toHaveLength(0);
      expect(localRecordHealth()).toMatchObject({ kind: "unreadable" });
    });
  });

  describe("a key that cannot be interpreted, with the record around it still readable", () => {
    it("keeps every other key and NAMES the one it could not read", async () => {
      /*
       * The gate's second clause. Losing the whole record because one key is damaged is the same
       * failure as reading a damaged record as an empty one, one layer along -- so the cost of a
       * broken `claims` key is the claims, and nothing else.
       */
      localStorage.setItem(KEY, JSON.stringify({ ...v0(), claims: "oops" }));
      const atoms = await store().listAtoms();
      expect(atoms, "a broken claims key cost the decisions").toHaveLength(1);
      expect(await store().getClaim("any-claim")).toBeNull();
      expect(localRecordHealth()).toEqual({
        kind: "loaded",
        version: 0,
        unreadableKeys: ["claims"],
      });
    });

    it("tells a key of the WRONG KIND from a key that is simply absent", async () => {
      /*
       * Both end up as an empty collection, and they are not the same fact: absent means the build
       * that wrote this never had the key, and wrong-kind means something damaged it. Only the
       * second is named, which is what makes the name worth reading.
       */
      localStorage.setItem(KEY, JSON.stringify({ ...v0(), decisions: { "0": "not-an-array" } }));
      expect(await store().listAtoms()).toHaveLength(0);
      expect(localRecordHealth()).toMatchObject({ unreadableKeys: ["decisions"] });
    });
  });

  describe("a record from a newer build", () => {
    it("REFUSES to read it, because reading it is what would destroy it", async () => {
      /*
       * No damage anywhere. A player loads a cached older bundle, the shallow merge takes what it
       * recognises and drops the rest, and the next save writes the smaller record back over the
       * larger one. Nothing fails and nothing is reported.
       */
      const newer = JSON.stringify({ ...v0(), version: LOCAL_RECORD_VERSION + 1, somethingNew: 1 });
      localStorage.setItem(KEY, newer);
      expect(await store().listAtoms()).toHaveLength(0);
      expect(localRecordHealth()).toEqual({
        kind: "unreadable",
        because: "written-by-a-newer-build",
        version: LOCAL_RECORD_VERSION + 1,
      });
      await service.commitDecision(store(), event("d-new"));
      expect(localStorage.getItem(KEY), "an older build wrote over a newer record").toBe(newer);
    });
  });

  describe("the health belongs to the record, not to the browser", () => {
    it("is recomputed when the identity switches to one whose record is fine", async () => {
      localStorage.setItem(KEY, "{not json at all");
      await store().listAtoms();
      expect(localRecordHealth()).toMatchObject({ kind: "unreadable" });

      setLocalRecordIdentity("someone-else");
      expect(await store().listAtoms()).toHaveLength(0);
      expect(localRecordHealth(), "a damaged record followed the player").toEqual({
        kind: "absent",
      });
    });
  });
});
