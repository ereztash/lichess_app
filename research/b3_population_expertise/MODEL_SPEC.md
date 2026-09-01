# B3 -- Model specification

Frozen with `PREREGISTRATION.md`. This file is binding: the code is a transcription of it, and a
disagreement between them is a defect in the code.

---

## 0. Common machinery

**Basis.** Every continuous predictor enters through a natural cubic spline basis with knots at its
DEVELOPMENT-period quantiles: 5 interior knots for `ply`, `clock_ms_self`, `rating`; 4 for
everything else; 1 (i.e. linear) for anything whose DEVELOPMENT distribution has fewer than 20
distinct values. Categorical predictors enter as indicator columns with the first level dropped.
Knot locations are computed **once on DEVELOPMENT** and stored in `results/model_manifest.json`.

**Estimator.** Ridge regression (`sklearn.linear_model.Ridge`) on the standardised design matrix.
The penalty is chosen once, on DEVELOPMENT, by 5-fold **grouped** cross-validation with players as
groups, from the frozen grid `{0.01, 0.1, 1, 10, 100}`. Grouping by player is what stops a
neighbouring move from the same game leaking into the fold that scores it.

**Fit once, apply everywhere.** Every model is fitted on DEVELOPMENT only. VALIDATION, FINAL and
the secondary time control receive the frozen coefficients. No period the result is read from is
ever a period a model was fitted on.

**Uncertainty.** Player-level block bootstrap: resample **players** with replacement to the original
player count, take all of a resampled player's decisions, recompute the statistic, 400 replicates,
report the 2.5th and 97.5th percentiles. This is the only interval type reported. Move-level
standard errors are never reported, because moves inside a game are not independent draws and with
N in the hundreds of thousands a p-value from them is meaningless.

**Partial pooling across bands.** Band estimates `theta_b` with bootstrap variances `v_b` are
pooled with a normal-normal random-effects model (method-of-moments between-band variance,
DerSimonian-Laird). Both raw and shrunk band estimates are reported; figures show shrunk with raw
overlaid, never a smooth curve without its bin-level support.

---

## 1. Expected-time models

Outcome `Y = log(1 + T)`.

**T0 -- context baseline.** `phase`, `standing`, `ply`, `move_number`, `clock_ms_self`,
`clock_ms_opp`, `clock_frac`, `clock_pressure`, `clock_diff_frac`, `non_pawn_material`, `side`,
`opponent_rating`.

**T1 -- objective position model.** T0 plus `wp1`, `edge`, `gap12`, `gap1k`, `ambiguity_entropy`,
`n_near`, `legal_moves`, `in_check`, `best_move_changes`, `eval_volatility`, `pv_instability`,
`final_depth`, `nodes_to_depth10`, `is_mate_line`.

**T2 -- resource-rational model.** T1 plus `voc_regret`, `voc_switch`, `voc_drift`, `voc_rank`,
plus exactly two preregistered interactions:

    voc_z x clock_pressure
    ambiguity_entropy x clock_pressure

**T2R** is T2 plus `rating`. **T2P** is T2 (no rating). **T1P** is T1 (no rating, no VoC).

No model contains `rating` unless its name says so, and no model contains anything tagged
`POST_MOVE`.

Reported for model comparison: grouped-CV `R^2` on DEVELOPMENT and out-of-sample `R^2` on
VALIDATION and FINAL, for T0, T1, T2, and for a gradient-boosted tree on the T2 feature set. The
tree is a **predictive comparator only**: if it predicts better, that is reported as a fact about
predictability, and it still supplies no reported scientific quantity, because a black box that
predicts better is not thereby an explanation.

## 2. The two residuals

    unexpected_time_population    = Y - Yhat(T2P)      # rating excluded
    unexpected_time_within_rating = Y - Yhat(T2R)      # rating included
    unexpected_time_novoc         = Y - Yhat(T1P)      # no rating, no VoC; used only by Metric C

Names are neutral by instruction. They are residuals of a clock difference. Nothing in this
document, the code, or the report may call them confusion, hesitation or a cognitive state.

## 3. H1 -- the primary regularity test

    Q0:  quality_loss ~ [T2 feature set] + rating
    Q1:  quality_loss ~ [T2 feature set] + rating + beta * unexpected_time_within_rating

