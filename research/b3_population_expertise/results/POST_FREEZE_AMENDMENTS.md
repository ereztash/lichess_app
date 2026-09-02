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
