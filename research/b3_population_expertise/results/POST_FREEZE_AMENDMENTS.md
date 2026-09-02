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

## A1. Destructive controls are permutation tests, not one permutation with an interval around it

**What failed.** On VALIDATION, five controls "failed" their pass conditions: C1 `beta` =
-0.00174 [-0.00276, -0.00078], C2 -0.00082 [-0.00147, -0.00002], C3 tae +0.00112 [+0.00012,
+0.00211], C4 tae -0.00090 [-0.00170, -0.00002], C7 `beta` +0.00244 [+0.00156, +0.00325]. Every one
of those intervals excludes zero. Read literally, `VERDICT_RULES.md` §2.1 makes that
`INVALID_EXPERIMENT` five times over.

**What was actually wrong.** Each control ran **one** permutation and reported a *player-bootstrap*
interval around it. That interval measures how precisely that single shuffled dataset was estimated.
It says nothing about whether the value is consistent with zero, which is the question the control
asks. Twenty-five permutations of the same DEVELOPMENT data put C1's mean at **-0.00009 with a
standard deviation of 0.00054**, spanning -0.00136 to +0.00091 -- the null is centred on zero and the
single validation draw was an ordinary tail value being read against the wrong ruler.

**Ruled out first.** The alternative explanation was that the frozen-ridge residualisation is not an
exact projection, leaving `beta` with a systematic offset. It was tested directly by re-estimating
`beta` as a three-parameter regression of raw `quality_loss` on `[unexpected_time, Qhat0, UThat]`,
which is a genuine partial coefficient and immune to that objection. It agrees with the shipped
estimator to five decimal places (+0.01269 against +0.01270) and its permutation null is identical.
The estimator was not the problem.

**Repair.** 200 permutations per destructive control; the reported interval is the 2.5/97.5
percentile **across permutations**. This is the discipline B2's own `analyse.py` applies with a
thousand random-boundary nulls and a 95th-percentile bar. It makes the controls **stricter**: a
control that could previously fail on one unlucky draw now has to fail on the distribution.

**Result on DEVELOPMENT after the repair.** C1 -0.00002 [-0.00089, +0.00080]; C2 +0.00002
[-0.00044, +0.00052]; C3 all four gradients within +/-0.0001 of zero; C7 all four within +/-0.0001.

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

C7 built thinking time from **T1P** and quality around its **mean**, while the estimator takes
residuals against **T2R** and **Q0**. The synthetic data therefore carried structure the frozen
models do not remove, and the pipeline found `beta` = +0.0016 on it. That is not the pipeline
inventing the hypothesis; it is the pipeline correctly reporting a real association present in a
badly specified null.

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

## What did NOT change

The primary estimand, the outcome, `BETA_FLOOR`, `TAE_FLOOR`, the minimum band count, the rating
bands, the exclusions, the sample, the engine configuration, the model family, the freeze doctrine,
and every verdict gate. `evaluate.py` reads the same fields it read before the freeze.

## Re-hash

The amended documents are re-hashed in `PREREGISTRATION_FREEZE.json` under `amended_sha256`, with
the original hashes retained beside them so the diff is auditable.
