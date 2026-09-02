# B3 -- amendments after the freeze, and why each is a repair rather than a choice

The five documents were hashed in `PREREGISTRATION_FREEZE.json` before DEVELOPMENT finished scoring.
This file records every change to them since, what prompted it, and why it is an implementation
repair rather than a scientific decision. It is the first thing FABLE GATE 2 is asked to audit,
because "we fixed a control that was failing" is exactly the sentence a study tells itself on the way
to a result it wanted.

**State when these were made:** DEVELOPMENT and VALIDATION scored and analysed. FINAL never read.
Nothing below changes the primary estimand, the outcome definition, any exclusion, the rating bands,
any verdict threshold, or the model family.

---

## A0. What actually failed, and when

Corrected at Gate 2. The first version of this document said "on VALIDATION, five controls failed",
and offered one explanation -- an unlucky single draw -- for all five. That is true of at most two of
them. The committed pre-amendment DEVELOPMENT analysis (`results/analysis_develop.json`, commit
`4387189`) already contained three failures, and their intervals are not close:

| pre-amendment DEVELOPMENT control | value | excludes 0 |
|---|---|---|
| C1 `beta` | +0.00077 [-0.00009, +0.00181] | no |
| C2 `beta` | +0.00039 [-0.00014, +0.00104] | no |
| C3 `tae_rating_gradient` | +0.00185 [+0.00089, +0.00281] | **yes** |
| C3 `allocation_loss_vs_rating` | +0.00347 [+0.00263, +0.00428] | **yes** |
| C3 `extreme_ut_vs_rating` | +0.00195 [+0.00153, +0.00237] | **yes** |
| C3 `beta_rating_interaction` | +0.00051 [+0.00032, +0.00068] | **yes** |
| C4 `tae_rating_gradient` | -0.00099 [-0.00167, -0.00023] | **yes** |
| C7 `beta` | +0.00113 [+0.00044, +0.00187] | **yes** |

So **C3, C4 and C7 had already failed on DEVELOPMENT**, systematically, before VALIDATION was
analysed; only C1 and C2 first failed on VALIDATION, and only those two are explained by the
single-draw problem A1 describes. C3's failure had a separate cause and gets its own entry (A1b).
The commit that carried that analysis mentioned none of it.

## A1. Destructive controls are permutation tests, not one permutation with an interval around it

**What failed.** On VALIDATION: C1 `beta` = -0.00174 [-0.00276, -0.00078] and C2 -0.00082
[-0.00147, -0.00002]. Both intervals exclude zero; read literally, `VERDICT_RULES.md` §2.1 makes
that `INVALID_EXPERIMENT`.

**What was actually wrong** (for C1 and C2). Each control ran **one** permutation and reported a *player-bootstrap*
interval around it. That interval measures how precisely that single shuffled dataset was estimated.
It says nothing about whether the value is consistent with zero, which is the question the control
asks. Twenty-five permutations of the same DEVELOPMENT data put C1's mean at **-0.00009 with a
standard deviation of 0.00054**, spanning -0.00136 to +0.00091 -- the null is centred on zero and the
single validation draw was an ordinary tail value being read against the wrong ruler.

**Ruled out first.** The alternative explanation was that the frozen-ridge residualisation is not an
exact projection, leaving `beta` with a systematic offset. It was tested directly by re-estimating
`beta` as a three-parameter regression of raw `quality_loss` on `[unexpected_time, Qhat0, UThat]`,
which is a genuine partial coefficient and immune to that objection.

On **VALIDATION** -- the period the failures appeared on, which is the check that matters and which
the first version of this document did not report -- the three-parameter estimator gives 0.0141162
against the shipped 0.0141192, and a **full refit of every nuisance model on VALIDATION itself**
gives 0.014177. Three estimators, agreeing to the second significant figure, one of them free of the
freeze entirely. On DEVELOPMENT the three-parameter check gives +0.01269 against +0.01270. The
estimator was not the problem.

