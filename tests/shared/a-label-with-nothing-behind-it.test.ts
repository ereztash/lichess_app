/**
 * R-07: `purpose` was the one thing on the atom the boundary had to believe.
 *
 * EVERYTHING ELSE IS RE-DERIVED, AND FOR A STATED REASON. The phase comes back from the FEN, the
 * legal-move count from the position, whether the read fields were required from `readsAreAsked`,
 * and bank membership from the position itself — *precisely so a wrong label cannot bias what the
 * record is later divided by*. Why a position was in front of a player is a fact about the client's
 * loop, and nothing on the wire proved it.
 *
 * WHY `drill` IS THE LABEL WORTH BINDING, out of six. It is the one that moves a decision ACROSS
 * the wall `shared/evidence-policy.ts` draws. A drill selects positions BECAUSE of a weakness and
 * tells the player what is being tested before collecting the evidence, so discovery refuses its
 * output outright — otherwise the attempt to fix a weakness manufactures the next one. A drill
 * decision mislabelled `play` walks straight into that loop; a free-play decision mislabelled
 * `drill` is quietly excluded from the population it belongs to. One field, both directions.
 *
 * THE BINDING IS TO AN OBJECT WRITTEN DOWN FIRST. R5 requires a drill to store its positions and
 * its refutation condition before it runs, so "this position is one the drill registered" is a
 * claim about something that already existed when the decision was made. That is what makes it a
 * check rather than a second label.
 *
 * WHAT IS STILL THE CLIENT'S WORD, said rather than papered over: `transfer`. A transfer decision
 * names no transfer. It is the smaller hole — a transfer's own observations are written through
 * `recordTransferObservation`, which knows which transfer it is inside — but it is a hole.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { commitDecision, RecordError, type CommitEvent } from "@shared/record-service";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { classifyPhase } from "@shared/phase";
import { registerDrill } from "../fixtures/registered-drill";

const DRILLED = "8/8/8/8/8/5k2/6p1/6K1 w - - 0 60";
const ELSEWHERE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let n = 0;
const nextId = () => `${(n += 1).toString().padStart(8, "0")}-1111-4111-8111-111111111111`;

const event = (over: Partial<CommitEvent> = {}): CommitEvent => {
  const fen = over.entry_state?.fen ?? DRILLED;
  return {
    decision_id: nextId(),
    entry_state: { game_id: "g", fen, ply: 60, phase: classifyPhase(fen, 60), clock_ms_remaining: null },
    purpose: "drill",
    drill_id: null,
    known: "המלך שלו קרוב לרגל",
    unknown: "לא יודע אם אספיק לחזור",
    known_parts: null,
    unknown_parts: null,
    decision: "g1f1",
    bounded_action: {
      seconds_taken: 20,
      confidence: 5,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: ["g1f1"],
    },
    probe: null,
    reveal_timing: "per-decision",
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    result: null,
    feedback: null,
    ...over,
  };
};

const refusal = async (store: MemoryRecordStore, sent: CommitEvent) => {
  const error = await commitDecision(store, sent).catch((e: unknown) => e);
  expect(error, "the boundary accepted the claim").toBeInstanceOf(RecordError);
  return error as RecordError;
};

describe("a label with nothing behind it", () => {
  describe("what the boundary now refuses", () => {
    it("refuses a decision that claims to be a drill and names none", async () => {
      const store = new MemoryRecordStore();
      const error = await refusal(store, event({ drill_id: null }));
      expect(error.message).toContain("תרגול");
      /* R2: refused means not stored, not stored-and-flagged. */
      expect(await store.listAtoms()).toHaveLength(0);
    });

    it("refuses a drill id that names no drill this record holds", async () => {
      /*
       * The id alone proves nothing. Without this, any string in the field would satisfy a check
       * that only asked whether one was sent.
       */
      const store = new MemoryRecordStore();
      await refusal(store, event({ drill_id: "a-drill-that-was-never-started" }));
    });

    it("refuses a position the named drill does not contain, which is the check that matters", async () => {
      /*
       * THE LAUNDERING THIS CLOSES, and the reason the first two checks are not enough on their
       * own. With only "an id was sent" and "the drill exists", a player could answer forty
       * ordinary positions while carrying one stale drill id and have every one of them excluded
       * from discovery — the label doing exactly what it was trusted not to do, now with a
       * plausible-looking binding attached.
       */
      const store = new MemoryRecordStore();
      const drillId = await registerDrill(store, [DRILLED]);
      await refusal(
        store,
        event({
          drill_id: drillId,
          entry_state: {
            game_id: "g",
            fen: ELSEWHERE,
            ply: 0,
            phase: classifyPhase(ELSEWHERE, 0),
            clock_ms_remaining: null,
          },
        }),
      );
    });

    it("refuses a decision that names a drill and does not claim to be one", async () => {
      /*
       * TWO STATEMENTS THAT CANNOT BOTH BE TRUE, and neither repair is safe. Dropping the id keeps
       * a decision that thought it was part of a drill; keeping it files a `play` decision under a
       * drill, where a later reading would scope it to that drill's verdict.
       */
      const store = new MemoryRecordStore();
      const drillId = await registerDrill(store, [DRILLED]);
      const error = await refusal(store, event({ purpose: "play", drill_id: drillId }));
      expect(error.message).toContain("שתי האמירות");
    });

    it("says what happened, in words about this decision rather than about a field", async () => {
      // R2 again: "drill_id is required" describes a form. These say what the record refused to do.
      const store = new MemoryRecordStore();
      const error = await refusal(store, event({ drill_id: "no-such-drill" }));
      expect(error.message).not.toContain("drill_id");
      expect(error.message.length).toBeGreaterThan(20);
    });
  });

  describe("what it still accepts, or the check would just be a wall", () => {
    it("accepts a drill decision on a position the drill registered", async () => {
      const store = new MemoryRecordStore();
      const drillId = await registerDrill(store, [DRILLED]);
      const sent = event({ drill_id: drillId });
      await commitDecision(store, sent);
      const atom = await store.getAtom(sent.decision_id);
      expect(atom?.purpose).toBe("drill");
      expect(atom?.drill_id, "the binding did not survive the write").toBe(drillId);
    });

    it("leaves every other purpose exactly as it was", async () => {
      /*
       * The control. A check that refused more than drills would satisfy the group above and break
       * the product: `play` is most of the record and carries no drill.
       */
      const store = new MemoryRecordStore();
      for (const purpose of ["play", "import", "transfer"] as const) {
        const sent = event({ purpose, drill_id: null });
        await commitDecision(store, sent);
        expect((await store.getAtom(sent.decision_id))?.purpose).toBe(purpose);
      }
    });

    it("carries null on the atom for a decision that is not a drill", async () => {
      // Null rather than absent: every atom has the key, so a reading never has to ask whether the
      // row is old enough to have it.
      const store = new MemoryRecordStore();
      const sent = event({ purpose: "play", drill_id: null });
      await commitDecision(store, sent);
      const atom = await store.getAtom(sent.decision_id);
      expect(atom).toHaveProperty("drill_id");
      expect(atom?.drill_id).toBeNull();
    });

    it("accepts a client that predates the field, which is what optional is for", async () => {
      /*
       * An older client sends neither `purpose` nor `drill_id`. It is still welcome to commit --
       * with the read fields, since an unstamped decision cannot claim the first-decision exemption
       * -- and its row says it named no purpose rather than claiming one it cannot back up.
       */
      const store = new MemoryRecordStore();
      const sent = event({ purpose: undefined, drill_id: undefined });
      await commitDecision(store, sent);
      const atom = await store.getAtom(sent.decision_id);
      expect(atom?.purpose).toBeNull();
      expect(atom?.drill_id).toBeNull();
    });
  });
});
