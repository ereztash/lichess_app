# FABLE GATE 1 -- evidence packet

**Prepared by:** Opus 5 (main session), before any B3 engine scoring of any period.
**State of the experiment:** design drafted, no B3 data ingested, no B3 decision scored, no B3
statistic computed. The FINAL period has never been read.

**Documents under review (the whole design, nothing withheld):**

* `research/b3_population_expertise/PREREGISTRATION.md`
* `research/b3_population_expertise/DATA_PROTOCOL.md`
* `research/b3_population_expertise/FEATURE_SCHEMA.md`
* `research/b3_population_expertise/MODEL_SPEC.md`
* `research/b3_population_expertise/VERDICT_RULES.md`

---

## 1. What B2 was, and why B3 exists

B2 (`research/b2/`) asked whether any representation of think time beats a raw second at separating
move accuracy. It ran on **one account's** 117 rated blitz games, 2,720 eligible decisions, scored
by Stockfish 18 Lite WASM at depth 12, and returned `OBSERVATION`: Lichess encoding buckets beat
raw seconds and beat their own random-boundary null on both halves (13.03pp vs 0.00pp, null 8.16pp
on the preregistered 40-game corpus).

B2's limits are exactly B3's motivation: one player, one skill level, no measure of position
difficulty, no measure of the value of further computation, and a binary accuracy outcome.

**B2 reproduction status:** the corpus rebuilt from the public Lichess API reproduces B2's
manifest exactly -- the same 117 game ids, the same derivation/held-out halves, the same recency
ranks, the same base clocks, the same time-control and event counts. The five-pass engine harness
is re-running now against the restored `sf-wasm.sh` wrapper; its `evidenceSha256` is the
reproduction target. B3 does not proceed past the design gate on the strength of a partial
reproduction; the result is recorded in `REPRODUCIBILITY.md` and, if it fails, B3 stops with
`BLOCKED_BY_B2_REPRODUCIBILITY`.

## 2. Hypotheses

**H1.** After adjusting for measurable pre-move difficulty, pre-move value of computation, clock
state and rating, does unusually long deliberation still predict a worse move?
`beta = d quality_loss / d unexpected_time_within_rating > 0`.

**H2.** Does expertise change how players operate inside that process? Five metrics; Metric B
(Time Allocation Efficiency) is primary and is a *required* component of the strongest verdict.

## 3. The causal picture, stated as assumptions rather than a claim

```
                  rating ──────────────────────────┐
                     │                             │
                     ▼                             ▼
  position ──▶ difficulty ──▶ think time ──▶ quality_loss
  (pre-move)      │  ▲            ▲   │            ▲
                  │  │            │   └────────────┘   (mediation, not identified)
                  ▼  │            │
                VoC ─┘        clock state
```

* Nothing here is identified causally. `beta` is an adjusted association.
* The arrow `difficulty → think time` and `difficulty → quality_loss` is the confounding path the
  whole T2 adjustment exists to block, and **it cannot be blocked completely**, because difficulty
  is measured with error by an engine at a fixed budget. This is stated as the central limitation
  in `PREREGISTRATION.md` §2 A2 and is not treated as solved.
* `rating` is a proxy for a bundle: chess knowledge, pattern recall, calculation speed, clock
  habits, and the opponent pool. A rating gradient in a management metric does **not** isolate any
  one of those. The report may not claim it does.

## 4. Sample and its known weaknesses

* Rated Standard `180+0` only, one time control, so time-control heterogeneity is removed by
  design rather than adjusted for.
* Three non-overlapping single-UTC-day windows from three different months (2026-02, 2026-04,
  2026-06). **Weakness:** a single calendar day per period. The player mix on one day is not the
  player mix of a month, and a day-specific event (a holiday, an outage, a tournament) is a
  period-level confound for the replication comparison, though not for a within-period estimate.
  The rule is identical for all three periods and was chosen before any period was read.
