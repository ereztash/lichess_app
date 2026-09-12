# Preserved execution records

Two kinds of record that the container would otherwise take with it. Both are small, both are
provenance rather than research data, and neither is regenerable, which is why they are in git
while a gigabyte of scored evidence deliberately is not.

## failed_attempts/

Twenty-eight members that were attempted and did not reach a canonical terminal state. Every one
died the same way, and the traceback in each `score_w*.log` says so in one line:

    FileNotFoundError: [Errno 2] No such file or directory: 'stockfish'

That is an infrastructure defect, not a result. The frozen binary was not on `PATH` for the worker
processes. It was classified as infrastructure before anything was repaired, the repair was a
symlink to the binary the freeze names, and equivalence was demonstrated afterwards by reproducing
the control digest `defa7754eab66b55255becc0ade5458b51344afe638f3a582f6e37074695cfe8` at one, two
and four workers.

The records are kept because a failed attempt is evidence about the execution and deleting it
would leave the run's history saying that these members were simply scored later. They were not.
They were attempted, they failed for a reason that is written down here, and then they were
attempted again. Each directory keeps the `RESULT.json` as it stood (carrying `repo_sha` and
`pipeline_hash`) and all four worker logs.

`failed_attempts_index.json` indexes them with a SHA256 per evidence file, under the same
`cohort_hash` / `prereg_hash` / `instrument_hash` / `pipeline_hash` identity as the run itself.

Because the evidence is committed rather than gitignored, that index is checkable from inside the
repository, which most hash sites here are not:

    python verify_failed_attempts.py     28 attempts, 140 evidence files re-hashed, 0 defects

It catches a preserved log edited after the fact, a file the index claims but the tree has lost,
and a file in the tree that no row vouches for. It cannot tell you the account is complete: the
index is append-only and nothing can prove an attempt was never written down in the first place.

Two fields in every attempt read `UNKNOWN`, and they are left that way. `timestamp_utc` was not
recorded at the time. `input_corpus_identity` was not either, but it is recoverable rather than
lost: `COHORT_FROZEN.json` carries `raw_sha256` for all 100 members, keyed by the same
`player_id`. The record says what it knew when it was written, and the gap is closed by pointing
at the document that does know.

## manifest.jsonl

Append-only, one line per member that has completed and verified, carrying the member's identity
and the digests of its artifacts. It grows as the cohort does.

## What is not here

No corpora, no scored decisions, no features. Those are large, regenerable given a raw corpus that
verifies, and excluded from git by the project's own rule. `../DURABILITY.md` states what that
costs.

No credentials of any kind. Where a dependency needed one, only the fact that the dependency
existed is recorded. `raw/fetch.json` records `token_used: false` for every member of this cohort.
