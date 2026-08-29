# Blitz computation research — results

Companion to [`BLITZ_COMPUTATION_PREREG.md`](./BLITZ_COMPUTATION_PREREG.md), which was committed in
`901c463` before any dataset was built or any search was run.

> ## Verdict: RESEARCH ONLY
>
> **The study stopped at Gate 1 — STOP-D.** No node budget between 25,000 and 1,600,000 produces a
> deep reference stable to the preregistered tolerance, so the ground truth that every downstream
> metric is defined against does not exist at any budget this work could afford. H1 and H2 were not
> run. No construct was validated, no algorithm was derived, and nothing reaches the product.
>
> The hypotheses are **not refuted**. They were **not testable** with this instrument.

---

## 1. What was actually established

| #   | statement                                                                               | rung        | evidence |
| --- | --------------------------------------------------------------------------------------- | ----------- | -------- |
| 1   | The deep reference this design needs does not exist at 25k–1.6M nodes                   | Observation | §4       |
| 2   | Failing it is not an artefact of how the criterion was written                          | Observation | §4.3     |
| 3   | The instability is concentrated in exactly the positions a coaching product cares about | Observation | §4.4     |
| 4   | Choosing between two defensible references changes the outcome variable itself          | Observation | §5       |
| 5   | Positions do differ in how much a search changes its answer                             | Observation | §6       |
| 6   | A stable reference would cost orders of magnitude more search than the product spends   | Observation | §7       |

Nothing here reaches Prediction, and nothing reaches Causal. That is the finding.

---

## 2. Provenance

**Corpus.** Lichess open database (CC0), byte-range prefixes of two monthly archives,
stream-decompressed. Nothing was downloaded whole.

|                  | 2026-01 (development)       | 2026-04 (temporal holdout)  |
| ---------------- | --------------------------- | --------------------------- |
| prefix read      | 48,000,000 compressed bytes | 48,000,000 compressed bytes |
| games read       | 149,515                     | 146,610                     |
| games qualifying | 49,925                      | 48,090                      |

**Game-level rejections**, by the single rule that rejected each:

| rule                                              | 2026-01 | 2026-04 |
| ------------------------------------------------- | ------: | ------: |
| not rated blitz                                   |  79,961 |  79,178 |
| termination not `Normal`                          |  17,290 |  16,956 |
| too short (< 20 plies)                            |   1,920 |   1,772 |
| time control outside 180/300 base, ≤ 3s increment |     284 |     474 |
| clock stream not monotone                         |     124 |     134 |
| no clock annotations                              |      11 |       6 |

**Sample.** 10,200 decision events · 1,700 games · 2,343 distinct players · 300 recurring players
present in both months (the within-player temporal holdout that was never used, because the study
stopped first).

| stratum                                           |                        events |
| ------------------------------------------------- | ----------------------------: |
| recurring players                                 |                         7,170 |
| general                                           |                         3,030 |
| opening / middlegame / endgame                    |           3,596 / 5,922 / 682 |
| Elo `<1500` / `1500–1799` / `1800–2099` / `≥2100` | 2,982 / 2,950 / 3,255 / 1,013 |

Median think time 2.0 s. Seed `20260829`. Dataset SHA-256
`f2d4300792bb8043154601b7e6e4cd6bc71b39d77e3a3326cb4cd3a6303103e3`.

**Definitions are the product's own.** Think time, the clock the player faced, and phase come from
`shared/pgn-clock.ts` and `shared/phase.ts`; value comes from `shared/win-probability.ts`. A corpus
computed with a second definition of "seconds spent" would measure a different thing from the
product it is meant to inform.

**Engine.** Stockfish 17.1, `stockfish-ubuntu-x86-64-avx2`, `Threads 1`, `Hash 16`, hash cleared
(`ucinewgame` + `isready`) before every search, so budgets are independent and every run is
deterministic. 810,440 nodes/second on the machine that produced these numbers.

