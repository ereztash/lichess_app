# Resuming the 100-player cohort

The cohort needs roughly 48 hours of network and engine time, which is more than one session. Both
halves of that are measured below rather than guessed: about 11 hours of selection, about 37 of
scoring. Every stage is resumable and refuses to proceed when the hash it started under has moved.
This is the order, and what each step will refuse to do.

## Before anything

```bash
pip install -r research/mechanism/replication/requirements.txt
python research/mechanism/replication100/selfcheck.py
```

Under a second, no network. The count grows with the cohort, because one of the checks is "every run already on the record still verifies" and there is one per member. It holds that every stage imports, that the selector's band
helper still agrees with the pipeline's own derivation on a run whose answer is on the record, that
the pre-registration names the frozen frame and the frozen instrument, that the working tree's
pipeline hash still matches the freeze, and that every run already on the record still verifies.

```bash
python research/mechanism/replication100/test_readout.py
```

30 checks, a few seconds, no network. It exercises `aggregate_cohort.py` and `write_report.py`
against fixture cohorts built over the runs already on the record, because those two run once, at
the end of a cohort that costs days, which is the worst moment to find a defect in them. It includes
a positive control that must turn the population-safety gate red. Both are run in CI by the
equivalence workflow.

**If the pipeline hash no longer matches the freeze, stop.** Something changed the research code.
Either revert it or accept that the cohort is void and must be re-run whole under a corrected
instrument, which is what `COHORT_PREREG.json` calls a research-semantic defect. Do not re-freeze
around a change and carry on.

## 1. Selection (Phases 7, 8, 19)

```bash
COHORT_PROBE_ROOT=/tmp/cohort_probes \
  python research/mechanism/replication100/cohort_select.py
```

Two phases, one command. **Phase A** probes every candidate at the broad window and takes the first
100 that pass. **Phase B** walks those 100 in the same committed order and promotes the first 25
residual-capable ones by refetching them at the residual window; a promotion that fails the wider
window leaves the member as Phase A accepted them and passes the slot on.

Resumes from `COHORT_SELECTION.json`, which records the cursor into the committed order, every
accepted member with whether their promotion has been attempted, and every rejection with its
reason. It refuses to continue if the pre-registration or the frame changed under a walk in
progress.

Probes are written outside the repository because most candidates are rejected and deleted. An
accepted probe is promoted into `research/mechanism/replications/` the moment it is accepted, so
**commit after a walk stops** or the members it found go with the container.

Measured over the walk's own first 237 fetches: 38 s mean at the broad bound for a candidate that
is accepted, 52 s for one that is rejected, 176 s at the residual bound, and one acceptance per
seven fetched candidates. 34 accepted in 3 h 26 min is 9.9 an hour, so Phase A is about 10 hours and
Phase B's 25 promotions at 176 s are about 1.2 more. Under the one-phase order this was 42 hours,
because the expensive fetch would have been paid about 700 times instead of about 25.

## 2. Freeze (Phase 9)

```bash
python research/mechanism/replication100/freeze_cohort.py
```

Refuses unless selection holds exactly the 100 the pre-registration declares AND exactly the 25
RESIDUAL-class members inside them, and refuses if any of them has already been scored. Writes
`COHORT_FROZEN.json` and its `cohort_hash`.

The residual count is guarded because a Phase B that dies partway leaves a full hundred and a short
residual subset, and nothing downstream would notice: the aggregator computes the residual
denominator from what it is handed, so an interrupted walk would read as a finding about residual
power.

Nothing is scored before this runs. That is the point of it.

## 3. Run (Phases 11, 12)

```bash
python research/mechanism/replication100/cohort_run.py --workers 4
```

Refuses to start at all if the working tree's pipeline hash no longer matches the one
`INSTRUMENT_FREEZE.json` names. `verify_run.py` catches a moved hash too, but per run, which over a
hundred members means learning forty hours in that every one was scored under code the freeze does
not name.

Skips members whose `RESULT.json` already carries a terminal status, so it resumes freely. Resuming
reads only whether a run FINISHED, never what it found.

**About 37 hours at four workers, and the derivation matters more than the number.** `scaling_bench.py`
measured the frozen scorer at 46.0 searches a second on four workers, on four cores, with output
identical to the frozen record at every worker count; 6, 8, 16 and 32 workers do not beat it, because
the cores run out first. `audit_compute_compression.py` measured 490,507 searches over 16 accepted
members, which is 68.3 searches a game. Seventy-five members hold 450 admissible games and twenty-five
hold up to 2,200, because Phase B refetches the residual quarter at the wider window: about 6.06
million searches, about 37 hours.

An earlier note here said 43 hours, and a correction to it said 18.5. Both were wrong in the same
place: 43 predated the measurement, and 18.5 came from it but priced all hundred members at the broad
window, which is a quarter of the cohort scored at a fifth of its corpus. The residual window is why
this number is not a quarter of what it is.

It also checks, per member, that the band derived at selection from admissible games equals the band
the pipeline derives from scored decisions. Two implementations of one rule; a mismatch is recorded
as a defect rather than resolved in either direction.

## 4. Read it out (Phases 14, 17, 18, 24, 26)

```bash
python research/mechanism/replication100/aggregate_cohort.py
python research/mechanism/replication100/write_report.py
```

Every threshold comes from `COHORT_PREREG.json`. The red flags were declared before any member ran
and the verdict rule was fixed at the same time, so neither is chosen now.

## Optional, and worth running once

```bash
python research/mechanism/replication100/check_bound_invariant.py \
  --username <someone> --window 2200 --bound 4583
```

Fetches one player twice, bounded and unbounded, and compares the admissible game ids and the blitz
median. The retrieval bound sits outside the hashed set on the strength of an invariant; this is the
measurement of it rather than the argument for it.

## What must not happen

Once `COHORT_PREREG.json` is hashed, none of eligibility, features, thresholds, search space, target
order, split rules, population correction, judge, classifier, residual definition, output classes,
windows, seed or cohort size may change because of any member's result. A member whose run returns
`NO_STABLE_STRUCTURE`, `LEVEL_TYPICAL_ONLY` or `INSUFFICIENT_EVIDENCE` stays in the cohort. That is
the measurement.
