# FABLE GATE 3 -- result adversary: evidence packet

**State.** The final holdout was opened once, mechanically, after Gate 2 returned PASS on all
nine of its required changes. The frozen pipeline ran. `src/evaluate.py` -- a transcription of
`VERDICT_RULES.md` -- was applied to the output. **No narrative conclusion exists yet.**

---

## 1. The mechanical verdict

```
VERDICT: INVALID_EXPERIMENT
LEVEL:   None
REASON:  C3 failed: shuffled rating reproduced metric_a_time_vs_rating
```

One control failed on the holdout, and it is the only thing standing between this run and a
verdict. `C3_shuffled_rating.metric_a_time_vs_rating` -- the null in which rating is permuted
across players -- came back at
**-0.001145 [-0.001987, -0.000368]**, an interval excluding zero,
2.51 null standard
deviations out. `VERDICT_RULES.md` §2.1.5 makes that `INVALID_EXPERIMENT`.

### The same null on the two open periods, for comparison

| period | C3 -> Metric A null | null SDs from 0 | excludes 0 |
|---|---|---|---|
| DEVELOPMENT | +0.000025 [-0.000718, +0.000959] | 0.06 | no |
| VALIDATION | -0.000157 [-0.001041, +0.000730] | 0.32 | no |
| **FINAL** | -0.001145 [-0.001987, -0.000368] | 2.51 | **yes** |

### Our diagnosis, offered as a hypothesis for you to check rather than as a decision

C3 permutes the **raw rating column** and forms `perm_rating - ratinghat`, where `ratinghat` is
the DEVELOPMENT-frozen prediction of rating from T1P. Over draws the permuted rating averages to
a constant, so the null's expectation carries a deterministic term of roughly
`-100 x slope(y_resid, ratinghat)` -- which is **exactly zero only on the period the model was
fitted on**. Measured directly:

| period | `-100 x slope(y_resid, ratinghat)` | observed C3 null mean |
|---|---|---|
| development | -0.000003 | +0.000025 |
| validation | -0.000669 | -0.000157 |
| final | -0.005294 | -0.001145 |

Same sign, same ordering, right order of magnitude, off by about a factor of four on FINAL
because the permutation is over players rather than rows. This is the **same defect class** you
ruled a REPAIR at Gate 2 for control C4: a permutation that leaves a deterministic term in the
regressor, where the correct null permutes the residual the estimator actually uses.

**The conflict of interest, stated.** We have not applied that repair. Applying it would almost
certainly turn `INVALID_EXPERIMENT` into a verdict, and a researcher repairing a control that
failed on their holdout is the exact shape of a rescue. `VERDICT_RULES.md` §4 and the mission
plan put this ruling with you, not with us.

**One fact that bears on it.** The repair does not serve the hypothesis. Metric B fails its
conditions on FINAL by five independent readings, so a repaired run returns
`GENERAL_REGULARITY_ONLY` -- a negative result on the study's own headline claim. The repair
would change *invalid* into *valid and negative*, not into support.

---

## 2. The frozen numbers

### 2.1 The corpus

| | DEVELOPMENT | VALIDATION | **FINAL** | secondary `300+0` |
|---|---|---|---|---|
| decisions | 85,139 | 74,450 | 81,624 | 46,647 |
| players | 2,428 | 2,142 | 2,331 | 1,336 |
| games | 2,541 | 2,216 | 2,447 | 0 |
| adequately powered bands | 9/9 | 9/9 | 9/9 | 6/9 |

### 2.2 H1

| | DEVELOPMENT | VALIDATION | **FINAL** |
|---|---|---|---|
| `beta` | +0.01270 [+0.01182, +0.01367] | +0.01412 [+0.01308, +0.01511] | **+0.01342 [+0.01243, +0.01431]** |
| band sign agreement | 100% | 100% | 100% |
| band Spearman | -0.93 | -0.65 | -0.57 |
| `beta` x rating /100 Elo | -0.00049 [-0.00067, -0.00027] | -0.00037 [-0.00057, -0.00016] | -0.00022 [-0.00043, -0.00002] |
| matched sample | +0.01561 [+0.01356, +0.01761] | +0.01962 [+0.01724, +0.02194] | +0.01683 [+0.01476, +0.01870] |
| Q1 - Q0 held-out R2 | 0.00891 | 0.01034 | 0.00929 |
| top band dropped | +0.01300 [+0.01200, +0.01421] | +0.01471 [+0.01358, +0.01579] | +0.01383 [+0.01277, +0.01483] |
| FINAL, players absent from the other two (106 of 2331 overlap) | -- | -- | +0.01330 [+0.01234, +0.01428] |
| secondary `300+0`, frozen pipeline | -- | -- | +0.01137 [+0.01113, +0.01160] |

`beta` by stratum on FINAL, all positive, all intervals excluding zero:

| stratum | `beta` |
|---|---|
| book positions removed | +0.01385 [+0.01287, +0.01483] |
| `T = 0` removed | +0.01493 [+0.01373, +0.01612] |
| first 40 plies only | +0.01174 [+0.01048, +0.01285] |
| opening | +0.00796 [+0.00642, +0.00955] |
| middlegame | +0.01608 [+0.01471, +0.01755] |
| endgame | +0.00857 [+0.00532, +0.01140] |
| winning | +0.01933 [+0.01688, +0.02153] |
| level | +0.01161 [+0.01024, +0.01314] |
| losing | +0.00907 [+0.00794, +0.01023] |
| fullest clock tercile | +0.00876 [+0.00743, +0.01015] |
| emptiest clock tercile | +0.01483 [+0.01297, +0.01678] |
| own previous think time added to the model | +0.01345 [+0.01245, +0.01435] |

