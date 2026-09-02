#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
P3_PATH = HERE / "p3_system_invariant.py"
spec = importlib.util.spec_from_file_location("p3_system_invariant", P3_PATH)
p3 = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(p3)

CLASSES = p3.CLASSES
SEED = 20260902
BOOTSTRAPS = 5000

L = p3.BASE + p3.LOCAL
SPECS = {
    "L_local": L,
    "L_Epost": L + ["post_own_overloaded_piece_count"],
    "L_Ppost": L + ["post_opp_overloaded_piece_count"],
    "L_Epost_Ppost": L + ["post_own_overloaded_piece_count", "post_opp_overloaded_piece_count"],
    "L_Edelta": L + ["delta_own_overloaded_piece_count"],
    "L_Pdelta": L + ["delta_opp_overloaded_piece_count"],
    "L_Edelta_Pdelta": L + ["delta_own_overloaded_piece_count", "delta_opp_overloaded_piece_count"],
}


def fit_predict(df):
    y = df["regret"].to_numpy(float)
    cls = df["rule_class"].to_numpy()
    preds = {name: np.full(len(df), np.nan) for name in SPECS}
    coeffs = {name: {} for name in SPECS}

    for held in CLASSES:
        train = np.where(cls != held)[0]
        test = np.where(cls == held)[0]
        for name, cols in SPECS.items():
            model = p3.make_model(cols)
            model.fit(df.iloc[train], y[train])
            preds[name][test] = model.predict(df.iloc[test])
            ridge = model.named_steps["ridge"]
            coeffs[name][held] = {col: float(coef) for col, coef in zip(cols, ridge.coef_)}

    for name, pred in preds.items():
        if np.isnan(pred).any():
            raise RuntimeError(f"missing predictions for {name}")
    return y, preds, coeffs


def compact(stat):
    return {k: v for k, v in stat.items() if k != "by_position"}


def block(df, y, preds, class_filter, rng):
    stats = {name: p3.pair_stats(df, y, pred, class_filter) for name, pred in preds.items()}
    out = {name: compact(stat) for name, stat in stats.items()}
    comparisons = [
        ("L_Epost", "L_local"),
        ("L_Ppost", "L_local"),
        ("L_Epost_Ppost", "L_Epost"),
        ("L_Epost_Ppost", "L_local"),
        ("L_Edelta", "L_local"),
        ("L_Pdelta", "L_local"),
        ("L_Edelta_Pdelta", "L_local"),
    ]
    for a, b in comparisons:
        out[f"{a}_minus_{b}"] = {
            "gain": out[a]["accuracy"] - out[b]["accuracy"],
            "ci95_cluster_position": p3.bootstrap_diff(stats[a], stats[b], rng, BOOTSTRAPS),
        }
    return out


def all_positive_ci(result, key):
    ci = result[key]["ci95_cluster_position"]
    return ci[0] is not None and ci[0] > 0


