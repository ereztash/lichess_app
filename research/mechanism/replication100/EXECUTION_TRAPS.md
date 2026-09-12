# Traps this cohort hit on a second machine, and the check that settles each

Written while executing members 9-16 of the frozen cohort on a Windows host. Every entry below
looked like a defect in the instrument and was not. None of them changed the method; two of them
were defects in the *handoff*, and both are now fixed on the branch.

The pattern they share is the one `BLOCKED.md` already names: **an artefact of the observation was
mistaken for the thing observed.** A truncated log's last line read as the slow step there; here it
was a stale log, a self-matching grep, and a text decoder.

## 1. `core.autocrlf=true` moves `pipeline_hash` while `git status` stays clean

`restore.py` reported `PIPELINE: MOVED` on a fresh Windows clone. Nothing had been edited.

`pipeline_hash` is the sha256 of the **raw bytes** of the 17 files in
`corpus.pipeline_version()`. With `core.autocrlf=true` and no `.gitattributes`, the clone wrote all
17 as CRLF:

    as-on-disk (CRLF): 55fce983a9e246e9...
    LF-normalised:     eb840a439af4439b...   <- the frozen value

`git status` reports clean throughout, because git normalises back to LF when it compares. So the
obvious reading — "someone edited the research code" — is exactly wrong.

**Check:** if `restore.py` says `PIPELINE: MOVED`, recompute the hash over CRLF->LF normalised bytes
*before* suspecting a code change. **Fix:** `git config core.autocrlf false`, then
`git rm --cached -r --quiet . && git reset --hard`. A `.gitattributes` pinning `*.py text eol=lf`
is the durable fix, but it is not a mid-cohort change.

## 2. `--out /work/COHORT_PROGRESS.json` stamps `repo_dirty` into every later manifest

This one was written into the handoff's own instructions.

`corpus.repo_dirty()` counts **untracked** files, excluding only `COHORT_SELECTION.json` and
`research/mechanism/replications/` — and its docstring says those are process outputs and that the
exclusion is "not a licence to exclude anything else". An untracked `COHORT_PROGRESS.json` at the
repo root is therefore a dirty tree, and `run.py` stamps `repo_dirty: true` into the manifest of
every member started after the runner's first progress write. Member 10 was clean; 11, 12, 13 were
not, because `cohort_run.py` writes that file only after a member completes.

It is consumed as a defect, not a note:

  - `verify_run.py:119` -> "the working tree was dirty when this run took its manifest"
  - `audit_selection_validity.py:206` -> failing check "no member was derived from a dirty tree"
  - `selfcheck.py` went from 116/116 to 112 pass / 4 fail

**Fix:** write the progress file outside the repository. It is explicitly disposable - the runner
rebuilds it by scanning run directories.

**Remedy for members already stamped:** re-run them. `COHORT_PREREG.json` `defect_policy` covers
this in advance - "infrastructure: fix, record, rerun the affected members. Does not invalidate the
cohort." It costs seconds, because every expensive stage caches on the existence of its output:
scoring per worker part file (`run.py:88-97`), features (`run.py:122`), discovery (`run.py:174`).
Three members re-ran in 28 s, 9 s and 9 s, and the only bytes that moved were `repo_dirty`,
`repo_sha`, `finished_at`, and one line of each `REPORT.md`.

Do it **while the cohort is still blind**. The prereg justifies its operational exceptions as ones
that "read no result"; a provenance decision taken after seeing outcomes would not meet that bar.

**Hazard when re-running:** never change `--workers` for a member that already has part files.
Sharding is `i % workers` (`score_games.py:102`), `score_games` skips only ids already in its *own*
part file, and `features.py:599-602` concatenates every `scored/*.jsonl` **with no dedup by game
id**. Resuming at a different worker count silently duplicates decision rows.

## 3. `pkill -f` and `ps | grep` match themselves

`docker exec cohort100 sh -c "pkill -9 -f run.py"` kills the exec shell, because that shell's own
command line contains `run.py`. It exits 137 and the runner survives. Twice this looked like a
successful stop when nothing had stopped.

The read-only form is worse because it is silent: `ps -eo args | grep -oE "run_discovery.py"`
reported discovery running when only scoring was live - it had matched its own grep command in the
`ps` output, and prompted a false hunt for a duplicate runner.

**Check:** resolve PIDs first, then kill them:

    PIDS=$(ps -eo pid,args --no-headers | grep -E 'cohort_run\.py|score_games\.py' \
           | grep -v grep | awk '{print $1}')
    kill -9 $PIDS

`BLOCKED.md` already warns about this for `pgrep`. It applies to `pkill` and to `ps | grep` equally.

## 4. `analysis/score_w*.log` is appended across attempts, never truncated

After the missing-dependency failure, `tail` on a perfectly healthy re-run still showed
`ModuleNotFoundError: No module named 'chess'` from the dead attempt. The error looked live.

**Check:** compare `stat -c %y` against the restart time. Trust mtime, not the tail.

## 5. Comparing `git show` to a file produces false content diffs

Verifying that a provenance-only re-run changed nothing analytic, a line-level comparison reported
four changed non-provenance lines per report. It was the comparison, not the file:
`subprocess.run(..., text=True)` decodes with the locale encoding while
`open(..., encoding='utf-8')` does not, so an em dash is 3 characters on one side and 1 on the
other.

**Check:** compare **raw bytes** - `git show` without `text=True` against `open(path,'rb')`,
normalising only `\r\n`. The byte comparison showed one changed line per report, the repo SHA row,
which is what a provenance-only change should look like.

## 6. `git fetch` before starting a resumable run on a shared branch

The cohort was restarted at member 9 while the remote already carried member 9, scored and committed
from the other machine, in a commit that also said that machine was standing down. Sixteen minutes
were spent re-scoring it, and had it finished it would have produced a second competing record for
one member.

**Check:** fetch and read the incoming commits before starting, and look at whether they contain
member artefacts, not just code. Resume is driven by each member's `report/RESULT.json`, so a member
another machine finished is only skipped if you actually have its commit.

## 7. Measure the host before blaming the pipeline

Scoring ran at 17.8 positions/s against the 46.0 in this project's own `SCALING_BENCH.json`. The
pipeline was not the cause. The Windows host was thrashing:

| | before | after |
|---|---|---|
| `Memory\Pages/sec` | 48,828 | **1** |
| free physical | 0.4 GB / 13.85 | 3.43 GB |
| scoring throughput | 27 games/min | **39 games/min** |

Closing 26 Chrome processes, OneDrive (which had burned ~17,700 CPU-seconds) and three unrelated
Docker containers sharing the same VM took paging to 1 and lifted throughput 44%.

**Check first:** `Memory\Pages/sec`, `FreePhysicalMemory`, and `docker ps` for foreign containers.

**And do not reach for more workers.** `SCALING_BENCH.json` measures the frozen scorer flat from 4
to 8 workers (46.0 / 46.4 pos/s) and *worse* beyond (43.4 at 16, 39.7 at 32) - past the physical
core count it costs rather than pays.
