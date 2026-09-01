"""
C11 -- THE GUARD ON THE NOISE CELL, RUN ON ALL SEVENTEEN RULE CLASSES INCLUDING BOTH ANCHORS.

WHAT C11 ASKS. `separation = b_valid|T+ - b_valid|T-` is a specificity statistic only if ONE
response predicate is scored on both cells. `prescription_size` already guards the POSITIVE cell
against a vacuous prescription scoring well. Nothing guarded the negative one. So:

    On the trigger-negative cell, under the response predicate AS THE CLASS'S OWN `prescription`
    SENTENCE STATES IT, what share of legal moves satisfies the rule?

Two ways for that answer to make `separation` meaningless, and they pull in OPPOSITE directions:

    SATURATED   near 1. Almost every legal move satisfies the rule when its trigger is absent, so
                b_valid|T- is near 1 whatever the player or the engine does, and separation
                collapses. This is RC-06.

    VACANT      near 0 BECAUSE THE RULE NAMES AN ACT THAT DOES NOT EXIST on a T- item -- not
                because the act is available and wrong. Then b_valid|T- is 0 by construction,
                separation is just b_valid|T+, and the class is FLATTERED rather than penalised.

The published screen has neither, because on several classes it silently SUBSTITUTES A DIFFERENT
ANTECEDENT on the negative cell: `_designated_threat` returns a pawn where the sentence says queen,
`_loose_designated` returns the most valuable DEFENDED piece where the sentence says undefended,
`_capture_the_threat_satisfies` looks for the checking piece where the sentence says the mating
piece. Each substitution produces a non-degenerate number that is not the rule's.

THE `as_stated` PREDICATES BELOW ARE TRANSCRIPTIONS, NOT REDESIGNS. Each is written from its own
class's `prescription` string and from nothing else, and each returns False when the object the
sentence names does not exist. Where a sentence admits two readings the script computes BOTH and
reports both rather than choosing.

NO ENGINE, NO PARTICIPANTS, NO NEW CORPUS. Everything here is a pure function of positions the
published scan already wrote.

    python c11_screen.py --items rc.jsonl --sample 2000 --out c11_screen.json
"""

from __future__ import annotations

import argparse
import inspect
import json
import math
import random
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
from rule_classes import (  # noqa: E402
    _designated_threat,
    _in_bad_spot,
    _knight_promotions,
    _loose_and_held_targets,
    _mating_moves,
    _mating_piece_square,
    _opponent_has_mate_in_one,
    _passed_pawns,
    _safe_promotions_for_mover,
    _threat_answered,
    _threatens_mate_after_pass,
    _their_safe_promotions,
    ATTACKER_ORDER,
    Context,
    RULE_CLASSES,
    VALUES,
)

SATURATED = 0.95
VACANT = 0.05


def wilson(k: int, n: int) -> list[float]:
    if not n:
        return [0.0, 1.0]
    z, p = 1.959963984540054, k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [max(0.0, c - h), min(1.0, c + h)]


# ------------------------------------------------------- objects the sentences actually name

def _loose_target(board: chess.Board):
    """RC-01: "exactly one enemy piece is capturable and undefended". Not "the dearest defended one"."""
    loose, _held = _loose_and_held_targets(board)
    return loose[0] if len(loose) == 1 else None


def _threat_of_worth(board: chess.Board, worth: int):
    """RC-07/08/09: "your queen" / "your rook" / "a knight or bishop". Not "your pawn"."""
    hit = _designated_threat(board)
    return hit[0] if hit is not None and hit[1] == worth else None


