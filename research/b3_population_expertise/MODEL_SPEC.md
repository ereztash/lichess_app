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
`rating_diff`.

> **`rating_diff`, not `opponent_rating` (Gate 1, R5).** Lichess pairs by rating, so across
> 800-2600 `opponent_rating` is very nearly `rating`. Carrying it in T0 -- and therefore in T1P and
> T2P, the models this study calls *rating-free* -- put the exposure inside every one of them.
> Metric A's rating coefficient would then have been identified from rating-difference variation
> alone (a matchup quantity, not an expertise-level one), and
> `unexpected_time_population` would have had most of its between-band signal already removed
> before Metric D compared bands on it. `rating_diff` adjusts for the matchup without proxying the
> level; models named "with rating" carry `{rating, rating_diff}`, which spans the same columns as
> `{rating, opponent_rating}` but makes the `rating` coefficient the level effect along the pairing
> diagonal.

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
    beta     = cov(q_resid, ut_resid) / var(ut_resid)        # CENTRED on the evaluation set

**Centred, i.e. with an intercept, on whatever set it is estimated on** -- the whole period, a band,
a player, a stratum, or a bootstrap replicate. The same holds for every one-parameter re-estimate in
§4. Frozen ridge residuals have mean zero on DEVELOPMENT *as a whole* and nowhere else, so a slope
through the origin carries `n * mean(q_resid|set) * mean(ut_resid|set) / <ut_resid, ut_resid>`: a
product of two frozen-model misfits with no allocation content and no determined sign. In the matched
sample the centring is weighted, by the matching weights, and the intercept is weighted with it.

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

**One construction for all of them (Gate 1, R1b).** "Evaluated per period" is meaningless for a
fitted coefficient: freeze it on DEVELOPMENT and FINAL contributes nothing; refit it on FINAL and a
model has been fitted on the period the result is read from. Every H2 metric therefore uses the
same shape H1 uses -- **frozen nuisance, few-parameter re-estimate**:

1. Fit the nuisance models on DEVELOPMENT and freeze them (`Y ~ T1P`, `voc_z ~ T1P`,
   `rating ~ T1P`, `allocation_loss ~ T1P`, `extreme_ut ~ T1P`; same basis, same penalty rule).
2. In any period P, form the residuals `eY`, `eV`, `eR`, and estimate the metric as a slope or a
   three-parameter regression on those residuals.

No nuisance choice is ever made on the period being read.

**Metric A -- matched-difficulty thinking time.** Coefficient of `rating` (per 100 Elo) in
`Y ~ [T1 feature set] + rating`, as the centred slope `cov(y_resid_T1, rating_resid) /
var(rating_resid)`. Expected negative.

**Metric A is a pooled slope and is judged DIRECTIONALLY ONLY** (re-review, N4iv). It has no
band-level definition -- inside a 200-point band there is little rating variation left to identify it
from -- so requiring a `monotone enough` band shape of it would be requiring a shape of a quantity
that has none. A per-band table is computed and reported for the figures; the verdict reads the
pooled slope. Metrics B and D, which do have band-level definitions, keep their shape requirement. Reported alongside the matched-sample version
(§6) and a robustness run excluding book positions.

**Metric B -- Time Allocation Efficiency. PRIMARY.**

    within band b:   Y ~ gamma_b * voc_z + [T1 feature set without VoC and without rating]
    TAE_b = gamma_b

    gamma_b(P) = cov(eY, eV | band b) / var(eV | band b)

`eV` is `voc_z` purged of the **same** frozen T1P controls. That residualisation is not cosmetic:
`voc_switch` is built from the same iteration history as `best_move_changes`, `voc_drift` from the
same as `eval_volatility`, and a censored `voc_regret` *equals* `gap1k` -- so a slope of `eY` on raw
`voc_z` would not be the partial slope at all (Gate 1, R1c).

`gamma_b` is log-seconds of extra thinking per one DEVELOPMENT standard deviation of
value-of-computation, holding measured difficulty and clock fixed.

**Continuous form, with the main effect it needs (Gate 1, R1a).**

    eY  ~  s(rating) + eV + eV x rating_c

`s(rating)` is a natural-cubic spline with DEVELOPMENT knots and `rating_c` is rating in hundreds of
Elo, centred. The main effect is **required**, not decoration: an interaction without it absorbs
`(rating main effect on time) x E[eV | rating]`, and neither factor is zero -- Metric A predicts the
first, and the second is non-zero whenever position distributions differ by band. Without
`s(rating)`, a population in which every player allocated time identically would still have produced
a rating gradient here.

