REPAIRABLE IMPLEMENTATION ERROR -- the C3 nulls for Metrics A, C and D subtract a DEVELOPMENT-frozen prediction from a *permuted* rating, which leaves a deterministic term that is zero only on the fitting period; the repair is one line, pinned below; the repaired run is reportable as **B3**, labelled, with the mechanical `INVALID_EXPERIMENT` printed beside the repaired `GENERAL_REGULARITY_ONLY` (level 3).

# FABLE GATE 3 -- result adversary (independent scientific adversary, fresh context)

**Read in full:** `GATE_3_PACKET.md`; the five frozen documents; `POST_FREEZE_AMENDMENTS.md`,
`PREREGISTRATION_FREEZE.json`, `FINAL_HOLDOUT_SEALED.json`; both earlier reviews; every file in
`src/`; `analysis_secondary.json`, `verdict.json`, `c9.json`, `model_manifest.json`, every
`data/*/manifest.json`, the result tables, the ledgers. **Run, read-only, in the scratchpad:** a
reconstruction of every frozen fit and of the residualised DEVELOPMENT, VALIDATION, FINAL and
secondary frames (reproduces the shipped `beta`, Metric A, Metric B gradient and every C3 null to the
digit, from the deterministic seeds); an analytic derivation of the C3 null's expectation, verified
on all three periods; `evaluate()` re-run on the analysis with the repaired C3 substituted;
destroyed-outcome and destroyed-time nulls on the secondary control; drift-free (three-parameter and
nuisance-refit) re-estimates of `beta`, Metric A and the Metric B gradient on FINAL and the secondary;
a decomposition of Metric B by the zero-regret point mass; matched-sample diagnostics; the move-type,
best-move, tail and within-player decompositions of `beta` quoted below. **Not touched:** no research
code, document or result was edited; this file is the only write.

## Summary

The mechanical verdict is not scientifically justified, in either direction. The `INVALID_EXPERIMENT`
it printed rests on a control whose null carries a deterministic term I can derive, predict to
Monte-Carlo precision on all three periods, and remove with a one-line change that touches no
estimate: the failure is the freeze's fingerprint in the *control*, of exactly the class the Gate 2
review characterised for C1 and then -- my miss -- endorsed in C3. Metric A itself is unaffected by
the drift the null detects (three estimators within 2%). With the repair, `evaluate.py` unchanged
returns `GENERAL_REGULARITY_ONLY`, level 3, with the same seven failed H2 conditions.

`beta` is real. It is drift-free to four decimals, within-player and within-game, indifferent to
move type and to every `T` threshold, and its destroyed-outcome nulls sit at 2% of it. What the
report may say about it is narrower than the packet implies: three quarters of it is carried by
blunders (cap the outcome at 0.05 and `beta` is 0.0034), two thirds of its numerator comes from the
two extreme deciles of unexpected time, a seventh of it is present even when the player played the
engine's own move, and its variation across standings is the outcome's scale, not behaviour.

The Metric B null is a real null of the preregistered instrument and it is **not** evidence that the
time/VoC relation is invariant to rating. The instrument has a 59.4% point mass at zero regret; on
those rows the preregistered regressor is identically minus the *predicted* VoC, so the largest
rating-dependent structure in the data -- the response of residual time to predicted VoC, which rises
with rating at +0.007 to +0.010 per 100 Elo in every period with intervals far from zero -- enters
Metric B with its sign flipped, and the pooled gradient is a cancellation (-0.008 on the zero rows,
+0.0006 on the rest). The floor (`TAE_FLOOR = 0.02`) is twice the instrument's whole signal (pooled
TAE 0.0106), the 80%-power spread is 0.024, the matched clause is structurally negative because
matching on VoC terciles selects the point mass, and C6 plants at five to ten times the real scale in
the instrument's own units. The verdict label stands; the sentences "not there", "negative result on
the headline claim", "a null the instrument could have broken" do not.

The secondary time control is a fatal defect as shipped. Every one of its numbers, `beta` included, is
an extrapolation artefact: the frozen models predict log-time down to -7.35 there, the residual
standard deviation is five times FINAL's, and the destroyed-outcome null on the secondary is
+0.01143 against the reported `beta` of +0.01137. The packet's sentence that `beta` survives because
it is a slope of one residual on another is the opposite of what happened.

---

## 1. The C3 ruling in full

### 1.1 What the shipped null computes

`controls.py` C3 permutes each player's rating across players, then forms
`perm_resid = perm_rating - ratinghat`, where `ratinghat` is the DEVELOPMENT-frozen ridge prediction
of rating from the T1P features, and reads `100 * slope(y_resid, perm_resid)` with `y_resid` the
frozen T1P residual of log-time. The TAE gradient's null does not subtract anything and is not at
issue.

### 1.2 Derivation

