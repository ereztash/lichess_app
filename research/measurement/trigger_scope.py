"""
DOES THE TRIGGER FIRE ON THE CONDITION IT NAMES?

C3 asks whether T contains B. It does not ask whether T is TRUE -- whether the predicate a rule
class calls "the rule of the square" actually detects the position the rule of the square is a
rule about. Nothing in `screen_rule_classes.py` or `action_set.py` can notice that failure, because
both take the trigger as given and measure what follows from it.

`RC-21 push-the-unstoppable-passer` is why this file exists.

    The rule of the square answers one question: CAN THE LONE ENEMY KING CATCH THIS PAWN? The
    helper that implements it says so in its own docstring. `_passer_trigger` then calls it
    without ever checking that the enemy king is alone -- so the class fires in any position with
    exactly one passed pawn whose promotion square the enemy KING cannot reach in time, no matter
    how many pieces that enemy still has to stop the pawn with.

    A rook two files away stops the pawn. The rule of the square has nothing to say about it.

This module partitions a rule class's positive cell by how much material the opponent still has,
and reports the screen's own numbers on each part. It invents nothing: `b_valid` and the regret
are read from the adjudication records, and the split is a fact about the FEN.

    python trigger_scope.py --raw action_set_raw.jsonl --rule-class RC-21 --out trigger_scope.json
"""

from __future__ import annotations

import argparse
import collections
import json

import chess

#: Excludes kings and pawns. What is being asked is whether anything is left that could stop a
#: passed pawn OTHER than the king -- which is the entire content of the rule of the square.
PIECE_VALUES = {chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def opponent_piece_material(fen: str) -> int:
    board = chess.Board(fen)
    them = not board.turn
    return sum(
        PIECE_VALUES[p.piece_type]
        for p in board.piece_map().values()
        if p.color == them and p.piece_type in PIECE_VALUES
    )


def _summarise(rows: list[dict]) -> dict:
    n = len(rows)
    if not n:
        return {"n": 0}
    regrets = [r["regret_b_xs"] for r in rows if r.get("regret_b_xs") is not None]
    advs = [r["advantage_xs"] for r in rows if r.get("advantage_xs") is not None]
    stars = [r["v_star_xs"] for r in rows if r.get("v_star_xs") is not None]
    mean = lambda xs: (sum(xs) / len(xs)) if xs else None  # noqa: E731
    return {
        "n": n,
        "b_valid": sum(r["b_valid"] for r in rows) / n,
        "regret_b_xs_mean": mean(regrets),
        "advantage_xs_mean": mean(advs),
        "v_star_xs_mean": mean(stars),
    }


def scope(rows: list[dict], rule_class: str, cell: str) -> dict:
    rows = [r for r in rows
            if r["rule_class"] == rule_class and r["trigger_state"] == cell
            and "engine_failed" not in r]
    for r in rows:
        r["_opp_material"] = opponent_piece_material(r["fen"])

    in_scope = [r for r in rows if r["_opp_material"] == 0]
    out_of_scope = [r for r in rows if r["_opp_material"] > 0]
    hist = collections.Counter(r["_opp_material"] for r in rows)
    mats = sorted(r["_opp_material"] for r in rows)

    return {
        "rule_class": rule_class,
        "cell": cell,
        "n": len(rows),
        "opponent_piece_material_median": mats[len(mats) // 2] if mats else None,
        "opponent_piece_material_histogram": {str(k): hist[k] for k in sorted(hist)},
        "share_in_scope": (len(in_scope) / len(rows)) if rows else None,
        "in_scope_king_and_pawns_only": _summarise(in_scope),
        "out_of_scope_opponent_still_has_pieces": _summarise(out_of_scope),
        "what_in_scope_means": (
            "the opponent has no piece other than king and pawns, which is the ONLY case the rule "
            "of the square is a rule about"
        ),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--rule-class", default="RC-21")
    ap.add_argument("--cell", default="positive")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    rows = [json.loads(line) for line in open(a.raw, encoding="utf-8")]
    result = scope(rows, a.rule_class, a.cell)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    i = result["in_scope_king_and_pawns_only"]
    o = result["out_of_scope_opponent_still_has_pieces"]
    print(f"{a.rule_class} {a.cell}: {result['n']} items, "
          f"{result['share_in_scope']:.1%} in scope, "
          f"median opponent piece material {result['opponent_piece_material_median']}")
    for label, s in (("in scope   ", i), ("out of scope", o)):
        if s["n"]:
            print(f"  {label} n={s['n']:>4}  b_valid={s['b_valid']:.3f}  "
                  f"regret_xs={s['regret_b_xs_mean']:.3f}  V*={s['v_star_xs_mean']:.3f}")


if __name__ == "__main__":
    main()
