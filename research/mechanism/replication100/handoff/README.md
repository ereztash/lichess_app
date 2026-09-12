# Moving the cohort to your own machine

Written for a Windows host with Docker Desktop, `AMD64`, 12 logical processors. Everything runs
inside a `linux/amd64` container, so the frozen engine build is the frozen engine build and nothing
depends on what happens to be installed on the host.

Nine of these steps are setup. The tenth is the only one that matters: `restore.py` refuses to
score anything unless all 100 corpora hash to the digests the freeze recorded.

## What you need first

A Hugging Face **read** token. The transfer token was scoped for write and should be revoked; make
a new one at <https://huggingface.co/settings/tokens>, fine-grained, read access to
`ereztash/lichess-cohort100-frozen-inputs` and nothing else.

## The steps

In PowerShell, from wherever you keep code:

    git clone https://github.com/ereztash/lichess_app.git
    cd lichess_app
    git checkout claude/generalize-research-pipeline-75k53u

Build the image. This downloads Stockfish 17.1 and checks its sha256 against the freeze; a
mismatch fails the build rather than producing an image that would score under the wrong engine.

    docker build -t cohort100 -f research/mechanism/replication100/handoff/Dockerfile research/mechanism/replication100/handoff

Start the container with the clone mounted. `--shm-size` is raised because twelve concurrent
engines and a pandas pipeline in one container will otherwise contend for the default 64 MB.

    docker run -it --rm --shm-size=2g -v ${PWD}:/work -w /work cohort100 bash

Everything below runs **inside** the container.

    python research/mechanism/replication100/handoff/restore.py --token hf_YOUR_READ_TOKEN

That downloads the corpora, places them where the runner expects them, and then checks three
things: every corpus against `raw_sha256`, the engine against the frozen binary digest, and
`pipeline_hash` against the freeze. It prints `READY` only if all three pass, and exits non-zero
otherwise without scoring anything.

Then start the cohort. **The progress file must live OUTSIDE the repository:**

    mkdir -p /tmp/cohort
    python research/mechanism/replication100/cohort_run.py --workers 8 --out /tmp/cohort/COHORT_PROGRESS.json

This file said `--out /work/COHORT_PROGRESS.json` until members 11, 12 and 13 were scored under
it and had to be re-run. `/work` is the repository root, the progress file is untracked, and
`corpus.repo_dirty()` counts untracked files as dirty, excluding only `COHORT_SELECTION.json` and
`research/mechanism/replications/` — its docstring says that exclusion is "not a licence to exclude
anything else". So every member started after the runner's first progress write took its manifest
under a tree git called dirty, which `verify_run.py`, `audit_selection_validity.py` and
`selfcheck.py` all consume as a defect rather than a note. Member 10 escaped it only because
`cohort_run.py` writes that file after a member completes, not before.

## About `--workers 8`

The authorised execution policy said four workers on a four-core node. Twelve logical processors is
a different node, and the number was tied to the node, so raising it was a decision rather than a
transcription. **Erez authorised 8 on 2026-09-09.**

The evidence it rests on: worker count partitions games across processes and each game is scored identically
whichever partition it lands in, which is why the control digest
`defa7754eab66b55255becc0ade5458b51344afe638f3a582f6e37074695cfe8` came out identical at one, two
and four workers. Stockfish itself stays at `Threads 1` per the freeze, so more workers means more
concurrent single-threaded engines, not a different search. On that evidence the count is an
execution parameter and not a research-semantic one. Eight leaves headroom on twelve logical cores
for the single-threaded downstream steps.

Only the scoring phase parallelises. `run_discovery.py` is single-threaded, so the speedup applies
to most of the wall clock and not all of it.

### Never change the worker count while a member is part-scored

Not a style preference. Changing it on a member that already has files in `scored/` silently
duplicates decision rows, two ways at once, with no error anywhere:

* `score_games.py:102` shards as `i % workers`, so the set of games belonging to worker `w`
  changes when `workers` changes, while the output name `part{w:02d}.jsonl` does not.
* `score_games.py:116` opens that file with `open(out_path, "a")`. Re-running worker 0 at a new
  count **appends** its new shard to the old one, inside the same file.
* `run.py:88-97` resumes by checking only `part00` through `part{workers-1}`. Dropping 8 to 4
  leaves `part04`-`part07` on disk, inspected by nothing.
* `features.py:599` then globs every `scored/*.jsonl` and concatenates with no dedup.

The result is a feature table with games counted twice, which no gate is looking for, because
nothing in the pipeline expects the shard width to move underneath it.

If the count genuinely must change, stop the runner and delete the affected member's entire
`scored/` directory first, so it re-scores from zero at the new width. Between members with none
part-scored it is safe. This was written after advising a drop from 8 to 4 under memory pressure
without checking any of the above; the advice was wrong as given.

## If restore.py says the pipeline hash moved, on Windows, read this first

A Windows clone with `core.autocrlf=true` — the Windows default — checks the 17 pipeline files out
with CRLF line endings. `pipeline_hash` is a digest over those files' bytes, so it moves, and
`restore.py` correctly refuses to run.

What makes this nasty is that `git status` stays clean throughout, because git normalizes back to
LF when it compares. The working tree looks untouched while the hash says the instrument changed.

It is not a research problem. The research code is byte-identical; only the line endings differ,
and normalizing them back to LF reproduces the frozen `eb840a439af4439b…` exactly. Confirm that
before doing anything else:

    git config core.autocrlf        # true is the culprit
    python -c "import sys; sys.path.insert(0,'research/mechanism/replication'); import corpus; print(corpus.pipeline_version()['pipeline_hash'])"

If renormalizing to LF reproduces the frozen hash, the instrument never moved. If it does not, stop
and report: that is a different problem and not this one.

The durable fix is a `.gitattributes` forcing LF for these paths. That is deliberately not done
here, because changing checkout behaviour while a run is in flight can renormalize files underneath
it. Worth doing between runs.

## What resume does

Nothing needs to be told where it stopped. `cohort_run.py` reads each member's
`report/RESULT.json`: a terminal status is skipped, `FROZEN` means not yet scored. The progress
file is a convenience and is rebuilt by scanning run directories, so losing it costs nothing.

The eight finished members are already committed on the branch, so a fresh clone starts at member
nine.

## Keep the machine awake

The run is on the order of a day. Windows sleeping will pause it. `powercfg /change standby-timeout-ac 0`
disables sleep on mains power; put it back afterwards.
