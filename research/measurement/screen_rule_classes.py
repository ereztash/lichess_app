"""
THE SCREEN: does the trigger determine a correct action, and does it stop determining one when
the trigger is absent?

This is a question about CHESS, not about people, and it is answered before anybody is recruited.
The stop rule it serves, in the owner's words:

    before a human pilot, find at least one candidate where, on a large unfiltered corpus,
        P(B_valid | T+)  >>  P(B_valid | T-)
    and where B does not fall apart when checked from outside, the way `capture(target)` did.

`B_valid` is measured from OUTSIDE the rule: the engine's own best move is asked whether it
satisfies B. The rule never gets to grade itself.

NO THRESHOLD IS INVENTED. Two anchors are measured under this identical harness --
`RC-00 mate-in-one` as a ceiling and `RC-01 loose-piece`, the refuted incumbent, as a floor -- and
every candidate is placed between them. "Closer to the ceiling than to the floor" is a comparison
between measurements. "Above 0.8" would have been a number somebody made up.

THREE GUARDS, because a screen that can be gamed is not a screen:

  prescription_size   the share of legal moves that satisfy B. A rule satisfied by most of the
                      position's moves scores well on B_valid for no good reason, and this is the
                      number that exposes it.
  no_satisfying_move  items where nothing at all satisfies B. Not an error -- a fact about the
                      prescription -- and counted rather than dropped.
  exchangeability     the F2 problem does not go away because the rule class changed. Standardized
                      mean differences between T+ and T- are computed for every candidate.

    python screen_rule_classes.py --items rc.jsonl --engine ./stockfish \\
        --sample 250 --nodes 200000 --workers 4 --seed 20260831 --out screen.json
"""

from __future__ import annotations

import argparse
import collections
import json
import multiprocessing as mp
import random
import sys
from pathlib import Path

import chess
import chess.engine

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rule_classes import BY_ID, RULE_CLASSES, STRUCTURALLY_REJECTED, Context  # noqa: E402
from sdt import Counts, compute, wilson_interval, standardized_mean_difference  # noqa: E402

#: Mate scores are not centipawns. `mate_score` encodes them as a ceiling so that a difference is
#: computable at all; a cp loss involving a mate is a comparison against that ceiling and not a
#: material quantity. Reported, never smoothed away.
MATE_SCORE = 100_000

COVARIATES = [
    "n_legal_moves", "n_legal_captures", "n_checks_available", "n_forcing_moves",
    "piece_count", "material_balance", "total_material", "fullmove_number",
]

RATING_BANDS = [(0, 1200), (1200, 1400), (1400, 1600), (1600, 1800), (1800, 3500)]


def rate(k: int, n: int) -> dict:
    lo, hi = wilson_interval(k, n)
    return {"k": k, "n": n, "p": (k / n) if n else None, "ci95": [lo, hi]}


def _ctx_of(rec: dict) -> Context:
    prev = rec.get("prev_move")
    return Context(
        prev_move=chess.Move.from_uci(prev) if prev else None,
        prev_was_capture=bool(rec.get("prev_was_capture", 0)),
    )


