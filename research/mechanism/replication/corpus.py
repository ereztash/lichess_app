"""
PHASE 6 -- CORPUS FREEZE.

One directory per player run:

    research/mechanism/replications/<platform>_<username>_<run-id>/
        raw/            what the platform returned, verbatim, hashed
        admissible/     the frozen eligibility contract applied, with every exclusion by reason
        scored/         engine lines, one record per game (research regime)
        features/       one decision row per focal decision
        splits.json     DERIVE / VALIDATE / TEST membership, by game
        analysis/       every stage's JSON
        report/         the bounded report
        manifest.json   this file's product
        REPLICATION_PREREG.json   written and hashed BEFORE the first outcome-bearing stage

The rule the manifest exists to make true:

    same manifest + same code SHA  ==  same research population.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
REPLICATIONS_DIR = os.path.join(REPO_ROOT, "research", "mechanism", "replications")
SUBDIRS = ("raw", "admissible", "scored", "features", "analysis", "report")


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def sha256_json(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":"),
                                     default=str).encode()).hexdigest()


def repo_sha() -> str:
    try:
        return subprocess.check_output(["git", "-C", REPO_ROOT, "rev-parse", "HEAD"],
                                       text=True).strip()
    except Exception:
        return "unknown"


def repo_dirty() -> bool:
    """Is the SOURCE tree dirty?

    A run writes tracked artifacts of its own (`admissible/exclusions.json`, `splits.json`, every
    analysis JSON) before it takes its manifest, so a plain `git status` is dirty for every run by
    construction and the flag would certify nothing at all. What the flag is for is the state of the
    CODE, so the replication tree is excluded and everything else counts, untracked files included.

    The cohort's own bookkeeping is excluded for exactly the same reason and no other. A selection
    walk rewrites COHORT_SELECTION.json after every candidate, so without this every cohort member's
    manifest would record a dirty tree caused by the walk that produced them. That is the same
    defect as the one above, in a second place, and it is not a licence to exclude anything else:
    these two paths are process outputs, and everything that decides research content still counts.
    """
    try:
        out = subprocess.check_output(["git", "-C", REPO_ROOT, "status", "--porcelain"], text=True)
    except Exception:
        return False
    for line in out.splitlines():
        path = line[3:].strip().strip('"')
        if " -> " in path:                       # a rename: judge the destination
            path = path.split(" -> ", 1)[1].strip().strip('"')
        if path.startswith("research/mechanism/replication100/COHORT_SELECTION.json"):
            continue
        if path.startswith("research/mechanism/replications/"):
            continue
        return True
    return False


def pipeline_version() -> dict:
    """Hash the code that decides research content, so a run names the pipeline it ran under."""
    files = [
        "research/mechanism/analysis/vocab.py",
        "research/mechanism/analysis/common.py",
        "research/mechanism/analysis/search.py",
        "research/mechanism/analysis/run_discovery.py",
        "research/mechanism/analysis/population.py",
        "research/mechanism/analysis/predict.py",
        "research/mechanism/analysis/invariance.py",
        "research/mechanism/analysis/stability_loco.py",
        "research/mechanism/analysis/focal.py",
        "research/mechanism/pipeline/features.py",
        "research/mechanism/pipeline/score_games.py",
        "research/mechanism/replication/contract.py",
        "research/mechanism/replication/eligibility.py",
        "research/mechanism/replication/classify.py",
        # `populations.py` resolves the focal player's band and therefore decides what "a
        # same-rating player" means; `run.py` holds the frozen stage arguments; `readiness.py`
        # holds the predicate that says who may be run at all. All three are research content.
        "research/mechanism/replication/populations.py",
        "research/mechanism/replication/readiness.py",
        "research/mechanism/replication/run.py",
    ]
    per_file = {}
    for rel in files:
        p = os.path.join(REPO_ROOT, rel)
        per_file[rel] = sha256_file(p) if os.path.exists(p) else None
    return {"files": per_file, "pipeline_hash": sha256_json(per_file)}


def new_run_id() -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())


def run_dir(platform: str, username: str, run_id: str | None = None, root: str | None = None) -> str:
    rid = run_id or new_run_id()
    d = os.path.join(root or REPLICATIONS_DIR, f"{platform}_{username}_{rid}")
    for sub in SUBDIRS:
        os.makedirs(os.path.join(d, sub), exist_ok=True)
    return d


def write_prereg(d: str, prereg: dict) -> str:
    """PHASE 15: the pre-registration is written and hashed BEFORE any outcome-bearing stage."""
    path = os.path.join(d, "REPLICATION_PREREG.json")
    if os.path.exists(path):
        return path                       # never rewritten: a run pre-registers exactly once
    prereg = dict(prereg)
    prereg["prereg_hash"] = sha256_json({k: v for k, v in prereg.items() if k != "prereg_hash"})
    with open(path, "w") as f:
        json.dump(prereg, f, indent=1)
    return path


def write_manifest(d: str, manifest: dict) -> str:
    path = os.path.join(d, "manifest.json")
    with open(path, "w") as f:
        json.dump(manifest, f, indent=1, default=str)
    return path


def base_manifest(focal, fetch_manifest: dict, elig: dict) -> dict:
    return {
        "contract_version": contract.CONTRACT_VERSION,
        "platform": focal.platform,
        "username": focal.username,
        "canonical_player_id": focal.player_id,
        "corpus": focal.corpus,
        "fetch": fetch_manifest.get("fetch"),
        "profile": fetch_manifest.get("profile"),
        "number_fetched": elig.get("raw_records"),
        "number_admissible": elig.get("admissible"),
        "number_scorable": elig.get("scorable"),
        "exclusions_by_reason": elig.get("excluded_by_reason"),
        "speeds": elig.get("speeds"),
        "eligibility_rule": elig.get("rule"),
        "repo_sha": repo_sha(),
        "repo_dirty": repo_dirty(),
        "pipeline_version": pipeline_version(),
        "engine": contract.ENGINE,
        "split": contract.SPLIT,
        "min_corpus": contract.MIN_CORPUS,
        "population_contract": contract.POPULATION_CONTRACT,
    }
