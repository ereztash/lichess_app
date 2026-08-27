// @vitest-environment jsdom
/**
 * The two read fields, required everywhere except the one decision where nobody has been taught
 * the rule yet.
 *
 * WHAT THEY ARE FOR, WHICH IS NOT WHAT THEY LOOK LIKE. `known` and `unknown` are the ordering rule
 * -- R3 says the player states what they can read BEFORE the engine speaks -- and nothing
 * downstream reads them: the detector never looks at either, and `vocabulary-reading` reads the
 * PARTS to measure the menu rather than the answer. So the cost is paid on every decision and what
 * is bought is the discipline.
 *
 * ON THE OPENING DECISION THAT TRADE IS THE WRONG WAY ROUND. It is the one moment the player has
 * not yet seen what the loop asks, so a wall of required fields IS their first impression of the
 * product, and a rule nobody has been taught is not discipline -- it is a toll. One decision per
 * game is a bounded exemption.
 *
 * NOTHING TESTED THE REQUIREMENT BEFORE THIS FILE, which is how the exemption landed with 1,609
 * tests still green. Every existing test supplies both fields, so relaxing the rule broke none of
 * them -- a rule enforced in one branch and asserted nowhere. That is recorded here because the
 * silence was the finding, not the fix.
 */
import { describe, expect, it } from "vitest";
import {
  buildCommitEvent,
  draftProblems,
  emptyDraft,
  isCommittable,
  type PositionUnderDecision,
} from "@/lib/decision-session";
import { decisionAtomSchema } from "@shared/decision-atom";
import { readVocabulary } from "@shared/vocabulary-reading";
import { CONFIDENCE_LEVELS } from "@shared/confidence";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Two plies of the same game, on opposite sides of the draw.
 *
 * The read fields are no longer required on every ordinary decision -- they are asked on the same
 * decisions the confidence question is, so that a decision is either fully instrumented or a move
 * and nothing else. `drawForDecision("live-1", FEN, ...)` puts ply 3 at 0.1221 (under the 0.15
 * rate, so asked) and ply 0 at 0.7015 (over it, so passed over). Pinned as constants because a
 * fixture that happened to sit on one side of the line would make the pair below vacuous.
 */
const DRAWN_PLY = 3;
const PASSED_OVER_PLY = 0;

const at = (
  purpose: PositionUnderDecision["purpose"],
  ply = DRAWN_PLY,
): PositionUnderDecision => ({
  gameId: "live-1",
  fen: FEN,
  ply,
  clockMsRemaining: null,
  purpose,
});

/** A move and a confidence, and neither read field said. */
const silent = () => ({ ...emptyDraft(), chosenMove: "e2e4", confidence: 5 });

describe("the opening decision does not charge for the words", () => {
  it("commits with a move alone", () => {
    expect(draftProblems(silent(), at("first"))).toEqual([]);
    expect(isCommittable(silent(), at("first"))).toBe(true);
  });

  it("still refuses the same silence on an ordinary decision the draw selected", () => {
    /*
     * The half that makes the exemption an exemption rather than a removal. Without this the test
     * above would pass just as well against a build that asks for nothing anywhere.
     */
    const fields = draftProblems(silent(), at("play", DRAWN_PLY)).map((problem) => problem.field);
    expect(fields).toContain("known");
    expect(fields).toContain("unknown");
  });

  it("does not charge for the words on an ordinary decision the draw passed over", () => {
    /*
     * REPORTED FROM ACTUAL PLAY. The two read fields were required on every decision but the
     * first, so an ordinary turn cost three steps -- and on six decisions in seven nothing would
     * ever read two of them: the detector never looks at either, and the vocabulary reading reads
     * the PARTS to measure the menu. The words are now asked exactly where a confidence is, so a
     * decision is either fully instrumented or a move.
     */
    expect(draftProblems(silent(), at("play", PASSED_OVER_PLY))).toEqual([]);
    expect(isCommittable(silent(), at("play", PASSED_OVER_PLY))).toBe(true);
  });

  it("still refuses it on the bank, a drill and a transfer check", () => {
    for (const purpose of ["anchor", "drill", "transfer"] as const) {
      expect(
        draftProblems(silent(), at(purpose)).length,
        `${purpose} stopped requiring the read`,
      ).toBeGreaterThan(0);
    }
  });

  it("still requires the move itself, which was never the toll", () => {
    const problems = draftProblems({ ...emptyDraft(), confidence: 5 }, at("first"));
    expect(problems.map((problem) => problem.field)).toContain("chosenMove");
  });

  it("takes the answer when a first decision does give one", () => {
    const draft = { ...silent(), knownTags: ["המרכז פתוח"], unknown: "לא יודע איך הוא יענה" };
    const event = buildCommitEvent("11111111-1111-4111-8111-111111111111", at("first"), draft, 9, "per-decision");
    expect(event.known_parts).toEqual({ tapped: ["המרכז פתוח"], typed: "" });
    expect(event.unknown_parts).toEqual({ tapped: [], typed: "לא יודע איך הוא יענה" });
  });
});

