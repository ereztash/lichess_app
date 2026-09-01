# B3 -- Population Expertise x Decision Dynamics

**Status:** DRAFT until FABLE GATE 1 returns PASS. Frozen and hashed at that point.
**Primary time control:** rated Standard Blitz `180+0` on lichess.org.
**Registered before:** any B3 engine scoring of any period, and before any B3 decision-level
statistic of any kind existed.

---

## 1. What is being tested, and what would count as nothing

The weak claim -- stronger players play better moves -- is already known and is not worth an
experiment. B3 tests something narrower and falsifiable:

> Does increasing chess expertise show up as **better management of a common
> difficulty / time / value-of-computation / quality process**, rather than only as a higher
> level of the quality outcome?

Two separable questions, tested separately:

**H1 (the regularity).** After adjusting for measurable pre-move position difficulty, the
pre-move value of further computation, the clock state, and rating, does a decision that took
*unusually long for that position and that skill level* still predict a worse move?

    QualityLoss_i = f(Difficulty_i, VoC_i, Clock_i, Rating_i) + beta * UT_within_i + e_i
    H1:  beta > 0

**H2 (expertise adaptation).** Does the way players operate inside that process change
systematically with rating? Five preregistered manifestations, of which Metric B is primary:

    A  matched-difficulty thinking time            expect: decreases with rating
    B  Time Allocation Efficiency (PRIMARY)        expect: increases with rating
    C  Allocation Loss                             expect: decreases with rating
    D  extreme unexpected-time exposure            expect: decreases with rating
    E  friction burden                             descriptive only, no directional claim

H1 and H2 are independent. H1 can hold with H2 failing (that is `GENERAL_REGULARITY_ONLY`), and
the reverse is possible too.

### What this experiment cannot do

It is observational. Nothing here identifies a causal effect of thinking time on move quality, and
nothing here measures cognition. `unexpected_time` is a **regression residual of a clock
difference**, not a mental state. The variable names in the code are deliberately neutral
(`unexpected_time_population`, `unexpected_time_within_rating`) so that no analysis step can
quietly import an interpretation the design cannot support. See §9.

---

## 2. Alternative explanations, stated before the result

These are the explanations a positive result must survive. Each is paired with the preregistered
control that addresses it and, where an explanation cannot be excluded, that is said here rather
than discovered later.

| # | Alternative | Preregistered response | Can it be excluded? |
|---|---|---|---|
| A1 | **Skill only.** Rating raises quality; unexpected time is noise. | H1 estimated within rating bands and with rating adjusted. | Yes, if beta > 0 within bands. |
| A2 | **Unmeasured difficulty.** Unexpected time is a proxy for position difficulty the engine features missed. | Residual taken from T2, the richest pre-move model (difficulty + candidate structure + search instability + VoC + clock). Matched analysis (§21 of the plan). Alternate engine budget (C9). | **No.** This is the central irreducible limitation and the report must say so. Adjustment shrinks it; it cannot remove it. |
| A3 | **Position-distribution confound.** Stronger players reach systematically different positions, so a rating gradient is a gradient in the positions, not in the players. | Matched analysis on difficulty / VoC / clock / phase / standing / eval; within-band estimation; opponent rating as a covariate. | Partly. |
| A4 | **Clock-management confound.** Stronger players get into time trouble less, and time trouble causes errors, so every metric moves for a reason that is not allocation. | Clock remaining, opponent clock and clock pressure enter every model; clock-pressure strata (C14). | Partly. |
| A5 | **Opponent strength.** Opponent rating drives both position difficulty and the clock. | Opponent rating is a covariate in T0/T1/T2 and in the quality model. | Yes, to the extent it is measured. |
| A6 | **Engine artifact.** Difficulty and quality both come from one engine at one budget, so a position where that engine is unstable gets a high difficulty score *and* a noisy quality score by construction. | C9 re-scores a random subset at 2.5x the node budget and repeats the primary estimate. | Partly. |
| A7 | **Clock quantisation.** Lichess database clocks are whole seconds, so a large share of decisions read as `T = 0`, and those are disproportionately easy positions. | C17 repeats everything with `T = 0` decisions removed. | Yes, by exclusion. |
| A8 | **Survivorship.** Longer games contribute more decisions, and game length is not independent of how the player is playing. | Player-level clustering everywhere; C18 restricts to the first 40 plies. | Partly. |
| A9 | **Metric induction.** Time Allocation Efficiency is an association between time and VoC; if VoC were built from anything the player did, the metric would be circular. | VoC is computed **only** from engine analysis of the pre-move position (§6). C4 destroys VoC and requires the TAE signal to die with it. | Yes, by construction and by C4. |
| A10 | **Pseudo-replication.** Hundreds of thousands of moves from a handful of very active accounts. | At most **2 game-sides per player**, player-level block bootstrap for every interval, C8 player-influence controls. | Yes. |

---

## 3. Three periods, and what each may be used for

Non-overlapping, completed, historical. Constructed identically (§ DATA_PROTOCOL).

| Period | Source month | Role | May be used for |
|---|---|---|---|
| DEVELOPMENT | 2026-02 | build | debugging, feature development, cost pilot, model-family exploration, fitting the frozen models, setting frozen standardisation constants and thresholds |
| VALIDATION | 2026-04 | choose | comparing already-defined candidates, calibration, directional checks, freezing the final specification |
| FINAL REPLICATION | 2026-06 | seal | **nothing** until FABLE GATE 2 returns PASS. Then opened once, mechanically. |
| SECONDARY CONTEXT | 2026-06, `300+0` | replicate | run only after the primary verdict is frozen. No retuning. |