def main():
    df, eligible_items, missing = p3.build_rows()
    # P3 build_rows already scopes to natural positive RC-07/08/09 valid B moves.
    y, preds, coeffs = fit_predict(df)
    rng = np.random.default_rng(SEED)

    overall = block(df, y, preds, None, rng)
    per_class = {held: block(df, y, preds, {held}, rng) for held in CLASSES}

    exposure_post_signs = [coeffs["L_Epost"][h]["post_own_overloaded_piece_count"] for h in CLASSES]
    pressure_post_signs = [coeffs["L_Ppost"][h]["post_opp_overloaded_piece_count"] for h in CLASSES]
    exposure_delta_signs = [coeffs["L_Edelta"][h]["delta_own_overloaded_piece_count"] for h in CLASSES]
    pressure_delta_signs = [coeffs["L_Pdelta"][h]["delta_opp_overloaded_piece_count"] for h in CLASSES]

    c1 = (
        all(x > 0 for x in exposure_post_signs)
        and all_positive_ci(overall, "L_Epost_minus_L_local")
    )
    c2 = (
        all(x < 0 for x in pressure_post_signs)
        and all_positive_ci(overall, "L_Ppost_minus_L_local")
    )
    class_incremental = [
        per_class[h]["L_Epost_Ppost_minus_L_Epost"]["gain"] > 0 for h in CLASSES
    ]
    class_incremental_ci = [
        per_class[h]["L_Epost_Ppost_minus_L_Epost"]["ci95_cluster_position"][0] > 0
        for h in CLASSES
    ]
    c3 = (
        all_positive_ci(overall, "L_Epost_Ppost_minus_L_Epost")
        and all(class_incremental)
        and sum(class_incremental_ci) >= 2
    )
    c4 = (
        all(x > 0 for x in exposure_delta_signs)
        and all(x < 0 for x in pressure_delta_signs)
        and all_positive_ci(overall, "L_Edelta_Pdelta_minus_L_local")
    )

    if c1 and c2 and c3 and c4:
        verdict = "PE-PASS"
        authority = "safety then pressure supported"
    elif c1 and c2 and c3:
        verdict = "PE-POST-PASS"
        authority = "resulting-state loop supported; change wording not licensed"
    elif c1:
        verdict = "PE-EXPOSURE-ONLY"
        authority = "exposure supported; pressure loop not licensed"
    else:
        verdict = "PE-FAIL"
        authority = "exposure premise failed"

    out = {
        "test": "PRESSURE-EXPOSURE-LEARNING-LOOP",
        "protocol": "docs/learning-v3/PRESSURE_EXPOSURE_PREREG.md",
        "seed": SEED,
        "bootstrap_replicates": BOOTSTRAPS,
        "engine_searches_run": 0,
        "eligible_item_counts": dict(eligible_items),
        "missing_move_evaluations": int(missing),
        "n_rows_moves": int(len(df)),
        "n_unique_positions": int(df["position_id"].nunique()),
        "coefficients": {
            "OwnExposure_post_L_Epost": {h: coeffs["L_Epost"][h]["post_own_overloaded_piece_count"] for h in CLASSES},
            "OpponentPressure_post_L_Ppost": {h: coeffs["L_Ppost"][h]["post_opp_overloaded_piece_count"] for h in CLASSES},
            "OwnExposure_delta_L_Edelta": {h: coeffs["L_Edelta"][h]["delta_own_overloaded_piece_count"] for h in CLASSES},
            "OpponentPressure_delta_L_Pdelta": {h: coeffs["L_Pdelta"][h]["delta_opp_overloaded_piece_count"] for h in CLASSES},
            "combined_post": {
                h: {
                    "OwnExposure_post": coeffs["L_Epost_Ppost"][h]["post_own_overloaded_piece_count"],
                    "OpponentPressure_post": coeffs["L_Epost_Ppost"][h]["post_opp_overloaded_piece_count"],
                }
                for h in CLASSES
            },
            "combined_delta": {
                h: {
                    "OwnExposure_delta": coeffs["L_Edelta_Pdelta"][h]["delta_own_overloaded_piece_count"],
                    "OpponentPressure_delta": coeffs["L_Edelta_Pdelta"][h]["delta_opp_overloaded_piece_count"],
                }
                for h in CLASSES
            },
        },
        "overall": overall,
        "per_held_out_class": per_class,
        "decision_inputs": {"C1_exposure": c1, "C2_pressure": c2, "C3_incremental_pressure": c3, "C4_delta_consistency": c4},
        "verdict": verdict,
        "authority": authority,
        "does_not_establish": [
            "causal human learning effect",
            "optimal weighting between safety and pressure",
            "global system health",
            "generalization to all legal moves",
            "natural-game transfer",
        ],
    }
    print("===PE_RESULT_BEGIN===")
    print(json.dumps(out, indent=2, sort_keys=True))
    print("===PE_RESULT_END===")


if __name__ == "__main__":
    main()
