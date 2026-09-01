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
* **beta** -- the H1 coefficient of `unexpected_time_within_rating` in the fully adjusted model
  (`MODEL_SPEC.md` §3), in win-probability units per unit of `log(1 + T)`.
* **BETA_FLOOR = 0.002** win probability per log-second. Below this, an effect is called
  statistically detectable and practically negligible, and it does not support H1. Fixed here,
  before any B3 estimate existed, from the practical scale of the outcome: mean `quality_loss` in
  blitz is of order 0.03-0.06, so 0.002 is a few percent of a typical error, which is the smallest
  amount worth a sentence.
* **TAE gradient** -- `d TAE / d rating`, the coefficient of `voc_z x rating`.
* **monotone enough** -- Spearman rho between band index and the metric, over adequately powered
  bands, is at least **0.6** with the preregistered sign.

## 2. Ordered gates

Applied in order. The first that fires is the verdict.

### 2.1 `INVALID_EXPERIMENT`

Any of:

1. The leakage tests (`PREREGISTRATION.md` §5) fail.
2. **C5 fails** -- a planted regularity is not recovered.
3. **C6 fails** -- a planted expertise gradient is not recovered.
4. **C7 fails** -- the pipeline reports the hypothesis on data built without it.
5. Any of C1, C2, C3, C4 fails -- a destroyed signal survives its destruction.
6. The FINAL holdout was materially inspected before Gate 2 passed (`HOLDOUT_CONTAMINATED` is
   recorded instead, and B3 ends).
7. `voc_regret_censored` exceeds 15% of DEVELOPMENT decisions.
8. Engine nondeterminism is detected between the recorded run and a verification re-score.

### 2.2 `DIFFICULTY_PROXY_ONLY`

`beta`'s interval contains 0, **or** `abs(beta) < BETA_FLOOR`, **and** T1 already explains the
time-quality relationship (Q1 adds less than 0.001 to held-out `R^2` over Q0).

### 2.3 `SKILL_ONLY`

Rating predicts `quality_loss` (rating coefficient interval excludes 0, correct sign) **and**
neither H1 nor any H2 gradient survives: `beta` fails §2.2's bar, and fewer than two H2 metrics
meet §2.5's conditions.

### 2.4 `GENERAL_REGULARITY_ONLY`

H1 holds -- `beta > 0`, interval excludes 0, `beta >= BETA_FLOOR`, and the preregistered direction
appears in at least 80% of adequately powered bands -- but the H2 requirements in §2.5 are not all
met.

### 2.5 `EXPERTISE_ADAPTATION_SUPPORTED`

**All eleven** must hold on the FINAL period. Any single failure drops the verdict to §2.4 or
lower.

1. `beta > 0`, interval excludes 0, `beta >= BETA_FLOOR`, on FINAL.
2. The preregistered direction of `beta` appears in **>= 80%** of adequately powered FINAL bands.
3. `beta` survives full adjustment: it is estimated in the model containing difficulty, VoC, clock,
   phase and standing, and its interval still excludes 0 with `beta >= BETA_FLOOR`.
4. **At least two** of Metrics A, B, C, D show the preregistered rating direction with an interval
   excluding 0 **and** are `monotone enough` across adequately powered bands. (Metric E is
   descriptive and cannot count.)
5. **Metric B, Time Allocation Efficiency, is one of them**, and additionally
   `TAE(highest adequately powered band) - TAE(lowest)` is at least **20% of TAE(lowest)** in
   relative terms with an interval excluding 0.
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

### 2.6 `CROSS_CONTEXT_REGULARITY` (secondary label, optional)

Added only when `EXPERTISE_ADAPTATION_SUPPORTED` holds **and** the frozen pipeline, run on `300+0`
with no retuning, reproduces the sign of `beta` and of the Metric B gradient with intervals
excluding 0. It never changes the primary verdict.

## 3. Scientific level (reported alongside the verdict)

    0  only rating -> accuracy
    1  a time-quality regularity exists
    2  it survives measured objective difficulty (Q1 beats Q0 out of sample by >= 0.001 R^2)
    3  its qualitative shape is invariant across skill levels (>= 80% band sign agreement and
       `monotone enough` shape for beta across bands)
    4  expertise systematically changes management of the process
       (= EXPERTISE_ADAPTATION_SUPPORTED)
    5  level 4 plus independent temporal replication (C15 agreement across all three periods)
       AND alternate-time-control replication (§2.6)

## 4. What may and may not happen after the holdout is opened

**May:** repair a genuine implementation defect, with the defect documented and the repaired run
labelled; downgrade a verdict or soften language; record new ideas under `NEXT_EXPERIMENT`.

**May not, under any authority including the reviewer's:** add a feature, change the primary
outcome, change exclusions, change rating bands, change hyperparameters, change the model family,
change a threshold in this file, or re-run FINAL after seeing FINAL. A repair that changes a
*scientific choice* rather than an implementation error voids B3; the work continues as **B3.1**
with a new untouched period.

**Never:** upgrade a verdict on the strength of a post-holdout argument.