Write `cov` and `var` over rows. `slope(y, perm - h) = [cov(y, perm) - cov(y, h)] / var(perm - h)`.
Under a uniform permutation of player ratings `E[perm_i] = R_bar` for every row, so
`E[cov(y, perm)] = 0` exactly and `E[cov(perm, h)] = 0` exactly. The numerator's expectation is the
deterministic `-cov(y_resid, ratinghat)`; the denominator's is `var(perm) + var(ratinghat)`. Hence

    E[C3 -> A]  ~=  -100 * cov(y_resid, ratinghat) / [ var(rating) + var(ratinghat) ]

`cov(y_resid, ratinghat)` is zero only where the T1P residual is orthogonal to the T1P column space,
i.e. on the period the ridge was fitted; on any other period the frozen fit's misfit has a component
along `ratinghat`. The identical algebra gives the Metric D and Metric C nulls with `extreme_resid`
and `allocation_resid` in place of `y_resid`.

Two corrections to the packet's diagnosis. First, its quantity `-100 x slope(y_resid, ratinghat)`
divides by `var(ratinghat)` instead of `var(rating) + var(ratinghat)`; the ratio is
`61,676 / 298,552 = 0.207` on FINAL, which is the "factor of four". The permutation being over players
rather than rows has nothing to do with it. Second, the same dilution explains the raw-column C4 null:
the deterministic gradient of `eY` on `-vochat x rating` is -0.0098 / -0.0081 / -0.0068 on the three
periods, and dividing by `var(voc_z) + var(vochat)` (about 1.13) gives the shipped -0.00115 /
-0.00089 / -0.00081. One mechanism, two controls.

### 1.3 Verification (deterministic seeds; 200 permutations; my reconstruction)

| period | shipped null, reproduced | predicted by 1.2 | MC SE | `R2(rating \| T1P)` frozen | `cov(ratinghat, rating_resid)` |
|---|---|---|---|---|---|
| DEVELOPMENT | +0.000025 (sd 0.000439) | -0.000001 | 0.000031 | 0.269 | +130 |
| VALIDATION | -0.000157 (sd 0.000491) | -0.000138 | 0.000035 | 0.247 | -1,403 |
| **FINAL** | **-0.001145** (sd 0.000457, z 2.51) | **-0.001094** | 0.000032 | 0.216 | **-5,311** |

The prediction lands within 1.6 Monte-Carlo standard errors on FINAL and within one on the others;
the mean permuted numerator on FINAL is -3.35 against the deterministic -3.27, the mean denominator
292,669 against 298,552. The Metric D and C nulls obey the same formula: predicted -0.000114 and
-0.000350 on FINAL against the shipped -0.000123 and -0.000356. The last column is the freeze: on
DEVELOPMENT the frozen partial of rating is orthogonal to its residual; four months later it is not.

### 1.4 The estimator does not share the null's defect

The obvious worry is that the same deterministic term sits inside Metric A itself. It does, and it
cancels: in the estimator the regressor is `rating - ratinghat` with the two correlated, and the
misfit along `ratinghat` enters both `cov(y, rating)` and `cov(y, ratinghat)`. Metric A on FINAL is
-0.01069 frozen, **-0.01056** as the three-parameter regression `y_resid ~ rating_resid + ratinghat`
(equivalently `log_time ~ rating + Yhat_T1P + ratinghat`), and **-0.01046** with T1P and
`rating ~ T1P` refitted on FINAL. The null overstates the drift's effect on the estimate by an order
of magnitude because `perm_rating` is uncorrelated with `ratinghat` and nothing cancels. The failure
is in the control's construction, not in the quantity it guards.

### 1.5 Ruling

**Repairable implementation error.** Not fatal: the term is analytic, predicted from quantities that
contain no hypothesis, reproduced to the digit, and the estimate it guards moves 2% under every
drift-free re-estimate. Not a real failure the verdict should stand on: §2.1.5 exists for "a destroyed
signal survives its destruction"; here no signal survived -- the control failed to destroy a
deterministic term, and the term is not in the reported number. The class was characterised before
the holdout was opened: the Gate 2 review derived C1's null as `-slope(Qhat0, ut_resid)`, called it
"the fingerprint of the freeze", and stated that the amended rule "can only fail when the estimator's
bias under the null exceeds about two null SDs". C3's Metric A null on FINAL is that prediction
realised at 2.5. That the same reviewer -- me -- endorsed the C3 construction in the same document
without applying the derivation to it is a miss the report must record, not a reason to fail the
study for it.

### 1.6 The permitted repair, exactly

One construction, no variants, applied to all three slope-based C3 fields whether or not they failed:

    # controls.py, C3 block
    perm_resid = perm_rating          # was: perm_rating - ratinghat