def _adjudicate_chunk(args) -> list[dict]:
    """One worker: its own engine, its own slice of items, no shared state."""
    engine_path, nodes, chunk = args
    # TIMEOUT RAISED FROM THE 10s DEFAULT, and the first run is why. Six single-threaded engines
    # on four cores means a 200,000-node search can take longer in wall time than it takes in
    # work, and python-chess treats a slow REPLY as a dead engine. The node budget is what makes
    # the numbers comparable with the first study, so the budget stays and the patience changes.
    engine = chess.engine.SimpleEngine.popen_uci(engine_path, timeout=600.0)
    engine.configure({"Threads": 1, "Hash": 64})
    limit = chess.engine.Limit(nodes=nodes)
    out = []
    try:
        build = engine.id.get("name", "unknown")
        for rec in chunk:
            rc = BY_ID[rec["rule_class"]]
            board = chess.Board(rec["fen"])
            ctx = _ctx_of(rec)
            satisfying = rc.satisfying_moves(board, ctx)
            legal = board.legal_moves.count()

            try:
                info = engine.analyse(board, limit)
            except chess.engine.EngineError as exc:
                # ONE BAD POSITION MAY NOT DESTROY 3,500 SEARCHES. It is recorded as a failure
                # with its reason and excluded from the rates, where a later reader can see how
                # many there were rather than wondering why a denominator moved.
                out.append({
                    "rule_class": rec["rule_class"], "trigger_state": rec["trigger_state"],
                    "fen": rec["fen"], "engine_failed": str(exc),
                })
                continue
            pv = info.get("pv") or []
            best = pv[0] if pv else None
            best_cp = info["score"].pov(board.turn).score(mate_score=MATE_SCORE)

            row = {
                "rule_class": rec["rule_class"],
                "trigger_state": rec["trigger_state"],
                "fen": rec["fen"],
                "engine_build": build,
                "engine_nodes": nodes,
                "engine_best_move": best.uci() if best else None,
                "engine_best_cp": best_cp,
                "n_legal": legal,
                "n_satisfying": len(satisfying),
                "prescription_size": (len(satisfying) / legal) if legal else None,
                "observable_action": rec["observable_action"],
                "actor_elo": rec["actor_elo"],
                **{c: rec[c] for c in COVARIATES if c in rec},
            }

            if not satisfying:
                # NOT AN ERROR AND NOT DROPPED. "Nothing the player could have done satisfies this
                # rule" is a fact about the prescription, and a screen that silently discarded
                # these would report a cleaner rule than the one that exists.
                row["b_valid"] = 0
                row["no_satisfying_move"] = 1
                row["best_satisfying_cp"] = None
                row["cp_loss_of_following_the_rule"] = None
            else:
                row["no_satisfying_move"] = 0
                row["b_valid"] = int(best is not None and best in satisfying)
                sub = engine.analyse(board, limit, root_moves=satisfying)
                sub_cp = sub["score"].pov(board.turn).score(mate_score=MATE_SCORE)
                row["best_satisfying_cp"] = sub_cp
                row["cp_loss_of_following_the_rule"] = (
                    None if best_cp is None or sub_cp is None else best_cp - sub_cp
                )
            out.append(row)
    finally:
        engine.quit()
    return out


