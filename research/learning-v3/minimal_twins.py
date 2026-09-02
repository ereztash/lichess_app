"""
GATE B, THE STRONG FORM: minimal functional twins for a rule class whose predicate does not branch.

WHY NOT RC-06. `PRE_HUMAN_GATES.md`'s Gate B has a precondition before its own two frames: the twin
must hold the RESPONSE PREDICATE fixed, not only the position. On RC-06 that precondition fails and
no matching repairs it -- `_threat_satisfies` asks *"is the opponent left without mate in one"* on
T+ and *"is the opponent left without any check at all"* on T-, so a hit and a false alarm are
different behaviours. `rc06_fixed_predicate.py` measured what holding it fixed costs: separation
+0.760 branching, **-0.048 symmetric**, with every legal move satisfying the stated rule on 92% of
the negative cell.

RC-05 `safe-promotion` has no such problem, and it is not a lucky accident:

    trigger      queen promotions exist, all to ONE square q; T+ iff nothing attacks q
    response     `move.promotion == QUEEN`  -- A PROPERTY OF THE MOVE ALONE

The predicate never consults the trigger, so it is IDENTICAL on both cells by construction. It is
also the class the current authorities favour: `C11` grades it MEASURABLE (the noise cell prescribes
something and that something can be wrong), `ANCHOR_REBUILD` puts its corrected separation at .454,
59.3% of the rebuilt ceiling and the best of the candidates, its `c10_grade` is
`tested-by-the-trigger`, and the published robustness column says **.856** of its permitted moves
are within 100 cp of best -- the highest of any non-anchor class.

THE TRANSFORMATION, AND WHY IT IS A RELOCATION RATHER THAN AN ADDITION.

To flip T we must change whether q is attacked. Adding or deleting a piece would do it and would
also change material, which is the covariate `GO_NO_GO.md` already names as the largest imbalance in
the RC-01 item sets (SMD -0.487). So the transformation MOVES one enemy piece:

    T-  ->  T+     q is attacked by exactly one enemy piece; relocate that piece so it does not
    T+  ->  T-     q is attacked by nothing; relocate one enemy piece so that it does

Material, piece counts, side to move and the promoting pawn are all identical by construction. What
is NOT identical is recorded per pair rather than assumed away: mobility, captures available, checks
available, and the geometry of the moved piece.

WHAT DISQUALIFIES A TWIN. Every one of these is a refusal, not a repair:

  * the position is not legal (`chess.Board.status()`)
  * the side to move changes, or its check status changes
  * the side NOT to move is left in check, which is not a position
  * the promotion target set stops being exactly {q} -- a relocated piece can block a push or open
    a capture-promotion to a second square, and then the twin is a different decision
  * the shipped trigger does not return the flipped state when asked
  * a pawn would land on the first or last rank

THE TWIN IS SCORED BY THE UNCHANGED INSTRUMENT. This program writes items in the format
`action_set.py` already consumes and does not score anything itself. `RNL-11` -- do not change the
intervention and the instrument together -- and here the instrument is the one that must not move.

    python minimal_twins.py --items rc.jsonl --out twins.jsonl --report results/minimal_twins.json
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
from rule_classes import BY_ID, Context  # noqa: E402

RC = "RC-05"
#: The same piece values `scan_rule_classes.py` uses for `actor_material`, so a twin's covariates
#: are comparable with the corpus rows beside it rather than being a second scale.
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9,
          chess.KING: 0}


def promotion_square(board: chess.Board) -> chess.Square | None:
    """The single square every queen promotion goes to, or None if there is not exactly one."""
    squares = {m.to_square for m in board.legal_moves if m.promotion == chess.QUEEN}
    return next(iter(squares)) if len(squares) == 1 else None


def material(board: chess.Board, color: chess.Color) -> int:
    return sum(VALUES[p.piece_type] for p in board.piece_map().values() if p.color == color)


def covariates(board: chess.Board) -> dict:
    """The same covariate schema `scan_rule_classes.py` writes, recomputed on the twin."""
    us = board.turn
    legal = list(board.legal_moves)
    checks = 0
    mates = 0
    for m in legal:
        board.push(m)
        if board.is_check():
            checks += 1
            if board.is_checkmate():
                mates += 1
        board.pop()
    captures = sum(1 for m in legal if board.is_capture(m))
    return {
        "n_legal_moves": len(legal),
        "n_legal_captures": captures,
        "n_checks_available": checks,
        "n_mate_in_1": mates,
        "n_forcing_moves": len({m for m in legal if board.is_capture(m)} |
                               {m for m in legal if board.gives_check(m)}),
        "piece_count": len(board.piece_map()),
        "actor_material": material(board, us),
        "opponent_material": material(board, not us),
        "material_balance": material(board, us) - material(board, not us),
        "total_material": material(board, us) + material(board, not us),
        "in_check": int(board.is_check()),
        "fullmove_number": board.fullmove_number,
    }


def legal_position(board: chess.Board) -> bool:
    """A position, not merely a board: legal by python-chess, and the idle side not in check."""
    if board.status() != chess.STATUS_VALID:
        return False
    probe = board.copy(stack=False)
    probe.turn = not board.turn
    return not probe.is_check()


def relocations(board: chess.Board, square: chess.Square) -> list[chess.Square]:
    """
    Every empty square the piece on `square` could stand on, nearest first.

    NEAREST FIRST IS THE MINIMALITY RULE, and it is stated here rather than left to iteration order
    so that the twin bank is deterministic and a reader can see what "minimal" was taken to mean:
    Chebyshev distance from the origin, ties broken by square index.
    """
    piece = board.piece_at(square)
    out = []
    for target in chess.SQUARES:
        if board.piece_at(target) is not None:
            continue
        if piece.piece_type == chess.PAWN and chess.square_rank(target) in (0, 7):
            continue
        out.append(target)
    return sorted(out, key=lambda t: (max(abs(chess.square_file(t) - chess.square_file(square)),
                                          abs(chess.square_rank(t) - chess.square_rank(square))),
                                      t))


def try_twin(board: chess.Board, want: str) -> tuple[chess.Board, dict] | None:
    """
    One relocation of one enemy piece that flips the trigger to `want`, or None.

    `None` IS THE COMMON ANSWER AND IS NOT A FAILURE OF THIS FUNCTION. A position where no single
    enemy piece can be moved to cover or uncover the promotion square without also changing the
    promotion set, giving check, or leaving an illegal position, is a position with no minimal twin.
    Counting those is half of what Gate B asks: `B-DOMAIN-LIMIT` is the finding that they dominate.
    """
    rc = BY_ID[RC]
    ctx = Context(prev_move=None, prev_was_capture=0)
    q = promotion_square(board)
    if q is None:
        return None
    them = not board.turn
    attackers = list(board.attackers(them, q))

    if want == "positive":
        # q is attacked; the flip is to leave it unattacked. Minimal means one piece moves, so the
        # attack must be carried by exactly one piece.
        if len(attackers) != 1:
            return None
        movers = attackers
    else:
        if attackers:
            return None
        movers = [s for s, p in board.piece_map().items()
                  if p.color == them and p.piece_type != chess.KING]

    for origin in movers:
        piece = board.piece_at(origin)
        if piece is None or piece.piece_type == chess.KING:
            continue
        for target in relocations(board, origin):
            twin = board.copy(stack=False)
            twin.remove_piece_at(origin)
            twin.set_piece_at(target, piece)
            twin.halfmove_clock = board.halfmove_clock
            # Castling rights are cleared: a relocated rook or a shuffled board can leave rights
            # that no longer describe a reachable position, and `status()` would call that
            # invalid. Losing them changes the decision only where castling is legal, and that is
            # recorded as a covariate rather than assumed harmless.
            twin.castling_rights = chess.BB_EMPTY
            twin.ep_square = None
            if not legal_position(twin):
                continue
            if twin.is_check() != board.is_check():
                continue
            if promotion_square(twin) != q:
                continue
            if rc.trigger(twin, ctx) != want:
                continue
            return twin, {
                "moved_piece": piece.symbol(),
                "from": chess.square_name(origin),
                "to": chess.square_name(target),
                "chebyshev_distance": max(
                    abs(chess.square_file(target) - chess.square_file(origin)),
                    abs(chess.square_rank(target) - chess.square_rank(origin))),
                "promotion_square": chess.square_name(q),
                "castling_rights_cleared": board.castling_rights != chess.BB_EMPTY,
                "ep_square_cleared": board.ep_square is not None,
            }
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--out", required=True, help="twin items, in action_set.py's --items format")
    ap.add_argument("--report", required=True)
    ap.add_argument("--cap", type=int, default=0, help="stop after N successful pairs per cell")
    a = ap.parse_args()

    rc = BY_ID[RC]
    ctx = Context(prev_move=None, prev_was_capture=0)
    flip = {"positive": "negative", "negative": "positive"}

    made = collections.Counter()
    refused: collections.Counter = collections.Counter()
    pairs: list[dict] = []
    seen = 0

    with open(a.items, encoding="utf-8") as fh, open(a.out, "w", encoding="utf-8") as out:
        for line in fh:
            rec = json.loads(line)
            if rec.get("rule_class") != RC:
                continue
            seen += 1
            board = chess.Board(rec["fen"])
            state = rc.trigger(board, ctx)
            if state is None:
                refused["source trigger no longer fires"] += 1
                continue
            if state != rec["trigger_state"]:
                refused["source trigger state disagrees with the corpus row"] += 1
                continue
            if a.cap and made[state] >= a.cap:
                continue
            got = try_twin(board, flip[state])
            if got is None:
                refused[f"no minimal twin from {state}"] += 1
                continue
            twin, how = got
            made[state] += 1

            before, after = covariates(board), covariates(twin)
            deltas = {k: after[k] - before[k] for k in before}
            pair = {
                "source_game_id": rec["source_game_id"],
                "source_ply": rec["source_ply"],
                "original_fen": rec["fen"],
                "original_state": state,
                "twin_fen": twin.fen(),
                "twin_state": flip[state],
                "transformation": how,
                "covariates_before": before,
                "covariates_after": after,
                "covariate_deltas": deltas,
            }
            pairs.append(pair)

            # The twin, written as an item the frozen instrument can score. `observable_action` is
            # null: no human played this position and none may be invented for it.
            out.write(json.dumps({
                **{k: rec[k] for k in ("source", "source_game_id", "source_ply", "actor_elo",
                                       "opponent_elo", "time_control", "rule_class_version")},
                "fen": twin.fen(),
                "prev_move": None,
                "prev_was_capture": 0,
                "move_played": None,
                "observable_action": None,
                "rule_class": RC,
                "trigger_state": flip[state],
                "phase": rec["phase"],
                "halfmove_clock": twin.halfmove_clock,
                "twin_of": rec["fen"],
                **after,
            }) + "\n")

    def mean(key: str, only: str | None = None) -> dict:
        rows = [p for p in pairs if only is None or p["original_state"] == only]
        if not rows:
            return {}
        vals = [p["covariate_deltas"][key] for p in rows]
        return {"n": len(vals), "mean_delta": sum(vals) / len(vals),
                "max_abs_delta": max(abs(v) for v in vals)}

    report = {
        "version": "1.0.0",
        "rule_class": RC,
        "why_this_class": (
            "its response predicate is a property of the move alone, so B is identical on both "
            "cells by construction -- which is exactly the precondition RC-06 fails"),
        "transformation": (
            "relocate one enemy piece so that the single promotion square changes between attacked "
            "and unattacked. Material, piece counts, side to move and the promoting pawn are "
            "identical by construction"),
        "source_items_seen": seen,
        "twins_made": dict(made),
        "refusals": dict(refused),
        "yield": {
            state: (made[state] / (made[state] + refused.get(f"no minimal twin from {state}", 0)))
            for state in ("positive", "negative")
            if made[state] + refused.get(f"no minimal twin from {state}", 0)
        },
        "covariate_movement": {
            key: {"all": mean(key), "from_positive": mean(key, "positive"),
                  "from_negative": mean(key, "negative")}
            for key in ("n_legal_moves", "n_legal_captures", "n_checks_available",
                        "n_forcing_moves", "material_balance", "piece_count")
        },
        "what_this_does_not_establish": [
            "that a twin is as hard as its source -- item difficulty is measured by the engine, "
            "not by these covariates, and that is Gate B question 3",
            "that the action-set contrast moves in the predicted direction -- that is question 5 "
            "and it requires the engine run over this bank",
            "that any human would find the pair comparable. No human has seen either position",
        ],
        "pairs": pairs,
    }
    json.dump(report, open(a.report, "w", encoding="utf-8"), indent=1)
    print(f"{seen} source items, twins: {dict(made)}, refusals: {dict(refused)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
