import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import type { DecisionResult } from "../../shared/decision-atom";
import {
  gradeLearningRule,
  type LearningRuleDraft,
  type LearningTransferResult,
  transferObservation,
} from "../../shared/learning-record";
import { classifyPhase } from "../../shared/phase";
import { plyFromFen, positionKey } from "../../shared/position-key";
import * as service from "../../shared/record-service";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
/**
 * Fixture positions, and why the fullmove numbers run high.
 *
 * `beginLearningTransfer` excludes OPENING positions from a transfer, because this product's own
 * baseline puts accuracy there at 70.3% against 60.2% everywhere else -- so `cp_loss <= 30` is
 * very nearly free and half the success criterion stops discriminating. `classifyPhase` reads the
 * ply, and a FEN carries one in its fullmove field.
 *
 * FENS[0] stays at move 1: it is the rule's SOURCE position, never a transfer candidate. The rest
 * are the same boards at move 12 and later, which is unusual but legal -- a shuffled game reaches
 * a full board late. They are fixtures for a selection rule, not a chess narrative, and being
 * explicit about that is better than dressing them up as a plausible game.
 */
const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 12",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 13",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 14",
  "r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 15",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 16",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 17",
] as const;

const RESULT: DecisionResult = {
  engine_eval_cp: 0,
  engine_best_move: "e2e4",
  engine_depth: 18,
  engine_source: "local_sf18",
  cp_loss: 10,
};

const RULE: LearningRuleDraft = {
  source_decision_id: SOURCE_ID,
  trigger: "When the opponent changes the pawn structure near my king",
  mechanism_class: "threat_scan",
  missed_signal: "I did not scan forcing checks before choosing a developing move",
  action_rule: "List checks, captures and direct threats before generating quiet candidates",
  exception_rule: null,
  predicted_outcome: "I will avoid one-move tactical losses in similar positions",
  refutation_condition: "Fewer than two accurate applications in three unseen positions",
};

async function recordPosition(
  store: MemoryRecordStore,
  id: string,
  fen: string,
  result: DecisionResult = RESULT,
) {
  await store.commitDecision({
    decisionId: id,
    gameId: "learning",
    fen,
    ply: 0,
    phase: "opening",
    clockMsRemaining: null,
    secondsTaken: 10,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4"],
    statedRead: "I can develop safely",
    statedUnknown: "I may have missed a forcing move",
    confidence: 3,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 20,
    revealTiming: "per-decision",
  });
  await store.recordReveal(id, result);
}

async function createRule(store: MemoryRecordStore) {
  await recordPosition(store, SOURCE_ID, FENS[0]);
  return service.createLearningRule(
    store,
    {
      reflection: {
        revised_read: "I should have scanned forcing moves",
        would_choose_again: false,
      },
      rule: RULE,
    },
    { rule_id: "rule-1", created_at: "2026-01-01T00:00:00.000Z" },
  );
}


/**
 * Sit a transfer the way the product now does: record each observation as it is made, then
 * complete with nothing but the transfer id.
 *
 * The observations used to travel in the completion payload. They are written one at a time now,
 * so a test that still posted them wholesale would be exercising a request shape the server no
 * longer accepts -- which is exactly why the type system flagged every one of these call sites.
 */
async function sitTransfer(
  store: MemoryRecordStore,
  transferId: string,
  observations: { decision_id: string; recalled_rule: string; applied_rule: boolean }[],
  completed_at: string,
) {
  for (const observation of observations) {
    await service.recordLearningTransferObservation(store, {
      transfer_id: transferId,
      observation,
    });
  }
  return service.finishLearningTransfer(store, { transfer_id: transferId }, { completed_at });
}

