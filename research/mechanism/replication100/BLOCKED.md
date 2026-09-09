# Why the cohort stopped at 7 of 100, and how it was wrong

**RESOLVED 2026-09-09 08:20 UTC. Member 8 completed; the cohort is at 8 of 100 and
running. Read the RESOLVED section before trusting anything below it.**

Recorded 2026-09-09 05:25 UTC, after seven container reboots. This is an execution blocker, not a
research defect: the frozen instrument is behaving exactly as frozen, and nothing here proposes
changing it.

## The collision

Member 8 of the frozen order is `pablorocchi`, a RESIDUAL member with 2,200 admissible games whose
`NODE C` depth cross-validation selects search depth 3. It took seven attempts to finish, the
longest failed one an uninterrupted 63 minutes, and until the eighth it never reached the third
discovery output. **On the run that finished, that output took 461 seconds. See RESOLVED.**

Against that, the execution environment reboots on its own, and `run_discovery.py` writes no
checkpoint, so every reboot restarts `NODE D` from draw zero. The inference drawn here was that
the step needs more than 63 minutes and so could never fit. That inference was wrong; the step
takes 461 seconds.

How short the window is was originally recorded here as a hard lifetime of 30 to 35 minutes. That
was wrong, and the correction is in **What this file got wrong** below.

## The cost curve that locates it

`NODE D` seconds, taken from each member's own `discovery_POP_cls_tactical.log`:

    games   depth   NODE D
      445       1       10
      450       2    55-65
      450       3      124
     2200       1    93-99
     2200       3      461   (measured only after it finally finished; see above)

Depth alone is not the wall: `nouramine`, `original-chess` and `medkol` finished at depth 2, and
`franckzurita18` finished at depth 3. Corpus size alone is not the wall either: `maxkart19` and
`bmyers2015` finished at 2,200 games. The corner where both are large was described here as
unreachable; it was reached. 22 RESIDUAL members remain whose depth is not known until their own
discovery runs, and nothing here predicts trouble for them.

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
  05:20 and the container rebooted anyway at 35 minutes. The hypothesis is dead. The claim made
  here that the first 65-minute interval was therefore noise did not survive either; see below.
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

## A local git flag, set and then cleared (member 8 is now committed)

`lichess_pablorocchi_COHORT/manifest.json` records `repo_sha`, the commit HEAD pointed at when the
run started. Every restart rewrites it, so the file is permanently modified while the member is
mid-flight, and committing it cannot settle it: the committed value is whatever HEAD was one
restart ago, and the act of committing moves HEAD again. Three commits went into that loop before
it was recognised as one.

It briefly carried `skip-worktree` locally, so that `git status` stayed clean and the churn
stopped. That flag has since been **cleared**, deliberately:

    git update-index --no-skip-worktree research/mechanism/replications/lichess_pablorocchi_COHORT/manifest.json

`git ls-files -v <path>` prints `S` while the flag is set and `H` once cleared; it prints `H`.

The flag traded a visible annoyance for an invisible hazard, and that is the wrong trade in this
repository. While it was set, git ignored real changes to the file, so a later turn that committed
member 8's terminal artifacts would have recorded the member with a stale manifest and no warning
of any kind. A permanently modified file in `git status` is noisy; a member whose committed record
says the run happened differently than it did is a falsified record. Noise is the cheaper failure,
so the file is simply left uncommitted while member 8 is mid-flight, and it goes in with the rest
of that member's artifacts when the member reaches a terminal status.

## What is intact

Verified after every one of the seven reboots: all 100 raw corpora re-hash to the `raw_sha256`
recorded in `COHORT_FROZEN.json`, 100 matching, 0 missing, 0 mismatched. `pipeline_hash` still
equals the frozen value, the engine binary still hashes to the frozen value, no manifest is stamped
`repo_dirty_at_run`, and the 140 preserved failure-evidence files re-hash clean. Seven members are
terminal and committed. No research data has been lost at any point; what has been lost is time.

## RESOLVED, and the diagnosis was wrong

Added 2026-09-09 08:20 UTC. Member 8 completed. The cohort is at 8 of 100 and running.

This file's central claim was that `NODE D` needs more than 63 minutes. Its own log, on the run
that finished, reads:

    NODE D bootstrap winners (30 draws, 461s)

Seven minutes and forty-one seconds. The claim was wrong by a factor of eight, and it was wrong in
the way that is easiest to be wrong: `NODE D` was the last line the interrupted logs printed, so it
was read as the step that was hanging. A step that is last in a truncated log is not thereby the
slow step. Nothing measured its duration until it finished once, and everything asserted about it
before then was inference from where the output stopped.

What actually consumed those six attempts is not established here. It should not be guessed at a
second time. The honest state is: member 8 needed more than one short window and less than one
long one, the cost was somewhere in the member's run and not demonstrably in `NODE D`, and no
measurement in this file localised it.

The cost curve above stands for every row that was measured to completion. Its last row read
`>3800, never finished` until this section was written, and that row was never a measurement: it
was an interrupted run's elapsed time, recorded as though it were a duration.

## What this file got wrong

Added 2026-09-09 07:20 UTC.

This file asserted a hard environment lifetime of 30 to 35 minutes and concluded that member 8
could never finish here. Both are false. The machine ran from 05:40 to 07:10 without interruption,
ninety minutes. (The sixty-three minutes this file said `NODE D` needed was itself wrong; see
RESOLVED above.)

The full series of observed boot intervals, in minutes:

    65, 30, 29, 30, 29, 35, 90, 34

The original claim was built on the run of three consecutive ~30s in the middle of that series and
stated as a property of the machine. It was a property of three samples. The right reading is that
the interval is variable and that long windows do occur, so the cohort can finish where it stands;
it just has to be lucky, and the scorer has to already be running when the luck arrives.

That last clause is the real lesson. The 90-minute window produced nothing, because for its whole
duration the session was blocked by a safety check and could not restart the scorer. The cost was
not the machine's.

## Preservation, which changes the stakes

Also 2026-09-09 07:20 UTC. All 100 frozen raw corpora and the scored decisions of the finished
members are now in a private Hugging Face dataset, `ereztash/lichess-cohort100-frozen-inputs`,
content-verified 100 of 100: twenty-five against the Hub's own LFS sha256, and the remaining
seventy-five by recomputing the git blob sha1 locally from a file freshly re-hashed against
`raw_sha256`, which chains frozen to local to remote without downloading a gigabyte back.

Losing this container therefore no longer voids the cohort. Before this transfer, a full reclaim
meant refetching from a live endpoint that returns different bytes for an active player, which the
digests would have caught and nothing could have repaired.

## The one remaining remedy

An execution environment that stays up for hours rather than half an hour. That is still the only
change that resolves this without altering the study. What is different now is that waiting for a
long window is a viable second-best, and that a new environment is no longer dangerous.
