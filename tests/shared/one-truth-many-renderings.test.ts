/**
 * THE MATRIX: EVERY CANONICAL STATE, ITS ACT, AND WHETHER A SCREEN MAY OBEY IT.
 *
 * WHAT THIS FILE IS FOR AND WHAT IT IS NOT. It is not a second copy of
 * `a-proposal-with-no-control-to-name-it.test.ts`, which asks whether `actFor` is total and onto.
 * That question is about two closed sets. This one is about a THIRD column those two cannot see:
 * whether the state that produced a proposal was one the derivation could actually read.
 *
 * WHY THAT COLUMN DECIDES THE MIGRATION. `deriveNextAction` has twelve branches and four of its
 * inputs used to be fabricated `null`. The repair made three of them readable and left the fourth
 * -- `unseenEvent` -- deliberately unbuilt, because nothing in the product writes a seen-set and
 * inventing one to satisfy a branch would put a half-considered exposure marker into a record that
 * `D21` says cannot represent exposure at all.
 *
 * The consequence is arithmetic rather than opinion: `review-event` is branch 4, so EVERY proposal
 * ranked below it rests on a fact nobody has measured. This file is that consequence, enumerated,
 * so that the answer to "which branches may be handed to a screen" is a printed table rather than a
 * recollection.
 *
 * `UNKNOWN` IS A CELL VALUE AND IT IS THE POINT. A row whose proposal is unsound is not a row that
 * failed; it is a row where the product does not yet know enough to let a screen act.
 */
import { describe, expect, it } from "vitest";
import {
  actFor,
  BLINDABLE_INPUTS,
  deriveNextAction,
  observed,
  proposeNextAction,
  producesEvidence,
  soundProposal,
  UNOBSERVED,
  type NextActionKind,
  type ProductState,
} from "@shared/next-action";
import type { PrimaryAction } from "@shared/primary-action";

/** Everything read, nothing open: the floor every row below varies one thing from. */
const clear: ProductState = {
  pendingAnalyses: 0,
  analysisRunning: false,
  drill: observed(null),
  transfer: observed(null),
  unseenEvent: observed(null),
  untestedRule: observed(null),
  claimState: { kind: "nothing-separated", scored: 40 },
  blitzStanding: { may: true, readable: 40 },
  decisionsOnRecord: 40,
  anchor: { answered: 8, total: 8 },
};

/**
 * One `ProductState` per reachable kind.
 *
 * REACHABLE, NOT HYPOTHETICAL. Each of these is a record the product can actually be in, which is
 * the property `a-proposal-with-no-control-to-name-it.test.ts` establishes for the whole set and
 * this file relies on.
 */
const STATES: Record<NextActionKind, ProductState> = {
  "continue-drill": { ...clear, drill: observed({ drillId: "d1", done: 3, total: 8 }) },
  "continue-transfer": {
    ...clear,
    transfer: observed({ transferId: "t1", done: 1, total: 3 }),
  },
  "wait-analysis": { ...clear, pendingAnalyses: 4, analysisRunning: true },
  "review-event": { ...clear, unseenEvent: observed({ gameId: "g", ply: 21 }) },
  "test-hypothesis": { ...clear, untestedRule: observed("rule-1") },
  "test-claim": { ...clear, claimState: { kind: "candidate", claimId: "c1" } },
  none: { ...clear, blitzStanding: null },
  "play-first-decision": {
    ...clear,
    decisionsOnRecord: 0,
    blitzStanding: { may: false, because: "no-games", readable: 0, needs: null },
  },
  "play-blitz": {
    ...clear,
    blitzStanding: { may: false, because: "too-few-readable", readable: 9, needs: null },
  },
  "collect-more-evidence": { ...clear, anchor: { answered: 3, total: 8 } },
  "return-record": clear,
};