**Repair.** 200 permutations per destructive control; the reported interval is the 2.5/97.5
percentile **across permutations**.

**What the new rule can and cannot do, corrected at Gate 2.** It is *not* "strictly harder". It has
a near-zero false-failure rate and detects only bias larger than roughly two standard deviations of
the null distribution -- so it is more forgiving of small systematic offsets and far less forgiving
of noise. It is also not the same test B2's `analyse.py` runs, and the earlier claim that it was is
withdrawn: B2 compares an observed statistic against the 95th percentile of a null, while this
compares a null's own interval against zero.

Small offsets survive it and must therefore be **printed rather than passed over**. On VALIDATION
the C1 null sits at -0.00041 and C2's at -0.00023, about ten Monte-Carlo standard errors from zero.
Their source is analytic and known: with a frozen nuisance fit, C1's expectation is
`-slope(Qhat0, ut_resid)`, the residual correlation the frozen ridge purge leaves behind. It is
about 3% of `beta` and it is in the conservative direction. The report prints each null's mean with
its Monte-Carlo standard error, and names these two.

**Result on DEVELOPMENT after the repair.** C1 -0.00002 [-0.00089, +0.00080]; C2 +0.00002
[-0.00044, +0.00052]; C3 all four gradients within +/-0.0001 of zero; C7 all four within +/-0.0001.

## A1b. C3 permuted rating across players and recomputed `rating_diff` from it

**Not part of A1, and not a single unlucky draw.** C3's four gradients failed on DEVELOPMENT with
systematic offsets -- Metric D at +0.00195 with an interval of +/-0.0002, Metric C at +0.00347 --
which no amount of re-drawing would have moved.

**The cause.** The first construction permuted a player's rating and then recomputed `rating_diff`
and `rating_band` from the permuted value, and pushed all of it back through the frozen models. A
900-rated player handed a 2400 rating acquires a `rating_diff` of -1500 against their real opponent:
a matchup that cannot occur, evaluated by models that were never fitted anywhere near it. The
extrapolation, not the hypothesis, is what the control was detecting.

**The repair.** Nothing in the T1P-based residuals depends on rating at all, so a rating permutation
touches exactly the three vectors that carry it -- `rating_c`, the rating spline block and
`rating_resid` -- and needs no re-derivation through any model. After the repair all four gradients
sit within 0.0001 of zero.

## A2. C4 permutes the regressor the estimator uses

`MODEL_SPEC.md` §9 said "permute `voc_z`". Permuting the raw column and re-deriving through the
frozen fit leaves `-vochat(x)` untouched -- a deterministic function of the position that still
carries rating-dependent structure -- so the control had not destroyed the thing it names. Its null
sat at -0.00118 [-0.00191, -0.00040], excluding zero, on data where the association had supposedly
been destroyed.

Permuting `voc_resid`, which is the regressor Metric B is a slope of, destroys exactly the
association under test: -0.00001 [-0.00085, +0.00085]. The raw-column version is still computed and
reported beside it.

## A3. C7 generates from the model whose residual is taken

**The failure was the QUALITY generator, corrected at Gate 2.** C7 built quality around its **mean**
while the estimator takes residuals against **Q0**, so `q_resid` retained `-Qhat0(x)` -- a
deterministic function of the position -- and the pipeline correctly reported a real association
present in a badly specified null. Fixing the quality generator alone takes `beta` from +0.0018 to
+0.0003. Changing the time generator from T1P to T2P is a **separate and conservative** change that
affects the H2 checks, not `beta`; the first version of this document ran the two together and
credited the wrong one.

One consequence must be stated plainly: **C7's `beta` check is now a code check.** With quality
generated from Q0 and independent noise, zero is what linear algebra requires, and the same is true
of C1, C2 and C4 after their repairs. "They pass on FINAL" means the arithmetic is intact; it is not
evidence about the science. The controls that can still fail for a scientific reason are C5b (the
pipeline may recover too little of a foreign signal), C6 (it may not recover a planted gradient),
C8 (a few players may drive the result) and C9 (the effect may attenuate under a better budget).

