# Final head freeze, and readiness for a replication player

## 1. What is frozen

| item | value |
| --- | --- |
| contract version | `replication-1.0.0` |
| pipeline hash | `eb840a439af4439bd44ed5a8da5ca76569fb8c68d38c34a6ba19eb2961da3143` |
| protocol hash | `87b1083e3a51d392696a…` (over `contract.py` and `PROTOCOL.md`) |
| equivalence gate | `GATE-GENERIC-PIPELINE-EQUIVALENCE`, 16 checks, 261 artefacts |
| classifier | target precedence, `cls_hung_material` before `cls_tactical`; quality orders only within a target |
| base branch | `main` at `06828af` |

The **pipeline hash** is the identity that matters, not the head SHA. A run records the commit it
executed on; committing that run's own artefacts then moves the head past it, so the SHA can never
match afterwards and asserting it would be theatre. The hash covers the seventeen files that decide
research content, and `verify_run.py` is what holds a run against it.

Both runs in the tree carry that same hash, and both were frozen on a clean source tree:

| run | code SHA at freeze | `repo_dirty` | pipeline hash |
| --- | --- | --- | --- |
| `lichess_erez281_RUNOFRECORD` | `c44c3f7` | false | `eb840a439af4439b…` |
| `lichess_vibesgalore_B` | `459eaeb` | false | `eb840a439af4439b…` |

`repo_dirty` means the SOURCE tree, and only since this round: it used to count a run's own outputs,
so it was true for every run by construction and certified nothing.

## 2. Equivalence after the classifier fix

The classifier defect was a real change to the generic pipeline, so the equivalence that ran before
it does not carry. Re-run against the run of record, on the fixed code:

```
GATE-GENERIC-PIPELINE-EQUIVALENCE = GREEN      16 checks, 261 artefacts, 0 failing
positive controls                 = PASS       5 of 5 turn the gate red
```

Compared: corpus membership, splits, features (bitwise, with the corpus label compared as an
identity column), R\*, R\*\*, both residual targets, bootstrap winners, invariance, stability,
the TEST read, the population model and comparison, the classifier verdict and its ordering, and the
final evidence state.

**BUG FIXED · BASELINE SEMANTICS PRESERVED · FINAL VERDICT UNCHANGED.** The defect ranked passing
residual candidates by DERIVE quality across targets, a quantity the mission ledger says is not
comparable between targets with different base rates. It changed the ORDER candidates are listed in.
It did not change which is R\*\*, and it did not change the class. Before and after: R\*\* is
`material_balance:[0:3[ AND own_overloaded_piece_count>=1` on `cls_hung_material`, VALIDATE
population-residual z 4.5202, class `PERSONAL_RESIDUAL_CANDIDATE`. On erez281's own data the two
orderings coincide, which is why the control for it runs against a fixture built to separate them.

## 3. The erez281 run of record

`COMPLETE`. `verify_run.py` reports 0 problems: every required artefact present, every stage
present, the pre-registration's self-hash intact, the tree clean at freeze, and the run's pipeline
hash equal to the working tree's.

```
FETCH MANIFEST -> ELIGIBILITY -> CORPUS FREEZE -> SELF-HASHED PREREG -> SPLITS ->
POPULATION RESOLUTION -> R* -> R** -> R** SECOND TARGET -> INVARIANCE -> STABILITY ->
TEST -> POPULATION COMPARISON -> CLASSIFICATION -> REPORT
```

One stage was not re-executed: the engine. `SCORED_PROVENANCE.md` in the run directory says so, and
says why — the committed frozen engine lines are the ones every published erez281 number was
computed from, so using them makes this an exact re-derivation rather than a second, differently
seeded one. Everything downstream of the engine was executed by this run.

## 4. Population-band readiness — the correction that matters

Readiness is **not** "the player's rating lies inside a registered band". The band is centred on the
player:

```
derived band = round(median blitz rating / 50) * 50  ±  200
```

so it is the DERIVED band that must exist in the registry, and there is no "near enough": a
mismatched band silently redefines what "a same-rating player" means.

| median | derived band | registry | ready |
| --- | --- | --- | --- |
| 1500 | 1300–1700 | miss | **no** — even though 1500 lies inside 1450–1850 |
| 1626 | 1450–1850 | `population_2026-06` | yes |
| 1654 | 1450–1850 | `population_2026-06` | yes |
| 1772 | 1550–1950 | miss | no |

