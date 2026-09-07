# `research/mechanism/replication` — the generic harness

The mechanism mission was built around one account. This package turns it into a pipeline you hand

```
platform + username
```

and get back

```
PUBLIC GAME HISTORY → FROZEN CORPUS → PRE-REGISTERED SPLITS → ENGINE SCORING → FEATURE EXTRACTION
→ DISCOVERY → HOLDOUT VALIDATION → POPULATION CORRECTION → PLAYER-SPECIFIC RESIDUAL SEARCH
→ BOUNDED FINDING
```

**The research did not change.** What changed is that the focal player stopped being a string
literal. `EQUIVALENCE_REPORT.md` is the proof: the generic pipeline reproduces every canonical
output of the original erez281 run, and `HARDCODE_AUDIT.md` lists every assumption that moved, with
its classification.

## The question this exists to answer

Not "does R\*\* come back in other players" — if R\*\* is genuinely personal it should not. The
question is whether the frozen pipeline can *separate*, for a player it has never seen:

1. recurring predictive structure, 2. level/population-typical structure,
3. a possible player-specific residual, 4. nothing supported.

`NO PERSONAL RESIDUAL SUPPORTED` is a valid answer. The classifier will not force one.

## One command

```bash
npm run replicate:player -- --platform lichess --username SOMEUSER
# or
research/mechanism/replication/replicate --platform lichess --username SOMEUSER
```

Environment (configuration, not per-player input):

| variable | what it is |
| --- | --- |
| `REPLICATION_PYTHON` | a Python with `requirements.txt` installed (else `python3`) |
| `SF_BIN` | the Stockfish 17.1 avx2 binary the ledger records (else `stockfish` on `PATH`) |
| `LICHESS_API_TOKEN` | needed for the by-username export; lichess answers 404 to an unauthenticated request, which the mission ledger already recorded. Rated games are public, so the token only lifts the rate limit |

Optional arguments are operational, never research: `--workers`, `--engine {native,wasm}`,
`--run-id`, `--root`, `--ids-file` (replay a frozen window through `POST /api/games/export/_ids`),
`--window` (a cap on the most recent admissible games, **declared before the fetch**),
`--stop-after FREEZE`.

Rating, colour, game ids, dates, the corpus split and the feature family are all derived. Asking
the operator for any of them would be asking them to make a research choice per player.

## Run directory

```
research/mechanism/replications/lichess_<username>_<run-id>/
  raw/history.ndjson raw/fetch.json     what the platform returned, verbatim + hashed
  admissible/games.ndjson               the frozen eligibility contract applied
  admissible/exclusions.json            every excluded game, by reason, by id
  REPLICATION_PREREG.json               written and self-hashed BEFORE scoring
  manifest.json                         same manifest + same code SHA = same research population
  scored/                               engine lines (Stockfish 17.1, depth 12, MultiPV 3)
  features/decisions.parquet            one row per focal decision
  splits.json                           DERIVE / VALIDATE / TEST membership, by game
  analysis/                             every stage's JSON and log
  report/RESULT.json  report/REPORT.md  the bounded result
```

## Files

| file | what it is |
| --- | --- |
| `contract.py` | the frozen semantic contract: eligibility, splits, engine regime, population rule, targets, output classes, failure codes, claim ladder, governance. Every value carries its provenance |
| `ingest_lichess.py` | Phase 4. Account verification, raw fetch, retrieval timestamp, query record, hash. Extraction only — no game is dropped here |
| `eligibility.py` | Phase 5. `admissible()` from `scripts/build_import_corpus.ts`, transcribed with the baseline's own reason precedence, then the scorer's `variant == "standard"` filter, counted separately |
| `corpus.py` | Phase 6. Run directory, manifest, pre-registration, repo SHA, pipeline hash |
| `populations.py` + `registry/populations.json` | Phase 11. The focal player's band, and the registered corpora that can serve it |
| `build_population.py` | builds a population corpus for a new band, so `POPULATION_BASELINE_INSUFFICIENT` is a missing asset and not a dead end. The filter is verified against the frozen corpus; the sampler is a declared `AMBIGUOUS_BASELINE` (see its docstring) |
| `classify.py` | Phase 13. The four output classes, decided by the already-frozen judge and no new threshold |
| `report.py` | Phase 17. One fixed report shape, with the claim ladder printed on every run |
| `run.py` | Phase 18. The orchestrator. Runs the unchanged programs in `../analysis/` as subprocesses with frozen arguments |
| `gate_equivalence.py` | `GATE-GENERIC-PIPELINE-EQUIVALENCE` and its positive controls |
| `make_baseline.py` → `BASELINE_EREZ281.json` | Phase 1. The old pipeline's inputs and canonical outputs, frozen before the refactor |
| `make_equivalence_report.py` → `EQUIVALENCE_REPORT.md` | Phase 14, rendered from the gate's own output |
| `PROTOCOL.md` | the frozen replication protocol in prose |
| `HARDCODE_AUDIT.md` | Phase 2 |

## Output classes

| class | when |
| --- | --- |
| `NO_STABLE_STRUCTURE` | no region of the frozen OBS vocabulary passes the VALIDATE judge on `cls_tactical` |
| `LEVEL_TYPICAL_ONLY` | a region passes, and under the same-rating population model no region passes |
| `PERSONAL_RESIDUAL_CANDIDATE` | a region survives the population baseline on held-out games. Candidate only |
| `INSUFFICIENT_EVIDENCE` | the frozen statistics are undefined here, or no population covers this band |

Failure codes: `USER_NOT_FOUND`, `NO_PUBLIC_GAMES`, `INSUFFICIENT_ELIGIBLE_GAMES`,
`INSUFFICIENT_CORPUS`, `POPULATION_BASELINE_INSUFFICIENT`, `ENGINE_FAILURE`,
`PIPELINE_EQUIVALENCE_FAILED`, `PLATFORM_UNSUPPORTED`, `FETCH_FAILED`. A stack trace is never a
research conclusion.

## The gate

```bash
npm run replicate:gate          # must be GREEN before any new player is run
npm run replicate:gate:controls # each control must turn the gate RED
```

The gate compares the generic pipeline's outputs on erez281 against `BASELINE_EREZ281.json` and the
committed `nodeB/` artifacts, and then re-injects each removed hard-code and requires the gate to
go red. A green that has never been shown red is not evidence.

## Governance

A new player is TEST data. One run per player per `CONTRACT_VERSION`. If a run exposes a defect and
the pipeline changes, that player becomes a development case, the contract version is bumped, and
replication needs a different player. A result may never be used to change the pipeline and then be
reported as a replication of the changed pipeline.

## What this pipeline can never conclude

CAUSALITY, INTERVENTION and OUTCOME are unreachable here under every result. A
`PERSONAL_RESIDUAL_CANDIDATE` is a candidate: not a cause, not an instruction, not a field result.
The report prints the ladder and the forbidden wordings on every run.
