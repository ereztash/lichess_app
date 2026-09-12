# 100-player replication: power and feasibility, before a single name is chosen

Phases 0, 1, 2 and 5 of the cohort mission. Written before selection so that a later null result can
be read as evidence about players rather than evidence about the corpus.

Artefacts: `INSTRUMENT_FREEZE.json`, `POWER_PLAN.json`, `FEASIBILITY_SCREEN.json`,
`SCREENED_FRAME.json`, and in the package above, `ENDPOINT_CONTRACT.json` and
`USERNAME_ONLY_PROOF.json`.

---

## Phase 0. The instrument is frozen

| | |
|---|---|
| `instrument_hash` | `caf572562b9500f63dde5f0eb49d02a7fd2a8656612a6cdd467dd5bc2070e5e0` |
| `pipeline_hash` | `eb840a439af4439bd44ed5a8da5ca76569fb8c68d38c34a6ba19eb2961da3143` |
| `protocol_hash` | `7d2dcfbfeb1f7bf14822d8478f04e48a5278d8623400569439a3da7a7a0238dc` |
| `repo_sha` | `cb3b469`, tree clean |
| `GATE-GENERIC-PIPELINE-EQUIVALENCE` | GREEN, 16 checks, 261 artefacts, 0 failing |
| positive controls | 5/5 turn the gate red |
| runs on the record | erez281 `PERSONAL_RESIDUAL_CANDIDATE`; vibesgalore `NO_STABLE_STRUCTURE` |

`INSTRUMENT_FREEZE.json` carries one flat `tree_sha256` map that `GATE-RESEARCH-RECONCILED`
asserts, so an instrument that drifts mid-cohort reddens a gate rather than passing quietly.

---

## Phase 2. Power, computed from the record rather than assumed

The judge is a residual within-game `z >= 3.5` with `n_in >= 100`, read out of
`analysis/vocab.py DESIGN`, not retyped. For a fixed effect size, `z` grows as `sqrt(n)`, so the
volume at which an erez281-sized effect would land exactly on the bar is
`n_ref * (3.5 / z_ref)^2`.

| | reference `z` | reference `n` | minimum |
|---|---|---|---|
| BROAD (`cls_tactical`, R\*) | 8.556 on VALIDATE | 10,626 | **1,778 VALIDATE decisions ≈ 364 admissible games** |
| RESIDUAL (`cls_hung_material`, R\*\*) | 4.520 on blitz VALIDATE | 9,589 | **5,749 blitz VALIDATE decisions ≈ 1,173 admissible blitz games** |

### The judge is not the binding stage

Beam search picks the region inside DERIVE. On a thin DERIVE the bootstrap resamples disagree and
the frozen candidate is a noisy draw, so a run can be judge-powered and still incapable of finding
anything to judge. The two runs on the record show this directly, on the same target:

| | erez281 | vibesgalore |
|---|---|---|
| blitz DERIVE decisions | 26,268 | 6,109 |
| in-region DERIVE decisions | 3,270 | 303 |
| `stability_share_j60` | 0.80 | 0.43 |
| `stability_median_j` | **1.00** | **0.13** |
| 5-fold CV `mean_z`, chosen depth | 3.07 | 1.88 |

`stability_median_j = 0.13` means the bootstrap resamples never agreed on a region. The judge was
never reached; the search is what failed. Holding erez281's in-region share fixed, reproducing a
searchable DERIVE needs **1,786 admissible blitz games**, above the judge's 1,173 and close to
erez281's own 1,876. An observation from two runs, not a power curve, and recorded as such.

**Operative residual minimum: 1,786 admissible blitz games.**

### Stated limitations

- One reference player, and it is the case the method was developed on. These effect sizes are an
  optimistic end. If real personal residuals are half erez281's size, every minimum here is four
  times too small.
- Root-n covers the judge only. The search floor has no power calculation at all.
- Decisions-per-game differs by 1.3x between the two observed players (24.5 vs 31.9), so game-count
  minimums are approximate. The decision-count minimums are the real ones.
- These say when the instrument **can** return a candidate, not how often it **should**, which is
  what the cohort is for.

---

## Phase 1. Determination: `READY`. A previous `PENDING_RESOURCE` is withdrawn

This section previously said the cohort was blocked for want of a `LICHESS_API_TOKEN`. That was
wrong, and the error was mine.

**What the package believed.** `GET /api/games/user/<name>` answers 404 unauthenticated, so game
enumeration is capped at the public HTML game list: 40 pages x 12 ids = 480 raw games, ~358
admissible, ~313 blitz. Against minimums of 364 and 1,786 that put both denominators out of reach,
and Phase 1 said stop.

**What is actually true.** The endpoint answers **200 without an Authorization header**. Measured
across three accounts and twelve unauthenticated requests, every one HTTP 200, including 2,000
games in a single response, four times the supposed cap. Running the full runner on a username
alone, no token and no supplied id list, returns **1,224 games and 940 admissible** for the same
account whose frozen corpus holds 358.

