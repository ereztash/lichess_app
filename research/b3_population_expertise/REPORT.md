# B3 -- Population Expertise x Decision Dynamics

**Run label:** *B3, C3 null construction repaired after the holdout (amendment A7).*

```
MECHANICAL VERDICT, AS THE CODE SHIPPED:  INVALID_EXPERIMENT
VERDICT AFTER THE PINNED C3 REPAIR:       GENERAL_REGULARITY_ONLY
SCIENTIFIC LEVEL:                         3 after the repair; none as shipped
SECONDARY TIME CONTROL:                   not evaluable (see section 9)
```

Both verdicts are the output of `evaluate.py`, run unmodified, on the same estimates. The only difference between them is the construction of one destructive control's null, which the Gate 3 adversary derived analytically, predicted to Monte-Carlo precision on all three periods, and repaired in one line. The repair changed no estimate, and the seven failed conditions of the strongest verdict are identical before and after it. Section 2 is that story in full; nothing in this report rests on the reader taking it on trust.

**What the repaired verdict label means.** `GENERAL_REGULARITY_ONLY`: H1 holds on FINAL (`beta` > 0, interval excluding 0, above `BETA_FLOOR`) and the conditions of `VERDICT_RULES.md` §2.5 were not all met. It asserts nothing about whether the time / value-of-computation relation varies with rating. The sentence in §3.1 defines what `EXPERTISE_ADAPTATION_SUPPORTED` would have meant; that verdict was not reached, and the mechanical verdict as shipped is `INVALID_EXPERIMENT`.

---

## 1. The one-paragraph answer

Across 81,624 natural blitz decisions by 2,331 independent players rated 801-2595, a decision that took unusually long **for that position, that clock state and that skill level** predicts a worse move: `beta` = +0.01342 [+0.01243, +0.01431] of win probability per unit of `log(1 + seconds)`. It holds in 9 of 9 adequately powered rating bands, in every stratum of phase, standing and clock pressure, within a single player's own decisions and within a single game, and it is reproduced out of sample in the two later months (three periods in all, the first being the period every nuisance model was fitted on). Its interpretation is narrower than it looks: about three quarters of it is carried by outright blunders, and about a seventh of it is present even on the decisions where the player found the engine's own move. Section 4 is that decomposition.

The expertise claim the study was built to test was not supported. Time Allocation Efficiency -- whether stronger players put their extra seconds where further calculation changes the preferred move -- shows a rating gradient of +0.00053 [-0.00034, +0.00151] per 100 Elo, an interval on zero. **That is a null of the preregistered instrument, and this report does not read it as a fact about players.** The instrument has a 59.4% point mass at zero, a partial correlation with residual thinking time of 0.017, no detectable response to the clock, and a construction under which a live positive gradient would have produced this same reading. Section 5 is that analysis, and it is the most important section in the report.

---

## 2. The control that failed, and why the verdict was recomputed

A study that repairs a control after seeing the holdout owes the reader the whole derivation, not a summary. This is it.

**What the shipped control computed.** C3 permutes each player's rating across players and asks whether the rating-dependent metrics survive. It formed the permuted regressor as `perm_rating - ratinghat`, where `ratinghat` is the DEVELOPMENT-frozen ridge prediction of rating from the difficulty features.

**Why that carries a deterministic term.** With `cov` and `var` over rows, `slope(y, perm - h) = [cov(y, perm) - cov(y, h)] / var(perm - h)`. A uniform permutation of player ratings gives `E[perm_i] = R_bar` for every row, so `E[cov(y, perm)] = 0` and `E[cov(perm, h)] = 0` exactly. What survives in expectation is not zero:

```
E[C3 -> Metric A]  ~=  -100 x cov(y_resid, ratinghat) / [ var(rating) + var(ratinghat) ]
```
`cov(y_resid, ratinghat)` vanishes only where the residual is orthogonal to the feature column space -- that is, on the period the model was fitted on. On any later period the frozen fit's misfit has a component along `ratinghat`, and the null inherits it.

**The prediction, against the shipped numbers.** Deterministic seeds, 200 permutations:

| period | shipped null | predicted by the formula | MC SE | `cov(ratinghat, rating_resid)` |
|---|---|---|---|---|
| DEVELOPMENT | +0.000025 (sd 0.000439) | -0.000001 | 0.000031 | +130 |
| VALIDATION | -0.000157 (sd 0.000491) | -0.000138 | 0.000035 | -1,403 |
| **FINAL** | **-0.001145** (sd 0.000457, 2.51 null SDs) | **-0.001094** | 0.000032 | **-5,311** |

The last column is the freeze made visible. On DEVELOPMENT the frozen partial of rating is orthogonal to its own residual; four months later it is not.

**The repair, in full.** One line: "one construction, no variants", "pinned by the adversary, not chosen by the researchers" (Gate 3 §1.6, §1.9), applied to all three slope-based C3 fields whether or not each had failed:

```python
# controls.py, C3 block
perm_resid = perm_rating          # was: perm_rating - ratinghat
```
`slope()` centres, so each frozen residual is now regressed on the permuted rating minus its mean: the partial of `perm_rating` under the null, where `ratinghat(x)` is the partial of the *real* rating, not of the permuted one. It is the same principle as the pre-holdout C4 repair. Every block of the analysis outside C3 is byte-identical before and after (sha256 `d2794b406182e5d7...`), the shipped C3 block is retained beside the repaired one, and `evaluate.py` was run unmodified on both.

**The diff.**

