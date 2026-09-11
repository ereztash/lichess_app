# 100 players, one frozen instrument

What the mechanism-discovery pipeline returns when it is pointed at a hundred Lichess players it was never built around. The question is the DISTRIBUTION of outcomes, not whether a hundredth residual could be found.

| | |
|---|---|
| `instrument_hash` | `b75d31cc8f07f9453098d7c7f7fcffa037cf8c2aeec3a4478fa19272a03aa677` |
| `prereg_hash` | `3aa7e5335942c860922454939003cb0256817f8b8a92c5414d25a2ae8af31a0d` |
| `cohort_hash` | `42c6fb293623b7051bdb13ea4d3e01e03049ad477d881736603196d1629c2b49` |
| members frozen | 100 |
| members finished | 100 |

Every threshold below was fixed in `COHORT_PREREG.json` before a username was chosen. The instrument was frozen before that.

## How the cohort was reached

| stage | n |
|---|---|
| frame walked | 1915 |
| skipped without a fetch: PREFILTER_RATING_FAR_FROM_BAND | 1108 |
| skipped without a fetch: PREFILTER_TOO_FEW_GAMES | 39 |
| fetched and tried | 768 |
| rejected: INSUFFICIENT_ELIGIBLE_GAMES | 3 |
| rejected: IN_POPULATION_BASELINE | 57 |
| rejected: NO_BLITZ_GAMES | 3 |
| rejected: POPULATION_BASELINE_INSUFFICIENT | 605 |
| **accepted** | **100** |

Separately, **16** fetches failed against **16** candidates the walk could not reach. Those are NOT rejections and are not in the table above: nothing about them was judged. Each was requeued at its committed position.

Every rejection is a pre-analysis failure. No candidate was replaced for anything a run found, and no run that reached a result was discarded.

## The two denominators

A player can be large enough for the instrument to judge a BROAD structure and far too small for it to judge a PERSONAL RESIDUAL. Pooling them would report residual nulls that are properties of corpus size.

| denominator | rule | n |
|---|---|---|
| BROAD_POWERED | ≥ 1778 VALIDATE decisions | 100 |
| RESIDUAL_POWERED | ≥ 5749 blitz VALIDATE decisions and ≥ 1786 admissible blitz games | 25 |

## What the instrument returned

| class | of BROAD_POWERED (100) | of RESIDUAL_POWERED (25) |
|---|---|---|
| `PERSONAL_RESIDUAL_CANDIDATE` | 19 (19.0%) | 17 (68.0%) |
| `LEVEL_TYPICAL_ONLY` | 33 (33.0%) | 8 (32.0%) |
| `NO_STABLE_STRUCTURE` | 47 (47.0%) | 0 (0.0%) |
| `INSUFFICIENT_EVIDENCE` | 1 (1.0%) | 0 (0.0%) |

**`NO_STABLE_STRUCTURE`**: no region of the frozen vocabulary passed the VALIDATE judge on the broad class. This is NOT 'no personal residual'. The residual stage was never reached, so nothing about a personal residual is measured by it, in either direction.

`LEVEL_TYPICAL_ONLY` is the class that says a structure was found and the same-rating population explains it. The four counts are never summed into found versus not found.

## The instrument, measured on itself

100 finished runs make quantities visible that two runs could only hint at.

| | p05 | p50 | p95 |
|---|---|---|---|
| `stability_median_j` of frozen candidates | 0.052 | 0.323 | 1.000 |
| `resid_wg_z` on VALIDATE | 1.34 | 1.58 | 6.58 |

835 frozen candidates examined; 21.9% of them reach the judge's bar of 3.5. Reference: erez281's R\*\* scored `stability_median_j` 1.00, vibesgalore's best scored 0.13.

The band derived at selection from admissible games agreed with the band the pipeline derives from scored decisions for 100 of 100 members. Two implementations of one rule, measured rather than assumed.

