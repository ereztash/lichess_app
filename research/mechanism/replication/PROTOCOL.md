# Frozen replication protocol

**Contract version `replication-1.0.0`.** Every rule below was frozen before any player other than
`erez281` was run through this pipeline. A run that violates one is not a replication.

The machine-readable form is `contract.py`; this file is what it means.

---

## 0. What a replication is, and is not

The question is **not** "does R\*\* come back in other players". If R\*\* is genuinely personal, it
should not. The question is:

> Given a player who took part in no development decision, can the frozen pipeline separate
> recurring predictive structure, level-typical structure, a possible player-specific residual, and
> nothing supported — and say which, without being retuned?

`NO PERSONAL RESIDUAL SUPPORTED` is a valid result. So is `NO_STABLE_STRUCTURE`. Neither is a
failure of the run.

---

## 1. Input contract

```
platform + username
```

Nothing else. Rating, colour, game ids, dates, the split and the feature family are all derived.
The optional arguments are operational, not research: `--workers` (cores), `--engine`
(`native` is the frozen regime; `wasm` is the shipped-engine control), `--run-id`, `--root`,
`--ids-file` (replay a frozen window), and `--window` (a cap on the most recent admissible games,
which **must be declared before the fetch**).

`LICHESS_API_TOKEN` is environment configuration, not a per-player input: the by-username export
answers 404 to an unauthenticated request, which the mission ledger already recorded.

---

## 2. Ingestion (raw, immutable, hashed)

```
RAW FETCH -> RAW IMMUTABLE CORPUS -> ELIGIBILITY -> ADMISSIBLE CORPUS
```