| FINAL null | as shipped | repaired |
|---|---|---|
| C3 -> Metric A | -0.001145 [-0.001987, -0.000368] | -0.000036 [-0.001069, +0.000927] |
| C3 -> Metric D | -0.000123 [-0.000435, +0.000139] | -0.000011 [-0.000396, +0.000319] |
| C3 -> Metric C | -0.000356 [-0.000823, +0.000042] | -0.000008 [-0.000597, +0.000496] |
| C3 -> Metric B (untouched) | -0.000020 [-0.001060, +0.001064] | -0.000020 [-0.001060, +0.001064] |

**What the repair is not.** It does not touch `beta`, which C3 never tested. It does not serve the expertise hypothesis, which fails identically before and after -- the same seven conditions, the same intervals. It is not a choice among variants: the construction was pinned in the review, in advance, with the results of applying it stated there. And the corrected estimate is *not* substituted for the reported one: Metric A's verdict value remains the frozen one.

**The corrected explanation.** The Gate 3 packet attributed the offset to permuting over players rather than over rows. That was wrong and is withdrawn here. The mechanism is the **denominator**: the packet's diagnostic quantity divides by `var(ratinghat)` where the null divides by `var(rating) + var(ratinghat)`, and the ratio 61,676 / 298,552 = 0.207 on FINAL is the discrepancy the packet could not explain. The same dilution explains the raw-column C4 null; one mechanism, two controls.

**The drift is in the controls, not in the estimates.** Each headline quantity under three estimators on FINAL -- the frozen one this study reports, a three-parameter regression that lets the frozen predictions carry their own coefficients, and the whole recipe refitted on FINAL itself:

| quantity | frozen (reported) | three-parameter | refit on FINAL |
|---|---|---|---|
| `beta` | +0.01342 | +0.01346 | +0.01340 |
| Metric A | -0.01069 | -0.01056 | -0.01045 |
| Metric B gradient | +0.00053 | -- | +0.00047 |

The estimator shares the null's ingredient and cancels it, because its regressor is `rating - ratinghat` with the two correlated; the null's `perm_rating` is uncorrelated with `ratinghat` and nothing cancels. That is why the control moved 2.5 null SDs while the estimate it guards moved about 2%.

**The miss this report is required to record**, in the reviewer's own words:

> The class was characterised before the holdout was opened: the Gate 2 review derived C1's null as `-slope(Qhat0, ut_resid)`, called it 'the fingerprint of the freeze', and stated that the amended rule 'can only fail when the estimator's bias under the null exceeds about two null SDs'. C3's Metric A null on FINAL is that prediction realised at 2.5. That the same reviewer -- me -- endorsed the C3 construction in the same document without applying the derivation to it is a miss the report must record, not a reason to fail the study for it.

---

## 3. Dataset

| | DEVELOPMENT 2026-02-01 | VALIDATION 2026-04-01 | **FINAL 2026-06-01** |
|---|---|---|---|
| decisions | 85,139 | 74,450 | 81,624 |
| players | 2,428 | 2,142 | 2,331 |
| games | 2,541 | 2,216 | 2,447 |
| mean quality loss | 0.0488 | 0.0500 | 0.0501 |
| median seconds | 2 | 2 | 2 |
| accurate rate | 0.564 | 0.560 | 0.558 |
| VoC censoring | 10.2% | 10.0% | 10.3% |
| `T = 0` share | 10.0% | 9.7% | 9.7% |
| adequately powered bands | 9/9 | 9/9 | 9/9 |

Rated Standard `180+0` on lichess.org, one analysed side per game, at most two games per player, rating at game time, three non-overlapping calendar days. Every exclusion is counted in `results/tables/04_exclusions.csv`; the FINAL period was sealed before it was opened and the seal is in `results/FINAL_HOLDOUT_SEALED.json`.

---

## 4. The main regularity, and what carries it

| | DEVELOPMENT | VALIDATION | **FINAL** |
|---|---|---|---|
| `beta` | +0.01270 [+0.01182, +0.01367] | +0.01412 [+0.01308, +0.01511] | **+0.01342 [+0.01243, +0.01431]** |
| band sign agreement | 100% | 100% | 100% |
| `beta` x rating, per 100 Elo | -0.00049 [-0.00067, -0.00027] | -0.00037 [-0.00057, -0.00016] | -0.00022 [-0.00043, -0.00002] |
| recomputed inside coarsened cells | +0.01561 [+0.01356, +0.01761] | +0.01962 [+0.01724, +0.02194] | +0.01683 [+0.01476, +0.01870] |
| top band dropped | +0.01300 [+0.01200, +0.01421] | +0.01471 [+0.01358, +0.01579] | +0.01383 [+0.01277, +0.01483] |
| Q1 - Q0 held-out R2 | 0.00891 | 0.01034 | 0.00929 |

### 4.1 Where the regularity lives

Centring both residuals **within a player**, `beta` is +0.01363; **within a game**, +0.01359; the slope of player means against each other -- the purely between-player part -- is +0.00979 (point estimates; no interval was computed for the within-player and within-game forms). The association is inside a single player's own decisions, so "slower players are weaker players" does not account for it.

### 4.2 It is a blunder regularity

The outcome is unbounded above at the top of the loss scale, and that is where the association is concentrated. `beta` with the outcome capped, regressed on the same frozen time residual:

| outcome capped at | DEVELOPMENT | VALIDATION | **FINAL** |
|---|---|---|---|
| 0.05 | +0.00296 | +0.00311 | **+0.00307** |
| 0.1 | +0.00579 | +0.00621 | **+0.00597** |
| 0.2 | +0.00915 | +0.01018 | **+0.00941** |
| 0.5 | +0.01217 | +0.01388 | **+0.01272** |
| uncapped | +0.01270 | +0.01412 | **+0.01342** |