C7 now generates time from **T2P** -- the fullest model without rating -- and quality from **Q0**,
with independent noise. The true `beta`, the true rating effect on time and the true allocation
gradient are then all zero, and all three come back at zero.

An earlier attempt generated from T2R, which put rating **into** the synthetic time, and Metric A
duly recovered its own real value (-0.0105) from data built to have no rating effect at all -- a
control failing because its generator contained the thing it was testing for the absence of.

## A4. C7b, added: the size of alternative explanation A2

The mis-specified C7 was measuring something worth measuring, so it became its own diagnostic.

Every version of this preregistration has called **A2 -- unexpected time is a proxy for difficulty
the engine features missed** -- the central irreducible limitation, and every version has left it as
a caveat with no number. C7b attaches a number. An unobserved standard-normal factor, independent of
everything measured, is added to both thinking time and quality with strengths **calibrated to a
measured difficulty factor**: the engine-difficulty block, i.e. what T1P adds to T0. On DEVELOPMENT
that is 0.129 log-seconds and 0.0025 win probability per standard deviation. The true `beta` is zero
by construction.

**It manufactures `beta` = +0.00076 [+0.00001, +0.00164].**

The observed DEVELOPMENT `beta` is +0.0127 -- about **seventeen times** larger. A2 would have to
supply roughly seventeen more unmeasured difficulty factors, each as strong as the ones the design
does measure and all absent from the expected-time model, to account for the observed association on
its own. That does not eliminate A2 and the report will not say it does. It bounds it.

Read with control C9, which found `beta` unchanged when the engine budget is raised 2.5-fold
(`r_beta` = 1.015 [0.953, 1.075], excluding attenuation greater than 4.7%), the difficulty-proxy
explanation is now constrained by two independent measurements rather than acknowledged in prose.

## A6. C6 now exercises the estimator condition 6 reads (Gate 2, R3)

The hashed `MODEL_SPEC.md` §7 says control C6 must exercise the player-level statistic, and it did
not: it checked only the pooled gradient. That is how the shrink-then-regress estimator survived two
review passes while returning exactly zero on a planted gradient -- the control that should have
caught it was looking somewhere else.

C6 now runs the per-player centred TAE and the inverse-variance regression on rating, i.e. the code
`estimands.player_level` runs, on every synthetic draw. **Reported only; it does not join C6's pass
condition.** It recovers the planted 0.00278 as +0.00285 (DEVELOPMENT) and +0.00280 (VALIDATION),
which is the demonstration on data with a known answer that the previous estimator could not have
given.

## A5. Report-language obligations, fixed at Gate 2 before FINAL was opened

Additions to what the report must and must not say. The hashed forbidden list in
`PREREGISTRATION.md` §9 is not edited; these bind in the same way.

**(a) C7b is an exchange rate, not a factor count.** `beta_manufactured = (b / a) x f`, where `a`
and `b` are the factor's strengths on log-time and on quality and `f` is its share of the residual
time variance. "The observed beta is 17x the manufactured one" therefore does **not** mean "A2 needs
seventeen unmeasured factors". **One** latent factor about 6.6x the engine block on both axes
(DEVELOPMENT; ~12x on VALIDATION) reproduces the observed `beta` by itself -- and a single dominant
latent, *how hard this position actually was for this human*, is A2's natural form, not seventeen
independent small ones. The anchor is also weak by the study's own numbers: the measured
engine-difficulty block explains about 3% of residual time variance, so "as strong as the ones we
measure" is a low bar and multiples of it sound larger than they are. The report may print the
multiple only beside the single-factor statement and the nuisance ladder.

**(b) "A2 is bounded / constrained / excluded" is forbidden.** The licensed sentence is that the
**engine-measurable** form of A2 is constrained -- by C7b, by the nuisance ladder and by C9 -- and
that the **human-perceived** form is exactly where the preregistration put it: cannot be excluded.

