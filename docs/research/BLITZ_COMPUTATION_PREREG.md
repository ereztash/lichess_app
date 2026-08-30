# Preregistration — Blitz computation-allocation research

**Status: FROZEN.** Committed before any dataset was built, any engine search was run, and any
result was seen. Everything below was decided in advance. Anything that changes after this commit
is recorded as a deviation in `BLITZ_COMPUTATION_RESULTS.md`, with the reason and the date, and is
labelled exploratory rather than primary.

**Frozen at commit:** see `git log -1 --format=%H -- docs/research/BLITZ_COMPUTATION_PREREG.md`.

---

## 0. The question

Not *"was this the best move by Stockfish"* but:

> Given the position, the amount of computation the position rewarded, the clock the player faced
> and the time they actually spent — what, if anything, can be said about the decision process?

The claim under test is that **positions differ in how much they repay additional search**, that
this quantity is **measurable from a budgeted engine search**, and that it carries information
about human behaviour and human error **beyond what a deep engine evaluation and the clock already
say**. The last clause is the whole test. A trajectory feature that only restates "this position is
hard" has failed, and the correct outcome then is not to build it.

### What was known before this preregistration

Two facts from this repository's own prior measurements, which is why they are not findings here:

- On 380,310 Lichess moves the blunder rate rises monotonically with think time (1.55% → 7.92%).
  Think time is confounded with position difficulty by reverse causation.
- On 693,130 Lichess moves the `slow-over-2m` bucket is 14.2 points *less* accurate for everyone.

Both are reasons this preregistration refuses to read `ThinkTime → Error` causally (§9) and
requires every trajectory claim to be tested against a difficulty baseline (§6.3, §11).

### What was inspected before freezing, and why it is not a result

Corpus **format** (PGN tags, `[%clk]` syntax), engine **throughput** (810k nodes/s per core, 4
cores), library availability. No outcome variable, no relationship between any two variables, and
no position-level evaluation was computed before this document was committed.

---

## 1. Epistemic ladder

Kept explicitly separate throughout, and every sentence in the results document is tagged with the
rung it stands on:

1. **Observation** — what the data show.
2. **Construct** — what we claim the variable measures.
3. **Prediction** — whether it adds predictive power out of sample.
4. **Causal claim** — whether changing it would change an outcome.
5. **Product claim** — what may be shown to a user.

No analysis in this preregistration reaches rung 4. Observational data cannot identify
`ThinkTime → Error`, and no result below is permitted to be phrased as if it could.

---

## 2. Unit of analysis

The `DecisionEvent`: one position a player actually had to move in.

- Position is `fenBefore` — the position the player was deciding *in*, never the position after.
- Clock is the reading the player **faced before** the decision, per `shared/pgn-clock.ts`
  (`clockMsRemainingAt`), not what remained after.
- Think time per `secondsSpentAt`, which adds the increment back — a 3-second move in a 180+2 game
  otherwise reads as 1 second.

These three rules are inherited from existing, tested repository code and are reused rather than
reimplemented.

---

## 3. Corpus, sampling and exclusions

**Source.** Lichess open database (CC0), `https://database.lichess.org/standard/`. Two monthly
files, read as byte-range prefixes and stream-decompressed:

| file | role |
| --- | --- |
| `lichess_db_standard_rated_2026-01.pgn.zst` | development month |
| `lichess_db_standard_rated_2026-04.pgn.zst` | temporal holdout month |

**Game-level inclusion (all required).**

- `[Event]` contains `Rated Blitz`.
- `[Termination "Normal"]`.
- `[TimeControl]` parses as `base+inc` with base ∈ {180, 300} and inc ≤ 3.
- Both `WhiteElo` and `BlackElo` present and numeric.
- `[%clk]` present on every ply.
- ≥ 20 plies (a game shorter than that is mostly not a blitz decision problem).
- Clock readings monotone per player after adding the increment back, allowing a 1-second tolerance
  for rounding. A game that violates this had its clock stream corrupted and is dropped whole.