describe("verified learning record", () => {
  it("only forms a player-authored rule after reveal and keeps the reflection append-only", async () => {
    const store = new MemoryRecordStore();
    await store.commitDecision({
      decisionId: SOURCE_ID,
      gameId: "learning",
      fen: FENS[0],
      ply: 0,
      phase: "opening",
      clockMsRemaining: null,
      secondsTaken: 10,
      chosenMove: "e2e4",
      candidateMovesConsidered: ["e2e4"],
      statedRead: "safe",
      statedUnknown: "threat",
      confidence: 3,
      confidenceScale: CONFIDENCE_LEVELS,
      probeAssignment: "not-probed",
      legalMoves: 20,
      revealTiming: "per-decision",
    });
    await expect(
      service.createLearningRule(
        store,
        { reflection: { revised_read: "new read", would_choose_again: false }, rule: RULE },
        { rule_id: "rule-1", created_at: "2026-01-01T00:00:00.000Z" },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    await store.recordReveal(SOURCE_ID, RESULT);
    const rule = await service.createLearningRule(
      store,
      {
        reflection: { revised_read: "new read", would_choose_again: false },
        rule: RULE,
      },
      { rule_id: "rule-1", created_at: "2026-01-01T00:00:00.000Z" },
    );
    expect(rule).toMatchObject({ authored_by: "player", grade: "hypothesis" });
    expect((await store.getAtom(SOURCE_ID))?.feedback?.revised_read).toBe("new read");

    await expect(
      service.createLearningRule(
        store,
        { reflection: { revised_read: "rewritten later", would_choose_again: true }, rule: RULE },
        { rule_id: "rule-2", created_at: "2026-01-02T00:00:00.000Z" },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("pre-registers exactly three unseen positions before returning them", async () => {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const early = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "too-early", started_at: "2026-01-01T12:00:00.000Z" },
    );
    expect(early.transfer).toBeNull();
    // The reason is user-facing and now Hebrew; the assertion follows the message it guards.
    expect(early.reason).toContain("חזרה מרווחת");

    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[0], FENS[1], FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer?.fens).toEqual([FENS[1], FENS[2], FENS[3]]);
    expect(await store.getLearningTransfer("transfer-1")).toEqual(outcome.transfer);
    expect(outcome.transfer?.rule_snapshot.action_rule).toBe(rule.action_rule);
  });

  it("refutes a rule when the pre-registered transfer condition fails", async () => {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const { transfer } = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(transfer).not.toBeNull();
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    for (let index = 0; index < ids.length; index += 1) {
      await recordPosition(store, ids[index], transfer!.fens[index]);
    }
    const outcome = await sitTransfer(store, transfer!.transfer_id, ids.map((decision_id, index) => ({
          decision_id,
          recalled_rule: index === 0 ? rule.action_rule : "",
          applied_rule: index === 0,
        })), "2026-01-02T01:00:00.000Z");
    expect(outcome.result).toMatchObject({ successes: 1, observed: false });
    /*
     * ONE FAILED TEST DOES NOT REFUTE, and this assertion changed on purpose.
     *
     * It used to expect `refuted` with `next_due_at: null` right here -- permanent, from a single
     * sitting of three positions -- while REPLICATING required two separate days. The product
     * needed two days of evidence to say a rule worked and one bad afternoon to say it did not,
     * on a sample every single-case standard consulted calls too small either way.
     *
     * That asymmetry turned every weakness of the recall measure into a permanent verdict about a
     * person. The rule stays a hypothesis and comes back at the next interval, which is what the
     * retrieval schedule is for.
     */
    expect(outcome.rule).toMatchObject({ grade: "hypothesis" });
    expect(outcome.rule?.next_due_at, "a failed test dropped the rule out of the queue").not.toBeNull();
  });

  it("refutes only after failures on two distinct dates, mirroring replication", () => {
    const base = {
      ...RULE,
      rule_id: "rule-1",
      authored_by: "player" as const,
      grade: "hypothesis" as const,
      retrieval_step: 0,
      next_due_at: "2026-01-02T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      last_evaluated_at: "2026-01-01T00:00:00.000Z",
    };
    const failure = (day: string): LearningTransferResult => ({
      kind: "learning_transfer_result",
      transfer_id: `t-${day}`,
      rule_id: "rule-1",
      decision_ids: [],
      recalled_rules: [],
      applied_rule: [],
      successes: 0,
      observed: false,
      completed_at: `${day}T01:00:00.000Z`,
    });

    const afterOne = gradeLearningRule(base, [], failure("2026-01-02"));
    expect(afterOne.grade).toBe("hypothesis");

    // Two failures on the SAME day are one sitting, not two. Symmetric with replication, which
    // counts distinct dates for the same reason: a day is the unit that separates two tests.
    const sameDay = gradeLearningRule(afterOne, [failure("2026-01-02")], failure("2026-01-02"));
    expect(sameDay.grade).toBe("hypothesis");

    const afterTwo = gradeLearningRule(afterOne, [failure("2026-01-02")], failure("2026-01-09"));
    expect(afterTwo.grade).toBe("refuted");
    expect(afterTwo.next_due_at).toBeNull();
  });

  it("requires successful tests on two distinct dates before replication", () => {
    const base = {
      ...RULE,
      rule_id: "rule-1",
      authored_by: "player" as const,
      grade: "hypothesis" as const,
      retrieval_step: 0,
      next_due_at: "2026-01-02T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      last_evaluated_at: "2026-01-01T00:00:00.000Z",
    };
    const result = (id: string, completed_at: string): LearningTransferResult => ({
      kind: "learning_transfer_result",
      transfer_id: id,
      rule_id: "rule-1",
      decision_ids: [],
      recalled_rules: [],
      applied_rule: [],
      successes: 3,
      observed: true,
      completed_at,
    });
    const first = result("t1", "2026-01-02T08:00:00.000Z");
    const afterFirst = gradeLearningRule(base, [], first);
    expect(afterFirst.grade).toBe("hypothesis");
    expect(
      gradeLearningRule(afterFirst, [first], result("t2", "2026-01-02T18:00:00.000Z")).grade,
    ).toBe("hypothesis");
    expect(
      gradeLearningRule(afterFirst, [first], result("t3", "2026-01-05T08:00:00.000Z")).grade,
    ).toBe("replicated");
  });
});

describe("a preregistered transfer cannot be escaped or restarted", () => {
  /*
   * WHAT PREREGISTRATION IS FOR, and what these three defects each did to it. A test written down
   * before it runs is only worth something if the version that ran is the version that counts.
   * A player who can see the positions, dislike them, reload, and start again is choosing their
   * own evidence -- and every finding the app then reports carries a preregistration stamp it did
   * not earn.
   */

  it("refuses to start when the schedule is finished, rather than treating null as due now", async () => {
    /*
     * `next_due_at: null` means the retrieval schedule RAN OUT -- `gradeLearningRule` sets it when
     * the last interval passes. Both the service and the queue read it as "due now", so a rule
     * that had completed its schedule offered an unlimited supply of fresh tests, while the row
     * beside the button said "אין בדיקה נוספת".
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    await store.saveLearningRule({ ...rule, grade: "replicated", next_due_at: null, retrieval_step: 4 });

    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "after-the-end", started_at: "2030-01-01T00:00:00.000Z" },
    );
    expect(outcome.transfer).toBeNull();
    expect(outcome.reason).toBeTruthy();
    expect(await store.getLearningTransfer("after-the-end")).toBeNull();
  });

  it("hands back the transfer already in flight instead of preregistering a second one", async () => {
    /*
     * THE ABANDON-AND-RETRY HOLE. The started transfer lived on the server; the fact that one was
     * running lived only in React state. A reload lost the second and left the first orphaned,
     * and nothing stopped a fresh preregistration over the same rule -- so a player could look at
     * three positions, not like them, refresh, and draw three more.
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const first = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(first.transfer).not.toBeNull();

    const second = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[4], FENS[5], FENS[6]] },
      { transfer_id: "transfer-2", started_at: "2026-01-02T00:05:00.000Z" },
    );
    // The SAME test, resumed -- not a refusal, because losing the tab is not misconduct and the
    // player has to be able to finish what was registered for them.
    expect(second.transfer?.transfer_id).toBe("transfer-1");
    expect(second.transfer?.fens).toEqual(first.transfer?.fens);
    expect(await store.getLearningTransfer("transfer-2")).toBeNull();
  });

  it("lets the next test start once the one in flight has reported", async () => {
    // The other half. A single-active rule that never releases would end the schedule at one
    // test, which refutes rules by making them untestable.
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const { transfer } = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    for (let index = 0; index < ids.length; index += 1) {
      await recordPosition(store, ids[index], transfer!.fens[index]);
    }
    await sitTransfer(store, transfer!.transfer_id, ids.map((decision_id) => ({
          decision_id,
          recalled_rule: rule.action_rule,
          applied_rule: true,
        })), "2026-01-02T01:00:00.000Z");
    const after = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[4], FENS[5], FENS[6]] },
      { transfer_id: "transfer-2", started_at: "2026-02-01T00:00:00.000Z" },
    );
    expect(after.transfer?.transfer_id).toBe("transfer-2");
  });

  it("does not offer a board the player has already decided, whatever the move counters say", async () => {
    /*
     * A FEN carries six fields and the last two record the GAME, not the POSITION. Knights out and
     * back reach the identical board with the counters advanced, and the whole-string comparison
     * this replaces called that a position nobody had seen. The transfer test's entire claim rests
     * on these being positions the player has NOT decided: a rule that "transferred" to a board
     * they had already been shown the answer for is measuring recall of that answer.
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    /*
     * DECIDED SEPARATELY FROM THE RULE'S SOURCE, and that distinction is load-bearing. An earlier
     * version of this test used the source position, which `beginLearningTransfer` excludes by a
     * SECOND path -- so reverting the `listAtoms` half to whole-string comparison changed nothing
     * and a positive control walked straight through. The board here is reachable only through
     * the decided-positions set.
     */
    const seen = FENS[4];
    await recordPosition(store, "55555555-5555-4555-8555-555555555555", seen);
    const sameBoardLaterInTheGame = seen.replace(/ \d+ \d+$/, " 8 21");
    expect(sameBoardLaterInTheGame).not.toBe(seen);

    const outcome = await service.beginLearningTransfer(
      store,
      {
        rule_id: rule.rule_id,
        candidate_fens: [sameBoardLaterInTheGame, FENS[1], FENS[2], FENS[3]],
      },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer?.fens).not.toContain(sameBoardLaterInTheGame);
    expect(outcome.transfer?.fens).toEqual([FENS[1], FENS[2], FENS[3]]);
  });

  it("counts one board once when the candidates repeat it under different counters", async () => {
    // Deduplication has the same hole as the novelty check: three spellings of one board would
    // have filled a three-position test with a single decision.
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const board = FENS[1];
    const outcome = await service.beginLearningTransfer(
      store,
      {
        rule_id: rule.rule_id,
        candidate_fens: [board, board.replace(/ \d+ \d+$/, " 3 19"), board.replace(/ \d+ \d+$/, " 7 22")],
      },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer, "three spellings of one board filled a three-position test").toBeNull();
    expect(outcome.reason).toContain("1");
  });
});

describe("the rule's own source position is never offered back", () => {
  it("excludes it through the decided-positions set, with no second path", async () => {
    /*
     * WHY THIS TEST EXISTS SEPARATELY. `beginLearningTransfer` used to add the source position to
     * the decided set explicitly, on top of `listAtoms()`. That line was dead -- a rule cannot
     * exist unless its source was committed and revealed, so `listAtoms()` already returns it --
     * and a positive control proved it by deleting the line and watching nothing fail.
     *
     * Removing dead code is only safe if the behaviour it appeared to provide is still asserted,
     * and it was not: every existing test reached the source through the other path. This is that
     * assertion, and it is the reason the deletion is defensible.
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[0], FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer?.fens, "the position the rule was born from came back as a test").not.toContain(FENS[0]);
  });
});

describe("the transfer is graded against the rule, not against arbitrary text", () => {
  /** Run three positions with the same recall text, and report what the test made of it. */
  async function runTransfer(recalled: string, applied: boolean) {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const { transfer } = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    for (let index = 0; index < ids.length; index += 1) {
      // cp_loss 10, comfortably accurate: the engine half of the criterion is satisfied on every
      // position, so what the verdict turns on is the recall alone.
      await recordPosition(store, ids[index], transfer!.fens[index]);
    }
    return sitTransfer(store, transfer!.transfer_id, ids.map((decision_id) => ({
          decision_id,
          recalled_rule: recalled,
          applied_rule: applied,
        })), "2026-01-02T01:00:00.000Z");
  }

  it("does not count `banana` as a successful retrieval", async () => {
    /*
     * THE REPRODUCTION. Non-empty text, the box ticked, an accurate move: three of three and
     * "the rule transferred". Two of those three criteria were not measurements.
     */
    const outcome = await runTransfer("banana", true);
    expect(outcome.result.successes).toBe(0);
    expect(outcome.result.observed).toBe(false);
  });

  it("counts a recall that reproduces the authored rule", async () => {
    // The control. Without it, a criterion that failed everything would pass the test above.
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    expect(rule.action_rule.length).toBeGreaterThan(0);
    const outcome = await runTransfer(rule.action_rule, false);
    expect(outcome.result.successes).toBe(3);
    expect(outcome.result.observed).toBe(true);
  });

  it("ignores the self-report entirely, in both directions", async () => {
    /*
     * `applied_rule` is collected and stored, and it decides nothing. Reed, Ernst & Banerji (1974)
     * found self-rated use of a prior solution did not correlate with transfer performance in a
     * case where transfer demonstrably occurred; Craig et al. (2020) put self-report against
     * measured behaviour at r = 0.22 across 37 studies.
     *
     * Asserted in BOTH directions on purpose: a criterion that had merely inverted the tick would
     * pass a one-sided test while being just as wrong.
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const ticked = await runTransfer(rule.action_rule, true);
    const unticked = await runTransfer(rule.action_rule, false);
    expect(ticked.result.successes).toBe(unticked.result.successes);

    const junkTicked = await runTransfer("banana", true);
    const junkUnticked = await runTransfer("banana", false);
    expect(junkTicked.result.successes).toBe(junkUnticked.result.successes);
  });

  it("still records the self-report, because dropping it would lose data that is worth having", async () => {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const outcome = await runTransfer(rule.action_rule, true);
    expect(outcome.result.applied_rule).toEqual([true, true, true]);
    expect(outcome.result.recalled_rules.every((text) => text.length > 0)).toBe(true);
  });

  it("grades against the snapshot, which cannot drift because the rule cannot be edited", async () => {
    /*
     * TWO DEFENCES, AND THE SECOND ONE TURNED OUT TO BE THE REAL ONE.
     *
     * The grading reads `transfer.rule_snapshot`, written down before any position was returned --
     * so a rule edited after the player saw the positions could not move the target to meet the
     * answer. This test was first written to prove that by editing the rule mid-test, and the
     * edit was REFUSED: both stores hold authored rules append-only. The scenario the snapshot
     * guards against cannot occur at all.
     *
     * Both are asserted anyway. The snapshot is the correct source whether or not a lower layer
     * happens to make drift impossible today, and the append-only guard is worth pinning because
     * it is what makes the whole preregistration meaningful.
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const { transfer } = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(transfer!.rule_snapshot.action_rule).toBe(rule.action_rule);

    await expect(
      store.saveLearningRule({ ...rule, action_rule: "משהו אחר לגמרי בלי מילים משותפות" }),
      "the authored rule was editable, so the snapshot is the only thing standing between a " +
        "preregistered test and a target that moves to meet the answer",
    ).rejects.toThrow(/append-only/);
  });
});

describe("a terminal grade ends the testing, including a transfer already in flight", () => {
  /*
   * `preregisterLearningTransfer` throws on a refuted or retired rule, and that throw was
   * UNREACHABLE whenever an open transfer existed: the resume path returned before it. So a rule
   * that had just been refuted, or one the player had deliberately retired, still handed back a
   * live test. Found by an adversarial review, reproduced here in both directions.
   */
  async function openTransferThenGrade(grade: "refuted" | "retired") {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    await store.saveLearningRule({ ...rule, grade, next_due_at: null });
    return { store, rule };
  }

  it("refuses to resume a transfer on a refuted rule", async () => {
    const { store, rule } = await openTransferThenGrade("refuted");
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[4], FENS[5], FENS[6]] },
      { transfer_id: "transfer-2", started_at: "2026-01-03T00:00:00.000Z" },
    );
    expect(outcome.transfer, "a refuted rule handed back a live test").toBeNull();
    expect(outcome.reason).toContain("הופרך");
  });

  it("refuses to resume a transfer on a rule the player retired", async () => {
    // Retiring is the player saying they are done with this rule. Handing it back a test is the
    // product overruling them about their own record.
    const { store, rule } = await openTransferThenGrade("retired");
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[4], FENS[5], FENS[6]] },
      { transfer_id: "transfer-2", started_at: "2026-01-03T00:00:00.000Z" },
    );
    expect(outcome.transfer).toBeNull();
  });

  it("still resumes a transfer on a rule that is merely a hypothesis", async () => {
    // The control. A guard that refused every resume would pass both tests above while deleting
    // the feature the previous commit existed to add.
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    const resumed = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[4], FENS[5], FENS[6]] },
      { transfer_id: "transfer-2", started_at: "2026-01-02T00:05:00.000Z" },
    );
    expect(resumed.transfer?.transfer_id).toBe("transfer-1");
  });
});

