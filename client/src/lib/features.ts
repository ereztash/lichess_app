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