describe("one product truth, and which surfaces may render it", () => {
  it("reaches every kind from a state the product can be in", () => {
    for (const [kind, state] of Object.entries(STATES)) {
      expect(deriveNextAction(state).kind, `state for ${kind}`).toBe(kind);
    }
  });

  it("prints the matrix: state, act, soundness, and what it costs to be blind", () => {
    const rows = (Object.keys(STATES) as NextActionKind[]).map((kind) => {
      /*
       * TWO COLUMNS FOR SOUNDNESS, because there are two questions and only one of them is about
       * the derivation. `ideal` is what a surface that could read everything would get; `shipped`
       * is what the product's own assembly gets, where `unseenEvent` is UNOBSERVED on every
       * surface because nothing writes a seen-set. The gap between the columns IS the remaining
       * architecture -> UI gap, printed.
       */
      const ideal = proposeNextAction(STATES[kind]);
      const shipped = proposeNextAction({ ...STATES[kind], unseenEvent: UNOBSERVED });
      return {
        kind,
        act: actFor(kind) ?? "(no control -- the screen goes quiet)",
        "sound if all read": soundProposal(ideal),
        "sound as shipped": soundProposal(shipped),
        "blind as shipped": shipped.blind.join(", ") || "-",
        producesEvidence: producesEvidence(shipped.action),
      };
    });
    /* eslint-disable-next-line no-console -- the table IS the output of this test. */
    console.table(rows);
    expect(rows).toHaveLength(11);
  });

  /**
   * THE ONE RESULT THE MIGRATION TURNS ON.
   *
   * Only proposals ranked ABOVE the permanently blind input can be sound, so the set of branches a
   * screen may be handed is decided by where `unseenEvent` sits rather than by how confident
   * anybody is in the derivation. It sits at branch 4, so three branches clear it and eight do not.
   */
  it("finds exactly the branches that outrank the one input nobody measures", () => {
    /*
     * AS SHIPPED, AND THAT QUALIFIER IS THE TEST. The states above observe every input, because
     * they exist to reach every branch. No surface in the product can: `productStateFor` writes
     * `unseenEvent: UNOBSERVED` unconditionally, since nothing anywhere writes a seen-set. So the
     * set of branches a screen may be handed is decided by where that input sits in the ladder --
     * branch 4 -- rather than by anybody's confidence in the derivation.
     */
    const sound = (Object.keys(STATES) as NextActionKind[]).filter((kind) =>
      soundProposal(proposeNextAction({ ...STATES[kind], unseenEvent: UNOBSERVED })),
    );
    expect([...sound].sort()).toEqual(
      ["continue-drill", "continue-transfer", "wait-analysis"].sort(),
    );
  });

  it("names `unseenEvent` on every proposal it outranks, and on no others", () => {
    const above = ["continue-drill", "continue-transfer", "wait-analysis"];
    for (const kind of Object.keys(STATES) as NextActionKind[]) {
      if (kind === "review-event") continue; /* it IS the branch; it cannot outrank itself. */
      const { blind } = proposeNextAction({ ...STATES[kind], unseenEvent: UNOBSERVED });
      expect(blind.includes("unseenEvent"), kind).toBe(!above.includes(kind));
    }
  });

  it("says nothing about `unseenEvent` on the proposals that outrank it, even unread", () => {
    /*
     * THE OTHER DIRECTION, AND IT IS WHAT MAKES BRANCH-BY-BRANCH TRANSFER POSSIBLE AT ALL. A
     * permanently missing input does not poison the whole derivation -- it poisons exactly the
     * proposals it would have beaten. A screen that can see a drill may be handed `continue-drill`
     * on a product that will never have a seen-set.
     */
    for (const kind of ["continue-drill", "continue-transfer", "wait-analysis"] as const) {
      const proposal = proposeNextAction({ ...STATES[kind], unseenEvent: UNOBSERVED });
      expect(proposal.action.kind).toBe(kind);
      expect(proposal.blind).toEqual([]);
      expect(soundProposal(proposal)).toBe(true);
    }
  });

  /**
   * A SCREEN MAY CHANGE HOW AN ACT LOOKS AND MAY NOT CHANGE WHICH ACT IT IS.
   *
   * The two run kinds share one act deliberately -- from the player's side, finishing a
   * pre-registered set is one act whichever kind of set it is -- and that is the ONLY collapse the
   * vocabulary permits. Anything else sharing an act would mean the derivation had two proposals a
   * screen could not tell apart.
   */
  it("keeps materially different intentions in different acts", () => {
    const byAct = new Map<PrimaryAction | null, NextActionKind[]>();
    for (const kind of Object.keys(STATES) as NextActionKind[]) {
      const act = actFor(kind);
      byAct.set(act, [...(byAct.get(act) ?? []), kind]);
    }
    expect(byAct.get("continue-run")?.sort()).toEqual(["continue-drill", "continue-transfer"]);
    /* `wait-analysis` and `none` are the two proposals that are not acts, and they share that. */
    expect(byAct.get(null)?.sort()).toEqual(["none", "wait-analysis"]);
    /* One kind carries a player's sentence and one carries the instrument's; both start a test. */
    expect(byAct.get("test-hypothesis")?.sort()).toEqual(["test-claim", "test-hypothesis"]);
  });

  /**
   * AN UNREAD INPUT IS NOT AN ABSENT ONE, ASSERTED OVER EVERY BLINDABLE FIELD.
   *
   * This is the defect the whole migration exists to remove, stated once as a property rather than
   * once per field: for each input, a state that OBSERVED nothing and a state that observed NOTHING
   * must not be the same state. The first may propose what lies below; the second may not.
   */
  it.each(BLINDABLE_INPUTS)("treats an unread %s differently from an absent one", (input) => {
    const absent = proposeNextAction(clear);
    const unread = proposeNextAction({ ...clear, [input]: UNOBSERVED });
    expect(absent.blind).not.toContain(input);
    expect(unread.blind).toContain(input);
    /* The proposal itself may be the same -- what differs is whether a screen may obey it. */
    expect(soundProposal(absent)).toBe(true);
    expect(soundProposal(unread)).toBe(false);
  });
});
