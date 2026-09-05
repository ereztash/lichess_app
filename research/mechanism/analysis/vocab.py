"""
FROZEN DESIGN for the governed search. Every number here is written in the mission ledger before
any outcome-bearing run on the real target. Changing one is a new, named design version.

Vocabularies:
  OBS  -- player-observable pre-move features (board, clock, opponent's last move, own history,
          game context). A trigger for an intervention must be definable here
          (GATE-CUE-PLAYER-OBSERVABLE: a cue the player cannot evaluate at the board is not a cue).
  ENG  -- engine-derived situation of the position BEFORE the move. Diagnostic only: a region that
          needs ENG to be named has no player-observable trigger until an OBS proxy covers it.
"""

VOCAB_OBS = {
    # board relations (verbatim construct from p3_system_invariant.py) and simple board facts
    "own_hanging_piece_count": {"kind": "cuts", "cuts": [1, 2]},
    "opp_hanging_piece_count": {"kind": "cuts", "cuts": [1, 2]},
    "own_overloaded_piece_count": {"kind": "cuts", "cuts": [1, 2]},
    "own_attacked_piece_count": {"kind": "cuts", "cuts": [1, 3]},
    "opp_attacked_piece_count": {"kind": "cuts", "cuts": [1, 3]},
    "own_pinned_count": {"kind": "cuts", "cuts": [1]},
    "own_king_ring_enemy_attacks": {"kind": "cuts", "cuts": [1, 3]},
    "opp_king_ring_enemy_attacks": {"kind": "cuts", "cuts": [1, 3]},
    "in_check": {"kind": "bool"},
    "material_balance": {"kind": "cuts", "cuts": [-2, 0, 3]},
    "own_queen": {"kind": "bool"},
    "opp_queen": {"kind": "bool"},
    "own_castling": {"kind": "bool"},
    "n_captures": {"kind": "cuts", "cuts": [1, 3]},
    "n_good_captures": {"kind": "cuts", "cuts": [1]},
    "n_checks": {"kind": "cuts", "cuts": [1]},
    "legal_moves": {"kind": "quantile"},
    "own_passed": {"kind": "cuts", "cuts": [1]},
    "opp_passed": {"kind": "cuts", "cuts": [1]},
    # opponent's last move (already happened; observable)
    "opp_last_capture": {"kind": "bool"},
    "opp_last_check": {"kind": "bool"},
    "opp_last_pawn": {"kind": "bool"},
    "opp_last_captured_value": {"kind": "cuts", "cuts": [1, 3]},
    "new_attacks_on_own": {"kind": "cuts", "cuts": [1]},
    "recapture_available": {"kind": "bool"},
    "opp_last_spent_s": {"kind": "cuts", "cuts": [1, 5, 15]},
    # own last move
    "own_last_capture": {"kind": "bool"},
    "own_last_check": {"kind": "bool"},
    # clock / tempo (observable BEFORE the move; the decision's own think time is NOT here, see VOCAB_TIME)
    "clock_own_ms": {"kind": "cuts", "cuts": [15000, 30000, 60000]},
    "clock_frac": {"kind": "cuts", "cuts": [0.1, 0.25, 0.5]},
    "clock_diff_s": {"kind": "cuts", "cuts": [-30, 0, 30]},
    "own_prev_spent_s": {"kind": "cuts", "cuts": [1, 5, 15]},
    # in-game history that the player can SEE (v1.6): material changed since the previous decision.
    # Engine-scored history (errors so far, plies since an error, previous loss) is in VOCAB_HIST.
    "material_change_2ply": {"kind": "cuts", "cuts": [-1, 1]},
    "own_lost_material": {"kind": "bool"},
    # context
    "phase": {"kind": "cat"},
    "standing": {"kind": "cat"},
    "color": {"kind": "cat"},
    "speed": {"kind": "cat"},
    "ply": {"kind": "cuts", "cuts": [20, 40, 60]},
    "rating_diff": {"kind": "cuts", "cuts": [-100, 100]},
    "game_in_session": {"kind": "cuts", "cuts": [2, 5]},
    "prev_game_result": {"kind": "cat"},
}

