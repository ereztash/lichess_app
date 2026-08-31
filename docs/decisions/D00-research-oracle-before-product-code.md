# D00 — where does discovery research run?

**Mode:** `PSEUDOCODE_ORACLE`.
**Evidence level:** E3 — the harness recovers planted effects and stays silent on null worlds.
**Depends on:** nothing. This is the node every other one inherits from.

## CLAIM

A better candidate search cannot be justified by argument. It has to be measured against a truth,
and the only place a truth exists is a world somebody generated. Therefore the first thing built is
not a search but a **place to grade one**, and it lives outside the product.

## ALTERNATIVES

1. **Write it all in TypeScript now.** One language, one repository, no bridge.
2. **Put Python in production.** Use the reference implementations directly, at runtime.
3. **Build a research oracle outside the user's path**, using the original implementations, and
   port only what earns its way in.

## EXTERNAL IMPLEMENTATIONS

`pysubgroup` (explicit selectors, bounded search depth, pluggable quality function), `statsmodels`
(cluster-robust covariance), `scikit-mine` (MDL-based pattern mining), `onlineFDR` (streaming error
control), Spotify's `confidence` (group-sequential boundaries and alpha spending). Every one of
them already exists, is maintained, and is better than a first attempt here would be.

This repository is TypeScript / Vitest / Vite, GPL-3-or-later, with a bundle budget in CI.

## WHAT WAS COPIED

Nothing.

## WHAT WAS WRAPPED

Nothing.

## WHAT WAS ONLY USED AS REFERENCE

`statsmodels`, in `research/discovery-oracle/oracle/inference.py`. `numpy` for generation.
`pysubgroup` is installed and pinned in `environment.lock` and **nothing imports it** — M0 gates
Phase B, and M0 has not passed.

## LOCAL EVIDENCE

- The oracle exists, runs, and answers two of M0's four questions with rates rather than opinions:
  `results/q1_units.json` (6,000 records) and `results/q4_end_to_end.json` (11,600 records).
- **No rule the audit judges has a second definition.** `scripts/run_discovery_oracle.ts` runs the
  *shipped* `detect`, `splitByBucket`, `summarise`, `readVariables` and both threshold sets;
  Python generates and measures. The confidence **level** crosses the pipe, never a probability, so
  `normaliseConfidence` stays the only authority on what a level asserts.
- **The oracle caught its own defect before it caught the product's.** `selftest.py` found that the
  first generator leaked up to 1.1 points of calibration gap into every phase bucket of the world
  with no correlation of any kind, because `p` was clipped and confidence depends on phase. Had the
  design been "write the search first", that leak would have been discovered as a spurious finding
  about a player.

## COUNTEREVIDENCE

- A bridge is a second process and a serialisation format, and both can drift. What limits the cost
  is that the bridge carries *data*, never rules: there is no behaviour to keep in step.
- The oracle's worlds are the oracle's opinion about what a player looks like. A wrong generative
  model produces confidently wrong rates. `selftest.py` bounds this for the property that matters
  (nullity) and cannot bound it for realism.

## UNCERTAINTY

Whether any of the external implementations will earn a port at all. On the M0 evidence,
`statsmodels`' clustered estimator has **not** — see D02. That is the mechanism working: the oracle
existed in order to be able to say no.

## DECISION

**Alternative 3.** `research/discovery-oracle/` is Python and runs nothing a user touches;
`shared/discovery/` is TypeScript and contains only contracts that were needed to *state* M0's
findings — a point-in-time read, a predicate, a manifest, a classification, an ICC estimator. No
search algorithm was written in either language.

Alternative 2 is refused on a separate ground: this product's user path is a static browser bundle
with a bundle budget in CI, and a Python service in it would be a deployment target that exists to
serve a component nothing has yet justified.

## REVERSAL CONDITION

- **If the oracle stops being able to reproduce a shipped result**, the bridge has drifted and the
  split has failed. `parity_check` (worst disagreement 9.7 × 10⁻¹⁷) is the standing check.
- **If a component reaches E4** — ported and equivalent to its reference — its research half stops
  being the authority and the oracle keeps only the worlds.
- **If maintaining the bridge ever costs more than the duplication it prevents**, invert: put the
  worlds in TypeScript and keep Python for nothing but statistics that have no TypeScript
  equivalent.