Losses above 0.05 -- about twice the accuracy threshold -- carry roughly three quarters of `beta`, and losses above 0.1, which are 13.5% of decisions, carry about half. The two extreme deciles of unexpected time supply 67% of the numerator. **The licensed sentence is that unusually long thinks predict blunders**, not that they predict a uniformly worse move; the mean is a mean over a tail.

### 4.3 A seventh of it is present when the engine's own move was played

On the 35.6% of decisions where the played move is the pre-move search's first line, `beta` is +0.00193 [+0.00119, +0.00272]; on the rest, +0.01330 [+0.01204, +0.01453]. When the played move *is* the engine's best, the measured loss is depth asymmetry between two searches and carries nothing about the human's choice, so a positive slope there is engine noise that grows with residual position sharpness. It is unmeasured, engine-measurable difficulty seen directly, in the one place the design can see it. The rate of finding the engine's move falls from 0.43 in the fastest decile of unexpected time to 0.28 in the slowest; holding that indicator fixed, `beta` is +0.00937. This is a diagnostic on a post-move variable and cannot enter the primary specification.

### 4.4 The variation across standings is the outcome's scale, not behaviour

| standing | `beta` | sd of the quality residual | ratio |
|---|---|---|---|
| winning | +0.01933 | 0.106 | 0.18 |
| level | +0.01161 | 0.062 | 0.19 |
| losing | +0.00907 | 0.043 | 0.21 |

`quality_loss` is bounded by the win probability before the move, so a unit of win probability is not one unit across standings. "The association is strongest when winning" is a statement about the scale, and this report does not make it as a behavioural claim.

**Practical magnitude.** Mean quality loss on FINAL is 0.0501 win probability. A decision whose `1 + seconds` is e times what the model expects -- about 4.4 seconds where it expected 1 -- is associated with 0.0134 more, about 27% of a typical error, concentrated as 4.2 describes. It is an adjusted association in an observational sample.

---

## 5. The expertise results

| Metric | expected | DEVELOPMENT | VALIDATION | **FINAL** | counts? |
|---|---|---|---|---|---|
| A: matched-difficulty time, per 100 Elo | negative | -0.01051 [-0.01175, -0.00923] | -0.01106 [-0.01245, -0.00983] | -0.01069 [-0.01231, -0.00946] | yes, directional only |
| **B: time allocation efficiency** | positive | +0.00056 [-0.00040, +0.00149] | +0.00075 [-0.00025, +0.00192] | +0.00053 [-0.00034, +0.00151] | **required** |
| C: allocation loss | negative | -0.00251 [-0.00316, -0.00189] | -0.00168 [-0.00241, -0.00103] | -0.00214 [-0.00316, -0.00123] | no, a transform of B |
| D: extreme unexpected-time exposure | negative | -0.00009 [-0.00050, +0.00032] | +0.00017 [-0.00027, +0.00059] | +0.00006 [-0.00067, +0.00052] | yes |
| B: spread, lowest to highest band | >= 0.02 | +0.00175 [-0.02391, +0.02252] | +0.01199 [-0.01481, +0.03855] | +0.00441 [-0.01256, +0.02334] | required |
| B: inside coarsened cells | positive | -0.00289 [-0.00615, +0.00062] | -0.00428 [-0.00812, -0.00026] | -0.00322 [-0.00624, +0.00053] | required |
| B: per player | positive | +0.00076 [-0.00021, +0.00167] | +0.00066 [-0.00044, +0.00167] | +0.00003 [-0.00089, +0.00091] | required |
| B: top band dropped | positive | +0.00067 [-0.00058, +0.00192] | +0.00068 [-0.00039, +0.00186] | +0.00082 [-0.00036, +0.00219] | reported |

### 5.1 Metric A holds, with its own qualification

Stronger players take less time on positions matched for measured difficulty: -0.01069 [-0.01231, -0.00946] log-seconds per 100 Elo. Two qualifications travel with it. First, 9.7% of FINAL decisions have `T = 0` -- under a second on a whole-second clock, which includes premoves, decided on the previous position, in a share the dump does not record -- and that share rises from 5.6% in the lowest band to 14.6% in the highest. Remove those rows and Metric A is -0.00630: two fifths of the metric rests on them. Second, Metric A is a directional check only; it was never a sufficient condition for anything, and it is not evidence about allocation.

### 5.2 Metric B: what the instrument is

This is the primary metric and it returned a null. Before reading the null, the instrument has to be described, because its properties determine what a null can mean.

* **A point mass.** `voc_regret` is exactly zero on 59.4% of decisions: the engine's shallow first choice is also its deep first choice, so there is nothing to gain from further calculation, by construction. On those rows the standardised value is the constant -0.427, the frozen residual has standard deviation 0.363 against 1.213 elsewhere, and they still supply 18.1% of the regressor's sum of squares.
* **A weak base relation.** The pooled slope of residual thinking time on value of computation is +0.0106 [+0.0051, +0.0159] log-seconds per DEVELOPMENT standard deviation -- a partial correlation of 0.0165. The slope on the bare indicator `regret > 0` is +0.0090 and on `voc_switch` +0.0075: to within noise, the whole signal is "the engine changed its mind between the shallow and the deep search, and the human spent about one percent longer".
* **Its response to the resource is undetectable.** An allocation instrument should react to how much clock is left. On FINAL the pooled relation by clock tercile is +0.0107 [+0.0016, +0.0205] (fullest), +0.0108 [+0.0025, +0.0193] (middle), +0.0105 [+0.0036, +0.0180] (emptiest): not detectably different, but each interval is wide enough to hide a doubling, and the point ordering differs by period -- DEVELOPMENT (+0.0007, +0.0108, +0.0115); VALIDATION (+0.0120, +0.0085, +0.0080), against fullest, middle, emptiest. The design cannot tell whether the instrument responds to the clock.
* **Reliability.** Across engine budgets on the C9 subset, the residual instrument correlates 0.62 and raw regret 0.64. Its validity against anything a human perceives is unmeasured; no such measurement exists in this design.

