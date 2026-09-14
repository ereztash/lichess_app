/**
 * WHAT THE RECORD HAS ESTABLISHED CHANGES WHAT HAPPENS NEXT, or the loop is not a loop.
 *
 * THE DEFECT, STATED AS A PROPERTY. `deriveNextAction` reads what the record is MISSING: unscored
 * games, a blitz blocker, two counters, an anchor shortfall. Every one of those moves on effort and
 * none of them moves when the instrument finally separates something. So two passes through the
 * product -- one over a record that had learned nothing and one over a record holding a candidate
 * pattern -- produced the same proposal, because the thing that differed between them was not an
 * input to the function. That is a cycle. A recursion is a loop whose output changes the next pass,
 * and this file is the assertion that it now does.
 *
 * WHY IT IS NOT MERELY A NEW BRANCH. The brief this comes from names five things that must never be
 * silently equated, and two of them meet here:
 *
 *   MORE DATA        is not player improvement. Nothing below asserts that a candidate means the
 *                    player got better; the state asserts that a QUESTION is open.
 *   BAD MOVE         is not a recurring pattern. `claimStateOf` reads the search's verdict, never a
 *                    decision's cost, so no single poor move can produce `candidate`.
 *
 * AND THE THIRD IS THE ONE WITH TEETH: a hypothesis must be able to die. The branch that proposes a
 * forward test has to STOP proposing it once the test has answered, in either direction, or the
 * system only ever accumulates confirmation. `shared/claim.ts` enforces the same rule from the
 * other side -- more retrospective data can never promote a claim -- and the two together are what
 * make a refutation cost something.
 */
import { describe, expect, it } from "vitest";
import {
  awaitsForwardTest,
  CLAIM_STATE_KINDS,
  claimStateOf,
  withdrawnByPlayer,
  type ClaimState,
  type ClaimStateKind,
} from "@shared/claim-state";
import { journeyStageOf, recordJourney } from "@shared/learning-journey";
import { DISCOVERY_FLOOR, MIN_BUCKET_N } from "@shared/detector";
import {
  actFor,
  deriveNextAction,
  producesEvidence,
  type NextAction,
  type ProductState,
  observed,
} from "@shared/next-action";
import type { BlitzStanding } from "@shared/blitz-reading";
import { reentryOf } from "@shared/spine";

const MAY: BlitzStanding = { may: true, readable: 400 };

/** A record that has been read, is above the floor, and whose search separated nothing. */
const SETTLED: ProductState = {
  pendingAnalyses: 0,
  analysisRunning: false,
  drill: observed(null),
  transfer: observed(null),
  unseenEvent: observed(null),
  untestedRule: observed(null),
  claimState: { kind: "nothing-separated", scored: DISCOVERY_FLOOR },
  blitzStanding: MAY,
  decisionsOnRecord: DISCOVERY_FLOOR,
  anchor: { answered: 8, total: 8 },
};

const next = (over: Partial<ProductState>): NextAction => deriveNextAction({ ...SETTLED, ...over });

const CANDIDATE: ClaimState = { kind: "candidate", claimId: "c-1" };

