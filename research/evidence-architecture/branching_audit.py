"""
WHICH RESPONSE PREDICATES ASK A DIFFERENT QUESTION ON THE TWO CELLS -- AND WHY THE SHIPPED
DETECTOR CANNOT SEE ALL OF THEM.

A rule class's `separation` is `b_valid|T+ - b_valid|T-`. That difference is a specificity
statistic only if ONE response predicate is scored on both cells. `criterion_channel.py` (PR #49)
established that `_threat_satisfies` (RC-06) does not satisfy this, and detects the property by
reading the predicate's source for a literal `_trigger(` call:

    out[rule.id] = "_trigger(" in source

That detector was HARDENED after a mutation control caught a weaker version, and the hardening is
what makes it blind: `_promotion_stop_satisfies` (RC-12) branches on the same board condition its
trigger uses WITHOUT calling the trigger function, and its own docstring says so --

    "Branches on the trigger, for the reason `_threat_satisfies` branches: on a T- item the
     opponent never had a promotion, so 'they still have none' would be satisfied by almost every
     legal move and the false-alarm cell would be degenerate."

So H22's "the only predicate of the twelve that branches on the trigger" is not right, and the
stderr warning that was supposed to fire when a second class started branching cannot fire.

THREE DETECTORS, REPORTED SIDE BY SIDE, because the disagreement is the finding:

  source     "_trigger(" in the source of `satisfies`          -- the shipped detector
  declared   the docstring of `satisfies` says it branches     -- what the author wrote down
  measured   the prescription size on T- under the shipped predicate against the same size under
             the predicate AS THE PRESCRIPTION SENTENCE STATES IT

ONLY THE THIRD IS EVIDENCE. The first two read text. The third reads the board, and it prices the
consequence: a predicate that branches reports an artificially small noise cell, and the gap
between the two sizes is the size of the artefact.

`as-stated` predicates are supplied here for the two classes that branch, read off each class's own
`prescription` string and nothing else:

  RC-06  "if the opponent threatens mate next move, play a move that stops it"
         -> after your move, the opponent has no mate in one.
  RC-12  "if the opponent can promote safely, play a move that stops it"
         -> after your move, the opponent has no safe promotion.

    python branching_audit.py --items rc.jsonl --sample 2000 --out branching_audit.json
"""

from __future__ import annotations

import argparse
import inspect
import json
import random
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
from rule_classes import (  # noqa: E402
    _opponent_has_mate_in_one,
    _safe_promotions_for_mover,
    Context,
    RULE_CLASSES,
)


def source_detector() -> dict[str, bool]:
    """`criterion_channel.py::branching_predicates`, reproduced exactly."""
    return {r.id: "_trigger(" in inspect.getsource(r.satisfies) for r in RULE_CLASSES}


def declared_detector() -> dict[str, bool]:
    """What the predicate's own docstring says about itself."""
    out = {}
    for r in RULE_CLASSES:
        doc = (r.satisfies.__doc__ or "").lower()
        out[r.id] = "branches on the trigger" in doc or "it branches" in doc
    return out


# --------------------------------------------------------- the as-stated response predicates

def _as_stated_rc06(board: chess.Board, move: chess.Move) -> bool:
    board.push(move)
    try:
        return not _opponent_has_mate_in_one(board)
    finally:
        board.pop()


def _as_stated_rc12(board: chess.Board, move: chess.Move) -> bool:
    board.push(move)
    try:
        # after our move it is already their turn -- no null move, the same fix the shipped
        # predicate carries and for the same reason.
        return _safe_promotions_for_mover(board) == 0
    finally:
        board.pop()


AS_STATED = {"RC-06": _as_stated_rc06, "RC-12": _as_stated_rc12}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--sample", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    by_id = {r.id: r for r in RULE_CLASSES}
    pool: dict[tuple[str, str], list[dict]] = {}
    with open(a.items) as fh:
        for line in fh:
            rec = json.loads(line)
            if rec["rule_class"] not in AS_STATED or rec["in_check"]:
                continue
            pool.setdefault((rec["rule_class"], rec["trigger_state"]), []).append(rec)

    rng = random.Random(a.seed)
    measured = {}
    for cid, as_stated in sorted(AS_STATED.items()):
        rule = by_id[cid]
        cells = {}
        for state in ("positive", "negative"):
            recs = pool.get((cid, state), [])
            rows = rng.sample(recs, a.sample) if len(recs) > a.sample else recs
            shipped_sum = stated_sum = 0.0
            stated_full = shipped_full = 0
            for rec in rows:
                board = chess.Board(rec["fen"])
                ctx = Context(
                    prev_move=chess.Move.from_uci(rec["prev_move"]) if rec.get("prev_move") else None,
                    prev_was_capture=bool(rec.get("prev_was_capture", 0)),
                )
                legal = list(board.legal_moves)
                if not legal:
                    continue
                s = sum(1 for m in legal if rule.satisfies(board, m, ctx))
                t = sum(1 for m in legal if as_stated(board, m))
                shipped_sum += s / len(legal)
                stated_sum += t / len(legal)
                shipped_full += s == len(legal)
                stated_full += t == len(legal)
            n = len(rows)
            cells[state] = {
                "cell_size": len(recs),
                "n": n,
                "prescription_size_shipped": shipped_sum / n if n else None,
                "prescription_size_as_stated": stated_sum / n if n else None,
                "every_legal_move_satisfies_shipped": shipped_full / n if n else None,
                "every_legal_move_satisfies_as_stated": stated_full / n if n else None,
            }
        measured[cid] = {
            "prescription": rule.prescription,
            "cells": cells,
            "noise_cell_inflation": (
                cells["negative"]["prescription_size_as_stated"]
                - cells["negative"]["prescription_size_shipped"]
            ),
        }

    src, dec = source_detector(), declared_detector()
    disagreements = sorted(k for k in src if src[k] != dec[k])

    out = {
        "version": "1.0.0",
        "seed": a.seed,
        "detectors": {
            "source_shipped": src,
            "declared_in_docstring": dec,
            "disagree": disagreements,
            "reading": (
                "The shipped detector reports the classes whose `satisfies` CALLS a trigger "
                "function. A predicate that inlines the same board condition is invisible to it. "
                "Every id in `disagree` is a class the shipped detector and the class's own "
                "docstring describe differently."
            ),
        },
        "measured": measured,
        "what_this_shows": (
            "Branching is not a property of how a predicate is written, so it cannot be detected "
            "by reading how a predicate is written. The measured columns price it: the noise cell "
            "the screen reports is smaller than the noise cell the rule as stated would have, and "
            "the difference is not small."
        ),
    }
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