* Rating at game time, from the PGN headers.
* At most 2 game-sides per player, at most 60 decisions per side. Target: hundreds of independent
  players per band.
* **Weakness:** the two extreme bands (800-999 and 2400-2599) may fail the adequate-power test.
  The rule is to report the deficiency and exclude those bands from the agreement counts, never to
  merge them into a neighbour.

## 5. Leakage boundary

Stated in `PREREGISTRATION.md` §5. Two enforcement mechanisms: a provenance tag on every column
that makes `POST_MOVE` unreachable from a model, and an empirical test that swaps the played move
for a different legal move and requires every pre-move feature to be bit-identical.

The specific leakage risks considered:

1. `quality_loss` uses `E1_before`, and `voc_regret` also uses the same search. **Shared engine
   noise**, addressed by C9 (different node budget on a subset). Not eliminated.
2. Anything derived from the resulting position. Excluded structurally.
3. The book membership test reads the pre-move FEN only, never the move played.
4. The frozen standardisation constants (`voc_z`, terciles, `q`, knots, ridge penalty) all come
   from DEVELOPMENT and are written into `results/model_manifest.json` before VALIDATION is opened.

## 6. Value of computation -- the definition most likely to be wrong

`voc_regret = wp_deep(best_deep) - wp_deep(best_shallow)`, both from **one** pre-move search,
comparing the last completed iteration at depth <= 8 against the final iteration. Censored (and
flagged) when the shallow best move has fallen out of the final top-4; the censored value is the
4th line's value, a lower bound. If censoring exceeds 15% of DEVELOPMENT decisions the definition
is declared unusable and the design returns here rather than being patched later.

The circularity that would kill it -- defining VoC from the human's move -- is excluded by
construction and tested empirically. The remaining hazard is that `voc_regret` is a difficulty
measure in disguise, which would make Metric B a restatement of Metric A. That is why Metric B is
estimated **conditional on the T1 difficulty set** and why C4 must destroy it.

## 7. Outcome

`quality_loss = wp1_before - (1 - wp1_after)`, continuous, win-probability units, from two searches
with identical settings. Secondary binary `accurate` for B2 comparability (C10 only).

## 8. Models, controls, verdicts

`MODEL_SPEC.md` §1-§9 and `VERDICT_RULES.md` in full. The features of the design that are meant to
make a false positive hard:

* Every model fitted on DEVELOPMENT only and applied frozen. The period a result is read from never
  fits a model.
* Every interval is a player-level block bootstrap; no move-level intervals anywhere.
* An absolute effect-size floor (`BETA_FLOOR = 0.002`) fixed before any estimate existed, so a
  hair-thin but significant effect cannot pass.
* Eleven simultaneous conditions for the strongest verdict, including two negative controls (C3,
  C4) and a player-influence control (C8).
* Three positive controls (C5, C6, C7) whose failure makes the run invalid rather than negative.

## 9. Known uncertainties, listed by us before you look for them

1. **Difficulty is measured with error.** The residual `unexpected_time` will absorb whatever the
   engine features miss. This is the strongest alternative explanation and it survives the design.
2. **Clock granularity is whole seconds.** A large mass of decisions reads `T = 0`. C17 removes
   them; the primary keeps them.
3. **`voc_regret` and `quality_loss` share `E1_before`.** C9 is the only check and it runs on a
   5,000-decision subset, so it is a direction check, not a precise one.
4. **One calendar day per period.**
5. **Two searches per decision at 60k nodes** is a modest budget. Deeper analysis would change the
   difficulty scale; whether it would change the *sign* of anything is what C9 asks.
6. **Rating bands at the extremes may be underpowered**, and the 80% agreement rule is then
   computed over fewer bands, which makes it easier to pass. This is a real softness in the verdict
   rule and we are flagging it rather than hiding it.
7. **Metric B is a slope of log-time on VoC.** If stronger players simply have more variable
   thinking times, a slope can rise without better allocation. The partial-correlation form is
   reported beside it for exactly this reason, but the *verdict* reads the slope.