describe("a pass over a record that learned something is not the pass before it", () => {
  it("proposes the forward test the moment a separation exists, and not before", () => {
    expect(next({}).kind, "nothing separated, so nothing to test").not.toBe("test-claim");
    expect(next({ claimState: CANDIDATE })).toMatchObject({
      kind: "test-claim",
      claimId: "c-1",
    });
  });

  it("stops proposing it once a drill has answered, whichever way the answer went", () => {
    /*
     * THE HALF THAT MAKES A HYPOTHESIS ABLE TO DIE. A derivation that kept offering the test after
     * the test had run would be a system incapable of a negative result: every pass would ask the
     * same question again until it got the answer it liked. Both directions are asserted because
     * `refuted` is the one a product under pressure quietly treats as "not finished yet".
     */
    for (const grade of ["replicated", "refuted"] as const) {
      const decided: ClaimState = { kind: "decided", claimId: "c-1", grade };
      expect(next({ claimState: decided }).kind, `a ${grade} claim is still being re-tested`).not.toBe(
        "test-claim",
      );
    }
  });

  it("never proposes it from more evidence of the kind that raised the question", () => {
    /*
     * `shared/claim.ts`: *"a claim NEVER moves to 'replicated' from more retrospective data."* The
     * converse belongs to this layer: no quantity of accumulated decisions may, on its own, produce
     * the proposal to test a claim. Only a claim does, and only the search makes a claim.
     */
    for (const scored of [0, MIN_BUCKET_N, DISCOVERY_FLOOR, DISCOVERY_FLOOR * 10]) {
      for (const kind of ["accumulating", "nothing-separated"] as const) {
        const action = next({ claimState: { kind, scored }, decisionsOnRecord: scored });
        expect(action.kind, `${scored} decisions at ${kind} proposed a test`).not.toBe("test-claim");
      }
    }
  });

  it("says nothing on its own account while the reading has not come back", () => {
    /*
     * `unread` IS NOT AN EMPTY RECORD, which is the mistake `blitzStanding: null` already exists to
     * refuse one lane over: a derivation that read "not fetched yet" as "nothing found" would tell a
     * player whose search has just separated something that there is nothing to look at.
     */
    expect(next({ claimState: { kind: "unread" } }).kind).not.toBe("test-claim");
    expect(claimStateOf(undefined)).toEqual({ kind: "unread" });
    expect(claimStateOf(null)).toEqual({ kind: "unread" });
    expect(claimStateOf({ scored: 0, claim: null })).toEqual({ kind: "accumulating", scored: 0 });
  });
});

describe("the order the new input takes, and the three things it may not jump", () => {
  it("still waits rather than making more evidence when evidence is waiting to be scored", () => {
    /*
     * RULE 2, UNCHANGED AND NOW LOAD-BEARING IN A SECOND LANE. A drill makes evidence. Offering one
     * while the engine has a backlog would grow the queue that is the blocker, which is the exact
     * defect `wait-analysis` was written to remove from the front door.
     */
    const action = next({ claimState: CANDIDATE, pendingAnalyses: 3, analysisRunning: true });
    expect(action.kind).toBe("wait-analysis");
    expect(producesEvidence(action)).toBe(false);
  });

  it("puts the player's own question before the instrument's", () => {
    /*
     * A RULE IS A SENTENCE THE PLAYER WROTE ABOUT THEMSELVES; A CLAIM IS A SEPARATION THE SEARCH
     * FOUND IN THE RECORD. When both are open the player's goes first. The other order is the
     * Instrument-Telos failure in one line: the system asking its question before the person's.
     */
    expect(next({ claimState: CANDIDATE, untestedRule: observed("r-1") })).toMatchObject({
      kind: "test-hypothesis",
      ruleId: "r-1",
    });
  });

  it("lets a pre-registered run in progress outrank both", () => {
    /*
     * LAW 4. Eight positions chosen in advance to test one thing, and four of them tests nothing;
     * abandoning a run does not lose its decisions, it loses the only thing that made them a test.
     */
    expect(
      next({ claimState: CANDIDATE, drill: observed({ drillId: "d-1", done: 4, total: 8 }) }).kind,
    ).toBe("continue-drill");
  });

  it("outranks collecting more of the evidence that raised it", () => {
    /*
     * RULE 4, WHICH THE FILE STATED AND COULD NOT REACH. *"Nothing is coaching until it could have
     * come back negative."* Until now the only route to it was `untestedRule`, which is behind a
     * flag no deployment sets and has no query anywhere in the product, so a record with a
     * candidate and an unfinished anchor set was told to answer more bank positions.
     */
    const unfinishedAnchor = { answered: 3, total: 8 };
    expect(next({ anchor: unfinishedAnchor }).kind).toBe("collect-more-evidence");
    expect(next({ anchor: unfinishedAnchor, claimState: CANDIDATE }).kind).toBe("test-claim");
  });
});