describe("one sitting cannot replicate itself", () => {
  /*
   * THE WORST FINDING OF THE REVIEW, and it defeated the whole preregistration claim.
   *
   * `beginLearningTransfer` was check-then-act with no uniqueness anywhere: read the open
   * transfer, then insert a new one with a fresh id. Two concurrent starts -- a double-click is
   * enough, since the queue's `busy` flag only flips once the first mutation RESOLVES -- produced
   * two preregistrations holding the IDENTICAL three positions.
   *
   * Then: play the three positions ONCE, report those same three `decision_id`s under transfer A
   * on one day and under transfer B on the next, and the rule grades `replicated`. Three
   * decisions, two results, two calendar days, and a claim that the rule held up across sittings.
   * `gradeLearningRule` filters priors by `transfer_id`, so nothing noticed.
   */
  it("refuses a decision already spent on another transfer of the same rule", async () => {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const first = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    for (let index = 0; index < ids.length; index += 1) {
      await recordPosition(store, ids[index], first.transfer!.fens[index]);
    }
    const observations = ids.map((decision_id) => ({
      decision_id,
      recalled_rule: rule.action_rule,
      applied_rule: true,
    }));
    const reported = await sitTransfer(store, "transfer-1", observations, "2026-01-02T01:00:00.000Z");
    expect(reported.result.observed).toBe(true);

    // A second transfer, holding the same positions, sat with the SAME decisions.
    await store.saveLearningTransfer({ ...first.transfer!, transfer_id: "transfer-2" });
    await expect(
      sitTransfer(store, "transfer-2", observations, "2026-01-03T01:00:00.000Z"),
      "the same three decisions replicated the rule across two days",
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("reports a transfer once, and says so rather than throwing a database error", async () => {
    /*
     * Completing twice hit a bare primary-key violation in the Drizzle store, which `toTrpc`
     * rethrew as an unmapped 500 -- carrying the SQL, the column layout, the decision ids and the
     * PLAYER'S RECALL TEXT in the response body. The owner gate goes to some length to keep record
     * content out of a refusal; this put it in one, at 500 instead of 403.
     *
     * It is reachable by design: a failed completion returns the player to `running` so reporting
     * can be retried, so a lost response means retrying forever against a 500.
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const { transfer } = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    for (let index = 0; index < ids.length; index += 1) {
      await recordPosition(store, ids[index], transfer!.fens[index]);
    }
    const observations = ids.map((decision_id) => ({
      decision_id,
      recalled_rule: rule.action_rule,
      applied_rule: true,
    }));
    const once = await sitTransfer(store, "transfer-1", observations, "2026-01-02T01:00:00.000Z");

    // Completing again with no further observations: the second call must return the first
    // report, not raise, and not write a second verdict.
    const twice = await service.finishLearningTransfer(
      store,
      { transfer_id: "transfer-1" },
      { completed_at: "2026-01-02T02:00:00.000Z" },
    );
    // IDEMPOTENT, not an error: a retry after a lost response is the honest case, and the second
    // call must return what the first one recorded rather than a second, different verdict.
    expect(twice.result.completed_at).toBe(once.result.completed_at);
    expect(twice.result.successes).toBe(once.result.successes);
    expect(await store.listLearningTransferResults(rule.rule_id)).toHaveLength(1);
  });
});

describe("a rule the measure cannot see is never tested", () => {
  /*
   * `action_rule = "f7 f2"` is an ordinary way to write a chess rule, and `shared/recall-score.ts`
   * has no token it can see in it. A review ran it end to end: perfect verbatim recall on all
   * three positions, ZERO centipawns lost, scored 0/3, refuted, `next_due_at: null` -- and the
   * message the player got blamed the retrieval schedule.
   *
   * The unwinnable test is now never created, and the reason names the real cause.
   */
  it("refuses to preregister a transfer for a rule with nothing to match on", async () => {
    /*
     * AUTHORED that way, not edited into it: `saveLearningRule` holds rules append-only, so an
     * existing rule cannot be turned into an unscoreable one. That is the right protection and it
     * means the case has to be created from the start, which is also how a player would meet it.
     */
    const store = new MemoryRecordStore();
    await recordPosition(store, SOURCE_ID, FENS[0]);
    const rule = await service.createLearningRule(
      store,
      {
        reflection: { revised_read: "new read", would_choose_again: false },
        rule: { ...RULE, action_rule: "f7 f2" },
      },
      { rule_id: "rule-coords", created_at: "2026-01-01T00:00:00.000Z" },
    );
    expect(rule.action_rule).toBe("f7 f2");
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "unwinnable", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer, "an unwinnable test was preregistered").toBeNull();
    expect(outcome.reason).toMatch(/קצר מדי|סימונים/);
    expect(await store.getLearningTransfer("unwinnable")).toBeNull();
  });

  it("still preregisters a rule written in ordinary words", async () => {
    // The control. A guard that refused everything would pass the test above and delete the
    // feature.
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "fine", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer).not.toBeNull();
  });
});

describe("an observation is on the record the moment it is made", () => {
  /*
   * These used to live in React state for the whole run and reach the server only at completion.
   * Three defects came out of that one choice, all found by an adversarial review: a reload lost
   * them and the resume re-served positions whose engine verdict the player had already been
   * shown; a failed reveal write stranded the run with no control that could advance it; and the
   * client was their only holder, so completion had to believe whatever finally arrived.
   */
  async function startAndDecide(store: MemoryRecordStore, howMany: number) {
    const rule = await createRule(store);
    const { transfer } = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3]] },
      { transfer_id: "transfer-1", started_at: "2026-01-02T00:00:00.000Z" },
    );
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    for (let index = 0; index < howMany; index += 1) {
      await recordPosition(store, ids[index], transfer!.fens[index]);
      await service.recordLearningTransferObservation(store, {
        transfer_id: "transfer-1",
        observation: {
          decision_id: ids[index],
          recalled_rule: rule.action_rule,
          applied_rule: true,
        },
      });
    }
    return { rule, transfer: transfer!, ids };
  }

  it("survives losing everything the client was holding", async () => {
    /*
     * The reload case, stated as what it is: the store is asked what happened, and it knows,
     * because each observation was written when it was made rather than at the end.
     */
    const store = new MemoryRecordStore();
    await startAndDecide(store, 2);
    const recorded = await store.listLearningTransferObservations("transfer-1");
    expect(recorded).toHaveLength(2);
    expect(recorded[0].recalled_rule.length).toBeGreaterThan(0);
  });

  it("refuses to report a test that was not finished, and says how far it got", async () => {
    // The message names the count. "Something went wrong" on a preregistered test is the shape of
    // failure this product exists to refuse.
    const store = new MemoryRecordStore();
    await startAndDecide(store, 2);
    await expect(
      service.finishLearningTransfer(
        store,
        { transfer_id: "transfer-1" },
        { completed_at: "2026-01-02T01:00:00.000Z" },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("records each position once, refusing a second write for the same slot", async () => {
    const store = new MemoryRecordStore();
    const { ids, rule } = await startAndDecide(store, 1);
    await expect(
      service.recordLearningTransferObservation(store, {
        transfer_id: "transfer-1",
        observation: { decision_id: ids[0], recalled_rule: rule.action_rule, applied_rule: true },
      }),
      "the same position was recorded twice",
    ).rejects.toThrow();
  });

  it("refuses a fourth observation on a three-position test", async () => {
    /*
     * A BOUNDS CHECK, distinct from the append-only one. The slot is derived from how many
     * observations are already down, so once three are recorded the next would be position 3 --
     * off the end of the preregistered set, with no board to compare against.
     *
     * Its own test because the append-only guard cannot cover it: that one fires on a REPEATED
     * slot, and a positive control removing the bounds check passed every assertion here until
     * this one existed.
     */
    const store = new MemoryRecordStore();
    const { rule } = await startAndDecide(store, 3);
    const extra = "66666666-6666-4666-8666-666666666666";
    await recordPosition(store, extra, FENS[4]);
    await expect(
      service.recordLearningTransferObservation(store, {
        transfer_id: "transfer-1",
        observation: { decision_id: extra, recalled_rule: rule.action_rule, applied_rule: true },
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("holds the store itself append-only per slot, not only the service above it", async () => {
    /*
     * Asserted against the STORE, because the service never asks it twice for the same slot -- it
     * derives the position from what is already recorded. So the store's own guarantee was
     * untested by every path through the app, and a positive control removing it passed.
     *
     * It matters because the guarantee is what the database enforces with a composite primary key.
     * The in-memory store has to agree with that key, or the two disagree about what the data
     * does -- which is the whole reason `tests/server/drizzle-store.test.ts` exists.
     */
    const store = new MemoryRecordStore();
    const observation = { decision_id: "d-1", recalled_rule: "x", applied_rule: true };
    await store.saveLearningTransferObservation("t-1", 0, observation);
    await expect(
      store.saveLearningTransferObservation("t-1", 0, { ...observation, decision_id: "d-2" }),
    ).rejects.toThrow(/append-only/);
    // A different slot on the same transfer is fine, and a different transfer's slot 0 too.
    await store.saveLearningTransferObservation("t-1", 1, observation);
    await store.saveLearningTransferObservation("t-2", 0, observation);
    expect(await store.listLearningTransferObservations("t-1")).toHaveLength(2);
  });

  it("refuses an observation whose decision is for a different position", async () => {
    /*
     * The slot is decided by how many observations are already down, so an out-of-order decision
     * would otherwise be filed against the wrong preregistered board -- and the test would read
     * as complete while measuring the wrong thing.
     */
    const store = new MemoryRecordStore();
    const { rule, transfer } = await startAndDecide(store, 0);
    const wrong = "55555555-5555-4555-8555-555555555555";
    await recordPosition(store, wrong, transfer.fens[2]);
    await expect(
      service.recordLearningTransferObservation(store, {
        transfer_id: "transfer-1",
        observation: { decision_id: wrong, recalled_rule: rule.action_rule, applied_rule: true },
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("cannot be told about a test that was never sat", async () => {
    /*
     * THE PROPERTY THE REWRITE EXISTS FOR. `finishLearningTransfer` takes a transfer id and
     * nothing else: there is no argument through which a caller can supply observations, so there
     * is no request shape that reports a test nobody sat. Before this, the completion payload
     * carried them and the server had to trust it.
     *
     * Asserted as a type-level fact made runtime-visible: passing them is not a thing that
     * compiles, so the check is that the verdict ignores anything but the record.
     */
    const store = new MemoryRecordStore();
    const { rule } = await startAndDecide(store, 3);
    const outcome = await service.finishLearningTransfer(
      store,
      // @ts-expect-error -- observations are not part of the input any more; this is the point.
      { transfer_id: "transfer-1", observations: [{ decision_id: "x", recalled_rule: "x", applied_rule: true }] },
      { completed_at: "2026-01-02T01:00:00.000Z" },
    );
    const recorded = await store.listLearningTransferObservations("transfer-1");
    expect(outcome.result.decision_ids).toEqual(recorded.map((o) => o.decision_id));
    expect(outcome.result.recalled_rules.every((text) => text === rule.action_rule)).toBe(true);
  });
});

describe("the positions a transfer draws are not the opening, and not three in a row", () => {
  /*
   * THE REPRODUCTION. The candidates arrive in game order and the service took the first three
   * unseen. On a fresh game that is plies 0, 1 and 2 -- and the first of them is the STARTING
   * POSITION OF CHESS. A review ran it and got exactly that:
   *
   *   1. ply 0  opening  rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
   *   2. ply 1  opening  ...4P3...
   *   3. ply 2  opening  ...4p3/4P3...
   *
   * Two things are wrong with that. This product's own baseline puts opening accuracy at 70.3%
   * against 60.2% everywhere else, so `cp_loss <= 30` is very nearly free there and half the
   * success criterion stops discriminating. And three consecutive plies are close to the same
   * board, so a test of whether a rule TRANSFERS runs on one position three times.
   */
  const OPENING = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 3",
  ] as const;

  it("refuses a game that offers nothing but the opening, and says why", async () => {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [...OPENING] },
      { transfer_id: "all-opening", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer, "the starting position of chess was preregistered as a transfer test").toBeNull();
    expect(outcome.reason).toMatch(/פתיחה/);
    expect(await store.getLearningTransfer("all-opening")).toBeNull();
  });

  it("never draws an opening position even when the game has plenty", async () => {
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [...OPENING, FENS[1], FENS[2], FENS[3], FENS[4]] },
      { transfer_id: "mixed", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer).not.toBeNull();
    for (const fen of outcome.transfer!.fens) {
      expect(OPENING, `an opening position was drawn: ${fen}`).not.toContain(fen);
      expect(classifyPhase(fen, plyFromFen(fen))).not.toBe("opening");
    }
  });

  it("spreads across what is available rather than taking three in a row", async () => {
    /*
     * With six eligible positions the stride is two, so the draw is the 1st, 3rd and 5th. Taking
     * the first three would give adjacent boards -- and the assertion is on the SPREAD rather than
     * on exact indices, so a different but still-spread rule does not fail it.
     */
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3], FENS[4], FENS[5], FENS[6]] },
      { transfer_id: "spread", started_at: "2026-01-02T00:00:00.000Z" },
    );
    /*
     * ASSERTED AGAINST "THE FIRST THREE", not against a ply span. A span check passed a positive
     * control that set the stride back to 1: these fixtures carry jumps in their fullmove numbers,
     * so even adjacent ones span several plies. What the rule actually promises is that the draw
     * is not the head of the list.
     */
    const eligible = [FENS[1], FENS[2], FENS[3], FENS[4], FENS[5], FENS[6]];
    const firstThree = eligible.slice(0, 3);
    expect(
      outcome.transfer!.fens,
      "the draw was the first three eligible positions, which are adjacent in the game",
    ).not.toEqual(firstThree);
    // And it reaches the far end of what was available, rather than clustering anywhere.
    expect(outcome.transfer!.fens).toContain(eligible[eligible.length - 2]);
  });

  it("still draws exactly three, and three that differ", async () => {
    // The control. A selector that returned fewer, or the same board repeatedly, would satisfy
    // "not the opening" and "spread" while making the test meaningless.
    const store = new MemoryRecordStore();
    const rule = await createRule(store);
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: [FENS[1], FENS[2], FENS[3], FENS[4], FENS[5], FENS[6]] },
      { transfer_id: "three", started_at: "2026-01-02T00:00:00.000Z" },
    );
    expect(outcome.transfer!.fens).toHaveLength(3);
    expect(new Set(outcome.transfer!.fens.map(positionKey)).size).toBe(3);
  });
});

describe("an unanswered question is not a negative answer", () => {
  /*
   * `applied_rule` is half of `successes`, which is what the preregistered refutation condition
   * is tested against. The client held it as `boolean | null` and wrote `?? false` under a
   * comment saying the default could not fire -- while the callback that read it did not depend
   * on it, so a stale null would have been written down as "did not apply the rule" about a
   * player who said they did. Append-only, and every screen correct.
   */
  it("refuses to build an observation with no answer rather than defaulting it to false", () => {
    expect(() =>
      transferObservation({ decision_id: "d-1", recalled_rule: "רשימת שחים", applied_rule: null }),
    ).toThrow(/יישום הכלל/);
  });

  it("builds both real answers, including the negative one a player actually gave", () => {
    // The point is not that `false` is suspect; it is that a MEASURED false and a missing
    // measurement must not become the same record.
    for (const applied of [true, false]) {
      expect(
        transferObservation({ decision_id: "d-1", recalled_rule: "רשימת שחים", applied_rule: applied }),
      ).toEqual({ decision_id: "d-1", recalled_rule: "רשימת שחים", applied_rule: applied });
    }
  });

  it("keeps an empty recall, which is a failed retrieval and not a missing one", () => {
    expect(
      transferObservation({ decision_id: "d-1", recalled_rule: "", applied_rule: true })
        .recalled_rule,
    ).toBe("");
  });
});
