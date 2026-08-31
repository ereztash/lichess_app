/**
 * A transfer check that actually exists, for the tests that commit a decision claiming to be one.
 *
 * THE SAME REASON `registered-drill.ts` EXISTS, one wave later. `purpose: "transfer"` was free:
 * a test could write it on any position and the record would keep it, while `EVIDENCE_POLICY` reads
 * that label to decide whether the decision may enter discovery at all. `commitDecision` now
 * resolves `transfer_id` against a stored transfer and requires that transfer to have named the
 * position in advance -- see R-07 in `docs/MASTER_PRODUCT_DEBT.md` -- so a transfer decision has to
 * come from a transfer, in a test as much as in the product.
 *
 * BUILT DIRECTLY RATHER THAN THROUGH `beginLearningTransfer`, and that is a deliberate narrowing.
 * The real path needs a reflection, an authored rule and a due date, all of which are about the
 * learning layer and none of which is what these tests are checking. `preregisterLearningTransfer`
 * is the function under test in `learning-record.test.ts`; here the transfer is a stored object
 * that existed before the decision, which is the only property the binding depends on.
 */
import type { RecordStore } from "../../shared/record-store";

/**
 * Store a transfer over `fens` and return its id.
 *
 * The snapshot and the refutation condition are real values rather than placeholders, for
 * `registerDrill`'s reason: `finishLearningTransfer` grades against them, and a fixture that stored
 * a condition nothing could fail would quietly disable the grading in any test that reached it.
 */
export async function registerTransfer(
  store: RecordStore,
  fens: string[],
  transferId = "transfer-fixture",
  ruleId = "rule-fixture",
): Promise<string> {
  /* Idempotent, because `saveLearningTransfer` is not, and one transfer holds several decisions. */
  if (await store.getLearningTransfer(transferId)) return transferId;
  await store.saveLearningTransfer({
    transfer_id: transferId,
    rule_id: ruleId,
    fens: [...fens],
    rule_snapshot: {
      trigger: "כשנשאר לי פחות מדקה והעמדה סגורה",
      mechanism_class: "time_allocation",
      action_rule: "לספור מהלכים כופים לפני שאני זז",
      predicted_outcome: "פחות מהלכים שמאבדים חומר",
    },
    refutation_condition: "אם הדיוק בעמדות האלה לא יעלה על הבסיס — הכלל הופרך.",
    minimum_successes: 2,
    retrieval_step: 0,
    scheduled_for: "2026-01-02T00:00:00.000Z",
    started_at: "2026-01-02T00:00:00.000Z",
  });
  return transferId;
}
