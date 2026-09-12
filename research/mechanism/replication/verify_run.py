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

# A cohort is frozen BEFORE anything is scored (Phase 9), so between the freeze and the run its
# members legitimately sit at FROZEN, with no population resolution and no report. That is the
# protocol, not a defect, and the verifier has to be able to say so. It is not a loophole: a run may
# only be FROZEN if a COHORT_FROZEN.json lists it, so an abandoned run is still a problem.
COHORT_FROZEN = os.path.join(os.path.dirname(HERE), "replication100", "COHORT_FROZEN.json")
# What a run at FREEZE cannot have yet, because the stages that write them have not run.
NOT_YET_AT_FREEZE = ("splits.json", "analysis/population_resolution.json", "report/REPORT.md")
# A member is named by the frozen cohort once it exists, and by the selection walk before that.
# Either naming is a committed artefact, so an ABANDONED run at FREEZE is still a problem.
COHORT_SELECTION = os.path.join(os.path.dirname(HERE), "replication100", "COHORT_SELECTION.json")


def frozen_cohort_members() -> set[str]:
    out: set[str] = set()
    for path, key in ((COHORT_FROZEN, "members"), (COHORT_SELECTION, "accepted")):
        if not os.path.exists(path):
            continue
        try:
            doc = json.load(open(path))
        except Exception:  # noqa: BLE001  a walk rewrites its state; a torn read is not a verdict
            continue
        for m in doc.get(key, []):
            if m.get("run_dir"):
                out.add(os.path.normpath(m["run_dir"]))
    return out


def in_frozen_cohort(run_dir: str) -> bool:
    repo = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
    return os.path.normpath(os.path.relpath(os.path.abspath(run_dir), repo)) \
        in frozen_cohort_members()


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
    result_path = os.path.join(run_dir, "report", "RESULT.json")
    state = json.load(open(result_path)) if os.path.exists(result_path) else {}
    out["status"] = state.get("status")
    # A member of a frozen, not-yet-scored cohort. Everything the freeze itself produces is still
    # required; only what the scoring stages write is excused, and only for these runs.
    awaiting = state.get("status") == "FROZEN" and in_frozen_cohort(run_dir)
    out["awaiting_cohort_run"] = awaiting

    for rel, what in REQUIRED.items():
        ok = os.path.exists(os.path.join(run_dir, rel))
        out["present"][rel] = ok
        if not ok and not (awaiting and rel in NOT_YET_AT_FREEZE):
            out["problems"].append(f"missing {rel} ({what})")

    terminal = state.get("status") in contract.TERMINAL_STATES
    if not terminal and not awaiting:
        out["problems"].append(f"status {state.get('status')!r} is not one of the contract's terminal states")

    # the analysis stages are required only for a run that reached a class where they are produced
    needs_stages = (not awaiting
                    and state.get("status") in ("LEVEL_TYPICAL_ONLY", "PERSONAL_RESIDUAL_CANDIDATE"))
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
