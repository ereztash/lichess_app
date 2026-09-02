# OwnExposure in natural chess: results against the frozen protocol

Protocol authority: `RESEARCH_QUESTION_FREEZE.md` (frozen `03613ab`, before any number here existed)
Falsifier authority: `FALSIFIERS.md`
Interpretation contract: `AMENDMENT_01.md` (recorded `859799e`, while scoring was at 52%)
Result artefact: `research/system-invariant/results/natural_generalization.json`
Corpus: `research/system-invariant/corpus/` (45,296 decisions, 90,592 searches, 5.3 MB)

---

## 0. BLUF

The relationship is **real, broad, specific and not a proxy**. It survived every falsifier written
before the data existed, including the leak control. It is not material, not mobility, not position
value, not between-player composition, and not one of three pre-named relational controls.

The frozen gate nonetheless **STOPS**, on one criterion out of nine:

```
VERDICT: SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE   (mission Outcome C)
C1-C8 PASS.  C9 FAILS: 24.32% [22.95, 25.67] against a frozen 30%.
```

Opportunities are abundant and headroom is ample. What fails is **consequence**: about three in
four higher-exposure choices among reasonable candidates cost less than the repository's own
"gave something away" threshold. The bar was set before measurement, deliberately above the rate at
which RC-05 died, and it is not met. **It has not been moved.**

---

## 1. What was run

| | |
|---|---|
| decisions | **45,296** from 1,383 sides, **1,333 players**, 9 rating bands |
| candidate rows | **348,571** (`MultiPV 8` per position) |
| engine searches | **90,592** (Stockfish 17.1, 60,000 nodes, hash cleared every search) |
| sample | 2026-07-01, `180+0`, disjoint from all three B3 periods |
| split | 800 derivation players / **533 held-out players** |
| P3 reproduction | `P3_REPRODUCED`, every published number identical |
| ingest reproduction | decisions file **byte-identical** on re-run (`01f59d35...`) |

---

## 2. The outcome carries measurable search noise

On the **15,951** decisions where the human played the engine's own best move, `quality_loss`
should be 0 and is not:

| mean | median | share > 0 | share > 0.02761 | p95 |
|---:|---:|---:|---:|---:|
| 0.0102 | 0.0024 | 55.6% | **10.89%** | 0.0429 |

Parent and child are different searches at a fixed node budget. Per `AMENDMENT_01` section B this is
a diagnostic: it moved no threshold, and it is the floor every consequence number below is read
against.

---

## 3. Test A -- natural association

Standardized coefficient on `quality_loss`, full frozen control set, **player**-cluster interval.
Positive was predicted: more exposure, worse move.

| Target | beta | 95% CI |
|---|---:|---|
| `exposure_delta` | **+0.1014** | [+0.0908, +0.1134] |
| `exposure_post` | +0.0877 | [+0.0743, +0.1033] |
| `exposure_delta`, value controls removed | +0.0670 | [+0.0560, +0.0787] |

**F-1 is not falsified.** Note the third row: removing `wp1`, `edge`, `gap12`, `n_near` and
`ambiguity_entropy` makes the coefficient **smaller**, not larger. If exposure were a marker of
already-bad positions, conditioning on position value would have absorbed it. It does the opposite.

---

## 4. Test B -- within position, on held-out players

337,706 pairs across 17,691 positions, 533 players the models never saw. Position-cluster intervals.

| Model | Accuracy | 95% CI |
|---|---:|---|
| `L` (move geometry only) | 0.4963 | [0.4934, 0.4991] |
| `L + Material` | 0.4955 | [0.4928, 0.4984] |
| `L + NC2` defense dependency | 0.4962 | [0.4934, 0.4991] |
| `L + NC1` redundant defense | 0.4975 | [0.4946, 0.5003] |
| `L + NC3` king-ring defense | 0.5020 | [0.4991, 0.5048] |
| `L + Mobility` | 0.5102 | [0.5073, 0.5131] |
| `L + Edelta` | 0.5248 | [0.5218, 0.5278] |
| **`L + Epost`** | **0.5501** | [0.5470, 0.5531] |