### Two silent defects found while building the corpus, recorded because both produced plausible output

1. The archives open with a zstd **skippable frame**. Node's `createZstdDecompress` rejects it
   outright — `Unknown frame descriptor`, zero bytes out. `zstd` and Python's `zstandard` step over
   it, so a probe with either would not have shown the problem.
2. The archives are a **sequence** of frames, each decompressing to exactly 32 MiB. After the
   skippable frame is stepped over, the decompressor still stops at the first frame boundary. A
   4 MB prefix and a 48 MB prefix therefore yielded 12,448 and 14,472 games — a twelvefold increase
   in input for a 16% increase in output, and neither figure looked wrong on its own. The fix
   walks frames and carries games across the boundaries; the same prefixes now yield 149,515.

---

## 3. Ground truth

Value is winning chances from the mover's point of view, `winProbability(cp)` from
`shared/win-probability.ts`, unchanged — Lichess's logistic, k = 0.00368208, fitted on 2300-rated
games. Its population caveat is inherited: the constant is a published fit for one population, not
a law of chess, and this corpus is not that population.

Mate is mapped to ±10,000 cp before conversion, exactly as `comparableCp` does, which puts it at
V = 0.9999 / 0.0001. Mate distance is deliberately not preserved.

Both tolerances are **derived** from the repository's existing accuracy rule rather than chosen:

    ACCURATE_WIN_PROBABILITY_LOSS = 0.027609   (30 centipawns at a level position)
    epsilon_strict  = that / 2   = 0.013804
    epsilon_tolerant = that      = 0.027609

---

## 4. Gate 1 — the deep reference does not saturate

**Claim under test.** There is a node budget at which doubling the budget stops changing the
answer, in which case that budget can be called the reference.

**Method.** 300 positions, stratified over 56 cells (4 Elo bands × 3 phases × 2 clock-pressure
bands × 3 evaluation bands, the last assigned by a 50,000-node prescreen of 1,500 positions).
Six budgets, MultiPV 3. A position is stable at N against 2N when both hold:

- **A′** `V_2N(m_2N) − V_2N(m_N) < ε` — the move N chose is still fine when judged at 2N;
- **B** `|V_N − V_2N| < ε` — the position's own value has stopped moving.

**Result.** The preregistered bar is 95%.

|       N |      vs | stable at ε_strict | 95% CI         | stable at ε_tolerant | 95% CI         |
| ------: | ------: | -----------------: | -------------- | -------------------: | -------------- |
|  25,000 |  50,000 |              0.717 | [0.663, 0.765] |                0.847 | [0.802, 0.883] |
|  50,000 | 100,000 |              0.707 | [0.653, 0.755] |                0.870 | [0.827, 0.903] |
| 100,000 | 200,000 |              0.773 | [0.723, 0.817] |                0.900 | [0.861, 0.929] |
| 200,000 | 400,000 |          **0.797** | [0.748, 0.838] |                0.903 | [0.865, 0.932] |
| 400,000 | 800,000 |              0.750 | [0.698, 0.796] |            **0.907** | [0.868, 0.935] |

Wilson intervals — every proportion here sits near 1, where a symmetric interval runs past 1.0 and
stops being an interval.

**No budget qualifies at either tolerance. The preregistered rule gives STOP-D.**

Mean search depth reached: 13.3 at 25k, 20.7 at 200k, 26.6 at 800k. The engine is not failing to
search; it is searching deeply and still changing its mind.

### 4.0 The gate replicates

The whole saturation study was run twice — the same seeded 300 positions, a different number of
worker processes (four, then two). Every stability rate came back **identical to four decimal
places**: 0.7167 / 0.7067 / 0.7733 / 0.7967 / 0.7500 at the strict tolerance and 0.8467 / 0.8700 /
0.9000 / 0.9033 / 0.9067 at the tolerant one. With `Threads 1` and a hash cleared before every
search the engine is deterministic, and this confirms the harness is too: nothing about the verdict
depends on scheduling.

