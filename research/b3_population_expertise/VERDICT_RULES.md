# B3 -- Verdict rules

Frozen with `PREREGISTRATION.md`. Applied **mechanically** by `src/evaluate.py` to
`results/analysis.json` immediately after the FINAL holdout is scored, before any narrative exists.
No human judgement enters between the numbers and the verdict.

Every threshold below is a number, fixed here, before the FINAL period was opened.

---

## 1. Definitions used by the rules

* **interval** -- the 95% player-level block-bootstrap percentile interval, 400 replicates.
* **adequately powered band** -- in the period being judged: >= 150 distinct players **and**
  >= 3,000 eligible decisions. Bands below this are reported with their counts and excluded from
  the agreement rules. Bands are never merged.
* **minimum band count (Gate 1, R4d)** -- the invariance and expertise gates require **at least 5**
  adequately powered bands. With three bands a Spearman correlation can only take the values
  `{-1, -0.5, 0.5, 1}` and "monotone enough" collapses into "perfectly ordered"; with two it is
  vacuous. Below five, the verdict is capped one level lower and the band count is recorded as the
  reason. The cost pilot must therefore target adequacy in **every** band the population allows,
  and the per-band targets are written to the corpus manifest before any period is scored.
* **raw, not shrunk (Gate 1, R4c)** -- the sign-agreement and Spearman tests read the **raw** band
  estimates. Partial pooling with unequal band variances can reorder bands, and a shape test run on
  reordered points is a test of the shrinkage. Shrunk estimates appear in figures, overlaid on the
  raw points, and nowhere else.
* **rounding** -- `ceil`. 80% of 7 bands is 6, not 5.6.
* **beta** -- the H1 coefficient of `unexpected_time_within_rating` in the fully adjusted model
  (`MODEL_SPEC.md` §3), in win-probability units per unit of `log(1 + T)`.
* **BETA_FLOOR = 0.002** win probability per log-second. Below this, an effect is called
  statistically detectable and practically negligible, and it does not support H1. Fixed here,
  before any B3 estimate existed, from the practical scale of the outcome: mean `quality_loss` in
  blitz is of order 0.03-0.06, so 0.002 is a few percent of a typical error, which is the smallest
  amount worth a sentence.
* **TAE gradient** -- `d TAE / d rating`, the coefficient of `eV x rating_c` in
  `eY ~ s(rating) + eV + eV x rating_c`. The `s(rating)` main effect is part of the definition; see
  `MODEL_SPEC.md` §4 Metric B for why an interaction without it manufactures a gradient.
* **TAE_FLOOR = 0.02** log-seconds per DEVELOPMENT standard deviation of value-of-computation.
  **Absolute, not relative (Gate 1, R3).** The first draft asked for the top-to-bottom TAE
  difference to be "at least 20% of TAE(lowest)", which is degenerate twice over: near zero, 20% of
  it is near zero and any positive difference passes; and if `TAE(lowest)` is negative -- weak
  players spending *less* time where computation is worth more is a live possibility -- then 20% of
  it is negative and every difference satisfies the criterion. The absolute floor is 40% of the
  gradient C6 plants across the rating range, so a real effect must be at least a substantial
  fraction of one the pipeline is required to detect. `TAE(lowest)` is reported in every table so
  the sign of the base is visible.
* **monotone enough** -- Spearman rho between band index and the metric, over adequately powered
  bands, is at least **0.6** with the preregistered sign.

## 2. Ordered gates

Applied in order. The first that fires is the verdict.

### 2.1 `INVALID_EXPERIMENT`

Any of:

1. The leakage tests (`PREREGISTRATION.md` §5) fail.
2. **C5 fails** -- the implementation check does not recover a term linear in its own regressor,
   which means a code defect.
2b. **C5b fails** -- the pipeline recovers less than **half** of a signal defined outside its own
   residual, so it cannot see a real effect that is there. (A recovery between 0.5 and 1.0 is the
   attenuation factor, reported, not a failure.)
3. **C6 fails** -- a planted expertise gradient is not recovered.
4. **C7 fails** -- the pipeline reports the hypothesis on data built without it.
5. Any of C1, C2, C3, C4 fails -- a destroyed signal survives its destruction.
6. The FINAL holdout was materially inspected before Gate 2 passed (`HOLDOUT_CONTAMINATED` is
   recorded instead, and B3 ends).
7. `voc_regret_censored` exceeds 15% of DEVELOPMENT decisions.
8. Engine nondeterminism is detected between the recorded run and a verification re-score.

### 2.2 `DIFFICULTY_PROXY_ONLY`

Parenthesised explicitly (Gate 1, R4a):

    ( interval(beta) contains 0  OR  abs(beta) < BETA_FLOOR )  AND  ( Q1 - Q0 held-out R^2 < 0.001 )

That is: unexpected time neither clears the bar nor adds anything measurable beyond T1.

### 2.3 `SKILL_ONLY`

Rating predicts `quality_loss` (rating coefficient interval excludes 0, correct sign) **and**
neither H1 nor any H2 gradient survives: `beta` fails §2.2's bar, and fewer than two H2 metrics
meet §2.5's conditions.

### 2.4 `GENERAL_REGULARITY_ONLY`

**H1 holds** -- `beta > 0`, interval excludes 0, `beta >= BETA_FLOOR` -- and §2.5 is not met.

Band-shape is deliberately **not** a condition of this verdict (Gate 1, R4b). In the first draft it
was, and that left a hole with no verdict in it: `beta` positive, significant, above the floor, but
agreeing in fewer than 80% of bands fired none of §2.2, §2.3, §2.4 or §2.5, and a mechanical
`evaluate.py` had nothing to print. Band agreement belongs to the **scientific level** (§3), where
it decides level 3 against level 2, and that is where it now lives.

