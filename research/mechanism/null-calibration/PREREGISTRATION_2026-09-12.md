# Pre-registration: what does this instrument return when there is nothing to find?

Written 2026-09-12, **before any null world has been run on any cohort member**. It follows the
100-player replication (`research/mechanism/replication100/`, verdict `UNDETERMINED`) and does not
revise it. Nothing here may change that cohort's record, its instrument, or its verdict.

## 1. Why this study exists

The replication returned `PERSONAL_RESIDUAL_CANDIDATE` for 17 of 25 `RESIDUAL_POWERED` members
(68.0%), crossing a red flag declared at 50%. Two explanations were offered — a permissive judge
threshold, and an author-shaped discovery instrument. **Both were wrong about where the effect
lives.** Re-derived from `COHORT_RESULTS.json`:

| check | value |
|---|---|
| `window_class` × `RESIDUAL_POWERED` | `(BROAD, False): 75`, `(RESIDUAL, True): 25`, **crossover: 0** |
| PRC among members reaching the residual stage, window 450 | 2 / 74 = **2.7%** |
| PRC among members reaching the residual stage, window 2200 | 17 / 23 = **73.9%** |
| broad-stage candidates at or above `z = 3.5`, window 2200 arm | **75 / 75 = 100.0%** |

`RESIDUAL_POWERED` **is** window 2200, exactly and with no crossover. So "68% of residual-powered
members" and "68% of members holding a 2200-game corpus" are the same sentence, and the cohort
cannot separate them by any re-analysis of itself. In the powered arm the broad judge passes every
candidate, so the threshold that a multiple-comparisons argument would attack is not filtering
anything there.

The quantity that would settle this was never measured: **what rate does this instrument return on
data with no personal signal at all, at each corpus size?**

## 2. The question, split

The compound question "is the 68% a permissive bar or an author-shaped instrument?" is not
admissible as one hypothesis. It splits:

- **Q1 (this study).** What is the instrument's false-positive rate under an exact null, separately
  at window 450 and window 2200?
- **Q2 (not this study).** Is the discovery vocabulary's concentration a property of the instrument
  or of the population? Q2 requires a second evidence family with a divergent error path, which
  cannot be authored by whoever authored the first. It is out of scope here and is not answered by
  anything below.

## 3. Hypotheses, fixed now

- **H0 — power artifact.** The false-positive rate rises steeply with corpus size. Under the null,
  `validated_rate` at window 2200 is materially higher than at window 450.
- **H1 — real signal.** The false-positive rate is approximately nominal and roughly flat in corpus
  size, so the observed 73.9% is not manufactured by the instrument at that n.

## 4. Primary endpoint, declared before the run

**`validated_rate` under world `W5-null`, reported separately for the window-450 arm and the
window-2200 arm.** No other quantity may be substituted. `on_target_rate`, `median_best_jaccard`
and `top_regions` are secondary and may not be promoted to the endpoint after the fact.

`W5-null` shuffles the outcome within game (`common.shuffle_within_game`), preserving the real
dependence structure of the features while destroying any association with the target. It is an
exact null, not a simulation.

## 5. Decision rule, fixed before the run

Let `FP450` and `FP2200` be the primary endpoint in each arm.

| condition | conclusion |
|---|---|
| `FP2200 >= 0.40` | **H0 supported.** The 73.9% is substantially manufactured by corpus size against a fixed absolute bar. The cohort's residual rate is uninterpretable as a statement about people. |
| `FP2200 <= 0.10` **and** `FP2200 - FP450 <= 0.10` | **H1 supported.** The instrument is not manufacturing passes at n = 2200; the residue needs a different explanation, and Q2 becomes worth its cost. |
| anything else | **INCONCLUSIVE.** Report the rates and stop. Do not re-cut the thresholds. |

These three thresholds are frozen by this document. If a result lands between them, that is an
inconclusive result and not an invitation to move them.

## 6. Sample, fixed before the run

- **All 25** `RESIDUAL_POWERED` members (window 2200).
- **25 of the 75** window-450 members, drawn with `numpy.random.default_rng(20260912)` over the
  frozen member order in `COHORT_FROZEN.json`, recorded in `SAMPLE.json` **before** the first null
  is run.

Fifty members. The 450 arm is sampled rather than run whole because the endpoint is a rate, and 25
members already resolve it far more tightly than the decision rule requires.

## 7. What is executed

    python research/mechanism/analysis/plant.py \
      --decisions <member>/features/decisions.parquet \
      --worlds W5-null --nulls 100 --depths 1,2,3 \
      --residual 1 --vocab OBS --target cls_hung_material \
      --population research/mechanism/data/decisions_population_2026-06.parquet \
      --blitz-only 1 --focal-player-key <member> \
      --out /tmp/nullcal/<member>.json

`--nulls 100` is `plant.py`'s own default and is not a number chosen to suit this question.
Output goes to a container path **outside the repository**: an untracked file at the repo root sets
`corpus.repo_dirty()` and stamps `repo_dirty` into manifests, which is a defect this project has
already paid for once.

## 8. What may not change

`plant.py` is **not** among the 17 files covered by `pipeline_hash`
(`INSTRUMENT_FREEZE.json.pipeline_files`); it imports them. This study therefore runs the frozen
search, freeze and judge unmodified, and moves no hash. Verified before writing this document.

None of the following may change for any reason arising from a result here: the observable
vocabulary, the judge threshold `k = 3.5`, the bootstrap draw count, the beam width, the depths, the
population correction, the residual definition, or the output classes. **If this study finds the bar
miscalibrated, the remedy is a new instrument and a new cohort, not an edit to this one.**

