"""
TWO REASONABLE DEFINITIONS OF "UNPROTECTED", AND HOW OFTEN THEY DISAGREE.

`predicates.py` calls a target unprotected when no enemy piece directly attacks its square.
Lichess's own puzzle tagger (`ornicar/lichess-puzzler`, `tagger/util.py::is_defended`) also counts
RAY DEFENCE: if removing one of OUR attackers would reveal a defender behind it, the piece is
defended and therefore not hanging.

Both are defensible readings of the same English word. That is the point. If the choice between
them moves the trigger state of a large share of positions, then "unprotected-piece capture
discrimination" is not one construct with two implementations -- it is a family of constructs, and
which member a study measured is a fact that has to be recorded, not assumed.

This script quantifies the divergence on the same corpus, using the same records, changing
nothing but the definition of `is_defended`.

    python definition_variance.py --games games_enriched.jsonl --out definition_variance.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sdt import wilson_interval  # noqa: E402

RAY_PIECE_TYPES = {chess.QUEEN, chess.ROOK, chess.BISHOP}


def is_defended_lichess(board: chess.Board, piece: chess.Piece, square: int) -> bool:
    """
    A faithful reproduction of `lichess-puzzler/tagger/util.py::is_defended`, comment included.

    Reproduced rather than imported because the file is GPL-3 Python inside a tagger that expects
    a puzzle object, and the only part needed here is these fourteen lines. The behaviour is
    differenced against nothing -- there is no second implementation to difference it against --
    so it is labelled a REPRODUCTION and its provenance is the URL in the docstring above.
    """
    if board.attackers(piece.color, square):
        return True
    # ray defense: remove one of the attackers and look again
    for attacker in board.attackers(not piece.color, square):
        attacker_piece = board.piece_at(attacker)
        assert attacker_piece is not None
        if attacker_piece.piece_type in RAY_PIECE_TYPES:
            bc = board.copy(stack=False)
            bc.remove_piece_at(attacker)
            if bc.attackers(piece.color, square):
                return True
    return False


def rate(k: int, n: int) -> dict:
    lo, hi = wilson_interval(k, n)
    return {"k": k, "n": n, "p": (k / n) if n else None, "ci95": [lo, hi]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fen-field", default="original_fen")
    a = ap.parse_args()

    rows = [json.loads(line) for line in open(a.games, encoding="utf-8")]
    pos = [r for r in rows if r["trigger_state"] == "positive"]

    flipped = 0
    for r in pos:
        board = chess.Board(r[a.fen_field])
        sq = chess.parse_square(r["target_square"])
        piece = board.piece_at(sq)
        if piece is None:
            continue
        if is_defended_lichess(board, piece, sq):
            flipped += 1

    # And the reverse direction: T- items whose designated target is defended only by a piece
    # that is itself pinned. Both definitions call those defended; a player may not.
    neg = [r for r in rows if r["trigger_state"] == "negative"]
    pinned_only = 0
    for r in neg[:20000]:
        board = chess.Board(r[a.fen_field])
        sq = chess.parse_square(r["target_square"])
        piece = board.piece_at(sq)
        if piece is None:
            continue
        defenders = list(board.attackers(piece.color, sq))
        if defenders and all(board.is_pinned(piece.color, d) for d in defenders):
            pinned_only += 1

    result = {
        "question": (
            "How much of the trigger state is decided by which definition of 'unprotected' the "
            "study happened to adopt?"
        ),
        "n_t_plus_under_direct_attack_definition": len(pos),
        "t_plus_that_lichess_would_call_DEFENDED_via_ray_defence": rate(flipped, len(pos)),
        "t_minus_defended_only_by_pinned_pieces": rate(pinned_only, min(len(neg), 20000)),
        "why_this_matters": (
            "A trigger state that moves when the definition moves is not a fact about the board "
            "in the sense the construct needs. Whichever definition is adopted has to be frozen, "
            "versioned and reported -- and a result obtained under one is not evidence about the "
            "other."
        ),
        "definitions": {
            "direct": "no enemy piece directly attacks the target's square (predicates.py v1.0.0)",
            "lichess": (
                "direct, plus: no defender is revealed by removing any one of our sliding "
                "attackers (lichess-puzzler tagger/util.py is_defended)"
            ),
        },
    }
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