### 4.1 Is the curve climbing, or flat?

Post-hoc, and labelled as such: the identical seeded 300 positions were re-run on a grid extended
to 1,600,000 nodes. An extension cannot rescue a failed gate — the verdict is read off the
preregistered grid — but it distinguishes "out of compute" from "does not converge".

|       N |        vs | ε_strict | ε_tolerant | 95% CI (tolerant) |
| ------: | --------: | -------: | ---------: | ----------------- |
| 800,000 | 1,600,000 |    0.830 |      0.940 | [0.907, 0.962]    |

It is climbing, slowly. At 800,000 nodes — twice the largest budget the preregistered grid could
test — the **weaker** tolerance reaches 0.940, with a CI that still straddles the bar, and the
**primary** tolerance reaches 0.830. Mean depth 29.0.

So the honest statement is neither "flat forever" nor "nearly there": convergence exists, and it
arrives somewhere past the point where the construct could be computed at all (§7).

### 4.2 How far does the reference actually move?

|V_400k − V_800k|, in winning chances:

| p50    | p75    | p90    | p95    | p99    | mean   |
| ------ | ------ | ------ | ------ | ------ | ------ |
| 0.0049 | 0.0109 | 0.0206 | 0.0271 | 0.0424 | 0.0084 |

One position in ten moves by more than 0.02 — two percentage points of winning chances — when the
reference budget is doubled. That is the scale against which every downstream effect would have had
to be measured.

### 4.3 The verdict is not an artefact of how the criterion was written

The preregistered rule counts a position unstable when the move chosen at N is **absent** from 2N's
three-line list, on the grounds that a move that cannot be shown to be fine is not counted fine.
That is the conservative half of the rule and the most likely candidate for an artefact, so it was
decomposed:

|       N | unstable | absent from top 3 | move worse by ε | position value moved | rate if _absent_ were forgiven entirely |
| ------: | -------: | ----------------: | --------------: | -------------------: | --------------------------------------: |
|  25,000 |       85 |                15 |              18 |                   61 |                                   0.767 |
|  50,000 |       88 |                17 |              12 |                   64 |                                   0.763 |
| 100,000 |       68 |                11 |              10 |                   56 |                                   0.810 |
| 200,000 |       61 |                12 |               8 |                   49 |                               **0.837** |
| 400,000 |       75 |                13 |               8 |                   63 |                                   0.793 |

The dominant failure is the **position's own value moving**, not list membership. Forgiving the
conservative half entirely still tops out at 0.837, far below 0.95.

And under the criterion the working plan itself proposed — exact best-move agreement **and** value
agreement — the numbers are considerably worse than the ones this study's own rule produced:

|       N | same best move | same best move **and** value within ε_strict |
| ------: | -------------: | -------------------------------------------: |
|  25,000 |          0.683 |                                        0.550 |
| 100,000 |          0.763 |                                        0.623 |
| 200,000 |          0.730 |                                        0.607 |
| 400,000 |      **0.783** |                                    **0.623** |

The verdict survives a criterion this study did not write, applied at the tolerance this study did
write. It is a property of the engine's behaviour on these positions, not of the rule.

### 4.4 Where the instability lives

Stability at 400k vs 800k, ε_strict:

| stratum                         | stable | 95% CI         |
| ------------------------------- | -----: | -------------- |
| phase: opening                  |  0.847 | [0.747, 0.912] |
| phase: middlegame               |  0.738 | [0.661, 0.803] |
| phase: endgame                  |  0.687 | [0.581, 0.776] |
| value: level (\|V−0.5\| ≤ 0.12) |  0.843 | [0.769, 0.896] |
| value: unbalanced               |  0.682 | [0.609, 0.747] |
| Elo `<1500`                     |  0.753 | [0.646, 0.836] |
| Elo `1500–1799`                 |  0.737 | [0.628, 0.823] |
| Elo `1800–2099`                 |  0.711 | [0.606, 0.797] |
| Elo `≥2100`                     |  0.812 | [0.700, 0.889] |