describe("an unanswered read is a hole, not a zero", () => {
  const event = () =>
    buildCommitEvent("22222222-2222-4222-8222-222222222222", at("first"), silent(), 9, "per-decision");

  it("writes null parts rather than an empty pair", () => {
    /*
     * THE WHOLE REASON THE EXEMPTION IS SAFE. `{ tapped: [], typed: "" }` would enter
     * `vocabulary-reading`'s `recorded` count as a decision where the menu WAS put and the player
     * picked nothing -- which reads as the list failing. It did not fail; it was not put.
     */
    const committed = event();
    expect(committed.known_parts).toBeNull();
    expect(committed.unknown_parts).toBeNull();
    expect(committed.known).toBe("");
  });

  it("is counted out of the vocabulary reading rather than averaged into it", () => {
    const committed = event();
    const answered = buildCommitEvent(
      "33333333-3333-4333-8333-333333333333",
      at("play"),
      { ...silent(), knownTags: ["המרכז פתוח"], unknownTags: ["לא יודע איך הוא יענה"] },
      9,
      "per-decision",
    );
    const reading = readVocabulary(
      [
        { knownParts: committed.known_parts, unknownParts: committed.unknown_parts },
        { knownParts: answered.known_parts, unknownParts: answered.unknown_parts },
      ],
      { known: ["המרכז פתוח"], unknown: ["לא יודע איך הוא יענה"] },
    );
    expect(reading.known.recorded, "the unanswered decision was counted as an answer").toBe(1);
    expect(reading.known.unrecorded, "the size of the hole is not stated").toBe(1);
    expect(reading.known.escaped, "an unasked field was read as the menu working").toBe(0);
  });
});

describe("the schema keeps a guard where min(1) used to be", () => {
  const atom = (over: Record<string, unknown>) => ({
    entry_state: {
      game_id: "g",
      fen: FEN,
      ply: 0,
      phase: "opening" as const,
      clock_ms_remaining: null,
    },
    /*
     * The exemption's own condition, now that the record carries it. The default is the decision
     * the exemption is FOR, so each case below states the purpose it is actually about instead of
     * inheriting one silently.
     */
    purpose: "first" as const,
    known: "",
    unknown: "",
    known_parts: null,
    unknown_parts: null,
    decision: "e2e4",
    bounded_action: {
      seconds_taken: 9,
      confidence: 5,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: [],
    },
    probe: null,
    reveal_timing: "per-decision" as const,
    result: null,
    feedback: null,
    ...over,
  });

  it("accepts an empty read that says nothing was said", () => {
    expect(decisionAtomSchema.safeParse(atom({})).success).toBe(true);
  });

  it("refuses the same empty read from every other purpose", () => {
    /*
     * THE GUARD `min(1)` USED TO BE, BACK BECAUSE THE PURPOSE IS STORED. While the record did not
     * carry one, this rule could not be expressed here at all -- the schema had a choice between
     * refusing every empty read and accepting every empty read, and it took the second. So the
     * exemption for one decision silently became an exemption for all of them, and a client that
     * dropped the field entirely was indistinguishable from a player being spared a toll.
     */
    for (const purpose of ["anchor", "drill", "transfer"] as const) {
      expect(
        decisionAtomSchema.safeParse(atom({ purpose })).success,
        `${purpose} accepted a decision with neither read field`,
      ).toBe(false);
    }
    /*
     * `play` and `import` are sampled, so the schema re-derives the draw rather than refusing them
     * outright. For game "g" on this board the draw selects ply 16 (0.0583) and passes over ply 0
     * (0.5563) -- so the same purpose is refused at one ply and accepted at the other, which is
     * the rule being enforced rather than a purpose being trusted.
     */
    for (const purpose of ["play", "import"] as const) {
      const entry = { ...atom({}).entry_state, ply: 16 };
      expect(
        decisionAtomSchema.safeParse(atom({ purpose, entry_state: entry })).success,
        `${purpose} accepted an empty read on a decision the draw selected`,
      ).toBe(false);
      expect(
        decisionAtomSchema.safeParse(atom({ purpose })).success,
        `${purpose} was charged for words on a decision nothing will read`,
      ).toBe(true);
    }
  });

  it("refuses it from a decision that names no purpose at all", () => {
    /*
     * NULL IS NOT AN EXEMPTION. A row this build did not stamp cannot claim a standing only
     * `first` has -- otherwise dropping the field would BE the way to skip the questions, and the
     * guard would be re-openable by omission.
     */
    expect(decisionAtomSchema.safeParse(atom({ purpose: null })).success).toBe(false);
  });

  it("refuses a half-empty read, so one field cannot be dropped alone", () => {
    // On a decision the draw selected, so the pair is genuinely required.
    const half = atom({
      purpose: "play",
      entry_state: { ...atom({}).entry_state, ply: 16 },
      unknown: "לא יודע איך הוא יענה",
    });
    expect(decisionAtomSchema.safeParse(half).success).toBe(false);
  });

  it("refuses an empty sentence beside parts that say something WAS said", () => {
    /*
     * `min(1)` was unconditional and therefore enforceable; the exemption made it conditional on
     * something the record does not carry, so it could not survive. What replaces it catches the
     * failure this pair has actually had: a client that loses the composed string while still
     * holding the parts it was composed from.
     */
    const broken = atom({ known_parts: { tapped: ["המרכז פתוח"], typed: "" } });
    const parsed = decisionAtomSchema.safeParse(broken);
    expect(parsed.success, "an empty sentence beside a tapped label parsed clean").toBe(false);
  });

  it("refuses it on the unknown side too, so the guard is not half-applied", () => {
    const broken = atom({ unknown_parts: { tapped: [], typed: "משהו" } });
    expect(decisionAtomSchema.safeParse(broken).success).toBe(false);
  });

  it("still accepts an ordinary decision that answered both", () => {
    const full = atom({
      purpose: "play",
      known: "המרכז פתוח",
      unknown: "לא יודע איך הוא יענה",
      known_parts: { tapped: ["המרכז פתוח"], typed: "" },
      unknown_parts: { tapped: ["לא יודע איך הוא יענה"], typed: "" },
    });
    expect(decisionAtomSchema.safeParse(full).success).toBe(true);
  });
});
