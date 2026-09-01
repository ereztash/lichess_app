"""
DOES THE TRIGGER FIRE ON THE CONDITION IT NAMES?

The nine criteria in `rule_classes.py` ask whether `T` can be determined before behaviour, whether
`T` contains `B`, whether `B` needs an engine. **Not one of them asks whether the predicate detects
the condition it is named after**, and neither screen can notice: both take the trigger as given
and measure what follows from it.

`RC-21 push-the-unstoppable-passer` is why this file exists. The rule of the square answers exactly
one question -- CAN THE LONE ENEMY KING CATCH THIS PAWN? -- and `_outside_the_square` says so in its
own docstring. `_passer_trigger` calls it without ever checking the king is alone, so the class
fires with the opponent holding, at the median, thirteen points of pieces to stop the pawn with.
A rook two files away stops the pawn; the rule of the square has nothing to say about it.

WHAT A SCOPE PREDICATE IS, AND WHAT IT IS NOT. It is read off the rule's OWN name and docstring,
never invented to improve a score: the claim it tests is "this class says X, and here is the subset
where X is true". It is a pure function of the position, so every number below is recomputed from
adjudications already on disk with no engine and no new sampling.

    A CLASS WITH NO GAP GETS `None` AND A REASON, exactly as C8 permits a candidate to declare no
    literature. Reporting a split for a faithful trigger would manufacture a defect out of an
    arbitrary partition, and `RC-12` -- where the material split moves `b_valid` by one point in
    the WRONG direction -- is the standing demonstration that these partitions can be null.

    python trigger_scope.py --raw action_set_raw.jsonl --out trigger_scope.json          # all
    python trigger_scope.py --raw action_set_raw.jsonl --rule-class RC-21 --out one.json # one
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rule_classes import BY_ID, RULE_CLASSES, Context  # noqa: E402

# ---------------------------------------------------------------- where the claims live
#
# THEY LIVE ON THE RULE CLASS, NOT HERE, AND THAT MOVE IS THE POINT.
#
# The first version of this file carried its own registry of scope predicates -- seventeen entries
# recovered by reading `rule_classes.py` afterwards and writing down what each class appeared to
# claim. That is the same shape as the defect it was built to find: a statement about a rule class,
# kept somewhere the rule class does not have to agree with.
#
# `C10` moved the claim onto the class. `scope_claim` says what the class asserts, `c10_grade` says
# whether its trigger tests that, and `RuleClass.__post_init__` refuses any class that concedes a
# gap without handing over the predicate that measures it. So this file no longer decides anything
# about a rule class; it reads what the class declares and reports the consequence.
#
# WHICH KEEPS THE TWO QUESTIONS APART. `c10_grade` says whether a gap EXISTS -- a declaration, made
# by whoever wrote the class. `b_valid_gap` below says whether it MATTERS -- a measurement. `RC-13`
# is why they may not be collapsed: it concedes `asserted-and-unchecked`, and the split it concedes
# to moves `b_valid` by exactly nothing.


def _ctx_of(rec: dict) -> Context:
    prev = rec.get("prev_move")
    return Context(
        prev_move=chess.Move.from_uci(prev) if prev else None,
        prev_was_capture=bool(rec.get("prev_was_capture", 0)),
    )


# ---------------------------------------------------------------- measurement

def _summarise(rows: list[dict]) -> dict:
    n = len(rows)
    if not n:
        return {"n": 0}
    mean = lambda xs: (sum(xs) / len(xs)) if xs else None  # noqa: E731
    pick = lambda k: [r[k] for r in rows if r.get(k) is not None]  # noqa: E731
    return {
        "n": n,
        "b_valid": sum(r["b_valid"] for r in rows) / n,
        "regret_b_xs_mean": mean(pick("regret_b_xs")),
        "advantage_xs_mean": mean(pick("advantage_xs")),
        "v_star_xs_mean": mean(pick("v_star_xs")),
    }


def scope_one(rows: list[dict], rule_class: str, cell: str = "positive") -> dict:
    rc = BY_ID[rule_class]
    verdict, predicate, why = rc.c10_grade, rc.scope_predicate, rc.scope_claim
    rows = [r for r in rows
            if r["rule_class"] == rule_class and r["trigger_state"] == cell
            and "engine_failed" not in r]

    out = {
        "rule_class": rule_class,
        "cell": cell,
        "n": len(rows),
        "verdict": verdict,
        "why": why,
        "has_predicate": predicate is not None,
    }
    if predicate is None or not rows:
        # NO SPLIT IS REPORTED FOR A FAITHFUL TRIGGER WITH NO NATURAL PREDICATE. Inventing one
        # would manufacture a defect out of an arbitrary partition.
        out["whole_cell"] = _summarise(rows)
        return out

    in_scope = [r for r in rows if predicate(chess.Board(r["fen"]), _ctx_of(r))]
    out_of_scope = [r for r in rows if r not in in_scope]
    i, o = _summarise(in_scope), _summarise(out_of_scope)
    out.update({
        "share_in_scope": len(in_scope) / len(rows),
        "in_scope": i,
        "out_of_scope": o,
        "b_valid_gap": (
            None if not (i["n"] and o["n"]) else i["b_valid"] - o["b_valid"]),
        "regret_gap": (
            None if not (i["n"] and o["n"])
            or i["regret_b_xs_mean"] is None or o["regret_b_xs_mean"] is None
            else o["regret_b_xs_mean"] - i["regret_b_xs_mean"]),
    })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--rule-class", help="one class; omit for every class in the registry")
    ap.add_argument("--cell", default="positive")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    rows = [json.loads(line) for line in open(a.raw, encoding="utf-8")]
    present = {r["rule_class"] for r in rows}
    wanted = ([a.rule_class] if a.rule_class
              else [rc.id for rc in RULE_CLASSES if rc.id in present])

    results = {k: scope_one(rows, k, a.cell) for k in wanted}
    counts = collections.Counter(v["verdict"] for v in results.values())
    payload = {
        "scope_version": "1.0.0",
        "cell": a.cell,
        "what_this_asks": "does the trigger fire on the condition the rule class is named after?",
        "verdict_counts": dict(counts),
        "asserted_and_unchecked": sorted(
            k for k, v in results.items() if v["verdict"] == "asserted-and-unchecked"),
        "declared_and_separately_tested": sorted(
            k for k, v in results.items() if v["verdict"] == "declared-and-separately-tested"),
        "tested_by_the_trigger": sorted(
            k for k, v in results.items() if v["verdict"] == "tested-by-the-trigger"),
        "ranked_by_b_valid_gap": [
            k for k, v in sorted(
                ((k, v) for k, v in results.items() if v.get("b_valid_gap") is not None),
                key=lambda kv: -(kv[1]["b_valid_gap"] or 0))],
        "results": results,
    }
    Path(a.out).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"{'id':<7}{'verdict':<30}{'in-scope':>9}{'bv in':>8}{'bv out':>8}{'gap':>8}"
          f"{'reg in':>8}{'reg out':>8}")
    for k in wanted:
        v = results[k]
        if not v.get("has_predicate"):
            print(f"{k:<7}{v['verdict']:<30}{'—':>9}{'—':>8}{'—':>8}{'—':>8}{'—':>8}{'—':>8}")
            continue
        i, o = v["in_scope"], v["out_of_scope"]
        print(f"{k:<7}{v['verdict']:<30}{v['share_in_scope']:>8.1%}"
              f"{i['b_valid']:>8.3f}{o['b_valid']:>8.3f}{v['b_valid_gap']:>+8.3f}"
              f"{i['regret_b_xs_mean']:>8.3f}{o['regret_b_xs_mean']:>8.3f}")
    print("asserted-and-unchecked:", ", ".join(payload["asserted_and_unchecked"]) or "none")
    print("declared-and-separately-tested:",
          ", ".join(payload["declared_and_separately_tested"]) or "none")


if __name__ == "__main__":
    main()