**(c) C9's interval is reported with what actually changed between the budgets**, and without "a
stronger statement than the design was entitled to expect". What changed: `voc_regret` correlates
0.64 between budgets and `voc_rank` 0.49, so the value-of-computation features moved substantially;
`quality_loss` correlates 0.96, the best move is identical on 68% of decisions, and median depth went
from 12 to 14. The interval is tight because the two budgets' estimates move **together** under
player resampling, not because the design gained information.

**(d) "law-like" at level 3 carries its own qualification in the same sentence**: the
`beta x rating` interaction and the top-to-bottom band magnitudes. A regularity whose magnitude
roughly halves across the rating range is invariant in sign and shape, not in size, and the sentence
must say which.

**(e) The raw-column C4 value on FINAL is reported beside the pass condition**, with the reading
that the deterministic part it leaves in place -- predicted VoC interacted with rating -- is the
recognition channel the design cannot separate from allocation.

## The nuisance ladder, reported beside C7b (Gate 2, R7a)

`beta` under three nested nuisance sets, each with rating, each fitted on DEVELOPMENT and frozen:
context only (T0R), plus the whole fourteen-feature engine-difficulty block (T1R), plus
value-of-computation (T2R, the shipped one). It is a **direct measurement** of what measured
difficulty does to `beta`, where C7b is a simulation of the same thing, and the two agree in
magnitude. It admits two readings and the report may not choose between them: either `beta` is
robust to measured difficulty, or depth-12 engine features capture so little of what makes a human
slow *and* wrong that their failure to move `beta` says little about what would.

## What did NOT change

The primary estimand, the outcome, `BETA_FLOOR`, `TAE_FLOOR`, the minimum band count, the rating
bands, the exclusions, the sample, the engine configuration, the model family, the freeze doctrine,
and every verdict gate. `evaluate.py` reads the same fields it read before the freeze.

## Re-hash

The amended documents are re-hashed in `PREREGISTRATION_FREEZE.json` under `amended_sha256`, with
the original hashes retained beside them so the diff is auditable.

## A7. C3 null construction repaired after the holdout was opened (Gate 3, ruling 1.5-1.7)

This is the only amendment written after FINAL was opened. It changes a **control's construction**
and no estimate. It was pinned verbatim by the Gate 3 adversary, not chosen by the researchers, and
the diff below is the whole of it.

**Label for the run:** *B3, C3 null construction repaired after the holdout (amendment A7);
mechanical verdict as emitted `INVALID_EXPERIMENT`; repaired verdict `GENERAL_REGULARITY_ONLY`,
level 3.*

### A7.1 Both verdicts

| | verdict | level | failed H2 conditions |
|---|---|---|---|
| as shipped | `INVALID_EXPERIMENT` | -- | identical list |
| repaired | `GENERAL_REGULARITY_ONLY` | 3 | `h2_includes_tae`, `h2_tae_matched`, `h2_tae_no_zero_time`, `h2_tae_low_clock_pressure`, `h2_tae_spread`, `h2_player_level`, `player_disjoint_holds` |

`evaluate.py` was run unmodified on both. The failed-condition list is identical: the repair moves no
verdict-bearing condition of H2.

### A7.2 The derivation (Gate 3 §1.2)

The shipped C3 permutes each player's rating across players and forms
`perm_resid = perm_rating - ratinghat`, where `ratinghat` is the DEVELOPMENT-frozen ridge prediction
of rating from the T1P features, then reads `100 * slope(y_resid, perm_resid)`.

Writing `cov` and `var` over rows, `slope(y, perm - h) = [cov(y, perm) - cov(y, h)] / var(perm - h)`.
Under a uniform permutation of player ratings `E[perm_i] = R_bar` for every row, so
`E[cov(y, perm)] = 0` and `E[cov(perm, h)] = 0` exactly. What is left is deterministic:

    E[C3 -> A]  ~=  -100 * cov(y_resid, ratinghat) / [ var(rating) + var(ratinghat) ]

