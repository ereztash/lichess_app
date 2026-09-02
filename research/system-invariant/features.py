#!/usr/bin/env python3
"""Board-derived features for the OwnExposure natural-generalization test.

Construct authority: docs/system-invariant/RESEARCH_QUESTION_FREEZE.md section 2.

WHY THIS IMPORTS P3 INSTEAD OF PORTING IT. The freeze's falsifier F-X says a port must return values
identical to `research/learning-v3/p3_system_invariant.py` on every position, and that a metric
which is *nearly* the same metric is a different metric. The strongest way to pass that falsifier is
to make it unfalsifiable by construction: there is one implementation of `system_state`, it lives in
the P3 script, and this module calls it. A port with an equivalence test can still drift the day
somebody edits one side; a call cannot.

`p3_system_invariant.py` guards its own `main()` behind `__name__ == "__main__"`, so importing it
runs no experiment. It is loaded by absolute path because `research/learning-v3` contains a hyphen
and is therefore not an importable package name -- the same mechanism `p4_n1_prepare.py` uses.

Nothing in this module calls an engine. Everything here is computable at the board.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import chess

ROOT = Path(__file__).resolve().parents[2]
P3_PATH = ROOT / "research" / "learning-v3" / "p3_system_invariant.py"


def _load_p3():
    spec = importlib.util.spec_from_file_location("p3_system_invariant", P3_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("p3_system_invariant", module)
    spec.loader.exec_module(module)
    return module


P3 = _load_p3()
system_state = P3.system_state
VALUES = P3.VALUES

#: The construct under test, as a key of P3's own system-state dictionary.
EXPOSURE_KEY = "own_overloaded_piece_count"

#: Falsifier F-A10 nominates these three, by name, before any of them was evaluated on this data.
NEGATIVE_CONTROL_KEYS = (
    "own_redundantly_defended_count",
    "own_max_defense_dependency",
    "own_king_ring_own_defenses",
)


def material_balance(board: chess.Board, color: chess.Color) -> int:
    """Mover-relative material, in the same piece values P3 uses."""
    total = 0
    for _, piece in board.piece_map().items():
        v = VALUES[piece.piece_type]
        total += v if piece.color == color else -v
    return total


def piece_count(board: chess.Board) -> int:
    return len(board.piece_map())


def mobility(board: chess.Board, color: chess.Color) -> int:
    """Legal-move count for `color`, whoever is actually to move.

    Falsifier F-A8 needs mobility for BOTH sides after the candidate move, and after a move it is
    the opponent's turn, so the mover's own mobility is not directly available from `legal_moves`.
    The turn is swapped on a copy to read it. `null` where the swapped position is illegal (the
    side to move is already in check), which is a real case and is reported rather than imputed to
    zero.
    """
    if board.turn == color:
        return board.legal_moves.count()
    probe = board.copy(stack=False)
    probe.turn = color
    if probe.is_valid():
        return probe.legal_moves.count()
    return None


def local_move_descriptors(board: chess.Board, move: chess.Move) -> dict:
    """The `L` comparator of the freeze section 6: geometry and tactical surface, no relations."""
    moving = board.piece_at(move.from_square)
    if moving is None:
        raise ValueError(f"no piece on {chess.square_name(move.from_square)} for {move.uci()}")
    ff, fr = chess.square_file(move.from_square), chess.square_rank(move.from_square)
    tf, tr = chess.square_file(move.to_square), chess.square_rank(move.to_square)
    captured = 0
    if board.is_capture(move):
        captured = 1 if board.is_en_passant(move) else VALUES[board.piece_at(move.to_square).piece_type]
    return {
        "moving_piece_type": moving.piece_type,
        "capture_flag": int(board.is_capture(move)),
        "captured_piece_value": captured,
        "promotion_piece_type": move.promotion or 0,
        "from_file": ff,
        "from_rank": fr,
        "to_file": tf,
        "to_rank": tr,
        "chebyshev_distance": max(abs(tf - ff), abs(tr - fr)),
        "manhattan_distance": abs(tf - ff) + abs(tr - fr),
        "gives_check": int(board.gives_check(move)),
    }


def move_features(board: chess.Board, move: chess.Move, pre_state: dict | None = None) -> dict:
    """Everything the freeze needs about one (position, candidate move) pair.

    `pre_state` is the mover's pre-move `system_state`, passed in so a position with K candidates
    computes it once rather than K times. It is the caller's job to pass the state for the same
    actor; `exposure_pre` is echoed back so a mismatch shows up in the output.
    """
    actor = board.turn
    pre = pre_state if pre_state is not None else system_state(board, actor)
    after = board.copy(stack=False)
    after.push(move)
    post = system_state(after, actor)

    out = local_move_descriptors(board, move)
    out.update({
        "exposure_pre": pre[EXPOSURE_KEY],
        "exposure_post": post[EXPOSURE_KEY],
        "exposure_delta": post[EXPOSURE_KEY] - pre[EXPOSURE_KEY],
        "material_post": material_balance(after, actor),
        "piece_count_post": piece_count(after),
        "mobility_own_post": mobility(after, actor),
        "mobility_opp_post": mobility(after, not actor),
    })
    for key in NEGATIVE_CONTROL_KEYS:
        out[f"nc_{key}_post"] = post[key]
        out[f"nc_{key}_delta"] = post[key] - pre[key]
    return out