A null from an instrument with these properties is a null of the instrument. It is not a measurement of what players do.

### 5.3 The gradient is a cancellation of two opposite components

On a zero-regret row the standardised value is a constant, so the preregistered regressor is exactly *minus the position-predicted* value of computation. On 59% of rows, therefore, Metric B is reading a different quantity with its sign flipped -- and that quantity carries a large, replicated rating-dependent structure.

| gradient per 100 Elo | DEVELOPMENT | VALIDATION | **FINAL** |
|---|---|---|---|
| residual time on **predicted** VoC x rating, all rows | +0.00982 [+0.00743, +0.01218] | +0.00806 [+0.00564, +0.01070] | +0.00677 [+0.00390, +0.00931] |
| Metric B gradient, zero-regret rows | -0.00924 [-0.01242, -0.00620] | -0.00978 [-0.01294, -0.00666] | -0.00817 [-0.01122, -0.00489] |
| residual time on **minus predicted** VoC x rating, zero-regret rows | -0.00924 (point identity) | -0.00978 (point identity) | -0.00817 (point identity) |
| Metric B gradient, rows where the regressor varies | +0.00007 [-0.00104, +0.00123] | +0.00154 [+0.00026, +0.00291] | +0.00063 [-0.00046, +0.00178] |
| Metric B gradient, all rows (**the preregistered estimand**) | +0.00056 [-0.00040, +0.00149] | +0.00075 [-0.00025, +0.00192] | +0.00053 [-0.00034, +0.00151] |
| residual time on **raw** VoC x rating | +0.00181 [+0.00086, +0.00268] | +0.00177 [+0.00083, +0.00289] | +0.00136 [+0.00059, +0.00228] |

The second and third rows are equal to the digit, which is the algebra: on those rows the preregistered regressor *is* minus the predicted value, so the metric reads that channel backwards. The first row is the same channel measured over all rows. The preregistered estimand is a mixture of a large replicated negative component that says nothing about how a player responds to residual value of computation -- there is no residual value of computation on those rows -- and a small positive component on the rows where the regressor actually varies.

**Two things follow, and only two.** First, the composite could not have shown the rows-with-variation gradient whatever it was, so the null does not license a claim about players. Second, the positive first row is **not** support for the hypothesis: it is not a preregistered estimand, and it is confounded by construction -- a player who merely *recognises* that a position is sharp produces it exactly as a player who *allocates* better does, and predicted value of computation loads on clock and phase features whose handling may itself vary with rating. It is recorded as the lead for the next experiment and as nothing else.

### 5.4 The floor, and the spread the design could actually detect

`TAE_FLOOR = 0.02` was fixed at Gate 1 as a fraction of the gradient the planted-signal control injects, before any data existed. The instrument's entire pooled signal is 0.0106, so the spread condition asked the top band to exceed the bottom by about twice everything the instrument measures. The FINAL gradient's bootstrap standard error is 0.00047 per 100 Elo, which puts the smallest spread detectable at 80% power at 0.024 -- above the floor itself. The observed spread is +0.0044 [-0.0126, +0.0233].

The spread condition was therefore unreachable by any plausible real gradient. **Its failure is a fact about the design, and this report does not present it as a finding about players.**

### 5.5 The matched form of the condition was structurally negative

Coarsened exact matching retains 32% of decisions, and its cells include the value-of-computation tercile -- so it selects the point mass. The matched sample is 70.2% zero-regret against 59.4% overall, 39% opening against 28%, and 11.9% book against 5.5%. Inside it the zero rows give -0.00588 and the rows with variation +0.00309; the weights are not the cause (unweighted -0.00262, largest weight 2.55).

Balance between the extreme bands moved the **wrong way** on the variables that matter:

| variable | SMD before | SMD after |
|---|---|---|
| `voc_z` | +0.065 | +0.152 |
| `gap12` | +0.041 | +0.162 |
| `eval_volatility` | +0.174 | +0.284 |
| `ambiguity_entropy` | -0.071 | -0.142 |
| `clock_pressure` | +0.155 | +0.143 |
| `ply` | +0.315 | +0.180 |

So the matched clause of the strongest verdict could not have been met by any allocation behaviour, and the matched value of `beta` in section 4 is reported as "recomputed inside coarsened cells" rather than as a difficulty control. And the pooled, `T = 0`-removed, low-clock-pressure and player-level clauses are **one instrument read four ways on overlapping rows**, plus the degenerate matched form -- not five independent tests.

### 5.6 What the null does and does not license

**Licensed.** The preregistered Time Allocation Efficiency gradient is not detectably different from zero on FINAL, in any of its readings; the strongest verdict of H2 was not reached; and the instrument's construction, floor and power are such that a rating gradient of the size a real allocation difference would produce would also have returned this result.

