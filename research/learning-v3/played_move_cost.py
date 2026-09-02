"""
WHAT DID THE 42.5% ACTUALLY DO, AND DID IT COST THEM ANYTHING?

`compute_value.json` §7 reports that real players promoted to a safe square on **.575** of RC-05's
trigger-positive items. A gap of 42.5% is only a learning target if the moves in it were WORSE. A
player who declined to promote because they had a mate in two did not fail to apply a rule; they
applied a better one.

The corpus cannot answer this, and the reason is exact: `action_set.py` evaluated `V_B`, `V_notB`
and every member of `B`, and **the played move is usually not in `B`** on precisely the items in
question -- that is what makes them the gap. So the played move's value was never searched. This is
the one line in `COMPUTE_VALUE_EXTRACTION.md` §3 that is cheap to close: ONE root-restricted search
per item, against values already in the cache.

    regret_played = V*(s) - U(s, played)

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
from cache import lookup  # noqa: E402
from rule_classes import BY_ID, Context  # noqa: E402

RC = "RC-05"
MATE_SCORE = 100_000


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

    rows, reused, searched, failed = [], 0, 0, 0
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

        # V* comes from the cache where the position was adjudicated; only the PLAYED move is new.
        cached = lookup(r["fen"], [played.uci()], "multipv-over-B")
        if cached and cached.get("xs") is not None:
            u_xs, u_cp = cached["xs"], cached["cp"]
            reused += 1
        else:
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

        rows.append({
            "fen": r["fen"],
            "move_played": played.uci(),
            "satisfies_rule": bool(satisfies),
            "regret_played_xs": v_star_xs - u_xs,
            "regret_played_cp": (None if abs(u_cp) >= MATE_SCORE or abs(v_star_cp) >= MATE_SCORE
                                 else v_star_cp - u_cp),
            "actor_elo": r.get("actor_elo"),
        })
    engine.quit()

    followed = [x for x in rows if x["satisfies_rule"]]
    declined = [x for x in rows if not x["satisfies_rule"]]

    def summarise(xs: list[dict]) -> dict:
        rs = sorted(x["regret_played_xs"] for x in xs)
        if not rs:
            return {}
        return {
            "n": len(rs),
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
        "evaluations_reused_from_cache": reused,
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
                      ("items", "engine_searches", "evaluations_reused_from_cache",
                       "followed_the_rule", "declined_the_rule")}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