Elo barely moves it — the instability is a property of positions, not of the players who reached
them. What does move it is phase and imbalance, and in the unhelpful direction: the reference is at
its steadiest in openings and level positions, and at its shakiest in endgames and positions where
one side is already better. Those are the positions where a product would most want to say
something about how much a decision was worth thinking about.

---

## 5. What the failed gate costs: the outcome variable is not stable either

Gate 1 says the reference moves. That sentence alone does not tell anyone whether the study was
blocked by a technicality. This measures the consequence in the one place it decides everything —
the **label**.

**Method.** 700 decisions from 350 games (two per game, so the cluster bootstrap has clusters).
Each decision's cost is computed twice, against a 400,000-node reference and against an
800,000-node one, under the preregistered uniform scoring procedure (`go searchmoves <move>`), and
turned into a binary verdict by this repository's own rule,
`WPL > ACCURATE_WIN_PROBABILITY_LOSS`.

| quantity                             | 400k reference | 800k reference |
| ------------------------------------ | -------------: | -------------: |
| share of decisions called inaccurate |          28.0% |          29.4% |

|                                                                                      |                value | 95% CI                    |
| ------------------------------------------------------------------------------------ | -------------------: | ------------------------- |
| decisions whose verdict **flips** when the budget doubles                            | **5.43%** (38 / 700) | [3.86%, 7.14%]            |
| Cohen's κ between the two labellings                                                 |                0.867 |                           |
| Spearman correlation of the continuous loss                                          |                0.857 |                           |
| **AUC ceiling** — a _perfect_ model of the 400k label, scored against the 800k label |            **0.928** | sens. 0.883 / spec. 0.972 |

**The AUC ceiling is the number that ends the study.** H2's preregistered gate required a model to
beat its baseline by **ΔAUC ≥ 0.02**. Merely swapping one defensible reference for another
defensible reference costs **0.072 of AUC** — three and a half times the effect the gate was built
to detect. Any ΔAUC in the 0.02–0.03 range would have sat comfortably inside the range over which
the ground truth is arbitrary, and there would have been no way to tell the two apart.

This is why STOP-D is fatal rather than inconvenient, and there is a second reason that is worse.
The predictor and the outcome **share a term**:

    RCV(n) = V_deep(best) − V_deep(move chosen at n)
    WPL    = V_deep(best) − V_deep(move the human played)

Error in `V_deep(best)` is common to both. An unstable reference therefore does not merely attenuate
an effect toward zero, which would be survivable — it **manufactures correlation between predictor
and outcome**, in the direction that looks like a finding. H1 and H2 were not run, and
`research/blitz/run_analysis.py` refuses to run them.

### 5.1 A defect in the preregistered reference definition, found afterwards

The preregistration identifies the reference's best move with a three-line search and then scores
every move with a single-line search. Those are different instruments: the identifying search
splits its budget three ways, the scoring search gives one move the whole of it. A move ranked
second can overtake the first without anything being unstable.

It matters more than it sounds:

|                                                                                 |      rate |
| ------------------------------------------------------------------------------- | --------: |
| the MultiPV-identified best move is **not** the argmax under uniform scoring    | **26.4%** |
| the human's move scores better than the MultiPV-identified best ("incoherence") |      9.6% |
| the human's move scores better than the argmax of uniformly scored candidates   |      1.4% |

So most of the apparent incoherence is the preregistration's own definition, not the engine
contradicting itself. **This is a design defect in this study**, recorded here rather than quietly
repaired, and the fix for any future attempt is to define the reference as the argmax over
uniformly scored candidates.

It does **not** rescue the verdict, and the reason is measurable. Holding the budget fixed and
changing only the definition moves far less than changing the budget:

| what changed                           |          label flip rate |     κ | AUC ceiling |
| -------------------------------------- | -----------------------: | ----: | ----------: |
| the reference **definition** (at 400k) |     1.57% [0.88%, 2.79%] | 0.962 |       0.973 |
| the reference **budget** (400k → 800k) | **5.43%** [3.86%, 7.14%] | 0.867 |   **0.928** |

Gate 1 measured budget stability with one instrument on both sides (MultiPV 3 at N against MultiPV 3
at 2N), so the asymmetry does not touch it. The verdict stands.

### 5.2 The clustered interval, and what clustering bought

The preregistration requires resampling whole games, because moves from one game share a position
stream, an opponent, a clock and a player in one state of mind. Here it made almost no difference:
the flip indicator's correlation between the two decisions sampled from the same game is **−0.056**,
so there was very little to cluster, and the clustered and naive intervals coincide to three
decimals (bootstrap SD 0.00815 clustered against 0.00882 naive).

That is reported rather than omitted. Running the clustered analysis was right _a priori_; finding
that it changed nothing is a fact about this outcome variable, not a licence to skip it next time on
a different one.

---

## 6. What survives: positions really do differ, and less often than the idea assumes

**Rung: Observation.** This says nothing about prediction. It is measured against a reference that
failed Gate 1, so the _level_ of every number below inherits that instability. What it can settle is
whether the construct is degenerate — a quantity that is the same everywhere has nothing to offer
any model, and that is worth knowing before anyone spends compute on one.

700 decisions, nine budgets from 50 to 20,000 nodes, MultiPV 2, hash cleared between every search.

**Value still on the table after 20,000 nodes** (`remainingComputationValue`, in winning chances):

| p50   | p75   | p90   | p95   | p99   | mean   | Gini |
| ----- | ----- | ----- | ----- | ----- | ------ | ---- |
| 0.000 | 0.000 | 0.018 | 0.030 | 0.059 | 0.0049 | 0.88 |

|                                                                                   | share of decisions |
| --------------------------------------------------------------------------------- | -----------------: |
| exactly zero — 20,000 nodes already found a move the reference values identically |          **75.4%** |
| above the reference's own mean noise (0.0084)                                     |              16.0% |
| above the 90th percentile of reference noise (0.021)                              |               9.4% |
| above this repository's threshold for a cost worth naming (0.0276)                |           **5.3%** |

So the construct is **not degenerate — and it is rare.** Three quarters of blitz decisions are
settled by a search two orders of magnitude smaller than the reference, and the share where further
search buys more than the product's own smallest nameable cost is about **one decision in twenty**.
Even if every downstream gate had passed, that is the size of the surface the feature would have had
to justify itself on.

**How the answer moved while it was being computed:**

|                                                                      | value |
| -------------------------------------------------------------------- | ----- |
| mean number of times the chosen move changed across the nine budgets | 2.16  |
| decisions where it never changed                                     | 20.3% |
| decisions that converged at the very first budget (50 nodes)         | 20.3% |
| decisions still switching at the last budget (20,000 nodes)          | 24.0% |

**Is any of it just "the position is sharp"?** The plan's Control 4 asks whether a simple deep
candidate gap explains everything. At the descriptive level it does not: Spearman correlation
between `remainingComputationValue` and `candidateGap` is **−0.088** — effectively unrelated, and
for a comprehensible reason. When one move is clearly best the shallow search usually finds it, so
remaining value is small; when several moves are near-equal, picking the "wrong" one costs little,
so remaining value is small again. The quantity peaks in between. That is evidence the trajectory is
measuring something a static gap does not — and it is evidence at the Observation rung only, because
the test that would turn it into a prediction is the one Gate 1 blocked.

---

## 7. What a stable reference would cost, in the only unit that compares

Depth is not a unit of computation — the same depth costs a few thousand nodes in a locked position
and millions in a sharp one — so "depth 12" and "800,000 nodes" cannot be compared directly. Both
were therefore measured in nodes, on the same 300 positions, with the same engine.

