"""
PHASE 18 -- THE ONE-COMMAND ENTRYPOINT.

    python research/mechanism/replication/run.py --platform lichess --username SOMEUSER

    PUBLIC GAME HISTORY -> FROZEN CORPUS -> PRE-REGISTERED SPLITS -> ENGINE SCORING ->
    FEATURE EXTRACTION -> DISCOVERY -> HOLDOUT VALIDATION -> POPULATION CORRECTION ->
    PLAYER-SPECIFIC RESIDUAL SEARCH -> BOUNDED FINDING

Nothing else is asked of the caller. Rating, colour, game ids, dates, the corpus split and the
feature family are all derived; asking for any of them would be asking the operator to make a
research choice per player.

Every stage writes its own JSON into the run directory and every stage is resumable. The run ends
in exactly one of `contract.TERMINAL_STATES` and writes `report/RESULT.json` saying which.

Nothing here reads a result and then changes a rule. The pipeline is the frozen one in
`research/mechanism/analysis/`, invoked as a subprocess with the frozen arguments, so a run cannot
quietly re-tune what it is running.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(os.path.dirname(MECH))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(MECH, "analysis"))

import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402
import classify          # noqa: E402
import eligibility       # noqa: E402
import ingest_lichess    # noqa: E402
import populations       # noqa: E402
from focal import FocalPlayer  # noqa: E402

ANALYSIS = os.path.join(MECH, "analysis")
PIPELINE = os.path.join(MECH, "pipeline")
PY = os.environ.get("REPLICATION_PYTHON", sys.executable)


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def sh(cmd: list[str], cwd: str, logfile: str, env: dict | None = None) -> int:
    e = dict(os.environ)
    e.update({"OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1", "MKL_NUM_THREADS": "1"})
    if env:
        e.update(env)
    os.makedirs(os.path.dirname(logfile), exist_ok=True)
    with open(logfile, "ab") as f:
        f.write(f"\n$ {' '.join(cmd)}\n".encode())
        f.flush()
        return subprocess.call(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT, env=e)


def finish(d: str, state: dict) -> dict:
    path = os.path.join(d, "report", "RESULT.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(state, f, indent=1, default=str)
    log(f"STATUS {state.get('status')} -> {path}")
    return state


# --------------------------------------------------------------------------------------------------
# stages
# --------------------------------------------------------------------------------------------------
def stage_score(d: str, focal: FocalPlayer, workers: int, engine: str) -> dict:
    """PHASE 8: the baseline's engine regime, unchanged. Only the worker count is infrastructure."""
    src = os.path.join(d, "admissible", "games.ndjson")
    out = os.path.join(d, "scored")
    n_games = sum(1 for _ in open(src))
    todo = []
    for w in range(workers):
        part = os.path.join(out, f"part{w:02d}.jsonl")
        done = 0
        if os.path.exists(part):
            done = sum(1 for _ in open(part))
        mine = len([i for i in range(n_games) if i % workers == w])
        if done < mine:
            todo.append(w)
    if todo:
        log(f"SCORE: {n_games} games, {workers} workers, {len(todo)} to (re)start [{engine} regime]")
        procs = []
        for w in todo:
            cmd = [PY, os.path.join(PIPELINE, "score_games.py"), "--in", src, "--out", out,
                   "--worker", str(w), "--workers", str(workers), "--engine", engine,
                   "--focal-player-id", focal.player_id, "--corpus", focal.corpus]
            lf = os.path.join(d, "analysis", f"score_w{w}.log")
            with open(lf, "ab") as f:
                e = dict(os.environ)
                e.update({"OMP_NUM_THREADS": "1"})
                procs.append(subprocess.Popen(cmd, cwd=PIPELINE, stdout=f, stderr=subprocess.STDOUT, env=e))
        codes = [p.wait() for p in procs]
        if any(codes):
            return {"status": "ENGINE_FAILURE",
                    "detail": f"score_games.py workers exited {codes}; see analysis/score_w*.log"}
    scored = sum(sum(1 for _ in open(os.path.join(out, p))) for p in sorted(os.listdir(out))
                 if p.endswith(".jsonl"))
    if scored == 0:
        return {"status": "ENGINE_FAILURE", "detail": "the scorer produced no records"}
    return {"status": "OK", "games_scored": scored, "games_submitted": n_games, "engine": engine}