def _median(xs):
    xs = sorted(x for x in xs if x is not None)
    return xs[len(xs) // 2] if xs else None


def _quartiles(xs):
    xs = sorted(x for x in xs if x is not None)
    if len(xs) < 4:
        return None
    return [xs[len(xs) // 4], xs[3 * len(xs) // 4]]


def _cell(rows: list[dict]) -> dict:
    n = len(rows)
    losses = [r["cp_loss_of_following_the_rule"] for r in rows]
    sizes = [r["prescription_size"] for r in rows if r["prescription_size"] is not None]
    return {
        "n": n,
        "b_valid": rate(sum(r["b_valid"] for r in rows), n),
        "no_satisfying_move": rate(sum(r["no_satisfying_move"] for r in rows), n),
        "cp_loss_median": _median(losses),
        "cp_loss_q1_q3": _quartiles(losses),
        "following_the_rule_loses_100cp_or_more": rate(
            sum(1 for v in losses if v is not None and v >= 100),
            sum(1 for v in losses if v is not None),
        ),
        "prescription_size_mean": (sum(sizes) / len(sizes)) if sizes else None,
        "prescription_size_median": _median(sizes),
    }


def _player_sdt(items: list[dict]) -> dict:
    """
    Secondary, and deliberately second. Whether PLAYERS discriminate is not the question this
    screen answers; it is the question that only becomes askable once a rule class passes.
    """
    h = m = fa = cr = 0
    for r in items:
        b = r["observable_action"]
        if r["trigger_state"] == "positive":
            h += b
            m += 1 - b
        else:
            fa += b
            cr += 1 - b
    c = Counts(h, m, fa, cr)
    if c.signal_trials == 0 or c.noise_trials == 0:
        return {"error": "one cell empty"}
    s = compute(c)
    bands = {}
    for lo, hi in RATING_BANDS:
        band = [r for r in items if lo <= r["actor_elo"] < hi]
        hh = sum(r["observable_action"] for r in band if r["trigger_state"] == "positive")
        nn = sum(1 for r in band if r["trigger_state"] == "positive")
        ff = sum(r["observable_action"] for r in band if r["trigger_state"] == "negative")
        mm = sum(1 for r in band if r["trigger_state"] == "negative")
        if nn >= 100 and mm >= 100:
            bs = compute(Counts(hh, nn - hh, ff, mm - ff))
            bands[f"{lo}-{hi}"] = {"d_prime": bs.d_prime, "criterion_c": bs.criterion_c,
                                   "n_t_plus": nn, "n_t_minus": mm}
    ds = [v["d_prime"] for v in bands.values()]
    return {
        "hit_rate": s.hit_rate, "false_alarm_rate": s.false_alarm_rate,
        "d_prime": s.d_prime, "criterion_c": s.criterion_c,
        "n_t_plus": c.signal_trials, "n_t_minus": c.noise_trials,
        "by_rating_band": bands,
        "d_prime_monotone_in_rating": (
            all(b >= a for a, b in zip(ds, ds[1:])) if len(ds) >= 3 else None
        ),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--sample", type=int, default=250)
    ap.add_argument("--nodes", type=int, default=200_000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    items = [json.loads(l) for l in open(a.items, encoding="utf-8")]
    manifest = json.load(open(a.manifest, encoding="utf-8"))
    sampled_positions = manifest["positions_sampled"]
    in_check_positions = manifest["positions_in_check"]

    rng = random.Random(a.seed)
    by_class = collections.defaultdict(list)
    for r in items:
        by_class[r["rule_class"]].append(r)

    to_adjudicate: list[dict] = []
    populations: dict[str, dict] = {}
    for rc in RULE_CLASSES:
        # THE EXCLUSION IS APPLIED PER CANDIDATE, not globally. Everything but RC-03 is read on
        # positions where the side to move is NOT in check -- a forced reply is not a free
        # choice -- and RC-03 exists only in the positions that rule removes.
        wants_check = rc.id == "RC-03"
        pool = [r for r in by_class[rc.id] if bool(r["in_check"]) == wants_check]
        denom = in_check_positions if wants_check else sampled_positions - in_check_positions
        pos = [r for r in pool if r["trigger_state"] == "positive"]
        neg = [r for r in pool if r["trigger_state"] == "negative"]
        populations[rc.id] = {
            "denominator_positions": denom,
            "denominator_is": "in-check positions" if wants_check else "not-in-check positions",
            "base_rate_t_plus": rate(len(pos), denom),
            "base_rate_t_minus": rate(len(neg), denom),
            "pool": pool,
        }
        for cell in (pos, neg):
            to_adjudicate.extend(rng.sample(cell, min(a.sample, len(cell))))

    print(f"adjudicating {len(to_adjudicate)} positions on {a.workers} engines", file=sys.stderr)
    chunks = [to_adjudicate[i::a.workers] for i in range(a.workers)]
    with mp.Pool(a.workers) as pool_:
        results = pool_.map(_adjudicate_chunk, [(a.engine, a.nodes, c) for c in chunks])
    adjudicated = [row for part in results for row in part]

    engine_failures = [r for r in adjudicated if "engine_failed" in r]
    adjudicated = [r for r in adjudicated if "engine_failed" not in r]
    by_rc = collections.defaultdict(list)
    for row in adjudicated:
        by_rc[row["rule_class"]].append(row)

    report = {}
    for rc in RULE_CLASSES:
        rows = by_rc[rc.id]
        pos = [r for r in rows if r["trigger_state"] == "positive"]
        neg = [r for r in rows if r["trigger_state"] == "negative"]
        pop = populations[rc.id]

        if not pos or not neg:
            report[rc.id] = {
                "name": rc.name, "family": rc.family, "role": rc.role,
                "verdict": "UNTESTED",
                "why": "no items in one of the two cells under this candidate's exclusion",
                "base_rate_t_plus": pop["base_rate_t_plus"],
                "base_rate_t_minus": pop["base_rate_t_minus"],
                "caveats": rc.caveats,
            }
            continue

        p_plus = _cell(pos)
        p_minus = _cell(neg)
        bal = {}
        for c in COVARIATES:
            aa = [r[c] for r in pop["pool"] if r["trigger_state"] == "positive" and c in r]
            bb = [r[c] for r in pop["pool"] if r["trigger_state"] == "negative" and c in r]
            if len(aa) > 1 and len(bb) > 1:
                bal[c] = standardized_mean_difference(aa, bb)

        report[rc.id] = {
            "name": rc.name,
            "family": rc.family,
            "role": rc.role,
            "prescription": rc.prescription,
            "c1_trigger_precedes_behaviour": "enforced by signature",
            "c2_b_directly_observable": "enforced by signature",
            "c3_grade": rc.c3_grade,
            "c4_prescriptive_validity": {
                "t_plus": p_plus,
                "t_minus": p_minus,
                "separation_b_valid": (
                    p_plus["b_valid"]["p"] - p_minus["b_valid"]["p"]
                    if p_plus["b_valid"]["p"] is not None and p_minus["b_valid"]["p"] is not None
                    else None
                ),
                "contextual_exception_rate_t_plus": (
                    1 - p_plus["b_valid"]["p"] if p_plus["b_valid"]["p"] is not None else None
                ),
            },
            "c5_same_action_available_in_t_minus": {
                "t_minus_items_with_no_satisfying_move": p_minus["no_satisfying_move"],
                "enforced": "a position where the prescribed act is unavailable is not an item",
            },
            "c6_exchangeability_smd": bal,
            "c6_max_abs_smd": max((abs(v) for v in bal.values()), default=None),
            "c7_no_engine_in_b": True,
            "c8_literature": rc.literature,
            "c9_base_rate": {
                "t_plus": pop["base_rate_t_plus"],
                "t_minus": pop["base_rate_t_minus"],
                "denominator_is": pop["denominator_is"],
            },
            "player_behaviour_secondary": _player_sdt(pop["pool"]),
            "caveats": rc.caveats,
        }

    ceiling = report["RC-00"]["c4_prescriptive_validity"]["separation_b_valid"]
    floor = report["RC-01"]["c4_prescriptive_validity"]["separation_b_valid"]
    for rid, r in report.items():
        sep = r.get("c4_prescriptive_validity", {}).get("separation_b_valid")
        if sep is None or ceiling is None or floor is None or ceiling == floor:
            r["position_between_anchors"] = None
            continue
        # 0 = at the refuted incumbent, 1 = at the sharpest rule class chess allows.
        r["position_between_anchors"] = (sep - floor) / (ceiling - floor)

    out = {
        "screen_version": "1.0.0",
        "engine": {"nodes": a.nodes, "workers": a.workers,
                   "build": adjudicated[0]["engine_build"] if adjudicated else None},
        "sample_per_cell": a.sample,
        "engine_failures": len(engine_failures),
        "seed": a.seed,
        "corpus": {
            "positions_sampled": sampled_positions,
            "positions_in_check": in_check_positions,
            "games": manifest["games_used"],
            "source": manifest["pgn"],
        },
        "anchors": {"ceiling": "RC-00", "floor": "RC-01",
                    "ceiling_separation": ceiling, "floor_separation": floor},
        "rule_classes": report,
        "structurally_rejected": STRUCTURALLY_REJECTED,
        "determinism": (
            "Stockfish runs with Threads 1 at a fixed node budget, so a position's result does "
            "not depend on which worker took it or on how many workers ran."
        ),
    }
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, default=str)
    for rid, r in report.items():
        if "c4_prescriptive_validity" not in r:
            print(f"{rid} {r['name']:26s} {r['verdict']}")
            continue
        c4 = r["c4_prescriptive_validity"]
        print(
            f"{rid} {r['name']:26s} "
            f"B_valid T+={c4['t_plus']['b_valid']['p']:.3f} T-={c4['t_minus']['b_valid']['p']:.3f} "
            f"sep={c4['separation_b_valid']:+.3f} "
            f"anchor={r['position_between_anchors']:.2f} "
            f"presc={c4['t_plus']['prescription_size_mean']:.3f} "
            f"base+={r['c9_base_rate']['t_plus']['p']:.4f}"
        )


if __name__ == "__main__":
    main()
