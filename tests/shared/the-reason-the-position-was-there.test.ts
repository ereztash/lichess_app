/**
 * The purpose is on the record, and what that lets the record refuse.
 *
 * WHAT WAS WRONG. `purpose` decided two things about every decision this product has ever
 * written -- whether the confidence question was put, and (since the opening decision stopped
 * charging for the words) whether the two read fields were required -- and then it was thrown
 * away at write. It was derived in `Home`, consumed by `confidenceIsAsked` and `draftProblems`,
 * and absent from `ATOM_FIELDS`, from `decisionAtomSchema` and from both stores. The record held
 * the consequences of a rule and not the fact the rule turned on.
 *
 * THE COMMENT THAT SAID SO WAS ITSELF WRONG FIRST, which is the part worth keeping. The doc on
 * `ALWAYS` in shared/confidence-asked.ts claimed `first` was "stamped as its own purpose so an
 * analysis can condition it out" -- describing a record that did not exist, in the file that
 * defines the rule, in a repository whose whole discipline is that a sentence must not say more
 * than the measurement behind it.
 *
 * THREE THINGS BECOME POSSIBLE AND THIS FILE HOLDS ALL THREE. The boundary can ask "was this
 * decision ALLOWED to arrive without the two read fields" and refuse when the answer is no. An
 * analysis can separate first decisions, and live decisions from ones taken over a game already
 * played. And a row that predates the field is readable AS one, rather than silently filed under
 * the commonest value.
 */
import { describe, expect, it } from "vitest";
import { commitDecision, RecordError, type CommitEvent } from "@shared/record-service";
import { MemoryRecordStore } from "../../server/record";
import { commitEventSchema } from "../../server/recordRouter";
import { decisionAtomSchema, ATOM_FIELDS } from "@shared/decision-atom";
import {
  DECISION_PURPOSES,
  decisionPurposeFor,
  type DecisionPurpose,
  type PurposeInputs,
} from "@shared/confidence-asked";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { classifyPhase } from "@shared/phase";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let next = 0;
const id = () => `11111111-1111-4111-8111-${String(++next).padStart(12, "0")}`;

const event = (over: Partial<CommitEvent> = {}): CommitEvent => ({
  decision_id: id(),
  entry_state: { game_id: "g", fen: FEN, ply: 0, phase: "opening", clock_ms_remaining: null },
  purpose: "play",
  known: "המרכז פתוח",
  unknown: "לא יודע איך הוא יענה",
  known_parts: { tapped: ["המרכז פתוח"], typed: "" },
  unknown_parts: { tapped: ["לא יודע איך הוא יענה"], typed: "" },
  decision: "e2e4",
  bounded_action: {
    seconds_taken: 9,
    confidence: 5,
    confidence_scale: CONFIDENCE_LEVELS,
    candidate_moves_considered: ["e2e4"],
  },
  probe: { assignment: "not-probed", legal_moves: 20, alternative: null, answered: false, alternative_cp_loss: null },
  reveal_timing: "per-decision",
  result: null,
  feedback: null,
  ...over,
});

/** Commit through the shared service -- the path BOTH the browser record and the server run. */
async function committed(over: Partial<CommitEvent> = {}) {
  const store = new MemoryRecordStore();
  const sent = event(over);
  await commitDecision(store, sent);
  return (await store.getAtom(sent.decision_id))!;
}

describe("the purpose survives the write", () => {
  it("comes back on the atom, for every purpose the product can produce", async () => {
    for (const purpose of DECISION_PURPOSES) {
      /*
       * `anchor` gets a real bank position, because the service verifies that binding: bank
       * membership is a property of the FEN, so a decision claiming to be a bank answer has to be
       * on one. `first` is the one purpose allowed an empty read; it is committed with a full one.
       */
      const atom = await committed(
        purpose === "anchor"
          ? {
              purpose,
              entry_state: {
                game_id: "g",
                fen: ANCHOR_POSITIONS[0].fen,
                ply: 30,
                phase: classifyPhase(ANCHOR_POSITIONS[0].fen, 30),
                clock_ms_remaining: null,
              },
              // The legal-move count is re-derived too, and this board is not the starting one.
              probe: null,
            }
          : { purpose },
      );
      expect(atom.purpose, `${purpose} did not survive the round trip`).toBe(purpose);
    }
  });

  it("is a field of the atom in all three layers, in the atom's own order", () => {
    /*
     * GATE-ISO owns this across the three runtime artifacts. What is asserted here is narrower and
     * is about THIS field: a zod object silently drops what it does not name, so a `purpose`
     * missing from the wire schema would make the whole change a no-op over HTTP while every test
     * that calls the service directly went on passing. That is not hypothetical -- it is the
     * failure `known_parts` records having had, in a comment on this very schema.
     */
    expect(ATOM_FIELDS).toContain("purpose");
    expect(Object.keys(decisionAtomSchema.shape)).toEqual([...ATOM_FIELDS]);
    const parsed = commitEventSchema.parse(event({ purpose: "drill" }));
    expect(parsed.purpose, "the wire schema dropped the purpose").toBe("drill");
  });

  it("stores null rather than a default when a client sends none", async () => {
    /*
     * NOT `play`. The unstamped era holds bank positions, drills and transfer checks as well as
     * ordinary moves, so the commonest value is not a tidy default -- it would file every drill of
     * that era as free play and corrupt the one comparison drills exist to support.
     */
    const atom = await committed({ purpose: undefined });
    expect(atom.purpose).toBeNull();
  });

  it("keeps the purpose out of what the server re-derives", async () => {
    /*
     * The phase is recomputed from the FEN and the legal-move count from the position, because
     * everything the record is later divided by has to be re-derived rather than believed. This
     * one cannot be: nothing on the wire proves why a client put a position in front of someone.
     * It is stored as sent, and that is a property worth pinning -- a future "correction" here
     * would be the server inventing a fact it has no way to know.
     */
    const atom = await committed({ purpose: "drill" });
    expect(atom.purpose).toBe("drill");
    // The phase, by contrast, is the server's answer and not the client's.
    expect(atom.entry_state.phase).toBe("opening");
  });
});