The metadata screen predicted a band before each fetch. Over **705 tried candidates** for which a band was then derived, accepted and rejected alike, the prediction was wrong **438** times (62.1%). A further 63 candidates had no band derived at all, so the screen's prediction had nothing to be right or wrong about; they are outside that denominator rather than counted as agreements (INSUFFICIENT_ELIGIBLE_GAMES: 3, IN_POPULATION_BASELINE: 57, NO_BLITZ_GAMES: 3).

## Population safety

**Rule.** leave-one-player-out. No cohort member's games may enter the population baseline that judges them.

Re-derived here from the baseline corpus over the frozen members, not carried over from selection: **0 of 100** members appear among the 1200 players in the baseline that judges them. 57 candidates were rejected at selection for exactly this.

## Pattern diversity

21 distinct candidate regions across the cohort. 28.3% of candidates are R\* or R\*\* verbatim, which are erez281's own.

| region | members |
|---|---|
| `own_overloaded_piece_count>=1` | 14 |
| `material_balance>=-2 AND own_overloaded_piece_count>=1` | 13 |
| `n_captures>=3` | 3 |
| `material_balance: [0:3[` | 2 |
| `material_balance: [0:3[ AND own_overloaded_piece_count>=1` | 2 |
| `material_change_2ply>=-1 AND own_overloaded_piece_count>=1` | 2 |
| `n_good_captures<1 AND own_overloaded_piece_count>=1` | 2 |
| `own_attacked_piece_count>=3` | 2 |
| `clock_frac<0.10` | 1 |
| `clock_frac<0.50` | 1 |
| `legal_moves>=26.0 AND own_overloaded_piece_count>=1` | 1 |
| `material_balance: [0:3[ AND opp_last_pawn==1` | 1 |
| `material_balance: [0:3[ AND own_attacked_piece_count>=3` | 1 |
| `material_balance>=-2 AND n_captures: [1:3[` | 1 |
| `material_balance>=-2 AND n_captures>=3` | 1 |
| `n_good_captures>=1 AND standing=='winning'` | 1 |
| `opp_attacked_piece_count>=3` | 1 |
| `opp_hanging_piece_count<1 AND own_overloaded_piece_count>=1` | 1 |
| `own_hanging_piece_count<1 AND own_overloaded_piece_count: [1:2[` | 1 |
| `own_hanging_piece_count<1 AND own_overloaded_piece_count>=1` | 1 |
| `own_hanging_piece_count>=1 AND recapture_available==0` | 1 |

## Red flags, declared before any result

| flag | value | met |
|---|---|---|
| PERSONAL_RESIDUAL_CANDIDATE rate above 50% of RESIDUAL_POWERED members | 68.0% | **YES** |
| every candidate region is R* or R** verbatim | ['clock_frac<0.10', 'clock_frac<0.50', 'legal_moves>=26.0 AND own_overloaded_pie | no |
| fewer than 3 distinct candidate regions across all members | 21 | no |
| NO_STABLE_STRUCTURE rate above 90% of BROAD_POWERED members | 47.0% | no |
| eligibility rejection rate above 90% of tried candidates | 87.0% | no |
| the derived band differs from the screen's prediction for more than 80% of tried candidates | 62.1% | no |

## Verdict

### `UNDETERMINED`

a pre-declared red flag is met

**no count in this cohort licenses a CAUSAL, INTERVENTION or OUTCOME claim. The claim ladder is unchanged by sample size.**

## What this cannot say

- **OBSERVATION** (REPO): reachable: the region's contrast on games never used to find it
- **PREDICTION** (REPO): reachable: held-out log-loss/AUC gain over the frozen baselines on TEST
- **SPECIFICITY** (RESEARCH): reachable only through the population baseline; absent it, never
- **CAUSALITY** (FIELD): NOT reachable by this pipeline under any result
- **INTERVENTION** (OWNER): NOT reachable by this pipeline under any result
- **OUTCOME** (FIELD): NOT reachable by this pipeline under any result

The claim ladder is unchanged by sample size. A hundred players buy a distribution, not a rung.

