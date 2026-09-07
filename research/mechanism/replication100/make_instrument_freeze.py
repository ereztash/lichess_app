"""
PHASE 0 -- freeze the instrument, before a cohort exists.

A hundred players judged by one instrument only means something if the instrument can be named. This
records what "the instrument" IS at the moment the cohort study begins: the code that decides
research content, the protocol text, the thresholds, the vocabulary, the engine regime, the
population registry, the classifier, and the state of every gate that is supposed to hold it in
place. Anything not in here is not part of the frozen instrument and may not silently become part of
it later.
"""
from __future__ import annotations

import hashlib
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
sys.path.insert(0, os.path.join(MECH, "analysis"))
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402
import populations       # noqa: E402
import vocab             # noqa: E402


def sha256_file(rel: str) -> str:
    return corpuslib.sha256_file(os.path.join(REPO, rel))


def main() -> int:
    gate = json.load(open(os.path.join(REPL, "GATE_RESULT.json")))
    controls = json.load(open(os.path.join(REPL, "GATE_POSITIVE_CONTROLS.json")))
    baseline = json.load(open(os.path.join(REPL, "BASELINE_EREZ281.json")))
    pv = corpuslib.pipeline_version()

    runs = {}
    root = os.path.join(MECH, "replications")
    if os.path.isdir(root):
        sys.path.insert(0, REPL)
        import verify_run
        for name in sorted(os.listdir(root)):
            d = os.path.join(root, name)
            if os.path.isdir(d):
                v = verify_run.verify(d)
                runs[name] = {"status": v["status"], "complete": v["complete"],
                              "pipeline_hash_matches": v["pipeline_hash_matches"],
                              "problems": v["problems"]}

    protocol_files = {f: sha256_file(f) for f in
                      ["research/mechanism/replication/contract.py",
                       "research/mechanism/replication/PROTOCOL.md"]}
    schema = baseline["feature_schema"]

    doc = {
        "_what": "The frozen mechanism-discovery instrument, recorded before the 100-player cohort "
                 "study selects a single username. Player 1 and Player 100 are judged by this.",
        "frozen_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repo_sha": corpuslib.repo_sha(),
        "repo_dirty": corpuslib.repo_dirty(),
        "base_branch_sha": subprocess.check_output(
            ["git", "-C", REPO, "rev-parse", "origin/main"], text=True).strip(),
        "contract_version": contract.CONTRACT_VERSION,
        "pipeline_hash": pv["pipeline_hash"],
        "pipeline_files": pv["files"],
        "protocol_files": protocol_files,
        "protocol_hash": corpuslib.sha256_json(protocol_files),
        "feature_schema": {"n_columns": schema["n_columns"], "schema_hash": schema["schema_hash"]},
        "engine": contract.ENGINE,
        "eligibility": {"game": contract.GAME_ELIGIBILITY, "decision": contract.DECISION_ELIGIBILITY,
                        "berserk": contract.BERSERK_HANDLING, "window_rule": contract.WINDOW_RULE},
        "split": contract.SPLIT,
        "min_corpus": contract.MIN_CORPUS,
        "thresholds": {k: v for k, v in vocab.DESIGN.items()
                       if k not in ("baseline_cols", "baseline_cat")},
        "vocabularies": {name: sorted(v) for name, v in
                         (("OBS", vocab.VOCAB_OBS), ("ENG", vocab.VOCAB_ENG),
                          ("TIME", vocab.VOCAB_TIME), ("HIST", vocab.VOCAB_HIST))},
        "baseline_columns": vocab.BASELINE_COLS,
        "targets": {"broad": contract.BROAD_TARGET,
                    "residual_in_frozen_precedence": list(contract.RESIDUAL_TARGETS),
                    "residual_primary": contract.RESIDUAL_PRIMARY},
        "population_contract": contract.POPULATION_CONTRACT,
        "population_registry": {"path": "research/mechanism/replication/registry/populations.json",
                                "sha256": sha256_file("research/mechanism/replication/registry/populations.json"),
                                "entries": [{"id": p["id"], "band": p["band"],
                                             "time_controls": p["time_controls"],
                                             "games": p["games"], "sides": p["sides"],
                                             "eligible_decisions": p["eligible_decisions"]}
                                            for p in populations.registry()]},
        "classifier": {"module": "research/mechanism/replication/classify.py",
                       "sha256": sha256_file("research/mechanism/replication/classify.py"),
                       "output_classes": contract.OUTPUT_CLASSES,
                       "failure_codes": list(contract.FAILURE_CODES),
                       "precedence": "residual candidates are ordered by target precedence "
                                     f"{list(contract.RESIDUAL_TARGETS)}, and by DERIVE quality only "
                                     "within a target"},
        "claim_ladder": [list(x) for x in contract.CLAIM_LADDER],
        "gate": {"name": gate["gate"], "result": gate["result"], "verdict": gate["verdict"],
                 "checks": len(gate["checks"]),
                 "artefacts": sum(len(c["rows"]) for c in gate["checks"]),
                 "failing": sum(1 for c in gate["checks"] for r in c["rows"] if r["result"] == "FAIL"),
                 "per_check": {c["check"]: c["result"] for c in gate["checks"]}},
        "positive_controls": {"result": controls["result"],
                              "each": {c["control"]: c["gate_went_red"]
                                       for c in controls["positive_controls"]}},
        "existing_runs": runs,
        "reference_results": {
            "erez281": {"class": "PERSONAL_RESIDUAL_CANDIDATE",
                        "r_star": baseline["r_star"]["region"],
                        "r_star_star": baseline["r_star_star"]["region"]},
        },
        "governance": {
            "no_tuning_between_players": "after COHORT_PREREG is hashed, none of eligibility, "
                                         "features, thresholds, search space, target order, split "
                                         "rules, population correction, judge, classifier, residual "
                                         "definition or output classes may change because of any "
                                         "player's result",
            "protocol_version": "V1; a change of methodology ends V1 and belongs to a new cohort",
        },
    }
    doc["instrument_hash"] = hashlib.sha256(
        json.dumps({k: v for k, v in doc.items() if k not in ("instrument_hash", "frozen_at")},
                   sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    out = os.path.join(HERE, "INSTRUMENT_FREEZE.json")
    with open(out, "w") as f:
        json.dump(doc, f, indent=1, default=str)
    print(json.dumps({"out": out, "instrument_hash": doc["instrument_hash"],
                      "repo_sha": doc["repo_sha"], "repo_dirty": doc["repo_dirty"],
                      "pipeline_hash": doc["pipeline_hash"], "protocol_hash": doc["protocol_hash"],
                      "gate": doc["gate"]["result"], "controls": doc["positive_controls"]["result"],
                      "runs": {k: v["status"] for k, v in runs.items()}}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
