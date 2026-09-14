/**
 * THE PRIORITY TABLE, AS ASSERTIONS RATHER THAN AS A DOCUMENT.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE GATE. `GATE-CONTINUATION-OUTRANKS` already proves that an
 * open run beats every lower branch, which is the collision that matters most and the one a single
 * reordered `if` would break. This file is the rest of the table: every pair of competing states the
 * product can actually reach, with the winner named and the reason recorded.
 *
 * EVERY ROW IS A STATE THE RECORD CAN HOLD. There is no row here for a combination the product
 * cannot produce -- a test that asserted an outcome for an unreachable state would be pinning
 * behaviour nobody can observe, and would go red the day the ladder was correctly simplified.
 *
 * `docs/ARCHITECTURE_UI_DECISION_MATRIX.md` is this table in prose. If the two disagree, this one
 * is right: it runs.
 */
import { describe, expect, it } from "vitest";
import {
  observed,
  proposeNextAction,
  soundProposal,
  UNIMPLEMENTED,
  UNOBSERVED,
  type ProductState,
} from "../../shared/next-action";

const READY: ProductState = {
  pendingAnalyses: 0,
  analysisRunning: false,
  drill: observed(null),
  transfer: observed(null),
  unseenEvent: UNIMPLEMENTED,
  untestedRule: observed(null),
  claimState: { kind: "nothing-separated", scored: 40 },
  blitzStanding: { may: true, because: "no-games", readable: 40, needs: null } as never,
  decisionsOnRecord: 12,
  anchor: { answered: 8, total: 8 },
};

const DRILL = observed({ drillId: "d1", done: 4, total: 8 });
const TRANSFER = observed({ transferId: "t1", done: 1, total: 3 });
const win = (over: Partial<ProductState>) => proposeNextAction({ ...READY, ...over }).action.kind;

describe("competing states have a deterministic winner", () => {
  it("an open drill beats an open transfer", () => {
    /* Both are pre-registered sets. The drill was opened first in the ladder and stays there. */
    expect(win({ drill: DRILL, transfer: TRANSFER })).toBe("continue-drill");
  });

  it("an open run beats an analysis backlog", () => {
    /*
     * THE MOST DEFENSIBLE THING TO PROMOTE, AND STILL WRONG. `wait-analysis` is the branch P1.5
     * fought hardest for. Promoting it would abandon a pre-registered set to wait for an engine.
     */
    expect(win({ drill: DRILL, pendingAnalyses: 11, analysisRunning: true })).toBe("continue-drill");
  });

  it("an open run beats an untested rule the player wrote", () => {
    expect(win({ drill: DRILL, untestedRule: observed("r1") })).toBe("continue-drill");
  });

  it("an open run beats a claim awaiting its forward test", () => {
    expect(win({ transfer: TRANSFER, claimState: { kind: "candidate", claimId: "c1" } })).toBe(
      "continue-transfer",
    );
  });

  it("an open run beats a playable record", () => {
    /* The collision the whole migration is about: PostGame used to answer this one with a game. */
    expect(win({ drill: DRILL })).toBe("continue-drill");
  });

  it("an analysis backlog beats an untested rule", () => {
    /*
     * The backlog is work already committed that nothing else can unblock, and a rule test needs
     * decisions the queue has not scored yet.
     */
    expect(win({ pendingAnalyses: 5, untestedRule: observed("r1") })).toBe("wait-analysis");
  });

  it("the player's own untested rule beats the instrument's open question", () => {
    /*
     * RULE 4, AND THE ORDER IS THE ARGUMENT. A rule the player authored outranks a separation the
     * search found, because the first is theirs and the second is the product's.
     */
    expect(
      win({ untestedRule: observed("r1"), claimState: { kind: "candidate", claimId: "c1" } }),
    ).toBe("test-hypothesis");
  });

  it("a claim awaiting its forward test beats collecting more of the same evidence", () => {
    expect(
      win({ claimState: { kind: "candidate", claimId: "c1" }, anchor: { answered: 3, total: 8 } }),
    ).toBe("test-claim");
  });

  it("an unfinished shared set beats returning to the record", () => {
    expect(win({ anchor: { answered: 3, total: 8 } })).toBe("collect-more-evidence");
  });

  it("with nothing outstanding, the record is the answer and not another game", () => {
    expect(win({})).toBe("return-record");
  });
});

describe("incomplete state resolves to an explicit unknown, never to a guess", () => {
  it("answers none while the blitz standing has not been read", () => {
    /*
     * `none` EXISTS FOR THIS AND ONLY THIS. Everything above it is a fact the caller holds
     * synchronously; everything below depends on a reading that arrives late.
     */
    expect(win({ blitzStanding: null })).toBe("none");
  });

  it("marks the proposal unsound when a readable input went unread", () => {
    const p = proposeNextAction({ ...READY, transfer: UNOBSERVED });
    expect(soundProposal(p)).toBe(false);
    expect(p.blind).toContain("transfer");
  });

  it("does not mark it unsound for an input the product cannot produce", () => {
    expect(soundProposal(proposeNextAction(READY))).toBe(true);
  });

  it("a run that IS read outranks one that is not, without waiting for the unread one", () => {
    /*
     * An unread TRANSFER cannot outrank an open DRILL, because the drill is branch 1 and nothing
     * below it was consulted. The proposal is sound despite an unobserved input, which is the
     * whole reason `blind` is a prefix rather than a set.
     */
    const p = proposeNextAction({ ...READY, drill: DRILL, transfer: UNOBSERVED });
    expect(p.action.kind).toBe("continue-drill");
    expect(soundProposal(p)).toBe(true);
  });
});
