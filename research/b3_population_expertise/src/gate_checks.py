"""Evidence for the two INVALID conditions that used to be literals in `run.py`.

`VERDICT_RULES.md` §2.1.1 (leakage) and §2.1.8 (engine nondeterminism) are conditions of the
strongest failure verdict, and `run.py` was writing `True` and `False` for them by hand. A condition
fed a constant is not a condition. This records what actually happened:

  * the leakage suite, run and its exit status recorded -- both perturbations, the played-move swap
    and the game-suffix replacement;
  * a same-budget re-score of a fixed subset of already-scored decisions, compared field by field
    against what the corpus holds. `rescore.py` changes the budget and therefore cannot answer this;
    the question here is whether the SAME search, run again in a fresh process, gives the same
    answer.

An absent `gate_checks.json` reads as leakage-failed and nondeterminism-detected, because absent
evidence is a failure and not a pass.

Run:  python src/gate_checks.py --period development --sample 300
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time

import chess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dataset  # noqa: E402
from common import require_seal_for, unit_hash  # noqa: E402
from engine import Engine  # noqa: E402
from position_features import MULTIPV, engine_features  # noqa: E402
from quality import quality_from  # noqa: E402
from value_of_computation import voc_features  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = 20260901
COMPARED = ["wp1", "gap12", "gap1k", "ambiguity_entropy", "n_near", "best_move_changes",
            "eval_volatility", "pv_instability", "final_depth", "voc_switch", "voc_regret",
            "voc_drift", "voc_rank", "quality_loss", "accurate"]


def run_leakage_suite() -> dict:
    started = time.time()
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_leakage.py", "tests/test_suffix_leakage.py",
         "tests/test_ports.py", "-q"],
        cwd=ROOT, capture_output=True, text=True,
    )
    return {
        "passed": result.returncode == 0,
        "exit_code": result.returncode,
        "tail": result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "",
        "seconds": round(time.time() - started, 1),
    }


def redetermine(period_dir: str, sample: int, binary: str, nodes: int) -> dict:
    """Re-score a fixed subset at the SAME budget in a fresh process and compare, field by field."""
    frame = dataset.load(period_dir)
    rows = frame.to_dict("records")
    rows.sort(key=lambda r: unit_hash(SEED, "determinism", str(r["game_id"]), str(r["ply"])))
    rows = rows[:sample]
    engine = Engine(binary, multipv=MULTIPV)
    mismatches = []
    try:
        for row in rows:
            board = chess.Board(row["fen_before"])
            before = engine.search(board.fen(), nodes)
            complete = before.complete(min(MULTIPV, int(row["legal_moves"])))
            if not complete:
                mismatches.append({"game_id": row["game_id"], "ply": row["ply"],
                                   "field": "search", "reason": "no complete iteration"})
                continue
            after_board = board.copy()
            after_board.push(chess.Move.from_uci(row["move_uci"]))
            after = engine.search(after_board.fen(), nodes)
            fresh = {**engine_features(complete[-1], complete), **voc_features(complete)}
            scored = quality_from(after, after_board, fresh["wp1"])
            if scored:
                fresh.update(scored)
            for field in COMPARED:
                a, b = row.get(field), fresh.get(field)
                if a is None or b is None:
                    continue
                if abs(float(a) - float(b)) > 1e-9:
                    mismatches.append({"game_id": row["game_id"], "ply": int(row["ply"]),
                                       "field": field, "recorded": float(a), "rerun": float(b)})
    finally:
        engine.quit()
    return {
        "decisions_rescored": len(rows),
        "fields_compared": COMPARED,
        "mismatches": mismatches[:20],
        "mismatch_count": len(mismatches),
        "deterministic": not mismatches,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", default="development")
    ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    ap.add_argument("--results", default=os.path.join(ROOT, "results"))
    ap.add_argument("--sample", type=int, default=300)
    ap.add_argument("--nodes", type=int, default=60000)
    ap.add_argument("--binary", default="/opt/b3/stockfish-17.1-avx2")
    args = ap.parse_args()

    require_seal_for(args.period)
    leakage = run_leakage_suite()
    determinism = redetermine(os.path.join(args.data, args.period), args.sample, args.binary,
                              args.nodes)
    out = {
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "period_rescored": args.period,
        "leakage_tests_passed": leakage["passed"],
        "leakage": leakage,
        "engine_nondeterminism_detected": not determinism["deterministic"],
        "determinism": determinism,
    }
    os.makedirs(args.results, exist_ok=True)
    json.dump(out, open(os.path.join(args.results, "gate_checks.json"), "w"), indent=1)
    print(json.dumps({k: out[k] for k in
                      ("leakage_tests_passed", "engine_nondeterminism_detected")}, indent=1))
    print(f"re-scored {determinism['decisions_rescored']} decisions, "
          f"{determinism['mismatch_count']} field mismatches")


if __name__ == "__main__":
    main()
