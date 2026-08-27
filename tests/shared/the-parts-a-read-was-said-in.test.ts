/**
 * The write path for the one measurement the product has about its own vocabulary.
 *
 * `shared/vocabulary-reading.ts` can count how often the menu was escaped, what was typed when it
 * was, which options nobody picks and which two mean the same thing -- but only over decisions
 * that recorded HOW the read was said. Before this, none did: `composeStatement` joined the tapped
 * labels and the typed sentence with " · " and the record kept the join. A reading of a field
 * nothing fills is a reading of nothing, so this file holds the filling.
 *
 * IT HAS TO LAND BEFORE THE TESTERS. Five people is one attempt, and they will generate exactly
 * this data whether or not anything keeps it.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { MemoryRecordStore } from "../../server/record";
import { commitDecision, type CommitEvent } from "@shared/record-service";
import { buildCommitEvent, emptyDraft, type PositionUnderDecision } from "@/lib/decision-session";
import { composeStatement } from "@/lib/read-options";

const POSITION: PositionUnderDecision = {
  gameId: "g",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ply: 0,
  clockMsRemaining: null,
};

const TAPPED = ["המרכז סגור", "מלך חשוף"];
const TYPED = "הרגל על d5 מקובע ואין לי איך לתקוף אותו";

function event(over: { knownTyped?: string; unknownTapped?: string[] } = {}) {
  return buildCommitEvent(
    "11111111-1111-4111-8111-111111111111",
    POSITION,
    {
      ...emptyDraft(),
      chosenMove: "e2e4",
      knownTags: TAPPED,
      known: over.knownTyped ?? TYPED,
      unknownTags: over.unknownTapped ?? ["לא יודע איך הוא יענה"],
      unknown: "",
      confidence: 4,
    },
    12.4,
    "per-decision",
    () => 0.1,
  );
}

describe("the commit event carries how the read was said", () => {
  it("keeps the taps and the typing apart, beside the sentence they compose into", () => {
    const committed = event();
    expect(committed.known_parts).toEqual({ tapped: TAPPED, typed: TYPED });
    expect(committed.unknown_parts).toEqual({ tapped: ["לא יודע איך הוא יענה"], typed: "" });
  });

  it("agrees with the sentence, so the two can never drift apart", () => {
    /*
     * `known` and `known_parts` are the same answer twice: what the player asserted, and how they
     * said it. Redundancy in an append-only record is a hazard -- two sources that can disagree
     * and no way to tell which is right afterwards -- so it is a CHECKED invariant instead. If a
     * later change composes the sentence differently, or reorders the tags, this is where it
     * surfaces rather than six weeks into a trial.
     */
    const committed = event();
    expect(committed.known).toBe(
      composeStatement(committed.known_parts!.tapped, committed.known_parts!.typed),
    );
    expect(committed.unknown).toBe(
      composeStatement(committed.unknown_parts!.tapped, committed.unknown_parts!.typed),
    );
  });

  it("records an untouched free-text box as empty, which is the measurement", () => {
    // Empty `typed` beside a real tap is the list DOING ITS JOB, and that has to be countable.
    const committed = event({ knownTyped: "" });
    expect(committed.known_parts).toEqual({ tapped: TAPPED, typed: "" });
  });

  it("trims, so an abandoned box is not a word the list is missing", () => {
    expect(event({ knownTyped: "   " }).known_parts!.typed).toBe("");
  });
});

describe("the parts survive the write", () => {
  const stored = async (over: Partial<CommitEvent> = {}) => {
    const store = new MemoryRecordStore();
    const committed = { ...event(), ...over } as CommitEvent;
    await commitDecision(store, committed);
    return store.getAtom(committed.decision_id);
  };

  it("comes back off the store exactly as it went in", async () => {
    const atom = await stored();
    expect(atom!.known_parts).toEqual({ tapped: TAPPED, typed: TYPED });
    expect(atom!.unknown_parts).toEqual({ tapped: ["לא יודע איך הוא יענה"], typed: "" });
  });

  it("stores null, not an empty pair, when a client sent no parts at all", async () => {
    /*
     * A client older than this change sends neither field. Writing `{ tapped: [], typed: "" }` for
     * it would assert the player answered with silence, while `known` on the same row plainly
     * holds text -- and every count in the reading would then treat that decision as one where
     * the menu worked.
     */
    const atom = await stored({ known_parts: undefined, unknown_parts: undefined });
    expect(atom!.known_parts).toBeNull();
    expect(atom!.unknown_parts).toBeNull();
    expect(atom!.known.length, "the sentence itself was lost too").toBeGreaterThan(0);
  });
});

describe("the wire schema names them", () => {
  it("does not drop them on the way through HTTP", async () => {
    /*
     * THE FAILURE THIS EXISTS TO CATCH, and it would have been invisible: a zod object DROPS what
     * it does not name. Leaving these out of `commitEventSchema` would have made the whole change
     * a no-op over the network while every local test above passed, because the local store is
     * called directly and never crosses the boundary. The same shape as the CSP that let every
     * test pass on a build the browser refused to make a request from.
     */
    const { commitEventSchema } = await import("../../server/recordRouter");
    const parsed = commitEventSchema.parse(event());
    expect(parsed.known_parts).toEqual({ tapped: TAPPED, typed: TYPED });
    expect(parsed.unknown_parts).toEqual({ tapped: ["לא יודע איך הוא יענה"], typed: "" });
  });

  it("accepts a client that sends neither", async () => {
    const { commitEventSchema } = await import("../../server/recordRouter");
    const { known_parts, unknown_parts, ...older } = event();
    expect(known_parts).toBeTruthy();
    expect(unknown_parts).toBeTruthy();
    const parsed = commitEventSchema.parse(older);
    expect(parsed.known_parts).toBeUndefined();
  });
});