Also reported: the partial-correlation form `corr(eY, eV | band b)` -- the correlation of the two
residuals inside the band, **not** `gamma_b * sd(voc_z) / sd(Y)`, because `sd(voc_z)` is 1 by
construction on pooled DEVELOPMENT and would correct nothing (Gate 1, R1d). It exists so a band
whose thinking times are merely more variable cannot read as more efficient.

**Three mechanical routes to a gradient, and where each is closed (Gate 1, R2).** Each of these can
produce `d TAE / d rating > 0` with the allocation policy held *identical* across bands:

| Route | Mechanism | Where it is closed |
|---|---|---|
| clock ceiling | a player with 5 seconds left cannot spend 15 on a high-VoC position, and time trouble is commoner in low bands, so the within-band slope is compressed from above | verdict condition 5 must also hold **within the lowest `clock_pressure` tercile** |
| `T = 0` floor | `log(1 + T)` on whole seconds has a point mass at 0 and steps at 0.69 and 1.10, so a band whose median `T` is 1 second is compressed from below | verdict condition 5 must also hold **with `T = 0` removed** (C17) |
| regressor scale | `voc_regret` is in win-probability units through a logistic that compresses everything in decided positions, and low bands live in decided positions more often, so `var(eV \| band)` and the reliability of `eV` differ by band | verdict condition 5 must also hold **on the matched sample** of §6, with an interval, not merely in sign |

All three are conditions of the verdict, with a bootstrap interval excluding zero in each case --
not observations to be discussed afterwards.

**Metric C -- Allocation Loss.**

    AllocationLoss_i = abs(U_i) * 1[ sign(U_i) != sign(voc_z_i) ]
      where U_i = unexpected_time_novoc_i

Extra time spent where computation is worth less than average, or time skimped where it is worth
more. One decision contributes to at most one of the two. Reported as the band mean, and as the
`rating` coefficient in `AllocationLoss ~ [T1 without VoC] + rating`. Expected negative.

**DESCRIPTIVE ONLY; it cannot count toward a verdict (Gate 1, R4e).** `AllocationLoss` is
`|U| * 1[sign(U) != sign(voc_z)]` where `U` is the T1P residual of `Y`. A larger within-band
covariance of `U` with `voc_z` -- which is exactly what Metric B measures -- mechanically lowers the
disagreement rate that Metric C counts. It is a transform of Metric B, not independent evidence, and
counting the two together would have let "two of four metrics" be satisfied by one metric and its
own shadow.

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

**Metric E -- friction burden.** Descriptive. For each band,

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
difficulty, `TAE_p` (centred within the player), `sd(unexpected_time_within_rating)`, extreme-UT
rate, mean `quality_loss`, mean `AllocationLoss`.

**The verdict reads the RAW per-player estimates, regressed on rating with inverse-variance
weights.** Shrunk estimates are computed and are what the figure plots; they do not enter the
verdict.

This is not the obvious choice and it is the right one. Shrinking every player toward a **common**
mean and then regressing rescales the slope by `tau2 / (tau2 + v_p)`, and the DerSimonian-Laird
estimate of `tau2` is clipped to zero whenever between-player variance is small against per-player
sampling variance. At ~32 decisions a player, `v_p` is of order 0.012 while a rating-driven
between-player variance is of order 2e-4 -- so `tau2 = 0`, **every shrunk value equals the pooled
mean, and the slope is zero to machine precision with a degenerate interval**. Simulated with the
gradient control C6 itself plants (TAE 0.05 to 0.10 across the range, true slope 0.00278 per 100
Elo, 2,600 players, 32 decisions each): players differing only through rating gave `tau2 = 0` in six
runs of six and the condition failed in all six; with idiosyncratic variation it survived, attenuated
seven- to hundred-fold. The inverse-variance-weighted regression of the same raw estimates recovered
0.0022-0.0033 in every run.

