# FABLE GATE 2 -- pre-holdout seal audit: evidence packet

**State of the experiment.** DEVELOPMENT and VALIDATION are scored and analysed. The FINAL
period has **never been read**: `data/final/` does not exist, no byte of the 2026-06 dump has
been streamed, and `src/run.py` refuses to touch it until `results/FINAL_HOLDOUT_SEALED.json`
exists, which is written only if this gate returns PASS.

**Prepared by:** Opus 5. **Reviewed at Gate 1 three times** (R1-R13, N1-N9, M1-M5), all applied.

---

## 1. The corpus

| | DEVELOPMENT (2026-02-01) | VALIDATION (2026-04-01) |
|---|---|---|
| decisions | 85,139 | 74,450 |
| players | 2,428 | 2,142 |
| games | 2,541 | 2,216 |
| mean quality loss | 0.0488 | 0.0500 |
| median seconds | 2 | 2 |
| accurate rate | 0.564 | 0.560 |
| VoC censoring | 10.2% | 10.0% |
| T = 0 share | 10.0% | 9.7% |
| book share | 5.5% | 5.5% |
| adequately powered bands | 9/9 | 9/9 |

Both periods clear every adequacy threshold in all nine bands. VoC censoring is 10.2% and
10.1%, under the 15% gate that would have sent the design back to Gate 1.

## 2. Every number the verdict will read, on the two open periods

| Quantity | DEVELOPMENT | VALIDATION |
|---|---|---|
| H1 beta | +0.01270 [+0.01182, +0.01367] | +0.01412 [+0.01308, +0.01511] |
| beta x rating /100 Elo | -0.00049 [-0.00067, -0.00027] | -0.00037 [-0.00057, -0.00016] |
| Metric A: time vs rating | -0.01051 [-0.01175, -0.00923] | -0.01106 [-0.01245, -0.00983] |
| Metric B: TAE gradient | +0.00056 [-0.00040, +0.00149] | +0.00075 [-0.00025, +0.00192] |
| Metric B: TAE spread low->high | +0.00175 [-0.02391, +0.02252] | +0.01199 [-0.01481, +0.03855] |
| Metric C: allocation loss | -0.00251 [-0.00316, -0.00189] | -0.00168 [-0.00241, -0.00103] |
| Metric D: extreme UT | -0.00009 [-0.00050, +0.00032] | +0.00017 [-0.00027, +0.00059] |
| rating -> quality | -0.00251 [-0.00266, -0.00237] | -0.00249 [-0.00268, -0.00234] |
| beta band sign agreement | 1.000 | 1.000 |
| beta band Spearman | -0.933 | -0.650 |
| TAE band Spearman | 0.317 | 0.467 |
| Q1 - Q0 held-out R2 | 0.00891 | 0.01034 |
| matched beta | +0.01561 [+0.01356, +0.01761] | +0.01962 [+0.01724, +0.02194] |
| matched TAE gradient | -0.00289 [-0.00615, +0.00062] | -0.00428 [-0.00812, -0.00026] |
| player-level TAE vs rating | +0.00076 [-0.00021, +0.00167] | +0.00066 [-0.00044, +0.00167] |

**What this says, and it is not the hypothesis this study set out to support.** H1 holds on
both periods, well above its floor, positive in all nine bands, and larger in the matched
sample. Metric B -- the metric `VERDICT_RULES.md` §2.5.5 makes a *required* component of the
strongest verdict -- is null on both, by five independent readings: the pooled gradient, the
band spread, the band Spearman, the matched sample (where it changes sign) and the
player-level regression. Metric A holds. Metric D is null. Metric C is significant and
correctly signed and cannot count, being a transform of Metric B.

On the frozen rules, that is `GENERAL_REGULARITY_ONLY` unless FINAL says something the two
open periods do not. **We are asking you to seal a holdout that we expect to disappoint us.**

## 3. Controls, on both periods

