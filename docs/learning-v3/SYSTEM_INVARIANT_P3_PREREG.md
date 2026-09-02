# P3 — Cross-rule system-invariant transfer (FROZEN BEFORE RUN)

Status: **PREREGISTERED / NOT YET RUN**  
Date: 2026-09-02  
Branch: `claude/repo-native-os-extraction-o1psvb`

## Goal

Test the stronger claim left unresolved by P2:

> Among multiple moves that already satisfy a valid action predicate and already resolve the focal threat, a rule-agnostic representation of the resulting chess system can rank the better move out of sample, including when the rule class being tested was never seen in training.

This is intentionally stronger than detecting whether a move merely leaves the focal piece in a bad spot.

## Frozen scope

Use only natural, non-twin, non-sham, trigger-positive items from:

- `RC-07`
- `RC-08`
- `RC-09`

Include an item only when:

1. its original committed item has `v_star_xs`;
2. at least two moves in that class's committed `B(s)` have preserved individual `multipv-over-B` engine values;
3. no new engine search is required.

All candidate moves in this scope already satisfy the class action predicate. The experiment therefore cannot pass merely by detecting action-set membership.

## Outcome

For each preserved B move:

`regret = v_star_xs - move_xs`

Primary unit: an unordered pair of B moves from the **same position** whose regrets differ by at least `0.01` expected-score units.

Primary score: pairwise ranking accuracy — whether the model assigns larger predicted regret to the move with larger observed regret.

Ties in model prediction score 0.5.

## Transfer protocol

Use **leave-one-rule-class-out (LOCO)** only:

- train on RC-07 + RC-08, test RC-09;
- train on RC-07 + RC-09, test RC-08;
- train on RC-08 + RC-09, test RC-07.

The tested class is never present in its own training set.

No `rule_class` feature is allowed in any model.

No hyperparameter search is allowed. All models use the same fixed Ridge regression (`alpha=1.0`) after median imputation and standard scaling of numeric features.

## Frozen models

### M0 — position-only baseline

Features known before choosing among candidate moves:

- `v_star`
- `n_legal_pre`
- `material_balance_pre`
- `piece_count_pre`

Within one position these are identical, so this baseline should be approximately 0.5 pairwise accuracy. It remains in the protocol as a leakage/control check.

### M1 — local-move comparator (non-systemic)

M0 plus only local/geometric descriptors of the candidate move:

- moving piece type (1–6 encoded numeric)
- capture flag
- captured piece value
- promotion piece type (0 when none)
- from file, from rank
- to file, to rank
- Chebyshev move distance
- Manhattan move distance
- gives-check flag
- focal-piece-moved flag

This comparator can exploit simple geometry and tactical-looking move properties but receives no graph/network description of the resulting board.

### M2 — system model

M0 + M1 + the following **rule-agnostic, engine-free** pre→post system features. Every feature is computed from the board and candidate move only; none may call the engine, SEE, a tablebase, or the rule identifier.

For the mover's side, before and after the candidate move:

