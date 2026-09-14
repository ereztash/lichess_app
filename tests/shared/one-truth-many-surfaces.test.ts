/**
 * ONE POLICY, TWO VOICES, AND THE PROOF THAT THEY NEVER DISAGREE ABOUT WHAT SHOULD HAPPEN.
 *
 * WHAT THIS FILE IS ABOUT. Before this migration four surfaces each answered "what should the
 * player do now?" and three of them answered it without asking the canonical policy. Resume had a
 * two-kind vocabulary -- `play` or `wait` -- looked up from a blitz blocker, so it could not
 * express a set in progress. PostGame said "play another game" unconditionally whenever a game
 * produced no finding. Both were correct-looking, both were tested, and both were wrong for a
 * player four positions into an eight-position pre-registered set.
 *
 * SO THE ASSERTIONS ARE ABOUT AGREEMENT, NOT ABOUT MARKUP. What must hold across surfaces is WHICH
 * ACT they name and WHEN they decline to name one. What must differ is the sentence. A test that
 * pinned the sentence would be pinning presentation, which is the thing this design deliberately
 * left local.
 */
import { describe, expect, it } from "vitest";
import {
  actFor,
  observed,
  proposeNextAction,
  soundProposal,
  UNIMPLEMENTED,
  UNOBSERVED,
  type ProductState,
} from "../../shared/next-action";
import { presentOnResume } from "../../shared/resume-presentation";
import { presentOnPostGame } from "../../shared/post-game-presentation";
import { ALL_KINDS, stubAction } from "../../shared/authority-scan-ui";

const base: ProductState = {
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

describe("the ladder can now be acted on", () => {
  it("is sound when every readable input was read", () => {
    /*
     * THE WHOLE UNLOCK, IN ONE ASSERTION. This was false for every state before the migration,
     * because `unseenEvent` sits at branch 4, nothing in this product can produce it, and it was
     * modelled as merely unread -- so `blind` carried it under eight of the eleven kinds forever.
     * `soundProposal` is the predicate authority transfer is gated on, so the gate could not open.
     */
    const p = proposeNextAction(base);
    expect(p.blind).toEqual([]);
    expect(soundProposal(p)).toBe(true);
  });

  it("is still unsound when something readable actually went unread", () => {
    /* The repair must not have removed real blindness, only the phantom kind. */
    const p = proposeNextAction({ ...base, drill: UNOBSERVED });
    expect(p.blind).toContain("drill");
    expect(soundProposal(p)).toBe(false);
  });

  it("does not make review-event reachable, because no seen-set was built", () => {
    /*
     * The distinction is about BLINDNESS, not about reachability. `unseenEvent` is unimplementable
     * and stays unimplementable; what changed is that its unreachability stopped being charged to
     * the branches beneath it. Inventing a seen-set is explicitly out of scope.
     */
    expect(base.unseenEvent.observed).toBe(false);
    expect(proposeNextAction(base).action.kind).not.toBe("review-event");
  });
});

describe("two surfaces, one intent", () => {
  it("never disagree about which act a canonical action names", () => {
    for (const kind of ALL_KINDS) {
      const action = stubAction(kind);
      const want = actFor(kind);
      const r = presentOnResume(action);
      const p = presentOnPostGame(action);
      expect(r?.act ?? null, `resume disagreed on ${kind}`).toBe(want);
      expect(p?.act ?? null, `post-game disagreed on ${kind}`).toBe(want);
    }
  });

  it("decline together on the states that have nothing to press", () => {
    /*
     * `wait-analysis` and `none` are sentences, not buttons. A surface that grew a control for
     * either would be inventing an act for a state the policy says has none -- and P1.5 fought
     * specifically for the engine backlog not to carry a button that grows the backlog.
     */
    for (const kind of ["wait-analysis", "none"] as const) {
      expect(presentOnResume(stubAction(kind))).toBeNull();
      expect(presentOnPostGame(stubAction(kind))).toBeNull();
    }
  });

  it("word the same act differently, which is the point of keeping presenters per surface", () => {
    const action = stubAction("play-blitz");
    const r = presentOnResume(action);
    const p = presentOnPostGame(action);
    expect(r?.act).toBe(p?.act);
    expect(r?.label).not.toBe(p?.label);
  });
});

describe("the cold front door exception is evidenced, not asserted", () => {
  it("the ladder agrees with Record.tsx on an empty record", () => {
    /*
     * `Record.tsx` hardcodes `play-first-decision` on a record with nothing measured, and
     * `LOCAL_ACT_ALLOWLIST` permits it on the ground that the canonical ladder provably agrees.
     * This is that proof. Without it the allowlist entry would be an assertion in prose, which is
     * what an allowlist is supposed to replace.
     */
    const cold = proposeNextAction({
      ...base,
      decisionsOnRecord: 0,
      claimState: { kind: "unread" },
      blitzStanding: { may: false, because: "no-games", readable: 0, needs: null } as never,
      anchor: { answered: 0, total: 8 },
    });
    expect(cold.action.kind).toBe("play-first-decision");
    expect(soundProposal(cold)).toBe(true);
  });
});

describe("continuation outranks a new game, on every surface that can say so", () => {
  it("both presenters name continue-run when a set is open", () => {
    const withDrill = proposeNextAction({
      ...base,
      drill: observed({ drillId: "d1", done: 4, total: 8 }),
    });
    expect(withDrill.action.kind).toBe("continue-drill");
    expect(presentOnResume(withDrill.action)?.act).toBe("continue-run");
    expect(presentOnPostGame(withDrill.action)?.act).toBe("continue-run");
    /* And neither offers a game instead, which is what PostGame did unconditionally before. */
    expect(presentOnPostGame(withDrill.action)?.act).not.toBe("play-blitz");
  });
});