def stage_features(d: str, focal: FocalPlayer) -> dict:
    out = os.path.join(d, "features", "decisions.parquet")
    if not os.path.exists(out):
        log("FEATURES: extracting decision rows")
        rc = sh([PY, os.path.join(PIPELINE, "features.py"), os.path.join(d, "scored"), out, focal.corpus],
                PIPELINE, os.path.join(d, "analysis", "features.log"))
        if rc != 0 or not os.path.exists(out):
            return {"status": "ENGINE_FAILURE", "detail": "features.py failed; see analysis/features.log"}
    return {"status": "OK", "decisions_parquet": out}


def schema_gate(d: str) -> dict:
    """PHASE 9: the feature schema of an arbitrary focal player must be structurally identical to
    the baseline's. A column that exists only for one player is a player-specific feature family,
    which the frozen vocabulary does not have."""
    import pandas as pd
    base = pd.read_parquet(os.path.join(MECH, "data", "decisions_erez281.parquet")).head(1)
    mine = pd.read_parquet(os.path.join(d, "features", "decisions.parquet")).head(1)
    missing = sorted(set(base.columns) - set(mine.columns))
    extra = sorted(set(mine.columns) - set(base.columns))
    ok = not missing and not extra
    return {"status": "OK" if ok else "SCHEMA_MISMATCH", "missing": missing, "extra": extra,
            "n_columns": int(len(mine.columns))}


def stage_splits(d: str) -> dict:
    """PHASE 10: the frozen split rule, applied without looking at any outcome."""
    sys.path.insert(0, ANALYSIS)
    from common import load_decisions, eligible, chronological_split
    df = chronological_split(eligible(load_decisions(os.path.join(d, "features", "decisions.parquet"))),
                             contract.SPLIT["derive_frac"], contract.SPLIT["validate_frac"])
    counts, members = {}, {}
    for split in ("DERIVE", "VALIDATE", "TEST"):
        s = df[df.split == split]
        counts[f"{split}_decisions"] = int(len(s))
        counts[f"{split}_games"] = int(s.game_id.nunique())
        members[split] = sorted(map(str, s.game_id.unique()))
    blitz = df[df.speed == "blitz"]
    bcounts = {}
    for split in ("DERIVE", "VALIDATE", "TEST"):
        s = blitz[blitz.split == split]
        bcounts[f"{split}_decisions"] = int(len(s))
        bcounts[f"{split}_games"] = int(s.game_id.nunique())
    out = {"rule": contract.SPLIT, "counts": counts, "blitz_counts": bcounts,
           "eligible_decisions": int(len(df)), "eligible_games": int(df.game_id.nunique()),
           "membership": members}
    with open(os.path.join(d, "splits.json"), "w") as f:
        json.dump(out, f, indent=1)
    return out


def _discovery(d: str, name: str, extra: list[str], target: str, decisions: str,
               focal: FocalPlayer) -> dict | None:
    out = os.path.join(d, "analysis", f"{name}.json")
    if not os.path.exists(out):
        log(f"DISCOVERY[{name}]: frozen search on DERIVE, judged once on VALIDATE")
        rc = sh([PY, os.path.join(ANALYSIS, "run_discovery.py"), "--decisions", decisions,
                 "--vocab", "OBS", "--residual", "1", "--boot", "30", "--depths", "1,2,3",
                 "--target", target, "--corpus", focal.corpus,
                 "--focal-player-key", focal.player_key, "--out", out] + extra,
                ANALYSIS, os.path.join(d, "analysis", f"{name}.log"))
        if rc != 0 or not os.path.exists(out):
            return None
    return json.load(open(out))


