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
from rule_classes import VALUES, Context, _designated_threat, _in_bad_spot  # noqa: E402

#: Excludes kings and pawns. What the pawn-race rules turn on is whether anything OTHER than the
#: king could stop a pawn, which is the entire content of the rule of the square.
PIECE_VALUES = {chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


# ---------------------------------------------------------------- the predicates

def _opponent_has_no_pieces(board: chess.Board) -> bool:
    """
    THE RULE OF THE SQUARE'S OWN PRECONDITION. `_outside_the_square` asks whether the LONE enemy
    king can catch the pawn. It is a statement about a king-and-pawn ending and says nothing
    whatever about a position in which the defender still owns a rook.
    """
    them = not board.turn
    return not any(
        p.color == them and p.piece_type in PIECE_VALUES for p in board.piece_map().values()
    )


def _exactly_one_thing_hanging(board: chess.Board) -> bool:
    """
    THE SEVERITY LADDER NAMES *A* THREAT, SINGULAR -- "answer the queen threat", "move the
    threatened minor", "defend the piece in place".

    `_designated_threat` returns the MOST VALUABLE piece of ours the opponent can win and the tier
    triggers fire on its value. When two pieces hang at once the class still fires, still names the
    bigger one, and `B` still asks only that the bigger one be rescued -- while the position
    contains a second loss the rule is silent about. Answering one of two threats is not what any
    of these rules claims to be a rule about.
    """
    us = board.turn
    hanging = sum(
        1 for sq, piece in board.piece_map().items()
        if piece.color == us and piece.piece_type != chess.KING and _in_bad_spot(board, sq, us)
    )
    return hanging == 1


def _knight_does_what_a_queen_cannot(board: chess.Board) -> bool:
    """
    `RC-13`'s OWN STATED CONDITION, WHICH ITS TRIGGER DOES NOT TEST.

    Its docstring: promoting to a knight "is wrong essentially always -- a queen is strictly
    better -- unless the knight does something a queen cannot, WHICH ON THE MOVE IT APPEARS MEANS
    GIVING CHECK."

    The trigger then fires on `knight promotion gives check` alone. A queen promotion very often
    gives check from the same square, and where it does, the knight is doing nothing a queen could
    not do and promoting to a knight is simply the worse move. The condition the class names is the
    knight checking WHERE THE QUEEN WOULD NOT, and that is what this tests.
    """
    knight_checks = any(
        m.promotion == chess.KNIGHT and board.gives_check(m) for m in board.legal_moves
    )
    queen_checks = any(
        m.promotion == chess.QUEEN and board.gives_check(m) for m in board.legal_moves
    )
    return knight_checks and not queen_checks


def _ctx_of(rec: dict) -> Context:
    prev = rec.get("prev_move")
    return Context(
        prev_move=chess.Move.from_uci(prev) if prev else None,
        prev_was_capture=bool(rec.get("prev_was_capture", 0)),
    )


# ---------------------------------------------------------------- the registry
#
# ONE ENTRY PER RULE CLASS, and a `None` predicate is a verdict rather than an omission. Every
# entry names the condition the class claims and says whether its trigger tests it.

# THREE VERDICTS, AND THE DISTINCTION BETWEEN THE FIRST TWO IS THE WHOLE POINT OF THE FILE.
#
#   UNCHECKED  the code skips a precondition ITS OWN DOCSTRING ASSERTS. This is the RC-21 shape:
#              somebody wrote down the condition, and the predicate does not test it.
#   DESIGNED   the class narrows deliberately and says so. `_designated_threat` documents that it
#              returns the most valuable piece of ours the opponent can win, and each position is
#              assigned to exactly one tier by that value. Firing with two pieces hanging is a
#              choice on the record, not an oversight -- but it has a cost, and the cost is
#              measurable, which is why these are split too.
#   FAITHFUL   the trigger tests what the name claims.
#
# AND A VERDICT IS NOT A SCORE. An unchecked claim can be harmless: `RC-13` skips its own stated
# condition and the skip explains nothing, because the class fails just as completely inside its
# own scope. Whether a gap MATTERS is `b_valid_gap`, and it is reported separately from whether a
# gap EXISTS.
UNCHECKED = "UNCHECKED"
DESIGNED = "DESIGNED"
FAITHFUL = "FAITHFUL"

SCOPE = {
    "RC-00": (FAITHFUL, None,
              "Trigger: exactly one mating move exists. That IS mate-in-one. But `satisfies` is "
              "`gives check`, which is wider than the name -- reported as prescription breadth in "
              "the robustness column (48.2% of permitted moves safe), not as a trigger defect."),
    "RC-01": (FAITHFUL, None,
              "`loose` means undefended, and the trigger tests `not board.attackers(them, sq)`. "
              "That a loose piece is sometimes still not winnable -- pins, back ranks -- is a fact "
              "about chess the published screen already prices at 15%, not a condition the name "
              "claims and the predicate skips."),
    "RC-02": (FAITHFUL, None,
              "`recapture` means taking back after they took, and `prev_was_capture` is exactly "
              "that. The name claims nothing about the exchange being favourable."),
    "RC-03": (FAITHFUL, None,
              "The trigger tests one checker, capturable, and splits T+/T- on whether it is "
              "defended -- which is the safety condition the name implies. Its known problem is a "
              "chance rate of .543 in check, which is a base-rate fact and not a scope defect."),
    "RC-04": (DESIGNED, _exactly_one_thing_hanging,
              "Named for a threat, singular. `_designated_threat` documents that it returns the "
              "most valuable piece of ours the opponent can win, and B asks only that the biggest "
              "be rescued -- deliberate and on the record. Where a second piece hangs, the "
              "prescribed act leaves a loss the rule is silent about."),
    "RC-06": (FAITHFUL, None,
              "`_threatens_mate_after_pass` null-moves and asks whether the opponent mates, which "
              "is what a mate threat is. Items where the mate cannot be stopped are already "
              "counted rather than dropped (3.2%). No condition is named and skipped."),
    "RC-07": (DESIGNED, _exactly_one_thing_hanging,
              "As RC-04: names one threat, fires on the largest, and says so."),
    "RC-08": (DESIGNED, _exactly_one_thing_hanging,
              "As RC-04: names one threat, fires on the largest, and says so."),
    "RC-09": (DESIGNED, _exactly_one_thing_hanging,
              "As RC-04: names one threat, fires on the largest, and says so."),
    "RC-11": (DESIGNED, _exactly_one_thing_hanging,
              "As RC-04: names one threat, fires on the largest, and says so."),
    "RC-13": (UNCHECKED, _knight_does_what_a_queen_cannot,
              "Its docstring names `the knight does something a queen cannot`; the trigger tests "
              "only that the knight promotion checks, and a queen promotion very often checks from "
              "the same square. THE SKIP IS REAL AND EXPLAINS NOTHING: b_valid is .000 on both "
              "sides of the split, so the class fails just as completely inside its own scope."),
    "RC-14": (FAITHFUL, None,
              "`_sole_source_of` refuses to fire unless every threatened mate comes from one "
              "square, so `the mating piece` is well defined wherever the class fires."),
    "RC-18": (DESIGNED, _exactly_one_thing_hanging,
              "Its own extra condition -- the attacker is cheaper, so defending cannot help -- IS "
              "tested, which is what makes it the contrast with RC-04. It still inherits the "
              "documented single-threat choice from `_designated_threat`."),
    "RC-20": (DESIGNED, _exactly_one_thing_hanging,
              "As RC-04: names one threat, fires on the largest, and says so."),
    "RC-05": (FAITHFUL, _opponent_has_no_pieces,
              "`_promote_trigger` fires on a queen promotion whose square is unattacked and names "
              "no condition about the rest of the board, so it claims nothing it fails to check. "
              "The material split is reported as a MODERATOR for comparison with RC-21."),
    "RC-12": (FAITHFUL, _opponent_has_no_pieces,
              "Names a promotion threat and tests one. The material split is reported as the NULL "
              "CONTROL: the same predicate on the same family moves b_valid by one point in the "
              "wrong direction, which is what shows RC-21's gap is not an artefact of slicing."),
    "RC-21": (UNCHECKED, _opponent_has_no_pieces,
              "`_outside_the_square` names the LONE enemy king in its own docstring. "
              "`_passer_trigger` never tests that the king is alone, and here the skip explains "
              "the headline: b_valid .562 inside the rule's scope against .124 outside it."),
}


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
    verdict, predicate, why = SCOPE[rule_class]
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

    in_scope = [r for r in rows if predicate(chess.Board(r["fen"]))]
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
    wanted = [a.rule_class] if a.rule_class else [k for k in SCOPE if k in present]

    results = {k: scope_one(rows, k, a.cell) for k in wanted}
    counts = collections.Counter(v["verdict"] for v in results.values())
    payload = {
        "scope_version": "1.0.0",
        "cell": a.cell,
        "what_this_asks": "does the trigger fire on the condition the rule class is named after?",
        "verdict_counts": dict(counts),
        "unchecked_claims": sorted(k for k, v in results.items() if v["verdict"] == UNCHECKED),
        "designed_narrowings": sorted(k for k, v in results.items() if v["verdict"] == DESIGNED),
        "faithful": sorted(k for k, v in results.items() if v["verdict"] == FAITHFUL),
        "ranked_by_b_valid_gap": [
            k for k, v in sorted(
                ((k, v) for k, v in results.items() if v.get("b_valid_gap") is not None),
                key=lambda kv: -(kv[1]["b_valid_gap"] or 0))],
        "results": results,
    }
    Path(a.out).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"{'id':<7}{'verdict':<11}{'in-scope':>9}{'bv in':>8}{'bv out':>8}{'gap':>8}"
          f"{'reg in':>8}{'reg out':>8}")
    for k in wanted:
        v = results[k]
        if not v.get("has_predicate"):
            print(f"{k:<7}{v['verdict']:<11}{'—':>9}{'—':>8}{'—':>8}{'—':>8}{'—':>8}{'—':>8}")
            continue
        i, o = v["in_scope"], v["out_of_scope"]
        print(f"{k:<7}{v['verdict']:<11}{v['share_in_scope']:>8.1%}"
              f"{i['b_valid']:>8.3f}{o['b_valid']:>8.3f}{v['b_valid_gap']:>+8.3f}"
              f"{i['regret_b_xs_mean']:>8.3f}{o['regret_b_xs_mean']:>8.3f}")
    print("unchecked claims:", ", ".join(payload["unchecked_claims"]) or "none")
    print("designed narrowings:", ", ".join(payload["designed_narrowings"]) or "none")


if __name__ == "__main__":
    main()