## 9. Contamination, declared

The 100-player cohort was inspected — its verdict read and its numbers analysed — **before** this
hypothesis was written. Under the ordinary rule that an artifact used to form a hypothesis cannot
also confirm it, the cohort is discovery-contaminated for Q1. It motivates this study and supplies
its inputs; it may not be counted as confirmation of the answer. This study's own null runs are the
evidence, and they are generated after this document is frozen.

## 10. Cost, measured rather than guessed

Before the fifty members are run, a **timing probe** is executed on one window-2200 member with
`--worlds W1-simple --nulls 6`. `W1-simple` carries a planted truth and costs the same per
repetition as `W5-null` — the search, freeze and judge are identical and only the target vector
differs — so it measures wall clock without revealing anything about the null rate. Only the
`seconds` field of its output is consulted.

Derived from the cohort's own measured discovery times (~8.2 s per search at n≈2390; ~2.5 s at
n≈322), the expectation is roughly **40 minutes per window-2200 member and ~12 minutes per
window-450 member**, so about **20 to 25 hours** for all fifty, single-threaded. `plant.py`
checkpoints after every world, so the run is resumable and its cost is observable as it goes.
If the probe disagrees with this estimate by more than a factor of two, the sample stays as
specified in §6 and the schedule changes — not the design.

## 11. What this study cannot say

- It cannot revise the replication's `UNDETERMINED` verdict, which is final.
- It cannot answer Q2. A high null rate would make the vocabulary-concentration numbers an expected
  artifact rather than evidence of instrument shape, but it would not establish what shapes the
  proposal step.
- It cannot license any CAUSAL, INTERVENTION or OUTCOME claim about any player. The claim ladder is
  unchanged by this or any sample size.
- A null result here is a null, not a refutation of the discovery pipeline.

## 12. What would falsify H0

`FP2200 <= 0.10` with `FP450` at a similar level. That would mean the instrument does not
manufacture passes at 2200 games, and that the power-artifact reading — the one this document was
written to test, and the one its author currently believes — is wrong.

---

# AMENDMENT 1 — 2026-09-12, same day, before any null was run here

**H0 is withdrawn. It was already tested and refuted by work I had not seen when §1-§12 above were
written.**

## What I did not know

`research/mechanism/replication100/completion_gate/` reached this branch after the sections above
were committed. It contains a within-game permutation null over both stages, 200 permutations per
member per discovery file, and its result answers this study's primary question:

| | |
|---|---|
| pass rate at the `z = 3.5` bar under permutation | **3 of 4800 = 0.06%** |
| null median | ~0.85, the expected maximum of three standard normal draws, and three frozen candidates is what the search returns |
| corpus size 1,810 -> 14,766 VALIDATE rows | **null does not move** |

Against §5's decision rule, `FP2200 ~= 0.0006` falls in the branch `FP2200 <= 0.10 and
FP2200 - FP450 <= 0.10`, which this document declared in advance to mean **H1 supported**. The
judge is not permissive and the statistic is correctly standardised. That `z` grows as `sqrt(n)` in
the presence of a real effect is ordinary behaviour of a test statistic, not a defect.

## The error, named

§1 above read the perfect confound between `RESIDUAL_POWERED` and window 2200, plus the steep rise
of `z` with `n_in`, as evidence that a fixed absolute bar is in substance an n-dependent
effect-size bar. That reading is wrong, and it is worth recording that the completion gate reached
it first, tested it directly, and withdrew it — before I reproduced it independently from the same
artifacts. Two analysts making the same inference from the same numbers is not corroboration; the
permutation null is what settled it, and only one of us had run it.

What the red flag caught is neither a permissive judge nor a weak baseline. It is that
`RESIDUAL_POWERED` is by definition the subgroup with the power to detect, and a threshold was
placed on its *detection rate* as though statistical power were not a variable. **The defect is in
the flag's specification, not in the instrument.**

## What survives, and it is only one thing

Coverage. The completion gate states its own limit: the null covers the members whose scored
decisions were present in that environment — **three** of the 25 `RESIDUAL_POWERED`. "It does not
establish that all 17 are."

This environment holds scored decisions for **all 25** of them (22 with a feature table already
built; the remaining 3 rebuild from `scored/` in about 20 s each via `pipeline/features.py`).

## The study, as narrowed

- **Question.** Do all 25 `RESIDUAL_POWERED` members reproduce their committed class against their
  own permutation null, or only the three already tested?
- **Instrument.** `completion_gate/scripts/null_permutation.py`, unmodified. Reuse over rebuild: a
  second instrument written for the same question by the same author is one evidence family, not
  two. The `plant.py` design in §7 above is withdrawn for this question.
- **One execution note, not a code change.** That script hardcodes `/home/user/lichess_app`. It is
  run here behind a container symlink to the mount point; the file is not edited and no hash moves.
- **Endpoint.** Per member: observed `resid_wg_z` on the POP stage, its null distribution over 200
  permutations, the permutation p, and whether the committed class reproduces.
- **Decision rule.** If all 25 reproduce, the cohort's 17 detections stand as detections. If any
  member's committed class fails to reproduce against its own null, that member is a defect to
  record — not a reason to change any threshold.
- **Measured cost.** 10.6 s per permutation-file, measured on `superchango99` through the script
  itself: **~1.2 h per member, ~29.5 h for 25**, single-threaded, resumable per member.

## What has not changed

The replication's `UNDETERMINED` verdict is final and nothing here revises it. No threshold,
vocabulary, bar, or class definition may move because of anything found here. The cohort remains
discovery-contaminated for this question, per §9: it supplies the inputs and may not confirm the
answer.
