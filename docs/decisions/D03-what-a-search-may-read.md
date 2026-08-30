# D03 — which features may a search read?

**Mode:** `PORT_AFTER_EQUIVALENCE`.
**Evidence level:** E2 — the registry shape exists with tests; no search reads it yet, because
Phase B is gated on M0.
**Depends on:** `shared/discovery/feature-contract.ts`, `shared/evidence-policy.ts`,
`docs/blitz/ADR-002-discovery-strata.md`.

## CLAIM

Not every measured feature should be searchable. A feature can be recorded, correct, and
point-in-time clean, and still be one that a candidate search must never read.

## ALTERNATIVES

1. **Everything measured is searchable.** Simple, and it is what the six fixed buckets imply.
2. **A single boolean per feature.**
3. **Three layers** — measured, discovery-eligible, validation-eligible — with the eligibility
   flags required rather than defaulted.

## EXTERNAL IMPLEMENTATIONS

Feature-store registries (Feast and its peers) carry per-feature metadata of exactly this kind:
entity, source, owner, tags. None of them carries *this* distinction, because the distinction is
about what a search is allowed to describe a population by, which is a study-design question rather
than a serving question.

## WHAT WAS COPIED / WRAPPED

Nothing, and nothing.

## WHAT WAS ONLY USED AS REFERENCE

The registry pattern.

## LOCAL EVIDENCE

Three arguments, all of them already in this repository:

**A target may never describe a subgroup.** `cp_loss`, and the accuracy derived from it, arrive
after the engine has spoken. A subgroup described by them is a subgroup described by its own
outcome, and the effect it finds is arithmetic. There is no threshold at which that becomes a
finding, so `searchableFeatures` refuses a `TARGET` **even when the registry declares it
discovery-eligible** — the flag is a judgement somebody made, the role is what the feature is.

**Some features decide eligibility and never membership.** `measurement_protocol` and the time
control are read by `shared/validation-protocol.ts` to decide whether a decision counts toward a
holdout. A subgroup described *by* the protocol it was collected under is a subgroup of one regime,
which `shared/evidence-policy.ts` already refuses to pool. `VALIDATION_ONLY` is that third thing,
not a weaker predictor.

**Adding a column must not widen the search space by doing nothing.**
`docs/blitz/ADR-002-discovery-strata.md` records the same failure on a different axis:
`reveal_timing` was on the atom, in the database, mapped by the service and set by the UI, and
*"the recording happened; the enforcement did not."* `discovery_eligible` is required rather than
optional so a new feature has to **answer** the question instead of arriving at a default.

`shared/game-features.ts` is what makes this concrete rather than theoretical: `DeepGameFeatures`
holds twenty-odd whole-game measurements, has no consumers, and is one import away from the
discovery path.

## COUNTEREVIDENCE

- **A registry nothing reads is a registry.** The six shipped buckets are closures over the atom;
  they do not consult a `FeatureSpec` and are not affected by any of this. Until a search reads the
  registry, this is a shape with tests.
- **Three layers is a guess.** It may turn out that `validation_eligible` needs splitting further
  (a feature that may set a holdout's *time control* is not obviously one that may set its
  *protocol*), or that `semantic_confidence` never gets read by anything and should go.
- **The refusal list is a bottleneck by design**, and bottlenecks get routed around. If declaring a
  feature is tedious, someone will declare it eligible without thinking, and the flag will mean
  nothing while looking like it means something.

## UNCERTAINTY

`semantic_confidence` — `definitional | documented-heuristic | construct` — is carried and read by
nothing. It is there because `phase` is a documented heuristic over material and ply while
"aggression index" is a construct, and a claim built on the second deserves a different sentence
from a claim built on the first. Whether anything will ever act on it is unknown.

## DECISION

**Alternative 3.** `FeatureSpec` carries `role`, `source_class`, `missingness_policy`,
`discovery_eligible`, `validation_eligible`, `semantic_confidence`, `license_origin` and
`condition_kind` — all required, `condition_kind` nullable so that a feature nobody has classified
makes its claims `UNKNOWN` and therefore ungradeable (D20).

`searchableFeatures` returns the searchable set **and the refusals with their reasons**, because a
search space that shrinks without explaining itself is one whose study cannot be reproduced.

`missingness_policy` is never "treat as zero". `shared/detector.ts` records what that costs.

## REVERSAL CONDITION

- **If a feature is ever declared `discovery_eligible` without an argument written down**, the flag
  has become a formality and needs to become a review step with a named owner instead.
- **If `semantic_confidence` is still read by nothing** when the first study runs, delete it.
- **If the three layers stop being enough** — the first time a feature is legitimately eligible for
  one protocol and not another — the boolean becomes a set of protocol kinds, and this node reopens.