`src/evaluate.py` asserts that **exactly one** gate fires. A gate set that can fire twice, or not at
all, is not a rule.

### 2.5 `EXPERTISE_ADAPTATION_SUPPORTED`

**All eleven** must hold on the FINAL period. Any single failure drops the verdict to §2.4 or
lower.

1. `beta > 0`, interval excludes 0, `beta >= BETA_FLOOR`, on FINAL.
2. The preregistered direction of `beta` appears in **>= 80%** of adequately powered FINAL bands.
3. `beta` survives full adjustment: it is estimated in the model containing difficulty, VoC, clock,
   phase and standing, and its interval still excludes 0 with `beta >= BETA_FLOOR`.
4. **Metric B, and at least one of Metric A and Metric D**, show the preregistered rating direction
   with an interval excluding 0 **and** are `monotone enough` across adequately powered bands.
   Metrics C and E are **descriptive and cannot count** -- E because it makes no directional
   prediction, C because it is a transform of Metric B (Gate 1, R4e) and counting the two together
   would let this condition be met by one metric and its own shadow.
5. **Metric B holds four times over**: the pooled gradient, and again with an interval excluding
   zero (Gate 1, R2)
   * on the **matched sample** of `MODEL_SPEC.md` §6,
   * with **`T = 0` decisions removed** (C17), and
   * **within the lowest `clock_pressure` tercile** (C14),

   and the spread `TAE(highest adequately powered band) - TAE(lowest)` is at least **TAE_FLOOR**
   with an interval excluding 0.
5b. **At least 5 adequately powered bands** (see §1). Below that, the verdict is capped at §2.4 and
   the band count is recorded as the reason.
6. The player-cluster bootstrap supports the primary expertise gradient: the player-level
   regression of §7 of `MODEL_SPEC.md` has the same sign with an interval excluding 0.
7. C3 passes -- shuffled rating does not reproduce it.
8. C4 passes -- shuffled VoC destroys the Metric B signal.
9. C8 passes -- no small player subset drives it.
10. The matched analysis (§6 of `MODEL_SPEC.md`) is directionally consistent for `beta` and for
    Metric B.
11. FINAL agrees with the earlier periods in sign for `beta` and Metric B (C15).

Additionally, the **player-disjoint restriction** of `PREREGISTRATION.md` §3 must satisfy
conditions 1 and 5. If it does not, the verdict is `GENERAL_REGULARITY_ONLY` at most and the
overlap is reported as the reason.

### 2.5c The C9 budget reading (Gate 1, R12)

Independently of which gate fires: if the upper bound of `r_beta`'s player-bootstrap interval is
below **0.5** -- `beta` at least halves when the engine budget is raised 2.5-fold on the same
decisions -- the report **must** state that the evidence favours the difficulty-proxy explanation
(A2) over H1, and **level 3 and higher language is withheld**, whatever §2.5 returned. This is the
only falsification handle the design has on its own central limitation, and the number and its
threshold are fixed here, before FINAL was opened.

### 2.6 `CROSS_CONTEXT_REGULARITY` (secondary label, optional)

Added only when `EXPERTISE_ADAPTATION_SUPPORTED` holds **and** the frozen pipeline, run on `300+0`
with no retuning, reproduces the sign of `beta` and of the Metric B gradient with intervals
excluding 0. It never changes the primary verdict.

## 3. Scientific level (reported alongside the verdict)

    0  only rating -> accuracy
    1  a time-quality regularity exists
    2  it survives measured objective difficulty (Q1 beats Q0 out of sample by >= 0.001 R^2)
    3  its qualitative shape is invariant across skill levels: >= 80% (ceil) sign agreement of the
       RAW band estimates of beta across at least 5 adequately powered bands, and a
       `monotone enough` shape
    4  the time / value-of-computation relation differs systematically with rating, net of
       matched position and clock state
       (= EXPERTISE_ADAPTATION_SUPPORTED, and that label means EXACTLY this sentence)
    5  level 4 plus independent temporal replication (C15 agreement across all three periods)
       AND alternate-time-control replication (§2.6)

### 3.1 What level 4 is not (Gate 1, R13)

Level 4 is **not** "expertise changes how players manage the process", and the label
`EXPERTISE_ADAPTATION_SUPPORTED` is kept only because the mission plan fixes the name. The strongest
H2 signal is the within-band slope of time on engine-measured value-of-computation, and a stronger
player who merely *recognises* which positions are sharp produces a steeper slope with an identical
allocation policy -- a weaker player cannot allocate time to a position they cannot identify as
deserving it. No covariate in this design separates allocation from recognition. Any sentence in
`REPORT.md` that reads level 4 as a claim about management, allocation skill or time-management
skill is a claim the evidence does not support, and `PREREGISTRATION.md` §9 forbids it by name.

## 4. What may and may not happen after the holdout is opened

**May:** repair a genuine implementation defect, with the defect documented and the repaired run
labelled; downgrade a verdict or soften language; record new ideas under `NEXT_EXPERIMENT`.

**May not, under any authority including the reviewer's:** add a feature, change the primary
outcome, change exclusions, change rating bands, change hyperparameters, change the model family,
change a threshold in this file, or re-run FINAL after seeing FINAL. A repair that changes a
*scientific choice* rather than an implementation error voids B3; the work continues as **B3.1**
with a new untouched period.

**Never:** upgrade a verdict on the strength of a post-holdout argument.
