"""
RC-06's SEPARATION, RECOMPUTED WITH ONE PREDICATE HELD FIXED ACROSS BOTH CELLS.

WHAT THIS IS FOR. `separation = b_valid|T+ - b_valid|T-` = +0.768 is the number that makes
`RC-06 answer-the-mate-threat` the only eligible rule class of fifteen: gate G5 is the only gate it
uniquely passes, and G5 reads separation. `_threat_satisfies` computes those two terms under
DIFFERENT definitions of B -- on T+, "the opponent has no mate in one"; on T-, "the opponent has no
check at all". H22 established that this makes the SDT criterion uninterpretable. It leaves open,
and nothing in #49/#50/#51 closes, whether it also makes SEPARATION uninterpretable.

`rule_classes.py` says the symmetric version was abandoned because P(B | T-) "would have come out
near 1". THAT IS A COMMENT, NOT A MEASUREMENT, and an unverified comment of exactly this shape is
what let `RC-21` through two screens. `predicate_semantics.py` measures the prescription sizes;
this measures the thing the gate actually reads.

THE PUBLISHED METHOD, UNCHANGED: Stockfish's own best move at a fixed node budget is asked whether
it satisfies B. The rule never grades itself, no engine enters either predicate, and the sampler,
the seed and the per-cell size are the screen's.

THE POSITIVE CONTROL IS THE POINT OF THE `branching` COLUMN. If this harness does not reproduce
.968 / .200 under the shipped predicate, its symmetric column means nothing either.

    python rc06_fixed_predicate.py --items rc.jsonl --engine ./stockfish \\
        --sample 250 --nodes 200000 --seed 20260831 --out rc06_fixed_predicate.json
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import chess
import chess.engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
from rule_classes import _opponent_has_mate_in_one, _threat_satisfies, Context  # noqa: E402


def wilson(k: int, n: int) -> list[float]:
    if not n:
        return [0.0, 1.0]
    z, p = 1.959963984540054, k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [max(0.0, c - h), min(1.0, c + h)]


def rate(k: int, n: int) -> dict:
    return {"k": k, "n": n, "p": (k / n) if n else None, "ci95": wilson(k, n)}


def _b_symmetric(board: chess.Board, move: chess.Move) -> bool:
    board.push(move)
    try:
        return not _opponent_has_mate_in_one(board)
    finally:
        board.pop()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--sample", type=int, default=250)
    ap.add_argument("--nodes", type=int, default=200_000)
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    pool: dict[str, list[dict]] = {"positive": [], "negative": []}
    with open(a.items) as fh:
        for line in fh:
            rec = json.loads(line)
            if rec["rule_class"] != "RC-06" or rec["in_check"]:
                continue
            pool[rec["trigger_state"]].append(rec)

    rng = random.Random(a.seed)
    engine = chess.engine.SimpleEngine.popen_uci(a.engine)
    engine.configure({"Threads": 1, "Hash": 64})
    limit = chess.engine.Limit(nodes=a.nodes)

    cells, failures = {}, 0
    for state in ("positive", "negative"):
        recs = pool[state]
        drawn = rng.sample(recs, min(a.sample, len(recs)))
        branching = symmetric = 0
        b_empty_branching = b_empty_symmetric = 0
        b_full_symmetric = 0
        for rec in drawn:
            board = chess.Board(rec["fen"])
            ctx = Context(
                prev_move=chess.Move.from_uci(rec["prev_move"]) if rec.get("prev_move") else None,
                prev_was_capture=bool(rec.get("prev_was_capture", 0)),
            )
            legal = list(board.legal_moves)
            if not any(_threat_satisfies(board, m, ctx) for m in legal):
                b_empty_branching += 1
            sym_k = sum(1 for m in legal if _b_symmetric(board, m))
            if sym_k == 0:
                b_empty_symmetric += 1
            if sym_k == len(legal):
                b_full_symmetric += 1
            try:
                best = engine.play(board, limit).move
            except chess.engine.EngineError:
                failures += 1
                continue
            if best is None:
                failures += 1
                continue
            if _threat_satisfies(board, best, ctx):
                branching += 1
            if _b_symmetric(board, best):
                symmetric += 1
        cells[state] = {
            "n": len(drawn),
            "cell_size": len(recs),
            "b_valid_branching": rate(branching, len(drawn)),
            "b_valid_symmetric": rate(symmetric, len(drawn)),
            "nothing_satisfies_branching_B": rate(b_empty_branching, len(drawn)),
            "nothing_satisfies_symmetric_B": rate(b_empty_symmetric, len(drawn)),
            "every_legal_move_satisfies_symmetric_B": rate(b_full_symmetric, len(drawn)),
        }
    engine.quit()

    sep_branching = cells["positive"]["b_valid_branching"]["p"] - cells["negative"]["b_valid_branching"]["p"]
    sep_symmetric = cells["positive"]["b_valid_symmetric"]["p"] - cells["negative"]["b_valid_symmetric"]["p"]

    out = {
        "version": "1.0.0",
        "engine": {"path": a.engine, "nodes": a.nodes, "threads": 1, "hash": 64},
        "seed": a.seed,
        "sample_per_cell": a.sample,
        "engine_failures": failures,
        "cells": cells,
        "separation_branching": sep_branching,
        "separation_symmetric": sep_symmetric,
        "published_separation_branching": 0.768,
        "published_incumbent_floor_separation": 0.600,
        "positive_control": (
            "the `branching` column must reproduce the published .968 / .200; if it does not, "
            "nothing in the `symmetric` column is evidence about anything."
        ),
        "gate_G5": {
            "asks": "separation > the refuted incumbent RC-01's separation (+0.600)",
            "passes_under_branching_B": sep_branching > 0.600,
            "passes_under_symmetric_B": sep_symmetric > 0.600,
        },
    }
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