| Comparison | Gain | 95% CI | Frozen requirement |
|---|---:|---|---|
| `L+Epost` - `L` | **+5.38 pp** | [+5.08, +5.68] | C1: >= 1.0 pp **PASS** |
| `L+Epost` - `L+Material` | **+5.45 pp** | [+5.16, +5.76] | C2: >= 1.0 pp **PASS** |
| `L+Epost` - `L+Mobility` | **+3.99 pp** | [+3.65, +4.30] | C3: >= 1.0 pp **PASS** |
| `L+Epost` - `L+Edelta` | +2.53 pp | [+2.35, +2.69] | resulting state beats change language |
| `L+NC1` - `L` | +0.13 pp | [+0.04, +0.21] | F-A10 |
| `L+NC2` - `L` | -0.00 pp | [-0.03, +0.03] | F-A10 |
| `L+NC3` - `L` | +0.57 pp | [+0.44, +0.71] | F-A10 |

Move geometry alone sits **at chance** among the engine's own top eight, which is the right sanity
check: within a position, where a piece came from and went to carries almost nothing once the
candidate set is already good. Exposure carries 5.4 points. The three relational controls, named in
the falsifier register before any was evaluated, carry at most 0.57. **F-A10 is not falsified.**

---

## 5. The falsifiers

| Falsifier | Result | Verdict |
|---|---|---|
| **F-A1** rating, need 7 of 9 | **9 of 9** positive, all intervals exclude 0 | survives |
| **F-A2** phase, need 3 of 3 | **3 of 3** (+0.0993 endgame, +0.0997 middlegame, +0.1071 opening) | survives |
| **F-A3** clock, need 3 of 3 | **3 of 3** (+0.1079 low, +0.1059 mid, +0.0906 high) | survives |
| **F-A4** within player | **+0.0975** [+0.0864, +0.1087] | survives |
| **F-A5** within game | **+0.0976** [+0.0863, +0.1095] | survives |
| **F-A6** position value | coefficient grows when value controls are added | survives |
| **F-A7** material | +5.45 pp over a material model | survives |
| **F-A8** mobility | +3.99 pp over a mobility model | survives |
| **F-A9** leak control | permuted within player: **+0.0080 [-0.0008, +0.0162], includes 0** | **the pipeline does not leak** |
| **F-A10** negative controls | best control +0.57 pp against exposure's +5.38 pp | survives |

The rating gradient is monotone and worth naming: **+0.1622** at 800-999 falling to **+0.0354** at
2400-2599. The relationship is strongest for the weakest players.

---

## 6. Functional invariance

Exposure heuristic alone, held-out, on pairs where exposure differs:

| Pair type | Accuracy | 95% CI | Pairs |
|---|---:|---|---:|
| all | 0.5815 | [0.5751, 0.5878] | 98,560 |
| **alike** geometry (same piece type and capture status) | **0.6208** | [0.6105, 0.6318] | 17,786 |
| **unlike** geometry | **0.5729** | [0.5663, 0.5796] | 80,774 |

**Partial, not complete.** The invariant does hold across geometrically different moves, well above
chance and with a tight interval. But it is **4.79 pp weaker** there than among moves of the same
piece type and capture status. Geometrically different good moves converge on the same functional
transformation *to a degree*; they do not converge fully. The philosophical reading is not forced.

---

## 7. Scope map (D04 discipline: search on derivation, freeze, judge on unseen)

Overall held-out: **0.5815** [0.5755, 0.5879].

**All 29 depth-1 cells are SUPPORTED.** No cell is WEAK, REVERSED, or INSUFFICIENT. Ordered by
held-out accuracy:

| Region | Held-out | 95% CI | Pairs |
|---|---:|---|---:|
| `in_check=yes` | **0.7574** | [0.7268, 0.7859] | 2,164 |
| `phase=endgame` | **0.7220** | [0.6995, 0.7443] | 7,094 |
| `non_pawn_material=low` | 0.6506 | [0.6396, 0.6608] | 30,824 |
| `legal_moves=low` | 0.6492 | [0.6380, 0.6604] | 29,753 |
| `standing=losing` | 0.6355 | [0.6240, 0.6463] | 27,853 |
| `clock_pressure=high` | 0.6254 | [0.6143, 0.6360] | 34,319 |
| `band=800-999` | 0.6177 | [0.5977, 0.6371] | 8,637 |
| ... | | | |
| `phase=opening` | 0.5356 | [0.5217, 0.5483] | 22,059 |
| `clock_pressure=low` | 0.5276 | [0.5150, 0.5406] | 25,055 |
| `non_pawn_material=high` | 0.5155 | [0.5035, 0.5276] | 23,911 |