With one registry entry the admissible window is `round(median/50)*50 == 1650`, an integer blitz
median of **1626–1674**. The endpoints are not decorative: 1625 rounds DOWN to 1600 under Python's
banker's rounding and lands on 1400–1800, while 1625.5 rounds to 1650.

```
PLAYER_READY =
    platform is supported
AND the corpus carries blitz games
AND the corpus is sufficient under contract.MIN_CORPUS
AND the DERIVED band is one the registry holds
AND game enumeration is available for the account
AND the equivalence gate is GREEN on the head being run
```

`readiness.py` is the predicate; `python readiness.py --window` prints the window; the gate checks
the 1500 miss and the 1654 hit on every run.

## 5. Player B eligibility, established before any analysis

Candidate pool: usernames in a 180+0 or 300+0 Termination-Normal game with Elo 1580–1720 in the
first 80 MB of the public 2026-06 dump, excluding erez281, all 2,049 accounts on either side of his
frozen window, all 1,200 population-corpus sides, and the plumbing-demo account. 4,642 candidates,
ordered by `sha256("playerB:20260907:<username>")`.

The first attempt screened on the account's CURRENT blitz rating as a proxy for the median the rule
reads, and the proxy failed on its first pick: `livio68` is rated 1655 today and their window median
is 1772, because they slid from about 1770 to about 1660 across it. Rejected at eligibility with
nothing scored, so no analytic choice was taken from them; their corpus and draft pre-registration
were deleted rather than kept as though they were a run.

The screen now applies the exact criterion, in the pre-declared order, with no pre-filter at all:

| # | candidate | window blitz median | derived band | registry | verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | HarrySeaward | 1551 | 1350–1750 | miss | rejected |
| 2 | **vibesgalore** | **1626** | **1450–1850** | `population_2026-06` | **Player B** |

`vibesgalore` satisfies every required condition: lichess, blitz, 358 admissible games (313 blitz),
derived band registered, no prior use in mechanism development, absent from the population corpus
and from the positive-control fixtures, and reproducibly reachable.

## 6. Player B pre-registration

```
prereg hash   14b8fc42606103b67e996d254b7c889b65e659c5321febb9ea82bc6fccca114f
code SHA      459eaeb, tree clean
pipeline hash eb840a439af4439bd44ed5a8da5ca76569fb8c68d38c34a6ba19eb2961da3143
protocol hash 87b1083e3a51d392696a…
input mode    PROVIDED_GAME_IDS
```

Written after the corpus was frozen and before a single position was scored. It carries the
platform identity, the retrieval record, the eligibility rules, the expected band and the registry
entry that serves it, the split contract, every threshold, both residual targets in their frozen
precedence, the classification order, the output classes, the failure codes and the stopping rules.

**The input mode is recorded rather than glossed.** Lichess answers 404 to the by-username export
without a token in this environment, which the mission ledger recorded a year ago. The ids came from
the account's public game list and were then fetched through the canonical `_ids` endpoint, so the
records in the corpus are the API's own. This run can therefore replicate the METHODOLOGY. It is not
proof of username-only ingestion, and the two claims are kept apart.

The platform paginates that list at 40 pages, so 480 games is the ceiling without a token. The
declared window of 800 admissible games is never reached, and the corpus is every admissible game
among the 480 most recent the platform lists.

## 7. Power, stated before the result

Player B's corpus is about a sixth of erez281's, and that is a statement about POWER, not about the
player. Scaling the baseline's own VALIDATE statistics by √n:

- a broad region of erez281's size (within-game z 11.24 on 10,626 VALIDATE decisions) would still
  clear the frozen z ≥ 3.5 bar on a frame this size;
- a personal residual of R\*\*'s size (population-residual z 4.52) would **not**. It scales to
  roughly 1.7, well under the bar.

So on this corpus the broad stage can fire and the residual stage is underpowered for an effect the
size of the one found on erez281. A `LEVEL_TYPICAL_ONLY` outcome for Player B therefore means "no
personal residual is detectable at this corpus size under the frozen bar", never "this player has
none". This is written here, before the result, so it cannot be recruited afterwards.