**Player identifier.** `sha1(username)[:16]`, salted with a fixed public salt recorded in the
dataset manifest. Grouping is all the analysis needs; committed artifacts carry no usernames.

**Sampling (seeded, seed = 20260829).**

- *Stratum R (recurring):* players with ≥ 2 qualifying games in **both** month prefixes. Up to 300
  such players; up to 2 games per player per month. This stratum exists so the within-player
  temporal holdout (§8, test A) is possible at all.
- *Stratum G (general):* qualifying games sampled from the 2026-01 prefix by seeded Bernoulli
  acceptance, to fill the target.
- Per game: up to **6** eligible plies sampled uniformly without replacement, pooled over both
  colours.

**Decision-level exclusions (pre-specified, counted and reported).**

| # | rule | reason |
| --- | --- | --- |
| E1 | ply < 2 | no previous clock reading for that player; think time not derivable |
| E2 | fewer than 2 legal moves | there was no decision to make |
| E3 | side to move is in a terminal position | no move exists |
| E4 | `abs(deepEvalCp) > 1000` | decided; winning-chance loss is mechanically near zero (a 1000cp position is at 0.975 win probability, leaving 0.025 of headroom for the entire outcome variable) |
| E5 | think time not derivable, or > `base + inc` | corrupted clock stream |
| E6 | deep reference search failed or returned no PV | measurement absent, not zero |

E4 is applied **after** the deep search, so its count is known and reported. A **pre-specified
sensitivity analysis** repeats every primary analysis under Regan's stricter exclusion
(`abs(deepEvalCp) > 300`), which is the rule this repository already uses elsewhere.

**Target and floor.** Target ≥ 8,000 complete decision events, ≥ 1,000 games, ≥ 800 distinct
players. **Floor to proceed at all: 5,000 events and 500 players.** Below the floor, every
hypothesis is reported `NOT ESTABLISHED — insufficient data`, and nothing is built.

---

## 4. Ground truth

Centipawns are not the measure. Value is winning chances from the **mover's** point of view:

    V = winProbability(cp_from_mover_perspective) ∈ [0, 1]

using `shared/win-probability.ts` unchanged (Lichess's logistic, k = 0.00368208, fitted on
2300-rated games). Reused rather than reimplemented; its population caveat is inherited and
restated in the results document.

**Forced mate** is not a centipawn quantity. A mate score is mapped to ±10,000 cp before
conversion, exactly as `comparableCp` in `client/src/lib/engine-line.ts` does, which puts it at
V = 0.9999 / 0.0001. Mate distance is deliberately not preserved: for a *value* question, mate in 2
and mate in 9 are the same value.

**Cost of a move** m:  `WPL(m) = V_deep(m_best) − V_deep(m)`, clamped at 0.

---

## 5. Deep reference — saturation study (Gate 1)

No depth or node count is declared ground truth by assertion.

**Budgets tested:** 25k, 50k, 100k, 200k, 400k, 800k nodes. MultiPV 3. Threads 1. Hash 16 MB,
cleared (`ucinewgame` + `isready`) before every search, so budgets are independent and the run is
deterministic.

**Sample:** 300 positions, stratified by Elo band (4), phase (3), clock pressure (low/high) and
evaluation band (|cp| ≤ 50 / 50–300 / > 300), drawn with the same seed from the development month.

**Stability criteria, frozen now.** Let ε be a *derived* tolerance, not a chosen one:

    ε₁ = ACCURATE_WIN_PROBABILITY_LOSS / 2 = 0.01380
    ε₂ = ACCURATE_WIN_PROBABILITY_LOSS     = 0.02761

`ACCURATE_WIN_PROBABILITY_LOSS` is the repository's existing threshold for what counts as an
accurate decision (`shared/detector.ts`), itself derived from 30 centipawns at a level position.
ε₁ is *half the smallest difference this product is willing to call a real cost*. Neither number was
picked after looking at anything.

A position is **stable at N** (against 2N) when both hold:

- **A′ (move-value agreement).** `V_2N(m_2N) − V_2N(m_N) < ε`, where `V_2N(m_N)` is read from the
  MultiPV-3 list at 2N; if `m_N` is absent from that list the position counts as unstable.
  A′ rather than raw `m_N == m_2N`, because two genuinely equal moves that the engine alternates
  between are not an unstable reference — the *value* is what every downstream metric uses.
- **B (position-value agreement).** `|V_N − V_2N| < ε`.

**Decision rule.** The deep reference budget `N_deep` is the **smallest** tested N with
≥ 95% of sampled positions stable at ε₁. If none qualifies at ε₁, the same rule is applied at ε₂
and the weaker guarantee is stated everywhere the reference is used. If none qualifies at ε₂ →
**STOP-D**: the reference is not stable, and no downstream claim may be made.

**Sensitivity (STOP-E).** Every primary analysis is repeated with the reference at the next budget
up (`2 × N_deep`) on a 25% subsample. If a primary verdict flips, the result is reported as
budget-dependent and downgraded to NOT ESTABLISHED.

---

## 6. Search trajectory

### 6.1 Budgets

Frozen: **50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000** nodes. MultiPV 2 at every budget.
Hash cleared before each. Actual node counts recorded (the engine overshoots a node limit slightly).

MultiPV 3 on a 500-position subset, to test whether a third line adds anything; declared secondary.

### 6.2 The engine must not judge itself

The move chosen at budget *n* is scored by the **deep reference**, never by the budget that chose
it. Every move that needs a value — the deep best, the deep second and third, every
trajectory-chosen move, and the move the human played — is scored by one uniform procedure:

    go searchmoves <move> nodes N_deep     (MultiPV 1, hash cleared)

so all values are on one scale with one budget per move, and no value is a MultiPV rank artefact.

### 6.3 Frozen feature list

Named now so no feature can be invented after seeing a result. All are functions of the position
and the engine only. **None reads the human move**; a test asserts this (§10, Control 3).

| feature | definition |
| --- | --- |
| `rcv20k` | `V_deep(m_best) − V_deep(m_20000)` — value left on the table after 20k nodes |
| `rcv1k` | the same at 1,000 nodes |
| `rcvAuc` | mean of `RCV(n)` over the nine budgets (equal weight in log-node space) |
| `convergenceNodes` | log₁₀ of the smallest budget from which the chosen move never changes again; sentinel `log₁₀(40000)` plus an indicator when it never converges |
| `moveInstability` | count of budget-to-budget changes of chosen move, 0–8 |
| `lastSwitchBudget` | log₁₀ of the largest budget at which the move changed, 0 and an indicator when none |
| `valueGain50to20k` | `V_deep(m_20000) − V_deep(m_50)` |
| `candidateGap` | `V_deep(best) − V_deep(second)` — **a baseline feature, not a trajectory feature** |

`candidateGap` is deliberately assigned to the **baseline** model B1, not to B2. It is the simplest
possible "this position is difficult" measure, and the whole test is whether trajectory shape adds
anything to it.

### 6.4 No composite score in the research phase

`remainingComputationValue`, `convergenceNodes`, `moveInstability`, `candidateGap` and the value-gain
curve stay separate variables. A latent `ComputationNeed` construct may be formed **only after** the
ablation (§11) shows the separate features are jointly justified, and never merely because a
composite makes a table look better (**STOP-F**).

---

## 7. Hypotheses

### H1 — does the trajectory explain human time allocation?

**DV:** `log(1 + thinkTimeSeconds)`.

Three nested models, all pre-specified:

- **B0_T** — `log(1+clockBefore)`, clock fraction of base, Elo self, Elo opponent, Elo difference,
  phase dummies, `V_deep`, `|V_deep − 0.5|`, ply, `log(1+ply)`, time-control dummies, mover colour,
  increment.
- **B1_T** — B0_T + `candidateGap`, `V_deep(best) − V_deep(third)`, `log(legalMoveCount)`,
  non-pawn material, in-check indicator.
- **B2_T** — B1_T + the seven trajectory features of §6.3.

**Primary comparison: B2_T − B1_T**, out of sample. B0_T is reported for context only.