The cue is **strongest exactly where a player has least room to calculate**: in check, in the
endgame, with few pieces, few legal moves, losing, and short of time. It is weakest in complicated
opening positions with plenty of clock.

**Depth-2 frozen winner:** `in_check=yes AND phase=endgame`, chosen on derivation players alone
(0.8684 over 342 pairs), held out at **0.8400 [0.7321, 0.9361]** over **175 pairs**. The frozen
`MIN_REGION_PAIRS = 200` labels it **INSUFFICIENT**. The best-looking region in the study does not
qualify, because the rule that says so was written first.

---

## 8. Held-out incremental predictive value

533 unseen players, 18,417 decisions. Baseline is the full frozen control set; system adds
`exposure_delta` and `exposure_post`.

| | Baseline | System | Gain | 95% CI |
|---|---:|---:|---:|---|
| R-squared | 0.1280 | 0.1411 | **+0.0131** | [+0.0090, +0.0171] |
| MAE | 0.045651 | 0.045541 | +0.000110 | [-0.000023, +0.000236] |

**Both halves matter.** The variance-explained gain is real and its interval excludes zero. The
absolute error reduction is **0.011 percentage points of win probability** and its interval includes
zero. Mission section 11 forbids treating a statistically detectable but operationally negligible
gain as sufficient, and on the MAE scale this one is negligible. Exposure ranks candidates well; it
barely improves a point prediction of how much a move cost.

---

## 9. Ecology, under AMENDMENT_01

### 9.1 O2 is not exact, and was not repaired

The check demanded before use:

| | |
|---|---|
| uncapped sides | 1,303 |
| sides where the scored sequence equals the opportunity-eligible ply sequence | **0** |
| scored decisions / opportunity-eligible plies | 40,496 / 42,427 = **0.9545** |
| missing plies | 1,931 |

The per-side gap is only ever 1 (675 sides) or 2 (628 sides): every side loses its first move for
having no derivable think time, and roughly half additionally lose the last ply. Both could host an
opportunity; only forced positions are harmless. **O2 is therefore a rate over B3-eligible
decisions, not over the complete sequence, and is renamed to say so.** It is a lower bound on
opportunities per game and O3 an upper bound on games needed, which is conservative with respect to
the GO threshold.

### 9.2 Opportunity density

| Band | O1 per-decision | O2 opportunities per game | O3 games per opportunity |
|---|---:|---:|---:|
| 800-999 | 38.55% | 10.90 | 0.092 |
| 1000-1199 | 35.29% | 9.96 | 0.100 |
| 1200-1399 | 34.03% | 10.09 | 0.099 |
| 1400-1599 | 34.41% | 10.54 | 0.095 |
| 1600-1799 | 34.59% | 11.34 | 0.088 |
| 1800-1999 | 34.87% | 10.86 | 0.092 |
| 2000-2199 | 33.89% | 11.98 | 0.083 |
| 2200-2399 | 33.70% | 11.80 | 0.085 |
| 2400-2599 | 33.43% | 11.62 | 0.086 |

| Pooled estimand | Value |
|---|---:|
| **O4** population-weighted (declared target population, weights counted in this prefix) | **34.54%** |
| **O5** player-weighted, 1,333 players equally | 34.61% |
| **O6** decision-weighted, **sampler-weighted, NOT a population rate** | 34.64% |

The three agree to within 0.10 pp, because the opportunity rate turns out to be nearly flat across
bands. **That agreement is a finding, not a licence:** it was not knowable before measuring, and the
weighting machinery was required to establish it rather than assume it.

**A player meets an eligible opportunity roughly every 0.09 games**, i.e. about eleven per game.
`C7` asked for 5% of decisions; the answer is about 34.5%.

### 9.3 Headroom