describe("the exemption is a rule the record can now enforce", () => {
  const silent = { known: "", unknown: "", known_parts: null, unknown_parts: null };

  it("accepts an opening decision that said neither read", async () => {
    const atom = await committed({ purpose: "first", ...silent });
    expect(atom.known).toBe("");
    expect(atom.purpose).toBe("first");
  });

  it("refuses the same silence from every other purpose", async () => {
    for (const purpose of DECISION_PURPOSES.filter((p) => p !== "first")) {
      await expect(
        committed({ purpose, ...silent }),
        `${purpose} was allowed to skip both read fields`,
      ).rejects.toBeInstanceOf(RecordError);
    }
  });

  it("refuses it from a decision that names no purpose", async () => {
    /*
     * OMISSION IS NOT AN EXEMPTION. If an absent purpose were treated as permission, dropping the
     * field would BE the way to skip the questions, and a guard re-openable by omission is not a
     * guard. An unstamped client is still perfectly welcome to commit -- with the read fields.
     */
    await expect(committed({ purpose: undefined, ...silent })).rejects.toBeInstanceOf(RecordError);
  });

  it("refuses a half-empty read, so one field cannot be dropped alone", async () => {
    await expect(
      committed({ purpose: "play", known: "", known_parts: null }),
    ).rejects.toBeInstanceOf(RecordError);
  });

  it("says which decision the exemption belongs to, rather than naming a field", async () => {
    // R2: a refusal that says "known is required" describes a form, not what actually happened.
    const error = await committed({ purpose: "play", ...silent }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RecordError);
    expect((error as RecordError).message).toContain("ההחלטה הראשונה");
  });
});

describe("the exemption reaches the wire, which it did not before", () => {
  /*
   * THE DEFECT THIS GROUP EXISTS FOR. The opening decision stopped requiring the two read fields
   * one commit before this one, and `commitEventSchema` kept `min(1)` on both -- so the exemption
   * was unreachable over HTTP: a first decision made against a server was refused at the boundary
   * with a validation error naming a field the player had deliberately not been asked for. It
   * worked only in the browser-record deployment, where nothing runs that schema, and no test
   * could see it because every test of the exemption calls the service directly.
   */
  const silent = { known: "", unknown: "", known_parts: null, unknown_parts: null };

  it("parses an opening decision with neither read field", () => {
    const parsed = commitEventSchema.safeParse(event({ purpose: "first", ...silent }));
    expect(parsed.success, "the wire schema refused a decision the product allows").toBe(true);
  });

  it("leaves the refusal to the service, so one rule holds on both paths", () => {
    /*
     * The schema no longer decides this and that is deliberate: a zod message names a field, and
     * the rule is about a decision. `commitDecision` refuses it in Hebrew a player can read, and
     * the browser record runs the same function.
     */
    expect(commitEventSchema.safeParse(event({ purpose: "play", ...silent })).success).toBe(true);
  });
});

describe("which purpose a position gets", () => {
  const at = (over: Partial<PurposeInputs>): DecisionPurpose =>
    decisionPurposeFor({
      inLearningTransfer: false,
      inDrill: false,
      isAnchor: false,
      isFirstDecision: false,
      isLiveGame: true,
      ...over,
    });

  it("tells a live decision from one taken over a game already played", () => {
    /*
     * THE BRANCH THE STAMP MADE NECESSARY. Every non-live source used to land on `play`, and while
     * the value was derived and discarded that cost nothing -- the ask rule samples both the same
     * way, so no behaviour depended on it. Written down, it is a claim about which loop produced
     * the decision, and `play` on a game finished last week is a false one.
     */
    expect(at({ isLiveGame: true })).toBe("play");
    expect(at({ isLiveGame: false }), "a game already over was recorded as a live move").toBe(
      "import",
    );
  });

  it("keeps the handoff's own decision a first decision, not an import", () => {
    // The front door hands over a position from a game the player already played. It is both.
    expect(at({ isFirstDecision: true, isLiveGame: false })).toBe("first");
  });

  it("keeps a bank position an anchor however it was served", () => {
    // The bank is handed into the ordinary board as a finished game; the FEN is what identifies it.
    expect(at({ isAnchor: true, isLiveGame: false })).toBe("anchor");
  });

  it("calls a drill a drill even on a bank position", () => {
    // What is being measured is the drill. Two names on one decision is one name too many.
    expect(at({ inDrill: true, isAnchor: true })).toBe("drill");
    expect(at({ inLearningTransfer: true, inDrill: true })).toBe("transfer");
  });

  it("produces only purposes the record can store", () => {
    const combinations: PurposeInputs[] = [];
    for (let mask = 0; mask < 32; mask++) {
      combinations.push({
        inLearningTransfer: Boolean(mask & 1),
        inDrill: Boolean(mask & 2),
        isAnchor: Boolean(mask & 4),
        isFirstDecision: Boolean(mask & 8),
        isLiveGame: Boolean(mask & 16),
      });
    }
    for (const inputs of combinations) {
      expect(DECISION_PURPOSES).toContain(decisionPurposeFor(inputs));
    }
  });
});
