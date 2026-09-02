"""The rule the whole design rests on: no feature may know what the player played.

Two tests, because the two ways this fails are different. The structural one catches a model that
lists an outcome column. The empirical one catches a feature that reads the played move through
some path nobody wrote down -- which is the one a reviewer cannot find by reading.
"""
import os
import sys

import chess

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import position_features as pf  # noqa: E402
from engine import Engine  # noqa: E402
from position_features import board_features, clock_features, engine_features  # noqa: E402
from value_of_computation import voc_features  # noqa: E402

BINARY = os.environ.get("B3_ENGINE", "/opt/b3/stockfish-17.1-avx2")
NODES = 60000


def test_outcome_columns_are_not_in_the_pre_move_set():
    assert set(pf.PRE_MOVE).isdisjoint(pf.POST_MOVE)
    for forbidden in ("quality_loss", "accurate", "move_uci", "wp_after", "result"):
        assert forbidden not in pf.PRE_MOVE


def test_model_feature_lists_are_a_subset_of_the_pre_move_set():
    from models import ALL_MODEL_FEATURES

    unknown = set(ALL_MODEL_FEATURES) - set(pf.PRE_MOVE) - {"log_time", "rating"}
    assert not unknown, f"a model consumes columns that are not pre-move: {sorted(unknown)}"


def _vector(board, decision, search):
    expected_k = min(pf.MULTIPV, decision["legal_moves"])
    complete = search.complete(expected_k)
    return {
        **board_features(board, decision["ply"], decision),
        **engine_features(complete[-1], complete),
        **voc_features(complete),
        **clock_features(decision, 180),
    }


def test_pre_move_vector_is_bit_identical_under_a_different_played_move():
    """Swap the move the player made. Every pre-move feature must come back unchanged.

    This is the test that would catch a feature reading the resulting position through a path the
    schema does not describe. It is run against the real engine, because a stub could agree with a
    leak.
    """
    engine = Engine(BINARY, multipv=pf.MULTIPV)
    try:
        fens = [
            "r2q1rk1/pp1nbppp/2p1pn2/3p4/2PP1B2/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 9",
            "2rq1rk1/pb1nbppp/1p2pn2/2pp4/2PP4/1PN1PN2/PB2BPPP/R2Q1RK1 w - - 0 11",
            "6k1/5ppp/4p3/3pP3/1p1P4/1P3N2/5PPP/6K1 w - - 0 30",
        ]
        for fen in fens:
            board = chess.Board(fen)
            moves = list(board.legal_moves)
            assert len(moves) >= 2
            search = engine.search(fen, NODES)
            base = {
                "ply": 30,
                "legal_moves": board.legal_moves.count(),
                "in_check": board.is_check(),
                "clock_ms_self": 90000,
                "clock_ms_opp": 85000,
            }
            first = _vector(board, {**base, "move_uci": moves[0].uci()}, search)
            second = _vector(board, {**base, "move_uci": moves[-1].uci()}, search)
            assert first == second, f"a pre-move feature moved when the played move changed: {fen}"
    finally:
        engine.quit()
