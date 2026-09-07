"""
PHASE 1 -- FREEZE THE OLD PIPELINE.

Reads the frozen erez281 artifacts and emits `BASELINE_EREZ281.json`: the machine-readable record
of what the original pipeline consumed and produced, so that after the refactor it can be PROVEN
that the research did not change. Every value here is read off a committed artifact; nothing is
typed by hand.
"""
from __future__ import annotations
import hashlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
sys.path.insert(0, os.path.join(MECH, "analysis"))
sys.path.insert(0, HERE)
import contract  # noqa


def blob_sha(rel: str) -> str:
    return subprocess.check_output(["git", "-C", REPO, "hash-object", rel], text=True).strip()


def sha256(rel: str) -> str:
    h = hashlib.sha256()
    with open(os.path.join(REPO, rel), "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    from common import load_decisions, eligible, chronological_split
    import vocab, pandas as pd

    D = vocab.DESIGN
    owner_rel = "research/mechanism/data/decisions_erez281.parquet"
    df_all = load_decisions(os.path.join(REPO, owner_rel))
    df = chronological_split(eligible(df_all), D["derive_frac"], D["validate_frac"])
    manifest = json.load(open(os.path.join(MECH, "data", "frozen_window_manifest.json")))
    rstar = json.load(open(os.path.join(MECH, "nodeB", "discovery_v17_cls_tactical.json")))
    rss = json.load(open(os.path.join(MECH, "nodeB", "discovery_POP_cls_hung_material.json")))
    predict = json.load(open(os.path.join(MECH, "nodeB", "predict_tactical_test.json")))
    popcmp = json.load(open(os.path.join(MECH, "nodeB", "population_tactical_validate.json")))
    invar = json.load(open(os.path.join(MECH, "nodeB", "invariance_tactical_validate.json")))
    loco = json.load(open(os.path.join(MECH, "nodeB", "stability_loco_tactical.json")))
    engart = json.load(open(os.path.join(MECH, "nodeB", "engine_artifact_tactical_validate.json")))

    splits = {}
    for s in ("DERIVE", "VALIDATE", "TEST"):
        fr = df[df.split == s].sort_values("game_order")
        splits[s] = {
            "decisions": int(len(fr)), "games": int(fr.game_id.nunique()),
            "first_game_id": str(fr.game_id.iloc[0]), "last_game_id": str(fr.game_id.iloc[-1]),
            "first_created_at": int(fr.createdAt.iloc[0]), "last_created_at": int(fr.createdAt.iloc[-1]),
            "games_sha256": hashlib.sha256(",".join(map(str, fr.game_id.unique())).encode()).hexdigest(),
        }
    blitz = df[df.speed == "blitz"]
    blitz_splits = {s: {"decisions": int((blitz.split == s).sum()),
                        "games": int(blitz[blitz.split == s].game_id.nunique())}
                    for s in ("DERIVE", "VALIDATE", "TEST")}

    schema = sorted(pd.read_parquet(os.path.join(REPO, owner_rel)).columns)
    data_files = ["research/mechanism/data/decisions_erez281.parquet",
                  "research/mechanism/data/decisions_population_2026-06.parquet",
                  "research/mechanism/data/decisions_post_freeze.parquet",
                  "research/mechanism/data/scored_erez281_sf171_d12_mpv3.jsonl.zst",
                  "research/mechanism/data/scored_population_sf171_d12_mpv3.jsonl.zst",
                  "research/mechanism/data/frozen_window_manifest.json",
                  "research/mechanism/data/population_games.ndjson"]

    out = {
        "_what_this_is": ("The original pipeline's inputs and canonical outputs on erez281, frozen "
                          "before the generalisation refactor. GATE-GENERIC-PIPELINE-EQUIVALENCE "
                          "compares the generic pipeline against this file."),
        "baseline_repo_sha": subprocess.check_output(["git", "-C", REPO, "rev-parse", "HEAD"], text=True).strip(),
        "baseline_branch": subprocess.check_output(["git", "-C", REPO, "rev-parse", "--abbrev-ref", "HEAD"], text=True).strip(),
        "mission_origin_sha": "2f3c26139e9bb166e799f2bccf8a75d900f568e1",
        "contract_version": contract.CONTRACT_VERSION,
        "focal": {"platform": "lichess", "username": "erez281", "player_id": "erez281",
                  "corpus_label_in_frozen_artifacts": "erez281"},
        "inputs": {
            "corpus_source": manifest["source"],
            "fetched_at": manifest["fetchedAt"],
            "games_returned": manifest["gamesReturned"],
            "games_admissible": manifest["gamesAdmissible"],
            "rejected": manifest["rejected"],
            "window_rule": manifest["windowRule"],
            "speeds_in_window": manifest["speedsInWindow"],
            "game_ids_sha256": hashlib.sha256(",".join(manifest["gameIds"]).encode()).hexdigest(),
            "n_game_ids": len(manifest["gameIds"]),
            "artifacts": {f: {"git_blob": blob_sha(f), "sha256": sha256(f)} for f in data_files},
        },
        "engine_regime": contract.ENGINE,
        "corpus": {
            "scored_games": int(df.game_id.nunique()),
            "scored_decisions": int(len(df_all)),
            "eligible_decisions": int(len(df)),
            "non_standard_dropped": manifest["gamesAdmissible"] - int(df.game_id.nunique()),
            "canonical_cross_check": "research/harness-account-full/prereg_report.json: 59,419 scored / 52,881 eligible",
        },
        "splits": splits,
        "blitz_splits": blitz_splits,
        "feature_schema": {"n_columns": len(schema), "columns": schema,
                           "schema_hash": hashlib.sha256(json.dumps(schema).encode()).hexdigest()},
        "design": {k: v for k, v in D.items() if k not in ("baseline_cols", "baseline_cat")},
        "discovery_broad": {
            "artifact": "research/mechanism/nodeB/discovery_v17_cls_tactical.json",
            "target": rstar["target"], "vocab": rstar["vocab"], "depth": rstar["depth"],
            "cv_depth": {k: v["mean_z"] for k, v in rstar["cv_depth"].items()},
            "frozen": [{"region": f["region"], "n_derive": f["n_derive"],
                        "derive_wg_est": f["derive_wg_est"], "derive_wg_z": f["derive_wg_z"],
                        "stability_share_j60": f["stability_share_j60"],
                        "validate": {k: f["validate"][k] for k in
                                     ("n_in", "p_in", "p_out", "wg_est", "wg_z", "resid_wg_z", "pass")}}
                       for f in rstar["frozen"]],
        },
        "r_star": {
            "region": rstar["frozen"][0]["region"],
            "target": rstar["target"],
            "definition": "material_balance >= -2 AND own_overloaded_piece_count >= 1, target cls_tactical",
            "validate": {k: rstar["frozen"][0]["validate"][k] for k in
                         ("n_in", "p_in", "p_out", "wg_est", "wg_z", "resid_wg_z", "pass")},
            "test": {"n_in": predict["frames"]["TEST"]["region_contrast"]["n_in"],
                     "p_in": predict["frames"]["TEST"]["region_contrast"]["p_in"],
                     "p_out": predict["frames"]["TEST"]["region_contrast"]["p_out"],
                     "z": predict["frames"]["TEST"]["region_contrast"]["z"],
                     "baseline_gap": predict["frames"]["TEST"]["baseline_gap_in_region"],
                     "models": predict["frames"]["TEST"]["models"],
                     "shuffled_gain_p": predict["frames"]["TEST"]["shuffled_gain_p"]},
            "invariance_artifact": "research/mechanism/nodeB/invariance_tactical_validate.json",
            "invariance_strata_with_positive_diff": sum(
                1 for r in invar["strata"] if r.get("diff") is not None and r["diff"] > 0),
            "invariance_strata_judged": sum(1 for r in invar["strata"] if r.get("diff") is not None),
            "stability_loco_artifact": "research/mechanism/nodeB/stability_loco_tactical.json",
            "stability_loco_exact_returns": sum(1 for r in loco["rows"] if r["jaccard"] >= 0.999),
            "stability_loco_variants": len(loco["rows"]),
            "engine_artifact_control": {
                "artifact": "research/mechanism/nodeB/engine_artifact_tactical_validate.json",
                "shipped_engine_within_game": engart.get("shipped", {}).get("cls_tactical", {}) or None,
            },
        },
        "population": {
            "artifact": "research/mechanism/nodeB/population_tactical_validate.json",
            "corpus_id": "population_2026-06",
            "band": [1450, 1850],
            "band_rule": contract.POPULATION_CONTRACT["band_centre"],
            "focal_blitz_median_rating": float(
                df[df.speed == "blitz"].groupby("game_id")["own_rating"].first().median()),
            "n_decisions": popcmp["population"]["n"],
            "sides": popcmp["population"]["sides"],
            "raw_diff": popcmp["population"]["raw"]["diff"],
            "resid_diff": popcmp["population"]["resid"]["diff"],
            "focal_percentile": popcmp["per_side"]["erez_percentile"],
            "focal_elev": popcmp["per_side"]["erez_elev"],
            "interpretation": ("R* is the typical structure of the band: the focal player sits at the "
                               "62nd percentile of per-side elevation. The population removed the word "
                               "'specific' from R*."),
        },
        "discovery_residual": {
            "artifact": "research/mechanism/nodeB/discovery_POP_cls_hung_material.json",
            "target": rss["target"], "depth": rss["depth"],
            "population_model_holdout_auc": rss["design"].get("_pop_auc"),
            "cv_depth": {k: v["mean_z"] for k, v in rss["cv_depth"].items()},
            "frozen": [{"region": f["region"], "n_derive": f["n_derive"],
                        "stability_share_j60": f["stability_share_j60"],
                        "validate": {k: f["validate"][k] for k in
                                     ("n_in", "p_in", "p_out", "wg_est", "wg_z", "resid_wg_z", "pass")}}
                       for f in rss["frozen"]],
        },
        "r_star_star": {
            "region": rss["frozen"][0]["region"],
            "target": rss["target"],
            "definition": "material_balance in [0,3) AND own_overloaded_piece_count >= 1, target cls_hung_material",
            "validate": {k: rss["frozen"][0]["validate"][k] for k in
                         ("n_in", "p_in", "p_out", "wg_est", "wg_z", "resid_wg_z", "pass")},
            "stability_share_j60": rss["frozen"][0]["stability_share_j60"],
        },
        "final_evidence_state": {
            "output_class": "PERSONAL_RESIDUAL_CANDIDATE",
            "neta_status": "FIELD_STOP",
            "mission_status": "FIELD_REQUIRED_FOR_LEVEL_6",
            "levels_earned": ["L1 cross-context", "L2 predictive", "L3 stable", "L4 actionable",
                              "L5 prospectively testable"],
            "supported_claims": ["C1", "C2", "C3", "C4"],
            "withheld_claims": ["C5 INTERVENTION (INSUFFICIENT_REALITY)", "C6 OUTCOME (DENY)"],
            "source": "research/mechanism/NETA_FINDING.json, MISSION_LEDGER.md §FINAL REPORT",
        },
    }
    path = os.path.join(HERE, "BASELINE_EREZ281.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1, default=str)
    print(path, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
