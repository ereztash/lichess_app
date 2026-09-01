# B3 -- Feature schema

Frozen with `PREREGISTRATION.md`. Every column is tagged. A model may only consume `PRE_MOVE`.

---

## 1. Engine configuration (frozen)

| Setting | Value |
|---|---|
| binary | official Stockfish 17.1 Linux `x86-64-avx2` build |
| sha256 | `7fecbc0b26454b62be5e3b237b58dc5666401b56e520aeb1b0bf8f53fa8f2ef3` |
| `Threads` | 1 |
| `Hash` | 32 MB |
| `MultiPV` | 4 |
| budget | `go nodes 60000` -- a **node** limit, not a time limit, so the search does not depend on machine load |
| hash reset | `ucinewgame` + `isready` before **every** search |
| searches per decision | 2: the pre-move position, and the position after the human's move. Identical settings for both, so `E1_before` and `E1_after` are measured the same way. |

Determinism was measured before any B3 data existed, not assumed
(`tests/test_engine_determinism.py`): with the hash cleared, repeated runs are identical, runs in a
fresh process are identical, position order does not matter, and `Hash` size does not matter. With
the hash **not** cleared, results change -- which is why clearing is mandatory and is the same
defect the repository's own import harness was built to catch.

Node budget 60,000 reaches median depth ~12 at `MultiPV 4`, which is deliberately close to B2's
`importDepth = 12`, so B3's difficulty scale is comparable to B2's.

## 2. Evaluation units

All evaluations are converted to **win probability for the side to move** using the repository's
own constant, ported exactly:

    win_probability(cp) = 1 / (1 + exp(-0.00368208 * cp))          # shared/win-probability.ts
    comparable_cp(mate=+n) = +10000 ; comparable_cp(mate=-n) = -10000

Centipawns are never used as a unit of a reported effect: 30 cp costs 2.76 percentage points of
winning chances at a level position and 0.28 at +10.00, so a centipawn is not one thing. This is
the same repair `shared/win-probability.ts` documents.

## 3. Position features (`PRE_MOVE`)

| Name | Definition |
|---|---|
| `ply` | 0-based ply index of the decision |
| `phase` | repo rule: `endgame` if non-pawn material <= 13, else `opening` if `ply <= 20`, else `middlegame` |
| `non_pawn_material` | sum over both sides, N=B=3, R=5, Q=9 |
| `legal_moves` | count of legal moves in the pre-move position |
| `in_check` | side to move is in check |
| `standing` | repo rule from `E1_before`: `winning` if >= +100 cp, `losing` if <= -100 cp, else `level` |
| `side` | analysed player's colour |
| `move_number` | full-move number |

## 4. Engine difficulty features (`PRE_MOVE`)

From the **pre-move** search only.

| Name | Definition |
|---|---|
| `wp1` | win probability of the best line, side to move |
| `edge` | `abs(wp1 - 0.5)`; how decided the position already is |
| `gap12` | `wp1 - wp2`, win-probability units. The cost of playing the second-best move. |
| `gap1k` | `wp1 - wpK`, K = 4 |
| `ambiguity_entropy` | Shannon entropy of `softmax(wp_k / tau)` over the K lines, `tau = ACCURATE_WIN_PROBABILITY_LOSS = 0.02761` win-probability units. Frozen. The scale is **borrowed, not chosen**: it is what 30 centipawns costs at a level position, the threshold this repository already uses to decide whether a move gave anything away. |
| `n_near` | count of the K lines within `ACCURATE_WIN_PROBABILITY_LOSS` win probability of the best -- moves that are, by the study's own outcome definition, as good as the best. **The transformation-free alternative** required by the plan: it is a count of moves, not a function of a chosen temperature. |
| `best_move_changes` | number of times the depth-1 principal move changed across completed iterations of the search |
| `eval_volatility` | standard deviation of `wp1` across completed iterations from depth 4 onward |
| `pv_instability` | mean normalised Hamming distance between the depth-`d` and depth-`d+1` principal variations over their common prefix length, averaged over iterations |
| `final_depth` | depth of the last completed iteration |
| `nodes_to_depth10` | nodes reported at the first iteration reaching depth >= 10; `null` if never reached |
| `is_mate_line` | best line is a forced mate |

`best_move_changes`, `eval_volatility`, `pv_instability` and `nodes_to_depth10` are **engine search
complexity**. They are named that way throughout and are never described as human cognitive
complexity: they measure how hard this position is for *this engine at this budget*.

## 5. Value of computation (`PRE_MOVE`)

Computed from the same pre-move search, comparing the engine's state at a **shallow iteration**
against its final state. `D_SHALLOW = 8`: the last completed iteration at depth <= 8. Frozen.

Nothing below reads the human's move. That is the point, and it is enforced by the empirical
leakage test in `PREREGISTRATION.md` §5.

| Name | Definition |
|---|---|
| `voc_switch` | `1` if the best move at the shallow iteration differs from the final best move |
| `voc_regret` | **primary.** `wp_deep(best_deep) - wp_deep(best_shallow)`, in win-probability units, clipped to `[0, 0.5]`. If `best_shallow` is not among the final K lines, its deep value is taken as `wpK` -- a lower bound on the regret -- and the row is flagged `voc_regret_censored`. |
| `voc_drift` | `abs(wp_deep(E1) - wp_shallow(E1))` |
| `voc_rank` | `1 - Spearman rho` between the shallow and final orderings of the moves present in both lists; `0` when fewer than 3 moves are common |
| `voc_z` | `voc_regret` standardised by the **DEVELOPMENT-period** mean and standard deviation. One frozen transformation, applied unchanged to every period, so a band coefficient means the same thing everywhere. |

Censoring rate is reported. If it exceeds 15% of decisions in DEVELOPMENT, `voc_regret` is unusable
as specified and the design returns to Gate 1 rather than being patched after the fact.

## 6. Clock features (`PRE_MOVE`)

| Name | Definition |
|---|---|
| `clock_ms_self` | the analysed player's clock as they began the decision |
| `clock_ms_opp` | the opponent's clock at the same instant |
| `clock_frac` | `clock_ms_self / (1000 * base_seconds)` |
| `clock_pressure` | `-log(clock_frac + 0.01)`; increases as the clock empties |
| `clock_diff_frac` | `(clock_ms_self - clock_ms_opp) / (1000 * base_seconds)` |

## 7. Skill features (`PRE_MOVE`)

`rating` (analysed side, at game time), `rating_band`, `opponent_rating`, `rating_diff`.

## 8. Time (`PRE_MOVE` as an outcome, never as a predictor of itself)

| Name | Definition |
|---|---|
| `seconds_taken` | `T = clk[i-2] - clk[i] + increment`, whole seconds |
| `log_time` | `Y = log(1 + T)`. **The primary time representation.** Buckets are for figures only. |

## 9. Outcome (`POST_MOVE` -- unreachable from any model's feature list)

| Name | Definition |
|---|---|
| `quality_loss` | `wp1_before - (1 - wp1_after)`, clipped at 0 below. `wp1_after` is the best line of the **post-move** search, which is from the opponent's point of view, so `1 - wp1_after` is the mover's winning chances after their own move. Both searches use identical settings. Units: win probability, `[0, 1]`. |
| `accurate` | B2-compatible secondary: `quality_loss <= ACCURATE_WIN_PROBABILITY_LOSS`, the repository's derived constant (what 30 cp costs at a level position). Used only for C10. |

`quality_loss` is continuous and is the primary outcome. `accurate` exists so B3 and B2 can be read
against each other, and for nothing else.