Primary estimator: ordinary least squares with cluster-robust standard errors by game, plus a
mixed-effects specification with a player random intercept as a robustness check. Gradient boosting
is **secondary** and may not carry a primary verdict.

**H1 passes only if all hold:**

1. Out-of-sample `ΔR² ≥ 0.01` **or** ≥ 2% reduction in held-out mean squared error.
2. The 95% cluster-bootstrap CI of that improvement excludes zero.
3. The sign of the primary trajectory coefficient is stable under the full control set.
4. The direction holds in a majority of the pre-specified strata (4 Elo bands × 3 phases).
5. It survives all three holdout designs of §8.

Otherwise → **STOP-A/B/C as applicable**; `ComputationNeed` is not built.

### H2 — does the trajectory predict error beyond Stockfish + clock?

**Primary outcome (binary):** the played move is *inaccurate* when
`WPL(played) > ACCURATE_WIN_PROBABILITY_LOSS` — this repository's own existing accuracy rule, not a
new threshold.

**Secondary outcomes:** continuous `WPL`; `WPL > 0.10`; `CPL > 100`; `CPL > 200`. CPL thresholds are
never the sole ground truth.

- **B0** — Elo self, Elo opponent, Elo difference, `log(1+clockBefore)`, clock fraction, phase
  dummies, `V_deep`, `|V_deep − 0.5|`, ply, `log(1+ply)`, time-control dummies, mover colour,
  increment.
- **B1** — B0 + `candidateGap`, `V_deep(best) − V_deep(third)`, `log(legalMoveCount)`, non-pawn
  material, in-check indicator.
- **B2** — B1 + the seven trajectory features.

**Primary comparison: B2 − B1.** Never B2 − nothing.

Primary estimator: L2-regularised logistic regression on standardised features (penalty selected on
the development split only). Gradient boosting secondary.

A **pre-specified secondary family** B0′/B1′/B2′ adds `log(1 + thinkTime)` to all three models; the
gate is evaluated there too, and both are reported.

**H2 passes only if all hold, on completely held-out data:**

1. `ΔAUC ≥ 0.02`.
2. Relative log-loss improvement ≥ 1.5%.
3. The 95% cluster-bootstrap CI of both improvements excludes zero.
4. Calibration does not materially degrade: `Brier(B2) ≤ 1.02 × Brier(B1)` **and**
   `ECE(B2) ≤ ECE(B1) + 0.01` (10 equal-count bins).

AUC up with calibration destroyed is a **FAIL**, not a trade-off.

### H3 — the clock interaction

`ComputationNeed × ClockPressure` is tested explicitly, as an interaction term added to the passing
model, evaluated out of sample by the same gates. Main effects alone are not sufficient evidence for
the decision-mode matrix (§12).

### H2b — `t*`, exact optimal think time

**Not attempted in V1.** It is unlocked only if H1 passes, H2 passes, the `ThinkTime ×
ComputationNeed` interaction is stable out of sample, an opportunity cost of remaining game time can
be defensibly estimated, and a sensitivity analysis shows the recommendation is robust. Absent all
five, the product output stays **categorical** and no number of seconds is ever shown.

---

## 8. Holdout design

Never a random split of moves. Three separate tests, all reported separately:

- **A. Within-player temporal.** Stratum R only: 2026-01 games train, 2026-04 games test, same
  players.
- **B. Cross-player.** Player-hash split, 70% dev / 30% test. No player appears on both sides.
- **C. Elo-band.** Leave-one-band-out over `<1500`, `1500–1799`, `1800–2099`, `≥2100`.

All model selection, hyperparameter choice and threshold learning happen on the **development**
portion only. Test partitions are read once, after the models are frozen. A result that holds only
in one Elo band is **STOP-C**.

---

## 9. Think time is not causal, and no document may imply it is

An exploratory model
`P(Error) = f(ComputationNeed, ThinkTime, ClockBefore, ComputationNeed×ThinkTime, ComputationNeed×Clock)`
is permitted and is labelled exploratory everywhere it appears. Its coefficients may **not** be
called `optimalThinkingTime`, and no output derived from it may tell a player how long to think.
People think longer *because* positions are hard; this repository has already measured that.

