"""
PHASES 11, 12 -- the one-command cohort runner.

Runs the frozen instrument over every frozen cohort member, in the committed order, with no
per-player decisions. It reads COHORT_FROZEN.json and nothing else about who to run; it never reads
a result to decide anything.

Resumable by construction: each member is an independent run directory, a member whose RESULT.json
already carries a terminal status is skipped, and an interrupted member is re-run from its cached
raw corpus. Resuming reads only whether a run FINISHED, never what it found.

    python cohort_run.py [--workers 4] [--limit N]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
import contract          # noqa: E402
import populations       # noqa: E402

PY = os.environ.get("REPLICATION_PYTHON", sys.executable)
RUN_ID = "COHORT"


def status_of(run_dir: str) -> str | None:
    p = os.path.join(REPO, run_dir, "report", "RESULT.json")
    if not os.path.exists(p):
        return None
    s = json.load(open(p)).get("status")
    return s if s in contract.TERMINAL_STATES else None


def band_agreement(run_dir: str, selection_band: list) -> dict:
    """The selection derived a band from admissible games; the pipeline derives one from the scored
    decisions. Two implementations of one rule, so the disagreement is measured rather than assumed
    away. A mismatch is a defect and is recorded as one; neither answer is preferred."""
    p = os.path.join(REPO, run_dir, "analysis", "population_resolution.json")
    if not os.path.exists(p):
        return {"checked": False}
    r = json.load(open(p))
    return {"checked": True, "selection_band": selection_band, "pipeline_band": r.get("band"),
            "agree": r.get("band") == selection_band,
            "pipeline_median": r.get("focal_blitz_median_rating")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--out", default=os.path.join(HERE, "COHORT_PROGRESS.json"))
    a = ap.parse_args()

    frozen = json.load(open(os.path.join(HERE, "COHORT_FROZEN.json")))
    pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
    if frozen["prereg_hash"] != pre["prereg_hash"]:
        raise SystemExit("COHORT_FROZEN was taken under a different pre-registration; refusing")

    members = frozen["members"]
    prog = (json.load(open(a.out)) if os.path.exists(a.out) else {
        "_what": "Which cohort members have been run. Records completion, never a finding.",
        "prereg_hash": pre["prereg_hash"], "cohort_hash": frozen["cohort_hash"],
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "members": {}})
    if prog["cohort_hash"] != frozen["cohort_hash"]:
        raise SystemExit("the frozen cohort changed under a run in progress; refusing")

    done = 0
    for i, m in enumerate(members):
        u = m["u"]
        already = status_of(m["run_dir"])
        if already:
            prog["members"].setdefault(u, {})["status"] = already
            prog["members"][u]["band_check"] = band_agreement(m["run_dir"], m["derived_band"])
            continue
        if a.limit is not None and done >= a.limit:
            break
        t0 = time.time()
        print(f"[{i+1}/{len(members)}] {u} ({m['window_class']}, window {m['window']})",
              flush=True)
        cmd = [PY, os.path.join(REPL, "run.py"), "--platform", "lichess", "--username", u,
               "--ingest-mode", "api-user-export", "--run-id", RUN_ID,
               "--window", str(m["window"]), "--workers", str(a.workers)]
        # The raw fetch is cached by run.py, so this reuses the corpus the freeze took rather than
        # refetching one that could differ.
        p = subprocess.run(cmd, capture_output=True, text=True)
        st = status_of(m["run_dir"])
        prog["members"][u] = {"status": st or "RUN_FAILED",
                              "seconds": round(time.time() - t0, 1),
                              "band_check": band_agreement(m["run_dir"], m["derived_band"])}
        if st is None:
            prog["members"][u]["stderr"] = (p.stderr or "")[-600:]
        prog["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        json.dump(prog, open(a.out, "w"), indent=1)
        done += 1

    prog["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    counts: dict[str, int] = {}
    for v in prog["members"].values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    prog["counts"] = counts
    prog["complete"] = len(prog["members"]) >= len(members) and "RUN_FAILED" not in counts
    mism = [u for u, v in prog["members"].items()
            if v.get("band_check", {}).get("checked") and not v["band_check"]["agree"]]
    prog["band_disagreements"] = mism
    json.dump(prog, open(a.out, "w"), indent=1)
    print(json.dumps({"out": a.out, "members": len(members), "recorded": len(prog["members"]),
                      "counts": counts, "band_disagreements": len(mism),
                      "complete": prog["complete"]}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