`beta` is the primary estimand: the additional win probability given away per one unit of
`log(1 + T)` of unexpected time, after adjustment.

**How it is computed, and why that shape.** Every model is fitted on DEVELOPMENT and frozen, so by
Frisch-Waugh-Lovell the coefficient of `unexpected_time_within_rating` in the joint model Q1 equals
the simple slope of one frozen residual on another:

    q_resid  = quality_loss - Qhat0(x)                       # frozen Q0 fit
    ut_resid = unexpected_time_within_rating - UThat(x)      # frozen fit of UT on Q0's own design
    beta     = <q_resid, ut_resid> / <ut_resid, ut_resid>

The second residualisation is what makes this the joint coefficient rather than a marginal one:
without it, `beta` would still carry whatever part of unexpected time the Q0 covariates explain.
Both fits are DEVELOPMENT-only, so an evaluation period supplies **two vectors and no model fit**,
and a bootstrap replicate is a resample of players plus three dot products. Every other estimand in
this document is computed the same way, for the same reason.

Also reported, always:

* `beta` within each rating band (raw and shrunk).
* `beta` on continuous rating as an interaction `unexpected_time_within_rating x rating`.
* Q1 minus Q0 held-out `R^2`: what unexpected time adds beyond measured difficulty.
* The same with the binary outcome (C10).

## 4. H2 -- expertise metrics

All five are fitted on DEVELOPMENT where a fit is needed, frozen, and evaluated per period.

**Metric A -- matched-difficulty thinking time.** Coefficient of `rating` (per 100 Elo) in
`Y ~ [T1 feature set] + rating`, as `<y_resid_T1, rating_resid> / <rating_resid, rating_resid>`.
Expected negative. Reported alongside the matched-sample version
(§6) and a robustness run excluding book positions.

**Metric B -- Time Allocation Efficiency. PRIMARY.**

    within band b:   Y ~ gamma_b * voc_z + [T1 feature set without VoC and without rating]
    TAE_b = gamma_b

`gamma_b` is log-seconds of extra thinking per one DEVELOPMENT standard deviation of
value-of-computation, holding measured difficulty and clock fixed. In frozen-residual form,
`gamma_b = <y_resid_T1, voc_resid> / <voc_resid, voc_resid>` inside band `b`, where `voc_resid` is
`voc_z` purged of the same T1 controls. Continuous form: the coefficient of `voc_resid x rating`
in the pooled model, per 100 Elo. Expected `d TAE / d rating > 0`.

Also reported: the partial correlation form, `gamma_b * sd(voc_z) / sd(Y | controls)`, so a band
whose thinking times are simply more variable cannot be read as more efficient.

**Metric C -- Allocation Loss.**

    AllocationLoss_i = abs(U_i) * 1[ sign(U_i) != sign(voc_z_i) ]
      where U_i = unexpected_time_novoc_i

Extra time spent where computation is worth less than average, or time skimped where it is worth
more. One decision contributes to at most one of the two. Reported as the band mean, and as the
`rating` coefficient in `AllocationLoss ~ [T1 without VoC] + rating`. Expected negative.

Its two halves are also reported separately -- `overthinking` (`U > 0, voc_z < 0`) and
`premature_commitment` (`U < 0, voc_z > 0`) -- because a metric that only ever moves through one
of its halves is a different finding from one that moves through both.

**Metric D -- extreme unexpected-time exposure.**

    q = the 95th percentile of unexpected_time_population on DEVELOPMENT   # frozen number
    D_b = P(unexpected_time_population > q | band b)

and the `rating` coefficient in a **linear probability** model of the same indicator on
`[T1 feature set] + rating`, in percentage points per 100 Elo, computed in the same frozen-residual
form as everything else. Linear rather than logistic so that the freeze-then-FWL shape applies
unchanged; the raw band rates are reported beside it and carry no functional-form assumption at
all. Expected negative.

**Metric E -- friction burden.** For each band,

    E_b = E[quality_loss | UT_pop > q, b] - E[quality_loss | UT_pop <= q, b]

both adjusted through the frozen Q0 model. **Associational and descriptive. No directional
prediction, no causal reading, and it cannot contribute to the verdict.**

## 5. Decision efficiency frontier