---

## 10. Negative controls (pre-specified, all must be run)

| control | expectation if the signal is real |
| --- | --- |
| **C1 — shuffle** | permute trajectory features within clock × phase bins: the effect must disappear |
| **C2 — donor swap** | replace each position's trajectory with one from a different position matched on `V_deep` and phase: the effect must disappear |
| **C3 — leakage scan** | assert mechanically that no feature of decision *t* reads anything created after ply *t*, except the deep evaluation used as label/reference |
| **C4 — difficulty baseline** | if `candidateGap` alone explains everything and trajectory adds nothing, **do not build the trajectory layer**. This is a successful outcome, not a failure |

A control that fails is reported and is decisive against the corresponding claim.

---

## 11. Ablation

Fitted on development data, reported on held-out data, in this exact order:

    clock only
    clock + position
    clock + position + candidateGap
    clock + position + RCV
    clock + position + instability
    clock + position + convergence
    clock + position + all trajectory features

The purpose is to find the **minimum** that explains the signal. If one feature does nearly all the
work, the delivered construct uses that one feature.

---

## 12. Algorithm, if and only if the gates pass

Output is a **structure**, never a single number:

```ts
interface BlitzComputationReading {
  computationNeed: "low" | "medium" | "high";
  clockPressure: "low" | "medium" | "high";
  decisionMode: "MOVE" | "THINK" | "MOVE_NOW" | "CRITICAL_UNDER_PRESSURE";
  evidence: { remainingComputationValue: number; convergenceNodes: number | null;
              moveInstability: number; candidateGap: number | null };
  confidence: { level: "low" | "medium" | "high"; reason: string };
}
```

Thresholds are **learned by cross-validation on development data only**, then frozen before the test
set is touched. No hardcoded arbitrary cut-offs.

**No overall score in V1.** `Blitz Decision Score: 84` and `Computation Quality: 9/10` are forbidden
until there is evidence that combining the dimensions is justified. Move outcome, computation
demand, clock pressure and actual time investment stay separate on the output.

---

## 13. Uncertainty

Never a naive bootstrap of moves — moves within a game and within a player are not independent.

- **Cluster bootstrap by game** for every primary interval, 2,000 resamples.
- **Hierarchical player→game bootstrap** wherever the player is the unit of generalisation
  (holdouts B and C).
- Every reported quantity carries an effect size, a 95% CI and its denominator. A p-value alone
  carries nothing.
- Negative results are reported with the same prominence as positive ones.

---

## 14. Stop conditions

| code | condition |
| --- | --- |
| STOP-A | trajectory adds no value beyond simple position features |
| STOP-B | the effect disappears under the player or game holdout |
| STOP-C | the result depends on a single Elo band |
| STOP-D | the deep reference is not stable |
| STOP-E | results change materially under a reasonable alternative budget grid |
| STOP-F | a composite score is required to make the result look good |
| STOP-G | the model works only on development data |

On any stop: **do not adjust thresholds**. Write `Hypothesis not supported` and record why.

---

## 15. Reproducibility

Every run records: dataset hash, git commit, date, engine version and full option set, node budgets,
MultiPV, random seed, exclusion counts by rule, sample sizes, model configuration, and the exact
train/validation/test identifier sets. `BLITZ_COMPUTATION_RESULTS.md` must let a different person
reproduce the numbers.

---

## 16. Deliverables

1. This preregistration.
2. Dataset and provenance report.
3. Mathematical validation report — per hypothesis: claim, evidence, effect size, 95% CI, OOS
   result, alternative explanation, verdict PASS / PARTIAL / FAIL.
4. Algorithm specification — validated constructs only.
5. Production implementation — only if the research gates pass.

Final output is the verdict matrix and exactly one of:
`STOP` · `RESEARCH ONLY` · `CONDITIONAL BUILD` · `VALIDATED BUILD`.