8. **The player-disjointness of FINAL is not enforced at sampling time**, only measured and
   reported afterwards, with a preregistered restricted re-estimate.

## 10. What we are asking you to do

Try to invalidate this experiment before it becomes expensive. Specifically search for
circularity, leakage, pseudo-replication, an invalid Value-of-Calculation proxy, confounding that
would mechanically generate a rating gradient, weak controls, and ways a positive result could
appear even if expertise only means stronger chess knowledge.

Return `PASS`, `PASS_WITH_REQUIRED_CHANGES`, or `FAIL`.

---

# ADDENDUM: what changed in response to the Gate 1 review

Prepared for the Gate 1 **re-review**. The verdict under review was
`PASS_WITH_REQUIRED_CHANGES` with thirteen required changes. All thirteen are applied. Still no B3
period has been scored, no decision exists, and the FINAL period has never been read.

| # | Required change | Where it landed |
|---|---|---|
| R1a | Metric B's interaction had no `rating` main effect | `MODEL_SPEC.md` §4 Metric B; `analysis.RatingBasis` and `gradient_with_main_effect` -- the gradient is now the coefficient of `eV x rating_c` in `eY ~ s(rating) + eV + eV x rating_c`, spline knots frozen on DEVELOPMENT, threaded through every estimator, every control and the matched sample |
| R1b | "evaluated per period" undefined for a fitted coefficient | `MODEL_SPEC.md` §4 preamble: one construction for all of H2 -- frozen nuisance, few-parameter re-estimate, stated as a two-step recipe |
| R1c | `voc_z` must be residualised on the same frozen nuisance | already true in code (`partial_voc`); now stated in `MODEL_SPEC.md` §4 with the reason (`voc_switch` shares an iteration history with `best_move_changes`; a censored `voc_regret` equals `gap1k`) |
| R1d | the partial-correlation form was `gamma_b * sd(voc_z) / sd(Y)`, and `sd(voc_z)` is 1 by construction | `MODEL_SPEC.md` §4: it is `corr(eY, eV \| band b)`, which is what `estimands.partial_corr` computes |
| R2 | three mechanical routes to a Metric B gradient not closed | `MODEL_SPEC.md` §4 has the table of routes; `VERDICT_RULES.md` §2.5 condition 5 now requires the gradient to hold **with an interval excluding zero** on the matched sample, with `T = 0` removed, and in the lowest `clock_pressure` tercile; `evaluate.py` checks all three |
| R3 | the 20% relative TAE floor is degenerate | `TAE_FLOOR = 0.02`, absolute, in the metric's own units; `TAE(lowest)` reported in every table; `test_verdict_rules.py::test_an_absolute_tae_floor_cannot_be_passed_by_a_near_zero_base` |
| R4 | gates non-exhaustive; precedence, raw-vs-shrunk, rounding, band count, Metric C all undefined | `VERDICT_RULES.md` §1 and §2.2-§2.5 rewritten: parenthesised precedence, band shape moved to the level ladder, raw estimates for shape tests, `ceil`, **minimum 5 adequately powered bands**, Metric C demoted to descriptive. `evaluate.py` asserts exactly one gate fires; `test_verdict_rules.py` exercises the hole you found and 15 constructed inputs |
| R5 | `opponent_rating` proxies the exposure | `models.T0_NUMERIC` carries `rating_diff`; `opponent_rating` is recorded and is in no model. Documented in `MODEL_SPEC.md` §1 and `FEATURE_SCHEMA.md` §7 |
| R6 | both sides of one game counted as independent clusters | `ingest.Sampler.offer` takes **one analysed side per game**, by the smaller hash, and counts the other. `DATA_PROTOCOL.md` §4.3; A10 in `PREREGISTRATION.md` §2 re-justified with the reason it was false |
| R7 | the leakage test could not see later clocks, later moves or the result | `tests/test_suffix_leakage.py`: the whole game suffix -- moves, `%clk` readings, `Termination`, `Result` -- is replaced and every pre-move quantity must come back bit-identical; `seconds_taken`/`log_time` are the only exempt columns, and the test asserts they *did* move so the fixture cannot silently prove nothing |
| R8 | a design freedom survived the freeze | `PREREGISTRATION.md` §3: "model-family exploration" and "freezing the final specification" are gone; there is now a one-row table of everything still open (the ridge penalty, by grouped CV on DEVELOPMENT over the frozen grid) and the sentence "anything not on it is closed" |
| R9 | the opponent's previous think time is an omitted pre-move predictor | `opp_prev_think_s` is in T0 (`clock.opponent_previous_think`); `own_prev_think_s` is recorded, excluded from every primary model, and added by the new control **C19**; A12 added to `PREREGISTRATION.md` §2 |
| R10 | engine-assisted and closed accounts not excluded | `src/account_status.py`: one batch `POST /api/users` per period before any engine work, `disabled`/`tosViolation` excluded and counted, lookup date in the manifest. A11 added, with the snapshot limitation stated in both directions. Measured on a development smoke sample: **5.5% of sampled sides** are excluded by this rule |
| R11 | C5 is tautological and the negative-verdict claim rested on it | C5 relabelled an implementation check; the claim withdrawn in `PREREGISTRATION.md` §8; **C5b** added -- plants `0.02 x (Y - Yhat_GBT)`, the residual of a comparator pinned to library, hyperparameters and seed in `FEATURE_SCHEMA.md` §1; `recovered_fraction` is reported as the attenuation factor, and below 0.5 it is an `INVALID_EXPERIMENT` trigger |
| R12 | C9 under-specified and its pass condition could not detect A2 | `src/rescore.py` and `src/c9.py`: subset drawn from **VALIDATION** by `unit_hash(SEED, "c9", ...)`, nuisance refitted per budget with the frozen recipe, `r_beta` and `r_TAE` with player-bootstrap intervals. `VERDICT_RULES.md` §2.5c: upper bound of `r_beta` below **0.5** withholds level 3 and above, whatever gate fired |
| R13 | H2 as worded is not answerable | `PREREGISTRATION.md` §1's boxed question narrowed to "the time / value-of-computation relation differs systematically with rating, net of matched position and clock state"; a paragraph added saying no metric here separates allocation from **recognition**; "allocation skill", "time-management skill", "manages time better" and "expertise changes management" added to §9's forbidden list; `VERDICT_RULES.md` §3 level 4 rewritten and §3.1 added defining what the label is not |

