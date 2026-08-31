/**
 * A drill that actually exists, for the tests that commit a decision claiming to be one.
 *
 * WHY THESE FIXTURES SUDDENLY NEED IT. `purpose` was the one atom field the boundary took on
 * trust, so a test could write `purpose: "drill"` on any position and the record would keep it.
 * `commitDecision` now resolves `drill_id` against a stored drill and requires that drill to
 * contain the position -- see R-07 in `docs/MASTER_PRODUCT_DEBT.md` -- so a drill decision has to
 * come from a drill, in a test as much as in the product.
 *
 * THAT IS THE FIXTURES GETTING MORE HONEST RATHER THAN MORE AWKWARD. A decision labelled `drill`
 * is refused by discovery, and the label was previously free: every one of these tests was
 * asserting something about a population boundary while quietly asserting a drill that was never
 * registered. Registering one is two lines and makes the fixture describe a run that could happen.
 */
import type { RecordStore } from "../../shared/record-store";

/**
 * Store a drill over `fens` and return its id.
 *
 * `predicts_overconfidence` and the condition are the terms R5 requires to be written down BEFORE
 * a drill runs. They are real values rather than placeholders because `finishDrill` grades against
 * them, and a fixture that stored a condition no drill could fail would quietly disable the grading
 * in any test that later called it.
 */
export async function registerDrill(
  store: RecordStore,
  fens: string[],
  drillId = "drill-fixture",
  claimId = "claim-fixture",
): Promise<string> {
  /*
   * IDEMPOTENT, because `saveDrill` is not. The record is append-only and refuses a drill that has
   * already started, while a fixture that records twenty drill decisions calls this twenty times.
   * Returning the existing one is what a real run does too: one drill, many decisions inside it.
   */
  if (await store.getDrill(drillId)) return drillId;
  await store.saveDrill({
    spec: {
      drill_id: drillId,
      claim_id: claimId,
      fens,
      refutation_condition: "אם הפער בתרגול לא יעלה על הבסיס — ההשערה הופרכה.",
      predicts_overconfidence: true,
    },
    predicted: true,
    started_at: "2026-01-01T00:00:00.000Z",
  });
  return drillId;
}
