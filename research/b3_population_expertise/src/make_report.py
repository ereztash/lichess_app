"""Build every required figure and table from `results/analysis_*.json` and the scored periods.

Re-derives the frozen residuals by refitting on DEVELOPMENT, which is deterministic and cheap, so
a figure can never disagree with the analysis it illustrates.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import analysis as an  # noqa: E402
import dataset  # noqa: E402
import matching  # noqa: E402
import report as rp  # noqa: E402
from common import BAND_LABELS, require_seal_for  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_periods(data_dir, names):
    dev_raw = dataset.load(os.path.join(data_dir, "development"))
    constants = dataset.frozen_constants(dev_raw)
    dev = dataset.apply_frozen(dev_raw, constants)
    fits, _ = an.fit_all(dev, dev["player"].to_numpy())
    scored_dev = an.residualise(dev, fits, {**constants, "ut_q95": 0.0})
    constants["ut_q95"] = float(np.quantile(scored_dev["unexpected_time_population"], 0.95))
    out = {}
    for name in names:
        path = os.path.join(data_dir, name)
        if not os.path.exists(os.path.join(path, "decisions.jsonl.zst")):
            continue
        require_seal_for(name)
        frame = dataset.apply_frozen(dataset.load(path), constants)
        out[name] = an.residualise(frame, fits, constants)
    return out, fits, constants


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", default=os.path.join(ROOT, "results", "analysis_final.json"))
    ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    ap.add_argument("--figures", default=os.path.join(ROOT, "results", "figures"))
    ap.add_argument("--tables", default=os.path.join(ROOT, "results", "tables"))
    ap.add_argument("--verdict", default=os.path.join(ROOT, "results", "verdict.json"))
    args = ap.parse_args()
    os.makedirs(args.figures, exist_ok=True)
    os.makedirs(args.tables, exist_ok=True)

    A = json.load(open(args.analysis))
    periods = list(A["periods"].keys())
    frames, fits, constants = load_periods(args.data, periods + ["secondary"])
    final_name = "final" if "final" in A["periods"] else periods[-1]
    F = A["periods"][final_name]
    powered = F["powered_bands"]

    def by_period(key):
        return {p: A["periods"][p][key] for p in periods}

    # --- figures ---------------------------------------------------------------------------------
    rp.binned_figure(f"{args.figures}/01_time_vs_difficulty_by_rating.png", frames,
                     "ambiguity_entropy", "seconds_taken",
                     "Thinking time against measured position difficulty, by rating",
                     "candidate-set ambiguity (nats, softmax over top-4 win probabilities)",
                     "mean seconds spent")
    rp.binned_figure(f"{args.figures}/02_quality_vs_difficulty_by_rating.png", frames,
                     "ambiguity_entropy", "quality_loss",
                     "Move quality against measured position difficulty, by rating",
                     "candidate-set ambiguity (nats)", "mean quality loss (win probability)")
    rp.binned_figure(f"{args.figures}/03_unexpected_time_vs_quality.png", frames,
                     "unexpected_time_within_rating", "quality_loss",
                     "Quality loss against unexpected thinking time",
                     "unexpected time (log-seconds, residual from T2 with rating)",
                     "mean quality loss (win probability)")
    rp.band_figure(f"{args.figures}/04_ut_effect_by_rating.png", by_period("beta_by_band"),
                   "H1: the unexpected-time effect on quality, by rating band",
                   "beta (win probability per log-second)",
                   note="shaded bands are below the adequate-power bar (150 players and 3,000 "
                        "decisions) and are excluded from the agreement rule",
                   powered=powered)
    rp.band_figure(f"{args.figures}/05_time_allocation_efficiency_by_rating.png",
                   by_period("tae_by_band"),
                   "Metric B: time allocation efficiency, by rating band",
                   "log-seconds of extra thinking per SD of value-of-computation",
                   powered=powered)
    rp.band_figure(f"{args.figures}/06_allocation_loss_by_rating.png",
                   by_period("allocation_loss_by_band"),
                   "Metric C: allocation loss, by rating band",
                   "mean |unexpected time| spent in the wrong direction", powered=powered,
                   zero_line=False)
    rp.band_figure(f"{args.figures}/07_extreme_ut_exposure_by_rating.png",
                   by_period("extreme_ut_by_band"),
                   "Metric D: exposure to extreme unexpected time, by rating band",
                   "share of decisions above the frozen 95th percentile", powered=powered,
                   zero_line=False)

    if final_name in frames:
        table = []
        block = frames[final_name]
        for player, rows in block.groupby("player"):
            if len(rows) < 20:
                continue
            y = rows["y_resid_T1"].to_numpy(float)
            v = rows["voc_resid"].to_numpy(float)
            yc, vc = y - y.mean(), v - v.mean()   # centred within the player, per N1(b)
            d = float(vc @ vc)
            table.append({"rating": float(rows["rating"].mean()),
                          "tae_shrunk": float(vc @ yc) / d if d > 0 else np.nan})
        rp.player_figure(f"{args.figures}/08_player_level_efficiency.png", table)
        rp.frontier_figure(f"{args.figures}/09_decision_efficiency_frontier.png",
                           A["frontier"][final_name])

    rp.band_figure(f"{args.figures}/10_periods_compared.png", by_period("beta_by_band"),
                   "Temporal replication: the same estimate in three periods",
                   "beta (win probability per log-second)", powered=powered)

    controls = A["controls"][final_name]
    rp.control_figure(f"{args.figures}/11_shuffled_rating_control.png",
                      F["tae_rating_gradient"],
                      controls.get("C3_shuffled_rating", {}).get("tae_rating_gradient", {}),
                      "C3: rating shuffled across players",
                      "d(TAE)/d(rating), per 100 Elo")
    rp.control_figure(f"{args.figures}/12_shuffled_voc_control.png",
                      F["tae_rating_gradient"],
                      controls.get("C4_shuffled_voc", {}).get("tae_rating_gradient", {}),
                      "C4: value-of-computation shuffled",
                      "d(TAE)/d(rating), per 100 Elo")
    secondary = A.get("secondary_time_control")
    if secondary:
        rp.control_figure(f"{args.figures}/13_primary_vs_secondary_time_control.png",
                          F["beta"], secondary.get("beta", {}),
                          "C16 NOT EVALUABLE: the frozen models extrapolate at 5+0; the 5+0 value "
                          "equals its own destroyed-outcome null",
                          "beta (win probability per log-second)")

    # --- tables ------------------------------------------------------------------------------------
    counts = []
    for band in BAND_LABELS:
        row = {"rating_band": band}
        for period in periods:
            if period in frames:
                block = frames[period][frames[period]["rating_band"] == band]
                row[f"{period}_players"] = int(block["player"].nunique())
                row[f"{period}_games"] = int(block["game_id"].nunique())
                row[f"{period}_decisions"] = int(len(block))
                row[f"{period}_adequately_powered"] = A["periods"][period]["adequately_powered"][band]
        counts.append(row)
    rp.write_table(f"{args.tables}/01_players_by_rating.csv",
                   [{k: v for k, v in r.items() if "player" in k or k == "rating_band"} for r in counts])
    rp.write_table(f"{args.tables}/02_games_by_rating.csv",
                   [{k: v for k, v in r.items() if "games" in k or k == "rating_band"} for r in counts])
    rp.write_table(f"{args.tables}/03_decisions_by_rating.csv", counts)

    exclusions = []
    for period in periods + ["secondary"]:
        path = os.path.join(args.data, period, "manifest.json")
        if not os.path.exists(path):
            continue
        manifest = json.load(open(path))
        for name, value in manifest["game_exclusions"].items():
            exclusions.append({"period": period, "level": "game", "reason": name, "count": value})
        for name, value in manifest["decision_exclusions"].items():
            exclusions.append({"period": period, "level": "decision", "reason": name, "count": value})
        exclusions.append({"period": period, "level": "kept", "reason": "decisions analysed",
                           "count": manifest["decisions"]})
    rp.write_table(f"{args.tables}/04_exclusions.csv", exclusions)

    balance = A["matched"][final_name].get("balance", {}).get("balance_lowest_vs_highest_band", {})
    rp.write_table(f"{args.tables}/05_matched_difficulty_balance.csv",
                   [{"variable": k, **v} for k, v in balance.items()])
    rp.write_table(f"{args.tables}/06_expected_time_model_performance.csv",
                   [{"period": p, **{k: v for k, v in A["model_comparison"][p].items()
                                     if k in ("T0", "T1P", "T2P", "T2R", "gbt_r2")}}
                    for p in periods])
    rp.write_table(f"{args.tables}/07_quality_model_performance.csv",
                   [{"period": p, **{k: v for k, v in A["model_comparison"][p].items()
                                     if k in ("Q0", "Q1", "q1_minus_q0_r2")}} for p in periods])
    rp.write_table(f"{args.tables}/08_ut_effect_by_rating.csv",
                   rp.band_table(by_period("beta_by_band"), "beta"))
    rp.write_table(f"{args.tables}/09_tae_by_rating.csv",
                   rp.band_table(by_period("tae_by_band"), "tae"))
    rp.write_table(f"{args.tables}/10_allocation_loss_by_rating.csv",
                   rp.band_table(by_period("allocation_loss_by_band"), "allocation_loss"))
    rp.write_table(f"{args.tables}/11_extreme_ut_exposure_by_rating.csv",
                   rp.band_table(by_period("extreme_ut_by_band"), "extreme_ut_rate"))

    control_rows = []
    for name, payload in sorted(controls.items()):
        for metric, cell in payload.items():
            if isinstance(cell, dict) and "point" in cell:
                control_rows.append({"control": name, "metric": metric, "point": cell["point"],
                                     "lo": cell.get("lo"), "hi": cell.get("hi")})
            elif not isinstance(cell, dict):
                control_rows.append({"control": name, "metric": metric, "point": cell,
                                     "lo": None, "hi": None})
    rp.write_table(f"{args.tables}/12_controls.csv", control_rows)

    rp.write_table(f"{args.tables}/13_temporal_replication.csv",
                   [{"period": p,
                     "decisions": A["periods"][p]["n_decisions"],
                     "players": A["periods"][p]["n_players"],
                     "beta": A["periods"][p]["beta"]["point"],
                     "beta_lo": A["periods"][p]["beta"]["lo"],
                     "beta_hi": A["periods"][p]["beta"]["hi"],
                     "tae_gradient": A["periods"][p]["tae_rating_gradient"]["point"],
                     "tae_lo": A["periods"][p]["tae_rating_gradient"]["lo"],
                     "tae_hi": A["periods"][p]["tae_rating_gradient"]["hi"]}
                    for p in periods])

    if secondary:
        rp.write_table(f"{args.tables}/14_second_time_control.csv",
                       [{"metric": k, "point": v.get("point"), "lo": v.get("lo"),
                         "hi": v.get("hi"),
                         "status": "NOT EVALUABLE: frozen models extrapolate at 5+0 (REPORT.md 9)"}
                        for k, v in secondary.items() if isinstance(v, dict) and "point" in v])

    verdict_path = args.verdict
    if os.path.exists(verdict_path):
        verdict = json.load(open(verdict_path))
        rp.write_table(f"{args.tables}/15_failed_hypotheses.csv",
                       [{"check": k, "passed": v} for k, v in verdict.get("checks", {}).items()])

    print(f"figures -> {args.figures}\ntables  -> {args.tables}")


if __name__ == "__main__":
    main()
