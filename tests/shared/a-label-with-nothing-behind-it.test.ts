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
 * AND `transfer` IS THE SECOND LABEL, closed one wave later for the same reason and in the same
 * shape. It was called the smaller hole because a transfer's observations are written through
 * `recordLearningTransferObservation`, which resolves the transfer and checks the position — but
 * that is a SECOND call, made after the decision has already been committed, and nothing obliges a
 * client to make it. The decision was stored carrying the label and no binding, and it is the
 * decision `EVIDENCE_POLICY` reads. Both directions again: discovery refuses a `transfer` decision
 * outright, so a `play` decision mislabelled `transfer` is dropped from the population it belongs
 * to, and a transfer check mislabelled `play` walks the intervention into the evidence meant to
 * test it.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { commitDecision, RecordError, type CommitEvent } from "@shared/record-service";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { classifyPhase } from "@shared/phase";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { registerDrill } from "../fixtures/registered-drill";
import { registerTransfer } from "../fixtures/registered-transfer";

const DRILLED = "8/8/8/8/8/5k2/6p1/6K1 w - - 0 60";
const ELSEWHERE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** A third board, so a transfer can hold the three positions `TRANSFER_POSITION_COUNT` requires. */
const THIRD = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 40";
/** A real bank position: `anchor` is refused on anything else, by the check above the drill's. */
const ANCHOR = ANCHOR_POSITIONS[0].fen;
/** Named in advance by nothing. The board a transfer decision must not be accepted on. */
const UNREGISTERED = "8/8/8/8/3k4/8/3P4/3K4 w - - 0 50";

let n = 0;
const nextId = () => `${(n += 1).toString().padStart(8, "0")}-1111-4111-8111-111111111111`;

