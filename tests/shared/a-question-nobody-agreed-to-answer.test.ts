/**
 * A finding the instrument produced, which became the player's next project because nobody asked.
 *
 * D27 closed the loop one party short. `claimStateOf` reads a fresh separation as `candidate`,
 * `awaitsForwardTest` is a pure function of that, and `deriveNextAction` therefore proposed
 * `test-claim` on every derivation until a DRILL graded the claim. There was no state in which the
 * player had been asked and had said no, so **a question the player did not want could only be got
 * rid of by answering it** -- which is the nag the same module already forbids one field over:
 * *"An event the product keeps re-offering is not a next action, it is a nag."*
 *
 * The asymmetry that proves the gap is inside the repository. The player's own hypotheses have
 * carried `retired` from the beginning, and `learning-record.ts` says exactly what it is: *"an act
 * of the player's, not a reading of the evidence -- so it is checked before the fold and never
 * rebuilt by it."* What the player wrote, the player could stop pursuing. What the instrument
 * found, the player could only outlive.
 *
 * These tests hold the four properties that make the new grade safe, and every one of them goes red
 * under a specific, plausible implementation:
 *
 *   1. it survives a read            -- red if `evaluateClaim`'s guard is removed, because the fold
 *                                       opens by resetting the grade to `hypothesis`
 *   2. it is not a verdict           -- red if any table renders it beside or as `refuted`
 *   3. it ends the asking            -- red if `awaitsForwardTest` or the derivation ignores it
 *   4. it touches no evidence        -- red if `retireClaim` writes anything but the grade
 *
 * `docs/decisions/D29-question-ownership.md` is the reasoning; this is the enforcement.
 */
import { describe, expect, it } from "vitest";
import {
  CLAIM_GRADES,
  GRADE_WORD,
  awaitingProtocol,
  closedToProposal,
  evaluateClaim,
  gradeIsSettled,
  retireClaim,
  type Claim,
  type ClaimGrade,
  type ProspectiveDrillResult,
} from "@shared/claim";
import { GRADE_AUTHORITY } from "@shared/evidence-authority";
import {
  awaitsForwardTest,
  claimStateOf,
  withdrawnByPlayer,
  type ClaimState,
} from "@shared/claim-state";
import { deriveNextAction, type NextAction, type ProductState } from "@shared/next-action";
import { DISCOVERY_FLOOR } from "@shared/detector";
import type { BlitzStanding } from "@shared/blitz-reading";
import { MemoryRecordStore } from "../../server/record";
import * as service from "@shared/record-service";

const CLAIM_ID = "claim-phase-endgame";