The account is verified first (`/api/user/<username>`; 404 → `USER_NOT_FOUND`). The export query is
the one recorded as the frozen manifest's `source`: `rated=true, clocks=true, opening=true,
pgnInJson=true, sort=dateDesc`. The bytes the platform returned are written verbatim to
`raw/history.ndjson`, hashed, and never filtered in place. `raw/fetch.json` records the mode, the
URL, the query, the retrieval timestamp, the HTTP status, the byte count and the SHA-256.

## 3. Eligibility (frozen; nothing invented)

Game level — `admissible()` from `scripts/build_import_corpus.ts`, the function
`build_account_corpus.ts` imports rather than restates, and therefore the function that produced the
frozen 2,209-game window:

- `Termination` tag is `Normal` (this is what excludes Abandoned and Time forfeit);
- the PGN carries `%clk`;
- at least 20 clocked plies;
- the export asked for rated games only.

Reason precedence is the baseline's: non-Normal termination is reported first, then `no-clocks`,
then `under-20-plies`. Then, separately counted, the scorer's own filter: `variant == "standard"`
(`non-standard-variant`). Berserk is **not** an exclusion on the focal corpus — design v1.1 handles
it in the clock model. Duplicate ids keep the first occurrence.

Decision level — the product's rule, unchanged: not forced, not book, think time present, clock
present.

Every exclusion is written to `admissible/exclusions.json` with its game id. No game disappears.

## 4. Corpus freeze

One directory per run, `research/mechanism/replications/<platform>_<username>_<run-id>/`, holding
`raw/ admissible/ scored/ features/ analysis/ report/ splits.json manifest.json
REPLICATION_PREREG.json`. The manifest carries the platform, the canonical id, the fetch record,
the counts, every exclusion by reason, the corpus hashes, the repo SHA, the pipeline hash (a hash
over the fourteen files that decide research content), the engine regime, the split rule, the
minimum-corpus rule and the population contract.

> Same manifest + same code SHA = same research population.

## 5. Pre-registration

`REPLICATION_PREREG.json` is written **before the first outcome-bearing stage** — before scoring —
and is never rewritten. It carries the player, the pipeline hash, the eligibility rule and the
exclusion tally as of that moment, the split, the thresholds, the population contract, the stopping
rules, and the four possible output classes. It is self-hashed.

## 6. Engine regime (unchanged)

Stockfish 17.1 native, depth 12, MultiPV 3, Threads 1, Hash 16, hash cleared before every position.
The shipped Stockfish 18 Lite WASM engine keeps its baseline role: an engine-artifact control, never
the primary label. Performance work is admissible only if proven output-equivalent.

## 7. Splits

Chronological by game: DERIVE oldest 60%, VALIDATE next 20%, TEST newest 20%. TEST is opened once,
for a frozen candidate only. A player's results never choose the split.

## 8. Minimum corpus

`INSUFFICIENT_CORPUS` when DERIVE has fewer than 300 eligible decisions or 5 games, or VALIDATE or
TEST has fewer than 200 decisions or 2 games. These are not evidence thresholds: they are the
points below which the frozen search, judge and within-game contrast are undefined. The failure
names what is missing, how much there is, and how much is needed. **Thresholds are never lowered to
let a player through.**

## 9. Population baseline

The band is the focal player's own: the median `own_rating` over their admissible blitz games,
rounded to the nearest 50, ± 200. (`erez281`: median 1654 → 1450–1850, the baseline's band.) The
run then looks for a **registered** population corpus with that exact band and the same time
controls. There is no "near enough" band: a mismatched band would silently redefine what "a
same-rating player" means.

No registered corpus → `POPULATION_BASELINE_INSUFFICIENT`, and **no personal finding**. Peers are
never selected to maximise a residual: the band is fixed by the player's rating before any search
result is read, and the registry is a fixed list built before the run. The focal player is removed
from the population frame by corpus label **and** by player key before any model is fit, and the
removal is recorded.

## 10. The frozen chain

```
SEARCH -> VALIDATION -> TEST -> INVARIANCE -> STABILITY -> POPULATION CORRECTION -> RESIDUAL
```

run by `run.py` as subprocesses of the unchanged programs in `research/mechanism/analysis/`, with
the frozen arguments. The broad search runs on the union class `cls_tactical` (the final-candidate
rule of 15:50 UTC); the population-baseline search runs on the design-v1.8 class targets
`cls_hung_material` (the class R\*\* was found on) and `cls_tactical`, both judged by the same bar.

No human looks at an intermediate result and changes a rule. Concretely, during a run it is
forbidden to: change a feature, re-run because nothing interesting came out,
pick a new threshold, swap the subgroup family, or move the population band. Any of those makes the
player development data, not a replication.

## 11. Output classes

| class | when |
| --- | --- |
| `NO_STABLE_STRUCTURE` | no region of the frozen OBS vocabulary passes the VALIDATE judge on `cls_tactical` |
| `LEVEL_TYPICAL_ONLY` | a region passes, and under the same-rating population model no region passes |
| `PERSONAL_RESIDUAL_CANDIDATE` | a region survives the population baseline on held-out games |
| `INSUFFICIENT_EVIDENCE` | the frozen statistics are undefined here, or no population covers this band |

The judge is the one already frozen: residual within-game z ≥ 3.5, `n_in` ≥ 100, raw within-game
contrast > 0. The classifier adds no threshold of its own. Stability, invariance, the TEST read and
the engine-artifact control are reported as evidence attached to the class; they do not silently
promote or demote it.

## 12. Failure behaviour

`USER_NOT_FOUND`, `NO_PUBLIC_GAMES`, `INSUFFICIENT_ELIGIBLE_GAMES`, `INSUFFICIENT_CORPUS`,
`POPULATION_BASELINE_INSUFFICIENT`, `ENGINE_FAILURE`, `PIPELINE_EQUIVALENCE_FAILED`,
`PLATFORM_UNSUPPORTED`, `FETCH_FAILED`. A stack trace is never a research conclusion.

## 13. Claim ladder

| rung | authority | reachable by this pipeline |
| --- | --- | --- |
| OBSERVATION | REPO | yes — the region's contrast on games never used to find it |
| PREDICTION | REPO | yes — held-out log-loss/AUC gain on TEST |
| SPECIFICITY | RESEARCH | only through the population baseline; without it, never |
| CAUSALITY | FIELD | **no**, under any result |
| INTERVENTION | OWNER | **no**, under any result |
| OUTCOME | FIELD | **no**, under any result |

Forbidden in any report this pipeline writes, whatever it found: "tunnel vision", "does not see
attacks", "calculates less", "rushes", any cognitive noun for a region, "signature weakness", and
any statement that an instruction changes a rate.

## 14. Reversal

- OBSERVATION reverses if the region's within-game contrast on new games falls below the baseline's
  prediction, or changes sign under the shipped engine.
- SPECIFICITY reverses if a second held-out window, or a larger population sample, puts the
  player's residual inside the population's spread.

## 15. Governance — a new player is TEST data

One run per player per contract version. If a run exposes a defect and the pipeline is changed, then:
document the failure, change the pipeline, bump `CONTRACT_VERSION`, mark **that player as a
development case**, and get a genuinely new player for the replication. A result may never be used
to change the pipeline and then be reported as a replication of the changed pipeline.

## 16. The gate

`GATE-GENERIC-PIPELINE-EQUIVALENCE` must be GREEN before any new player is run, and its positive
controls must be PASS — every removed hard-code, put back, must turn the gate red. A green that has
never been shown red is not evidence.
