/**
 * `retired` is the one grade nothing can rebuild, and the cycle-31 fold could destroy it.
 *
 * The fold's own comment says why retirement is checked before it and never re-derived: it is an
 * act of the player's, not a reading of the evidence. What that did not account for is that the
 * fold's WRITE can destroy it — and cycle 31 put that write on a path (the replay branch) which
 * previously performed none.
 *
 * The interleaving is ordinary rather than exotic. `gradeFromRecord` reads the rule, awaits the
 * results, folds, and writes. The Archive button has no disabled state at all
 * (`LearningQueue.tsx`) — no `busy` guard, unlike the test button beside it — so a second tab, or
 * any completion still in flight, is enough:
 *
 *     read rule (hypothesis) → player retires → the fold's write lands → grade: hypothesis
 *
 * And it is unrecoverable by construction. Retirement is stored ONLY as the grade enum: there is
 * no `retired_at` column and no retirement row anywhere in the schema, so no fold and no retry can
 * put it back. The rule reappears in the queue with a live due date and a test button, as though
 * the player had never archived it, with no message and no trace.
 *
 * SO THE GUARD IS IN THE STORE, not in the service. A service-level check is another read-then-
 * write and loses the same race; all three stores refuse to move a rule off `retired`, which makes
 * the terminal state terminal wherever the write comes from.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import type { LearningRule } from "../../shared/learning-record";
import * as service from "../../shared/record-service";

const RULE: LearningRule = {
  rule_id: "rule-retired",
  source_decision_id: "11111111-1111-4111-8111-111111111111",
  authored_by: "player",
  trigger: "כשהיריב משנה את מבנה הרגלים ליד המלך שלי",
  mechanism_class: "threat_scan",
  missed_signal: "לא סרקתי שחים כופים לפני שבחרתי מהלך פיתוח",
  action_rule: "לרשום שחים, הכאות ואיומים ישירים לפני מועמדים שקטים",
  exception_rule: null,
  predicted_outcome: "אפסיד פחות חומר לטקטיקות של מהלך אחד",
  refutation_condition: "פחות משתי יישומים מדויקים בשלוש עמדות חדשות",
  grade: "hypothesis",
  retrieval_step: 0,
  next_due_at: "2026-01-02T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  last_evaluated_at: "2026-01-01T00:00:00.000Z",
};

describe("retirement is the player's act, and nothing derives it back", () => {
  it("refuses to move a rule off retired, whatever the write is trying to say", async () => {
    const store = new MemoryRecordStore();
    await store.saveLearningRule(RULE);
    const retired = await service.retireLearningRule(
      store,
      { rule_id: RULE.rule_id },
      { retired_at: "2026-01-03T00:00:00.000Z" },
    );
    expect(retired.grade).toBe("retired");

    // A grade write holding a snapshot read before the retirement. This is what the fold does.
    await expect(
      store.saveLearningRule({ ...RULE, grade: "replicated", retrieval_step: 1 }),
      "a stale write un-retired the rule",
    ).rejects.toThrow(/retired/);

    const stored = await store.getLearningRule(RULE.rule_id);
    expect(stored?.grade).toBe("retired");
    expect(stored?.next_due_at, "the rule came back with a due date").toBeNull();
  });

  it("still lets a retired rule be written back as retired, so grading it is a no-op not an error", async () => {
    /*
     * The fold returns a retired rule unchanged, and that write must go through: otherwise every
     * completion on a rule the player archived mid-run would fail after the result was already on
     * the record — trading a silent loss for a partial one.
     */
    const store = new MemoryRecordStore();
    await store.saveLearningRule(RULE);
    const retired = await service.retireLearningRule(
      store,
      { rule_id: RULE.rule_id },
      { retired_at: "2026-01-03T00:00:00.000Z" },
    );
    await expect(store.saveLearningRule(retired)).resolves.toBeUndefined();
    expect((await store.getLearningRule(RULE.rule_id))?.grade).toBe("retired");
  });

  it("does not rewrite a rule the fold agrees with, so the hot path adds no write", async () => {
    /*
     * `beginLearningTransfer` re-derives the grade before deciding anything, which is what stops a
     * rule the record refutes being offered another test. Doing that on every start would
     * otherwise rewrite an identical row on the path the player hits most -- a failure surface
     * that buys nothing. The write happens when the fold is actually repairing.
     */
    const store = new MemoryRecordStore();
    let writes = 0;
    const save = store.saveLearningRule.bind(store);
    store.saveLearningRule = async (rule) => {
      writes += 1;
      return save(rule);
    };
    await store.saveLearningRule(RULE);
    writes = 0;

    await service.beginLearningTransfer(
      store,
      { rule_id: RULE.rule_id, candidate_fens: [] },
      { transfer_id: "t-consistent", started_at: "2026-01-04T00:00:00.000Z" },
    );
    expect(writes, "an unchanged rule was rewritten").toBe(0);
  });

  it("keeps refusing to start a transfer on it, which is what the player asked for", async () => {
    const store = new MemoryRecordStore();
    await store.saveLearningRule(RULE);
    await service.retireLearningRule(
      store,
      { rule_id: RULE.rule_id },
      { retired_at: "2026-01-03T00:00:00.000Z" },
    );
    const outcome = await service.beginLearningTransfer(
      store,
      { rule_id: RULE.rule_id, candidate_fens: [] },
      { transfer_id: "t-1", started_at: "2026-01-04T00:00:00.000Z" },
    );
    expect(outcome.transfer).toBeNull();
    expect(outcome.reason).toContain("הוצא");
  });
});
