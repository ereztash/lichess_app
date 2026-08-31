/**
 * THE CORRESPONDENCE BETWEEN WHAT THE DERIVATION PROPOSES AND WHAT A SCREEN CAN OFFER.
 *
 * WHAT WAS STANDING IN FOR IT. `next-action-shadow.ts` carried the whole of it as one line --
 * `agrees: kind === "play-first-decision" || kind === "play-blitz"` -- written for the front door,
 * invisible to every other screen, and silent if a kind were added. A shadow whose comparison is a
 * hand-written disjunction is a shadow that agrees with itself.
 *
 * WHY THAT MATTERS MORE THAN A REFACTOR. P0.5's sequencing is derivation, then shadow, then
 * OWNERSHIP PER STATE, and the shadow is the only evidence that could justify the third. It has
 * never had a player: the ledger it writes to is a browser-local ring buffer and nobody has used
 * this build. So the sentence "watch it disagree with the screens for a while before believing it"
 * describes a wait that has not started and, with eight to thirty participants still ahead, would
 * not finish soon.
 *
 * SO THE WAIT IS REPLACED BY A MEASUREMENT THAT IS AVAILABLE TODAY. Everything the wait would have
 * established about the mapping -- is it total, is it onto, is every proposal something a control
 * could name, is every act something a proposal could ask for -- is a fact about two closed
 * vocabularies and a pure function over them. This file asks it. What a wait would still buy, and
 * what this cannot, is written down at the bottom.
 */
import { describe, expect, it } from "vitest";
import {
  actFor,
  agreesWith,
  deriveNextAction,
  type NextActionKind,
  type ProductState,
} from "@shared/next-action";
import { PRIMARY_ACTIONS, type PrimaryAction } from "@shared/primary-action";
import type { BlitzStanding } from "@shared/blitz-reading";

/**
 * Every kind, as a value.
 *
 * THE `Record` IS THE POINT AND THE ARRAY IS DERIVED FROM IT. A union cannot be enumerated at
 * runtime, so a hand-written array would silently miss a kind added later -- which is the exact
 * failure this file exists about. `Record<NextActionKind, true>` cannot compile with one missing.
 */
const EVERY_KIND: Record<NextActionKind, true> = {
  "wait-analysis": true,
  "play-first-decision": true,
  "play-blitz": true,
  "review-event": true,
  "collect-more-evidence": true,
  "test-hypothesis": true,
  "continue-drill": true,
  "continue-transfer": true,
  "return-record": true,
  none: true,
};
const KINDS = Object.keys(EVERY_KIND) as NextActionKind[];

/**
 * The acts no proposal names, and why each one is correct rather than a gap.
 *
 * `PRIMARY_ACTIONS` SAYS THIS IN PROSE AND THIS SAYS IT IN A TEST. Its own comment reads: *these
 * are not things a player is ROUTED to -- they are what the player is already doing*. An act that
 * quietly joined this list would be a state the derivation could never own, arriving without anyone
 * deciding that.
 */
const NOT_ROUTED_TO: Record<string, string> = {
  "commit-decision": "the submit of a decision already open: the player is mid-act, not being sent",
  "answer-instrument": "the confidence or counterfactual question already on screen, same reason",
  "next-decision": "the reveal's own continuation, which is the act the player just finished",
};

const standing = (over: Partial<BlitzStanding> = {}): BlitzStanding =>
  ({ may: true, readable: 400, ...over }) as BlitzStanding;

const base = (over: Partial<ProductState> = {}): ProductState => ({
  pendingAnalyses: 0,
  analysisRunning: false,
  drill: null,
  transfer: null,
  unseenEvent: null,
  untestedRule: null,
  blitzStanding: standing(),
  decisionsOnRecord: 40,
  anchor: { answered: 8, total: 8 },
  ...over,
});

/**
 * One `ProductState` per kind, so the mapping's domain is not hypothetical.
 *
 * A KIND NO STATE PRODUCES IS DEAD CODE in a derivation that claims to be a total router, and the
 * assertion below is what makes this a reachability table rather than a list of wishes.
 */
const REACHES: Record<NextActionKind, ProductState> = {
  "continue-drill": base({ drill: { drillId: "d1", done: 4, total: 8 } }),
  "continue-transfer": base({ transfer: { transferId: "t1", done: 1, total: 6 } }),
  "wait-analysis": base({ pendingAnalyses: 3, analysisRunning: true }),
  "review-event": base({ unseenEvent: { gameId: "g1", ply: 21 } }),
  "test-hypothesis": base({ untestedRule: "r1" }),
  none: base({ blitzStanding: null }),
  "play-first-decision": base({
    decisionsOnRecord: 0,
    blitzStanding: standing({ may: false, because: "no-games", needs: null }),
  }),
  "play-blitz": base({
    blitzStanding: standing({ may: false, because: "too-few-readable", needs: null }),
  }),
  "collect-more-evidence": base({ anchor: { answered: 3, total: 8 } }),
  "return-record": base(),
};

