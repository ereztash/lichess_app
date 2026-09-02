# OwnExposure as a natural decision policy -- FROZEN BEFORE ANY OUTCOME WAS COMPUTED

Status: **PREREGISTERED / NOT YET RUN**
Date: 2026-09-02
Branch: `claude/system-invariant-natural-transfer`
Starting SHA: `03fcea95ce70ad1e8e875c34e5fb47f0496d7b5e` (head of PR #66)
`main` at freeze: `c848f244d380e13a8622c590791b22a2bef7a39b`

Downstream artefact whose commit must be a descendant of this freeze:
`docs/system-invariant/NATURAL_GENERALIZATION.md`.

---

## 0. What this freezes, and why it exists

`P3` established that a 48-column system-state block ranks moves better than local move geometry,
inside one narrow population. `P4` established that one column of that block can be compressed into
a Hebrew sentence that one human learned. The pressure-exposure test established that the same
column, alone, carries most of that ranking gain and that its offensive mirror does not.

None of those touched natural chess. All three ran on the same corpus: positions where a designated
threat trigger fires, with candidate moves restricted to a rule class's permitted set `B(s)`.

The question this mission must answer is whether the column survives contact with ordinary play.
The honest possibility, stated here before any number exists, is that it does not, or that it
survives only as a restatement of material or of position value. This document is written so that
outcome cannot be reframed later as something else.

**A negative result is a successful execution of this protocol.**

---

## 1. The research question

> Does a board-derived change in OwnExposure explain natural move quality beyond individual-piece
> information and existing coarse position/context variables, and if so, under which contexts is the
> relationship strong enough and frequent enough to support a measurable future behavioural
> intervention?

Formal target:

```
MoveQuality ~ OwnExposure + Position/Context Controls + Player Strength + Game/Player Dependence
```

The pipeline this mission is testing the first half of:

```
natural corpus -> system invariant -> scope -> opportunity density -> human cue
-> behavioural policy -> exposure -> uncued natural opportunity -> future decision
```

---

## 2. The construct, taken from the implementation and not from any prose

**Authority:** `research/learning-v3/p3_system_invariant.py`, function `side_piece_metrics`, the
branch `if attackers > defenders: overloaded_count += 1`. Named in
`docs/learning-v3/SYSTEM_INVARIANT_P3_PREREG.md` line 103 and used as the P4 cue in
`docs/learning-v3/HUMAN_CUE_N1_RESULT.md`.

```
OwnExposure(board, color) =
  | { s : board.piece_at(s).color == color
        and board.piece_at(s).piece_type != KING
        and |board.attackers(not color, s)| > |board.attackers(color, s)| } |
```

| Question | Frozen answer |
|---|---|
| input | a `chess.Board` and a candidate `chess.Move` |
| resulting board | `board.copy(); board.push(move)` |
| whose pieces are counted | the **mover's own** pieces |
| what counts as exposure | strictly more enemy attackers than own defenders, **raw counts** |
| pinned pieces | **not** special-cased; a pinned defender still counts as a defender |
| kings | **excluded** from the counted set |
| pawns | **included** |
| metric type | unweighted **count** of pieces, not a value sum, not a proportion |
| measured when | `pre` (before move), `post` (after move), `delta = post - pre` |
| engine information | **none** |

### 2.1 Contamination check (mission section 2 requires this before proceeding)

The computation path is `board.piece_map()`, `board.attackers()`, `board.attacks_mask()`,
`board.is_pinned()`, `chess.popcount`. No Stockfish call, no SEE, no tablebase, no
principal variation, no future game result, no human move-quality label enters the definition.

**Result: no construct contamination. The metric is board-derived.**

This is a statement about the metric only. Everything downstream that *scores* a move uses the
engine, which is why the outcome and the construct are kept in separate sections of this document.

### 2.2 Known weaknesses of the construct, recorded now so they cannot be produced later as excuses

1. **It is not Static Exchange Evaluation.** A queen attacked once and defended once is *not*
   exposed by this definition, though the exchange loses a queen for a pawn. A pawn attacked twice
   and defended once *is* exposed, though it may be worth nothing.
2. **It is unweighted.** A hanging queen and a hanging pawn each contribute exactly 1.
3. **X-rays and discovered attacks** are only modelled as far as `python-chess`'s `attackers`
   models them.
4. **It is a count over the whole board**, so it moves when pieces far from the action change
   status.

If the natural test fails, these are candidate reasons. They are not licence to redefine the
construct and retest: the construct under test is the one P3 measured and P4 taught, because a
different definition would not be evidence about the cue a human was actually given.

---

## 3. The outcome, taken from B3 and not invented here

**Authority:** `research/b3_population_expertise/FEATURE_SCHEMA.md` section 9.

```
quality_loss = wp1_before - (1 - wp1_after)      clipped at 0 below
```

Win-probability units, `[0, 1]`, where `wp1_after` is the best line of the post-move search (from
the opponent's point of view, hence `1 - `). `win_probability(cp) = 1 / (1 + exp(-0.00368208 * cp))`,
ported from `shared/win-probability.ts`. Mate is `+/- 10000` comparable centipawns.

Centipawns are never a reported unit, for the reason B3 gives: 30 cp costs 2.76 percentage points of
winning chances at a level position and 0.28 at +10.00, so a centipawn is not one thing.

Derived repository constant used as a threshold below:
`ACCURATE_WIN_PROBABILITY_LOSS = 0.02761` win probability, what 30 cp costs at a level position.

**This outcome is frozen. It will not be swapped for a cleaner-looking one.**

---

## 4. Population, and the new-compute preregistration

### 4.1 Why existing preserved compute cannot answer this

Required by mission section 0.5 before any new engine evaluation is requested. Coverage of
`research/learning-v3/corpus/engine_evaluations.jsonl.zst`, counted at the freeze:

| | |
|---|---|
| evaluations preserved | 70,595 |
| `kind=move` | 37,226 (`multipv-over-B` 28,637, `full-width` 8,589) |
| `kind=set` | 33,369 (`root-restricted-max`) |
| positions with at least one move evaluation | 8,399 |
| modal moves evaluated per position | 2 (3,362 positions), then 3 (1,257) |

Every one of those move evaluations is restricted to a rule class's permitted set `B(s)`, on
positions selected because a designated-threat trigger fires. The corpus contains **no natural
played move carrying a quality label**, and no subset of it can be rearranged into one: the quantity
`quality_loss` requires a post-move search of the position a human actually reached, and those
searches were never bought.

**Conclusion: the required quantity is not derivable from preserved evaluations. New compute is
justified.** Nothing already in the corpus will be recomputed; the standing rule
(position + move + build + nodes + policy + root set) is enforced by `research/learning-v3/cache.py`
and every new evaluation is written back content-addressed.

### 4.2 The natural sample

Reuses `research/b3_population_expertise/src/ingest.py` -- B3's sampler, exclusions and eligibility
rules -- rather than a parallel ingest.

| | |
|---|---|
| source | `https://database.lichess.org/standard/lichess_db_standard_rated_2026-07.pgn.zst` |
| month | **2026-07** |
| time control | `180+0` |
| target decisions | **40,000** |
| seed | `20260902` |

**2026-07 is chosen because B3 used 2026-02, 2026-04 and 2026-06.** The sample is disjoint from
every B3 period, so `results/FINAL_HOLDOUT_SEALED.json` is neither opened nor contaminated, and no
result here is a B3 result. B3 supplies the instrument, not the rows.

### 4.3 Engine configuration, frozen

| Setting | Value | Why |
|---|---|---|
| binary | Stockfish 17.1 `x86-64-avx2` | same build as B3 and as the learning-v3 corpus |
| `Threads` | 1 | B3 |
| `Hash` | 32 MB | B3 |
| budget | `go nodes 60000` | B3; a node limit does not depend on machine load |
| hash reset | `ucinewgame` + `isready` before every search | B3 |
| pre-move search | `MultiPV 8` | **the one deliberate departure from B3's 4**, below |
| post-move search | `MultiPV 1` | only `wp1_after` is needed |

**Why MultiPV 8 and not B3's 4.** Test B is a within-position comparison and needs a candidate set.
At `MultiPV 4` a position contributes at most 6 pairs and the candidates are all near-best. At 8 the
set reaches moves a human might plausibly choose but the engine ranks lower, which is the population
the policy is actually about. The cost is one search per position either way, not K searches. The
consequence is recorded honestly: `MultiPV 8` at a fixed node budget searches each line less deeply
than `MultiPV 4` at the same budget, so these values are **not** interchangeable with B3's and no
number here may be pooled with a B3 number.

### 4.4 What each search buys

One pre-move search supplies, from the same 60,000 nodes: `wp1`, `edge`, `gap12`, `gap1k`, `n_near`,
`ambiguity_entropy`, `is_mate_line`, and the top-8 candidate moves with values. One post-move search
supplies `wp1_after`, hence `quality_loss`. Test A, Test B, functional invariance, the D04 scope
map, the held-out test and the opportunity-density measurement are all served by that single buy.

---

## 5. Test A -- actual-move natural association

For each eligible natural decision: position before the move, the human's move, hence
`OwnExposure_post` and `OwnExposure_delta`.

**Estimand:** the standardized coefficient of `OwnExposure_delta` (and separately
`OwnExposure_post`) on `quality_loss`, in a model carrying the controls below.

**Controls** (all `PRE_MOVE`, all from B3's frozen schema): `ply`, `phase`, `non_pawn_material`,
`legal_moves`, `in_check`, `standing`, `rating`, `rating_diff`, `clock_frac`, `clock_pressure`,
`log_time`, `opp_prev_think_s`, `wp1`, `edge`, `gap12`, `n_near`, `ambiguity_entropy`,
`is_mate_line`.

**Dependence:** primary uncertainty is a **player-level cluster bootstrap**, 5,000 replicates, seed
`20260902`. Players, not decisions, are the resampling unit, because 40,000 decisions come from far
fewer players and treating them as independent is how a dependence-blind pipeline manufactures
certainty.

**Direction predicted before the run:** more exposure predicts *more* `quality_loss`, i.e. a
**positive** coefficient.

---

## 6. Test B -- within-position candidate discrimination

More decisive than Test A, because it removes position-level confounding by construction.

For each position, take the `MultiPV 8` candidate list. `regret(m) = wp1 - wp(m)`.

**Unit:** an unordered pair of candidates from the **same position** whose regrets differ by at
least `PAIR_EPSILON = 0.01` win probability.

**Score:** pairwise ranking accuracy. Model ties score 0.5. This is P3's scoring rule, reused.

**Comparator ladder**, matching the pressure-exposure test so the two are readable against each
other:

| Model | Features |
|---|---|
| `L` | local move descriptors only: moving piece type, capture flag, captured piece value, promotion piece type, from/to file and rank, Chebyshev and Manhattan distance, gives-check |
| `L + Epost` | `L` + `OwnExposure_post` |
| `L + Edelta` | `L` + `OwnExposure_delta` |
| `L + Material` | `L` + post-move material balance and piece count (falsifier A7) |
| `L + Mobility` | `L` + post-move legal-move count for both sides (falsifier A8) |

Model family fixed: Ridge, `alpha=1.0`, median imputation, standard scaling. No hyperparameter
search. Uncertainty: position-cluster bootstrap, 5,000 replicates.

---

## 7. Functional invariance (mission section 9)

Among candidate moves in the same position that are close in value, do moves that differ in piece
type, origin, destination, capture status and rule-class membership nonetheless agree in the
*direction* of their exposure change?

Measured as: within a position, the rank correlation between `OwnExposure_delta` and `regret`,
computed separately within strata that hold move geometry constant, and the share of positions where
the best-valued move and the lowest-exposure move coincide despite differing in geometry from the
next candidate.

**If the relationship holds only within one piece type, one motif, or one rule class, the invariant
is classified NARROW / motif-specific.** The philosophical reading is not to be forced.

---

## 8. D04 scope search -- vocabulary frozen here, before the search

Reuses D04's discipline: search on a derivation subset, freeze the winning region, judge it on rows
the search never saw.

**Split:** by **player**, 60% derivation / 40% judgement. Player-level because dependence is at
player level and a decision-level split would put the same player on both sides.

**Frozen selector vocabulary** (nothing outcome-derived, nothing algebraically derived from
OwnExposure):

`rating_band` (B3's 9 bands) | `phase` (opening/middlegame/endgame) | `clock_pressure` tertile |
`non_pawn_material` tertile | `legal_moves` tertile | `in_check` | `standing`
(winning/level/losing) | `n_near` tertile

Tertile cuts are taken **on the derivation subset only** and then frozen, so no cut is a function of
the rows it is judged on.

**Excluded as selectors, with reasons:** `quality_loss` (it is the outcome; a region defined by it is
a restatement, the mistake D04 records making), `OwnExposure_pre/post/delta` (algebraically derived
from the construct), `wp1`/`edge` as continuous cuts (`standing` is B3's own frozen categorisation of
the same thing and keeps the space stateable).

**Depth: at most 2** conjoined selectors. Frozen here, not tuned on the judgement subset.

**Judgement rule, declared before the search:** a region is SUPPORTED only if, on the held-out
players, the effect keeps its sign, keeps at least **50%** of its derivation-subset magnitude, and
its 95% cluster interval excludes zero.

Output is a **scope map** with every cell labelled SUPPORTED / WEAK / REVERSED / INSUFFICIENT. A
single cherry-picked subgroup is not an acceptable output.

---

## 9. Held-out incremental value (mission section 11)

Nested comparison, judged on the 40% held-out players:

```
Baseline: quality_loss ~ controls
System:   quality_loss ~ controls + OwnExposure
```

Reported: absolute predictive gain, cluster interval, calibration, whether the gain is concentrated
in one context, and whether it survives player-held-out evaluation.

**A statistically detectable but operationally negligible gain is not sufficient**, per mission
section 11. The operational floor is declared in section 11 below.

---

## 10. Opportunity, headroom, consequence -- definitions frozen before prevalence is measured

This is the section RC-05 died in. It passed its measurement gates and failed on opportunity rate
(0.206% of positions, 42.5% declines, 5.4% costing 0.10 xs, about 4.7e-5 per position).

### 10.1 An OwnExposure decision opportunity

A natural decision qualifies when **both** hold:

1. **at least two candidates are reasonable**: at least 2 moves in the `MultiPV 8` list are within
   `REASONABLE_BAND = 0.05` win probability of the best;
2. **the cue discriminates among them**: those reasonable moves differ in `OwnExposure_post` by at
   least 1.

Condition (1) exists so the policy can never be scored as recommending an obviously inferior move.

**The circularity this contains, stated before it is measured.** Condition (1) uses engine value, so
the *opportunity* is engine-defined even though the *cue* is not. A player at the board cannot
compute "within 0.05 of best". The honest reading is that the policy is a **tie-breaker over
whatever candidate set the player already generated**, and that set is unobservable. A value-free
opportunity rate (at least 2 legal moves differing in `OwnExposure_post`, no value filter) is
therefore reported **beside** the primary rate, and the gap between them is part of the result, not
a footnote.

### 10.2 Headroom

Among opportunities, the share where the human chose a **higher**-exposure reasonable candidate when
a lower-exposure reasonable candidate existed.

### 10.3 Consequence

Among the opportunities where the human took the higher-exposure option, the distribution of
`quality_loss` cost, and the share where that cost is at least
`ACCURATE_WIN_PROBABILITY_LOSS = 0.02761`.

All three are reported **separately** before any product-level aggregation.

---

## 11. The GO / NARROW / STOP rule, written before the numbers exist

Thresholds and their justification. None of these may be moved after a number is seen.

| Criterion | Threshold | Where the threshold comes from |
|---|---|---|
| **C1** within-position gain | `L+Epost` beats `L` by at least **1.0 pp** with position-cluster 95% CI lower bound above 0 | the narrow-population pressure-exposure gain was +5.76 pp; below 1 pp in natural play is operationally negligible, which mission section 11 forbids treating as sufficient |
| **C2** not a material proxy | `L+Epost` beats `L+Material` by at least **1.0 pp** | attack 1 |
| **C3** not a mobility proxy | `L+Epost` beats `L+Mobility` by at least **1.0 pp** | attack 2 |
| **C4** not a position-value proxy | Test A coefficient keeps its sign and CI excludes 0 with `wp1`, `edge`, `gap12`, `n_near` in the model | attack 3 |
| **C5** breadth | sign consistent in at least **7 of 9** rating bands, **3 of 3** phases, **3 of 3** clock tertiles | anything less is not "broad enough to matter" |
| **C6** within-player | the effect survives within-player estimation with CI excluding 0 | otherwise it is between-player composition |
| **C7** opportunity density | at least **5.0%** of natural decisions | B3 gives 33.4 decisions per analysed side, so 5.0% yields 100 eligible opportunities in about 60 games, the smallest feasible self-experiment window |
| **C8** headroom | at least **20%** | with 100 opportunities the SE of a proportion difference is about 5 pp; a baseline above 80% leaves less headroom than the instrument can resolve |
| **C9** consequence | at least **30%** of higher-exposure choices cost at least 0.02761 wp | RC-05 died with 91.2% of its declines costing nothing; this is a deliberate raise over that failure, set before measurement |

### Verdict mapping

```
STOP    -- SYSTEM POLICY REJECTED
          any of C1, C2, C3, C4 fails, or C6 fails.
          The relationship is absent, or is a restatement of material, mobility or position value.

STOP    -- SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE
          C1-C6 hold but C7 < 1.0%, or C8 fails, or C9 fails.
          Real but unreachable, unimprovable, or free to get wrong.

NARROW  -- SYSTEM-INVARIANT NARROW
          C1-C4 hold but C5 fails, or C7 is between 1.0% and 5.0% overall while reaching 5.0%
          inside a region the frozen D04 vocabulary can name and the held-out rule confirms.
          Only the named scope proceeds.

GO      -- PRE-FIELD PIPELINE LICENSED
          C1 through C9 all hold.
          This licenses instrumentation. It does NOT establish human transfer.
```

---

## 12. What this freeze does not establish

That OwnExposure is correct, causal, teachable, or worth teaching. That P4's single participant
generalises. That a hash proves anything but order.

It establishes only that the question, the construct, the outcome, the controls, the falsifiers, the
scope vocabulary and the decision thresholds were fixed before any natural-play number existed.