**Not licensed.** That the gradient is absent in the world. That this is a negative finding about how strong players use their time. That the instrument had a fair chance and took it. That the un-preregistered positive gradients in 5.3 support the hypothesis. The repaired verdict label is correct because it asserts only that the conditions were not met.

---

## 6. Controls

Every destructive control is a permutation test over 200 draws; the interval is the 2.5/97.5 percentile **across permutations**, and each null's distance from zero is given in units of its own standard deviation.

| Control | FINAL | null SDs from 0 | passes |
|---|---|---|---|
| C1 quality permuted | +0.00031 [-0.00056, +0.00128] | 0.6 | yes |
| C2 thinking time permuted | -0.00026 [-0.00085, +0.00037] | 0.9 | yes |
| C3 rating permuted -> Metric B | -0.00002 [-0.00106, +0.00106] | 0.0 | yes |
| C3 -> Metric A (repaired) | -0.00004 [-0.00107, +0.00093] | 0.1 | yes |
| C3 -> Metric D (repaired) | -0.00001 [-0.00040, +0.00032] | 0.1 | yes |
| C4 value of computation permuted | -0.00004 [-0.00094, +0.00081] | 0.1 | yes |
| C7 nothing planted -> beta | +0.00004 [-0.00079, +0.00072] | 0.1 | yes |
| C7 -> Metric B | -0.00008 [-0.00107, +0.00070] | 0.1 | yes |
| C5 implementation check (unplanted + 0.02) | +0.03342 [+0.03243, +0.03431] | -- | recovered |
| C5b recovers a foreign signal (floor 0.5) | 0.974 | -- | yes |
| C6 planted gradient, pooled (planted 0.00278) | +0.00294 [+0.00215, +0.00391] | -- | recovered |
| C6 through the player-level estimator | +0.00284 [+0.00181, +0.00391] | -- | recovered |
| C8 drop the busiest 1% of players | +0.01350 [+0.01253, +0.01449] | -- | 0.57% change |
| C8 largest single-player influence | 0.52% | -- | limit 20% |

### 6.1 What a passing destructive control is evidence of

After the C3 repair, **every destructive null in this study is a code check**. With the outcome generated from the frozen prediction plus independent noise, or with the regressor the estimator uses permuted, zero is what linear algebra requires; these controls can fail only on a defect in the code that computes them. That they pass means the arithmetic is intact. It is not independent evidence that any estimate is causal, and this report does not read it as such. The controls that could still have failed for a scientific reason are C5b, C6, C8 and C9.

### 6.2 C6, precisely

C6 rebuilds thinking time with a rating gradient planted **in the instrument's own units**, at five to ten times the level the instrument actually measures, and requires the pipeline to recover it. It does: through the pooled estimator and through the per-player estimator the verdict reads. What that demonstrates is that the estimator's algebra works at that scale. It does not demonstrate that a realistic gradient would have been detected -- section 5.4 gives the size that would have been -- and because the signal is planted in the instrument's units it is silent on whether the instrument measures allocation at all.

### 6.3 The FINAL nulls' offsets from zero, as shipped

The frozen models were fitted in February and applied in June. Their misfit shows up in the C3 nulls as an offset from zero that grows from April to June (Metric A 0.32 -> 2.51 null SDs; Metric C 0.50 -> 1.52; Metric D 0.18 -> 0.84), and the "contains zero" pass rule tolerates it up to about two null standard deviations. The C1 and C2 offsets are of similar size on both periods (C1 -0.00044 in April, +0.00031 in June; C2 -0.00022, -0.00026). The raw-column C4 value is in the table for completeness but is not drift: it is -0.00115 (3.3 null SDs) on DEVELOPMENT itself, the deterministic recognition-channel term of section 5.3 diluted by the permutation variance. The C3 -> Metric B, pass-condition C4 and C7 nulls sit within 0.1 null SD of zero on FINAL. As shipped:

| control | FINAL null | offset (null SDs) |
|---|---|---|
| C1 (destroyed outcome, `beta`) | +0.00031 | 0.64 |
| C2 (destroyed time, `beta`) | -0.00026 | 0.88 |
| C3 -> Metric D | -0.00012 | 0.84 |
| C3 -> Metric C | -0.00036 | 1.52 |
| C4 raw column | -0.00081 | 2.10 |
| C3 -> Metric A | -0.00115 | 2.51 |

The passes recorded in this study are passes of **offset** nulls, not of centred ones. Two of the six exclude zero; the verdict-bearing one, C3 -> Metric A, is the one section 2 is about; the raw-column C4 is discussed below and is not a pass condition.

**The raw-column form of C4** -- permuting the raw value-of-computation column rather than the residual the estimator uses -- gives -0.00081 [-0.00155, -0.00011]. It is not the pass condition, because it leaves the frozen fit's deterministic part in place, and its magnitude is that part diluted by the permutation variance rather than the part itself. The deterministic part is the response of residual time to *predicted* value of computation interacted with rating; if that channel is to be described, the number to quote is the direct one in section 5.3 (+0.00677 [+0.00390, +0.00931] on FINAL), with both of its readings.

---

## 7. How much of this could be unmeasured difficulty

This is the study's central limitation, and it has three measurements rather than a paragraph. None of them addresses the form that matters most.

**C7b, a simulation.** An unobserved factor, independent of everything measured, added to both thinking time and move quality with strengths calibrated to a factor the study does measure -- the engine-difficulty block. It manufactures `beta` = +0.00049 [-0.00022, +0.00135] on FINAL when the true value is zero.

