"""
REBUILD THE ANCHOR PAIR, AND SCREEN `RC-05` AND `RC-02` AGAINST IT.

WHY THE PAIR NEEDS REBUILDING. `position_between_anchors` puts 0 at the refuted incumbent
`RC-01 loose-piece` and 1 at the ceiling `RC-00 mate-in-one`, and gate `G5` asks whether a candidate
out-separates the floor. `C11` graded `RC-01` **VACANT**: its as-stated noise cell is empty on 100%
of its trigger-negative items, so `b_valid | T-` is 0 by construction and its published .184 scores
a DIFFERENT act -- capturing the dearest DEFENDED piece rather than the undefended one its sentence
names. A gate anchored on that is not measuring what it is named after.

WHAT THIS RUN DOES, AND IN WHICH ORDER:

  1. Re-measures `RC-00` and `RC-01` WITHIN THIS RUN, so the rebuilt scale is one instrument rather
     than a comparison against published numbers from another.
  2. Measures three candidate replacement floors -- `RC-02`, `RC-03`, `RC-04` -- and screens
     `RC-05` and `RC-02` as candidates. `RC-02` appears in both roles on purpose: a class cannot be
     both the floor and a candidate, and finding out which it should be is part of the question.
  3. Computes every quantity TWICE where the shipped predicate differs from the sentence, so no
     number mixes one predicate's `b_valid` with another's chance rate.

THE CHANCE BASELINE, AND THE REASON IT IS NOT THE ANSWER ON ITS OWN. `prescription_size` is already
the screen's per-item chance rate for `b_valid`, so the separation a move-blind agent earns for free
is `psz|T+ - psz|T-`, and the corrected separation is the observed one minus that. It is the right
floor -- chance, rather than a rule class somebody picked -- and it CANNOT REPLACE C11:

    RC-06, within one basis: b_valid .952 / 1.000, chance .302 / .994
           separation -0.048, chance separation -0.692, CORRECTED +0.644

A saturated noise cell has a chance rate near 1, so the chance separation is large and NEGATIVE, and
subtracting it turns the worst class in the register into one of the best. Correction assumes the
chance rate is a floor to beat; where the chance rate is ~1 there is nothing to beat and the
subtraction becomes a bonus. **C11 gates first. Correction is applied only to what survives it.**

    python anchor_rebuild.py --items rc.jsonl --engine ./stockfish --out anchor_rebuild.json
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

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1] / "measurement"))
sys.path.insert(0, str(HERE.parent))
from rule_classes import Context, RULE_CLASSES  # noqa: E402
from c11_screen import as_stated, SUBSTITUTES  # noqa: E402

#: `RC-00` and `RC-01` are the incumbent pair, re-measured here rather than quoted.
#: `RC-02`, `RC-03`, `RC-04` are the candidate replacement floors.
#: `RC-05` and `RC-02` are the two candidates R3 screens.
CLASSES = ["RC-00", "RC-01", "RC-02", "RC-03", "RC-04", "RC-05"]


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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--sample", type=int, default=250)
    ap.add_argument("--nodes", type=int, default=200_000)
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    by_id = {r.id: r for r in RULE_CLASSES}
    pool: dict[tuple[str, str], list[dict]] = {}
    with open(a.items) as fh:
        for line in fh:
            rec = json.loads(line)
            cid = rec["rule_class"]
            if cid not in CLASSES:
                continue
            # the screen's own per-candidate exclusion: RC-03 lives in check, nothing else does
            if (cid == "RC-03") != bool(rec["in_check"]):
                continue
            pool.setdefault((cid, rec["trigger_state"]), []).append(rec)

    rng = random.Random(a.seed)
    engine = chess.engine.SimpleEngine.popen_uci(a.engine)
    engine.configure({"Threads": 1, "Hash": 64})
    limit = chess.engine.Limit(nodes=a.nodes)

    rows, failures, searches = {}, 0, 0
    for cid in CLASSES:
        rule = by_id[cid]
        stated = as_stated(cid)
        cells = {}
        for state in ("positive", "negative"):
            recs = pool.get((cid, state), [])
            drawn = rng.sample(recs, a.sample) if len(recs) > a.sample else recs
            n = 0
            ship_hit = stat_hit = 0
            ship_psz = stat_psz = 0.0
            stat_empty = 0
            for rec in drawn:
                board = chess.Board(rec["fen"])
                ctx = Context(
                    prev_move=chess.Move.from_uci(rec["prev_move"]) if rec.get("prev_move") else None,
                    prev_was_capture=bool(rec.get("prev_was_capture", 0)),
                )
                legal = list(board.legal_moves)
                if not legal:
                    continue
                s = sum(1 for m in legal if rule.satisfies(board, m, ctx))
                t = sum(1 for m in legal if stated(board, m, ctx)) if stated else s
                try:
                    best = engine.play(board, limit).move
                except chess.engine.EngineError:
                    failures += 1
                    continue
                searches += 1
                if best is None:
                    failures += 1
                    continue
                n += 1
                ship_psz += s / len(legal)
                stat_psz += t / len(legal)
                stat_empty += t == 0
                ship_hit += bool(rule.satisfies(board, best, ctx))
                stat_hit += bool(stated(board, best, ctx)) if stated else bool(rule.satisfies(board, best, ctx))
            cells[state] = {
                "cell_size": len(recs),
                "n": n,
                "b_valid_shipped": rate(ship_hit, n),
                "b_valid_as_stated": rate(stat_hit, n) if stated else None,
                "prescription_size_shipped": (ship_psz / n) if n else None,
                "prescription_size_as_stated": (stat_psz / n) if (n and stated) else None,
                "no_legal_move_as_stated": (stat_empty / n) if (n and stated) else None,
            }
        pos, neg = cells["positive"], cells["negative"]

        def sep(key: str):
            p = pos[f"b_valid_{key}"]
            m = neg[f"b_valid_{key}"]
            if p is None or m is None:
                return None
            return p["p"] - m["p"]

        def chance(key: str):
            p = pos[f"prescription_size_{key}"]
            m = neg[f"prescription_size_{key}"]
            if p is None or m is None:
                return None
            return p - m

        # THE BASIS IS C11'S BASIS, NOT "whichever alternative reading exists".
        #
        # `as_stated` also returns a predicate for `RC-00` and `RC-13`, whose shipped predicates do
        # NOT substitute the antecedent: C11 computes their second reading for information and
        # grades them on the shipped one. Picking a basis by "is there an alternative" instead of
        # "does the shipped predicate ask a different question on T-" put the CEILING on `RC-00`'s
        # strict reading, where B is the mate itself -- which does not exist on a T- item, so
        # b_valid|T- is 0 by construction and the separation is 1.000. That is the VACANT artefact,
        # and baking it into the ceiling would have made the whole rebuilt scale an artefact.
        basis = "as_stated" if cid in SUBSTITUTES else "shipped"
        s_obs, s_chance = sep(basis), chance(basis)
        rows[cid] = {
            "name": rule.name,
            "role": rule.role,
            "prescription": rule.prescription,
            "basis": basis,
            "separation_shipped": sep("shipped"),
            "separation_as_stated": sep("as_stated"),
            "chance_separation_shipped": chance("shipped"),
            "chance_separation_as_stated": chance("as_stated"),
            "separation_on_basis": s_obs,
            "chance_separation_on_basis": s_chance,
            "corrected_separation": (None if s_obs is None or s_chance is None else s_obs - s_chance),
            "cells": cells,
        }
        print(f"{cid} done", flush=True)
    engine.quit()

    ceiling = rows["RC-00"]["corrected_separation"]
    for cid, r in rows.items():
        c = r["corrected_separation"]
        r["position_between_chance_and_ceiling"] = (
            None if c is None or not ceiling else round(c / ceiling, 4)
        )

    out = {
        "version": "1.0.0",
        "what_this_is": (
            "the anchor pair rebuilt after C11 voided the floor, and RC-05 and RC-02 screened "
            "against it, all within one run on the published engine"
        ),
        "engine": {"build": "Stockfish 17.1", "nodes": a.nodes, "threads": 1, "hash": 64},
        "seed": a.seed,
        "sample_per_cell": a.sample,
        "searches": searches,
        "engine_failures": failures,
        "rebuilt_scale": {
            "floor": "CHANCE, not a rule class. A move-blind agent earns psz|T+ - psz|T- for free.",
            "ceiling": "RC-00 mate-in-one's corrected separation, re-measured in this run",
            "gate_order": (
                "C11 first, then correction. Correction cannot replace C11: on a saturated noise "
                "cell the chance rate is ~1, the chance separation is large and negative, and "
                "subtracting it turns the worst class in the register into one of the best "
                "(RC-06, one basis: -0.048 observed, -0.692 chance, +0.644 corrected)."
            ),
        },
        "classes": rows,
    }
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")

    print(f"\n{'id':7}{'role':17}{'basis':11}{'sep':>8}{'chance':>9}{'corrected':>11}{'vs ceiling':>12}")
    for cid, r in rows.items():
        print(f"{cid:7}{r['role']:17}{r['basis']:11}"
              f"{(r['separation_on_basis'] or 0):8.3f}{(r['chance_separation_on_basis'] or 0):9.3f}"
              f"{(r['corrected_separation'] or 0):11.3f}"
              f"{(r['position_between_chance_and_ceiling'] or 0):12.3f}")
    print(f"\nsearches {searches}, engine failures {failures}")


if __name__ == "__main__":
    main()