|                                                                                                                                                |             nodes per position |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -----------------------------: |
| the depth this product's import path searches to (depth 12)                                                                                    | median **12,992**, mean 18,532 |
| one move scored at the smallest budget that even approaches the weaker tolerance (800k)                                                        |                        800,000 |
| one **decision** — the reference's best, its runners-up for the candidate gap, the human's move, and each trajectory-chosen move, call it five |                ≈ **4,000,000** |

That is **≈ 300×** the search the product currently spends on a position — and Gate 1 says 800,000
is still not enough.

Converting the ratio to wall clock is looser, and is stated as an order of magnitude rather than a
benchmark. This repository's own measurement (`docs/MEASUREMENTS.md`) is 971 positions in 43.4 s of
browser time, 45 ms per position, at depth 12. At 300× that is roughly **14 seconds per decision**,
and the 971-position import that takes 43 seconds today would take something like **four hours**.

**Two caveats, and they cut in both directions.** Node counts are not comparable across engines: the
research engine is Stockfish 17.1 native with the full network, the product runs Stockfish 18 Lite
in WebAssembly, and their nodes are not the same nodes. And the 45 ms figure was measured before
this session on a different build. The robust part of this section is the **node ratio, ≈ 300×**,
measured with one engine on one set of positions; the seconds are an illustration of what that ratio
means.

The conclusion does not depend on the loose half. Even if a future study found the budget at which
the reference finally settles, the construct would sit two to three orders of magnitude outside what
this product can compute for a player waiting at a board.

---

## 8. Controls

| control                                                       | status                     | result                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1 — shuffle features within clock × phase bins**           | **not run**                | It permutes predictors against a fitted model. No model was fitted, so there is nothing for it to attack.                                                                                                                                                                        |
| **C2 — donor swap of trajectories between matched positions** | **not run**                | Same reason.                                                                                                                                                                                                                                                                     |
| **C3 — leakage / determinism**                                | **run, passed**            | 60 decisions re-run through fresh engine processes: **0 / 60** metric mismatches and **0 / 60** trajectory-move mismatches. Every feature is a function of `fenBefore` alone; the hash really is cleared between budgets, and nothing outside the position reaches the features. |
| **C4 — position-difficulty baseline**                         | **answered descriptively** | Spearman(`remainingComputationValue`, `candidateGap`) = **−0.088**. The trajectory is not a restatement of the static candidate gap. This is an Observation, not the prediction test, which Gate 1 blocked.                                                                      |

C3 is the one that mattered most and it is the one that ran. Without a cleared transposition table a
50-node search reads a 400,000-node answer straight out of the hash, every budget agrees, and every
trajectory looks perfectly stable — a failure that would have produced beautiful, meaningless
results. The replication is what rules it out, and it is a stronger check than a code comment
because it compares two independent engine processes.

The one control the data could have run and could not — a natural-duplicate check, comparing
decisions that met the same position — was **vacuous here**: the 700-decision sample contains no
repeated position. The deliberate replication replaced it.

---

## 9. Deviations from the preregistration

Recorded because a preregistration that is quietly departed from is worse than none.

| #   | deviation                                                                           | reason                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `search-trajectory.ts` lives under `research/`, not `shared/` as the plan suggested | Nothing in the product imports it. A module in `shared/` says the product measures this; it does not.                                                                                                                                                                         |
| D2  | `shared/computation-need.ts` was never created                                      | No construct passed validation. Creating it would assert a measurement that does not exist.                                                                                                                                                                                   |
| D3  | The saturation grid was extended to 1,600,000 nodes                                 | **Post-hoc**, and labelled as such everywhere it appears. It cannot rescue a failed gate — the verdict is read off the preregistered grid — and it was run in the direction of _attacking_ the negative conclusion, to distinguish "out of compute" from "does not converge". |
| D4  | The budgeted run covers 700 decisions from 350 games, not all 10,200 events         | Once Gate 1 failed, the run's purpose changed from testing hypotheses to measuring what the failure costs. 350 clusters is ample for a flip rate; 10,200 would have been two hours of compute spent on numbers nobody is allowed to quote.                                    |
| D5  | Exclusion **E4** (`abs(deepEvalCp) > 1000`) was never applied                       | It was specified to apply after a full deep pass over the corpus, which the gate stopped. The 700-decision sample is therefore **unfiltered** on this rule, and is described that way rather than as filtered.                                                                |
| D6  | Trajectory tests live at `tests/research/`, not `tests/shared/`                     | Follows D1.                                                                                                                                                                                                                                                                   |