The observed `beta` is 27 times that. **That does not mean the alternative needs 27 unmeasured factors, and it does not mean one factor a few times the engine block would do.** The manufactured value is an exchange rate -- the factor's quality-per-time ratio times its share of residual time variance -- and scaling a factor up on both axes leaves that ratio unchanged. On FINAL the engine block's ratio is 0.0105 win probability per log-second, below `beta` = 0.0134, so a single factor with the block's own ratio cannot reproduce `beta` at any strength. What the alternative requires is a latent factor whose quality-per-time ratio is at least 1.3 times the engine block's -- and that only if it explained nearly all of the residual time variance (0.358) -- or, for example, 6.4 times the block's ratio while explaining a fifth of it. On DEVELOPMENT, where the block's ratio is higher, the same arithmetic gives one factor about 6.6 times the block on both axes (amendment A5(a)). A single dominant latent, *how hard this position actually was for this human*, is the natural form of the alternative, not many independent small ones. The anchor is weak by this study's own numbers: the measured engine-difficulty block explains about 3% of log-time variance, so multiples of it sound larger than they are.

**The nuisance ladder, a direct measurement.** `beta` under three nested adjustments, each fitted on DEVELOPMENT and frozen:

| nuisance set | FINAL `beta` |
|---|---|
| context only | 0.01393 |
| + the whole fourteen-feature engine-difficulty block | 0.01361 |
| + value of computation (the reported specification) | 0.01342 |

Two readings are admissible and this report does not choose between them: either `beta` is robust to measured difficulty, or a search at this depth captures so little of what makes a human slow **and** wrong that its failure to move `beta` says little about what would.

**C9, the engine budget.** 5,000 VALIDATION decisions re-scored at 150,000 nodes, 2.5 times the primary budget, every nuisance model refitted per budget: `beta`(60k) = 0.01608, `beta`(150k) = 0.01631, ratio +1.015 [+0.953, +1.075].

The lower bound 0.953 excludes attenuation greater than 4.7% for the re-measurement this budget change produced, and the preregistration's own reading applies: a C9 that does not fire is not evidence against unmeasured difficulty (`VERDICT_RULES.md` §2.5c); at n = 5,000 the trigger could only have fired for attenuation of roughly two-thirds or more.

What actually changed between the budgets, and what did not:

| quantity | agreement across budgets |
|---|---|
| median depth | 12 -> 14 |
| `quality_loss` | r = 0.96 |
| the quality residual | r = 0.96 |
| the time residual | r = 0.995 |
| `voc_regret` | r = 0.64 |
| `voc_rank` | r = 0.49 |
| the residual instrument | r = 0.62 |
| the engine's own best move | identical on 68% of decisions |

The value-of-computation features moved substantially between budgets; the outcome and the time residual barely moved at all. The ratio's interval is tight because the two estimates move **together** under player resampling, not because the design gained information about difficulty, and this report does not present it as a stronger statement than the design was entitled to expect.

**What may be concluded, and what may not.** The *engine-measurable* form of unmeasured difficulty is constrained by these three measurements. The *human-perceived* form -- a position that is hard for a person in a way a search at this depth does not register -- is exactly where the preregistration put it: **cannot be excluded**. Section 4.3 is the closest this design comes to seeing unmeasured difficulty at all, and what is visible there is its engine-measurable form -- evaluation instability the frozen features did not capture, tracked by residual time. The human-perceived form is touched by no measurement here.

---

## 8. Replication across periods

| | `beta` | Metric B gradient |
|---|---|---|
| DEVELOPMENT 2026-02 | +0.01270 [+0.01182, +0.01367] | +0.00056 [-0.00040, +0.00149] |
| VALIDATION 2026-04 | +0.01412 [+0.01308, +0.01511] | +0.00075 [-0.00025, +0.00192] |
| **FINAL 2026-06** | +0.01342 [+0.01243, +0.01431] | +0.00053 [-0.00034, +0.00151] |
| FINAL, players absent from the other two | +0.01330 [+0.01234, +0.01428] | +0.00041 [-0.00049, +0.00138] |

106 of 2,331 FINAL players also appear in an earlier period. Both the full and the restricted estimate are reported; neither was chosen after seeing them. The restricted Metric B readings -- pooled gradient, matched, `T = 0` removed, low clock pressure, spread -- are what fail the `player_disjoint_holds` condition, on the same instrument section 5 describes; the restricted `beta` passes.

---

## 9. The secondary time control: not evaluable

`300+0` was preregistered as a cross-context replication. **Through the frozen pipeline it supports nothing**, and the block is reported as a failure of the design, not as a result.

The frozen time models were fitted on `180+0` clocks and extrapolate badly to five minutes: about two thirds of `300+0` decisions sit outside the frozen knot range, the frozen prediction of log-time runs down to about -7.35 where log-time is non-negative by construction, and the residual standard deviation is roughly five times FINAL's. The consequence is decisive: the destroyed-outcome null on the secondary sits at about +0.0114 against the block's apparent `beta` of +0.01137 [+0.01113, +0.01160]. The number the block reports is, to three decimals, its own null. The slope of *raw* quality loss on the same frozen time residual is about -0.00005.

The explanation offered in the Gate 3 packet -- that `beta` survives at `300+0` because it is a slope of one residual on another while a level shift is not -- is **withdrawn**: the level shift on the clock scale enters both residuals and manufactures the slope. Metric A, Metric D and every band value in that block are artefacts of the same extrapolation. No destructive control was run on the secondary period, so the pipeline's own C1 -- which would have failed at roughly a hundred null standard deviations -- never had the chance to say so. That omission is recorded as a process failure.

