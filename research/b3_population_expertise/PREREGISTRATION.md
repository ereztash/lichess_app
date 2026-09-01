# B3 -- Population Expertise x Decision Dynamics

**Status:** DRAFT until FABLE GATE 1 returns PASS. Frozen and hashed at that point.
**Primary time control:** rated Standard Blitz `180+0` on lichess.org.
**Registered before:** any B3 engine scoring of any period, and before any B3 decision-level
statistic of any kind existed.

---

## 1. What is being tested, and what would count as nothing

The weak claim -- stronger players play better moves -- is already known and is not worth an
experiment. B3 tests something narrower and falsifiable:

> Does the relationship between thinking time and the engine-measured value of further
> computation **differ systematically with rating**, net of matched position and clock state --
> rather than expertise showing up only as a higher level of the quality outcome?

Two separable questions, tested separately:

**H1 (the regularity).** After adjusting for measurable pre-move position difficulty, the
pre-move value of further computation, the clock state, and rating, does a decision that took
*unusually long for that position and that skill level* still predict a worse move?

    QualityLoss_i = f(Difficulty_i, VoC_i, Clock_i, Rating_i) + beta * UT_within_i + e_i
    H1:  beta > 0

**H2 (expertise adaptation).** Does the time / value-of-computation relation change systematically
with rating? Five preregistered manifestations, of which Metric B is primary:

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

**And one thing more, which Gate 1 (R13) was right to force into the front of the document.** No H2
metric here distinguishes a better *allocation policy* from **better recognition of which positions
require computation**. The strongest H2 signal is the within-band slope of time on engine-measured
value-of-computation. A stronger player who merely *sees* that a position is sharp -- pattern
recall, opening knowledge, tactical vision -- produces a steeper slope with an identical allocation
policy, because a weaker player cannot allocate time to a position they cannot identify as
deserving it. Nothing measured here separates the two, and no covariate in this design could.

So the boxed question above is the claim, and it is deliberately narrower than the one this study
started with. The verdict label `EXPERTISE_ADAPTATION_SUPPORTED` is kept because the mission plan
fixes it, and `VERDICT_RULES.md` §3 defines what it is allowed to mean: *the time / VoC relation
differs systematically with rating, net of matched position and clock state.* Not "expertise
changes management". Not "stronger players manage their time better".

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
| A10 | **Pseudo-replication.** Hundreds of thousands of moves from a handful of very active accounts, or two sides of one game counted as two clusters. | At most **2 game-sides per player** and **at most one analysed side per game** (Gate 1, R6); player-level block bootstrap for every interval; C8 player-influence controls. | Yes -- but only with the one-side-per-game rule. Without it the two accepted sides of a game are alternate plies of one position sequence with coupled clocks, the dependence graph is a player-game graph rather than the tree `move ⊂ game ⊂ player`, and every band interval is too narrow, worst in the thinnest bands. |
| A11 | **Engine-assisted accounts.** Time that tracks engine difficulty paired with low quality loss is close to what assistance detection looks for, and it is exactly what Metric B rewards. Assisted accounts concentrate in the upper bands of a fast time control, and the strongest verdict is a top-versus-bottom band contrast. | One batch lookup of public account status per period, on a date recorded in the manifest; sides whose account is `disabled` or `tosViolation` are excluded and counted per band (Gate 1, R10). | Partly. The lookup is a snapshot: an account closed after the lookup date stays in, and one closed for an unrelated reason is removed. Both directions are reported, not corrected for. |
| A12 | **Thinking on the opponent's clock.** A decision that follows a long opponent think has a short own think time *and* better quality, which is a positive contribution to `beta` that has nothing to do with unusually long deliberation predicting a worse move. | `opp_prev_think_s` is a pre-move feature in T0 and therefore in every model (Gate 1, R9). C19 additionally adds the player's own previous think time. | Yes, to the extent the clocks measure it. |

---

## 3. Three periods, and what each may be used for

Non-overlapping, completed, historical. Constructed identically (§ DATA_PROTOCOL).

| Period | Source month | Role | May be used for |
|---|---|---|---|
| DEVELOPMENT | 2026-02 | build | debugging, feature development, the cost pilot, fitting the frozen models, setting the frozen standardisation constants |
| VALIDATION | 2026-04 | confirm | out-of-sample confirmation and calibration of an already-determined specification, and the C9 budget subset. **No choice is made on it.** |
| FINAL REPLICATION | 2026-06 | seal | **nothing** until FABLE GATE 2 returns PASS. Then opened once, mechanically. |
| SECONDARY CONTEXT | 2026-06, `300+0` | replicate | run only after the primary verdict is frozen. No retuning. |

