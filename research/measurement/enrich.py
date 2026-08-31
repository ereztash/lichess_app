"""
ADD THE ORACLE FIELDS TO A SCANNED CORPUS, EACH IN ITS OWN COLUMN.

The scan wrote what the board says. This adds what SEE says, what the geometry of competing
motifs says, and -- when an engine path is given -- what Stockfish says. Nothing here may change
`trigger_state` or `observable_action`: those were fixed by `predicates.py` before any oracle
ran, and F4 is the falsification that this separation exists to survive.

    python enrich.py --in games.jsonl --out games_enriched.jsonl [--engine ./stockfish \\
                     --engine-sample 600 --engine-nodes 200000 --seed 20260831]
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parent))
from oracles import see, Engine  # noqa: E402

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
ATTACKER_ORDER = {**VALUES, chess.KING: 100}


def designated_capture(board: chess.Board, square: int) -> chess.Move | None:
    """
    The capture a player applying the rule would actually play: cheapest attacker takes.

    A CHOICE, AND IT IS RECORDED AS ONE. With two ways to take the same piece the rule does not
    say which, and "cheapest attacker" is the convention every chess text states. It is not
    derived from anything measured here, and where it matters the alternative is reported.
    """
    caps = [m for m in board.legal_moves if m.to_square == square and board.is_capture(m)]
    if not caps:
        return None
    return min(caps, key=lambda m: ATTACKER_ORDER[board.piece_at(m.from_square).piece_type])  # type: ignore[union-attr]


def geometric_flags(board: chess.Board, target_sq: int, target_value: int, cap: chess.Move) -> dict:
    bigger = False
    for m in board.legal_moves:
        if not board.is_capture(m) or m.to_square == target_sq:
            continue
        victim = board.piece_at(m.to_square)
        if victim is not None and VALUES.get(victim.piece_type, 0) > target_value:
            bigger = True
            break
    return {
        "capture_gives_check": int(board.gives_check(cap)),
        "bigger_capture_elsewhere": int(bigger),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fen-field", default="original_fen")
    ap.add_argument("--engine", default=None)
    ap.add_argument("--engine-sample", type=int, default=0)
    ap.add_argument("--engine-nodes", type=int, default=200_000)
    ap.add_argument("--seed", type=int, default=20260831)
    a = ap.parse_args()

    rows = [json.loads(line) for line in open(a.inp, encoding="utf-8")]

    engine_indices: set[int] = set()
    if a.engine and a.engine_sample:
        rng = random.Random(a.seed)
        pos = [i for i, r in enumerate(rows) if r["trigger_state"] == "positive"]
        neg = [i for i, r in enumerate(rows) if r["trigger_state"] == "negative"]
        k = a.engine_sample
        engine_indices = set(rng.sample(pos, min(k, len(pos)))) | set(
            rng.sample(neg, min(k, len(neg)))
        )

    eng = Engine(a.engine, nodes=a.engine_nodes) if engine_indices else None
    done = 0
    with open(a.out, "w", encoding="utf-8") as out:
        for i, r in enumerate(rows):
            board = chess.Board(r[a.fen_field])
            sq = chess.parse_square(r["target_square"])
            cap = designated_capture(board, sq)
            if cap is None:
                r["see_result"] = None
                r["see_version"] = None
            else:
                r["see_result"] = see(board, cap)
                r["see_version"] = "swap-algorithm-1.0.0"
                r["designated_capture_uci"] = cap.uci()
                r.update(geometric_flags(board, sq, r["target_value"], cap))

            if eng is not None and i in engine_indices and cap is not None:
                ev = eng.evaluate(board, multipv=1)
                best = ev["lines"][0]["move"] if ev["lines"] else None
                scored = eng.score_move(board, cap)
                top = ev["lines"][0] if ev["lines"] else {}
                r["engine_build"] = ev["engine_build"]
                r["engine_nodes"] = ev["engine_nodes"]
                r["engine_best_move"] = best
                r["engine_best_cp"] = top.get("cp")
                r["engine_best_mate"] = top.get("mate")
                r["engine_capture_cp"] = scored.get("cp")
                r["engine_capture_mate"] = scored.get("mate")
                r["engine_best_is_designated_capture"] = int(best == cap.uci())
                # cp loss of taking, when both sides of the comparison are cp scores. A mate on
                # either side makes the difference a magnitude comparison against a ceiling, and
                # that is left as None rather than encoded as some large number.
                if top.get("cp") is not None and scored.get("cp") is not None:
                    r["engine_capture_cp_loss"] = top["cp"] - scored["cp"]
                else:
                    r["engine_capture_cp_loss"] = None
                done += 1
                if done % 200 == 0:
                    print(f"engine {done}/{len(engine_indices)}", file=sys.stderr, flush=True)
            out.write(json.dumps(r, separators=(",", ":")) + "\n")
    if eng is not None:
        eng.close()
    print(json.dumps({"rows": len(rows), "engine_scored": done}))


if __name__ == "__main__":
    main()