So the shrunk-then-regressed version could fail on a true effect for a reason that has nothing to do
with the hypothesis, and its magnitude would mean nothing. Shrinkage is the right tool for **drawing**
per-player estimates, where the job is to stop a noisy player looking extreme; it is the wrong tool
between an estimate and a regression coefficient computed from it. Control **C6 exercises this
estimator**, not only the pooled gradient -- a planted gradient must survive the statistic the
verdict actually reads.

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
| C5 | add `0.02 * unexpected_time_within_rating` to `quality_loss` | `beta` recovered, interval excludes 0, point estimate within 30% of `0.02` above the unplanted estimate. **An implementation check** (Gate 1, R11): the planted term is linear in the estimator's own regressor, so recovery follows from linear algebra and this can only fail on a code bug. |
| C5b | add `0.02 * (Y - Yhat_GBT)` to `quality_loss` -- the residual of the pinned gradient-boosted comparator (`FEATURE_SCHEMA.md` §1), a quantity the linear pipeline never produced | sign recovered **and** `recovered_fraction = (beta_planted - beta) / 0.02 >= 0.5`. The shortfall below 1.0 is the attenuation of a signal **of that shape** -- algebraically it is the regression slope of the tree residual on the linear residual, i.e. one minus the share of the linear residual's variance the tree additionally explains. It is **not** "the attenuation factor for every real signal", and the report may not call it that (re-review, N9iv). A shortfall is **not** an `INVALID_EXPERIMENT` trigger; failing the 0.5 bar is. |
| C6 | rebuild `Y` as `Y_synth = Yhat(T1P) + (0.05 + 0.05 * (rating-800)/1800) * voc_z + N(0, sd of the real residual)` | Metric B gradient recovered with the right sign, interval excludes 0 |
| C7 | rebuild both `Y` and `quality_loss` from their T1P/Q0 fits plus independent noise, no UT term, no rating term | `beta` interval contains 0 **and** every H2 gradient interval contains 0 |
| C8 | (a) drop the 1% of players contributing the most decisions; (b) jackknife over players | (a) `beta` within +/-25% and interval still excludes 0; (b) no single player shifts `beta` by more than 20% |
| C9 | re-score a **VALIDATION** subset of 5,000 decisions -- never the fitting period, never FINAL -- drawn by `unit_hash(SEED, "c9", game_id, ply)`, at `nodes 150000`. Every nuisance model is **refitted on the subset at each budget** with the frozen recipe (knot rule, penalty grid, grouped CV), because the feature scales move with the budget (`final_depth`, `eval_volatility`, `nodes_to_depth10`, and the shallow-to-deep gap `voc_regret` is built from). Report `r_beta = beta(150k)/beta(60k)` and `r_TAE = gradient(150k)/gradient(60k)` with player-bootstrap intervals. | **Not "same sign"** (Gate 1, R12). Under A2, `beta` is positive at every budget and shrinks toward zero as difficulty is measured better, so a sign test passes while the study's central limitation goes unfalsified. The preregistered reading: **if the upper interval bound of `r_beta` is below 0.5**, the report must state that the evidence favours the difficulty-proxy explanation over H1, and level 3 and higher language is withheld. |
| C10 | binary `accurate` outcome, logistic | same sign |
| C11 | drop book positions | same sign, `beta` interval excludes 0 |
| C12 | by `phase` | reported, sign agreement counted |
| C13 | by `standing` | reported, sign agreement counted |
| C14 | by `clock_pressure` tercile | reported, sign agreement counted. **The Metric B gradient in the LOWEST tercile is a verdict condition** (`VERDICT_RULES.md` §2.5.5): it must have the preregistered sign with an interval excluding 0. |
| C15 | DEVELOPMENT vs VALIDATION vs FINAL | reported; FINAL is what the verdict reads |
| C16 | `300+0`, frozen pipeline, no retuning | reported; may only add `CROSS_CONTEXT_REGULARITY` |
| C17 | drop `T = 0` decisions | same sign, `beta` interval excludes 0. **The Metric B gradient here is also a verdict condition** (`VERDICT_RULES.md` §2.5.5). |
| C18 | first 40 plies only | same sign |
| C19 | add `own_prev_think_s` (and its missing indicator) to the T2R context block and re-estimate `beta` | reported; `beta` same sign. Kept out of the primary spec because own pace is partly the allocation policy Metric B measures. |

**C6, C5b and C7 are the controls that give a negative result meaning.** C6 plants an expertise
gradient the pipeline must recover; C5b plants a signal defined *outside* the pipeline's own
residual and measures what fraction survives; C7 plants nothing and the pipeline must report
nothing. If C6 fails, or C5b recovers under half of a foreign signal, the pipeline cannot see what
is there and no negative verdict from it is informative.

C5 is an implementation check and is listed with them only for continuity with the mission plan's
numbering. Its recovery is a fact about linear algebra, not about the study, and the earlier claim
that it made a negative verdict meaningful is withdrawn (Gate 1, R11).
