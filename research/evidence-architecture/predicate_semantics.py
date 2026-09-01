"""
DOES THE PREDICATE MEASURE THE THING ITS NAME AND ITS DOCSTRING SAY IT MEASURES?

Three questions, all answerable with `python-chess` alone -- no engine, no oracle, no sampling
beyond the scan the published screen already runs. They are here together because they are the
same question asked of three different rule classes, and because two of the three were raised
as comments in `rule_classes.py` that nobody had turned into a number.

  Q1  RC-06  Is `separation` a difference between two measurements of the SAME behaviour?
             `_threat_satisfies` branches on the trigger: on T+ it asks "does the opponent still
             have mate in one", on T- "does the opponent still have any check at all". The
             docstring says the symmetric version was abandoned because P(B | T-) "would have come
             out near 1". NEAR 1 IS NOT A NUMBER. This measures it, and derives what the published
             separation of +0.768 becomes when one predicate is held fixed across both cells.

  Q2  RC-21  `_lone_king_defends` grades the scope of the rule of the square as "the opponent has
             no knight, bishop, rook or queen". The rule of the square is a statement about what
             the LONE KING can catch. An enemy PAWN is not a king: it can capture the passer,
             it can be captured, it can promote and produce a queen that stops the pawn. So the
             piece-list predicate is not the functional condition, and this measures the distance
             between them.

  Q3  RC-13  `_knight_check_a_queen_could_not_give` asks whether ANY knight promotion gives check
             and NO queen promotion does. The claim in the docstring is about what the knight does
             that "a queen cannot" -- which is a claim about ONE promotion, from one square to one
             square. Comparing an arbitrary knight promotion against an arbitrary queen promotion
             somewhere else on the board does not test it. This does the matched comparison.

Every predicate below is a pure function of the position. Nothing reads the played move, the
result, or an engine.

    python predicate_semantics.py --items rc.jsonl --out predicate_semantics.json
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
from rule_classes import (  # noqa: E402
    _knight_promotions,
    _lone_king_defends,
    _opponent_has_mate_in_one,
    _outside_the_square,
    _passed_pawns,
    _threat_satisfies,
    Context,
)


def rate(k: int, n: int) -> dict:
    return {"k": k, "n": n, "p": (k / n) if n else None}


# --------------------------------------------------------------------------- Q1  RC-06

def _b_symmetric(board: chess.Board, move: chess.Move) -> bool:
    """
    The predicate `_threat_satisfies` uses on its POSITIVE cell, applied to both cells.

    This is the rule as it is written in English -- "if the opponent threatens mate next move,
    play a move that stops it" -- with the response scored the same way wherever it is asked.
    """
    board.push(move)
    try:
        return not _opponent_has_mate_in_one(board)
    finally:
        board.pop()


def _prescription_sizes(board: chess.Board, ctx: Context) -> dict:
    legal = list(board.legal_moves)
    if not legal:
        return {}
    branching = sum(1 for m in legal if _threat_satisfies(board, m, ctx))
    symmetric = sum(1 for m in legal if _b_symmetric(board, m))
    return {
        "n_legal": len(legal),
        "branching_k": branching,
        "branching_share": branching / len(legal),
        "symmetric_k": symmetric,
        "symmetric_share": symmetric / len(legal),
        "symmetric_covers_every_legal_move": symmetric == len(legal),
        "branching_covers_every_legal_move": branching == len(legal),
        "symmetric_empty": symmetric == 0,
    }


# --------------------------------------------------------------------------- Q2  RC-21

def _path_squares(pawn: int, colour: chess.Color) -> list[int]:
    """Every square the pawn must pass through, promotion square included."""
    file_ = chess.square_file(pawn)
    rank = chess.square_rank(pawn)
    ranks = range(rank + 1, 8) if colour == chess.WHITE else range(rank - 1, -1, -1)
    return [chess.square(file_, r) for r in ranks]


def _pawn_steps(pawn: int, colour: chess.Color) -> int:
    rank = chess.square_rank(pawn)
    steps = (7 - rank) if colour == chess.WHITE else rank
    if colour == chess.WHITE and rank == 1:
        steps -= 1
    elif colour == chess.BLACK and rank == 6:
        steps -= 1
    return steps


def _pawn_attacks_from(square: int, colour: chess.Color) -> list[int]:
    """The two squares a pawn of `colour` standing on `square` attacks."""
    file_, rank = chess.square_file(square), chess.square_rank(square)
    forward = 1 if colour == chess.WHITE else -1
    out = []
    for df in (-1, 1):
        f, r = file_ + df, rank + forward
        if 0 <= f <= 7 and 0 <= r <= 7:
            out.append(chess.square(f, r))
    return out


def _enemy_pawn_can_reach(board: chess.Board, pawn_sq: int, colour: chess.Color,
                          targets: set[int], within: int) -> bool:
    """
    Can an enemy pawn stand on a square attacking `targets` within `within` of its own moves?

    OBSTRUCTION IS IGNORED ON PURPOSE. This is used to REFUSE to certify a position as
    king-only, so over-counting the enemy pawn's reach is the safe direction: it can only make
    the functional predicate stricter, never laxer.
    """
    them = not colour
    for sq, piece in board.piece_map().items():
        if piece.color != them or piece.piece_type != chess.PAWN:
            continue
        if set(_pawn_attacks_from(sq, them)) & targets:
            return True
        file_, rank = chess.square_file(sq), chess.square_rank(sq)
        step = 1 if them == chess.WHITE else -1
        for d in range(1, within + 1):
            r = rank + step * d
            if not 0 <= r <= 7:
                break
            # a pawn can also shift file by capturing; allow |df| <= d, which over-counts
            for df in range(-d, d + 1):
                f = file_ + df
                if not 0 <= f <= 7:
                    continue
                if set(_pawn_attacks_from(chess.square(f, r), them)) & targets:
                    return True
    return False


def _enemy_pawn_promotes_within(board: chess.Board, colour: chess.Color, within: int) -> bool:
    """An enemy pawn that queens inside the race window produces a piece that stops the pawn."""
    them = not colour
    for sq, piece in board.piece_map().items():
        if piece.color != them or piece.piece_type != chess.PAWN:
            continue
        if _pawn_steps(sq, them) <= within:
            return True
    return False


def _only_the_king_can_stop_it(board: chess.Board, ctx: Context) -> bool:
    """
    THE FUNCTIONAL CONDITION THE RULE OF THE SQUARE ACTUALLY NEEDS.

    `_lone_king_defends` asks a question about the opponent's PIECE LIST. The rule of the square
    asks a question about the RACE: can anything other than the enemy king change whether this
    pawn reaches the promotion square? A pawn is not a king and is not nothing.

    This is a SUFFICIENT condition, not a characterisation. Every clause refuses to certify a
    position it cannot settle, so the set it returns is a subset of the positions in which the
    rule of the square is the whole story. That is the direction an audit predicate must err in:
    a position it wrongly excludes costs the class nothing, a position it wrongly admits is the
    RC-21 defect again.
    """
    us = board.turn
    passers = _passed_pawns(board, us)
    if len(passers) != 1:
        return False
    pawn = passers[0]

    # 1. no opposing piece other than the king. Necessary, and the only clause RC-21 has.
    if not _lone_king_defends(board, ctx):
        return False

    path = _path_squares(pawn, us)
    steps = _pawn_steps(pawn, us)

    # 2. the pawn must have a forward push available NOW -- a pinned pawn is not racing.
    forward = [m for m in board.legal_moves
               if m.from_square == pawn and chess.square_file(m.to_square) == chess.square_file(pawn)]
    if not forward:
        return False

    # 3. nothing at all stands on the path. OUR OWN pieces block a pawn exactly as well as theirs.
    if any(board.piece_at(sq) is not None for sq in path):
        return False

    # 4. no enemy pawn attacks the pawn or any square it must cross, now or inside the race.
    targets = set(path) | {pawn}
    if _enemy_pawn_can_reach(board, pawn, us, targets, steps):
        return False

    # 5. no enemy pawn queens inside the window. A new queen is not a lone king.
    if _enemy_pawn_promotes_within(board, us, steps):
        return False

    return True


# --------------------------------------------------------------------------- Q3  RC-13

def _knight_beats_queen_same_squares(board: chess.Board) -> bool:
    """
    RC-13's DOCSTRING CLAIM, TESTED AS A CLAIM ABOUT ONE MOVE.

    "unless the knight does something a queen cannot, which on the move it appears means giving
    check." That is a statement about promoting on a particular square: from `f`, to `t`, is
    `f-t=N` a check where `f-t=Q` is not? Comparing the existence of a checking knight promotion
    anywhere against the existence of a checking queen promotion anywhere compares two different
    moves and can be true when no single promotion square has the property.
    """
    for m in _knight_promotions(board):
        queen = chess.Move(m.from_square, m.to_square, promotion=chess.QUEEN)
        if queen not in board.legal_moves:
            continue
        if board.gives_check(m) and not board.gives_check(queen):
            return True
    return False


def _knight_beats_queen_unmatched(board: chess.Board) -> bool:
    """`_knight_check_a_queen_could_not_give`, restated locally so the two sit side by side."""
    knight_checks = any(
        m.promotion == chess.KNIGHT and board.gives_check(m) for m in board.legal_moves
    )
    queen_checks = any(
        m.promotion == chess.QUEEN and board.gives_check(m) for m in board.legal_moves
    )
    return knight_checks and not queen_checks


# --------------------------------------------------------------------------- driver

def _ctx(rec: dict) -> Context:
    prev = rec.get("prev_move")
    return Context(
        prev_move=chess.Move.from_uci(prev) if prev else None,
        prev_was_capture=bool(rec.get("prev_was_capture", 0)),
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--rc06-cap", type=int, default=0,
                    help="0 = every RC-06 item; the symmetric scan is O(legal moves x mate check)")
    ap.add_argument("--seed", type=int, default=20260831,
                    help="the published screen's seed, reused so the draw is the same kind of draw")
    a = ap.parse_args()

    # PASS 1 -- collect, never truncate. A cap applied while reading would take the FIRST n items,
    # which is the first n GAMES in corpus order, and the corpus is ordered by time. Sampling has
    # to happen against the whole cell or the cap chooses the sample.
    pool: dict[tuple[str, str], list[dict]] = {}
    seen = 0
    with open(a.items) as fh:
        for line in fh:
            rec = json.loads(line)
            rc, state = rec["rule_class"], rec["trigger_state"]
            if rc not in ("RC-06", "RC-21", "RC-13"):
                continue
            if rec["in_check"]:
                continue                       # the screen's own per-candidate exclusion
            seen += 1
            pool.setdefault((rc, state), []).append(rec)

    rng = random.Random(a.seed)
    drawn = {}
    rc06 = {"positive": [], "negative": []}
    rc21 = {"positive": [], "negative": []}
    rc13 = {"positive": [], "negative": []}

    for (rc, state), recs in sorted(pool.items()):
        rows = recs
        if rc == "RC-06" and a.rc06_cap and len(recs) > a.rc06_cap:
            rows = rng.sample(recs, a.rc06_cap)
        drawn[f"{rc}/{state}"] = {"cell_size": len(recs), "drawn": len(rows)}
        for rec in rows:
            board = chess.Board(rec["fen"])
            ctx = _ctx(rec)
            if rc == "RC-06":
                sizes = _prescription_sizes(board, ctx)
                if sizes:
                    rc06[state].append(sizes)
            elif rc == "RC-21":
                rc21[state].append({
                    "lone_king_defends": _lone_king_defends(board, ctx),
                    "only_the_king_can_stop_it": _only_the_king_can_stop_it(board, ctx),
                })
            elif rc == "RC-13":
                rc13[state].append({
                    "unmatched": _knight_beats_queen_unmatched(board),
                    "matched": _knight_beats_queen_same_squares(board),
                })

    def rc06_cell(rows):
        n = len(rows)
        if not n:
            return {}
        return {
            "n": n,
            "prescription_size_branching_mean": sum(r["branching_share"] for r in rows) / n,
            "prescription_size_symmetric_mean": sum(r["symmetric_share"] for r in rows) / n,
            "every_legal_move_satisfies_symmetric_B": rate(
                sum(1 for r in rows if r["symmetric_covers_every_legal_move"]), n),
            "every_legal_move_satisfies_branching_B": rate(
                sum(1 for r in rows if r["branching_covers_every_legal_move"]), n),
            "no_legal_move_satisfies_symmetric_B": rate(
                sum(1 for r in rows if r["symmetric_empty"]), n),
        }

    def rc21_cell(rows):
        n = len(rows)
        if not n:
            return {}
        lone = sum(1 for r in rows if r["lone_king_defends"])
        func = sum(1 for r in rows if r["only_the_king_can_stop_it"])
        both = sum(1 for r in rows if r["lone_king_defends"] and r["only_the_king_can_stop_it"])
        return {
            "n": n,
            "lone_king_defends": rate(lone, n),
            "only_the_king_can_stop_it": rate(func, n),
            "functional_given_piece_list": rate(both, lone) if lone else None,
            "piece_list_true_functional_false": rate(lone - both, n),
        }

    def rc13_cell(rows):
        n = len(rows)
        if not n:
            return {}
        un = sum(1 for r in rows if r["unmatched"])
        ma = sum(1 for r in rows if r["matched"])
        both = sum(1 for r in rows if r["unmatched"] and r["matched"])
        return {
            "n": n,
            "unmatched_shipped_predicate": rate(un, n),
            "matched_same_from_and_to": rate(ma, n),
            "matched_given_unmatched": rate(both, un) if un else None,
            "unmatched_true_matched_false": rate(un - both, n),
            "matched_true_unmatched_false": rate(ma - both, n),
        }

    out = {
        "predicate_semantics_version": "1.0.0",
        "what_this_is": (
            "Three claims made in `rule_classes.py` comments and in `docs/measurement/"
            "ACTION_SET_REANALYSIS.md`, measured instead of asserted. No engine is used and no "
            "move played by any human is read."
        ),
        "items_file": a.items,
        "records_read": seen,
        "seed": a.seed,
        "cells": drawn,
        "RC-06_response_definition": {
            "question": (
                "`separation` is `b_valid|T+` minus `b_valid|T-`. On RC-06 those two numbers are "
                "produced by two different predicates. What is the separation when one predicate "
                "is held fixed across both cells?"
            ),
            "branching_B": "T+: opponent has no mate in one. T-: opponent has no check at all.",
            "symmetric_B": "both cells: opponent has no mate in one -- the rule as written.",
            "t_plus": rc06_cell(rc06["positive"]),
            "t_minus": rc06_cell(rc06["negative"]),
        },
        "RC-21_scope": {
            "question": (
                "Is `no opposing knight/bishop/rook/queen` the condition under which the rule of "
                "the square is the whole story?"
            ),
            "t_plus": rc21_cell(rc21["positive"]),
            "t_minus": rc21_cell(rc21["negative"]),
        },
        "RC-13_matched_promotion": {
            "question": (
                "Does a knight promotion do something the queen promotion FROM THE SAME SQUARE TO "
                "THE SAME SQUARE cannot?"
            ),
            "t_plus": rc13_cell(rc13["positive"]),
            "t_minus": rc13_cell(rc13["negative"]),
        },
    }

    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