def stage_evidence(d: str, focal: FocalPlayer, region: str, decisions: str, pop_parquet: str | None) -> dict:
    """The evidence the baseline attached to R*: invariance, leave-one-context-out stability, the
    TEST read, and the population comparison. Reported beside the class, never deciding it."""
    ev = {}
    jobs = [
        ("invariance", [PY, os.path.join(ANALYSIS, "invariance.py"), "--decisions", decisions,
                        "--region", region, "--frame", "VALIDATE", "--target", contract.BROAD_TARGET,
                        "--corpus", focal.corpus, "--out", os.path.join(d, "analysis", "invariance.json")]),
        ("stability_loco", [PY, os.path.join(ANALYSIS, "stability_loco.py"), "--decisions", decisions,
                            "--region", region, "--target", contract.BROAD_TARGET, "--depth", "2",
                            "--vocab", "OBS", "--corpus", focal.corpus,
                            "--out", os.path.join(d, "analysis", "stability_loco.json")]),
        ("holdout_test", [PY, os.path.join(ANALYSIS, "predict.py"), "--decisions", decisions,
                          "--region", region, "--target", contract.BROAD_TARGET,
                          "--corpus", focal.corpus,
                          "--out", os.path.join(d, "analysis", "predict_test.json")]),
    ]
    if pop_parquet:
        jobs.append(("population", [PY, os.path.join(ANALYSIS, "population.py"), "--decisions", decisions,
                                    "--population", pop_parquet, "--region", region,
                                    "--target", contract.BROAD_TARGET, "--frame", "VALIDATE",
                                    "--corpus", focal.corpus, "--focal-player-key", focal.player_key,
                                    "--out", os.path.join(d, "analysis", "population.json")]))
    for name, cmd in jobs:
        out = cmd[cmd.index("--out") + 1]
        if not os.path.exists(out):
            log(f"EVIDENCE[{name}]")
            sh(cmd, ANALYSIS, os.path.join(d, "analysis", f"{name}.log"))
        ev[name] = json.load(open(out)) if os.path.exists(out) else None
    return ev