### 2.3 The expertise metrics on FINAL

| Metric | expected | FINAL | meets its condition |
|---|---|---|---|
| A: matched-difficulty time /100 Elo | negative | -0.01069 [-0.01231, -0.00946] | yes |
| **B: time allocation efficiency** | positive | +0.00053 [-0.00034, +0.00151] | **no** |
| B: spread lowest->highest band (floor 0.02) | >= 0.02 | +0.00441 [-0.01256, +0.02334] | **no** |
| B: matched sample | positive | -0.00322 [-0.00624, +0.00053] | **no, sign reversed** |
| B: per player | positive | +0.00003 [-0.00089, +0.00091] | **no** |
| B: top band dropped | positive | +0.00082 [-0.00036, +0.00219] | **no** |
| B: band Spearman (bar 0.6) | >= 0.6 | 0.72 | yes |
| C: allocation loss (descriptive) | negative | -0.00214 [-0.00316, -0.00123] | -- |
| D: extreme unexpected-time exposure | negative | +0.00006 [-0.00067, +0.00052] | **no** |
| rating -> quality | negative | -0.00243 [-0.00261, -0.00226] | -- |

Conditions of the strongest verdict that failed: `h2_includes_tae`, `h2_tae_matched`, `h2_tae_no_zero_time`, `h2_tae_low_clock_pressure`, `h2_tae_spread`, `h2_player_level`, `player_disjoint_holds`.

### 2.4 Controls on FINAL

| Control | FINAL | null SDs from 0 | passes |
|---|---|---|---|
| C1 quality permuted | +0.000311 [-0.000557, +0.001275] | 0.64 | yes |
| C2 time permuted | -0.000258 [-0.000846, +0.000371] | 0.88 | yes |
| C3 rating permuted -> B | -0.000020 [-0.001060, +0.001064] | 0.04 | yes |
| **C3 rating permuted -> A** | -0.001145 [-0.001987, -0.000368] | 2.51 | **NO** |
| C3 -> D | -0.000123 [-0.000435, +0.000139] | 0.84 | yes |
| C3 -> C | -0.000356 [-0.000823, +0.000042] | 1.52 | yes |
| C4 VoC permuted | -0.000039 [-0.000940, +0.000807] | 0.08 | yes |
| C4 raw column (reported, not the condition) | -0.000806 [-0.001546, -0.000112] | 2.10 | **NO** |
| C7 nothing planted -> beta | +0.000039 [-0.000790, +0.000716] | 0.10 | yes |
| C7 -> B | -0.000076 [-0.001067, +0.000701] | 0.14 | yes |
| C7 -> A | -0.000097 [-0.000820, +0.000698] | 0.21 | yes |
| C7 -> D | -0.000155 [-0.000410, +0.000153] | 0.97 | yes |
| C5 implementation check (unplanted + 0.02) | +0.03342 [+0.03243, +0.03431] | -- | recovered |
| C5b recovers a foreign signal (floor 0.5) | 0.974 | -- | yes |
| C6 planted gradient, pooled (planted 0.00278) | +0.00294 [+0.00215, +0.00391] | -- | recovered |
| C6 through condition 6's own estimator | +0.00284 [+0.00181, +0.00391] | -- | recovered |
| C8 drop busiest 1% of players | +0.01350 [+0.01253, +0.01449] | -- | 0.57% change |
| C8 largest single-player influence | 0.52% | -- | limit 20% |

### 2.5 How much could be unmeasured difficulty

* **C7b**, a latent factor calibrated to the measured engine-difficulty block, manufactures
  `beta` = +0.000489 [-0.000224, +0.001352] when the truth is zero. The observed `beta` is
  27 times it -- which is an exchange rate, not a factor count.
* **The nuisance ladder**: 0.01393 (context only) ->
  0.01361 (+ the whole engine-difficulty block) ->
  0.01342 (+ value of computation).
* **C9**: `r_beta` = +1.015 [+0.953, +1.075] at 2.5x the engine budget.

### 2.6 The secondary time control

`300+0`, same FINAL month, frozen pipeline, nothing retuned: 46,647 decisions,
1,336 players, 6 of 9 bands adequately powered.
`beta` = +0.01137 [+0.01113, +0.01160]; Metric B = +0.00097 [-0.00426, +0.00607];
Metric A = +0.09946 [+0.09435, +0.10525].

**Metric A on the secondary control is not interpretable and we are flagging it rather than
reporting it.** The frozen models were fitted on `180+0`, where the clock never exceeds 180,000
ms; on `300+0` it starts at 300,000, outside every spline knot, and the basis extrapolates
linearly. `beta` survives because it is a slope of one residual on another; a level effect on the
clock scale does not. Whether the secondary control can say anything at all about Metric A is a
question for you.

---

## 3. What we are asking

The pipeline emitted a verdict. Try to prove that verdict is not scientifically justified.

First, rule on the C3 failure: **fatal defect, repairable implementation error, or a real
failure the verdict should stand on.** If repairable, say exactly what repair is permitted and
whether the repaired run may be reported as B3 or must become B3.1.

Then, assuming a valid run: attack `beta`. Search for alternative explanations compatible with
the frozen data -- hidden dependence on rating as a proxy for the position distribution,
survivorship, selection, model misspecification, outcome-definition artefacts, failures of
invariance -- and in particular whether Time Allocation Efficiency's **null** is mathematically
induced by how VoC was constructed rather than being a fact about players.

Distinguish: fatal defect, interpretation downgrade, legitimate caveat. Do not redesign or
re-run the primary experiment. New ideas go under `NEXT_EXPERIMENT`, not into B3.