def _minor_attacked_by_cheaper(board: chess.Board):
    """
    RC-18 ONLY: "a minor of yours is attacked by something cheaper".

    NOT RC-11. RC-11 uses `_tier_trigger(KNIGHT)` -- the same trigger as RC-09 -- and its sentence
    is "if a knight or bishop of yours CAN BE WON, move it", which says nothing about the attacker
    being cheaper. A first version of this file used one helper for both and so tested RC-11
    against a condition its own sentence does not state, which is the exact defect C11 exists to
    catch. `_must_move_trigger` is RC-18's alone.
    """
    hit = _designated_threat(board)
    if hit is None or hit[1] != VALUES[chess.KNIGHT]:
        return None
    square, worth = hit
    piece = board.piece_at(square)
    if piece is None:
        return None
    cheaper = any(
        ATTACKER_ORDER[board.piece_at(a).piece_type] < worth
        for a in board.attackers(not piece.color, square)
    )
    return square if cheaper else None


def _minor_hanging_to_equal_or_dearer(board: chess.Board):
    """RC-20: "a minor of yours hangs to an equal-or-dearer attacker"."""
    hit = _designated_threat(board)
    if hit is None or hit[1] != VALUES[chess.KNIGHT]:
        return None
    square, worth = hit
    piece = board.piece_at(square)
    if piece is None:
        return None
    cheaper = any(
        ATTACKER_ORDER[board.piece_at(a).piece_type] < worth
        for a in board.attackers(not piece.color, square)
    )
    return None if cheaper else square


# ---------------------------------------------------------------- the as-stated predicates

def as_stated(cid: str):
    """One transcription per class, or None where the shipped predicate already is the sentence."""

    if cid == "RC-00":
        # "if a move mates, play it" -- the strict reading, where B is the MATE rather than any check.
        return lambda b, m, c: m in _mating_moves(b)

    if cid == "RC-01":
        def f(b, m, c):
            sq = _loose_target(b)
            return sq is not None and m.to_square == sq and b.is_capture(m)
        return f

    if cid in ("RC-07", "RC-08", "RC-09"):
        worth = {"RC-07": VALUES[chess.QUEEN], "RC-08": VALUES[chess.ROOK],
                 "RC-09": VALUES[chess.KNIGHT]}[cid]

        def f(b, m, c, worth=worth):
            sq = _threat_of_worth(b, worth)
            return sq is not None and _threat_answered(b, m, sq)
        return f

    if cid == "RC-11":
        def f(b, m, c):
            sq = _threat_of_worth(b, VALUES[chess.KNIGHT])
            return sq is not None and m.from_square == sq
        return f

    if cid == "RC-18":
        def f(b, m, c):
            sq = _minor_attacked_by_cheaper(b)
            return sq is not None and m.from_square == sq
        return f

    if cid == "RC-20":
        def f(b, m, c):
            sq = _minor_hanging_to_equal_or_dearer(b)
            if sq is None or m.from_square == sq:
                return False
            b.push(m)
            try:
                piece = b.piece_at(sq)
                return piece is not None and not _in_bad_spot(b, sq, piece.color)
            finally:
                b.pop()
        return f

    if cid == "RC-06":
        def f(b, m, c):
            b.push(m)
            try:
                return not _opponent_has_mate_in_one(b)
            finally:
                b.pop()
        return f

    if cid == "RC-12":
        def f(b, m, c):
            b.push(m)
            try:
                return _safe_promotions_for_mover(b) == 0
            finally:
                b.pop()
        return f

    if cid == "RC-14":
        def f(b, m, c):
            if not _threatens_mate_after_pass(b):
                return False
            sq = _mating_piece_square(b)
            return sq is not None and m.to_square == sq and b.is_capture(m)
        return f

    if cid == "RC-13":
        # "promote to a knight ONLY WHEN the knight gives check" is a PROHIBITION on the negative
        # side: where no knight promotion checks, the rule says do not make one. Under that reading
        # B on T- is the complement, which is almost every legal move.
        def f(b, m, c):
            if any(b.gives_check(x) for x in _knight_promotions(b)):
                return m.promotion == chess.KNIGHT
            return m.promotion != chess.KNIGHT
        return f

    return None


