# Completion gate, cohort of 100

What was run after `member 100 of 100` landed, what it returned, and what it changed about how the
readout should be understood.

Nothing in this directory changes a frozen rule, a threshold, a member result, or
`COHORT_RESULTS.json`. Every script here reads committed artefacts. The cohort's own verdict is
`UNDETERMINED` and stays that way: `governance.no_tuning_after_this_hash` forbids adjusting a
threshold after seeing a result, and that holds even when the threshold turns out to have been
specified badly.

| | |
|---|---|
| cohort head at gate time | `18cffe3` (`the readout, 100 of 100`) |
| aggregate produced at | `1a0960a` (`member 100 of 100`) |
| run span | 2026-09-08 20:30 UTC to 2026-09-11 23:24 UTC |
| gate run at | 2026-09-12 UTC |

## 1. Mechanical verification

| check | result | file |
|---|---|---|
| `selfcheck.py` | 117 checks, 117 pass, 0 fail, 0 skipped | `output/selfcheck.txt` |
| per-run verification (`verify_run`) | 102 of 102 run directories verify | inside selfcheck |
| pipeline hash vs `INSTRUMENT_FREEZE` | matches | inside selfcheck |
| cohort completeness | 100 frozen, 100 finished, 0 unfinished | `COHORT_RESULTS.json` |
| execution failures | 0 (no ENGINE_FAILURE, FETCH_FAILED, RUN_FAILED, PIPELINE_EQUIVALENCE_FAILED) | member RESULT.json |
| population safety, re-derived | 0 of 100 members in the 1200-player baseline | `COHORT_RESULTS.json` |
| readout chain (`test_readout.py`) | 30 checks, 30 pass | `output/readout_chain_test.txt` |

**Aggregate reproduction.** `aggregate_cohort.py` was re-run into a scratch path and compared to the
committed `COHORT_RESULTS.json` by canonical hash with `read_at` stripped. Identical except
`repo_sha`, which records `1a0960a` because the aggregation ran before its own output was committed.
That is the documented behaviour in `replication/verify_run.py`. The aggregate reproduces.

**One tool reported NO-GO and it is not a finding.** `audit_selection_validity.py` is a PHASE 10
pre-flight audit; two of its 31 checks assert that no member has been scored yet. Running it after
all 100 members have been scored fails those two by construction. 29 of 31 pass. See
`output/selection_validity_audit.txt`.

**One gap.** `check_bound_invariant.py` has never been run as a committed artefact; there is no
`BOUND_INVARIANT.json` on the record. It needs a network fetch against a named player. Not run here.

## 2. The red flag

One of six pre-declared red flags is met:

> PERSONAL_RESIDUAL_CANDIDATE rate above 50% of RESIDUAL_POWERED members: **68.0%**

`aggregate_cohort.py` maps any met flag to `UNDETERMINED`, which is the cohort's verdict.

The flag's declared reading, written before any member ran:

> the judge is too permissive, or the population baseline is too weak to remove what is common at
> this level

**Neither is what happened.** See section 4.

## 3. The n question, and why it was the wrong question

`resid_wg_z` rises steeply with the number of decisions inside a region (`output/diag_n_dependence.txt`):

| n_in quintile | median n_in | median z | pass rate | median z/sqrt(n) |
|---|---|---|---|---|
| 2-219 | 144 | 0.97 | 0.0% | 0.0739 |
| 219-442 | 315 | 1.40 | 9.0% | 0.0782 |
| 442-706 | 591 | 1.87 | 16.8% | 0.0813 |
| 706-1657 | 874 | 2.45 | 20.4% | 0.0802 |
| 1675-4382 | 2952 | 4.74 | 62.3% | 0.0930 |

Spearman rho(n_in, z) = +0.550 (p = 5.6e-67). After dividing by sqrt(n) the association is gone:
rho = +0.067 (p = 0.054). Regressing log z on log n_in gives slope 0.439 (se 0.029); 0.5 is exactly
what a fixed effect measured with more data looks like.

At member level, one number per player, the implied effect size does not differ between the two
groups (`output/diag_effect_size.txt`):

| | n | median z/sqrt(n_in) |
|---|---|---|
| RESIDUAL_POWERED | 25 | 0.1505 |
| not RESIDUAL_POWERED | 75 | 0.1572 |
| | | Mann-Whitney p = 0.297 |

This was first read, wrongly, as evidence that a fixed z bar is in substance an n-dependent
effect-size bar, and therefore that pairing it with an n-defined powering denominator was a design
error large enough to be a research-semantic defect. The permutation null tested that reading
directly and refuted it. Section 4.

## 4. The permutation null

`scripts/null_permutation.py`. Within each game, the outcome columns are permuted jointly across
that game's rows. Features, game membership, game sizes and every game's own set of outcomes are
preserved; only the link between a row's features and its outcome is destroyed. The baseline model
is fitted on real data before permuting, because the model is part of the instrument rather than the
thing under test. Depth is taken from the committed run, which makes the null slightly conservative.

