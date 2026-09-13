# Null coverage, all 25 RESIDUAL_POWERED members

The coverage extension pre-registered in `../PREREGISTRATION_2026-09-12.md` (Amendment 1). It closes
the one limitation the completion gate stated about itself:

> the null covers the members whose scored decisions are present in this environment, three of them
> among the 25 RESIDUAL_POWERED. It establishes that the instrument is calibrated and that the
> detections tested are real. **It does not establish that all 17 are.**

It does now.

## What was run

`replication100/completion_gate/scripts/null_permutation.py`, **unmodified** — their instrument, not
a second one written for the same question. 200 within-game permutations per member per POP target,
run against the frozen search, freeze and judge. Reuse over rebuild: a second instrument authored by
the same hand for the same question is one evidence family, not two.

Two execution notes, neither a code change. The script hardcodes `/home/user/lichess_app`; it was run
behind a container symlink to the mount point. Output was written to a container path outside the
repository, because an untracked file at the repo root sets `corpus.repo_dirty()` and stamps
`repo_dirty` into manifests — a defect this project has already paid for once.

`plant.py` is not among the 17 files under `pipeline_hash`; neither is this script. No hash moved.

## Result

| | |
|---|---|
| members tested against their own null | **25 / 25** |
| reproduce their committed class | **25** |
| mismatches | **0** |
| null pass rate at the `z = 3.5` bar | **6 / 10,000 = 0.060%** |
| highest `z` any permutation reached | 4.50 |
| nonzero exits | 0 |

0.060% is the same figure the completion gate measured on three different members. Those are two
measurements on disjoint samples, not one measurement repeated.

## What is independent evidence here, and what is not

**22 members are independent.** Their nulls had never been drawn before.

**3 members are not.** `maxkart19`, `bmyers2015` and `pablorocchi` were already run by the gate. Re-run
here they returned not only the same observed statistics but the **same `null_max` to two decimals**,
because `null_permutation.py` seeds deterministically (`--seed 987654`). That is a bit-level
reproduction across two machines and two environments — a real portability result — but it is **not**
a second independent sample of the null, and must not be counted as one.

    member        target              obs gate   obs here   nullmax gate   nullmax here
    maxkart19     cls_hung_material      1.836      1.836           2.30           2.30
    maxkart19     cls_tactical           1.263      1.263           3.11           3.11
    bmyers2015    cls_hung_material      4.150      4.150           2.65           2.65
    bmyers2015    cls_tactical           2.031      2.031           3.09           3.09
    pablorocchi   cls_hung_material      3.897      3.897           3.17           3.17

## Three things the run corrected about how the instrument was being described

**1. The judge is four conditions, not a threshold.** `run_discovery.py:184-185` for the residual
stage:

    pass = n_in >= min_n_validate  and  isfinite(resid_wg_z)  and  resid_wg_z >= k  and  wg_est > 0

`navaneethav` carries a candidate at `resid_wg_z = 4.684`, well above the 3.5 bar, and it does not
pass: `wg_est = -0.018`. **The judge is one-sided by design.** A region where the player errs *less*
cannot be a personal residual, however significant. Its other two candidates point the right way
(`wg_est` 0.106 and 0.123) but sit below the bar at 3.09 and 3.26. `LEVEL_TYPICAL_ONLY` is right for
two independent reasons.

Any analysis that reads "margin over 3.5" as the strength of a detection is therefore incomplete.

**2. Three members were never tested by this null, and their agreement is vacuous.** `dvoice` and
`newnampat64` froze **zero candidates** in the committed run, so there was no hypothesis to permute
against; the null agrees that nothing passed, which confirms nothing about the detection machinery.
`goshich` has one real test and one empty. The honest count is **8 detections tested and survived,
and 4 rejections genuinely tested**, not 25 informative comparisons.

**3. The permutation p-value floors.** Every passing member returns `p = 0.005`, the floor at 200
permutations (1/201), because no permutation beat the observation. The test says *not noise*; it
cannot rank. `al3s` at `z = 8.56` and `superchango99` at `3.71` receive the same p. Ranking the 17
detections by strength would need more permutations than this design draws.

## What this does not change

The replication's verdict is `UNDETERMINED` and stays so. No threshold, vocabulary, bar, depth,
population correction or class definition moved, and none may move because of anything here. The
cohort was inspected before this study was written, so it remains discovery-contaminated for this
question: it supplied the inputs and may not confirm the answer. These 25 null runs are the evidence.

The finding the gate reached stands and is now covered: **the defect is in the red flag's
specification, not in the instrument.** A pass-rate threshold was placed on a subgroup defined by
having the power to detect.

## Files

    SUMMARY.txt       the per-member table and the two bottom lines
    run.log           per-member start/finish and exit codes
    <member>.json     per member: observed statistic, all 200 null draws, p, null pass rate
