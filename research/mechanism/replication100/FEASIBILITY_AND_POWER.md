# 100-player replication: power and feasibility, before a single name is chosen

Phases 0, 1, 2 and 5 of the cohort mission. Written before selection so that a later null result
can be read as evidence about players rather than evidence about the corpus.

Artefacts: `INSTRUMENT_FREEZE.json`, `POWER_PLAN.json`, `FEASIBILITY_SCREEN.json`,
`SCREENED_FRAME.json`.

---

## Phase 0. The instrument is frozen

| | |
|---|---|
| `instrument_hash` | `a3bc3fb9b0809fec8792c74efd9f886cb2a2fdb6d830afa91319820d351e5833` |
| `pipeline_hash` | `eb840a439af4439bd44ed5a8da5ca76569fb8c68d38c34a6ba19eb2961da3143` |
| `protocol_hash` | `87b1083e3a51d392696ad293c129b400a7629669845d616d439e2262621a957b` |
| `repo_sha` | `f36db1d`, tree clean |
| `GATE-GENERIC-PIPELINE-EQUIVALENCE` | GREEN, 16 checks, 261 artefacts, 0 failing |
| positive controls | 5/5 turn the gate red |
| runs on the record | erez281 `PERSONAL_RESIDUAL_CANDIDATE`; vibesgalore `NO_STABLE_STRUCTURE` |

Player 1 and Player 100 would be judged by this. Anything not named in `INSTRUMENT_FREEZE.json` is
not part of the instrument and may not silently become part of it later.

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
searchable DERIVE needs **1,786 admissible blitz games**, which is above the judge's 1,173 and close
to erez281's own 1,876. This is an observation from two runs, not a power curve, and it is recorded
as such.

**Operative residual minimum: 1,786 admissible blitz games.**

### Stated limitations

- One reference player, and it is the case the method was developed on. These effect sizes are an
  optimistic end. If real personal residuals are half erez281's size, every minimum here is four
  times too small.
- Root-n covers the judge only. The search floor has no power calculation at all.
- Decisions-per-game differs by 1.3x between the two observed players (24.5 vs 31.9), so game-count
  minimums are approximate. The decision-count minimums are the real ones.
- These say when the instrument **can** return a candidate. They say nothing about how often it
  **should**, which is what the cohort is for.

---

## Phase 5. Metadata-only feasibility

Frame: the first 80 MB of `lichess_db_standard_rated_2026-06.pgn.zst`, 256,754 games, 61,084 blitz
games at the registry's own time controls (180+0, 300+0), **34,629 distinct players, no rating
pre-filter**. Filtering the frame by rating would bake the band gate into the denominator and make
the yield circular. Seeded sample of 3,000; 2,879 screenable. Public profile metadata only: no game
fetched, no position scored, no analysis result read.

### The band gate dominates, and it is not the one that was expected

The registry holds **one** band, `[1450, 1850]`. A player is reachable only if their **own** derived
band is that one, so their blitz median must round to 1650: a **50-point window (1625–1675)**, not a
400-point one.

| gate | passing | rate |
|---|---|---|
| derived band in registry | 149 / 2,879 | **5.2%** |
| volume, broad (≥364 admissible games) | 2,632 | 91.4% |
| volume, residual (≥1,786 admissible blitz) | 1,998 | 69.4% |
| **band AND broad** | **145** | **5.0%** |
| **band AND residual** | **115** | **4.0%** |

Volume is not the scarce resource. The registry's single band is. Roughly **1,986 screens per 100
broad-powered players, 2,504 per 100 residual-powered**.

### The screen cannot confirm the band, only nominate

The screen reads a current rating; the instrument reads the median over the fetched window. Measured
against each player's own June games as a second reading:

- median absolute drift **46.5 points**, p90 **119**
- band disagreement between the two readings: **7.8%** of all screened
- of the 149 screen hits, **41 (27.5%)** confirm under the second reading

June is three months stale and the pipeline reads a recent window, so 27.5% is a floor on
confirmation, not an estimate. What it does establish stands regardless of direction: **drift is the
same order as the 50-point bucket the band rule quantises to**, so no single rating reading can
decide the band. Confirmation costs a fetch per candidate and cannot be bought with metadata. This
is the failure that rejected `livio68` (rated 1655, window median 1772) at eligibility.

The live API is not reproducible byte-for-byte between runs; `SCREENED_FRAME.json` persists every
row that was read, with a `frame_hash`, so the analysis above is reproducible from the frame even
though a re-screen is not.

---

## Phase 1. Determination: `PENDING_RESOURCE`

`LICHESS_API_TOKEN` is **absent**. The by-username export returns 404 unauthenticated, so the only
enumeration path is the public HTML game list, hard-capped at 40 pages x 12 ids = **480 raw games**.
At the admissible and blitz rates measured on the one player actually ingested this way:

| | ceiling without a token | minimum required | reachable |
|---|---|---|---|
| admissible games | 358 | 364 (broad) | **no**, 0.98x |
| admissible blitz games | 313 | 1,786 (residual) | **no**, 5.7x short |

**The ceiling binds before the player does.** Not merely for the residual question: the cap sits
just under the broad minimum too. vibesgalore cleared broad only because they average 31.9 decisions
per game against erez281's 24.5; a player at erez281's rate and at the cap lands at 1,752 VALIDATE
decisions against a 1,778 requirement.

So a cohort run now would not measure the population. Its nulls would be a property of the 480-game
cap, and Phase 15's distinction between `NO_STABLE_STRUCTURE` and "no personal residual" would be
unrecoverable for every member. Phase 1 says stop here, and this stops here.

**Not blocked by this**: the instrument freeze, the power plan, the feasibility screen, and the
sampling frame are all complete and hold whether or not a token arrives.

---

## The cohort-shape question this was run to answer

The population supports both denominators. The enumeration limit supports neither.

| | with a token | without |
|---|---|---|
| 100 BROAD_POWERED | ~1,986 screens, then fetch to confirm the band | not reachable |
| 100 RESIDUAL_POWERED | ~2,504 screens, ~1,800 blitz games each | not reachable |

Two structural facts decide the shape, and both are independent of the token:

1. **The residual subset is not a cheap add-on to the broad cohort.** 115 of 149 band-hits also
   clear the residual volume gate, so the subset is 77% of the cohort by count. The cost is not in
   finding them, it is in the engine: 1,786 blitz games each at ~24.5 decisions is ~44,000 scored
   positions per player. At the measured 30 positions/s that is roughly **24 minutes per player,
   about 40 hours for 100** on this machine, before any analysis.
2. **One registered band caps the whole design at 5% of the platform.** Widening the cohort beyond
   that means building population baselines for further bands, which is new research infrastructure
   and a decision that belongs to you, not to me.

