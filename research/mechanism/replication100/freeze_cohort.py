"""
PHASE 9 -- freeze the cohort before the first position of the first member is scored.

Selecting members while results arrive lets a cohort drift toward whatever the early results looked
like, without anybody intending it. This closes the door: the membership list, each member's window,
each member's derived band, the hash of each frozen corpus and of each per-player pre-registration
are written once and hashed together.

    python freeze_cohort.py [--out COHORT_FROZEN.json]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
import corpus as corpuslib  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "COHORT_FROZEN.json"))
    a = ap.parse_args()

    pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
    sel = json.load(open(os.path.join(HERE, "COHORT_SELECTION.json")))
    freeze = json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))
    if sel["prereg_hash"] != pre["prereg_hash"]:
        raise SystemExit("the selection ran under a different pre-registration; refusing to freeze")
    want = pre["denominators"]["BROAD_POWERED"]["n"]
    if len(sel["accepted"]) != want:
        raise SystemExit("selection holds %d members, the pre-registration declares %d; refusing "
                         "to freeze a cohort of the wrong size" % (len(sel["accepted"]), want))

    members = []
    for m in sel["accepted"]:
        d = os.path.join(REPO, m["run_dir"])
        res = json.load(open(os.path.join(d, "report", "RESULT.json")))
        if res.get("status") != "FROZEN":
            raise SystemExit("%s is not at FREEZE (status %s): a cohort may not be frozen around a "
                             "member that has already been scored" % (m["u"], res.get("status")))
        members.append({
            **{k: m[k] for k in ("u", "player_id", "run_dir", "window", "window_class",
                                 "admissible", "blitz_admissible", "speeds", "blitz_median",
                                 "derived_band", "screen_predicted_band", "screen_band_agreed")},
            "raw_sha256": json.load(open(os.path.join(d, "raw", "fetch.json")))["fetch"]["sha256"],
            "manifest_sha256": corpuslib.sha256_file(os.path.join(d, "manifest.json")),
            "prereg_sha256": corpuslib.sha256_file(
                os.path.join(d, "REPLICATION_PREREG.json")),
        })

    doc = {
        "_what": "The frozen 100-player cohort. Written before any member was scored.",
        "frozen_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repo_sha": corpuslib.repo_sha(),
        "prereg_hash": pre["prereg_hash"],
        "instrument_hash": freeze["instrument_hash"],
        "frame_hash": sel["frame_hash"],
        "seed": sel["seed"],
        "n_members": len(members),
        "n_residual_class": sum(1 for m in members if m["window_class"] == "RESIDUAL"),
        "selection_walk": {"walked": sel["cursor"],
                           "prefiltered_without_a_fetch": sel.get("prefiltered", {}),
                           "fetched": len(sel["accepted"]) + len(sel["rejected"]),
                           "rejected_after_fetch": len(sel["rejected"]),
                           "rejection_reasons": _by_reason(sel["rejected"])},
        "screen_band_agreement": {
            "agreed": sum(1 for m in members if m["screen_band_agreed"]),
            "of": len(members),
            "_note": "how often the metadata screen's predicted band matched the band the frozen "
                     "window actually derives, among ACCEPTED members. Rejected candidates are in "
                     "COHORT_SELECTION.json and carry the same comparison.",
        },
        "members": members,
    }
    doc["cohort_hash"] = hashlib.sha256(
        json.dumps({k: v for k, v in doc.items() if k not in ("cohort_hash", "frozen_at")},
                   sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    json.dump(doc, open(a.out, "w"), indent=1, default=str)
    print(json.dumps({"out": a.out, "cohort_hash": doc["cohort_hash"],
                      "n_members": doc["n_members"],
                      "n_residual_class": doc["n_residual_class"],
                      "walked": doc["selection_walk"]["walked"],
                      "fetched": doc["selection_walk"]["fetched"],
                      "rejection_reasons": doc["selection_walk"]["rejection_reasons"],
                      "screen_band_agreement": doc["screen_band_agreement"]}, indent=1))
    return 0


def _by_reason(rows: list) -> dict:
    out: dict[str, int] = {}
    for r in rows:
        out[r["reason"]] = out.get(r["reason"], 0) + 1
    return out


if __name__ == "__main__":
    raise SystemExit(main())