**And one defect in the preregistration itself**, not a deviation from it: §6.2 identifies the
reference's best move with a three-line search and scores it with a one-line search. Those are
different instruments and they disagree 26.4% of the time (§5.1). Disclosed rather than repaired,
because repairing it after seeing the result is the move this whole exercise exists to prevent. It
is the first thing a future attempt should change.

---

## 10. What would change the verdict

Not a plan of work — a list of what a future attempt would have to establish first.

1. **A reference definition that is internally coherent.** Best move = argmax over uniformly scored
   candidates, not the top line of a MultiPV search scored afterwards. This alone drops the
   "human's move beats the reference's" rate from 9.6% to 1.4%.
2. **A reference budget that actually saturates.** On this evidence that is somewhere past 1.6M
   nodes per scored move — and the study should then ask what §7 asks: whether the answer can be
   computed anywhere the product could use it.
3. **An outcome that does not share an error term with its predictor.** As long as remaining
   computation value and win-probability loss are both differences from `V_deep(best)`, reference
   error flows into both and biases the association upward. A predictor built only from the
   _shape_ of the trajectory — instability, convergence budget — and never from a difference against
   the reference would not have this problem, and is the more promising formulation.
4. **A reason to believe the surface is big enough.** Further search buys more than this
   repository's smallest nameable cost in about **one blitz decision in twenty** (§6). A feature
   that speaks about 5% of decisions needs to be very good to be worth its compute.

---

## 11. Verdict matrix

| Claim                                 | Evidence                                                                                                                                                                       | Confidence                                                                                 | Product permission |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------ |
| Positions differ in computation value | Measured on 700 decisions: RCV is exactly 0 in 75.4% and above the repository's nameable-cost threshold in 5.3%; Gini 0.88; unrelated to the static candidate gap (ρ = −0.088) | **Moderate** — the dispersion is real, the _level_ inherits a reference that failed Gate 1 | **None**           |
| Search trajectory predicts think time | **Not tested.** H1 was not run — its predictors are differences against a reference with no stable value                                                                       | None                                                                                       | **None**           |
| Search trajectory predicts error      | **Not tested.** H2 was not run. Swapping references costs 0.072 AUC against a gate demanding 0.02, and predictor and outcome share the reference's error term                  | None                                                                                       | **None**           |
| Clock interaction matters             | **Not tested.** Requires a validated computation-need construct, which does not exist                                                                                          | None                                                                                       | **None**           |
| Exact optimal think time identifiable | **No.** Four of its five preconditions were never reached, and observational data could not identify it even if they had been                                                  | None                                                                                       | **None**           |
| Human-policy layer needed             | **Not assessed.** Phase 2 was gated behind H2 passing                                                                                                                          | None                                                                                       | **None**           |
| Composite Blitz Score justified       | **No.** Combining dimensions requires evidence they measure one thing; no dimension was validated                                                                              | None                                                                                       | **None**           |

### Decision

```
RESEARCH ONLY
```

**Why this and not STOP.** No hypothesis was refuted; they were not testable. The obstacle is
measured, specific, and has named remedies (§10), and the instrument built to find it — a corpus,
a node-budget engine API, a saturation study, a trajectory extractor, a gate that enforces itself —
is correct and tested. The line of research is alive.

