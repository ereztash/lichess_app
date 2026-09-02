# Pressure–Exposure learning-loop preregistration

Status: **FROZEN BEFORE RESULT**

## Goal

Test, on the already-preserved move-level corpus, whether the proposed player-facing loop

> reduce my exposed pieces, then increase pressure on the opponent

is supported by move-quality evidence rather than by intuition.

This study does **not** run Stockfish. It reuses the same preserved RC-07/08/09 natural positive items and move evaluations used by P3.

## Definitions

For the side to move, evaluated **after** each already-valid candidate move:

- `OwnExposure_post` = number of own non-king pieces for which `enemy_attackers > own_defenders`.
- `OpponentPressure_post` = number of opponent non-king pieces for which `our_attackers > opponent_defenders`.

Literal change variables:

- `OwnExposure_delta = OwnExposure_post - OwnExposure_pre`.
- `OpponentPressure_delta = OpponentPressure_post - OpponentPressure_pre`.

The proposed learning direction is therefore:

- lower `OwnExposure_post` / negative `OwnExposure_delta` is better;
- higher `OpponentPressure_post` / positive `OpponentPressure_delta` is better.

No weighted composite score is preregistered.

## Scope

Primary population:

- natural, trigger-positive `RC-07`, `RC-08`, `RC-09` items;
- at least two preserved, already-valid B moves in the same position;
- preserved expected-score move evaluations available;
- same move-level source and deduplication rules as P3.

This deliberately tests ranking **inside already-valid action sets**, not whether a move solves the focal threat.

## Transfer design

Use leave-one-rule-class-out (LOCO): train on two classes, test on the third. `rule_class` is never a feature.

Primary endpoint: within-position pairwise accuracy for predicting lower regret, excluding true-regret gaps < `0.01` expected score.

Uncertainty: 5,000 bootstrap replicates clustered by position; seed `20260902`.

## Frozen model family

All models are Ridge regression with the same preprocessing and `alpha=1.0` used in P3. No tuning.

`L` (local comparator) = P3 position + local move descriptors only.

### Post-state models

- `L+Epost` = `L + OwnExposure_post`
- `L+Ppost` = `L + OpponentPressure_post`
- `L+Epost+Ppost` = `L + OwnExposure_post + OpponentPressure_post`

### Delta models

- `L+Edelta` = `L + OwnExposure_delta`
- `L+Pdelta` = `L + OpponentPressure_delta`
- `L+Edelta+Pdelta` = `L + OwnExposure_delta + OpponentPressure_delta`

## Primary claims and falsifiers

### C1 — exposure direction

The concept `reduce my exposure` is supported only if the fitted standardized coefficient for `OwnExposure_post` is **positive in all 3 LOCO folds** (more exposure predicts more regret), and `L+Epost` improves pooled pairwise accuracy over `L` with a position-cluster 95% CI entirely above zero.

Otherwise C1 fails.

### C2 — pressure direction

The concept `increase pressure on the opponent` is supported only if the fitted standardized coefficient for `OpponentPressure_post` is **negative in all 3 LOCO folds** (more opponent overload predicts less regret), and `L+Ppost` improves pooled pairwise accuracy over `L` with a position-cluster 95% CI entirely above zero.

Otherwise C2 fails.

### C3 — pressure adds beyond exposure

The proposed two-stage loop receives support only if `L+Epost+Ppost` improves pooled pairwise accuracy over `L+Epost` and the 95% position-cluster CI for that gain is entirely above zero.

Breadth guard: the gain `L+Epost+Ppost - L+Epost` must be positive in all three held-out classes; at least two of three class-specific 95% CIs must be entirely above zero.

Otherwise C3 fails.

### C4 — literal change is directionally consistent

For the delta formulation, standardized coefficients must have the same intended signs in all 3 LOCO folds:

- `OwnExposure_delta`: positive;
- `OpponentPressure_delta`: negative.

`L+Edelta+Pdelta` must improve pooled pairwise accuracy over `L` with a 95% position-cluster CI entirely above zero.

C4 is a consistency guard. Failure does not erase a valid post-state result, but it forbids wording the product rule as “increase/decrease” and limits it to comparing resulting states.

## Verdict

`PE-PASS — safety then pressure supported` requires **C1 + C2 + C3 + C4**.

`PE-POST-PASS — resulting-state loop supported, change wording not licensed` if C1 + C2 + C3 pass but C4 fails.

`PE-EXPOSURE-ONLY` if C1 passes but C2 or C3 fails.

`PE-FAIL` if C1 fails.

## What a PASS would license

Only within the observed scope:

> Among already-valid candidate moves, prefer resulting positions with fewer own under-defended pieces; after controlling for that, additional pressure on under-defended opponent pieces carries incremental information about move quality.

If C4 also passes, the concise learning policy may use change language:

> First avoid increasing your own exposure; among comparably safe choices, prefer moves that increase effective pressure on the opponent.

## What this study cannot establish

- causal human learning effect;
- that counting alone is the optimal representation;
- optimal weighting between safety and pressure;
- generalization to every chess position or all legal moves;
- homeostasis, controllability, or a global system-health score;
- long-term natural-game transfer.