#: Classes whose shipped predicate asks about a DIFFERENT OBJECT on the negative cell than its own
#: sentence names. These are graded on the as-stated reading, because no single question is asked
#: on both cells and the sentence's is the only one with a claim to be the rule.
SUBSTITUTES = {
    "RC-01": "`_loose_designated` returns the dearest DEFENDED piece on T-; the sentence says undefended",
    "RC-06": "`_threat_satisfies` asks `no check at all` on T-; the sentence says the mate is stopped",
    "RC-07": "`_designated_threat` returns a PAWN on T-; the sentence says your queen",
    "RC-08": "`_designated_threat` returns a PAWN on T-; the sentence says your rook",
    "RC-09": "`_designated_threat` returns a PAWN on T-; the sentence says a knight or bishop",
    "RC-11": "`_designated_threat` returns a PAWN on T-; the sentence says a knight or bishop of yours",
    "RC-12": "`_promotion_stop_satisfies` answers a piece threat on T-; the sentence says a promotion",
    "RC-14": "`_capture_the_threat_satisfies` looks for the CHECKING piece on T-; the sentence says the mating piece",
    "RC-18": "`_designated_threat` returns a PAWN on T-; the sentence says a minor of yours",
    "RC-20": "`_designated_threat` returns a PAWN on T-; the sentence says a minor of yours",
}


#: Classes where a SECOND reading of the sentence exists and is computed for information, but the
#: shipped predicate asks the same question on both cells and is therefore what the grade is on.
ALTERNATIVE_READING = {
    "RC-00": (
        "B is `gives check` on both cells. The strict reading of `if a move mates, play it` makes "
        "B the mate itself, which does not exist on a T- item -- but the sentence's own second "
        "clause, `a check that is not mate is the error`, says the noise trial IS a check. The "
        "shipped reading is the sentence's."
    ),
    "RC-13": (
        "B is `promote to a knight` on both cells. `only when` makes the negative side a "
        "PROHIBITION, under which B on T- is the complement -- almost every legal move. Both "
        "readings ask one question on both cells; the shipped one measures the forbidden act, "
        "which is the sharper instrument."
    ),
}