const event = (over: Partial<CommitEvent> = {}): CommitEvent => {
  const fen = over.entry_state?.fen ?? DRILLED;
  return {
    decision_id: nextId(),
    entry_state: { game_id: "g", fen, ply: 60, phase: classifyPhase(fen, 60), clock_ms_remaining: null },
    purpose: "drill",
    drill_id: null,
    transfer_id: null,
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

  describe("the same four refusals for `transfer`, which was the other half of R-07", () => {
    /*
     * WHY THE SECOND LABEL AND NOT THE OTHER FOUR. `drill` and `transfer` are the two purposes
     * `EVIDENCE_POLICY` reads as evidence about a NAMED TEST rather than about the player -- both
     * are refused from discovery, and `transfer` is filed as `scoped(to: "matching-transfer")`,
     * which is a sentence about a specific transfer that nothing on the row could identify.
     *
     * The other four need no binding, and saying why is the difference between a rule and a habit.
     * `anchor` is checked already, and checked better: bank membership is a property of the FEN, so
     * the position proves it without an id. `play`, `import` and `first` claim nothing that moves a
     * decision across the wall -- they are the population, not an exception to it.
     */
    const transferEvent = (over: Partial<CommitEvent> = {}) =>
      event({ purpose: "transfer", drill_id: null, ...over });

    it("refuses a decision that claims to be a transfer check and names none", async () => {
      const store = new MemoryRecordStore();
      const error = await refusal(store, transferEvent({ transfer_id: null }));
      expect(error.message).toContain("העברה");
      expect(await store.listAtoms(), "refused means not stored").toHaveLength(0);
    });

    it("refuses a transfer id that names no transfer this record holds", async () => {
      const store = new MemoryRecordStore();
      await refusal(store, transferEvent({ transfer_id: "a-transfer-that-was-never-started" }));
    });

    it("refuses a position the named transfer never registered, which is the check that matters", async () => {
      /*
       * THE CASE THE WHOLE ROW IS FOR: `purpose=transfer`, a transfer id that resolves, and a board
       * that transfer never named. With only the first two checks, one open transfer would launder
       * every decision the player took while it was open -- each one excluded from discovery, each
       * one carrying a binding that looks like provenance and proves nothing about this position.
       *
       * `NAMED_IN_ADVANCE` in `evidence-policy.ts` is the sentence this enforces: *"a transfer is
       * graded on the positions it named in advance"*. Until now that was a comment.
       */
      const store = new MemoryRecordStore();
      const transferId = await registerTransfer(store, [DRILLED, ELSEWHERE, THIRD]);
      const error = await refusal(
        store,
        transferEvent({
          transfer_id: transferId,
          entry_state: {
            game_id: "g",
            fen: UNREGISTERED,
            ply: 50,
            phase: classifyPhase(UNREGISTERED, 50),
            clock_ms_remaining: null,
          },
        }),
      );
      expect(error.message).toContain("מראש");
      expect(await store.listAtoms()).toHaveLength(0);
    });

    it("refuses a decision that names a transfer and does not claim to be one", async () => {
      const store = new MemoryRecordStore();
      const transferId = await registerTransfer(store, [DRILLED, ELSEWHERE, THIRD]);
      const error = await refusal(store, event({ purpose: "play", transfer_id: transferId }));
      expect(error.message).toContain("שתי האמירות");
    });

    it("refuses a decision carrying both a drill and a transfer", async () => {
      /*
       * ONE DECISION IS INSIDE ONE TEST. A run that sent both would be claiming its output belongs
       * to two named tests at once, and `EVIDENCE_POLICY` scopes each to its own -- so a later
       * reading would have to choose, silently. The purpose decides which id is legal and refuses
       * the other, whichever way round the pair arrives.
       */
      const store = new MemoryRecordStore();
      const drillId = await registerDrill(store, [DRILLED]);
      const transferId = await registerTransfer(store, [DRILLED, ELSEWHERE, THIRD]);
      await refusal(store, event({ purpose: "drill", drill_id: drillId, transfer_id: transferId }));
      await refusal(
        store,
        transferEvent({ drill_id: drillId, transfer_id: transferId }),
      );
    });

    it("says what happened in words about this decision, not about a field", async () => {
      const store = new MemoryRecordStore();
      const error = await refusal(store, transferEvent({ transfer_id: "no-such-transfer" }));
      expect(error.message).not.toContain("transfer_id");
      expect(error.message.length).toBeGreaterThan(20);
    });

    it("accepts a transfer decision on a position the transfer named, and keeps the binding", async () => {
      const store = new MemoryRecordStore();
      const transferId = await registerTransfer(store, [DRILLED, ELSEWHERE, THIRD]);
      const sent = transferEvent({ transfer_id: transferId });
      await commitDecision(store, sent);
      const atom = await store.getAtom(sent.decision_id);
      expect(atom?.purpose).toBe("transfer");
      expect(atom?.transfer_id, "the binding did not survive the write").toBe(transferId);
    });

    it("matches the position the way the observation write does, not by string", async () => {
      /*
       * TWO CHECKS OVER ONE FACT, AND THEY MUST AGREE. `recordLearningTransferObservation` finds
       * the slot with `samePosition`, which ignores the halfmove and fullmove counters -- a board
       * reached again later in a game is the position that was written down. If this boundary
       * compared raw FENs, a decision could pass one check and fail the other, and the run would
       * stall between two rules that each think they are right.
       */
      const store = new MemoryRecordStore();
      const transferId = await registerTransfer(store, [DRILLED, ELSEWHERE, THIRD]);
      const laterInTheGame = DRILLED.replace(/ 0 60$/, " 4 78");
      expect(laterInTheGame, "the fixture stopped differing from the registered FEN").not.toBe(
        DRILLED,
      );
      const sent = transferEvent({
        transfer_id: transferId,
        entry_state: {
          game_id: "g",
          fen: laterInTheGame,
          ply: 78,
          phase: classifyPhase(laterInTheGame, 78),
          clock_ms_remaining: null,
        },
      });
      await commitDecision(store, sent);
      expect((await store.getAtom(sent.decision_id))?.transfer_id).toBe(transferId);
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
      const transferId = await registerTransfer(store, [DRILLED, ELSEWHERE, THIRD]);
      for (const purpose of ["play", "import", "anchor", "first", "transfer"] as const) {
        /*
         * `transfer` NEEDS ITS OWN BINDING NOW, and that is the change rather than an exception to
         * it: this loop used to pass a bare `purpose: "transfer"` and the record kept it, which is
         * precisely the hole. `anchor` is on a bank position or it would be refused by the check
         * above it, so it is fed one.
         */
        const sent = event({
          purpose,
          drill_id: null,
          transfer_id: purpose === "transfer" ? transferId : null,
          ...(purpose === "anchor"
            ? {
                entry_state: {
                  game_id: "g",
                  fen: ANCHOR,
                  ply: 20,
                  phase: classifyPhase(ANCHOR, 20),
                  clock_ms_remaining: null,
                },
              }
            : {}),
        });
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