`slope()` centres, so this regresses each frozen residual on the permuted rating minus its mean --
the partial of `perm_rating` under the null, where `E[perm_rating | x]` is a constant and the frozen
`ratinghat(x)` is the partial of the *real* rating, not the permuted one. It is the same principle as
the pre-holdout C4 repair ("permute the regressor the estimator uses"), and it is the only change.
The TAE-gradient null is untouched. Results, my reconstruction: FINAL Metric A null -0.000036
[-0.00107, +0.00093], sd 0.000576; D -0.000011; C -0.000008; DEVELOPMENT +0.000034, VALIDATION
-0.000019. C1 and C2 may be brought under the same rule (`perm_q` centred; `perm_Y` centred) for
uniformity, with both forms printed; their pass status on FINAL is unchanged either way.

Procedure: re-run `controls.run(..., which={"C3"})` (and C1/C2 if taken) on the three periods only;
every other block of `analysis_final.json` must be byte-identical and the diff shown; the shipped C3
block is retained beside the repaired one; `evaluate.py` is run unmodified. I did this: **as shipped
`INVALID_EXPERIMENT`; repaired `GENERAL_REGULARITY_ONLY`, level 3**, failed conditions
`h2_includes_tae, h2_tae_matched, h2_tae_no_zero_time, h2_tae_low_clock_pressure, h2_tae_spread,
h2_player_level, player_disjoint_holds` -- identical to the shipped list.

**Not permitted:** replacing Metric A's verdict estimator with the drift-free one (that is a
scientific choice and would be B3.1); changing any threshold; dropping the Metric A check from C3;
choosing among repair variants after seeing which passes; touching FINAL's data, features, fits or
estimates. The drift-free Metric A (1.4) is *reported beside* the frozen one, and does not enter the
verdict.

### 1.7 B3, not B3.1

`VERDICT_RULES.md` §4 permits "repair a genuine implementation defect, with the defect documented and
the repaired run labelled" and forbids re-running FINAL after seeing FINAL. The two clauses are
consistent only if a repair may re-evaluate the defective computation on FINAL while everything
scientific stays fixed, which is what 1.6 does: no feature, outcome, exclusion, band, hyperparameter,
model family, threshold or estimate changes, and no byte of 2026-06 is re-read, re-scored or
re-sampled. The label: *B3, C3 null construction repaired after the holdout (amendment A7); mechanical
verdict as emitted INVALID_EXPERIMENT; repaired verdict GENERAL_REGULARITY_ONLY, level 3.*

### 1.8 Disclosure the repaired run must carry

1. Both verdicts, the derivation in 1.2, the table in 1.3, and the repair diff.
2. The corrected explanation (denominator, not player-versus-row) replacing the packet's.
3. That after the repair every destructive null is a code check that can fail only on a defect
   (Gate 2 already required this sentence for C1, C2, C4, C7; C3 joins them).
4. **The class, in a table:** every FINAL null's offset in null SDs -- C1 +0.00031 (0.64), C2 -0.00026
   (0.88), C3 -> D -0.00012 (0.84), C3 -> C -0.00036 (1.52), C4 raw column -0.00081 (2.10), C3 -> A
   -0.00115 (2.51) -- with the statement that these are the frozen models' misfit on a June population,
   larger than on the April one, tolerated by the "contains zero" rule up to about two SDs, and that
   the passes are passes of offset nulls.
5. Metric A frozen / three-parameter / refit on FINAL (-0.01069 / -0.01056 / -0.01046), and `beta`
   frozen / three-parameter / refit (0.01342 / 0.01346 / 0.01344), so the reader can see the drift's
   size on the quantities that matter.
6. The Gate 2 miss, in the reviewer's words.

### 1.9 Rescue risk, answered directly