**Where the false claim came from.** A comment in `scripts/build_import_corpus.ts` once read *"the
games-export endpoint answers 404 through this environment's proxy"*. The repository had **already
corrected it**: `docs/research/ACCOUNT_BRIDGE_PREREG.md` records a measured HTTP 200 and 5,987,271
bytes, and the source comment now says the claim is stale. The replication package reasserted the
withdrawn version in four documents and never measured it.

**What believing it cost.** Player B was ingested as `PROVIDED_GAME_IDS` through the 480-game cap
and holds 358 admissible games where the export gives 940 for the same account. The 100-player
cohort was stopped for a resource it never needed.

**Defect class (Phase 13): research-semantic, not infrastructure.** The client was never broken.
An unmeasured assumption was carried into a protocol document and then used to constrain a corpus
and to stop a study.

**What was repaired, and what was not.**

- `PROTOCOL.md`, `README.md`, `READINESS.md`, `PLAYER_B_READINESS.md` corrected, each naming the
  withdrawn claim rather than quietly deleting it.
- `endpoint_contract.py` added. It holds both halves: the live check that the endpoint answers 200
  unauthenticated and exceeds the 480 cap in one response, and an offline text check that no
  document in the package may reassert the withdrawn claim. The text check is what would have
  caught this.
- `USERNAME_ONLY_PROOF.json` records the runner ingesting from a username alone, end to end.
- **Player B is not refetched.** Their corpus is frozen and their result stands. Replacing a frozen
  corpus with a different one is not a repair. What changes is the reading: `NO_STABLE_STRUCTURE`
  from 358 admissible games is a null under a corpus the client truncated, and
  `REPLICATION_VERDICT.md` is amended to say so.
- **No research rule changed.** Eligibility, thresholds, splits, the population contract, the judge,
  the classifier, the sampling design and every power minimum are untouched. The minimums in
  `POWER_PLAN.json` are byte-identical before and after this correction; only the reach block moved.

---

## Phase 5. Metadata-only feasibility

Frame: the first 80 MB of `lichess_db_standard_rated_2026-06.pgn.zst`, 256,754 games, 61,084 blitz
games at the registry's own time controls (180+0, 300+0), **34,629 distinct players, no rating
pre-filter**. Filtering the frame by rating would bake the band gate into the denominator and make
the yield circular. Seeded sample of 3,000; 2,879 screenable. Public profile metadata only: no game
fetched, no position scored, no analysis result read.

### The band gate dominates

The registry holds **one** band, `[1450, 1850]`. A player is reachable only if their **own** derived
band is that one, so their blitz median must round to 1650: a **50-point window (1625–1675)**, not a
400-point one.

| gate | passing | rate |
|---|---|---|
| derived band in registry | 146 / 2,879 | **5.1%** |
| volume, broad (≥364 admissible games) | 2,639 | 91.7% |
| volume, residual (≥1,786 admissible blitz) | 2,014 | 70.0% |
| **band AND broad** | **143** | **5.0%** |
| **band AND residual** | **113** | **3.9%** |

Volume is not the scarce resource. The registry's single band is. Roughly **2,014 screens per 100
broad-powered players, 2,548 per 100 residual-powered**.

### The screen cannot confirm the band, only nominate

The screen reads a current rating; the instrument reads the median over the fetched window. Measured
against each player's own June games as a second reading:

- median absolute drift **46 points**, p90 **118**
- band disagreement between the two readings: **7.7%** of all screened
- of the 146 screen hits, **40 (27.4%)** confirm under the second reading

June is three months stale and the pipeline reads a recent window, so 27.4% is a floor on
confirmation, not an estimate. What it establishes stands regardless of direction: **drift is the
same order as the 50-point bucket the band rule quantises to**, so no single rating reading can
decide the band. Confirmation costs a fetch per candidate and cannot be bought with metadata. This
is the failure that rejected `livio68` (rated 1655, window median 1772) at eligibility.

Profile ratings move between runs, so a re-screen is not reproducible. `SCREENED_FRAME.json`
persists every row that was read, with a `frame_hash`, and `--from-frame` recomputes every gate from
it deterministically. Phase 6 needs a frame fixed before selection, and that is the frame.

---

## The cohort-shape question this was run to answer

Both denominators are reachable. The blocker was never the platform.

| | reachable | cost |
|---|---|---|
| 100 BROAD_POWERED | yes | ~2,014 screens, then a fetch per candidate to confirm the band |
| 100 RESIDUAL_POWERED | yes | ~2,548 screens, ~1,800 blitz games each |

Two facts decide the shape:

1. **The residual subset is not a small tail.** 113 of 146 band-hits also clear the residual volume
   gate, so it is 77% of the cohort by count. The cost is engine time. Measured on the vibesgalore
   run: 25,487 positions over 358 games in 13.3 minutes wall clock on three workers, so 71 positions
   per game at 32 positions/s. A residual-powered player at 1,786 blitz games is ~127,000 positions,
   **~66 minutes each, about 110 hours for 100** on this machine, before any analysis. A
   broad-powered player at 364 games is ~14 minutes each, about 23 hours for 100.
2. **One registered band caps the whole design at 5% of the platform.** That is independent of
   ingestion. Widening beyond it means building population baselines for further bands, which is new
   research infrastructure and a decision that is not mine to take.
