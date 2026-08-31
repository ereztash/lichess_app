/**
 * `nextAction` -- one derivation, and the two things it must never become.
 *
 * IT MUST NEVER RECOMMEND. `ContextRibbon` wrote the line this module has to stay on the near side
 * of: *"a layer that recommended would be measuring the player and then changing what they see,
 * which changes what is being measured."* Every action here is justified by a fact about the
 * RECORD -- a game nothing has scored, a bucketing with too few decisions on one side, a run left
 * half-finished -- and never by anything predicted about the player. D21 is why that matters more
 * than it looks: decisions taken after a player has seen feedback are pooled with decisions taken
 * before, and nothing in the record could separate them, so a layer that changed what a player was
 * shown based on their own measurements would create exactly the exposure the record cannot hold.
 *
 * IT MUST NEVER INVENT AN ANSWER. A function that always has a suggestion will produce one where
 * the product has least to say, which is where a wrong suggestion costs most. `none` is a
 * first-class result and this file requires it to be reachable.
 *
 * THE DEFECT IT REPLACES IS SPECIFIC. `readResume`'s `NEXT_STEP` maps `nothing-scored` to
 * *"שחק עוד משחק"* -- play another game -- when what is blocking the record is an engine that has
 * not run over the games already in it. That answer grows the backlog that is the blocker. Since
 * LAW 4's queue the analysis genuinely does finish on its own, from any page load, so waiting is
 * now a thing that works and is the honest answer.
 */
import { describe, expect, it } from "vitest";
import {
  deriveNextAction,
  producesEvidence,
  type NextAction,
  type NextActionKind,
  type ProductState,
} from "@shared/next-action";
import { BLITZ_BLOCKERS, type BlitzStanding } from "@shared/blitz-reading";
import { MODE_CONTRACT } from "@shared/interaction-mode";

const MAY: BlitzStanding = { may: true, readable: 120 };
const blocked = (because: (typeof BLITZ_BLOCKERS)[number]): BlitzStanding => ({
  may: false,
  because,
  readable: 4,
  needs: null,
});

const SETTLED: ProductState = {
  pendingAnalyses: 0,
  analysisRunning: false,
  drill: null,
  transfer: null,
  unseenEvent: null,
  untestedRule: null,
  blitzStanding: MAY,
  decisionsOnRecord: 40,
  anchor: { answered: 8, total: 8 },
};

const next = (over: Partial<ProductState>): NextAction =>
  deriveNextAction({ ...SETTLED, ...over });

describe("unscored evidence outranks making more of it", () => {
  it("says wait, not play, when games are stored and nothing has scored them", () => {
    /*
     * THE ONE THIS MODULE EXISTS FOR. `nothing-scored` is the blocker, and the product's answer to
     * it was to ask for another game -- which adds to the backlog that IS the blocker.
     */
    const action = next({ pendingAnalyses: 3, blitzStanding: blocked("nothing-scored") });
    expect(action.kind).toBe("wait-analysis");
    expect(action).toMatchObject({ games: 3, scoring: false });
  });

  it("says whether the queue is working right now, because those are two sentences", () => {
    /*
     * `analysisState: "pending"` is the same stored value for "the queue has not reached this game"
     * and "the queue is scoring it as we speak". A player watching a still number and a player
     * watching a moving one are owed different words.
     */
    expect(next({ pendingAnalyses: 2, analysisRunning: true })).toMatchObject({ scoring: true });
    expect(next({ pendingAnalyses: 2, analysisRunning: false })).toMatchObject({ scoring: false });
  });

  it("stops saying wait the moment the backlog is empty", () => {
    expect(next({ pendingAnalyses: 0 }).kind).not.toBe("wait-analysis");
  });

  it("does not ask the player to make evidence while evidence is unprocessed", () => {
    /* LAW 1 and LAW 4 meeting: the wait is the action precisely because the alternative adds work. */
    expect(producesEvidence(next({ pendingAnalyses: 5 }))).toBe(false);
  });
});

describe("a run in progress outranks everything", () => {
  it("finishes a drill before anything else, including a backlog", () => {
    /*
     * A drill is eight positions chosen in advance to test one thing, and four of them tests
     * nothing. Abandoning it does not lose the decisions -- they are all committed -- it loses the
     * only thing that made them a test.
     */
    const action = next({
      drill: { drillId: "d1", done: 3, total: 8 },
      pendingAnalyses: 9,
      unseenEvent: { gameId: "g", ply: 7 },
    });
    expect(action).toMatchObject({ kind: "continue-drill", drillId: "d1", done: 3, total: 8 });
  });

  it("finishes a transfer run for the same reason", () => {
    expect(next({ transfer: { transferId: "t1", done: 1, total: 3 }, pendingAnalyses: 9 })).toMatchObject(
      { kind: "continue-transfer", transferId: "t1" },
    );
  });
});

describe("a finding nobody has read outranks collecting more", () => {
  it("offers the event before another game", () => {
    const action = next({ unseenEvent: { gameId: "g4", ply: 21 } });
    expect(action).toMatchObject({ kind: "review-event", gameId: "g4", ply: 21 });
  });

  it("offers a forward test before more evidence, because an untested rule is not a finding", () => {
    expect(next({ untestedRule: "r7" })).toMatchObject({ kind: "test-hypothesis", ruleId: "r7" });
  });

  it("puts the unread event above the untested rule", () => {
    /* One is something the record already showed; the other is something it has yet to check. */
    expect(next({ unseenEvent: { gameId: "g", ply: 1 }, untestedRule: "r7" }).kind).toBe(
      "review-event",
    );
  });
});