VOCAB_ENG = {
    # v1.2: features computed from the evaluation of the position BEFORE the move share that evaluation's
    # noise with the target (cpLoss = eval_before - eval_after); conditioning on them selects the noise.
    # They are diagnostic only and any region using them must survive the deeper re-evaluation control.
    "eval_trend_2ply": {"kind": "cuts", "cuts": [-100, 100]},
    "gap12": {"kind": "quantile"},
    "n_near": {"kind": "cuts", "cuts": [2, 3]},
    "ambiguity_entropy": {"kind": "quantile"},
    "edge": {"kind": "quantile"},
    "best_capture": {"kind": "bool"},
    "best_check": {"kind": "bool"},
    "best_is_recapture": {"kind": "bool"},
    "best_pawn": {"kind": "bool"},
    "best_king": {"kind": "bool"},
    "best_sacrifice": {"kind": "bool"},
    "top_all_captures": {"kind": "bool"},
    "top_all_quiet": {"kind": "bool"},
    "opp_last_blunder": {"kind": "bool"},
    "eval_volatility_4": {"kind": "quantile"},
    "is_mate_line": {"kind": "bool"},
}

# The decision's own think time is known only AT commit (the product records it as `bounded_action.seconds_taken`).
# It is a property of the decision process, not of the pre-move state, so it may not define a mechanism's
# pre-move trigger (design v1.1, after adversarial review of v1). It stays in the BASELINE as a covariate and is
# searched only in this separately declared at-commit vocabulary, diagnostically.
VOCAB_TIME = {"seconds": {"kind": "cuts", "cuts": [1, 3, 8, 20]}}

# Engine-scored history of the player's own earlier decisions in the game (v1.6): diagnostic only.
# A player cannot evaluate "you just erred" at the board (GATE-CUE-PLAYER-OBSERVABLE), and these
# features partition the game by its own error events, which needs the i.i.d. null to be read.
VOCAB_HIST = {
    "own_errors_so_far": {"kind": "cuts", "cuts": [1, 3, 6]},
    "plies_since_own_error": {"kind": "cuts", "cuts": [2, 6]},
    "own_prev_wp_loss": {"kind": "cuts", "cuts": [0.0276, 0.10]},
}

VOCAB = {"OBS": VOCAB_OBS, "ENG": VOCAB_ENG, "TIME": VOCAB_TIME, "HIST": VOCAB_HIST,
         "OBS+ENG": {**VOCAB_OBS, **VOCAB_ENG}, "OBS+TIME": {**VOCAB_OBS, **VOCAB_TIME}, "OBS+HIST": {**VOCAB_OBS, **VOCAB_HIST},
         "ALL": {**VOCAB_OBS, **VOCAB_ENG, **VOCAB_TIME, **VOCAB_HIST}}

# Baseline for the residual target: generic difficulty + time + context, fit on DERIVE only.
BASELINE_COLS = ["phase", "standing", "speed", "color", "log_seconds", "clock_frac", "clock_under_60s",
                 "rating_diff", "legal_moves", "gap12", "n_near", "ambiguity_entropy", "edge",
                 "in_check", "non_pawn_material", "ply", "ply_bin",
                 # v1.4: engine-free EASE indicators. A region defined by the absence of free material is the
                 # complement of easy decisions, not a mechanism; "free material to take" is a generic ease
                 # covariate any player benefits from. Threat indicators (own hanging pieces etc.) are NOT here.
                 "free_capture", "recapture_available", "opp_hanging_any"]
BASELINE_CAT = ["phase", "standing", "speed", "color", "ply_bin"]  # v1.6: time in game as bins, not only linear

DESIGN = {
    "seed": 20260905,
    "derive_frac": 0.60,
    "validate_frac": 0.20,           # TEST = remaining 0.20 (newest games) + the post-freeze games
    "target": "err",                 # canonical: 1 - accurate (winProbabilityLoss > 2.76pp)
    "secondary_target": "blunder10", # y_wp_loss >= 0.10, reported not judged
    "k": 3.5,                        # clustered z on VALIDATE, up to 3 frozen candidates
    "min_n_validate": 100,           # a mechanism must recur
    "min_size": 300,                 # region size on DERIVE (approx >= 1% of eligible decisions)
    "max_size": 12000,               # approx <= 40% of eligible decisions
    "n_freeze": 3,
    "baseline_cols": BASELINE_COLS,
    "baseline_cat": BASELINE_CAT,
}
