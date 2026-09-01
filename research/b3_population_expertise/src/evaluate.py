"""VERDICT_RULES.md, transcribed. Applied mechanically, before any narrative exists.

Every threshold below is a literal from that document and was fixed before the FINAL period was
opened. This file makes no judgement calls: it reads `results/analysis.json` and prints a verdict.
If a rule and this code disagree, the code is wrong.
"""
from __future__ import annotations

import argparse
import json
import math

BETA_FLOOR = 0.002
MONOTONE_RHO = 0.6
SIGN_AGREEMENT = 0.80
TAE_RELATIVE_GAIN = 0.20
CENSOR_LIMIT = 0.15
R2_GAIN_FLOOR = 0.001
PLAYER_INFLUENCE_LIMIT = 0.25
JACKKNIFE_LIMIT = 0.20


def excludes_zero(interval) -> bool:
    lo, hi = interval.get("lo"), interval.get("hi")
    if lo is None or hi is None or not (math.isfinite(lo) and math.isfinite(hi)):
        return False
    return lo > 0 or hi < 0


def contains_zero(interval) -> bool:
    lo, hi = interval.get("lo"), interval.get("hi")
    if lo is None or hi is None or not (math.isfinite(lo) and math.isfinite(hi)):
        return True
    return lo <= 0 <= hi


def signed(interval, expected: int) -> bool:
    """Interval excludes zero AND the point estimate has the preregistered sign."""
    return excludes_zero(interval) and (interval["point"] > 0) == (expected > 0)


