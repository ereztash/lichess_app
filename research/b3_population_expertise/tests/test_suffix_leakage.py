"""R7 from Gate 1: the leakage test must cover the list the preregistration enforces.

Swapping the PLAYED MOVE (tests/test_leakage.py) catches a feature that reads the move or the board
it produced. It cannot catch a feature that reads a LATER clock, a later move, `Termination` or
`Result`, because the swap does not change any of those -- a `clock_ms_self` mistakenly taken from
`clk[i]` instead of `clk[i-2]` passes that test bit-identical. The preregistration's forbidden list
names "the game result, any later move, any later clock" explicitly, and B2's own ledger shows that
clock-derivation defects are the ones that actually happen: its starting clock was INFERRED from the
largest eligible reading, which was wrong in 63 of 75 games by up to 86 seconds.

So this test replaces the whole game SUFFIX after a decision -- the remaining moves, the remaining
clock readings, the termination and the result -- and requires every pre-move quantity to come back
bit-identical.

`seconds_taken` (and therefore `log_time`) is the ONE non-outcome column allowed to change. It reads
`clk[i]`, the reading written after the move -- which is precisely why it is an outcome in this
study and never a predictor.
"""
import os
import sys

import chess
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from ingest import eligible_decisions  # noqa: E402
from position_features import board_features, clock_features  # noqa: E402

BASE_SECONDS, INCREMENT = 180, 0
MOVES = ("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 "
         "Nbd2 Bb7 Bc2 Re8 Nf1 Bf8 Ng3 g6 a4 c5 d5 c4 Bg5 h6 Be3 Nc5 Qd2 h5").split()


def _record(moves, clocks, side="w", termination="Normal", result="1-0"):
    return {
        "game_id": "TESTGAME", "side": side, "rating": 1500, "band": "1400-1599",
        "opponent_rating": 1490, "moves": list(moves), "clocks": list(clocks),
        "result": result, "termination": termination, "utc": "2026.02.01 00:00:00",
        "player": "testplayer",
    }


def _clocks(n):
    """A plausible pair of descending clock traces, distinct per side and never level."""
    out = []
    white, black = float(BASE_SECONDS), float(BASE_SECONDS)
    for i in range(n):
        if i % 2 == 0:
            white -= 1 + (i % 5)
            out.append(white)
        else:
            black -= 2 + (i % 3)
            out.append(black)
    return out


def _feature_view(decision, ply):
    board = chess.Board()
    for san in MOVES[:ply]:
        board.push_san(san)
    return {**board_features(board, ply, decision), **clock_features(decision, BASE_SECONDS)}


@pytest.mark.parametrize("side", ["w", "b"])
def test_no_pre_move_quantity_reads_the_game_suffix(side):
    clocks = _clocks(len(MOVES))
    original = _record(MOVES, clocks, side=side)
    decisions, _ = eligible_decisions(original, BASE_SECONDS, INCREMENT, 60)
    assert len(decisions) >= 6, "the fixture must produce enough decisions to test"

    # A decision comfortably inside the game, so there is a real suffix on both ends.
    target = decisions[len(decisions) // 2]
    ply = target["ply"]

    # Everything strictly after the decision is replaced: a different legal continuation, different
    # clock readings from `clk[ply]` onward, a different termination and a different result.
    board = chess.Board()
    for san in MOVES[:ply + 1]:
        board.push_san(san)
    suffix = []
    for _ in range(len(MOVES) - ply - 1):
        legal = list(board.legal_moves)
        if not legal:
            break
        move = legal[-1]
        suffix.append(board.san(move))
        board.push(move)
    perturbed_clocks = list(clocks[:ply]) + [max(1.0, c - 17.0) for c in clocks[ply:]]
    perturbed = _record(MOVES[:ply + 1] + suffix, perturbed_clocks[: ply + 1 + len(suffix)],
                        side=side, termination="Time forfeit", result="0-1")

    after, _ = eligible_decisions(perturbed, BASE_SECONDS, INCREMENT, 60)
    same_ply = [d for d in after if d["ply"] == ply]
    assert same_ply, "the perturbation removed the decision under test"
    changed = same_ply[0]

    assert suffix != MOVES[ply + 1:], "the fixture did not actually change the continuation"

    before_view = _feature_view(target, ply)
    after_view = _feature_view(changed, ply)
    assert before_view == after_view, (
        "a pre-move feature moved when only the game's future changed: "
        f"{[k for k in before_view if before_view[k] != after_view[k]]}"
    )
    for field in ("clock_ms_self", "clock_ms_opp", "opp_prev_think_s", "own_prev_think_s",
                  "legal_moves", "in_check", "move_uci"):
        assert target[field] == changed[field], f"{field} read the game suffix"
    # And the one column that is allowed to move, because it is an outcome, did move.
    assert target["seconds_taken"] != changed["seconds_taken"], (
        "the fixture failed to perturb clk[i]; the test proves nothing"
    )