The repository's opening book (`shared/opening-book-keys.ts`) was built from **2026-03**, which is
disjoint from all three periods. That is checked, not assumed.

**What is still open after this document is hashed (Gate 1, R8).** Exactly one thing:

| Open choice | Decision rule | Period that decides |
|---|---|---|
| the ridge penalty | lowest grouped-CV error over the frozen grid `{0.01, 0.1, 1, 10, 100}`, players as groups, 5 folds | DEVELOPMENT |

That is the entire list. Anything not on it is closed. The first draft of this table said
DEVELOPMENT could be used for "model-family exploration" and VALIDATION for "freezing the final
specification", which would have meant Gate 1 hashed a document that did not determine the analysis
and the specification was settled after two of the three periods had been seen. `MODEL_SPEC.md`
names one model family, one penalty grid and one knot rule, and `src/evaluate.py` is a
transcription of `VERDICT_RULES.md`; a transcription of an under-determined specification is not a
transcription.

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
2. **Empirical, in two perturbations, because one is not enough** (Gate 1, R7).
   * *The played move* is replaced with a different legal move and the whole pre-move feature
     vector is recomputed. Every pre-move feature must be **bit-identical**.
     (`tests/test_leakage.py`)
   * *The whole game suffix* -- every later move, every later `%clk` reading, `Termination` and
     `Result` -- is replaced with a different legal continuation, different clocks and a different
     outcome. Every pre-move quantity must be **bit-identical**. `seconds_taken` and `log_time` are
     the only non-outcome columns permitted to change, because they read `clk[i]`, the reading
     written *after* the move, which is exactly why they are outcomes here and never predictors.
     (`tests/test_suffix_leakage.py`)

   The first perturbation alone cannot see a feature that reads a later clock, a later move or the
   result -- a `clock_ms_self` mistakenly taken from `clk[i]` instead of `clk[i-2]` passes it
   bit-identical. B2's own ledger records that clock-derivation defects are the ones that actually
   happen: its starting clock was inferred from the largest eligible reading and was wrong in 63 of
   75 games, by up to 86 seconds.

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

C1-C16 exactly as specified in the mission plan, plus C17 (`T = 0` exclusion), C18 (first 40 plies
only), **C5b** and **C19**. `MODEL_SPEC.md` §9 gives each control's exact construction and its pass
condition.

**What C5 actually establishes, corrected** (Gate 1, R11). C5 plants a term linear in the
estimator's own regressor, so its recovery follows from linear algebra and it can only fail on a
code bug. It is an **implementation check**. It does not establish that a real signal -- one living
in raw time under an expected-time model that is not T2R -- would be seen, so the claim that C5 is
what makes a negative verdict meaningful was wrong and is withdrawn.

**C5b** is the control that does that work: it plants `0.02 x (Y - Yhat_GBT)`, the residual of the
pinned gradient-boosted comparator, which is a quantity this pipeline's linear specification never
produced. What comes back is the fraction of a real, foreign signal the frozen specification
actually recovers. That fraction is the **attenuation factor every reported effect should be read
against**, and a shortfall is a measurement rather than an invalid run.

## 9. Language that is forbidden regardless of result

* "law of nature", "we discovered a law", "proves", "causes"
* "confusion", "cognitive failure", "indecision", "hesitation" as names for a time residual
* any claim that this measures cognition, intelligence, or a mental state
* any predicted Elo from behavioural metrics
* **"allocation skill", "time-management skill", "manages time better", "spends time more wisely"**
  or any equivalent, as a reading of a Metric B gradient (Gate 1, R13). The gradient is consistent
  with better *recognition* of which positions are sharp, and this design cannot separate the two.
* "expertise changes how players manage the process", in the verdict, the abstract or the
  conclusion

The strongest phrase this design can license, and only if the invariance tests support it, is
**`cross-rating law-like regularity`**; with the secondary time control replicating,
**`cross-context law-like regularity`**.

## 10. Freeze

On FABLE GATE 1 `PASS`, this file plus `DATA_PROTOCOL.md`, `FEATURE_SCHEMA.md`, `MODEL_SPEC.md`
and `VERDICT_RULES.md` are hashed (sha256) and the hashes and the git commit are recorded in
`REPRODUCIBILITY.md`. After that point a change to any of them is a new experiment, not this one.