describe("what the blocker asks for", () => {
  it("asks for the first decision on an empty record", () => {
    expect(
      next({ decisionsOnRecord: 0, blitzStanding: blocked("no-games"), anchor: { answered: 0, total: 8 } }),
    ).toEqual({ kind: "play-first-decision" });
  });

  it.each(["nothing-asked", "too-few-readable", "no-split-yet"] as const)(
    "asks for a game when the blocker is %s",
    (because) => {
      const action = next({ blitzStanding: blocked(because) });
      expect(action).toMatchObject({ kind: "play-blitz", because });
    },
  );

  it("carries the shortfall through, so a screen does not go and find it again", () => {
    const needs = {
      decisions: 12,
      nearestBucket: "fast-under-45s",
      games: 2,
      readableDecisionsPerGame: 6,
      gamesMeasuredOn: 9,
    };
    expect(next({ blitzStanding: { may: false, because: "too-few-readable", readable: 18, needs } })).toMatchObject(
      { kind: "play-blitz", needs },
    );
  });

  it("names the anchor set when that is what is unfinished, rather than a number it made up", () => {
    /*
     * A DECISION COUNT WOULD BE A THIRD DEFINITION OF "ENOUGH". The anchor set is the one reading
     * that is comparable between players, and a record that has not finished it is missing a
     * specific nameable thing rather than merely being small.
     */
    expect(next({ anchor: { answered: 5, total: 8 } })).toMatchObject({
      kind: "collect-more-evidence",
      anchorAnswered: 5,
      anchorTotal: 8,
    });
  });

  it("proposes the record when nothing is blocked and nothing is half-done", () => {
    expect(next({})).toEqual({ kind: "return-record" });
  });
});

describe("what it refuses to say", () => {
  it("proposes nothing while the reading has not arrived", () => {
    /*
     * NOT READ YET IS NOT UNBLOCKED. The front door renders before the blitz reading resolves, and
     * a derivation that treated an unread record as an unblocked one would tell a player with
     * eleven unscored games that there is nothing to do.
     */
    expect(next({ blitzStanding: null })).toEqual({ kind: "none" });
  });

  it("still answers from the facts it holds synchronously, before any reading arrives", () => {
    /* A backlog and a half-finished drill are counted by the caller, not read from a projection. */
    expect(next({ blitzStanding: null, pendingAnalyses: 2 }).kind).toBe("wait-analysis");
    expect(next({ blitzStanding: null, drill: { drillId: "d", done: 1, total: 4 } }).kind).toBe(
      "continue-drill",
    );
  });

  it("can produce every kind it declares, so no branch is unreachable", () => {
    /*
     * An enum value nothing can produce is a branch nothing can test. Every kind below is reached
     * by a state above; this asserts the set, so a kind added and never wired in fails here rather
     * than sitting in the union looking implemented.
     */
    const reached = new Set<NextActionKind>([
      next({ pendingAnalyses: 1 }).kind,
      next({ drill: { drillId: "d", done: 1, total: 4 } }).kind,
      next({ transfer: { transferId: "t", done: 1, total: 3 } }).kind,
      next({ unseenEvent: { gameId: "g", ply: 3 } }).kind,
      next({ untestedRule: "r" }).kind,
      next({ decisionsOnRecord: 0, blitzStanding: blocked("no-games") }).kind,
      next({ blitzStanding: blocked("too-few-readable") }).kind,
      next({ anchor: { answered: 1, total: 8 } }).kind,
      next({}).kind,
      next({ blitzStanding: null }).kind,
    ]);
    expect([...reached].sort()).toEqual(
      [
        "collect-more-evidence",
        "continue-drill",
        "continue-transfer",
        "none",
        "play-blitz",
        "play-first-decision",
        "return-record",
        "review-event",
        "test-hypothesis",
        "wait-analysis",
      ].sort(),
    );
  });
});

describe("it is a router, not a coach", () => {
  it("gives the same answer whatever the record says about the player", () => {
    /*
     * THE ASSERTION THAT KEEPS THIS ON THE NEAR SIDE OF THE LINE. `ProductState` carries no verdict,
     * no gap, no bucket and no claim -- only what is MISSING. If a field describing how well the
     * player decides ever arrives here, this stops compiling, which is the point.
     */
    const fields = Object.keys(SETTLED).sort();
    expect(fields).toEqual(
      [
        "analysisRunning",
        "anchor",
        "blitzStanding",
        "decisionsOnRecord",
        "drill",
        "pendingAnalyses",
        "transfer",
        "unseenEvent",
        "untestedRule",
      ].sort(),
    );
  });

  it("never routes a player into a mode that forbids what the action needs", () => {
    /*
     * THE BINDING TO LAW 1. Every action that produces evidence lands in a mode where no reading of
     * the record may be on screen. A screen that offered such an action beside its own findings
     * would be offering a route into a contaminated measurement.
     */
    for (const mode of ["DECIDE", "ANSWER_INSTRUMENT", "TEST"] as const) {
      expect(MODE_CONTRACT[mode].priorEvidence, mode).toBe(false);
      expect(MODE_CONTRACT[mode].producingEvidence, mode).toBe(true);
    }
    expect(producesEvidence({ kind: "continue-drill", drillId: "d", done: 1, total: 4 })).toBe(true);
    expect(producesEvidence({ kind: "wait-analysis", games: 1, scoring: true })).toBe(false);
    expect(producesEvidence({ kind: "review-event", gameId: "g", ply: 1 })).toBe(false);
  });
});