**Not changed, and why.** The label `EXPERTISE_ADAPTATION_SUPPORTED` is kept because the mission
plan fixes the name. `VERDICT_RULES.md` §3.1 now defines it as exactly the narrowed sentence and
forbids the management reading in the report.

**Also recorded since the first packet.** Five implementation defects, all found before any
scientific quantity existed, in `FAILURES.md`. Two of them would not have failed loudly: a SAN
tokenizer that silently dropped every plain pawn push, and `parse_san` rejecting `h5?`, which was
excluding 10.7% of sampled sides -- and not at random, since an annotated game is one somebody asked
for an analysis of. One constant changed after a development sample was inspected (`AMBIGUITY_TAU`,
which was saturating at `log 4`); it is now anchored to `ACCURATE_WIN_PROBABILITY_LOSS`, a constant
that predates B3, and the change is disclosed in `FAILURES.md` F4.

**Tests:** 39 pass, including engine determinism against the real binary, both leakage
perturbations, the constant ports against their TypeScript sources, and the verdict gate set.

---

# ADDENDUM 2: the re-review's nine new changes

Prepared for the short third re-read the re-review asked for. All nine applied.

| # | Required change | Where it landed |
|---|---|---|
| N1a | band, player and matched statistics used `<y,x>/<x,x>` where `MODEL_SPEC.md` §4 says `cov/var` | `analysis.slope` and `analysis.partial_correlation` now centre both vectors within the set being estimated, with the measured bias (0.009-0.013 against a floor of 0.02) written into the docstring. Every caller goes through them |
| N1b | the same at player level, where the product term is the size of the effect | `estimands.player_level` centres within the player, and `make_report.py`'s player figure with it. The docstring names it as the R1(a) mechanism one level down |
| N1c | the `allocation_loss ~ T1P` and `extreme_ut ~ T1P` fits §4 names did not exist | `analysis.fit_metric_nuisances`, called from `run.py` **after** `ut_q95` exists (`extreme_ut` is defined by it); `residualise` attaches `allocation_resid` and `extreme_resid`; `estimands` uses them for Metrics C and D |
| N2 | §2.3 was conjunctive, so cases fell through the gate set, and the `assert` was a tautology | `VERDICT_RULES.md` §2.3 is now the residual gate, with rating-on-quality and the H2 count reported **beside** it as facts. §2.3b adds `ADAPTATION_WITHOUT_REGULARITY` for the live case the re-review named -- the metric bar met while H1 fails -- at level 0 and explicitly off the ladder. Both are in `evaluate.py` and tested |
| N3 | level 3 required a `monotone enough` shape with no preregistered sign, and the code awarded it on a merely finite Spearman | the shape test is deleted from level 3; the band Spearman of `beta` is reported descriptively with no sign and no threshold |
| N4 | absent or malformed controls read as passes; censoring read on the wrong period; C3/C7 checked one gradient | `evaluate.REQUIRED_CONTROLS` + `missing_or_malformed`: absence, a `note`-only payload, or a non-finite interval is `INVALID_EXPERIMENT` with the control named. Censoring is read on **DEVELOPMENT** and FINAL's is reported beside it. C3 and C7 are checked on Metric B, Metric A and Metric D. Metric A is stated to be directional-only, with its band table computed for the figures |
| N5 | C19 fitted `T2R_C19` on the period it was read from, FINAL included | `T2R_C19`, `Q0_C19` and `partial_ut_C19` are fitted on DEVELOPMENT in `fit_metric_nuisances`; the control reads their residuals like every other estimate |
| N6 | the player-disjoint restriction was a placeholder and the `300+0` stage did not exist | `run.py` computes the DEVELOPMENT+VALIDATION player set, restricts FINAL, and writes `player_disjoint_final` with `beta`, the gradient, the spread **and the three condition-5 quantities**; the `secondary` stage runs the frozen models on `300+0` and writes `secondary_time_control` |
| N7 | the account exclusion was counted in total, not per band | `score.py` writes `account_closed_by_band`, `account_unknown_by_band`, `account_checked_sides_by_band` and `account_closed_rate_by_band`. In before DEVELOPMENT was ingested, since the usernames are dropped immediately after |
| N8 | C9's power was not stated | `VERDICT_RULES.md` §2.5c carries the arithmetic and the conclusion: the trigger fires only for attenuation of roughly two-thirds or more, a realistic difficulty-proxy effect is invisible to it, and a non-firing C9 is not evidence against A2. Added to `PREREGISTRATION.md` §9's forbidden readings |
| N9 | text that would be hashed as false | A3 and A5 rewritten to `rating_diff` with the pairing-diagonal caveat; the `§4.2` reference corrected; C14 and C17 rows say they are verdict conditions; C5b's "attenuation factor for every effect" corrected to "of a signal of that shape", with the over-reading added to §9 |

**Also taken from the observations.** The second gradient-boosted tree is gone: `tree_comparator`
now reports the **pinned** comparator that C5b plants the residual of, so the report cannot cite a
tree the control did not use.

**Tests:** 43 pass, including a required control that did not run, a malformed control payload, the
censoring period, and the `ADAPTATION_WITHOUT_REGULARITY` case.

**State of the experiment.** DEVELOPMENT ingest and engine scoring are running as this is written
(the re-review permitted scoring to start once N7 was in). No output of `run.py` has been produced or
read. VALIDATION and FINAL have not been touched.