Preregistered condition §2.6 is therefore **not evaluable** -- and it could not have applied in any case: §2.6 is reachable only from `EXPERTISE_ADAPTATION_SUPPORTED`, which neither verdict reached, so the secondary block's failure cost the study no verdict. No cross-context claim of any kind is made from this data.

As an **exploratory, non-preregistered** check, and labelled as such wherever it is quoted: with the nuisance models refitted on the secondary period itself, the Gate 3 adversary's reconstruction gives `beta` = +0.01245 [+0.01131, +0.01358] and Metric A = -0.01079 [-0.01273, -0.00886], against the primary's +0.01342 and -0.01069, and a refitted Metric B gradient of +0.00007 [-0.00132, +0.00153]. Restricting the frozen pipeline to in-range clocks gives `beta` +0.00836 [+0.00631, +0.01083]. These suggest the *signs* probably hold at five minutes with nuisance models fitted on the same data. That is not the test the preregistration defined, and it does not become one by being reported. The top of the rating range is unpowered there in any case (149, 128 and 61 players in the top three bands).

---

## 10. What failed

Recorded here rather than in an appendix, because a study that reports only what worked is not reporting.

* **Metric A (matched time)** -- met its conditions: -0.01069 [-0.01231, -0.00946], expected sign negative.
* **Metric B (time allocation efficiency)** -- did **not** meet its conditions: +0.00053 [-0.00034, +0.00151], expected sign positive, band Spearman +0.72 against a required +0.6 (expected direction positive).
* **Metric D (extreme ut exposure)** -- did **not** meet its conditions: +0.00006 [-0.00067, +0.00052], expected sign negative, band Spearman +0.20 against a required -0.6 (expected direction negative).

Conditions of the strongest verdict that were not met: `h2_includes_tae`, `h2_tae_matched`, `h2_tae_no_zero_time`, `h2_tae_low_clock_pressure`, `h2_tae_spread`, `h2_player_level`, `player_disjoint_holds`.

Five of those seven are the same instrument read on overlapping rows (section 5.5); the spread condition was unreachable by design (5.4); the matched condition was structurally negative (5.5). The study registered the expertise hypothesis as the interesting half and reports it as the half that was not supported -- and, on the evidence in section 5, as the half it was not equipped to test.

A second failure belongs here: the C3 null construction, which shipped with a deterministic term that the Gate 2 audit had already characterised in another control and did not apply to this one. It was caught by the Gate 3 adversary, after the holdout was open, in the period where it mattered.

A third: the secondary time control, designed and executed without a check that the frozen models were in range, and shipped without its own destructive controls.

---

## 11. The frozen models' misfit by band

Gate 1's sixth recommendation asked for this table so a reader can see the freeze's residual structure directly. Every slope in this report is centred inside the set being estimated, so none of these means enters a reported coefficient; they are printed because a reader is entitled to check that.

| band | n | mean time residual | mean rating residual (Elo) | mean quality residual |
|---|---|---|---|---|
| 800-999 | 7,554 | +0.083 | -597.8 | -0.0019 |
| 1000-1199 | 8,463 | +0.046 | -478.0 | -0.0001 |
| 1200-1399 | 9,650 | +0.017 | -350.9 | -0.0010 |
| 1400-1599 | 10,636 | +0.017 | -206.5 | +0.0026 |
| 1600-1799 | 10,382 | +0.007 | -57.9 | +0.0016 |
| 1800-1999 | 9,027 | -0.004 | +85.3 | +0.0002 |
| 2000-2199 | 8,591 | +0.004 | +244.7 | -0.0008 |
| 2200-2399 | 8,450 | -0.031 | +401.5 | +0.0009 |
| 2400-2599 | 8,871 | -0.054 | +581.4 | +0.0005 |

---

## 12. Limitations

1. **Observational.** Nothing here identifies a causal effect of thinking time on move quality. `beta` is an adjusted association.
2. **Unmeasured difficulty.** Constrained in its engine-measurable form; not excluded in its human-perceived form. Section 7.
3. **The primary instrument does not measure what its name says.** Time Allocation Efficiency is built on an engine-derived value of computation with a large point mass, a 1.7% partial correlation with residual time, no detectable response to the clock, and no validation against human perception. Section 5.2.
4. **Allocation versus recognition.** No metric here separates a better allocation policy from better recognition of which positions deserve computation. This matters most for reading the null: whichever of the two would have produced a gradient, the composite estimand could not have shown it.
5. **Whole-second clocks.** The dumps write clocks to the second, so `T = 0` means "under a second" and covers 10% of decisions, unevenly across bands. Control C17 repeats everything without them and section 5.1 gives Metric A both ways.
6. **One engine, one budget, median depth about 12.** C9 varies the budget by 2.5x and finds the outcome and the time residual almost unchanged, which is a weak test.
7. **One calendar day per period** -- a complete diurnal cycle, but one day's player mix.
8. **The win-probability curve is population-dependent.** It was fitted by Lichess on 2300-rated games and is applied here from 800 to 2600; section 4.4 shows the scale consequence.
9. **The account-status lookup is a snapshot** whose lag differs by period, leaving FINAL's top band the least cleaned -- a direction that favours the hypothesis. `beta` and the primary Metric B gradient are therefore also reported with the top band dropped (sections 4 and 5).
10. **Frozen models drift.** Four months after the fit, the C3 nulls carry a visible drift offset and one crossed its tolerance. Section 6.3.
11. **`unexpected_time` is a regression residual of a clock difference.** It is not confusion, hesitation, indecision or any cognitive state, and it is named neutrally everywhere in this repository for that reason.

