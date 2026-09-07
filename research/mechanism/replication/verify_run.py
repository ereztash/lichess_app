"""
Is a run directory complete, and does it belong to the code that is checked out now?

A run records the commit it executed on. Committing the run's own artifacts moves the head past that
commit, so `repo_sha` alone can never match afterwards. What must match is the PIPELINE HASH: the
hash over the files that decide research content. If that is equal, the run was produced by exactly
the code now on disk, whatever else has been committed since.

    python verify_run.py --run-dir research/mechanism/replications/<run>
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contract  # noqa: E402
import corpus as corpuslib  # noqa: E402

REQUIRED = {
    "raw/fetch.json": "the source manifest: mode, url, query, retrieval timestamp, sha256",
    "admissible/exclusions.json": "every excluded game, by reason, by id",
    "REPLICATION_PREREG.json": "the self-hashed pre-registration",
    "manifest.json": "the corpus freeze",
    "splits.json": "DERIVE / VALIDATE / TEST membership",
    "analysis/population_resolution.json": "the derived band and the registry entry it matched",
    "report/RESULT.json": "the bounded result",
    "report/REPORT.md": "the report",
}
STAGE_FILES = {
    "R*": "analysis/discovery_OBS_cls_tactical.json",
    "R** primary": f"analysis/discovery_POP_{contract.RESIDUAL_TARGETS[0]}.json",
    "R** secondary": f"analysis/discovery_POP_{contract.RESIDUAL_TARGETS[1]}.json",
    "invariance": "analysis/invariance.json",
    "stability": "analysis/stability_loco.json",
    "TEST": "analysis/predict_test.json",
    "population comparison": "analysis/population.json",
}


def verify(run_dir: str) -> dict:
    out = {"run_dir": run_dir, "problems": [], "present": {}, "optional_absent": {}}
    for rel, what in REQUIRED.items():
        ok = os.path.exists(os.path.join(run_dir, rel))
        out["present"][rel] = ok
        if not ok:
            out["problems"].append(f"missing {rel} ({what})")

    result_path = os.path.join(run_dir, "report", "RESULT.json")
    state = json.load(open(result_path)) if os.path.exists(result_path) else {}
    out["status"] = state.get("status")
    terminal = state.get("status") in contract.TERMINAL_STATES
    if not terminal:
        out["problems"].append(f"status {state.get('status')!r} is not one of the contract's terminal states")

    # the analysis stages are required only for a run that reached a class where they are produced
    needs_stages = state.get("status") in ("LEVEL_TYPICAL_ONLY", "PERSONAL_RESIDUAL_CANDIDATE")
    for name, rel in STAGE_FILES.items():
        ok = os.path.exists(os.path.join(run_dir, rel))
        (out["present"] if needs_stages else out["optional_absent"])[name] = ok
        if needs_stages and not ok:
            out["problems"].append(f"missing stage {name} ({rel})")

    here = corpuslib.pipeline_version()["pipeline_hash"]
    out["pipeline_hash_here"] = here
    out["pipeline_hash_in_run"] = state.get("pipeline_hash")
    out["pipeline_hash_matches"] = (here == state.get("pipeline_hash"))
    if not out["pipeline_hash_matches"]:
        out["problems"].append("the run was produced by different research code than the working tree")

    manifest_path = os.path.join(run_dir, "manifest.json")
    if os.path.exists(manifest_path):
        m = json.load(open(manifest_path))
        out["repo_sha_at_run"] = m.get("repo_sha")
        out["repo_dirty_at_run"] = m.get("repo_dirty")
        if m.get("repo_dirty"):
            out["problems"].append("the working tree was dirty when this run took its manifest")
        if m.get("pipeline_version", {}).get("pipeline_hash") != here:
            out["problems"].append("the manifest's pipeline hash differs from the working tree's")

    prereg_path = os.path.join(run_dir, "REPLICATION_PREREG.json")
    if os.path.exists(prereg_path):
        p = json.load(open(prereg_path))
        stored = p.get("prereg_hash")
        recomputed = corpuslib.sha256_json({k: v for k, v in p.items() if k != "prereg_hash"})
        out["prereg_hash_intact"] = (stored == recomputed)
        out["prereg_repo_sha"] = p.get("repo_sha")
        if stored != recomputed:
            out["problems"].append("the pre-registration's own hash does not match its contents")
        # The manifest is rewritten on every invocation and the pre-registration is written once,
        # so their commits legitimately differ once the run's own artifacts have been committed
        # between invocations. What must not differ is the research code they name.
        out["prereg_pipeline_hash"] = p.get("pipeline_version", {}).get("pipeline_hash")
        if out["prereg_pipeline_hash"] and out["prereg_pipeline_hash"] != here:
            out["problems"].append("the pre-registration names different research code than the working tree")

    out["complete"] = not out["problems"]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-dir", required=True)
    a = ap.parse_args()
    r = verify(a.run_dir)
    print(json.dumps(r, indent=1))
    return 0 if r["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
