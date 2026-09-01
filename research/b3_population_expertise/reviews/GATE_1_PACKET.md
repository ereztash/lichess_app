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