---

## 13. Claims this study does NOT support

* That thinking for longer produces worse moves. The direction of the association is not identified.
* That rating causes anything measured here, or that anything measured here is cognition.
* That stronger players are better or worse at deciding where to spend their seconds. The primary instrument was not capable of answering that, and section 5 says why.
* That the absence of a Metric B gradient is a property of players.
* That unmeasured difficulty has been ruled out in the form that matters.
* That anything here replicates at a different time control.
* Any prediction of a player's rating from these behavioural metrics.

Under the repaired verdict -- the mechanical verdict as shipped is `INVALID_EXPERIMENT` (section 2) and licenses no level language at all -- the strongest phrasing the preregistration permits for what *was* found is a **cross-rating law-like regularity**, and it carries its own qualification in the same breath: the `beta` x rating interaction on FINAL is -0.00022 [-0.00043, -0.00002] per 100 Elo; the raw band values run from 0.0162 (1200-1399) to 0.0105 (2400-2599), the lowest band is 0.0128, and the fitted interaction implies a fall of about a quarter across 800-2600 (0.0155 to 0.0115). It is invariant in sign (9 of 9 bands) and both halves of its dose-response are positive (section 4). It is not invariant in size.

---

## 14. NEXT_EXPERIMENT

**B4 -- the time-allocation gradient with a validated, non-degenerate instrument.** Same population and the same freeze discipline; a different instrument and a different floor. Specified by the Gate 3 adversary and recorded here unchanged, because ideas that arrive after a holdout is open may only ever be next experiments:

1. **Instrument.** A value-of-computation measure with no point mass -- the expected regret of the shallow candidate distribution, `sum_k p_shallow(k) x [wp_deep(best) - wp_deep(k)]` with `p_shallow` a softmax over the shallow evaluations at the accuracy temperature -- validated on DEVELOPMENT before the freeze by two pre-specified checks the current instrument fails or has never had: test-retest reliability of its residual across engine budgets at or above 0.8, and a pooled response to it that is larger in the fullest clock tercile than in the emptiest, with an interval excluding zero. An instrument failing either check returns to the design gate.
2. **Estimands.** The rating gradient of the time response reported as two named quantities -- the response to the residual component and to the predicted component -- so the channel observed here at +0.007 to +0.010 per 100 Elo, un-preregistered and confounded by construction (section 5.3), becomes a preregistered quantity with its recognition/allocation ambiguity stated, instead of a contaminant entering the primary metric with its sign flipped.
3. **Floor and power.** The floor fixed at freeze as a *relative* change in the DEVELOPMENT pooled level, converted to an absolute number from DEVELOPMENT only, with N set by the pilot to give 80% power for it -- about three times this study's per-period decisions, or a preregistered pooled read across three periods.
4. **Matching.** Cells on difficulty, clock, phase, standing and ply only -- never on the instrument whose response is the estimand -- with improved balance on every cell variable as a condition of using the matched estimate.
5. **Replication arm.** A second time control with its own development day, its own frozen fits, and its own destructive controls.

---

## 15. Provenance

| | |
|---|---|
| preregistration frozen | `results/PREREGISTRATION_FREEZE.json` |
| post-freeze amendments | `results/POST_FREEZE_AMENDMENTS.md` (A0-A7) |
| holdout seal | `results/FINAL_HOLDOUT_SEALED.json` |
| gate reviews | `reviews/FABLE_GATE_{1,2,3}_*.md` |
| analysis as shipped | `results/analysis_final.json` (FINAL stage), `results/analysis_secondary.json` (that run plus the secondary block), verdict `results/verdict.json` |
| analysis after the C3 repair | `results/analysis_repaired.json`, verdict `results/verdict_repaired.json`. It is `analysis_secondary.json` with the C3 blocks recomputed; the only other differences are the added `tae_pooled_slope_at_centre`, the retained `C3_shuffled_rating_as_shipped`, and a `_repair` provenance stanza |
| the repair itself | `src/repair_c3.py`, diff in `results/c3_repair_diff.json` |
| diagnostics in this report | `results/report_diagnostics.json`, from `src/report_diagnostics.py` |
| leakage tests | passed: True |
| engine determinism re-score | non-determinism detected: False |

**Numbers that come from a gate review rather than from this pipeline**, all from `reviews/FABLE_GATE_3_RESULT_ADVERSARY.md`, which was produced independently and read-only against this repository:

* Section 2: the analytic predictions of the C3 null and their Monte-Carlo standard errors, the `cov(ratinghat, rating_resid)` column, and the ratio 61,676 / 298,552.
* Section 6.3: the drift-offset table (the FINAL nulls and their offsets in null SDs; the VALIDATION and DEVELOPMENT comparisons in the paragraph above it are from `analysis_repaired.json`).
* Section 9: every extrapolation diagnostic on the secondary period -- the -7.35 floor of the frozen prediction, the two-thirds out-of-range share, the fivefold residual standard deviation, the +0.0114 destroyed-outcome null, the -0.00005 raw slope, the "about a hundred null standard deviations", the refit estimates, and the top-band player counts.

Every other number is interpolated from the JSON files above by `src/write_report.py`. The three-estimator table in section 2 is this pipeline's own recomputation and agrees with amendment A7.5's independent reconstruction to the fourth decimal. The `label_means` field in both verdict files holds `VERDICT_RULES.md` §3.1's definition of `EXPERTISE_ADAPTATION_SUPPORTED`, which `evaluate.py` writes whichever gate fires; it is not the meaning of the verdict either file records, and this report does not print it.