**36.02%** (4,215 of 11,703 opportunities where the played move was itself a reasonable candidate).
A further **3,987** opportunities are unclassifiable because the human played outside the reasonable
set entirely; those are a different failure and are not counted as headroom.

### 9.4 Consequence -- the criterion that fails

Among the 4,215 decisions where a human chose a higher-exposure reasonable candidate:

| | |
|---|---|
| mean `quality_loss` | 0.0174 |
| median | 0.0110 |
| **share >= frozen 0.02761** | **24.32%**, 95% game-cluster CI **[22.95, 25.67]** |
| noise floor at the same threshold | 10.89% |
| separable from noise | **yes** (22.95 > 10.89) |
| secondary, share >= noise p95 (0.0429) | 11.29% |

`C9` required **30%**. The observed interval lies **entirely below** it.

**This is not a measurement limit.** `AMENDMENT_01` B.4 reserved `MEASUREMENT_LIMITED` for a
consequence rate inseparable from search noise; this one is separable with room to spare. The
shortfall is a real property of the decisions.

**And it is not an artefact of two frozen constants interacting.** `REASONABLE_BAND = 0.05` caps a
candidate's MultiPV regret, and `0.02761` is 55% of that cap, so the two could have been in tension.
They are not: realised `quality_loss` is **not** bounded by the band (7.40% of these decisions
exceed 0.05, maximum 0.1838), because the post-move search sees deeper than the MultiPV estimate.
The check was run because the interaction looked suspicious, and it exonerated the design.

---

## 10. The frozen gate

| | Criterion | Required | Observed | |
|---|---|---|---|---|
| C1 | within-position gain over `L` | >= 1.0 pp, CI above 0 | +5.38 pp [+5.08, +5.68] | **PASS** |
| C2 | not a material proxy | >= 1.0 pp | +5.45 pp [+5.16, +5.76] | **PASS** |
| C3 | not a mobility proxy | >= 1.0 pp | +3.99 pp [+3.65, +4.30] | **PASS** |
| C4 | not a position-value proxy | sign held, CI excludes 0 | +0.1014 [+0.0908, +0.1134] | **PASS** |
| C5 | breadth | 7/9 bands, 3/3 phases, 3/3 clock | 9/9, 3/3, 3/3 | **PASS** |
| C6 | within-player | CI excludes 0 | +0.0975 [+0.0864, +0.1087] | **PASS** |
| C7 | opportunity density | >= 5.0% | 34.54% | **PASS** |
| C8 | headroom | >= 20% | 36.02% | **PASS** |
| C9 | consequence | >= 30% at 0.02761 | **24.32% [22.95, 25.67]** | **FAIL** |

Frozen mapping: *"C1-C6 hold but C7 < 1.0%, or C8 fails, or C9 fails"* maps to

```
SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE
```

### 10.1 Where that label is accurate, and where it is not

Mission Outcome C reads: *"The relation is real but opportunities/headroom/consequence are too
sparse to support useful natural transfer."*

The first clause is right. **The middle of the clause is wrong on this data.** Opportunities are not
sparse (34.5% of decisions, eleven a game) and headroom is not sparse (36%). Only consequence falls
short, and it falls short of a bar set at nearly three times RC-05's failure rate.

Reporting the verdict without that correction would misdescribe the result. Reporting a different
verdict because the label reads awkwardly would be moving the gate. The gate is applied as frozen,
and its meaning clause is corrected in the same breath.

---

## 11. What this licenses, and what it does not

**Licensed:** nothing to be built. `C9` failing means the implementation path in mission sections
15-21 does not open. No product integration, no `PolicyExposure` record, no shadow matcher, no P5
instrumentation.

**Established, at the level the evidence supports:** across 45,296 natural blitz decisions by 1,333
players, a board-derived count of the mover's pieces left with more attackers than defenders after a
candidate move carries information about move quality beyond move geometry, material, mobility,
position value and three comparable relational quantities, within position, within player, within
game, in all nine rating bands, all three phases and all three clock strata, and it does not survive
a within-player permutation. It ranks candidate moves; it barely improves a point prediction.

**Not established:** that a human taught this changes any decision. `AMENDMENT_01` section A holds:
P4 is human-usability evidence, not cue-specific efficacy, and no result in this document speaks to
transfer.
