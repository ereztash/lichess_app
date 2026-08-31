/**
 * The reflection lands first, and editing one word after a failed save locks the decision forever.
 *
 * `createLearningRule` writes the player's reflection, then the rule. Two writes, no transaction,
 * and the validation that can reject the rule (`formLearningRule`'s schema parse) runs BETWEEN
 * them — reachable on the browser path, where the service is called directly with nothing
 * validating ahead of it.
 *
 * Lose the second write and the record holds a reflection on that decision and no rule. The retry
 * then meets the append-only gate: it succeeds only if the reflection is BYTE-IDENTICAL. And the
 * composer keeps every field on screen after a failure and says "הכלל לא נשמר" — so editing one
 * word of the revised-read box, which is the natural response to a failed save, makes every future
 * attempt throw CONFLICT. That decision can never carry a learning rule again, and the composer is
 * the only path that authors one.
 *
 * WHAT IS BEING PROTECTED IS THE REFLECTION, AND IT STILL IS. A reflection already on the record
 * cannot be rewritten — that is the append-only rule and it does not move. What changes is that the
 * rule can still be authored: a second attempt that revises the reflection keeps the FIRST
 * reflection, says so, and writes the rule. Refusing the whole operation protected a value nobody
 * was trying to overwrite by discarding the one thing the player was actually trying to record.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import type { LearningRuleDraft } from "../../shared/learning-record";
import * as service from "../../shared/record-service";

const SOURCE = "11111111-1111-4111-8111-111111111111";
const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 13";

const RULE: LearningRuleDraft = {
  source_decision_id: SOURCE,
  trigger: "כשהיריב משנה את מבנה הרגלים ליד המלך שלי",
  mechanism_class: "threat_scan",
  missed_signal: "לא סרקתי שחים כופים לפני שבחרתי מהלך פיתוח",
  action_rule: "לרשום שחים, הכאות ואיומים ישירים לפני מועמדים שקטים",
  exception_rule: null,
  predicted_outcome: "אפסיד פחות חומר לטקטיקות של מהלך אחד",
  refutation_condition: "פחות משתי יישומים מדויקים בשלוש עמדות חדשות",
};

const FIRST = { revised_read: "הייתי צריך לסרוק מהלכים כופים", would_choose_again: false };
const EDITED = { revised_read: "הייתי צריך לסרוק מהלכים כופים קודם", would_choose_again: false };

/** A store whose rule write can be made to fail once, after the reflection has landed. */
class LosesTheRuleWrite extends MemoryRecordStore {
  crashNextRuleWrite = false;
  override async saveLearningRule(rule: Parameters<MemoryRecordStore["saveLearningRule"]>[0]) {
    if (this.crashNextRuleWrite) {
      this.crashNextRuleWrite = false;
      throw new Error("connection reset by peer");
    }
    return super.saveLearningRule(rule);
  }
}

async function revealedDecision(store: MemoryRecordStore) {
  await store.commitDecision({
    decisionId: SOURCE,
    gameId: "g",
    fen: FEN,
    ply: 24,
    phase: "middlegame",
    clockMsRemaining: 120_000,
    purpose: "play",
    drillId: null,
    secondsTaken: 30,
    chosenMove: "e2e4",
    candidateMovesConsidered: ["e2e4"],
    statedRead: "המרכז פתוח",
    statedUnknown: "לא ברור מה השחור מאיים",
    confidence: 5,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 30,
    revealTiming: "per-decision",
    measurementProtocol: null,
    protocolVersion: null,
    analysisTiming: null,
  });
  await store.recordReveal(SOURCE, {
    engine_eval_cp: 20,
    engine_best_move: "g1f3",
    engine_depth: 18,
    engine_source: "local_sf18",
    engine_build: "sf18-test-build",
    cp_loss: 220,
  });
}

async function halfWritten() {
  const store = new LosesTheRuleWrite();
  await revealedDecision(store);
  store.crashNextRuleWrite = true;
  const crash = await service
    .createLearningRule(store, { reflection: FIRST, rule: RULE }, {
      rule_id: "rule-1",
      created_at: "2026-01-01T00:00:00.000Z",
    })
    .catch((error: unknown) => error as Error);
  return { store, crash };
}

describe("a reflection that used to lock the decision", () => {
  it("writes the reflection and loses the rule when the second write fails", async () => {
    const { store, crash } = await halfWritten();
    expect((crash as Error).message).toBe("connection reset by peer");
    const atom = await store.getAtom(SOURCE);
    expect(atom?.feedback?.revised_read).toBe(FIRST.revised_read);
    expect(await store.listLearningRules()).toHaveLength(0);
  });

  it("still authors the rule when the retry revises the reflection, which is what a player does", async () => {
    const { store } = await halfWritten();

    const outcome = await service.createLearningRule(
      store,
      { reflection: EDITED, rule: RULE },
      { rule_id: "rule-2", created_at: "2026-01-01T01:00:00.000Z" },
    );

    expect(outcome.rule.rule_id).toBe("rule-2");
    expect(await store.listLearningRules()).toHaveLength(1);
    // And it SAYS the earlier reflection stands, rather than letting the caller assume its text
    // was stored. The composer shows that line; silence here would be the defect moved.
    expect(outcome.reflection).toBe("kept-earlier");
    expect(outcome.storedReflection?.revised_read).toBe(FIRST.revised_read);
  });

  it("keeps the reflection that was written, because that part IS append-only", async () => {
    const { store } = await halfWritten();
    await service.createLearningRule(
      store,
      { reflection: EDITED, rule: RULE },
      { rule_id: "rule-2", created_at: "2026-01-01T01:00:00.000Z" },
    );
    const atom = await store.getAtom(SOURCE);
    expect(atom?.feedback?.revised_read, "the stored reflection was rewritten").toBe(
      FIRST.revised_read,
    );
  });

  it("still refuses to rewrite a reflection when there is nothing else at stake", async () => {
    /*
     * The guard that must survive: a player who has already authored a rule cannot come back and
     * revise what they said they had understood. That is the append-only claim, and it is about
     * the value rather than about the call.
     */
    const store = new MemoryRecordStore();
    await revealedDecision(store);
    await service.createLearningRule(store, { reflection: FIRST, rule: RULE }, {
      rule_id: "rule-1",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    await service.createLearningRule(store, { reflection: EDITED, rule: RULE }, {
      rule_id: "rule-2",
      created_at: "2026-01-01T02:00:00.000Z",
    });
    expect((await store.getAtom(SOURCE))?.feedback?.revised_read).toBe(FIRST.revised_read);
  });

  it("says the reflection was recorded when it is the first one, so the two cases are told apart", () => {
    // The half that makes "kept-earlier" mean something. A flag that is always the same value is
    // not a flag.
    return (async () => {
      const store = new MemoryRecordStore();
      await revealedDecision(store);
      const outcome = await service.createLearningRule(store, { reflection: FIRST, rule: RULE }, {
        rule_id: "rule-1",
        created_at: "2026-01-01T00:00:00.000Z",
      });
      expect(outcome.reflection).toBe("recorded");
      expect(outcome.storedReflection).toBeNull();
    })();
  });
});