# --------------------------------------------------------------------------------------------------
def run(platform: str, username: str, *, run_id: str | None, workers: int, engine: str,
        mode: str, ids_file: str | None, window: int | None, root: str | None,
        stop_after: str | None) -> dict:
    if platform not in contract.SUPPORTED_PLATFORMS:
        return {"status": "PLATFORM_UNSUPPORTED",
                "detail": f"{platform!r}; supported: {list(contract.SUPPORTED_PLATFORMS)}"}

    d = corpuslib.run_dir(platform, username, run_id, root)
    log(f"run directory: {d}")

    # ---- INGEST (Phase 4) -------------------------------------------------------------------------
    fetch_path = os.path.join(d, "raw", "fetch.json")
    ids = None
    if ids_file:
        text = open(ids_file).read().strip()
        ids = json.loads(text) if text.startswith("[") else [x for x in text.split() if x]
    if os.path.exists(fetch_path):
        fetch = json.load(open(fetch_path))
        log(f"INGEST: reusing raw corpus ({fetch['fetch']['records']} records)")
    else:
        try:
            log(f"INGEST: {platform}/{username}")
            fetch = ingest_lichess.ingest(username, os.path.join(d, "raw"), mode=mode, game_ids=ids)
        except ingest_lichess.IngestError as e:
            return finish(d, {"status": e.code, "detail": e.detail, "run_dir": d})
    focal = FocalPlayer(platform=platform, username=username,
                        player_id=fetch["player_id"], corpus=f"{platform}:{fetch['player_id']}")

    # ---- ELIGIBILITY + FREEZE (Phases 5, 6) -------------------------------------------------------
    elig = eligibility.apply(os.path.join(d, "raw", "history.ndjson"), os.path.join(d, "admissible"),
                             focal_player_id=focal.player_id, corpus=focal.corpus, window=window)
    log(f"ELIGIBILITY: {elig['raw_records']} fetched -> {elig['admissible']} admissible -> "
        f"{elig['scorable']} scorable; excluded {elig['excluded_by_reason']}")
    manifest = corpuslib.base_manifest(focal, fetch, elig)
    manifest["focal"] = focal.to_dict()
    manifest["run_dir"] = d
    corpuslib.write_manifest(d, manifest)
    if elig["scorable"] == 0:
        return finish(d, {"status": "INSUFFICIENT_ELIGIBLE_GAMES", "run_dir": d,
                          "detail": "no admissible standard-variant game survived the frozen rule",
                          "exclusions": elig["excluded_by_reason"]})

    # ---- PRE-REGISTRATION (Phase 15): written before the first outcome-bearing stage --------------
    corpuslib.write_prereg(d, {
        "platform": platform, "username": username, "canonical_player_id": focal.player_id,
        "corpus": focal.corpus,
        "repo_sha": manifest["repo_sha"], "pipeline_version": manifest["pipeline_version"],
        "contract_version": contract.CONTRACT_VERSION,
        "eligibility": elig["rule"], "exclusions_at_prereg": elig["excluded_by_reason"],
        "n_scorable_at_prereg": elig["scorable"],
        "split": contract.SPLIT, "min_corpus": contract.MIN_CORPUS,
        "engine": contract.ENGINE, "population_contract": contract.POPULATION_CONTRACT,
        "targets": {"broad": contract.BROAD_TARGET, "residual": list(contract.RESIDUAL_TARGETS)},
        "thresholds": _design_snapshot(),
        "stopping_rules": {
            "one_run": contract.GOVERNANCE["one_run_per_player"],
            "test_opened": contract.SPLIT["test_opened"],
            "no_tuning": "no stage reads a later stage's result and changes a rule",
        },
        "possible_output_classes": contract.OUTPUT_CLASSES,
        "failure_codes": list(contract.FAILURE_CODES),
        "claim_ladder": [list(x) for x in contract.CLAIM_LADDER],
        "written_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    if stop_after == "FREEZE":
        return finish(d, {"status": "FROZEN", "run_dir": d, "eligibility": elig})

    # ---- SCORE + FEATURES (Phases 8, 9) -----------------------------------------------------------
    sc = stage_score(d, focal, workers, engine)
    if sc["status"] != "OK":
        return finish(d, {**sc, "run_dir": d})
    fe = stage_features(d, focal)
    if fe["status"] != "OK":
        return finish(d, {**fe, "run_dir": d})
    gate = schema_gate(d)
    if gate["status"] != "OK":
        return finish(d, {"status": "PIPELINE_EQUIVALENCE_FAILED", "run_dir": d,
                          "detail": "feature schema differs from the baseline schema", "gate": gate})
    decisions = fe["decisions_parquet"]

    # ---- SPLITS (Phase 10) ------------------------------------------------------------------------
    splits = stage_splits(d)
    log(f"SPLITS: DERIVE {splits['counts']['DERIVE_decisions']}/{splits['counts']['DERIVE_games']}g, "
        f"VALIDATE {splits['counts']['VALIDATE_decisions']}/{splits['counts']['VALIDATE_games']}g, "
        f"TEST {splits['counts']['TEST_decisions']}/{splits['counts']['TEST_games']}g")
    ok, missing = classify.corpus_sufficient(splits["counts"])
    if not ok:
        return finish(d, {"status": "INSUFFICIENT_CORPUS", "failure_code": "INSUFFICIENT_CORPUS",
                          "output_class": "INSUFFICIENT_EVIDENCE", "run_dir": d,
                          "focal": focal.to_dict(),
                          "have": splits["counts"], "required": contract.MIN_CORPUS,
                          "missing": missing,
                          "detail": "thresholds are never lowered to let a player through"})

    # ---- POPULATION (Phase 11): resolved BEFORE any search result is read -------------------------
    pop = populations.resolve(decisions)
    with open(os.path.join(d, "analysis", "population_resolution.json"), "w") as f:
        json.dump(pop, f, indent=1)
    pop_parquet = pop["population"]["decisions_parquet_abs"] if pop["status"] == "OK" else None
    log(f"POPULATION: {pop['status']} band={pop.get('band')}")

    # ---- DISCOVERY (Phase 12) ---------------------------------------------------------------------
    broad = _discovery(d, "discovery_OBS_" + contract.BROAD_TARGET, [], contract.BROAD_TARGET,
                       decisions, focal)
    residual = None
    if pop_parquet:
        residual = _discovery(d, "discovery_POP_" + contract.RESIDUAL_PRIMARY,
                              ["--population", pop_parquet, "--blitz-only", "1"],
                              contract.RESIDUAL_PRIMARY, decisions, focal)

    # ---- CLASSIFY (Phase 13) ----------------------------------------------------------------------
    verdict = classify.classify(counts=splits["counts"], blitz_counts=splits["blitz_counts"],
                                population=pop, discovery_broad=broad, discovery_residual=residual)

    evidence = {}
    if verdict["output_class"] in ("LEVEL_TYPICAL_ONLY", "PERSONAL_RESIDUAL_CANDIDATE"):
        evidence = stage_evidence(d, focal, verdict["broad_structure"]["region"], decisions, pop_parquet)

    state = {
        "status": verdict["output_class"], "failure_code": verdict.get("failure_code"),
        "run_dir": d, "focal": focal.to_dict(),
        "contract_version": contract.CONTRACT_VERSION,
        "repo_sha": manifest["repo_sha"], "pipeline_hash": manifest["pipeline_version"]["pipeline_hash"],
        "corpus": {"fetched": elig["raw_records"], "admissible": elig["admissible"],
                   "scorable": elig["scorable"], "eligible_decisions": splits["eligible_decisions"],
                   "exclusions": elig["excluded_by_reason"], "speeds": elig["speeds"]},
        "splits": splits["counts"], "blitz_splits": splits["blitz_counts"],
        "population": {k: v for k, v in pop.items() if k != "population"},
        "population_id": (pop.get("population") or {}).get("id"),
        "verdict": verdict, "evidence": evidence,
        "claim_ladder": [list(x) for x in contract.CLAIM_LADDER],
        "reversal": contract.REVERSAL,
        "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    finish(d, state)
    import report
    report.write(d, state)
    return state


def _design_snapshot() -> dict:
    sys.path.insert(0, ANALYSIS)
    import vocab
    return {k: v for k, v in vocab.DESIGN.items() if k not in ("baseline_cols", "baseline_cat")}


def main() -> int:
    ap = argparse.ArgumentParser(description="replicate the frozen mechanism pipeline on one player")
    ap.add_argument("--platform", default="lichess")
    ap.add_argument("--username", required=True)
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--workers", type=int, default=max(1, min(4, (os.cpu_count() or 2))))
    ap.add_argument("--engine", default="native", choices=["native", "wasm"],
                    help="native is the frozen research regime; wasm is the shipped-engine control")
    ap.add_argument("--ingest-mode", default="auto", choices=["auto", "api-user-export", "api-ids"])
    ap.add_argument("--ids-file", default=None)
    ap.add_argument("--window", type=int, default=None,
                    help="cap on the most recent admissible games; must be declared before the fetch")
    ap.add_argument("--root", default=None, help="override the replications/ root")
    ap.add_argument("--stop-after", default=None, choices=["FREEZE"])
    a = ap.parse_args()
    state = run(a.platform, a.username, run_id=a.run_id, workers=a.workers, engine=a.engine,
                mode=a.ingest_mode, ids_file=a.ids_file, window=a.window, root=a.root,
                stop_after=a.stop_after)
    print(json.dumps({k: state.get(k) for k in ("status", "failure_code", "run_dir")}, indent=1))
    return 0 if state.get("status") in contract.TERMINAL_STATES or state.get("status") == "FROZEN" else 1


if __name__ == "__main__":
    raise SystemExit(main())
