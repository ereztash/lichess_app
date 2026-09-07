/**
 * THE ONE LINE THAT DECIDED WHETHER A SURFACE CALLED `VERIFIED` REACHED EVERY USER.
 *
 * WHAT IT USED TO BE, AND WHY THAT WAS THE WRONG DEFAULT:
 *
 *   export const VERIFIED_LEARNING_ENABLED =
 *     import.meta.env.VITE_VERIFIED_LEARNING_ENABLED !== "false";
 *
 * `!== "false"` is on-unless-switched-off. `docs/decisions/D25-evidence-architecture.md` reads
 * `CONSTRUCT-UNDERIDENTIFIED` -- `E1` reached, `E2` attempted and not reached, **humans measured:
 * 0** -- and that verdict landed while this surface was ALREADY default-on. So leaving it was never
 * neutrality. It was the stronger claim continuing to ship while the weaker one was written down,
 * which is what #56 found and deliberately did not fix, because flipping a default is a product
 * decision rather than a documentation one.
 *
 * THE DECISION WAS THEN TAKEN, and this is it: opt-in, and the name says what the evidence says.
 * `=== "true"` is off-unless-switched-on, so a deployment that says nothing ships nothing, and a
 * misspelt flag fails closed rather than open.
 *
 * WHAT THIS IS NOT. It is not a claim that the learning loop is wrong, and it deletes nothing.
 * `shared/learning-record.ts` still starts every rule at `grade: "hypothesis"`, still requires two
 * distinct dates in either direction, and every stored rule, transfer test and observation survives
 * untouched -- a flag decides what is RENDERED, and `record-service` is not behind it. A deployment
 * that sets the flag gets the same records back, in the same state it left them.
 *
 * THE OLD NAME IS GONE RATHER THAN ALIASED, on purpose. A constant named `VERIFIED` is a claim
 * every reader of the import line makes on the product's behalf, and `D25` does not support it.
 * `EXPERIMENTAL` is what `E1 reached, E2 not reached` supports.
 */
export const EXPERIMENTAL_LEARNING_ENABLED =
  import.meta.env.VITE_EXPERIMENTAL_LEARNING_ENABLED === "true";

/**
 * THE QUIET-WINDOW ARM. Off unless a build says otherwise, and it exists to be measured.
 *
 * WHAT IT DOES. While the player is producing evidence -- `makingEvidence(stage)`, which is every
 * stage but the reveal, the counterfactual included -- the context ribbon renders nothing. Off, the
 * ribbon behaves exactly as it does today, so a deployment that says nothing ships today's product.
 *
 * WHY THIS ONE AND NOT THE REST OF THE ARCHITECTURE IT COMES FROM.
 * `research/ux-measurement/DESIGN_DECISION.md` returns `NO WINNER -- FIELD REQUIRED`: the leading
 * architecture leads the runner-up by four points out of a hundred, and the one dimension that is
 * FIELD REQUIRED in every cell carries fifteen. So the architecture is not being shipped. What IS
 * being built is the single arm that can falsify it, which is a different thing and is the cheapest
 * useful move available.
 *
 * WHAT IT IS AN ARM OF. `MEASUREMENT_REACTIVITY_EXPERIMENTS.md` X-5. Measured on the built app,
 * `.context-loop` carries the record's state during DECIDE and updates on the player's own commit:
 * `0 מתוך 0 שנרשמו נספרות בחיפוש הזה` before, `0 מתוך 1` while the counterfactual question is
 * still open. The question is whether that moves the confidence stated after it.
 *
 * THE OUTCOME THAT KILLS THE ARCHITECTURE, and it is why the flag is worth having: if abandonment
 * inside `DECIDE` RISES with the ribbon absent, the loop position is `ACTION-NECESSARY` after all,
 * the surface ledger's row is wrong, and the quiet window is wrong. An arm that can only confirm
 * would not be worth a flag.
 *
 * HOW A ROW SAYS WHICH ARM IT WAS IN, and this paragraph replaces one that was wrong. It used to
 * say that a build setting this flag must also carry a `CURRENT_PROTOCOL_VERSION` bump. That was a
 * comment where an invariant was needed, and it could not have worked anyway: a flag moves without
 * a commit, so two deployments of one source can differ in stimulus while agreeing on every version
 * they carry, and the version cannot be derived from the flag either -- the constant lives in
 * `shared/`, which may not read a `client/` build value.
 *
 * The arm carries its own lineage instead. `shared/quiet-window.ts` derives ONE exposure that both
 * decides whether the ribbon renders and is stamped on the decision, so an ON row and an OFF row
 * are distinguishable in the record itself whatever the version says. `GATE-QUIET-WINDOW-LINEAGE`
 * holds the single-source property and
 * `tests/shared/a-row-that-cannot-say-which-screen-produced-it.test.ts` holds the round trip.
 *
 * WHAT IT MAY STILL NOT BECOME. A default. Turning it on is a stimulus change, and one that should
 * be made deliberately, as an experiment with an analysis attached -- see
 * `research/ux-measurement/MEASUREMENT_REACTIVITY_EXPERIMENTS.md` X-5. What is no longer true is
 * that the record would be unable to tell afterwards.
 */
export const QUIET_EVIDENCE_WINDOW_ENABLED =
  import.meta.env.VITE_QUIET_EVIDENCE_WINDOW_ENABLED === "true";
