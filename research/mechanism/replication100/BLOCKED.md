# Why the cohort stopped at 7 of 100

Recorded 2026-09-09 05:25 UTC, after seven container reboots. This is an execution blocker, not a
research defect: the frozen instrument is behaving exactly as frozen, and nothing here proposes
changing it.

## The collision

Member 8 of the frozen order is `pablorocchi`, a RESIDUAL member with 2,200 admissible games whose
`NODE C` depth cross-validation selects search depth 3. Its `NODE D` bootstrap has never finished.
Seven attempts, the longest an uninterrupted 63 minutes, and it did not reach the third discovery
output.

Against that, the execution environment has a hard lifetime of roughly 30 to 35 minutes, and
`run_discovery.py` writes no checkpoint, so every reboot restarts `NODE D` from draw zero. A step
that needs more than 63 minutes inside a window of 30 cannot complete, and it does not matter how
often the run is restarted.

## The cost curve that locates it

`NODE D` seconds, taken from each member's own `discovery_POP_cls_tactical.log`:

    games   depth   NODE D
      445       1       10
      450       2    55-65
      450       3      124
     2200       1    93-99
     2200       3    >3800, never finished

Depth alone is not the wall: `nouramine`, `original-chess` and `medkol` finished at depth 2, and
`franckzurita18` finished at depth 3. Corpus size alone is not the wall either: `maxkart19` and
`bmyers2015` finished at 2,200 games. Only the corner where both are large is unreachable, and
23 RESIDUAL members remain whose depth is not known until their own discovery runs.

## What was ruled out, and how

* **Memory.** 16 GB total, 15.5 GB free, no swap, no cgroup limit. Not a constraint.
* **Data volume.** `pablorocchi`'s `decisions.parquet` is 7.9 MB, smaller than `bmyers2015`'s
  10 MB, and that member finished `NODE D` in 99 seconds. Size is not what separates them.
* **More cores.** `run_discovery.py` contains no `multiprocessing`, no `joblib`, no
  `concurrent.futures` and no `n_jobs`. `NODE D` is a single-threaded `for b in range(boot)` loop.
  Additional cores cannot touch it, and adding parallelism would edit a pipeline-hashed file.
* **Session activity as the cause of the reboots.** Intervals ran 65, 30, 29, 30, 29 minutes, and
  the single long window coincided with sparser check-ins, which suggested the check-ins themselves
  were provoking the refresh. Tested directly: the session was left completely silent from 04:47 to
  05:20 and the container rebooted anyway at 35 minutes. The hypothesis is dead and the first
  65-minute interval was noise.
* **An automatic restart on boot.** PID 1 is `process_api`, there is no cron daemon and no
  `rc.local`. Only a session wake-up can restart the scorer, so every reboot costs the latency to
  the next check-in on top of the lost work.

## What was deliberately not done

Nothing in the frozen method was touched to make member 8 fit: not the search depth, the bootstrap
draw count, the beam width, the observable vocabulary, the judge thresholds, the chronological
splits, the population correction, the worker count, or the frozen member order. Each of those
would have let this member finish, and each would have made the cohort a different study than the
one that was pre-registered. `run_discovery.py` was not given a checkpoint for the same reason: it
is covered by `pipeline_hash`, and editing it moves the hash the freeze names.

## A local git flag that MUST be cleared before member 8 is committed

`lichess_pablorocchi_COHORT/manifest.json` records `repo_sha`, the commit HEAD pointed at when the
run started. Every restart rewrites it, so the file is permanently modified while the member is
mid-flight, and committing it cannot settle it: the committed value is whatever HEAD was one
restart ago, and the act of committing moves HEAD again. Three commits went into that loop before
it was recognised as one.

It now carries `skip-worktree` locally, so `git status` is clean and the churn stops:

    git update-index --skip-worktree research/mechanism/replications/lichess_pablorocchi_COHORT/manifest.json

That flag makes git ignore real changes to the file, which is exactly what is wanted now and
exactly what would falsify the record later. **Before committing member 8's terminal artifacts,
clear it first:**

    git update-index --no-skip-worktree research/mechanism/replications/lichess_pablorocchi_COHORT/manifest.json

`git ls-files -v <path>` prints `S` while the flag is set and `H` once it is cleared. A member
committed without its true manifest would be a record of a run that did not happen the way the
record says, so this is not a tidiness step.

## What is intact

Verified after every one of the seven reboots: all 100 raw corpora re-hash to the `raw_sha256`
recorded in `COHORT_FROZEN.json`, 100 matching, 0 missing, 0 mismatched. `pipeline_hash` still
equals the frozen value, the engine binary still hashes to the frozen value, no manifest is stamped
`repo_dirty_at_run`, and the 140 preserved failure-evidence files re-hash clean. Seven members are
terminal and committed. No research data has been lost at any point; what has been lost is time.

## The one remaining remedy

An execution environment that stays up for hours rather than half an hour. That is the only change
that resolves this without altering the study.