`cov(y_resid, ratinghat)` is zero only where the T1P residual is orthogonal to the T1P column space,
which is the period the ridge was fitted on. On any later period the frozen fit's misfit has a
component along `ratinghat`, and the null inherits it. The identical algebra gives the Metric D and
Metric C nulls with `extreme_resid` and `allocation_resid` in place of `y_resid`. The TAE-gradient
null subtracts nothing and was never at issue.

### A7.3 Verification (Gate 3 §1.3; deterministic seeds, 200 permutations)

| period | shipped null | predicted by A7.2 | MC SE | `R2(rating \| T1P)` frozen | `cov(ratinghat, rating_resid)` |
|---|---|---|---|---|---|
| DEVELOPMENT | +0.000025 (sd 0.000439) | -0.000001 | 0.000031 | 0.269 | +130 |
| VALIDATION | -0.000157 (sd 0.000491) | -0.000138 | 0.000035 | 0.247 | -1,403 |
| **FINAL** | **-0.001145** (sd 0.000457, z 2.51) | **-0.001094** | 0.000032 | 0.216 | **-5,311** |

The prediction lands within 1.6 Monte-Carlo standard errors on FINAL and within one on the others.
The last column is the freeze made visible: on DEVELOPMENT the frozen partial of rating is orthogonal
to its residual; four months later it is not.

### A7.4 The corrected explanation, replacing the Gate 3 packet's

The packet attributed the offset to permuting **over players rather than over rows**. That is wrong
and is withdrawn. The packet's own quantity `-100 * slope(y_resid, ratinghat)` divides by
`var(ratinghat)` where the null divides by `var(rating) + var(ratinghat)`; the ratio
`61,676 / 298,552 = 0.207` on FINAL is the packet's unexplained "factor of four". The mechanism is the
**denominator**, not the permutation unit. The same dilution explains the raw-column C4 null: the
deterministic gradient of `eY` on `-vochat x rating` is -0.0098 / -0.0081 / -0.0068 across the three
periods and dividing by `var(voc_z) + var(vochat)` (about 1.13) reproduces the shipped -0.00115 /
-0.00089 / -0.00081. One mechanism, two controls.

### A7.5 The estimator does not share the defect

The deterministic term does sit inside Metric A, and there it cancels: the estimator's regressor is
`rating - ratinghat` with the two correlated, so the misfit along `ratinghat` enters both
`cov(y, rating)` and `cov(y, ratinghat)`. In the null, `perm_rating` is uncorrelated with `ratinghat`
and nothing cancels, which is why the null overstates the drift's effect on the estimate by an order
of magnitude. Metric A and `beta` on FINAL under three estimators:

| quantity | frozen (reported) | three-parameter | nuisance refit on FINAL |
|---|---|---|---|
| Metric A | -0.01069 | -0.01056 | -0.01046 |
| `beta` | 0.01342 | 0.01346 | 0.01344 |

The drift-free values are **reported beside** the frozen ones and do not enter the verdict. Replacing
the verdict estimator with a drift-free one is a scientific choice, would be B3.1, and was not done.

### A7.6 The repair, exactly

One construction, no variants, applied to all three slope-based C3 fields whether or not they failed:

    # controls.py, C3 block
    perm_resid = perm_rating          # was: perm_rating - ratinghat

`slope()` centres, so each frozen residual is regressed on the permuted rating minus its mean: the
partial of `perm_rating` under the null, where `E[perm_rating | x]` is a constant and the frozen
`ratinghat(x)` is the partial of the *real* rating, not the permuted one. It is the same principle as
the pre-holdout C4 repair ("permute the regressor the estimator uses"). C1 and C2 were left as
shipped; their pass status is unchanged under either form.