1. `own_attack_edges`: total directed attacks from own pieces to enemy occupied squares.
2. `own_support_edges`: total directed attacks from own pieces to own occupied squares.
3. `opp_attack_edges`: same for opponent against mover's pieces.
4. `opp_support_edges`: opponent internal support edges.
5. `own_attacked_piece_count`: own non-king pieces attacked by opponent.
6. `opp_attacked_piece_count`: opponent non-king pieces attacked by mover.
7. `own_hanging_piece_count`: own non-king pieces attacked and with zero own defenders.
8. `opp_hanging_piece_count`: opponent analogue.
9. `own_hanging_value`: sum of standard piece values for own hanging pieces.
10. `opp_hanging_value`: opponent analogue.
11. `own_overloaded_piece_count`: own non-king pieces with opponent attackers strictly exceeding own defenders.
12. `opp_overloaded_piece_count`: opponent analogue.
13. `own_redundantly_defended_count`: own non-king pieces with at least two own defenders.
14. `opp_redundantly_defended_count`: opponent analogue.
15. `own_min_defenders_on_attacked`: minimum own defenders among attacked own non-king pieces; 0 if none.
16. `opp_min_defenders_on_attacked`: opponent analogue.
17. `own_max_defense_dependency`: maximum number of own occupied squares defended by any single own non-king piece.
18. `opp_max_defense_dependency`: opponent analogue.
19. `own_pinned_count`: own pieces absolutely pinned to king using python-chess `is_pinned`.
20. `opp_pinned_count`: opponent analogue.
21. `own_king_ring_enemy_attacks`: number of legal king-neighbour squares currently attacked by opponent.
22. `opp_king_ring_enemy_attacks`: opponent analogue.
23. `own_king_ring_own_defenses`: total own defender relations onto own king-neighbour squares.
24. `opp_king_ring_own_defenses`: opponent analogue.
25. `own_legal_moves_post`: mover's legal-move count on the mover's next turn proxy is NOT available without adding a ply and is therefore forbidden. Instead use only immediately observable post-state relations listed above.

For features 1–24, include both:

- the post-move value;
- `delta = post - pre`.

No other system feature may be added after this freeze.

## Statistical procedure

1. Fit M0, M1, M2 separately in each LOCO fold.
2. Produce predictions only for the held-out class.
3. Pool held-out predictions across the three folds.
4. Compute pairwise accuracy overall and per held-out class.
5. Compute 95% cluster-bootstrap confidence intervals with **position as the resampling cluster**, 5,000 bootstrap replicates, seed `20260902`.
6. Report paired gain in pairwise accuracy for:
   - M2 − M0
   - M2 − M1
   - M1 − M0
7. Also report held-out MAE and R² as secondary diagnostics. They cannot override the primary decision.

## Frozen decision rule

### `P3-PASS — transferable system invariant supported`

All of the following must hold:

1. pooled M2 pairwise accuracy is > 0.50;
2. the 95% cluster-bootstrap CI for pooled `(M2 − M1)` is entirely > 0;
3. the 95% cluster-bootstrap CI for pooled `(M2 − M0)` is entirely > 0;
4. M2 point-estimate pairwise accuracy is > 0.50 in **all three** held-out rule classes;
5. at least **two of three** held-out classes have a class-specific 95% CI for `(M2 − M1)` entirely > 0.

Only this verdict licenses the statement:

> A rule-agnostic relational/system representation carries transferable information about move quality among already-valid actions.

It does **not** license claims about causality, human recognizability, homeostasis, controllability, or superiority to Stockfish.

### `P3-PARTIAL — system signal without transferable invariant`

Use this verdict if pooled M2 beats M1 with CI > 0 but breadth condition 4 or 5 fails.

Allowed statement:

> System features add information in this corpus, but the evidence does not support a rule-general invariant.

### `P3-FAIL — transferable system invariant not supported`

Use this verdict if pooled `(M2 − M1)` CI includes zero or is negative.

Consequence:

- do not promote the current system ontology into product logic;
- retain P2's narrower finding that viability checks can detect unsafe implementations of broad prescriptions;
- any further systems work requires a new ontology and a new preregistered experiment.

## Falsifiers / leakage guards

The run is invalid rather than failed if any of these occurs:

- a new Stockfish/engine search is executed;
- any held-out class appears in its own training data;
- `rule_class`, engine score, engine rank, or B-set aggregate is used as a feature;
- system feature definitions differ from the frozen list above;
- the regret threshold, bootstrap unit, seed, model family, or decision rule changes after results are visible;
- duplicate rows from the same `(position_id, move)` are counted more than once.

## Prior evidence and why it does not decide P3

P2 found a strong pooled signal but only a weak/null signal in RC-07/08/09 when every B move already resolved the focal threat. P3 is a deliberately new and harder claim: richer global relational features must generalize **across unseen rule classes** and beat a local-move comparator. P2 therefore motivates P3 but cannot count as confirmation of it.