const hypothesis = (over: Partial<Claim> = {}): Claim => ({
  claim_id: CLAIM_ID,
  statement: "הביטחון שלך נשחק בסיומים",
  scope: "החלטות בסיום",
  supporting_decision_ids: ["d-1", "d-2", "d-3"],
  n: 42,
  grade: "hypothesis",
  refutation_condition: "אם בדריל של עמדות מסיום הפער לא יהיה גדול יותר מאשר בשאר — הופרך",
  predicts_overconfidence: true,
  prospective_tests: [],
  graded_under: null,
  created_at: "2026-01-01T00:00:00.000Z",
  last_evaluated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

const drillResult = (over: Partial<ProspectiveDrillResult> = {}): ProspectiveDrillResult => ({
  kind: "prospective_drill_result",
  drill_id: "drill-1",
  claim_id: CLAIM_ID,
  decision_ids: ["d-9", "d-10"],
  predicted: true,
  observed: true,
  protocol: "position-drill",
  recorded_at: "2026-02-01T00:00:00.000Z",
  ...over,
});

const RETIRED_AT = "2026-03-01T12:00:00.000Z";

describe("the grade that survives being read", () => {
  /*
   * THE SHARPEST TEST IN THE FILE. `evaluateClaim` opens by resetting the grade to `hypothesis` and
   * replaying the results, which is what makes it idempotent and safe on a hot path -- and is
   * exactly what would un-retire a claim on the next read, because no result produced the grade.
   * Delete the guard in `evaluateClaim` and this goes red; nothing else in the suite would.
   */
  it("is not rebuilt by the fold, which resets every other grade", () => {
    const retired = retireClaim(hypothesis(), RETIRED_AT);
    expect(evaluateClaim(retired, []).grade).toBe("retired");
    expect(evaluateClaim(retired, [drillResult()]).grade).toBe("retired");
  });

  it("returns the claim untouched rather than merely keeping the grade", () => {
    const retired = retireClaim(hypothesis(), RETIRED_AT);
    expect(evaluateClaim(retired, [drillResult()])).toEqual(retired);
  });

  /*
   * The narrower race the guard above does not cover: a drill already in flight when the player
   * retires the question, whose result lands afterwards. Discarding it loses a measurement somebody
   * produced; letting it grade lets the instrument answer a question that was withdrawn.
   */
  it("records a result that lands after the retirement and does not let it grade", () => {
    const retired = retireClaim(hypothesis(), RETIRED_AT);
    const late = { ...retired, prospective_tests: [] as ProspectiveDrillResult[] };
    const after = evaluateClaim({ ...late, grade: "retired" }, [drillResult()]);
    expect(after.grade).toBe("retired");
    expect(after.graded_under).toBeNull();
  });
});

describe("a question withdrawn is not a question answered", () => {
  it("is spoken with a different word from the one a refutation gets", () => {
    expect(GRADE_WORD.retired.he).not.toBe(GRADE_WORD.refuted.he);
    expect(GRADE_WORD.retired.en).not.toBe(GRADE_WORD.refuted.en);
    // Every grade is speakable, and no two share a word. A table that let two grades read alike
    // would make the distinction unenforceable wherever it is rendered.
    const words = CLAIM_GRADES.map((grade) => GRADE_WORD[grade].he);
    expect(new Set(words).size).toBe(CLAIM_GRADES.length);
  });

  it("carries the authority it had, not the authority of a closed negative", () => {
    expect(GRADE_AUTHORITY.retired).toBe(GRADE_AUTHORITY.hypothesis);
    expect(GRADE_AUTHORITY.retired).not.toBe(GRADE_AUTHORITY.refuted);
    expect(GRADE_AUTHORITY.retired).not.toBe(GRADE_AUTHORITY.replicated);
  });

  it("is never settled, even when an older off-protocol drill left a grade behind it", () => {
    const withHistory = hypothesis({ graded_under: "position-drill", prospective_tests: [] });
    const retired = retireClaim(withHistory, RETIRED_AT);
    expect(gradeIsSettled(retired)).toBe(false);
    // ...and the contrast that makes the assertion mean something.
    expect(gradeIsSettled({ ...withHistory, grade: "replicated" })).toBe(true);
  });

  it("awaits no protocol, because nothing is going to run", () => {
    expect(awaitingProtocol(retireClaim(hypothesis(), RETIRED_AT))).toBeNull();
  });
});

describe("what retiring touches", () => {
  it("writes the grade and the evaluation time, and nothing that is evidence", () => {
    const before = hypothesis();
    const after = retireClaim(before, RETIRED_AT);
    expect(after).toEqual({ ...before, grade: "retired", last_evaluated_at: RETIRED_AT });
    // Named individually as well, because `toEqual` above would still pass if the fixture and the
    // function drifted together.
    expect(after.n).toBe(before.n);
    expect(after.supporting_decision_ids).toEqual(before.supporting_decision_ids);
    expect(after.statement).toBe(before.statement);
    expect(after.scope).toBe(before.scope);
    expect(after.refutation_condition).toBe(before.refutation_condition);
    expect(after.prospective_tests).toEqual(before.prospective_tests);
    expect(after.graded_under).toBe(before.graded_under);
  });

  it("leaves a claim a forward test already answered exactly as it was", () => {
    for (const grade of ["replicated", "refuted"] as const) {
      const decided = hypothesis({ grade, graded_under: "position-drill" });
      // Identity, not equality: nothing is written, so the same object comes back and the store
      // write is skipped.
      expect(retireClaim(decided, RETIRED_AT)).toBe(decided);
    }
  });

  it("is idempotent, so pressing twice cannot move the timestamp of the decision", () => {
    const once = retireClaim(hypothesis(), RETIRED_AT);
    const twice = retireClaim(once, "2026-04-01T00:00:00.000Z");
    expect(twice.last_evaluated_at).toBe(RETIRED_AT);
    expect(twice).toBe(once);
  });
});

describe("the claim layer stops asking", () => {
  const view = (grade: ClaimGrade) => ({
    scored: DISCOVERY_FLOOR,
    claim: { claim_id: CLAIM_ID, grade },
  });

  it("reads a retired claim as its own state rather than as a decided one", () => {
    const state = claimStateOf(view("retired"));
    expect(state).toEqual({ kind: "retired", claimId: CLAIM_ID });
  });

  it("does not propose a forward test for it, and does not call it decided", () => {
    const state = claimStateOf(view("retired"));
    expect(awaitsForwardTest(state)).toBe(false);
    expect(withdrawnByPlayer(state)).toBe(true);
    // A decided claim is also not asking. The two predicates must not be one fact: a surface that
    // said "this has been answered" about a withdrawn question would make a claim on the
    // instrument's behalf that the instrument never made.
    expect(withdrawnByPlayer(claimStateOf(view("refuted")))).toBe(false);
  });

  it("still reads an ungraded separation as a candidate, which is the state it must not collapse", () => {
    expect(claimStateOf(view("hypothesis"))).toEqual({ kind: "candidate", claimId: CLAIM_ID });
  });
});

describe("the derivation", () => {
  const MAY: BlitzStanding = {
    kind: "may-read",
    reading: { kind: "no-finding", games: 12 },
  } as unknown as BlitzStanding;

  const SETTLED: ProductState = {
    pendingAnalyses: 0,
    analysisRunning: false,
    drill: null,
    transfer: null,
    unseenEvent: null,
    untestedRule: null,
    claimState: { kind: "nothing-separated", scored: DISCOVERY_FLOOR },
    blitzStanding: MAY,
    decisionsOnRecord: DISCOVERY_FLOOR,
    anchor: { answered: 8, total: 8 },
  };
  const next = (over: Partial<ProductState>): NextAction =>
    deriveNextAction({ ...SETTLED, ...over });

  const CANDIDATE: ClaimState = { kind: "candidate", claimId: CLAIM_ID };
  const RETIRED: ClaimState = { kind: "retired", claimId: CLAIM_ID };

  it("proposes the test while the player has not answered", () => {
    expect(next({ claimState: CANDIDATE })).toEqual({ kind: "test-claim", claimId: CLAIM_ID });
  });

  it("stops proposing it once the player has said no", () => {
    expect(next({ claimState: RETIRED }).kind).not.toBe("test-claim");
  });

  /*
   * THE PROPERTY THE MISSION IS ACTUALLY FOR, stated as one assertion: nothing about the record
   * changed between these two derivations except that a person answered. A system-generated finding
   * cannot become a user obligation merely because the detector produced it.
   */
  it("changes its proposal on the player's answer alone, with every record fact held equal", () => {
    const held = { pendingAnalyses: 0, drill: null, transfer: null, untestedRule: null } as const;
    expect(next({ ...held, claimState: CANDIDATE }).kind).toBe("test-claim");
    expect(next({ ...held, claimState: RETIRED }).kind).not.toBe("test-claim");
  });

  it("keeps the player's own question ahead of the instrument's, retired or not", () => {
    // The constitutional ordering of D22. Adding a way out of the queue must not reorder it.
    expect(next({ claimState: CANDIDATE, untestedRule: "rule-7" })).toEqual({
      kind: "test-hypothesis",
      ruleId: "rule-7",
    });
    expect(next({ claimState: RETIRED, untestedRule: "rule-7" })).toEqual({
      kind: "test-hypothesis",
      ruleId: "rule-7",
    });
  });

  it("keeps a drill in flight ahead of everything, so retiring cannot strand one", () => {
    const inFlight = { drillId: "drill-1", done: 3, total: 8 };
    expect(next({ claimState: RETIRED, drill: inFlight }).kind).toBe("continue-drill");
  });
});

describe("the vocabulary that decides what may still be proposed", () => {
  it("closes on a verdict and on a withdrawal, and on nothing else", () => {
    const closed = CLAIM_GRADES.filter(closedToProposal);
    expect([...closed].sort()).toEqual(["refuted", "replicated", "retired"]);
    expect(closedToProposal("hypothesis")).toBe(false);
  });
});

describe("the store and the service, where the decision has to survive a race", () => {
  /*
   * THE GUARD IS IN THE STORE AND NOT IN THE SERVICE, on the precedent `saveLearningRule` set for
   * the other authorship. `evaluateClaim` refuses to REBUILD the grade; the fold's WRITE could
   * still overwrite it, because a drill completing reads the claim, awaits its results, and writes
   * -- and the player can retire the question in that window, from a second tab or a double tap.
   * A service-level check would be another read-then-write and would lose the same race.
   */
  it("refuses any write that takes a claim back off retired", async () => {
    const store = new MemoryRecordStore();
    const retired = retireClaim(hypothesis(), RETIRED_AT);
    await store.saveClaim(retired);

    for (const grade of ["hypothesis", "replicated", "refuted"] as const) {
      await expect(store.saveClaim({ ...retired, grade })).rejects.toThrow(/retired/);
    }
    expect((await store.getClaim(CLAIM_ID))?.grade).toBe("retired");
  });

  it("still accepts a retired claim written back as retired, so a completion mid-run is not lost", async () => {
    const store = new MemoryRecordStore();
    const retired = retireClaim(hypothesis(), RETIRED_AT);
    await store.saveClaim(retired);
    await expect(store.saveClaim(retired)).resolves.toBeUndefined();
  });

  it("writes nothing when there is nothing to write", async () => {
    const store = new MemoryRecordStore();
    const decided = hypothesis({ grade: "refuted", graded_under: "position-drill" });
    await store.saveClaim(decided);
    const back = await service.retireClaimById(store, { claim_id: CLAIM_ID }, {
      retired_at: RETIRED_AT,
    });
    expect(back.grade).toBe("refuted");
    expect((await store.getClaim(CLAIM_ID))?.last_evaluated_at).toBe(decided.last_evaluated_at);
  });

  it("refuses to build a drill for a question the player withdrew, in words that are not a verdict", async () => {
    const store = new MemoryRecordStore();
    await store.saveClaim(hypothesis());
    await service.retireClaimById(store, { claim_id: CLAIM_ID }, { retired_at: RETIRED_AT });

    const attempt = service.beginDrill(
      store,
      { claim_id: CLAIM_ID, candidate_fens: [] },
      { drill_id: "drill-9", started_at: "2026-03-02T00:00:00.000Z" },
    );
    await expect(attempt).rejects.toThrow(/מהתור/);
    /*
     * AND IT MUST NOT REPORT A REFUTATION. A player told "it was already refuted" about a question
     * they withdrew has been told the instrument answered something it never asked, which is the
     * one confusion this whole grade exists to prevent.
     */
    await expect(attempt).rejects.not.toThrow(/הופרכה/);
  });
});
