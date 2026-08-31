/**
 * The protocol a decision was produced under, and the null that must never be filled in.
 *
 * `purpose` says WHY a decision existed. This says what the world was like while it was being made:
 * whether a clock was running, whether an engine was, whether anybody was asked anything. The two
 * vary independently -- a `play` decision can be made in the untimed loop or in a timed blitz game,
 * and those are not comparable even though the intent was identical.
 *
 * THE TEST THAT MATTERS MOST IS THE BACKFILL ONE. Every row written before these fields existed WAS
 * made in the untimed commitment loop, because that was the only loop there was. So writing
 * `instrumented-standard` into them would be FACTUALLY correct -- and it is still forbidden, for the
 * reason `reveal_timing` gives about its own null: it would assert that a condition was RECORDED
 * when nobody recorded one, and the first comparison between protocols would open with a standard
 * arm of thousands against a blitz arm of none.
 */
import { describe, expect, it } from "vitest";
import { buildCommitEvent, emptyDraft, type PositionUnderDecision } from "@/lib/decision-session";
import {
  ANALYSIS_TIMINGS,
  contradictsProtocol,
  CURRENT_PROTOCOL_VERSION,
  LEGACY_PROTOCOL,
  MEASUREMENT_PROTOCOLS,
  protocolOf,
  REQUIRED_ANALYSIS_TIMING,
} from "@shared/measurement-protocol";
import { decisionAtomSchema } from "@shared/decision-atom";
import { commitEventSchema } from "../../server/recordRouter";

const POSITION: PositionUnderDecision = {
  gameId: "g",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ply: 0,
  clockMsRemaining: null,
  purpose: "drill",
};

const commit = () =>
  buildCommitEvent(
    "11111111-1111-4111-8111-111111111111",
    POSITION,
    {
      ...emptyDraft(),
      chosenMove: "e2e4",
      knownTags: ["המרכז סגור"],
      known: "הרגל על d5 מקובע",
      unknownTags: ["לא יודע איך הוא יענה"],
      unknown: "",
      confidence: 5,
    },
    12,
    "per-decision",
    () => 0.9,
  );

describe("what conditions the decision was made under", () => {
  it("stamps the live commitment loop with its own protocol rather than leaving it blank", () => {
    const event = commit();
    expect(event.measurement_protocol).toBe("instrumented-standard");
    expect(event.protocol_version).toBe(CURRENT_PROTOCOL_VERSION);
  });

  it("records the engine as running DURING play, because it does", () => {
    /*
     * The distinction this field exists for. `reveal_timing: "end-of-game"` does not mean the engine
     * was quiet -- Home.tsx says so in its own words, "the engine runs in both modes; only the
     * telling differs" -- so a deferred game is still `during-play` and an instrumented blitz game
     * will be the product's first `after-play` decision of any kind.
     */
    expect(commit().analysis_timing).toBe("during-play");
    expect(ANALYSIS_TIMINGS).toContain("after-play");
  });

  it("accepts a decision that recorded nothing, and does not turn it into a protocol", () => {
    const legacy = { ...commit(), measurement_protocol: null, protocol_version: null, analysis_timing: null };
    const { decision_id: _id, ...atom } = legacy;
    expect(decisionAtomSchema.safeParse(atom).success).toBe(true);
    // The whole point: null reads back as its own key, not as any protocol.
    expect(protocolOf(atom.measurement_protocol)).toBe(LEGACY_PROTOCOL);
    expect(MEASUREMENT_PROTOCOLS).not.toContain(LEGACY_PROTOCOL as never);
  });

  it("refuses a protocol the enum does not contain, rather than storing the string", () => {
    const { decision_id: _id, ...atom } = commit();
    const bogus = { ...atom, measurement_protocol: "instrumented-bullet" };
    expect(decisionAtomSchema.safeParse(bogus).success).toBe(false);
  });

  it("holds an instrumented blitz game to after-play analysis, as data rather than as a rule", () => {
    /*
     * INV-4 expressed where a query can find a violation, not only where a reviewer can. A row that
     * claims to be blitz and to have run the engine during play is a bug that shows up in the
     * record.
     */
    expect(REQUIRED_ANALYSIS_TIMING["instrumented-blitz"]).toBe("after-play");
    expect(contradictsProtocol("instrumented-blitz", "during-play")).toBe(true);
    expect(contradictsProtocol("instrumented-blitz", "after-play")).toBe(false);
    // The standard loop is genuinely both, so it constrains nothing.
    expect(REQUIRED_ANALYSIS_TIMING["instrumented-standard"]).toBeUndefined();
    expect(contradictsProtocol("instrumented-standard", "during-play")).toBe(false);
  });

  it("treats a missing stamp as no claim rather than as a contradiction", () => {
    // An unstamped row is not asserting anything, so there is nothing for it to contradict.
    expect(contradictsProtocol(null, "during-play")).toBe(false);
    expect(contradictsProtocol("instrumented-blitz", null)).toBe(false);
  });

  it("does not let the SERVER invent the stamp an old client did not send", () => {
    /*
     * The boundary is where a backfill is most tempting and least visible: a `.default("instrumented
     * -standard")` here would look like sensible compatibility and would make an unstamped row
     * indistinguishable from a stamped one for ever afterwards. The wire schema accepts the older
     * payload -- that part is real compatibility -- and stores an explicit null.
     */
    const older = {
      decision_id: "11111111-1111-4111-8111-111111111111",
      entry_state: { game_id: "g", fen: POSITION.fen, ply: 0, phase: "opening", clock_ms_remaining: null },
      purpose: "play",
      drill_id: null,
      known: "a", unknown: "b", known_parts: null, unknown_parts: null,
      decision: "e2e4",
      bounded_action: { seconds_taken: 3, confidence: 5, candidate_moves_considered: ["e2e4"] },
      probe: null,
      reveal_timing: null,
      result: null,
      feedback: null,
    };
    const parsed = commitEventSchema.safeParse(older);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("unreachable");
    expect(parsed.data.measurement_protocol).toBeNull();
    expect(parsed.data.protocol_version).toBeNull();
    expect(parsed.data.analysis_timing).toBeNull();
  });

  it("keeps an imported game structurally unable to claim it watched itself being played", () => {
    expect(REQUIRED_ANALYSIS_TIMING["historical-passive"]).toBe("after-play");
    expect(contradictsProtocol("historical-passive", "during-play")).toBe(true);
  });
});
