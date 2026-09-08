# What survives losing this machine

The cohort run is 50 hours of engine time in an ephemeral container. This file records what is
actually durable, what is not, and what a recovery would and would not be able to prove. It is a
statement of exposure, not a plan to reduce it: the storage rules for this project forbid pushing
research corpora to git or to any destination whose authorisation cannot be established, so the
exposure below is accepted rather than engineered away.

Measured 2026-09-08, 21:10 UTC, with member 2 of 100 in flight.

## The two piles

    tracked in git    633 files        8 MB     survives
    untracked         249 files    1 142 MB     dies with the container

Everything expensive is in the second pile. Nothing in the second pile is a decision.

`.gitignore` puts `raw/*.ndjson`, `admissible/*.ndjson`, `scored/` and `features/` outside the
repository on purpose. That is the right call for a gigabyte of regenerable evidence, and it is
also the whole of the exposure.

## The derivation chain, and where it breaks

    raw/history.ndjson        ephemeral   fetched from a live endpoint
      -> admissible/games.ndjson   ephemeral   raw minus admissible/exclusions.json   TRACKED
      -> scored/*.jsonl            ephemeral   Stockfish 17.1, depth 12, MultiPV 3    expensive
      -> features/decisions.parquet ephemeral  deterministic
      -> analysis/discovery_*.json  TRACKED    deterministic
      -> report/RESULT.json         TRACKED    terminal status, drives resume

Read it downward and every link below the first is regenerable from the link above it plus code
that is pinned by `pipeline_hash`. Read it upward and there is exactly one link that no amount of
local computation can rebuild: the raw corpus, because Lichess is a live service and not an
archive.

## What recovery could prove, and what it could not

`COHORT_FROZEN.json` carries `raw_sha256` for all 100 members, taken from
`raw/fetch.json["fetch"]["sha256"]` at freeze time. A six-member sample re-hashed against the
corpora on disk today: all six match. So the digest is a real content hash of the input, not a
label copied alongside it.

That gives a refetch a verdict rather than a hope. Refetch a member, hash the result, compare to
the frozen digest:

* identical digest, and the input is the frozen input. Not a similar corpus, the same bytes. The
  run continues as the frozen run.
* different digest, and the input is not the frozen input. The member cannot be scored under this
  cohort. Detected, loudly, before any position is searched.

What the digest cannot do is make the second case rare. `raw/fetch.json` pins the exact query,
including `sort=dateDesc&max=N`. For an active player, games played after the freeze shift that
window, so the refetch returns a different set and hashes differently. The honest expectation is
that losing this container before completion costs the unscored members outright, and that the
loss is visible rather than silent. A cohort cannot be repaired by re-freezing around whatever the
endpoint happens to serve later. It would have to be re-run whole.

Members already finished are safe: `report/RESULT.json` is tracked, `cohort_run.py` resumes from
the terminal status on disk and never from the progress file, and the progress file is rebuilt by
scanning run directories. Losing the scratchpad copy of `COHORT_PROGRESS.json` costs nothing.

Excluded-game identity is tracked too. `admissible/exclusions.json` lists every excluded game id
with its reason, so admissible membership is raw-minus-exclusions and needs no separate archive,
given a raw corpus that verifies.

## Regenerable versus expensive

    regenerable and cheap    admissible/, features/, analysis/, report/
    regenerable and dear     scored/          ~50 h of engine time for the full cohort
    not regenerable          raw/             a live endpoint, not an archive

The middle row is the one that hurts to lose and the bottom row is the one that ends the cohort.

## Standing status

Preservation off this machine is `STORAGE_TARGET_REQUIRED`. No authorised destination exists: no
Hugging Face token and no `huggingface_hub` client are present, git is excluded for research data
of this size by the project's own rule, and every other credential reachable from this environment
is excluded by the authorisation rules rather than by its absence. The gap is a missing
authorisation, not a missing capability, and it is not closed by finding some other bucket.
