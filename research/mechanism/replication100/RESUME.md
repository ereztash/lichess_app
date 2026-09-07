# Resuming the 100-player cohort

The cohort needs roughly 58 hours of network and engine time, which is more than one session. Every
stage is resumable and refuses to proceed when the hash it started under has moved. This is the
order, and what each step will refuse to do.

## Before anything

```bash
pip install -r research/mechanism/replication/requirements.txt
python research/mechanism/replication100/selfcheck.py
```

16 checks, under a second, no network. It holds that every stage imports, that the selector's band
helper still agrees with the pipeline's own derivation on a run whose answer is on the record, that
the pre-registration names the frozen frame and the frozen instrument, that the working tree's
pipeline hash still matches the freeze, and that every run already on the record still verifies.

**If the pipeline hash no longer matches the freeze, stop.** Something changed the research code.
Either revert it or accept that the cohort is void and must be re-run whole under a corrected
instrument, which is what `COHORT_PREREG.json` calls a research-semantic defect. Do not re-freeze
around a change and carry on.

## 1. Selection (Phases 7, 8, 19)

```bash
COHORT_PROBE_ROOT=/tmp/cohort_probes \
  python research/mechanism/replication100/cohort_select.py
```

Resumes from `COHORT_SELECTION.json`, which records the cursor into the committed order, every
accepted member, and every rejection with its reason. It refuses to continue if the pre-registration
or the frame changed under a walk in progress.

Probes are written outside the repository because most candidates are rejected and deleted. An
accepted probe is promoted into `research/mechanism/replications/` the moment it is accepted, so
**commit after a walk stops** or the members it found go with the container.

Measured: about 165 s per residual-class fetch, about 38 s per broad-class one, roughly one
acceptance per eight fetched candidates. Expect around 15 hours in total.

## 2. Freeze (Phase 9)

```bash
python research/mechanism/replication100/freeze_cohort.py
```

Refuses unless selection holds exactly the 100 the pre-registration declares, and refuses if any of
them has already been scored. Writes `COHORT_FROZEN.json` and its `cohort_hash`.

Nothing is scored before this runs. That is the point of it.

## 3. Run (Phases 11, 12)

```bash
python research/mechanism/replication100/cohort_run.py --workers 4
```

Skips members whose `RESULT.json` already carries a terminal status, so it resumes freely. Resuming
reads only whether a run FINISHED, never what it found. Around 43 hours at four workers.

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
