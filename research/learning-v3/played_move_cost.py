"""
WHAT DID THE 42.5% ACTUALLY DO, AND DID IT COST THEM ANYTHING?

`compute_value.json` §7 reports that real players promoted to a safe square on **.575** of RC-05's
trigger-positive items. A gap of 42.5% is only a learning target if the moves in it were WORSE. A
player who declined to promote because they had a mate in two did not fail to apply a rule; they
applied a better one.

The corpus cannot answer this, and the reason is exact: `action_set.py` evaluated `V_B`, `V_notB`
and every member of `B`, and **the played move is usually not in `B`** on precisely the items in
question -- that is what makes them the gap. So the played move's value was never searched.

    regret_played = V*(s) - U(s, played)

BOTH TERMS ARE SEARCHED HERE, AND THE FIRST VERSION OF THIS FILE DID NOT DO THAT. It took
`U(s, played)` from the cache where the move happened to be in `B` -- a `multipv-over-B` line -- and
searched `V*` full-width in this run. Those are two different search policies, which is exactly why
`cache.py` puts the policy in its key: *"a MultiPV line restricted to B is not a full-width
search"*. Mixing them is the cross-policy comparison this repository's own cache design exists to
prevent, and it showed up as **six negative regrets** in the committed output -- a move worth more
than the position it was played in.

So no value is reused here. `U` is a root-restricted search over the single played move and `V*` is
a full-width search, both in this run, and the disagreement between the two bases is REPORTED rather
than assumed away -- the same treatment `action_set.py` gives it under the name `basis_gap_cp`,
*"reported per item so a reader can see the search noise rather than discover it in a negative
regret"*.

WHAT THIS IS NOT. It is not evidence about recognition. A player who was worse off after not
promoting may have seen the promotion and rejected it, or never considered it; the move alone cannot
tell those apart, and `EXPERIMENT.md`'s Study D exists because nothing in a move can. What this
bounds is whether there is anything to teach.

    python played_move_cost.py --items rc.jsonl --engine ./stockfish --out results/played_cost.json
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

import chess
import chess.engine

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
from rule_classes import BY_ID, Context  # noqa: E402

RC = "RC-05"

#: The same encoding `action_set.py` uses: a ceiling that makes a subtraction defined, not a
#: material quantity.
MATE_SCORE = 100_000

#: WHAT COUNTS AS A MATE SCORE, and the first version of this file got it wrong.
#:
#: `python-chess` returns `mate_score - n` for a mate in n, NOT `mate_score`. So a guard written as
#: `abs(cp) >= MATE_SCORE` never fires on a real mate, and mate encodings walk into the centipawn
#: quantiles: a run with that guard reported a p90 of **93,891** for the followed group, which is a
#: mate wearing a decimal point. Anything within a thousand of the ceiling is a mate and no real
#: evaluation is. The `xs` columns need no such guard, because a forced mate maps to exactly 1.0 or
#: 0.0 there -- which is the whole reason `xs` is the primary scale and cp is the diagnostic.
MATE_BAND = 1_000


def is_mate(cp: int | None) -> bool:
    return cp is not None and abs(cp) > MATE_SCORE - MATE_BAND


def expected_score(pov, ply: int) -> float:
    wdl = pov.wdl(model="sf16", ply=ply)
    return (wdl.wins + wdl.draws / 2) / (wdl.wins + wdl.draws + wdl.losses)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--nodes", type=int, default=200_000)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    rc = BY_ID[RC]
    ctx = Context(prev_move=None, prev_was_capture=0)

    # Only the trigger-positive items with a recorded human move: the gap is defined there.
    items = []
    for line in open(a.items, encoding="utf-8"):
        r = json.loads(line)
        if r.get("rule_class") == RC and r["trigger_state"] == "positive" and r.get("move_played"):
            items.append(r)

    engine = chess.engine.SimpleEngine.popen_uci(a.engine, timeout=600.0)
    engine.configure({"Threads": 1, "Hash": 64})
    limit = chess.engine.Limit(nodes=a.nodes)
    build = engine.id.get("name", "unknown")

    rows, searched, failed, negative, mated = [], 0, 0, 0, 0
    for r in items:
        board = chess.Board(r["fen"])
        try:
            played = chess.Move.from_uci(r["move_played"])
        except ValueError:
            failed += 1
            continue
        if played not in board.legal_moves:
            failed += 1
            continue
        ply = board.ply()
        satisfies = rc.satisfies(board, played, ctx)

        info = engine.analyse(board, limit, root_moves=[played])
        searched += 1
        pov = info["score"].pov(board.turn)
        u_xs = expected_score(pov, ply)
        u_cp = pov.score(mate_score=MATE_SCORE)

        info_full = engine.analyse(board, limit)
        searched += 1
        pov_full = info_full["score"].pov(board.turn)
        v_star_xs = expected_score(pov_full, ply)
        v_star_cp = pov_full.score(mate_score=MATE_SCORE)
        if v_star_xs - u_xs < 0:
            negative += 1
        cp_scorable = not (is_mate(u_cp) or is_mate(v_star_cp))
        if not cp_scorable:
            mated += 1

        rows.append({
            "fen": r["fen"],
            "move_played": played.uci(),
            "satisfies_rule": bool(satisfies),
            "regret_played_xs": v_star_xs - u_xs,
            "u_cp": u_cp,
            "v_star_cp": v_star_cp,
            "u_xs": u_xs,
            "v_star_xs": v_star_xs,
            "regret_played_cp": (v_star_cp - u_cp) if cp_scorable else None,
            # The full-width search against the single-move search it is supposed to dominate. A
            # negative regret is this quantity, not a discovery about chess.
            "basis_gap_cp": min(0, v_star_cp - u_cp) if cp_scorable else None,
            "mate_on_either_side": not cp_scorable,
            "actor_elo": r.get("actor_elo"),
        })
    engine.quit()

    followed = [x for x in rows if x["satisfies_rule"]]
    declined = [x for x in rows if not x["satisfies_rule"]]

    def summarise(xs: list[dict]) -> dict:
        rs = sorted(x["regret_played_xs"] for x in xs)
        cps = sorted(x["regret_played_cp"] for x in xs if x["regret_played_cp"] is not None)
        if not rs:
            return {}

        def q(v, p):
            return v[int(p * (len(v) - 1))] if v else None

        return {
            "n": len(rs),
            "n_cp_scorable": len(cps),
            "cp_median": q(cps, 0.5),
            "cp_p75": q(cps, 0.75),
            "cp_p90": q(cps, 0.9),
            "cp_share_losing_100_or_more": (
                (sum(1 for c in cps if c >= 100) / len(cps)) if cps else None),
            "mean_regret_xs": statistics.fmean(rs),
            "median_regret_xs": rs[len(rs) // 2],
            "p90_regret_xs": rs[int(0.9 * (len(rs) - 1))],
            "share_free": sum(1 for x in rs if x <= 0.0) / len(rs),
            "share_costing_at_least_0.10_xs": sum(1 for x in rs if x >= 0.10) / len(rs),
            "share_costing_at_least_0.25_xs": sum(1 for x in rs if x >= 0.25) / len(rs),
        }

    out = {
        "version": "1.0.0",
        "rule_class": RC,
        "question": ("of the trigger-positive items where a real player did NOT promote, how many "
                     "cost them anything? A gap is only a learning target if the moves in it were "
                     "worse"),
        "items": len(rows),
        "unusable_move_records": failed,
        "engine_searches": searched,
        "engine_build": build,
        "engine_nodes": a.nodes,
        "no_value_reused": ("both terms are searched in this run. See the module docstring: taking "
                            "U from a multipv-over-B cache line and V* from a full-width search "
                            "here is a cross-policy comparison"),
        "negative_regrets": negative,
        "items_with_a_mate_on_either_side": mated,
        "negative_regrets_note": ("the full-width search disagreeing with the single-move search it "
                                  "should dominate. Reported, not clamped; `share_free` counts them "
                                  "with the exact zeros because both mean the move cost nothing"),
        "followed_the_rule": summarise(followed),
        "declined_the_rule": summarise(declined),
        "what_this_does_not_establish": [
            "anything about recognition. A player who lost by not promoting may have seen the "
            "promotion and rejected it. The move cannot tell those apart and Study D exists "
            "because nothing in a move can",
            "that the cost is attributable to the rule. A position can be lost for other reasons "
            "in the same move",
        ],
        "rows": rows,
    }
    json.dump(out, open(a.out, "w", encoding="utf-8"), indent=1)
    print(json.dumps({k: out[k] for k in
                      ("items", "engine_searches", "negative_regrets",
                       "followed_the_rule", "declined_the_rule")}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