describe("every proposal, and the control that would have to name it", () => {
  it("maps every kind, and every act it names is in the closed vocabulary", () => {
    for (const kind of KINDS) {
      const act = actFor(kind);
      if (act === null) continue;
      expect(PRIMARY_ACTIONS, `${kind} maps to "${act}", which no control may carry`).toContain(act);
    }
  });

  it("names exactly two proposals that are not acts, and both are a screen going quiet", () => {
    /*
     * `wait-analysis` IS THE ONE THIS PRODUCT GOT WRONG. The front door rendered "play another
     * game" on `nothing-scored`, which grows the backlog that IS the blocker -- so the correct
     * offer there is nothing at all, and a mapping that had to invent an act for it would have
     * re-created the defect P1.5 removed. `none` is the same shape: the derivation has nothing to
     * say, and a control would be the screen deciding.
     */
    expect(KINDS.filter((kind) => actFor(kind) === null).sort()).toEqual(["none", "wait-analysis"]);
  });

  it("leaves exactly the three mid-act controls unreachable, each with a reason", () => {
    const named = new Set(KINDS.map(actFor).filter((act): act is PrimaryAction => act !== null));
    const unreachable = PRIMARY_ACTIONS.filter((act) => !named.has(act)).sort();
    expect(unreachable).toEqual(Object.keys(NOT_ROUTED_TO).sort());
    for (const act of unreachable) {
      expect(NOT_ROUTED_TO[act]?.length ?? 0, `${act} is unreachable and nothing says why`)
        .toBeGreaterThan(20);
    }
  });

  it("lets a drill and a transfer share one act without sharing a sentence", () => {
    /*
     * NOT A COLLISION. From the player's side, finishing a pre-registered set is one act whichever
     * kind of set it is; the KINDS stay apart because the sentence and the id differ. A test that
     * demanded a bijection would be demanding two buttons for one thing.
     */
    expect(actFor("continue-drill")).toBe(actFor("continue-transfer"));
    expect(deriveNextAction(REACHES["continue-drill"])).toMatchObject({ drillId: "d1" });
    expect(deriveNextAction(REACHES["continue-transfer"])).toMatchObject({ transferId: "t1" });
  });
});

describe("agreement, including the two directions of silence", () => {
  it("is exactly the mapping, for every kind against every act and against nothing", () => {
    for (const kind of KINDS) {
      const act = actFor(kind);
      expect(agreesWith(kind, null), `${kind} vs a quiet screen`).toBe(act === null);
      for (const offered of PRIMARY_ACTIONS) {
        expect(agreesWith(kind, offered), `${kind} vs ${offered}`).toBe(act === offered);
      }
    }
  });

  it("calls a screen that offers something where nothing was proposed a disagreement", () => {
    /*
     * BOTH DIRECTIONS, AND NEITHER IS A NEAR MISS. A screen loud where the derivation wanted quiet
     * is the `nothing-scored` defect; a screen quiet where it wanted a control is a dead end. The
     * first version of the shadow could express neither, because its `offered` was a constant.
     */
    expect(agreesWith("wait-analysis", "play-blitz")).toBe(false);
    expect(agreesWith("play-blitz", null)).toBe(false);
  });
});

describe("the domain is real", () => {
  it("reaches every kind from a state the product can be in", () => {
    for (const kind of KINDS) {
      expect(deriveNextAction(REACHES[kind]).kind, `no state produces ${kind}`).toBe(kind);
    }
  });

  it("proposes something a control could name on every state but the two silences", () => {
    const proposals = KINDS.map((kind) => deriveNextAction(REACHES[kind]));
    const quiet = proposals.filter((p) => actFor(p.kind) === null);
    expect(quiet.map((p) => p.kind).sort()).toEqual(["none", "wait-analysis"]);
  });
});

/*
 * WHAT THIS FILE DOES NOT ESTABLISH, and what the shadow is still for.
 *
 * It says the mapping is total, that it is onto everything but the three mid-act controls, and that
 * every kind is reachable from a state the product can be in. It says nothing about whether the
 * screens AGREE -- that is a fact about three components and the states they are actually rendered
 * in, and the L5 walk in `tests/layout/what-the-screens-offer.layout.test.ts` reads it off the real
 * ledger in a real browser on the built assets.
 *
 * And neither of those is the thing a player would have shown: whether the proposal is one a person
 * would have wanted. Nothing in this repository can answer that, and `docs/decisions/D21` is why it
 * is not worth faking -- a layer that changed what a player was shown based on their own
 * measurements would create the exposure the record cannot represent.
 */
