# D02 — is a decision an observation?

**Mode:** `REJECT` — the clustered judge was measured and refused.
**Evidence level:** E3 for the question; the repair it was meant to justify never reached E1 on our data.
**Depends on:** `shared/detector.ts`, `research/discovery-oracle/q1_units.py`, `docs/discovery-v2/M0_AUDIT.md` §Q1.

## CLAIM

`shared/detector.ts` computes the standard error of a bucket contrast as

```
sqrt( var_inside / n_inside + var_outside / n_outside )
```

where `n` counts **decisions**. That is the correct formula if decisions are independent draws.
`DecisionAtom` carries `game_id`, and moves from one game share an opponent, an opening, a clock, a
time control and a player who was in one state of mind for all of them. The claim under
examination was: *the shipped uncertainty is too small, and the judge must become game-cluster
aware.*

## ALTERNATIVES

1. **Leave it.** Decisions are the unit; the multiplier absorbs whatever correlation exists.
2. **Cluster-robust standard errors** at the game level. The textbook answer.
3. **Cluster bootstrap** — resample whole games. Already used elsewhere in this repository.
4. **Aggregate to the game** — one observation per game, losing most of the sample.
5. **Mixed model** with a game-level random intercept.

## EXTERNAL IMPLEMENTATIONS

- **statsmodels** `OLS.fit(cov_type="cluster", cov_kwds={"groups": ...})`, with `cluster-jk` and
  `cluster-crv3` variants alongside it. A mature reference for alternative 2.
- **This repository already holds alternative 3**: `research/blitz/bootstrap.py`
  `cluster_bootstrap`, written for the blitz study, whose docstring states the argument in full —
  *"a bootstrap that resamples MOVES treats sixty correlated observations as sixty independent ones
  and returns an interval that is too narrow, in the direction that makes every finding look
  established."*

The research arm of this repository has therefore believed alternative 2/3 since the blitz study,
while the shipped detector uses alternative 1. That contradiction is what D02 exists to resolve.

## WHAT WAS COPIED

Nothing.

## WHAT WAS WRAPPED

Nothing.

## WHAT WAS ONLY USED AS REFERENCE

`statsmodels`, as the clustered estimator in `research/discovery-oracle/oracle/inference.py`. It
runs outside the product, on simulated worlds, and no line of it was reimplemented.

The shipped formula **is** reproduced in Python — but only so that the difference between the two
errors can be attributed, since OLS's default error is pooled and the product's is not.
`parity_check` differences the reproduction against the real thing on every bucket of every record;
worst disagreement **9.7 × 10⁻¹⁷**.

## LOCAL EVIDENCE

`q1_units.py`, 14 worlds × 400 independent records. Because the records are independent
replications, the spread of the bucket contrast across them **is** the sampling error — measured,
not estimated. Both candidate errors are judged against it, via `sd(z)`, which is 1 when an error
is right.

| game-level gap component (ICC) | worst `sd(z)` shipped | worst `sd(z)` clustered |
| --- | --- | --- |
| ~0 | 1.02 | 1.34 |
| 0.007 | 1.07 | 1.41 |
| 0.027 | 1.14 | 1.27 |
| 0.058 | **1.38** | **1.57** |

- The shipped error is understated by **0–38%** across that range.
- The cells that suffer are exactly the clock and think-time buckets, whose membership is nearly a
  property of the game. The phase buckets sit at 0.92–1.05 throughout, because all three phases
  occur in every game.
- **The clustered error is worse calibrated in 82 of 84 cells**, and its false-positive rate under
  the null is higher in nearly every one — up to 3.9% for one bucket against the shipped 1.5%.
- End to end (`q4_end_to_end.py`), the two-stage freeze absorbs the whole of the understatement:
  **0 validated false claims in 8,000 null records**, upper 95% CI 0.00048 against a 0.02 ceiling.

## COUNTEREVIDENCE

- **The clustered estimator is not wrong; it is under-powered at this scale.** Twenty games is far
  below the forty-to-fifty clusters at which a sandwich estimator is usually considered reliable.
  A player with two hundred games might get a different answer, and this decision does not cover
  them.
- **The cluster bootstrap was not measured.** It is the alternative most likely to beat both at
  twenty clusters, and it is already implemented in this repository for a different study. Not
  testing it is a gap, not a finding.
- **The ICC range was chosen, not observed.** The sweep brackets what seems plausible. It is not a
  measurement of a real player, because no real record can currently produce one.
- The upper end of the sweep is bounded by the instrument, not by belief: the seven-level
  confidence grid cannot carry a game-level gap component above about 0.12 without the generator
  needing a clip, and a clip would put a feature-dependent bias into a world that must have none.

## UNCERTAINTY

The one number that would settle this is **the intraclass correlation of a real player's
calibration gap**, and it has never been measured — because `scoreDecisions` drops `game_id` before
the detector sees it, so game identity is lost at exactly the boundary where the question arises.

## DECISION

**The detector does not change.** The plan's assumption that clustering is the correction does not
survive contact with the number of games a real record has.

What is added is the measurement, not the repair: `shared/discovery/clustering.ts` estimates the
gap's intraclass correlation from the atoms (which carry `game_id`), with the unbalanced-design
correction that variable game lengths make mandatory, and reports Moulton's inflation as an upper
bound rather than a prediction. It is read by no product path and changes no threshold.

`ScoredDecision` deliberately does **not** gain a `game_id` field. Adding one would be building for
an estimator this decision has just refused.

## REVERSAL CONDITION

Any one of these re-opens D02:

1. **A real record measures an ICC above 0.05.** At that point the shipped error is understated by
   more than a third on the clock buckets, and `MAX_SHUFFLED_FALSE_POSITIVE_RATE` needs re-deriving
   under clustering rather than assuming the freeze absorbs it.
2. **Records reach roughly 50 games.** The measured failure of the clustered estimator is a
   small-cluster failure. At fifty clusters the sandwich is usually usable, and the whole
   comparison must be re-run before that is assumed either way.
3. **The chain loses its second stage.** The 0/8,000 result is a property of *search then freeze
   then test*. If a claim is ever shown to a player without the prospective step, the standard
   error stops being absorbed and carries the false-claim rate on its own.
4. **The cluster bootstrap is measured and beats both.** Then the refusal was of the wrong
   alternative.
