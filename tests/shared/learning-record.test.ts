import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import type { DecisionResult } from "../../shared/decision-atom";
import {
  gradeLearningRule,
  type LearningRuleDraft,
  type LearningTransferResult,
} from "../../shared/learning-record";
import * as service from "../../shared/record-service";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 3",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
  "r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 6",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 7",
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
    expect(early.reason).toContain("delayed retrieval");

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
    const outcome = await service.finishLearningTransfer(
      store,
      {
        transfer_id: transfer!.transfer_id,
        observations: ids.map((decision_id, index) => ({
          decision_id,
          recalled_rule: index === 0 ? rule.action_rule : "",
          applied_rule: index === 0,
        })),
      },
      { completed_at: "2026-01-02T01:00:00.000Z" },
    );
    expect(outcome.result).toMatchObject({ successes: 1, observed: false });
    expect(outcome.rule).toMatchObject({ grade: "refuted", next_due_at: null });
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