**Why this and not CONDITIONAL BUILD.** Nothing may reach the product. Not a reading, not a
category, not a hedge. Every row above says **None**, and §7 says the product could not compute the
construct even if a later study validated it.

---

## 12. Artifacts

| #   | required by the plan           | status                                                                                                                                                                                                                                                          |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Preregistration                | [`BLITZ_COMPUTATION_PREREG.md`](./BLITZ_COMPUTATION_PREREG.md), committed in `901c463` before any data existed                                                                                                                                                  |
| 2   | Dataset + provenance report    | §2 above, plus `research/blitz/data/dataset_manifest.json`                                                                                                                                                                                                      |
| 3   | Mathematical validation report | §4–§8 above, and `research/blitz/data/analysis_results.json`                                                                                                                                                                                                    |
| 4   | Algorithm specification        | **Absent, correctly.** No construct passed validation, so there is no algorithm to specify                                                                                                                                                                      |
| 5   | Production implementation      | **Absent, correctly.** The one thing kept is `StockfishClient.analyzeNodes` — a _capability_, not a measurement: it bounds a search by nodes and asserts nothing. The application's depth path is unchanged, asserted in `tests/client/stockfish-nodes.test.ts` |

---

## 13. Execution self-audit

The plan asks for a score out of 100 with a release requirement of ≥ 95 total and ≥ 90% in every
domain. Reported honestly, that requirement is **not met**, and it could not be: most of the
preregistered statistical and falsification work never ran, because the gate that precedes it
failed. Crediting it anyway would be exactly the number-manufacturing the plan exists to prevent.

| domain                               | max |   score | why                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | --: | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Epistemic design                     |  20 |  **18** | Preregistration committed before any data; tolerances derived from the repository's own constant rather than chosen; the primary comparison put the difficulty baseline in B1 so the test could fail; the gate is enforced by code. **−2**: the reference-definition asymmetry (§5.1) was an avoidable design error, visible at design time. |
| Statistical validity                 |  20 |  **17** | Wilson intervals, cluster bootstrap by game with its design effect reported, effect sizes and denominators throughout, negative result reported at full strength. **−3**: the gate rests on one 300-position sample, and most of the preregistered statistical plan never executed, so it stands untested.                                   |
| Leakage / controls / reproducibility |  15 |  **13** | C3 run as a real two-process replication (0/60 mismatches); determinism by construction; manifests carry seed, engine, options, budgets and SHA-256; the README reproduces every step. **−2**: C1 and C2 could not run, and the natural-duplicate check was vacuous.                                                                         |
| Algorithm validity                   |  15 | **N/A** | No algorithm exists. Scoring 15 for correctly building nothing would be self-serving; scoring 0 would punish the correct decision. The domain is unscoreable on a study that stopped at Gate 1.                                                                                                                                              |
| Negative tests / falsification       |  10 |   **8** | The negative conclusion was attacked rather than accepted: the grid was extended past the preregistered ceiling, the failure decomposed by mode, the conservative half of the rule forgiven, and the plan's own stricter criterion applied. **−2**: two of the four preregistered controls had no model to attack.                           |
| Integration quality                  |  10 |  **10** | `analyzeNodes` is additive and the unchanged depth path is asserted, not assumed; no product module imports research code; `npm run verify` green — 11/11 gates, all 11 positive controls red, bundle within budget.                                                                                                                         |
| Documentation / provenance           |  10 |  **10** | Preregistration, results, README, manifests, six deviations and one preregistration defect all recorded; both silent corpus defects written down with the numbers that hid them.                                                                                                                                                             |

**Total over scoreable domains: 76 / 85 = 89.4%.**

Three domains fall below the 90% floor — statistical validity, controls, and falsification — and all
three for the same reason: the work that would have earned those points is the work Gate 1 stopped.
The release requirement is moot in any case. **Nothing is being released.**