describe("what a test of a claim is, once it has been proposed", () => {
  it("is an act a control can name, and it is the act a rule's test already had", () => {
    expect(actFor("test-claim")).toBe("test-hypothesis");
    expect(producesEvidence({ kind: "test-claim", claimId: "c-1" })).toBe(true);
  });

  it("re-enters the loop where evidence is made, not where it is read", () => {
    expect(reentryOf("test-claim")).toBe("CAPTURE");
  });

  /*
   * ONE STATE PER KIND, BUILT BY A SWITCH RATHER THAN BY A FALLBACK.
   *
   * The first version ended in `{ kind, scored: 0 }` for everything it had not named, which is a
   * shape only two kinds actually have. A kind added later would have been constructed wrong and
   * the assertion would still have passed, which is the opposite of what enumerating
   * `CLAIM_STATE_KINDS` is for. This refuses to compile instead.
   */
  const stateOfKind = (kind: ClaimStateKind): ClaimState => {
    switch (kind) {
      case "unread":
        return { kind: "unread" };
      case "accumulating":
      case "nothing-separated":
        return { kind, scored: 0 };
      case "candidate":
        return CANDIDATE;
      case "decided":
        return { kind: "decided", claimId: "c-1", grade: "replicated" };
      case "retired":
        return { kind: "retired", claimId: "c-1" };
    }
  };

  it("is the only claim state that asks for one", () => {
    expect(CLAIM_STATE_KINDS.filter((kind) => awaitsForwardTest(stateOfKind(kind)))).toEqual([
      "candidate",
    ]);
  });

  it("stops asking once the player has withdrawn it, and that is not the same as an answer", () => {
    const retired = stateOfKind("retired");
    expect(awaitsForwardTest(retired)).toBe(false);
    expect(withdrawnByPlayer(retired)).toBe(true);
    // The two predicates must not be readable as one fact: a decided claim is also not asking,
    // and nobody withdrew it.
    expect(withdrawnByPlayer(stateOfKind("decided"))).toBe(false);
    expect(CLAIM_STATE_KINDS.filter((kind) => withdrawnByPlayer(stateOfKind(kind)))).toEqual([
      "retired",
    ]);
  });
});

describe("the claim state and the sentence a player reads do not drift apart", () => {
  /*
   * `D22` SETTLED WHAT TO DO WITH A FACT THAT HAS TWO REPRESENTATIONS: *"State the correspondence
   * once and test it."* It did that for proposals and controls. This is the same move between the
   * state a derivation branches on and the stage a player is given a sentence about, and without it
   * the record page could say a candidate exists while the derivation saw none.
   */
  const CASES: ReadonlyArray<{ scored: number; hasClaim: boolean; grade: "hypothesis" | "replicated" }> = [
    { scored: 0, hasClaim: false, grade: "hypothesis" },
    { scored: MIN_BUCKET_N, hasClaim: false, grade: "hypothesis" },
    { scored: DISCOVERY_FLOOR, hasClaim: false, grade: "hypothesis" },
    { scored: DISCOVERY_FLOOR, hasClaim: true, grade: "hypothesis" },
    { scored: DISCOVERY_FLOOR, hasClaim: true, grade: "replicated" },
    { scored: 0, hasClaim: true, grade: "hypothesis" },
  ];

  it("agrees on every case the record can be in", () => {
    for (const test of CASES) {
      const state = claimStateOf({
        scored: test.scored,
        claim: test.hasClaim ? { claim_id: "c-1", grade: test.grade } : null,
      });
      const reading = recordJourney({
        scored: test.scored,
        hasClaim: test.hasClaim,
        othersWithheld: 0,
        readElsewhere: 0,
      });
      expect(
        journeyStageOf(state),
        `${JSON.stringify(test)}: the ledger says ${reading.stage}, the state says ${state.kind}`,
      ).toBe(reading.stage);
    }
  });

  it("reads an unread record exactly as the ledger already reads an empty one", () => {
    /*
     * THE ALIASING, RECORDED RATHER THAN REPAIRED. `recordReading(undefined)` renders
     * `ACCUMULATING` with a count of nought, so "not fetched yet" and "nothing recorded" are one
     * sentence on the record page. Separating them changes a surface a cold participant reaches,
     * and `research/player-path/FIELD_RUN_CURRENT.md` freezes that surface until the run happens.
     * The assertion is here so the day somebody separates them, this says which two things parted.
     */
    expect(journeyStageOf({ kind: "unread" })).toBe("ACCUMULATING");
    expect(
      recordJourney({ scored: 0, hasClaim: false, othersWithheld: 0, readElsewhere: 0 }).stage,
    ).toBe("ACCUMULATING");
  });
});
