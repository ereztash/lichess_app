"""
Does the retrieval bound change a corpus? Measured, not argued.

`ingest_lichess.py` caps how many of a player's most recent games are downloaded. It sits outside
the seventeen files the pipeline hash covers, and that is only honest while the bound cannot change
which games form a corpus. The argument is:

    the export returns games newest-first and `--window N` keeps the newest N ADMISSIBLE games, so
    whenever the window FILLS its games are the newest N admissible either way -- an unbounded fetch
    adds only OLDER games and the window discards them.

This tests it. One player, fetched twice: once with the bound the cohort walk uses, once with no
bound at all. Same window, same eligibility. The admissible game ids must be identical, and so must
the blitz median the band is derived from.

    python check_bound_invariant.py --username <name> --window 2200 --bound 4583
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import statistics
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
sys.path.insert(0, HERE)
import corpus as corpuslib  # noqa: E402
from cohort_select import blitz_median_from_admissible  # noqa: E402

PY = os.environ.get("REPLICATION_PYTHON", sys.executable)


def one(username: str, window: int, bound: int | None, root: str, tag: str) -> dict:
    env = dict(os.environ)
    env.pop("REPLICATION_FETCH_MAX_GAMES", None)
    if bound is not None:
        env["REPLICATION_FETCH_MAX_GAMES"] = str(bound)
    t0 = time.time()
    subprocess.run([PY, os.path.join(REPL, "run.py"), "--platform", "lichess",
                    "--username", username, "--ingest-mode", "api-user-export",
                    "--run-id", tag, "--window", str(window), "--stop-after", "FREEZE",
                    "--root", root], check=True, capture_output=True, text=True, env=env, timeout=3600)
    d = corpuslib.run_dir("lichess", username, tag, root)
    res = json.load(open(os.path.join(d, "report", "RESULT.json")))
    ids, blitz = [], 0
    with open(os.path.join(d, "admissible", "games.ndjson")) as f:
        for line in f:
            g = json.loads(line)
            ids.append(g["id"])
            if g.get("speed") == "blitz":
                blitz += 1
    med = blitz_median_from_admissible(os.path.join(d, "admissible", "games.ndjson"),
                                       res["focal"]["player_id"])
    return {"bound": bound, "seconds": round(time.time() - t0, 1),
            "fetched": res["corpus"]["fetched"], "admissible": res["corpus"]["admissible"],
            "blitz_admissible": blitz, "window_full": res["corpus"]["admissible"] >= window,
            "blitz_median": med, "ids": ids,
            "ids_sha256": corpuslib.sha256_json(ids)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--username", required=True)
    ap.add_argument("--window", type=int, required=True)
    ap.add_argument("--bound", type=int, required=True)
    ap.add_argument("--out", default=os.path.join(HERE, "BOUND_INVARIANT.json"))
    a = ap.parse_args()

    root = tempfile.mkdtemp(prefix="boundcheck_")
    try:
        bounded = one(a.username, a.window, a.bound, root, "BOUNDCHK_B")
        full = one(a.username, a.window, None, root, "BOUNDCHK_F")
    finally:
        pass
    same_ids = bounded["ids"] == full["ids"]
    same_med = bounded["blitz_median"] == full["blitz_median"]
    doc = {
        "_what": "Whether the retrieval bound changes the corpus. One player, fetched twice: once "
                 "with the bound the cohort walk uses, once with none.",
        "_invariant": "a bound can only change a corpus whose window did not fill, because an "
                      "unbounded fetch adds only games older than the window keeps",
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repo_sha": corpuslib.repo_sha(),
        "username": a.username, "window": a.window, "bound": a.bound,
        "bounded": {k: v for k, v in bounded.items() if k != "ids"},
        "unbounded": {k: v for k, v in full.items() if k != "ids"},
        "identical_admissible_ids": same_ids,
        "identical_blitz_median": same_med,
        "both_windows_full": bounded["window_full"] and full["window_full"],
        "result": "PASS" if (same_ids and same_med) else "FAIL",
        "transfer_saved": {"games": full["fetched"] - bounded["fetched"],
                           "seconds": round(full["seconds"] - bounded["seconds"], 1)},
    }
    json.dump(doc, open(a.out, "w"), indent=1)
    shutil.rmtree(root, ignore_errors=True)
    print(json.dumps({k: v for k, v in doc.items() if not k.startswith("_")}, indent=1))
    return 0 if doc["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
