"""
The pre-registration a replication is frozen against, written AFTER the corpus is frozen and BEFORE
any outcome-bearing stage, and hashed.

`run.py` already writes a `REPLICATION_PREREG.json` inside the run directory at the same point in the
chain. This produces the fuller, standalone record a replication needs: it adds the account's
identity as the platform reports it, the retrieval timestamp, the protocol hash, the population band
the corpus implies and the registry entry that will serve it, the residual targets in their frozen
precedence, and the classification order.

The band recorded here is EXPECTED, computed from the admissible corpus's per-game ratings before a
single position is scored. The authoritative band is the one `populations.resolve` derives from the
eligible decisions after scoring; both are recorded when the run finishes, and if they disagree the
run says so rather than quietly preferring one.

    python make_replication_prereg.py --run-dir <dir> --out REPLICATION_PREREG_<NAME>.json
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "analysis"))
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402
import populations       # noqa: E402


def protocol_hash() -> dict:
    """What "the frozen protocol" means, as a hash: the contract module and the prose beside it."""
    files = ["research/mechanism/replication/contract.py",
             "research/mechanism/replication/PROTOCOL.md"]
    per = {f: corpuslib.sha256_file(os.path.join(corpuslib.REPO_ROOT, f)) for f in files}
    return {"files": per, "protocol_hash": corpuslib.sha256_json(per)}


def expected_band(run_dir: str) -> dict:
    """The band the admissible corpus implies, before scoring."""
    path = os.path.join(run_dir, "admissible", "games.ndjson")
    ratings = []
    focal_id = None
    for line in open(path):
        g = json.loads(line)
        focal_id = focal_id or (g.get("focal_player_id") or "").lower()
        if g.get("speed") != "blitz":
            continue
        for side, key in (("white", "w"), ("black", "b")):
            p = (g.get("players") or {}).get(side) or {}
            uid = (p.get("user") or {}).get("id")
            if uid and uid.lower() == focal_id and p.get("rating"):
                ratings.append(int(p["rating"]))
    if not ratings:
        return {"blitz_games": 0, "median": None, "band": None, "registry_hit": False,
                "note": "no blitz games in the admissible corpus, so no band can be derived"}
    med = statistics.median(ratings)
    band = list(contract.population_band(med))
    reg = [p for p in populations.registry() if tuple(p["band"]) == tuple(band)]
    return {"blitz_games": len(ratings), "median": med, "band": band,
            "registry_hit": bool(reg), "registry_entry": (reg[0]["id"] if reg else None),
            "rule": contract.POPULATION_CONTRACT["band_centre"] + " +/- "
                    + str(contract.POPULATION_CONTRACT["band_halfwidth"]),
            "basis": "one rating per admissible blitz game, before any position is scored"}


def build(run_dir: str, input_mode: str, ids_source: str | None) -> dict:
    manifest = json.load(open(os.path.join(run_dir, "manifest.json")))
    fetch = manifest.get("fetch") or {}
    band = expected_band(run_dir)
    doc = {
        "_what": "Pre-registration for one replication run. Written after the corpus was frozen and "
                 "before any outcome-bearing stage. Nothing below may change because of what the run "
                 "returns.",
        "platform": manifest["platform"],
        "username": manifest["username"],
        "canonical_player_id": manifest["canonical_player_id"],
        "corpus_label": manifest["corpus"],
        "retrieval": {"mode": fetch.get("mode"), "url": fetch.get("url"), "query": fetch.get("query"),
                      "fetched_at": fetch.get("fetched_at"), "records": fetch.get("records"),
                      "bytes": fetch.get("bytes"), "sha256": fetch.get("sha256")},
        "input_mode": input_mode,
        "input_mode_consequence": (
            "PROVIDED_GAME_IDS: the corpus is built from canonical API records fetched by id, but "
            "the username-only ingestion contract is NOT exercised by this run. A replication run "
            "under this mode replicates the METHODOLOGY, not the ingestion path."
            if input_mode == "PROVIDED_GAME_IDS" else
            "USERNAME_ONLY: the frozen ingestion contract was exercised end to end."),
        "ids_source": ids_source,
        "code_sha": manifest["repo_sha"],
        "repo_dirty_at_freeze": manifest["repo_dirty"],
        "pipeline_hash": manifest["pipeline_version"]["pipeline_hash"],
        "pipeline_files": manifest["pipeline_version"]["files"],
        "protocol": protocol_hash(),
        "contract_version": contract.CONTRACT_VERSION,
        "corpus": {"fetched": manifest["number_fetched"], "admissible": manifest["number_admissible"],
                   "scorable": manifest["number_scorable"],
                   "exclusions_by_reason": manifest["exclusions_by_reason"],
                   "speeds": manifest["speeds"]},
        "eligibility": manifest["eligibility_rule"],
        "expected_population_band": band,
        "population_contract": contract.POPULATION_CONTRACT,
        "engine": contract.ENGINE,
        "split_contract": contract.SPLIT,
        "min_corpus": contract.MIN_CORPUS,
        "thresholds": _design(),
        "targets": {"broad": contract.BROAD_TARGET,
                    "residual_in_frozen_precedence": list(contract.RESIDUAL_TARGETS),
                    "residual_primary": contract.RESIDUAL_PRIMARY},
        "classification_order": [
            "1. corpus sufficiency (contract.MIN_CORPUS) -> INSUFFICIENT_CORPUS",
            "2. broad OBS residual search on the union class, judged once on VALIDATE -> "
            "NO_STABLE_STRUCTURE if nothing passes",
            "3. population band resolution -> POPULATION_BASELINE_INSUFFICIENT if unregistered",
            "4. blitz-frame sufficiency -> POPULATION_BASELINE_INSUFFICIENT",
            "5. population-baseline residual search over the residual targets in precedence order -> "
            "LEVEL_TYPICAL_ONLY if nothing passes, else PERSONAL_RESIDUAL_CANDIDATE",
        ],
        "output_classes": contract.OUTPUT_CLASSES,
        "failure_codes": list(contract.FAILURE_CODES),
        "stopping_rules": {
            "one_run_per_player": contract.GOVERNANCE["one_run_per_player"],
            "test_opened": contract.SPLIT["test_opened"],
            "no_tuning": "no stage reads a later stage's result and changes a rule",
            "allowable_resume": ["compute interruption", "deterministic retry", "crash recovery",
                                 "resuming a stage whose output already exists"],
            "not_allowable": ["threshold changes", "feature changes", "population band changes",
                              "target changes", "search-space expansion",
                              "re-running because the result is uninteresting"],
        },
        "claim_ladder": [list(x) for x in contract.CLAIM_LADDER],
        "reversal": contract.REVERSAL,
        "governance": ("From this point the player is TEST data. If the run exposes a defect that "
                       "requires a NEW rule, the player becomes a development case and this is no "
                       "longer a replication; if it exposes an implementation defect against a rule "
                       "that was already frozen, the repair is allowed and must be shown red-then-"
                       "green, with no analytic choice taken from this player's result."),
        "written_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    doc["prereg_hash"] = corpuslib.sha256_json({k: v for k, v in doc.items() if k != "prereg_hash"})
    return doc


def _design():
    sys.path.insert(0, os.path.join(os.path.dirname(HERE), "analysis"))
    import vocab
    return {k: v for k, v in vocab.DESIGN.items() if k not in ("baseline_cols", "baseline_cat")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--input-mode", default="PROVIDED_GAME_IDS",
                    choices=["PROVIDED_GAME_IDS", "USERNAME_ONLY"])
    ap.add_argument("--ids-source", default=None)
    a = ap.parse_args()
    doc = build(a.run_dir, a.input_mode, a.ids_source)
    with open(a.out, "w") as f:
        json.dump(doc, f, indent=1)
    print(json.dumps({"out": a.out, "prereg_hash": doc["prereg_hash"],
                      "expected_band": doc["expected_population_band"]}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