| Control | DEVELOPMENT | VALIDATION | passes |
|---|---|---|---|
| C1_shuffled_quality.beta | -0.00000 [-0.00074, +0.00090] | -0.00041 [-0.00146, +0.00059] | yes |
| C2_shuffled_time.beta | -0.00000 [-0.00061, +0.00051] | -0.00023 [-0.00080, +0.00037] | yes |
| C3_shuffled_rating.tae_rating_gradient | -0.00002 [-0.00091, +0.00115] | +0.00000 [-0.00101, +0.00104] | yes |
| C3_shuffled_rating.metric_a_time_vs_rating | +0.00006 [-0.00067, +0.00090] | -0.00010 [-0.00089, +0.00082] | yes |
| C3_shuffled_rating.extreme_ut_vs_rating | -0.00001 [-0.00026, +0.00020] | +0.00003 [-0.00022, +0.00028] | yes |
| C4_shuffled_voc.tae_rating_gradient | +0.00005 [-0.00075, +0.00094] | +0.00001 [-0.00094, +0.00096] | yes |
| C7_no_effect_synthetic.beta | +0.00009 [-0.00066, +0.00083] | +0.00002 [-0.00067, +0.00092] | yes |
| C7_no_effect_synthetic.tae_rating_gradient | +0.00003 [-0.00079, +0.00082] | -0.00007 [-0.00094, +0.00068] | yes |
| C7_no_effect_synthetic.metric_a_time_vs_rating | +0.00010 [-0.00073, +0.00112] | +0.00005 [-0.00088, +0.00113] | yes |
| C5_planted_regularity.beta (must recover) | +0.03270 [+0.03182, +0.03367] | +0.03412 [+0.03308, +0.03511] | yes |
| C6_planted_expertise.tae_rating_gradient (must recover) | +0.00301 [+0.00208, +0.00388] | +0.00294 [+0.00204, +0.00387] | yes |
| C5b recovered fraction (floor 0.5) | 0.940 | 0.974 | yes |
| C8 relative change (limit 0.25) | 0.0014 | 0.0105 | yes |
| C8 max single-player shift (limit 0.20) | 0.0055 | 0.0087 | yes |
| **C7b: beta an unmeasured difficulty factor manufactures** | +0.00076 [+0.00010, +0.00140] | +0.00069 [-0.00013, +0.00179] | reported |

## 4. C9 -- the engine budget

5,000 VALIDATION decisions re-scored at 150,000 nodes, 2.5x the primary budget, with every
nuisance model refitted per budget on the frozen recipe.

* `beta`(60k) = +0.01608, `beta`(150k) = +0.01631
* **`r_beta` = +1.01459 [+0.95284, +1.07528]** -- the trigger is an upper bound below 0.5; the realised interval
  excludes attenuation greater than 4.7%.
* `r_tae` = -0.47940 [-15.55332, +11.89739], descriptive and uninformative as the design said it would be.

The Gate 1 re-review computed that at n = 5,000 this control could only detect attenuation of
roughly two-thirds or more, and required the report to say so. It turned out sharper than that:
the two budgets' estimates are highly correlated on the same decisions, so the ratio's interval
is tight. That is a stronger statement than the design was entitled to expect, and it is
reported as a measured interval rather than as a passed test.

## 5. The seal

| Evidence | Value |
|---|---|
| `data/` contains | development, validation, validation_150k, validation_60k |
| leakage tests | passed (12 passed in 2.28s) |
| same-budget re-score of 250 development decisions | 0 field mismatches in 15 compared fields |
| frozen at | 2026-09-01T22:28:23Z commit 3b5fd72e93d9 |
| documents amended since | MODEL_SPEC.md only (section 9) |
| the seal mechanism | `src/run.py` raises `SystemExit` on `data/final/` unless `results/FINAL_HOLDOUT_SEALED.json` says `sealed: true` |

## 6. What we changed after the freeze, and why you should be suspicious of it

`results/POST_FREEZE_AMENDMENTS.md` is the document this gate exists to audit. Five controls
failed on VALIDATION; we diagnosed them as defective controls rather than a defective result;
we repaired them; they now pass. That is the sentence a study tells itself on the way to the
result it wanted, and we are handing you the diagnosis to check rather than the conclusion.

The four amendments, in one line each:

1. A destructive control ran **one** permutation with a *bootstrap* interval around it. It now runs 200 and reports the interval **across** permutations. Strictly harder to pass.
2. C4 permuted the raw `voc_z` column, leaving the frozen fit's deterministic part in place; it now permutes `voc_resid`, the regressor the estimator uses. Both are reported.
3. C7 generated time from T1P while residualising against T2R, so its 'null' data was not null. It now generates from T2P and Q0, and every statistic returns zero.
4. C7b added: the mis-specified C7 was measuring the size of alternative explanation A2, so it became a calibrated diagnostic instead of a failing control.

**The estimator was ruled out first**, because that was the answer that would have mattered:
`beta` re-estimated as a three-parameter partial regression of raw quality on
`[unexpected_time, Qhat0, UThat]` -- immune to the objection that a frozen ridge residualisation
is not a projection -- agrees with the shipped estimator to five decimal places.

Nothing changed about the primary estimand, the outcome, any exclusion, any band, any threshold,
the sample, the engine, or the model family. `evaluate.py` reads the same fields it read before.

## 7. What we are asking

Assume we desperately want the hypothesis to be true. Find any way FINAL has already
influenced this analysis, directly or indirectly. Audit the post-freeze amendments hardest:
decide whether each is a repair or a rescue. And assess whether the verdict rules could still
produce `EXPERTISE_ADAPTATION_SUPPORTED` on a scientifically weak result.

Return `PASS` or `FAIL`. `PASS_WITH_CHANGES` only if the change can be made without observing
FINAL.