def grade(negative: dict, substitutes: bool) -> str:
    """
    SATURATED and VACANT are the two ways a noise cell stops carrying information, and they are
    NOT symmetric quantities.

    Saturation is about the MEAN share of legal moves that satisfy the rule: when that is near 1,
    b_valid|T- is near 1 whatever anyone plays.

    Vacancy is about whether the rule PRESCRIBES ANYTHING AT ALL. A narrow prescription is a good
    prescription -- a low mean is what `prescription_size` rewards on the positive cell -- so a
    small share is not a defect. What is a defect is a T- cell on which NO legal move can satisfy
    the rule, because then b_valid|T- is 0 by construction, separation is just b_valid|T+, and the
    class is flattered rather than penalised. A first version of this function graded on the mean
    and called five narrow-but-available prescriptions vacant.
    """
    key = "as_stated" if substitutes else "shipped"
    mean = negative[f"prescription_size_{key}"]
    empty = negative[f"no_legal_move_{key}"]
    if mean is None:
        return "UNGRADED"
    if mean >= SATURATED:
        return "SATURATED"
    if empty is not None and empty >= 1 - VACANT:
        return "VACANT"
    return "MEASURABLE"


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
            cid = rec["rule_class"]
            # the screen's own per-candidate in-check exclusion: RC-03 lives in check, nothing else
            if (cid == "RC-03") != bool(rec["in_check"]):
                continue
            pool.setdefault((cid, rec["trigger_state"]), []).append(rec)

    rng = random.Random(a.seed)
    rows = {}
    for cid in sorted(by_id):
        rule = by_id[cid]
        stated = as_stated(cid)
        cells = {}
        for state in ("positive", "negative"):
            recs = pool.get((cid, state), [])
            drawn = rng.sample(recs, a.sample) if len(recs) > a.sample else recs
            n = 0
            ship_sum = stat_sum = 0.0
            ship_full = ship_empty = stat_full = stat_empty = 0
            for rec in drawn:
                board = chess.Board(rec["fen"])
                ctx = Context(
                    prev_move=chess.Move.from_uci(rec["prev_move"]) if rec.get("prev_move") else None,
                    prev_was_capture=bool(rec.get("prev_was_capture", 0)),
                )
                legal = list(board.legal_moves)
                if not legal:
                    continue
                n += 1
                s = sum(1 for m in legal if rule.satisfies(board, m, ctx))
                ship_sum += s / len(legal)
                ship_full += s == len(legal)
                ship_empty += s == 0
                if stated is not None:
                    t = sum(1 for m in legal if stated(board, m, ctx))
                    stat_sum += t / len(legal)
                    stat_full += t == len(legal)
                    stat_empty += t == 0
            cells[state] = {
                "cell_size": len(recs),
                "n": n,
                "prescription_size_shipped": (ship_sum / n) if n else None,
                "every_legal_move_shipped": (ship_full / n) if n else None,
                "no_legal_move_shipped": (ship_empty / n) if n else None,
                "prescription_size_as_stated": (stat_sum / n) if (n and stated) else None,
                "every_legal_move_as_stated": (stat_full / n) if (n and stated) else None,
                "no_legal_move_as_stated": (stat_empty / n) if (n and stated) else None,
            }
        neg = cells["negative"]
        substitutes = cid in SUBSTITUTES
        g = grade(neg, substitutes)
        rows[cid] = {
            "name": rule.name,
            "role": rule.role,
            "prescription": rule.prescription,
            "shipped_predicate": rule.satisfies.__name__,
            "substitutes_the_antecedent_on_T_minus": substitutes,
            "substitution": SUBSTITUTES.get(cid),
            "alternative_reading": ALTERNATIVE_READING.get(cid),
            "graded_on": "as_stated" if substitutes else "shipped",
            "c11_grade": g,
            "noise_cell_inflation": (
                None if neg["prescription_size_as_stated"] is None
                else neg["prescription_size_as_stated"] - (neg["prescription_size_shipped"] or 0.0)
            ),
            "cells": cells,
        }

    counts: dict[str, int] = {}
    for r in rows.values():
        counts[r["c11_grade"]] = counts.get(r["c11_grade"], 0) + 1

    out = {
        "c11_version": "1.0.0",
        "asks": (
            "on the trigger-negative cell, under the response predicate as the class's own "
            "prescription sentence states it, what share of legal moves satisfies the rule?"
        ),
        "grades": {
            "SATURATED": f"mean prescription size on T- >= {SATURATED}: almost everything satisfies the rule when the trigger is absent, so b_valid|T- is near 1 whatever anyone plays",
            "VACANT": f"NO legal move satisfies the rule on >= {1 - VACANT:.0%} of T- items: the rule names an act that does not exist there, so b_valid|T- is 0 by construction and separation is just b_valid|T+",
            "MEASURABLE": "neither: the rule prescribes something on T- and it can be wrong",
        },
        "graded_on": (
            "the as-stated reading for classes whose shipped predicate asks about a different "
            "object on T-, because no single question is asked on both cells and the sentence's is "
            "the only one with a claim to be the rule; the shipped reading otherwise"
        ),
        "seed": a.seed,
        "sample_per_cell": a.sample,
        "engine": "none. Every quantity here is a pure function of the position.",
        "counts": counts,
        "classes": rows,
    }
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")

    print(f"{'id':7}{'role':17}{'presc|T+':>10}{'presc|T- ship':>15}{'presc|T- stated':>17}  grade")
    for cid, r in rows.items():
        p = r["cells"]["positive"]["prescription_size_shipped"]
        s = r["cells"]["negative"]["prescription_size_shipped"]
        t = r["cells"]["negative"]["prescription_size_as_stated"]
        print(f"{cid:7}{r['role']:17}{p:10.3f}{s:15.3f}"
              f"{('  --  ' if t is None else f'{t:.3f}'):>17}  {r['c11_grade']}")
    print("\ncounts:", json.dumps(counts))


if __name__ == "__main__":
    main()