Cells: rating band x difficulty tercile (`ambiguity_entropy`) x VoC tercile x clock-pressure
tercile, terciles cut at frozen DEVELOPMENT boundaries. Per cell: `n`, players, mean `T`, mean
`quality_loss`, with bootstrap intervals. The frontier figure plots mean `quality_loss` against
mean `T` within matched cells, one curve per rating band. It is **not** collapsed into a single
score; the shape is the object.

## 6. Matched analysis

Protection against functional form, not causal identification, and the report says so.

Coarsened exact matching on: `ambiguity_entropy` (tercile), `gap12` (tercile), `wp1` (quintile),
`voc_z` (tercile), `phase`, `standing`, `clock_pressure` (tercile), `ply` (quartile),
`legal_moves` (tercile) -- all at frozen DEVELOPMENT boundaries. Cells retained when they contain
decisions from at least 3 rating bands and at least 20 decisions per retained band. Weights are
cell size; estimates are recomputed inside the matched sample. Balance is reported as the
standardised mean difference of every matching variable between the lowest and highest retained
band, before and after.

## 7. Player-level analysis

For players with at least 20 eligible decisions, estimate per player: mean `T` adjusted for
difficulty, `TAE_p`, `sd(unexpected_time_within_rating)`, extreme-UT rate, mean `quality_loss`,
mean `AllocationLoss`. Shrink each toward the population mean by normal-normal partial pooling with
the player's own bootstrap variance, so a player with 20 decisions cannot produce an extreme
coefficient. Then regress the shrunk player estimate on player rating, weighting by the inverse of
the shrunk variance.

## 8. Statistical dependence

`move ⊂ game ⊂ player`. Every interval is a player-level block bootstrap. Every reported effect is
accompanied by: effect size, interval, number of players, number of games, number of decisions, and
a plain statement of practical magnitude. A p-value is never the headline.

## 9. Controls

Each has a **pass condition** fixed here. A control that fails is reported as failed; it is not
reinterpreted.

| # | Construction | Pass condition |
|---|---|---|
| C1 | permute `quality_loss` across all decisions in the period | `beta` interval contains 0 |
| C2 | permute `Y` across decisions before residuals are formed | `beta` interval contains 0 |
| C3 | permute `rating` **across players** (whole player, keeping their decisions together) | every H2 rating gradient interval contains 0 |
| C4 | permute `voc_z` across decisions | Metric B gradient interval contains 0 |
| C5 | add `0.02 * unexpected_time_within_rating` to `quality_loss` | `beta` recovered, interval excludes 0, point estimate within 30% of `0.02` above the unplanted estimate |
| C6 | rebuild `Y` as `Y_synth = Yhat(T1P) + (0.05 + 0.05 * (rating-800)/1800) * voc_z + N(0, sd of the real residual)` | Metric B gradient recovered with the right sign, interval excludes 0 |
| C7 | rebuild both `Y` and `quality_loss` from their T1P/Q0 fits plus independent noise, no UT term, no rating term | `beta` interval contains 0 **and** every H2 gradient interval contains 0 |
| C8 | (a) drop the 1% of players contributing the most decisions; (b) jackknife over players | (a) `beta` within +/-25% and interval still excludes 0; (b) no single player shifts `beta` by more than 20% |
| C9 | re-score a random 5,000-decision subset at `nodes 150000`, recompute `beta` and Metric B on that subset under both budgets | same sign under both budgets |
| C10 | binary `accurate` outcome, logistic | same sign |
| C11 | drop book positions | same sign, `beta` interval excludes 0 |
| C12 | by `phase` | reported, sign agreement counted |
| C13 | by `standing` | reported, sign agreement counted |
| C14 | by `clock_pressure` tercile | reported, sign agreement counted |
| C15 | DEVELOPMENT vs VALIDATION vs FINAL | reported; FINAL is what the verdict reads |
| C16 | `300+0`, frozen pipeline, no retuning | reported; may only add `CROSS_CONTEXT_REGULARITY` |
| C17 | drop `T = 0` decisions | same sign, `beta` interval excludes 0 |
| C18 | first 40 plies only | same sign |

C5, C6 and C7 are the controls that give a negative result meaning. If C5 or C6 fails, the pipeline
cannot see a signal that is there, and **no** negative verdict from it is informative; the run is
`INVALID_EXPERIMENT`.