Procedure followed: `controls.run(..., which={"C3"})` re-run on the three periods only; every other
block of every analysis file byte-identical (verified by sha256 over the analysis with the C3 blocks
excised: `d2794b40...` before and after); the shipped C3 block retained beside the repaired one in
`results/c3_repair_diff.json`; `evaluate.py` run unmodified. No feature, outcome, exclusion, band,
hyperparameter, model family, threshold or estimate changed, and no byte of the FINAL period was
re-read, re-scored or re-sampled.

Repaired FINAL nulls: Metric A -0.000036 [-0.00107, +0.00093] (sd 0.000576); Metric D -0.000011;
Metric C -0.000008. DEVELOPMENT +0.000034; VALIDATION -0.000019.

### A7.7 What the repaired controls now are

After the repair, **every destructive null in the study is a code check that can fail only on a
defect** in the code that computes it. Gate 2 already required this sentence for C1, C2, C4 and C7;
C3 joins them. A destructive control that passes is evidence the pipeline is wired correctly. It is
not independent evidence that the estimate is causal, and the report may not read it as such.

### A7.8 The class, in a table (Gate 3 §1.8.4)

Every FINAL destructive null's offset from zero, in null standard deviations, as shipped:

| control | FINAL null | offset (null SDs) |
|---|---|---|
| C1 (destroyed outcome, `beta`) | +0.00031 | 0.64 |
| C2 (destroyed time, `beta`) | -0.00026 | 0.88 |
| C3 -> Metric D | -0.00012 | 0.84 |
| C3 -> Metric C | -0.00036 | 1.52 |
| C4 (raw column) | -0.00081 | 2.10 |
| C3 -> Metric A | -0.00115 | 2.51 |

These offsets are the frozen models' misfit on a June population, and they are larger than on the
April one. The "contains zero" pass rule tolerates them up to about two null SDs. The passes recorded
in this study are therefore **passes of offset nulls**, not passes of centred ones.

### A7.9 The Gate 2 miss, in the reviewer's words

> "The class was characterised before the holdout was opened: the Gate 2 review derived C1's null as
> `-slope(Qhat0, ut_resid)`, called it 'the fingerprint of the freeze', and stated that the amended
> rule 'can only fail when the estimator's bias under the null exceeds about two null SDs'. C3's
> Metric A null on FINAL is that prediction realised at 2.5. That the same reviewer -- me -- endorsed
> the C3 construction in the same document without applying the derivation to it is a miss the report
> must record, not a reason to fail the study for it."

### A7.10 Rescue risk, in the adversary's words

> "The repair does not serve H2, which fails identically before and after. It does serve H1: a run
> that was `INVALID` becomes a level-3 positive result the researchers want. So the risk is lower than
> 'fixing the control that broke the headline' but it is not zero, and I did not rely on the direction
> of the outcome to rule. What makes this a repair rather than a rescue is: the offset is predicted
> analytically from `cov(y_resid, ratinghat)`, a quantity that does not involve `beta`, rating's
> effect, or any hypothesis; C3 never touches `beta`, and `beta`'s own destroyed-outcome nulls sit at
> 2% of it; the class was written down by the adversary before the holdout was opened; the repair is
> pinned by the adversary, not chosen by the researchers; and the expectation recorded in
> `FINAL_HOLDOUT_SEALED.json` before opening was exactly the repaired outcome. I would have ruled the
> other way if the repair had flipped any verdict-bearing condition (it flips none), if the offset had
> not reproduced from first principles, or if `beta`'s nulls had shown offsets of comparable size."

### A7.11 What A7 does not license

It does not license re-running FINAL for any other reason, changing the verdict estimator, dropping
the Metric A check from C3, choosing among repair variants after seeing which passes, or reading the
repaired pass as new evidence for H1. Both verdicts are reported. `INVALID_EXPERIMENT` was the
mechanical output of the preregistered rules on the shipped code and is printed beside the repaired
one wherever the repaired one appears.