The repair does not serve H2, which fails identically before and after. It does serve H1: a run that
was `INVALID` becomes a level-3 positive result the researchers want ("cross-rating law-like
regularity"). So the risk is lower than "fixing the control that broke the headline" but it is not
zero, and I did not rely on the direction of the outcome to rule. What makes this a repair rather
than a rescue is: the offset is predicted analytically from `cov(y_resid, ratinghat)`, a quantity
that does not involve `beta`, rating's effect, or any hypothesis; C3 never touches `beta`, and
`beta`'s own destroyed-outcome nulls sit at 2% of it; the class was written down by the adversary
before the holdout was opened; the repair is pinned by the adversary, not chosen by the researchers;
and the expectation recorded in `FINAL_HOLDOUT_SEALED.json` before opening was exactly the repaired
outcome. I would have ruled the other way if the repair had flipped any verdict-bearing condition (it
flips none), if the offset had not reproduced from first principles, or if `beta`'s nulls had shown
offsets of comparable size.

---

## 2. Attack on `beta`

All numbers on FINAL from the reconstructed frozen residuals; `beta` = +0.013419.

### 2.1 What survives

* **The freeze.** Three-parameter `quality ~ ut + Qhat0 + UThat`: +0.013457. Every nuisance model
  (T2R, Q0, `partial_ut`) refitted on FINAL: +0.013440. The C1-type deterministic term
  `-slope(qhat, ut_resid)` is +0.000275 (2%); the C1 and C2 nulls I re-drew sit at +0.00030 and
  -0.00022. Nothing of `beta` is the fingerprint of the freeze.
* **Between-player confounding.** Centring both residuals within player: +0.01363; within game:
  +0.01359; the between-player slope of player means is +0.00979. The regularity lives inside a
  player's own decisions, so "slow players are weak players" is not it.
* **Committal moves and the horizon effect.** I hypothesised that captures and checks take longer and
  score worse by engine artefact. `beta` within captures +0.01104 [+0.00910, +0.01311], within quiet
  moves +0.01118 [+0.01006, +0.01241], within checking moves +0.01060; holding capture and check
  fixed +0.01108. Rejected.
* **Clock discreteness.** `beta` on `T > 0, 1, 2, 3, 5, 10` seconds: 0.0149, 0.0150, 0.0134, 0.0125,
  0.0113, 0.0135. Not a `T = 0` artefact and not a premove artefact.
* **The opponent's clock.** By the opponent's previous think: 0.0086 (< 1 s), 0.0116, 0.0163,
  0.0152 (>= 8 s). Positive in every stratum; larger after long opponent thinks, which is not the
  sign a thinking-on-their-clock artefact would produce.
* **Shape.** Deciles of `ut_resid` give a monotone profile of `q_resid` from -0.0109 to +0.0171 (raw
  quality loss 0.044 to 0.071; mean `T` 0.5 s to 12.3 s); piecewise slopes +0.0102 on the fast side
  and +0.0161 on the slow side. Both halves carry it.

### 2.2 What does not survive unchanged

* **F-B1. It is a blunder regularity.** With `quality_loss` capped at 0.05 (about twice the accuracy
  threshold) `beta` is +0.0034; capped at 0.1, +0.0063; at 0.2, +0.0097; at 0.5, +0.0130. Losses above
  0.05 carry three quarters of `beta` and losses above 0.1 (13.5% of decisions) carry half of it;
  the top and bottom deciles of unexpected time carry 67% of its numerator. The report's "27% of a typical error per e-fold of
  time" is a mean over a tail phenomenon. **INTERPRETATION DOWNGRADE**: the licensed sentence is that
  unusually long thinks predict *blunders*; the capped values must be printed beside `beta`.
* **F-B2. A seventh of it is there when the player found the engine's move.** On the 35.6% of
  decisions where `move_uci` equals the pre-move search's first line, `beta` is +0.00193
  [+0.00119, +0.00272]; on the rest +0.01330 [+0.01204, +0.01453]. When the played move *is* the
  engine's best, `quality_loss` is depth asymmetry between two searches and nothing about the human's
  choice, so a positive slope there is engine noise that grows with residual position sharpness --
  A2 measured directly, in the one place it can be. The probability of finding the engine's move
  falls from 0.43 in the fastest decile to 0.28 in the slowest; holding that indicator fixed, `beta`
  is +0.0094. **LEGITIMATE CAVEAT** (a diagnostic on a `POST_MOVE` variable; it cannot enter the
  primary spec), and a number the A2 paragraph should quote.
* **F-B3. The stratum pattern is the outcome's scale.** `beta` is 0.0193 winning, 0.0116 level,
  0.0091 losing; the standard deviation of the Q0 residual is 0.106, 0.062, 0.043 in the same strata;
  the ratio is 0.18, 0.19, 0.21. `quality_loss` is bounded by `wp1_before`, so the win-probability
  unit is not one unit across standings and "the effect is strongest when winning" is not a
  behavioural finding. **LEGITIMATE CAVEAT** for the invariance language.
* **F-B4. Measured difficulty is nearly irrelevant to it, and that cuts both ways.** The ladder moves
  `beta` from 0.01393 (context) to 0.01361 (plus fourteen engine features) to 0.01342 (plus VoC):
  3.7% in all. Level 2 ("survives measured difficulty", R2 gain 0.0093) is met mechanically, but the
  measured block explains 3% of residual time variance, C9's two budgets share 99.8% of `ut_resid` and
  96% of `q_resid`, so `r_beta = 1.015` is close to an identity. The human-perceived form of A2 is
  untouched by every measurement here, as the preregistration says. **LEGITIMATE CAVEAT**, already
  covered by obligations (a)-(c); the report should add the two correlations.

### 2.3 Verdict on `beta`

Real, as an adjusted within-player association in these data, replicated in three periods and every
stratum, robust to every construction test I could devise, and correctly labelled level 3 provided
obligation (d) is honoured (FINAL interaction -0.00022 [-0.00043, -0.00002] per 100 Elo; band values
0.0105-0.0162). Its interpretation is narrower than "unusually long deliberation predicts a worse
move": it predicts blunders, a seventh of it is engine noise in sharp positions, and A2 is not
constrained in the form that matters.

---

## 3. Attack on the null

### 3.1 The instrument, measured

* `voc_regret == 0` on 59.4% of FINAL decisions (59.5%, 59.7% on the others); `voc_z` there is
  -0.427; the frozen residual `voc_resid` has sd 0.363 on those rows against 1.213 on the rest, and
  those rows supply 17.9% of the regressor's sum of squares.
* The pooled TAE -- the whole relation Metric B is a gradient of -- is +0.0106 [+0.0052, +0.0159]
  log-seconds per DEVELOPMENT sd of VoC, a partial correlation of **0.0165**. The slope of `eY` on the
  indicator `1[regret > 0]` is +0.0090 and on `voc_switch` +0.0075: the signal is, to within noise, a
  binary "the engine changed its mind between depth 8 and 12, so the human spent 1% more time".
* A natural positive control fails. An allocation instrument must respond to the resource: TAE in the
  fullest, middle and emptiest clock terciles is +0.0105 [+0.0013, +0.0205], +0.0109, +0.0105. Flat.
  By phase: 0.0093, 0.0110, 0.0096. Flat.
* Reliability: on the C9 subset `voc_resid` correlates 0.617 between engine budgets (`voc_regret`
  0.643); the pooled TAE on the same 5,000 decisions is +0.0027 at 60k nodes and +0.0141 at 150k,
  each with a standard error near 0.009. Its validity against anything a human perceives is
  unmeasured.

**F-N1. LEGITIMATE CAVEAT:** the instrument's signal is a 1.7% partial correlation, it does not
respond to the clock, and its human validity is unknown. This alone makes "not there" unlicensed.

### 3.2 The cancellation -- the null is partly induced by the construction

On a zero-regret row `voc_z` is the constant -0.427, so `voc_resid = -0.427 - vochat(x)`: the
preregistered regressor is, on 59% of rows, *minus the position-predicted VoC*, exactly. The rating
gradient of the response of `eY` to predicted VoC is the largest rating-dependent structure in these
data, and it is positive in every period:

| gradient per 100 Elo (with `s(rating)`) | DEVELOPMENT | VALIDATION | FINAL |
|---|---|---|---|
| `eY` on `vochat x rating`, all rows | +0.00982 [+0.00743, +0.01218] | +0.00806 [+0.00564, +0.01070] | +0.00677 [+0.00390, +0.00931] |
| Metric B gradient, zero-regret rows | -0.00924 [-0.01242, -0.00620] | -0.00978 [-0.01294, -0.00666] | -0.00817 [-0.01122, -0.00489] |
| Metric B gradient, `regret > 0` rows | +0.00007 [-0.00104, +0.00123] | +0.00154 [+0.00026, +0.00291] | +0.00063 [-0.00046, +0.00178] |
| Metric B gradient, all rows (shipped) | +0.00056 [-0.00040, +0.00149] | +0.00075 [-0.00025, +0.00192] | +0.00053 [-0.00034, +0.00151] |
| `eY` on raw `voc_z x rating` | +0.00181 [+0.00086, +0.00268] | +0.00177 [+0.00083, +0.00289] | +0.00136 [+0.00059, +0.00228] |

On the zero-regret rows the Metric B gradient equals the gradient of `eY` on `-vochat x rating`
exactly (-0.00924 = -0.00924 on DEVELOPMENT, and likewise on the others), as the algebra requires;
the first row is the same channel measured over all rows. The preregistered pooled
gradient is a mixture of a large, replicated negative component that has nothing to do with how a
player responds to residual VoC (there is no residual VoC on those rows) and a small positive
component on the rows where the regressor varies. Whatever the rows-with-variation gradient is, the
composite could not have shown it. The residualisation (Gate 1, R1c -- my requirement, and right in
intent, since the raw slope is not a partial slope) combined with a point mass nobody checked before
the freeze produced an estimand that is a difference of two things with opposite signs.

What the positive component is, is not settled either. The response of residual time to *predicted*
VoC rising with rating is consistent with the recognition channel R13 named, and equally with
rating-heterogeneous responses to any of the context and engine features `vochat` loads on (clock
handling, phase pacing). It is not a preregistered estimand, it is confounded by construction, and it
**may not be reported as support for H2**. It is the lead for the next experiment (§NEXT_EXPERIMENT).

**F-N2. INTERPRETATION DOWNGRADE:** the Metric B null does not license "no rating gradient in the
time/VoC relation"; it licenses "the preregistered composite returned zero, and its construction makes
zero its expected reading under a live positive gradient".

### 3.3 The floor and the power

`TAE_FLOOR = 0.02` was fixed at Gate 1 (my R3) as 40% of the gradient C6 plants (0.05 to 0.10), before
any data existed; the real pooled TAE is 0.0106 and no band exceeds 0.018. The spread condition asks
the top band to exceed the bottom by twice the instrument's entire signal. The FINAL gradient
interval is [-0.00034, +0.00151] per 100 Elo, i.e. [-0.006, +0.027] across 1,800 Elo: it contains
zero, the floor (0.020), and a tripling of TAE across the range. The gradient's SE is 0.00047 per 100
Elo, so the smallest spread detectable at 80% power is 0.024 -- above the floor and 2.2 times the
level. The spread interval [-0.0126, +0.0233] has half-width 0.018. **F-N3. INTERPRETATION
DOWNGRADE:** condition 5's spread clause was unreachable by any plausible real gradient, and the study
was powered to detect a 220% change in a quantity whose plausible changes are tens of percent. The
report must state the detectable spread beside the floor, and may not describe the spread failure as
a finding about players.

### 3.4 The matched reading is degenerate, and the other "readings" are not independent

The CEM cells include the `voc_regret` tercile, and the zero tercile is the largest, so the retained
32% of decisions is 70.2% zero-regret (59.4% overall), 39% opening (28%), 12% book (5.5%). Balance
between the extreme bands is *worse* after matching than before on the variables that matter
(`voc_z` SMD +0.158 vs +0.065; `gap12` +0.160 vs +0.041; `eval_volatility` +0.284 vs +0.174;
`ambiguity_entropy` -0.141 vs -0.071). Per-band matched TAEs run from +0.036 to -0.046 against a
full-sample level of 0.006-0.018. The matched gradient is negative in all three periods (-0.0029,
-0.0043, -0.0032; pooled z = -3.25) because it is the zero-row component of 3.2 with a larger share:
inside the matched sample the zero rows give -0.0059 [-0.0106, -0.0008] and the rows with variation
+0.0031 [-0.0038, +0.0105]. Weights are not the cause (max 2.55; unweighted -0.0026). So the matched
clause of condition 5 was structurally negative and could not have been met by any allocation
behaviour. Of the "five readings", the matched one is degenerate, and the pooled, `T = 0`-removed,
low-clock-pressure and player-level ones are the same residual pair on overlapping rows. **F-N4.
INTERPRETATION DOWNGRADE** ("five independent readings" -> "one instrument, read four ways, plus a
degenerate matched form) and **LEGITIMATE CAVEAT** for `beta`'s matched value (+0.0168): "survives
matching on position difficulty" is not licensed when matching worsened balance on difficulty; say
"recomputed inside coarsened cells".

### 3.5 C6 does not do what the report writer says it does

C6 rebuilds time as `Yhat_T1P + (0.05 + 0.05 x rating) x voc_z + noise`: a gradient five to ten times
the real level, planted *in the instrument's own units*, so measurement error between `voc_z` and
anything a human perceives is irrelevant to its recovery. It shows the estimator's algebra works at
that scale, and its recovery has an sd (0.0005) equal to the real gradient's SE. It does not show
that a realistic gradient would be seen, and it cannot address validity. The drafted sentence "the
null on Metric B is a null the instrument could have broken and did not -- not an instrument that
cannot see" is unjustified. **F-N5. INTERPRETATION DOWNGRADE.**

### 3.6 What the null does and does not license

Licensed: *the preregistered Time Allocation Efficiency gradient is not detectably different from zero
on FINAL, in any reading; H2's strongest verdict was not reached; the instrument's construction,
floor and power are such that a rating gradient of the size a real allocation difference would
produce would also have returned this result.* Not licensed: "not there", "negative result on the
headline claim", "stronger players do not concentrate their seconds more selectively", "the null the
instrument could have broken", or any reading of the un-preregistered positive gradients in 3.2 as
support. The verdict label `GENERAL_REGULARITY_ONLY` is correct because it asserts only that §2.5 was
not met.

---

## 4. The secondary time control

**F-S1. FATAL DEFECT for the secondary block as shipped.** On `300+0`, 65.5% of decisions have
`clock_ms_self > 180,000` and only 29.2% have both clocks inside the frozen knot range. The frozen
T2R prediction of log-time ranges from **-7.35** to +2.56 (log-time is non-negative by construction);
the mean frozen residuals are +3.43 log-seconds (`y_resid_T1`), +3.45 (`ut_resid`), +3.50
(`UT_pop`), and 68.4% of decisions exceed the frozen `ut_q95`; `sd(ut_resid)` is 3.03 against 0.60 on
FINAL; `corr(Qhat0, ut_resid)` is -0.658 against -0.005. Consequences, each reproduced:

* `beta` frozen +0.01137 [+0.01113, +0.01160] (shipped, reproduced). The destroyed-outcome null (C1,
  quality permuted) on the secondary is **+0.01143** (sd 0.00012); the destroyed-time null (C2) is
  +0.01035 (sd 0.00003). The slope of *raw* `quality_loss` on the frozen `ut_resid` is -0.00005. The
  reported `beta` is, to three decimals, `-slope(Qhat0, ut_resid)`: two extrapolating splines of the
  same clock features, one in the quality model and one in the time model, correlated with each other
  and with nothing the player did. Its interval is four times narrower than FINAL's on half the data
  because a deterministic function of `x` does not vary under player resampling; every band's frozen
  `beta` is 0.0111-0.0117 for the same reason. The packet's explanation -- `beta` survives because it
  is a slope of one residual on another while a level effect does not -- is exactly backwards: the
  level effect on the clock scale enters both residuals and manufactures the slope.
* Metric A frozen +0.0995 is garbage for the stated reason; so are Metric D (-0.0176, on a residual
  whose 95th-percentile threshold is off the scale) and every frozen band TAE (about -1.2).
* No control was run on the secondary (`analyse_period(..., want_controls=False)`), so the pipeline's
  own C1 -- which would have failed at roughly one hundred null SDs -- never had the chance to say so.
  **F-S2. LEGITIMATE CAVEAT** (process).

What the secondary can support: through the frozen pipeline, nothing -- not `beta`, not the "beta
replication it appears to show"; §2.6 is not evaluable and `CROSS_CONTEXT_REGULARITY` may not be
mentioned as narrowly missed. As an *exploratory, non-preregistered* check (mine, and it must be
labelled as such if quoted): with T2R, Q0 and `partial_ut` refitted on the secondary, `beta` is
+0.01245 [+0.01131, +0.01358]; with T1P and `rating ~ T1P` refitted, Metric A is -0.01079
[-0.01273, -0.00886] (the primary is -0.01069); the Metric B gradient refitted is +0.00007
[-0.00132, +0.00153]. Restricting the frozen pipeline to in-range clocks gives `beta` +0.00836
[+0.00631, +0.01083]. These say the *signs* of H1 and Metric A probably hold at 5+0 with nuisance
models fitted on the same data, which is not the test the preregistration defined. **F-S3.
LEGITIMATE CAVEAT**: reportable only under that label. Also: 2000-2199 has 149 players, 2200-2399
128, 2400-2599 61 -- the top of the range is unpowered there regardless.

---

## 5. Anything else that would make the report's conclusions unjustified

* **F-O1. `write_report.py` crashes.** `estimands.estimate` sets `out["tae_pooled"] = tae_main` and
  the band-shape loop then overwrites it with the DerSimonian-Laird dictionary (`{"tau2", "mean",
  "shrunk"}`; `tau2 = 0` on VALIDATION and FINAL, so every shrunk band equals the mean). `write_report.py`
  line 150 formats it with `:.4f` and raises `TypeError` (run; confirmed). No `REPORT.md` exists. The
  number the sentence intends is the pooled slope at the frozen centre, +0.0098 at 1600 or +0.0106
  pooled, not the random-effects mean 0.0104. **LEGITIMATE CAVEAT** (implementation defect; fixing it is
  permitted under §4 and changes no verdict).
* **F-O2. Drafted language that the numbers do not support.** In `write_report.py`: "Four independent
  readings of the same quantity agree that it is not there" (not independent; not "not there");
  "survives matching on position difficulty" (3.4); the C6 sentence (3.5); and obligation (e)'s
  reading of the raw-column C4 value (-0.0008) as "the recognition channel ... and it is not zero" --
  that number is the channel's gradient diluted by the permutation variance (1.2); if the channel is
  described, cite the direct gradient (+0.0068 on FINAL) and its two readings. **INTERPRETATION
  DOWNGRADE.**
* **F-O3. Metric A is two fifths premoving.** With `T = 0` removed Metric A is -0.0063 against
  -0.0107; the `T = 0` share rises from 5.6% (800-999) to 14.6% (2400-2599). A premove is decided on
  the previous position. The metric holds either way, but "stronger players spend less time on
  comparable positions" should be read with that share printed. **LEGITIMATE CAVEAT.**
* **F-O4. The per-band residual means on FINAL** show the frozen T1P (no rating) misfitting by band
  from +0.083 log-seconds (800-999) to -0.054 (2400-2599), and `rating_resid` averaging -40.7 Elo
  (fewer top-band sides than in February). Every reported slope is centred, so none of this enters a
  coefficient; the table Gate 1 recommendation 6 asked for should be printed. **LEGITIMATE CAVEAT.**
* **F-O5. The level-3 phrase.** Preregistered, and the data meet its rule (9/9 bands); obligation (d)
  applies. On FINAL the magnitude falls by about a third across the range rather than halving.
  **LEGITIMATE CAVEAT** (no change).
* Nothing else found: player overlap (106 of 2,331; restricted `beta` +0.01330), C8 (0.6% / 0.5%),
  account-status exclusion (FINAL top band 4.3% closed against DEVELOPMENT's 7.7%; gradient without
  the top band +0.00082), one-side-per-game, the seal chain, and the determinism re-score are as
  described.

---

## 6. Classification of every finding

| # | Finding | Class |
|---|---|---|
| C3 | The C3 -> Metric A/C/D nulls carry a frozen deterministic term; derived, predicted, reproduced | **REPAIRABLE IMPLEMENTATION ERROR** (ruling); repaired run is B3 |
| C3-a | The packet's "factor of four from player-level permutation" is wrong; it is the denominator | LEGITIMATE CAVEAT (correct the record) |
| C3-b | Gate 2 derived the class for C1 and endorsed C3 without applying it | LEGITIMATE CAVEAT (disclose) |
| C3-c | Every FINAL null carries a drift offset (0.6-2.5 SD); passes are passes of offset nulls | LEGITIMATE CAVEAT (print the table) |
| F-B1 | `beta` is a blunder regularity (capped-outcome values 0.0034-0.0130) | INTERPRETATION DOWNGRADE |
| F-B2 | `beta` = +0.0019 when the engine's own move was played | LEGITIMATE CAVEAT |
| F-B3 | Stratum variation of `beta` is the outcome's scale | LEGITIMATE CAVEAT |
| F-B4 | Measured difficulty moves `beta` 3.7%; C9's budgets share 99.8% of the regressor | LEGITIMATE CAVEAT |
| F-N1 | Instrument: partial correlation 0.017, flat across clock terciles, reliability 0.62, validity unknown | LEGITIMATE CAVEAT |
| F-N2 | Pooled Metric B gradient is a cancellation of a sign-flipped predicted-VoC gradient on the 59% point mass and a weak positive remainder | INTERPRETATION DOWNGRADE |
| F-N3 | `TAE_FLOOR` is twice the instrument's level; 80% power at a 0.024 spread | INTERPRETATION DOWNGRADE |
| F-N4 | Matched clause structurally negative; balance worse after matching; "five readings" are one instrument | INTERPRETATION DOWNGRADE; LEGITIMATE CAVEAT for matched `beta` |
| F-N5 | C6 plants at 5-10x the real scale in the instrument's units; "a null the instrument could have broken" unjustified | INTERPRETATION DOWNGRADE |
| F-S1 | Secondary control: every frozen number is an extrapolation artefact; `beta` equals its destroyed-outcome null | **FATAL DEFECT** (secondary block only; primary verdict unaffected) |
| F-S2 | No control was run on the secondary | LEGITIMATE CAVEAT |
| F-S3 | Refit diagnostics on the secondary are exploratory and must be labelled so | LEGITIMATE CAVEAT |
| F-O1 | `tae_pooled` overwritten; `write_report.py` crashes | LEGITIMATE CAVEAT (repair permitted) |
| F-O2 | Drafted sentences not supported ("independent readings", "not there", "survives matching", C6, C4-raw as the channel) | INTERPRETATION DOWNGRADE |
| F-O3 | Metric A is two fifths the `T = 0` share | LEGITIMATE CAVEAT |
| F-O4 | Band residual means under the frozen models | LEGITIMATE CAVEAT |
| F-O5 | Level-3 phrase requires obligation (d) | LEGITIMATE CAVEAT |

No finding above is a fatal defect of the primary experiment. The repaired verdict --
`GENERAL_REGULARITY_ONLY`, level 3 -- is justified with the downgrades applied: H1 is a replicated
within-player blunder regularity of engine-measured size 0.013 per log-second, sign-invariant across
rating and not constrained against human-perceived difficulty; H2 was not tested by an instrument
capable of answering it.

---

## NEXT_EXPERIMENT

**B4 -- the time-allocation gradient with a validated, non-degenerate instrument.** One experiment,
same population and freeze discipline as B3, different instrument and different floor:

1. *Instrument.* A VoC measure with no point mass, e.g. the expected regret of the shallow candidate
   distribution, `sum_k p_shallow(k) x [wp_deep(best) - wp_deep(k)]` with `p_shallow` a softmax over
   the depth-8 evaluations at the accuracy temperature, which is zero only when the shallow ordering is
   certain; shallow point anchored at a node count, `shallow_depth` recorded. Validated on DEVELOPMENT
   before the freeze by two pre-specified checks that the current instrument fails or has never had:
   test-retest reliability of its T1P residual across engine budgets >= 0.8, and the pooled slope of
   residual time on it must be larger in the fullest clock tercile than in the emptiest with an
   interval excluding zero. An instrument that fails either is not measuring allocation and B4 returns
   to Gate 1.
2. *Estimands.* The rating gradient of the time response to VoC reported as two named quantities --
   the response to the residual component and to the predicted component -- so the channel B3 found at
   +0.007 to +0.010 per 100 Elo is a preregistered quantity with its recognition/allocation ambiguity
   stated, rather than a contaminant with a flipped sign inside the primary metric.
3. *Floor and power.* The floor fixed at freeze as a relative change of the DEVELOPMENT pooled level
   (e.g. 50% across 800-2600, converted to an absolute number from DEVELOPMENT only), and N set by the
   pilot to give 80% power for it -- about three times B3's per-period decisions, or a preregistered
   pooled read of three periods.
4. *Matching.* Cells defined on difficulty, clock, phase, standing and ply only -- never on the
   instrument whose response is the estimand -- with balance required to improve on every cell
   variable as a condition of using the matched estimate.
5. *Replication arm.* `300+0` with its own DEVELOPMENT day and its own frozen fits, and the
   destructive controls run on it.
