#!/usr/bin/env python3
"""Fixtures and the equivalence check that falsifier F-X demands.

Run: python research/system-invariant/tests/test_features.py

F-X says a metric that is NEARLY the same metric is a different metric, and that no result computed
with a drifted extractor stands. `features.py` answers it by calling P3's `system_state` rather than
reimplementing it, so the first test below asserts that the function which actually runs was defined
in P3's file and carries P3's bytecode: if anybody ever replaces the call with a copy, that
assertion fails and says why.

The hand-computed fixtures are here for the other half of the question, which identity cannot
answer: whether the metric means what the freeze says it means. Two of them exist specifically to
pin the weaknesses `RESEARCH_QUESTION_FREEZE.md` section 2.2 records, so that a later reader finds
them as tests rather than as excuses.
"""
from __future__ import annotations

import importlib.util
import random
import sys
from pathlib import Path

import chess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))

import features as F  # noqa: E402

FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    if got != want:
        FAILURES.append(f"{name}: got {got!r}, want {want!r}")
        print(f"  FAIL {name}: got {got!r}, want {want!r}")
    else:
        print(f"  ok   {name}")


def exposure(fen: str, color: chess.Color) -> int:
    return F.system_state(chess.Board(fen), color)[F.EXPOSURE_KEY]


def test_identity() -> None:
    print("identity with P3")
    spec = importlib.util.spec_from_file_location(
        "p3_direct", ROOT / "research" / "learning-v3" / "p3_system_invariant.py")
    p3 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(p3)
    # NOT `is`: loading P3 twice makes two distinct code objects, so an identity comparison could
    # never pass and would be a test that tests nothing. The claim worth asserting is that the
    # function which actually runs was DEFINED IN P3's file and has P3's bytecode, so a copy pasted
    # into features.py would fail here and say so.
    check("system_state is defined in P3's file, not copied into features.py",
          F.system_state.__code__.co_filename, str(F.P3_PATH))
    check("and its bytecode is P3's bytecode",
          F.system_state.__code__.co_code == p3.system_state.__code__.co_code, True)
    check("so is side_piece_metrics, which is where the construct actually lives",
          F.P3.side_piece_metrics.__code__.co_code == p3.side_piece_metrics.__code__.co_code, True)
    check("EXPOSURE_KEY is a key P3 actually produces",
          F.EXPOSURE_KEY in p3.system_state(chess.Board(), chess.WHITE), True)


def test_fixtures() -> None:
    print("hand-computed fixtures")
    # 1. the opening position: nothing is attacked at all
    check("start, white", exposure(chess.STARTING_FEN, chess.WHITE), 0)
    check("start, black", exposure(chess.STARTING_FEN, chess.BLACK), 0)

    # 2. white queen on d4 attacked once down the file by Rd8 and defended by nobody;
    #    the black rook is attacked once by the queen and defended once by its own king.
    fen = "3rk3/8/8/3Q4/8/8/8/4K3 w - - 0 1"
    check("Qd4 attacked by Rd8, undefended -> white exposed 1", exposure(fen, chess.WHITE), 1)
    check("Rd8 attacked once, defended once -> black exposed 0", exposure(fen, chess.BLACK), 0)

    # 3. FREEZE SECTION 2.2 WEAKNESS 1, pinned as a test. The white queen is attacked by a pawn and
    #    defended by a pawn: one attacker, one defender, so `attackers > defenders` is FALSE and the
    #    construct reports no exposure -- even though exd4 cxd4 wins a queen for a pawn. This is the
    #    construct behaving as specified, not a bug, and the test exists so nobody later discovers
    #    it and calls it one.
    fen = "4k3/8/8/4p3/3Q4/2P5/8/4K3 w - - 0 1"
    check("queen attacked 1 defended 1 -> NOT exposed, though the exchange loses a queen",
          exposure(fen, chess.WHITE), 0)

    # 4. a rook on a1 does not attack d4, so the queen there is not exposed by it. This is the
    #    control for fixture 5: the same rook, the same queen, a different square.
    check("Ra1 does not reach d4 -> not exposed",
          exposure("4k3/8/8/8/3Q4/8/8/r3K3 w - - 0 1", chess.WHITE), 0)
    # Ra1 attacks along the first rank to d1 (b1 and c1 empty), so Qd1 has one attacker, and Ke1
    # defends it: one and one, so not exposed.
    check("Qd1 attacked by Ra1, defended by Ke1 -> not exposed",
          exposure("4k3/8/8/8/8/8/8/r2QK3 w - - 0 1", chess.WHITE), 0)
    # FREEZE SECTION 2.2 WEAKNESS 2, pinned as a test: the count is unweighted. A hanging queen
    # scores exactly what a hanging pawn scores, which is 1.
    check("a hanging queen counts 1, the same as a pawn would",
          exposure("4k3/8/8/8/8/8/8/r2Q1K2 w - - 0 1", chess.WHITE), 1)

    # 5. the king itself is never counted, however attacked it is
    check("a checked king contributes nothing",
          exposure("4k3/8/8/8/8/8/8/r3K3 w - - 0 1", chess.WHITE), 0)

    # 6. pawns ARE counted
    check("a hanging pawn counts 1",
          exposure("4k3/8/8/8/8/r7/P7/4K3 w - - 0 1", chess.WHITE), 1)


def test_delta_and_move_features() -> None:
    print("move features")
    # Moving the queen off d4 out of the rook's line removes the exposure it had.
    board = chess.Board("3rk3/8/8/3Q4/8/8/8/4K3 w - - 0 1")
    pre = F.system_state(board, board.turn)
    away = F.move_features(board, chess.Move.from_uci("d5a5"), pre)
    check("exposure_pre on d5", away["exposure_pre"], 1)
    check("Qa5 leaves the file -> exposure_post 0", away["exposure_post"], 0)
    check("delta is post minus pre", away["exposure_delta"], -1)
    check("capture flag off", away["capture_flag"], 0)
    stay = F.move_features(board, chess.Move.from_uci("d5d6"), pre)
    check("Qd6 stays on the file -> still exposed", stay["exposure_post"], 1)
    check("delta zero", stay["exposure_delta"], 0)
    take = F.move_features(board, chess.Move.from_uci("d5d8"), pre)
    check("Qxd8 is a capture", take["capture_flag"], 1)
    check("captured a rook, value 5", take["captured_piece_value"], 5)


def test_equivalence_on_random_positions() -> None:
    """`move_features` must agree with a direct P3 computation on every position, not on average."""
    print("equivalence against a direct P3 computation, 400 random positions")
    rng = random.Random(20260902)
    mismatches = 0
    checked = 0
    for _ in range(400):
        board = chess.Board()
        for _ in range(rng.randint(4, 60)):
            moves = list(board.legal_moves)
            if not moves:
                break
            board.push(rng.choice(moves))
        if board.is_game_over():
            continue
        actor = board.turn
        pre = F.system_state(board, actor)
        move = rng.choice(list(board.legal_moves))
        got = F.move_features(board, move, pre)
        after = board.copy(stack=False)
        after.push(move)
        want_post = F.system_state(after, actor)[F.EXPOSURE_KEY]
        checked += 1
        if got["exposure_post"] != want_post or got["exposure_delta"] != want_post - pre[F.EXPOSURE_KEY]:
            mismatches += 1
    check(f"{checked} positions, mismatches", mismatches, 0)


def main() -> int:
    for fn in (test_identity, test_fixtures, test_delta_and_move_features,
               test_equivalence_on_random_positions):
        fn()
    if FAILURES:
        print(f"\nFAILED: {len(FAILURES)}")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print("\nall feature tests pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