def evaluate(analysis: dict) -> dict:
    final = analysis["periods"]["final"]
    controls = analysis["controls"]["final"]
    reasons: list[str] = []
    checks: dict[str, bool] = {}

    # --- 2.1 INVALID_EXPERIMENT -----------------------------------------------------------------
    invalid: list[str] = []
    if not analysis["leakage_tests_passed"]:
        invalid.append("leakage tests failed")
    if analysis.get("holdout_contaminated"):
        return {"verdict": "HOLDOUT_CONTAMINATED", "level": None,
                "reasons": ["the final holdout was inspected before Gate 2 passed"]}
    c5 = controls.get("C5_planted_regularity", {}).get("beta", {})
    if not excludes_zero(c5) or c5.get("point", 0) <= 0:
        invalid.append("C5 failed: a planted regularity was not recovered")
    c6 = controls.get("C6_planted_expertise", {}).get("tae_rating_gradient", {})
    if not signed(c6, +1):
        invalid.append("C6 failed: a planted expertise gradient was not recovered")
    c7 = controls.get("C7_no_effect_synthetic", {})
    if c7 and (excludes_zero(c7.get("beta", {}))
               or excludes_zero(c7.get("tae_rating_gradient", {}))):
        invalid.append("C7 failed: the pipeline reported the hypothesis on data built without it")
    for name, key in (("C1", "C1_shuffled_quality"), ("C2", "C2_shuffled_time")):
        if excludes_zero(controls.get(key, {}).get("beta", {})):
            invalid.append(f"{name} failed: a destroyed association survived its destruction")
    if excludes_zero(controls.get("C3_shuffled_rating", {}).get("tae_rating_gradient", {})):
        invalid.append("C3 failed: shuffled rating reproduced an expertise gradient")
    if excludes_zero(controls.get("C4_shuffled_voc", {}).get("tae_rating_gradient", {})):
        invalid.append("C4 failed: shuffled value-of-computation preserved the allocation signal")
    if final["censored_voc_share"] > CENSOR_LIMIT:
        invalid.append(f"voc_regret censoring {final['censored_voc_share']:.1%} exceeds "
                       f"{CENSOR_LIMIT:.0%}")
    if analysis.get("engine_nondeterminism_detected"):
        invalid.append("engine nondeterminism detected against the recorded run")
    if invalid:
        return {"verdict": "INVALID_EXPERIMENT", "level": None, "reasons": invalid, "checks": checks}

    beta = final["beta"]
    r2_gain = analysis["model_comparison"]["final"]["q1_minus_q0_r2"]

    # --- H1 ------------------------------------------------------------------------------------
    checks["h1_interval_excludes_zero"] = excludes_zero(beta)
    checks["h1_positive"] = beta["point"] > 0
    checks["h1_above_floor"] = abs(beta["point"]) >= BETA_FLOOR
    checks["h1_band_agreement"] = final["beta_sign_agreement"] >= SIGN_AGREEMENT
    h1_holds = all(checks[k] for k in
                   ("h1_interval_excludes_zero", "h1_positive", "h1_above_floor",
                    "h1_band_agreement"))

    # --- 2.2 DIFFICULTY_PROXY_ONLY ---------------------------------------------------------------
    if (contains_zero(beta) or abs(beta["point"]) < BETA_FLOOR) and r2_gain < R2_GAIN_FLOOR:
        return {"verdict": "DIFFICULTY_PROXY_ONLY", "level": 1 if h1_holds else 0,
                "reasons": [f"beta = {beta['point']:.5f} "
                            f"[{beta['lo']:.5f}, {beta['hi']:.5f}], floor {BETA_FLOOR}; "
                            f"Q1 adds {r2_gain:.5f} held-out R^2 over Q0"],
                "checks": checks}

    # --- H2 metrics ------------------------------------------------------------------------------
    metric_specs = [
        ("A_matched_time", final["metric_a_time_vs_rating"], -1, None, None),
        ("B_time_allocation_efficiency", final["tae_rating_gradient"], +1,
         final["tae_band_spearman"], +1),
        ("C_allocation_loss", final["allocation_loss_vs_rating"], -1,
         final["allocation_loss_band_spearman"], -1),
        ("D_extreme_ut_exposure", final["extreme_ut_vs_rating"], -1,
         final["extreme_ut_band_spearman"], -1),
    ]
    metrics_passing = []
    metric_detail = {}
    for name, interval, expected, rho, rho_sign in metric_specs:
        directional = signed(interval, expected)
        if rho is None:
            monotone = True  # Metric A has no band-level shape requirement of its own
        else:
            monotone = math.isfinite(rho) and (rho * rho_sign) >= MONOTONE_RHO
        metric_detail[name] = {"interval": interval, "expected_sign": expected,
                               "directional": directional, "band_spearman": rho,
                               "monotone_enough": monotone, "passes": directional and monotone}
        if directional and monotone:
            metrics_passing.append(name)
    checks["h2_two_metrics"] = len(metrics_passing) >= 2
    checks["h2_includes_tae"] = "B_time_allocation_efficiency" in metrics_passing

    # 2.5.5 -- the TAE spread between the extreme powered bands
    powered = final["powered_bands"]
    tae_gain_ok = False
    tae_gain = None
    if len(powered) >= 2:
        low = final["tae_by_band"][powered[0]]
        high = final["tae_by_band"][powered[-1]]
        if math.isfinite(low["point"]) and low["point"] != 0:
            tae_gain = (high["point"] - low["point"]) / abs(low["point"])
            spread = final.get("tae_spread_low_to_high", {})
            tae_gain_ok = tae_gain >= TAE_RELATIVE_GAIN and excludes_zero(spread)
    checks["h2_tae_spread"] = tae_gain_ok

    checks["h2_player_level"] = signed(
        analysis["player_level"]["final"].get("tae_vs_rating_per_100elo", {}), +1
    )
    checks["c3_passes"] = contains_zero(
        controls.get("C3_shuffled_rating", {}).get("tae_rating_gradient", {})
    )
    checks["c4_passes"] = contains_zero(
        controls.get("C4_shuffled_voc", {}).get("tae_rating_gradient", {})
    )
    influence = controls.get("C8_player_influence", {})
    checks["c8_passes"] = (
        influence.get("relative_change", 1.0) <= PLAYER_INFLUENCE_LIMIT
        and excludes_zero(influence.get("beta_without_busiest_1pct", {}))
        and influence.get("max_single_player_relative_shift", 1.0) <= JACKKNIFE_LIMIT
    )
    matched = analysis["matched"]["final"]
    checks["matched_consistent"] = (
        matched.get("beta", {}).get("point", 0) > 0
        and matched.get("tae_rating_gradient", {}).get("point", 0) > 0
    )
    dev, val = analysis["periods"]["development"], analysis["periods"]["validation"]
    checks["temporal_sign_agreement"] = (
        (dev["beta"]["point"] > 0) == (beta["point"] > 0)
        and (val["beta"]["point"] > 0) == (beta["point"] > 0)
        and (dev["tae_rating_gradient"]["point"] > 0)
        == (final["tae_rating_gradient"]["point"] > 0)
        and (val["tae_rating_gradient"]["point"] > 0)
        == (final["tae_rating_gradient"]["point"] > 0)
    )
    disjoint = analysis.get("player_disjoint_final", {})
    checks["player_disjoint_holds"] = bool(disjoint) and signed(disjoint.get("beta", {}), +1) and (
        abs(disjoint.get("beta", {}).get("point", 0)) >= BETA_FLOOR
    ) and signed(disjoint.get("tae_rating_gradient", {}), +1)

    # --- 2.3 SKILL_ONLY ---------------------------------------------------------------------------
    rating_on_quality = final.get("rating_on_quality", {})
    if not h1_holds and len(metrics_passing) < 2:
        return {
            "verdict": "SKILL_ONLY", "level": 0,
            "reasons": [f"beta = {beta['point']:.5f} [{beta['lo']:.5f}, {beta['hi']:.5f}] does not "
                        f"clear the bar, and only {len(metrics_passing)} expertise metric(s) "
                        f"({metrics_passing}) meet their conditions"],
            "checks": checks, "metrics": metric_detail,
            "rating_on_quality": rating_on_quality,
        }

    # --- 2.5 EXPERTISE_ADAPTATION_SUPPORTED --------------------------------------------------------
    required = [
        "h1_interval_excludes_zero", "h1_positive", "h1_above_floor", "h1_band_agreement",
        "h2_two_metrics", "h2_includes_tae", "h2_tae_spread", "h2_player_level",
        "c3_passes", "c4_passes", "c8_passes", "matched_consistent",
        "temporal_sign_agreement", "player_disjoint_holds",
    ]
    failed = [name for name in required if not checks.get(name)]
    if not failed:
        verdict, level = "EXPERTISE_ADAPTATION_SUPPORTED", 4
        secondary = analysis.get("secondary_time_control", {})
        cross = (signed(secondary.get("beta", {}), +1)
                 and signed(secondary.get("tae_rating_gradient", {}), +1))
        if cross:
            level = 5
        return {"verdict": verdict, "level": level,
                "secondary_label": "CROSS_CONTEXT_REGULARITY" if cross else None,
                "reasons": ["every condition in VERDICT_RULES.md 2.5 held on the final period"],
                "checks": checks, "metrics": metric_detail,
                "tae_relative_gain": tae_gain}

    # --- 2.4 GENERAL_REGULARITY_ONLY ---------------------------------------------------------------
    if h1_holds:
        level = 2 if r2_gain >= R2_GAIN_FLOOR else 1
        if level == 2 and math.isfinite(final["beta_band_spearman"]):
            if final["beta_sign_agreement"] >= SIGN_AGREEMENT:
                level = 3
        return {"verdict": "GENERAL_REGULARITY_ONLY", "level": level,
                "reasons": [f"H1 holds (beta = {beta['point']:.5f} "
                            f"[{beta['lo']:.5f}, {beta['hi']:.5f}]); "
                            f"the expertise conditions that failed: {failed}"],
                "checks": checks, "metrics": metric_detail, "tae_relative_gain": tae_gain}

    return {"verdict": "SKILL_ONLY", "level": 0,
            "reasons": [f"H1 does not hold and the expertise conditions that failed: {failed}"],
            "checks": checks, "metrics": metric_detail}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", default="results/analysis.json")
    ap.add_argument("--out", default="results/verdict.json")
    args = ap.parse_args()
    analysis = json.load(open(args.analysis))
    verdict = evaluate(analysis)
    json.dump(verdict, open(args.out, "w"), indent=1)
    print(json.dumps({k: verdict[k] for k in ("verdict", "level", "reasons")}, indent=1))


if __name__ == "__main__":
    main()
