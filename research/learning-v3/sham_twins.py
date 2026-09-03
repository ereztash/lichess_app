"""
THE CONTROL GATE B NEEDS, AND THE ONE OBJECTION IT CANNOT ANSWER WITHOUT ONE.

`minimal_twins.py` flips the trigger by relocating one enemy piece, and the action-set contrast
moves in the predicted direction. The obvious objection is that the contrast is about MOVING A
PIECE, not about the trigger: any relocation changes the position, and a changed position has
different values.

`RNL-04` -- a gate that has not demonstrated failure is not a gate -- makes answering it compulsory
rather than optional. So this builds a SHAM twin for every real pair: the same source position, one
enemy piece relocated, **and the trigger deliberately NOT flipped**. Same perturbation, no trigger
change.

    real twin   T(P) = 1  ->  T(P') = 0      contrast should move
    sham twin   T(P) = 1  ->  T(P'') = 1     contrast should not

MATCHED WHERE MATCHING IS POSSIBLE. The sham prefers the same piece the real twin moved, then the
same Chebyshev distance, so the two perturbations are as alike as a board allows. Where the same
piece cannot be moved without flipping the trigger, any other enemy piece is used and the difference
is recorded rather than hidden.

THE PREDICTION IS WRITTEN BEFORE THE RUN, in `gate_b.py`'s own terms: on sham pairs,
`regret_b_xs` and `advantage_xs` should have confidence intervals that include zero. If they do not,
the twin design measures perturbation and Gate B does not hold.

    python sham_twins.py --items rc.jsonl --pairs results/minimal_twins.json \
        --out sham.jsonl --report results/sham_twins.json
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
from minimal_twins import (RC, covariates, legal_position, promotion_square,  # noqa: E402
                           relocations)
from rule_classes import BY_ID, Context  # noqa: E402


def try_sham(board: chess.Board, keep: str, prefer_piece: str | None,
             prefer_distance: int | None) -> tuple[chess.Board, dict] | None:
    """One relocation of one enemy piece that leaves the trigger where it was."""
    rc = BY_ID[RC]
    ctx = Context(prev_move=None, prev_was_capture=0)
    q = promotion_square(board)
    if q is None:
        return None
    them = not board.turn
    movers = [s for s, p in board.piece_map().items()
              if p.color == them and p.piece_type != chess.KING]
    # Prefer the piece the real twin moved, then anything else; within a piece, prefer the same
    # distance the real transformation used, so the two perturbations are comparable in size.
    movers.sort(key=lambda s: (board.piece_at(s).symbol() != prefer_piece, s))

    for origin in movers:
        piece = board.piece_at(origin)
        targets = relocations(board, origin)
        if prefer_distance is not None:
            targets.sort(key=lambda t: (
                abs(max(abs(chess.square_file(t) - chess.square_file(origin)),
                        abs(chess.square_rank(t) - chess.square_rank(origin))) - prefer_distance),
                t))
        for target in targets:
            sham = board.copy(stack=False)
            sham.remove_piece_at(origin)
            sham.set_piece_at(target, piece)
            sham.halfmove_clock = board.halfmove_clock
            sham.castling_rights = chess.BB_EMPTY
            sham.ep_square = None
            if not legal_position(sham):
                continue
            if sham.is_check() != board.is_check():
                continue
            if promotion_square(sham) != q:
                continue
            if rc.trigger(sham, ctx) != keep:
                continue
            if sham.board_fen() == board.board_fen():
                continue
            return sham, {
                "moved_piece": piece.symbol(),
                "from": chess.square_name(origin),
                "to": chess.square_name(target),
                "chebyshev_distance": max(
                    abs(chess.square_file(target) - chess.square_file(origin)),
                    abs(chess.square_rank(target) - chess.square_rank(origin))),
                "same_piece_as_real_twin": piece.symbol() == prefer_piece,
                "trigger_unchanged": keep,
            }
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--pairs", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--report", required=True)
    a = ap.parse_args()

    report = json.load(open(a.pairs, encoding="utf-8"))
    by_fen = {p["original_fen"]: p for p in report["pairs"]}
    rows = {}
    for line in open(a.items, encoding="utf-8"):
        r = json.loads(line)
        if r.get("rule_class") == RC and r["fen"] in by_fen:
            rows[r["fen"]] = r

    made = collections.Counter()
    refused: collections.Counter = collections.Counter()
    pairs = []
    with open(a.out, "w", encoding="utf-8") as out:
        for fen, pair in by_fen.items():
            rec = rows.get(fen)
            if rec is None:
                refused["source row not found"] += 1
                continue
            board = chess.Board(fen)
            state = pair["original_state"]
            got = try_sham(board, state, pair["transformation"]["moved_piece"],
                           pair["transformation"]["chebyshev_distance"])
            if got is None:
                refused[f"no sham from {state}"] += 1
                continue
            sham, how = got
            made[state] += 1
            before, after = covariates(board), covariates(sham)
            pairs.append({
                "original_fen": fen,
                "original_state": state,
                "sham_fen": sham.fen(),
                "sham_state": state,
                "real_twin_fen": pair["twin_fen"],
                "transformation": how,
                "real_transformation": pair["transformation"],
                "covariate_deltas": {k: after[k] - before[k] for k in before},
            })
            out.write(json.dumps({
                **{k: rec[k] for k in ("source", "source_game_id", "source_ply", "actor_elo",
                                       "opponent_elo", "time_control", "rule_class_version")},
                "fen": sham.fen(),
                "prev_move": None,
                "prev_was_capture": 0,
                "move_played": None,
                "observable_action": None,
                "rule_class": RC,
                "trigger_state": state,
                "phase": rec["phase"],
                "halfmove_clock": sham.halfmove_clock,
                "sham_of": fen,
                **after,
            }) + "\n")

    json.dump({
        "version": "1.0.0",
        "rule_class": RC,
        "what": ("a matched perturbation that does NOT flip the trigger, so the Gate B contrast can "
                 "be attributed to the trigger rather than to the fact that a piece moved"),
        "prediction_written_before_the_run": (
            "on sham pairs, regret_b_xs and advantage_xs should have 95% intervals that include "
            "zero. If they do not, the twin design measures perturbation and Gate B does not hold"),
        "shams_made": dict(made),
        "refusals": dict(refused),
        "same_piece_as_real_twin": sum(1 for p in pairs if p["transformation"]["same_piece_as_real_twin"]),
        "pairs": pairs,
    }, open(a.report, "w", encoding="utf-8"), indent=1)
    print(f"shams: {dict(made)}, refusals: {dict(refused)}, "
          f"same piece as the real twin: "
          f"{sum(1 for p in pairs if p['transformation']['same_piece_as_real_twin'])}/{len(pairs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