Both stages are run as `run.py` runs them: OBS (broad, `residualize` on the frozen baseline columns,
all speeds) and POP (residual, `residualize_population` against the band population, blitz only).
`PERSONAL_RESIDUAL_CANDIDATE` is decided on the POP stage.

200 permutations per member per discovery file.

**Result: the null does not move with corpus size.**

| member | VALIDATE rows | null p50 | null p95 | null max |
|---|---|---|---|---|
| maxkart19 | 14,766 | 0.50-0.69 | 1.81-2.02 | 2.30-3.11 |
| bmyers2015 | 14,535 | 0.63-0.77 | 1.80-2.12 | 2.65-3.09 |
| pablorocchi | 10,503 | 0.67-0.80 | 1.92-2.21 | 3.17-3.73 |
| nouramine | 3,177 | 0.61-0.80 | 1.82-2.15 | 2.50-3.84 |
| original-chess | 2,553 | 0.57-0.75 | 1.76-1.92 | 2.44-3.62 |
| millerglua | 1,810 | 0.69-0.79 | 2.01-2.22 | 2.92-3.14 |

An eight-fold difference in corpus size leaves the null unchanged. The median sits near 0.85, which
is the expected maximum of three standard normal draws, and three frozen candidates are what the
search returns. **The statistic is correctly standardised.** Pass rate at the 3.5 bar under
permutation: 3 of 4800 runs, 0.06%.

That z grows as sqrt(n) in the presence of a real effect is ordinary behaviour of a test statistic,
not a defect. The section 3 reading is withdrawn.

**Observed values against their own nulls** (0.005 is the floor at 200 permutations):

| member | stage | observed | null max | p | passed the 3.5 bar |
|---|---|---|---|---|---|
| maxkart19 | OBS | 10.92 | 2.84 | 0.005 | yes |
| bmyers2015 | OBS | 9.41 | 3.05 | 0.005 | yes |
| pablorocchi | OBS | 7.34 | 3.31 | 0.005 | yes |
| franckzurita18 | OBS | 4.81 | 3.00 | 0.005 | yes |
| bmyers2015 | POP cls_hung_material | 4.15 | 2.65 | 0.005 | yes |
| pablorocchi | POP cls_hung_material | 3.90 | 3.17 | 0.005 | yes |
| maxkart19 | POP cls_hung_material | 1.84 | 2.30 | 0.055 | no |
| millerglua | POP cls_hung_material | 0.19 | 2.94 | 0.83 | no |

Full table in `output/null_permutation_batch1.json`.

The three RESIDUAL_POWERED members tested reproduce their committed classes exactly: bmyers2015 and
pablorocchi pass and are `PERSONAL_RESIDUAL_CANDIDATE`; maxkart19 does not pass and is
`LEVEL_TYPICAL_ONLY`.

The strongest signal sits in the OBS stage, before the population correction. What survives the
correction is thin: the two POP passes are 4.15 and 3.90 against a bar of 3.5.

## 5. What the flag actually caught

Not a permissive judge: under permutation the 3.5 bar is crossed 0.06% of the time.

Not a weak baseline: 605 of 768 tried candidates were rejected for `POPULATION_BASELINE_INSUFFICIENT`,
so the members who entered the cohort are those the baseline could cover.

What the flag caught is that `RESIDUAL_POWERED` is by definition the well-powered subgroup, and a
threshold was placed on its detection rate as though statistical power were not a variable. With a
0.06% false-positive rate, 17 of 25 is not noise.

**The defect is in the red flag's specification, not in the instrument.**

## 6. What remains true about the output classes

An output class states that something was detected, not that it exists. A player with 3,000
decisions and the same true effect as a player with 14,000 receives a different label. Any reading
of the cohort's distribution has to say so.

## 7. Standing

- The cohort is not void. No re-run is indicated.
- The verdict stays `UNDETERMINED`, per the frozen rule and per `no_tuning_after_this_hash`.
- A future contract version should specify this flag in effect-size terms rather than pass-rate
  terms, and should annotate output classes with power.
- Coverage limit: the null covers the members whose scored decisions are present in this
  environment, three of them among the 25 RESIDUAL_POWERED. It establishes that the instrument is
  calibrated and that the detections tested are real. It does not establish that all 17 are.

## Files

```
scripts/null_permutation.py    the permutation null, both stages
scripts/diag_n_dependence.py   z against n_in, quintiles and correlations
scripts/diag_effect_size.py    implied effect size, powered against not powered
output/selfcheck.txt
output/selection_validity_audit.txt
output/readout_chain_test.txt
output/diag_n_dependence.txt
output/diag_effect_size.txt
output/null_permutation_batch1.json
```

The feature tables the null reads (`replications/*/features/decisions.parquet`) are rebuilt from
`scored/` by `pipeline/features.py` in about 20 seconds per member. Both are gitignored: they are
derived data, not repository content.