The repository's opening book (`shared/opening-book-keys.ts`) was built from **2026-03**, which is
disjoint from all three periods. That is checked, not assumed.

**Player overlap.** Overlap between periods is not prevented at sampling time, because preventing
it would require reading the FINAL period before Gate 2. Instead it is preregistered here: after
FINAL is opened, the overlap is counted and the primary H1 estimate is reported **twice** -- on all
of FINAL, and on FINAL restricted to players absent from DEVELOPMENT and VALIDATION. The verdict
rule (VERDICT_RULES.md §4) requires the restricted estimate to hold. Neither branch is chosen after
seeing the numbers; both are always reported.

---

## 4. Sample

Rated Standard `180+0`, both clocks present, analysed side's rating in `[800, 2600)` at game time.
Player-balanced by construction: at most 2 game-sides per player. Full rules, exclusions and
counting in `DATA_PROTOCOL.md`. Final N is frozen by the cost pilot (§9 of the plan) **before**
any period is scored, and the pilot may not estimate any scientific effect.

Rating bands for stratification and figures (primary modelling is on continuous rating):

    800-999  1000-1199  1200-1399  1400-1599  1600-1799  1800-1999  2000-2199  2200-2399  2400-2599

A band is **adequately powered** in a period when it holds >= 150 distinct players **and**
>= 3,000 eligible decisions in that period. Bands below that are reported with their counts and
excluded from the 80% agreement rule in VERDICT_RULES.md §4.2. Bands are never merged.

---

## 5. The pre-move rule

Every feature used to predict thinking time, and every feature used as an adjustment in the quality
model, must be computable from information available **before the human moved**.

Allowed: the pre-move board, its legal moves, engine analysis of the pre-move board, both clocks,
rating at game time, opponent rating, ply, phase, material, standing.

Forbidden: the move the human chose, the resulting board, the centipawn or win-probability loss of
that move, the accuracy label, the game result, any later move, any later clock.

This is enforced two ways, and both are tests that fail the build:

1. **Structural.** Every feature carries a provenance tag. A model may only consume features
   tagged `PRE_MOVE`. The outcome columns are tagged `POST_MOVE` and are unreachable from a model's
   feature list.
2. **Empirical.** For a sample of decisions, the played move is replaced with a different legal
   move and the whole pre-move feature vector is recomputed. Every pre-move feature must be
   **bit-identical**. Any feature that moves is leakage.

A leakage failure invalidates the experiment. It is not repaired and re-run as B3.

---

## 6. Value of computation, and why it is not circular

`VoC` answers: *before the human moved, how much would further search have changed the preferred
action or its value?* It is computed from **one deep engine search of the pre-move position**, by
comparing the engine's own state at a shallow iteration against its final state. The human's move
never enters it. Exact definitions in `FEATURE_SCHEMA.md` §5.

The known statistical hazard is stated here rather than left to be found: `VoC_regret` and the
quality outcome are both anchored on the same deep evaluation `E1` of the same search, so they
share that search's estimation noise. C9 re-scores a subset at a different node budget and repeats
the primary estimate; if the estimate is an artifact of shared engine noise, C9 is where it shows.

---

## 7. Models

`MODEL_SPEC.md` is the binding document. Summary:

* **T0** context baseline, **T1** + objective position/engine features, **T2** + VoC and the two
  preregistered interactions. Outcome `Y = log(1 + T)`, `T` in whole seconds.
* Residuals: `unexpected_time_population` = `Y - Yhat(T2 without rating)`;
  `unexpected_time_within_rating` = `Y - Yhat(T2 with rating)`;
  `unexpected_time_novoc` = `Y - Yhat(T1 without rating)`, used only by Metric C.
* Every model is **fitted on DEVELOPMENT, frozen, and applied unchanged** to VALIDATION, FINAL and
  the secondary time control. No refitting on a period the result is read from.
* Model family: additive natural-cubic-spline regression with a ridge penalty, plus the two named
  interactions. A gradient-boosted tree is fitted as a **predictive comparator only** and may not
  supply any reported scientific quantity.
* Uncertainty: **player-level block bootstrap**, 400 replicates, percentile intervals, for every
  reported effect. Move-level naive intervals are never reported.
* Rating-band effects are pooled with a normal-normal random-effects (partial pooling) estimator.

## 8. Controls

C1-C16 exactly as specified in the mission plan, plus C17 (`T = 0` exclusion) and C18 (first 40
plies only), which address A7 and A8 above. `MODEL_SPEC.md` §9 gives each control's exact
construction and its pass condition. The positive controls (C5, C6) are the ones that make a
negative result mean anything: a pipeline that cannot recover a planted signal produces
`SKILL_ONLY` on every dataset in the world.

## 9. Language that is forbidden regardless of result

* "law of nature", "we discovered a law", "proves", "causes"
* "confusion", "cognitive failure", "indecision", "hesitation" as names for a time residual
* any claim that this measures cognition, intelligence, or a mental state
* any predicted Elo from behavioural metrics

The strongest phrase this design can license, and only if the invariance tests support it, is
**`cross-rating law-like regularity`**; with the secondary time control replicating,
**`cross-context law-like regularity`**.

## 10. Freeze

On FABLE GATE 1 `PASS`, this file plus `DATA_PROTOCOL.md`, `FEATURE_SCHEMA.md`, `MODEL_SPEC.md`
and `VERDICT_RULES.md` are hashed (sha256) and the hashes and the git commit are recorded in
`REPRODUCIBILITY.md`. After that point a change to any of them is a new experiment, not this one.
