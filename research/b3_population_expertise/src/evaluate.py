"""VERDICT_RULES.md, transcribed. Applied mechanically, before any narrative exists.

Every threshold below is a literal from that document and was fixed before the FINAL period was
opened. This file makes no judgement calls: it reads `results/analysis_final.json` and prints a
verdict. If a rule and this code disagree, the code is wrong.

The gate set is checked for EXHAUSTIVENESS at the end: exactly one gate must fire. A rule set that
can fire twice, or leave a case with nothing to print, is not a rule set -- and the first draft had
exactly that hole (Gate 1, R4b).
"""
from __future__ import annotations

import argparse
import json
import math

BETA_FLOOR = 0.002
TAE_FLOOR = 0.02            # absolute, in log-seconds per DEVELOPMENT sd of VoC (Gate 1, R3)
MONOTONE_RHO = 0.6
SIGN_AGREEMENT = 0.80
MIN_POWERED_BANDS = 5       # Gate 1, R4d
CENSOR_LIMIT = 0.15
R2_GAIN_FLOOR = 0.001
PLAYER_INFLUENCE_LIMIT = 0.25
JACKKNIFE_LIMIT = 0.20
C5B_RECOVERY_FLOOR = 0.5    # Gate 1, R11
R_BETA_THRESHOLD = 0.5      # Gate 1, R12


def excludes_zero(interval) -> bool:
    lo, hi = (interval or {}).get("lo"), (interval or {}).get("hi")
    if lo is None or hi is None or not (math.isfinite(lo) and math.isfinite(hi)):
        return False
    return lo > 0 or hi < 0


def contains_zero(interval) -> bool:
    return not excludes_zero(interval)


REQUIRED_CONTROLS = {
    "C1_shuffled_quality": ("beta",),
    "C2_shuffled_time": ("beta",),
    "C3_shuffled_rating": ("tae_rating_gradient", "metric_a_time_vs_rating",
                           "extreme_ut_vs_rating"),
    "C4_shuffled_voc": ("tae_rating_gradient",),
    "C5_planted_regularity": ("beta",),
    "C5b_planted_foreign_residual": ("recovered_fraction",),
    "C6_planted_expertise": ("tae_rating_gradient",),
    "C7_no_effect_synthetic": ("beta", "tae_rating_gradient", "metric_a_time_vs_rating",
                               "extreme_ut_vs_rating"),
}


def missing_or_malformed(controls: dict) -> list[str]:
    """A required control that did not run cannot pass (re-review, N4i and N4ii).

    The first draft guarded every control check with `if present`, so an `analysis.json` with no
    C5b and no C7 at all returned the strongest verdict with "conditions that failed: none". The
    shape `controls.py` writes when a control raises -- `{"note": "not computable: ..."}` -- did the
    same. Absence is now a failure, named.
    """
    problems = []
    for name, fields in REQUIRED_CONTROLS.items():
        payload = controls.get(name)
        if not isinstance(payload, dict) or not payload:
            problems.append(f"{name} is absent")
            continue
        if "note" in payload and not any(f in payload for f in fields):
            problems.append(f"{name} did not run: {payload['note']}")
            continue
        for field in fields:
            value = payload.get(field)
            if value is None:
                problems.append(f"{name}.{field} is absent")
            elif isinstance(value, dict):
                if not all(math.isfinite(value.get(k, float("nan"))) for k in ("point", "lo", "hi")):
                    problems.append(f"{name}.{field} has a non-finite interval")
            elif not math.isfinite(value):
                problems.append(f"{name}.{field} is not finite")
    return problems


def signed(interval, expected: int) -> bool:
    """Interval excludes zero AND the point estimate has the preregistered sign."""
    if not excludes_zero(interval):
        return False
    return (interval["point"] > 0) == (expected > 0)


def sign_agreement(table, bands, expected: int) -> tuple[int, int, bool]:
    """RAW band estimates, `ceil` rounding (Gate 1, R4c and R4d).

    Shrunk estimates are for figures. Partial pooling with unequal band variances can reorder
    bands, and a shape test run on reordered points is a test of the shrinkage.
    """
    points = [table[b]["point"] for b in bands]
    agree = sum(1 for p in points if math.isfinite(p) and ((p > 0) == (expected > 0)))
    needed = math.ceil(SIGN_AGREEMENT * len(bands)) if bands else 0
    return agree, needed, bool(bands) and agree >= needed


def evaluate(analysis: dict) -> dict:
    final = analysis["periods"]["final"]
    controls = analysis["controls"]["final"]
    checks: dict[str, bool] = {}
    notes: list[str] = []

    # --- 2.1 INVALID_EXPERIMENT ------------------------------------------------------------------
    invalid: list[str] = []
    if not analysis.get("leakage_tests_passed"):
        invalid.append("leakage tests failed")
    invalid.extend(missing_or_malformed(controls))
    if analysis.get("holdout_contaminated"):
        return {"verdict": "HOLDOUT_CONTAMINATED", "level": None,
                "reasons": ["the final holdout was inspected before Gate 2 passed"]}
    c5 = controls.get("C5_planted_regularity", {}).get("beta", {})
    if not excludes_zero(c5) or c5.get("point", 0) <= 0:
        invalid.append("C5 failed: the implementation check did not recover its own regressor")
    c5b = controls.get("C5b_planted_foreign_residual", {})
    recovered = c5b.get("recovered_fraction")
    if recovered is not None and math.isfinite(recovered) and recovered < C5B_RECOVERY_FLOOR:
        invalid.append(f"C5b failed: the pipeline recovered {recovered:.2f} of a signal defined "
                       f"outside its own residual, below the {C5B_RECOVERY_FLOOR} floor")
    c6 = controls.get("C6_planted_expertise", {}).get("tae_rating_gradient", {})
    if not signed(c6, +1):
        invalid.append("C6 failed: a planted expertise gradient was not recovered")
    c7 = controls.get("C7_no_effect_synthetic", {})
    for gradient in REQUIRED_CONTROLS["C7_no_effect_synthetic"]:
        if excludes_zero(c7.get(gradient, {})):
            invalid.append(f"C7 failed: the pipeline reported {gradient} on data built without it")
    for name, key in (("C1", "C1_shuffled_quality"), ("C2", "C2_shuffled_time")):
        if excludes_zero(controls.get(key, {}).get("beta", {})):
            invalid.append(f"{name} failed: a destroyed association survived its destruction")
    # C3 and C7 are checked on EVERY H2 gradient, as MODEL_SPEC.md §9 says, not on Metric B alone.
    for gradient in REQUIRED_CONTROLS["C3_shuffled_rating"]:
        if excludes_zero(controls.get("C3_shuffled_rating", {}).get(gradient, {})):
            invalid.append(f"C3 failed: shuffled rating reproduced {gradient}")
    if excludes_zero(controls.get("C4_shuffled_voc", {}).get("tae_rating_gradient", {})):
        invalid.append("C4 failed: shuffled value-of-computation preserved the allocation signal")
    dev_censoring = analysis["periods"]["development"]["censored_voc_share"]
    if dev_censoring > CENSOR_LIMIT:
        invalid.append(f"voc_regret censoring on DEVELOPMENT is {dev_censoring:.1%}, above "
                       f"{CENSOR_LIMIT:.0%} -- the definition is unusable as specified")
    if analysis.get("engine_nondeterminism_detected"):
        invalid.append("engine nondeterminism detected against the recorded run")

    beta = final["beta"]
    r2_gain = analysis["model_comparison"]["final"]["q1_minus_q0_r2"]
    powered = final["powered_bands"]
    enough_bands = len(powered) >= MIN_POWERED_BANDS

    # --- H1 ---------------------------------------------------------------------------------------
    checks["h1_interval_excludes_zero"] = excludes_zero(beta)
    checks["h1_positive"] = beta["point"] > 0
    checks["h1_above_floor"] = abs(beta["point"]) >= BETA_FLOOR
    h1_holds = all(checks[k] for k in
                   ("h1_interval_excludes_zero", "h1_positive", "h1_above_floor"))

    agree, needed, band_shape = sign_agreement(final["beta_by_band"], powered, +1)
    checks["h1_band_agreement"] = band_shape and enough_bands
    notes.append(f"beta agrees in sign in {agree}/{len(powered)} adequately powered bands "
                 f"(needed {needed}); Spearman across bands "
                 f"{final.get('beta_band_spearman', float('nan')):.2f}")

    # --- H2 metrics ---------------------------------------------------------------------------------
    # Metrics C and E are DESCRIPTIVE and cannot count (Gate 1, R4e): C is a transform of B.
    # Metric A is a POOLED slope and is judged directionally only (re-review, N4iv): inside a
    # 200-point band there is little rating variation left to identify it from, so requiring a band
    # shape of it would be requiring a shape of a quantity that has none. Its band table is computed
    # and reported for the figures; the verdict reads the pooled slope.
    metric_specs = [
        ("A_matched_time", final["metric_a_time_vs_rating"], -1, None, None),
        ("B_time_allocation_efficiency", final["tae_rating_gradient"], +1,
         final.get("tae_band_spearman"), +1),
        ("D_extreme_ut_exposure", final["extreme_ut_vs_rating"], -1,
         final.get("extreme_ut_band_spearman"), -1),
    ]
    metric_detail, passing = {}, []
    for name, interval, expected, rho, rho_sign in metric_specs:
        directional = signed(interval, expected)
        monotone = True if rho is None else (math.isfinite(rho) and (rho * rho_sign) >= MONOTONE_RHO)
        metric_detail[name] = {"interval": interval, "expected_sign": expected,
                               "directional": directional, "band_spearman": rho,
                               "monotone_enough": monotone, "passes": directional and monotone}
        if directional and monotone:
            passing.append(name)
    metric_detail["C_allocation_loss"] = {"interval": final["allocation_loss_vs_rating"],
                                          "role": "descriptive; a transform of Metric B"}
    metric_detail["E_friction_burden"] = {"role": "descriptive; no directional prediction"}

    checks["h2_includes_tae"] = "B_time_allocation_efficiency" in passing
    checks["h2_second_metric"] = any(m in passing for m in
                                     ("A_matched_time", "D_extreme_ut_exposure"))

    # Condition 5: Metric B four times over (Gate 1, R2).
    matched = analysis["matched"]["final"]
    checks["h2_tae_matched"] = signed(matched.get("tae_rating_gradient", {}), +1)
    checks["h2_tae_no_zero_time"] = signed(
        controls.get("C17_no_zero_time", {}).get("tae_rating_gradient", {}), +1)
    checks["h2_tae_low_clock_pressure"] = signed(
        controls.get("C14_clock_pressure_t0", {}).get("tae_rating_gradient", {}), +1)
    spread = final.get("tae_spread_low_to_high", {})
    checks["h2_tae_spread"] = (excludes_zero(spread)
                               and spread.get("point", 0) >= TAE_FLOOR)
    checks["h2_enough_bands"] = enough_bands

    checks["h2_player_level"] = signed(
        analysis["player_level"]["final"].get("tae_vs_rating_per_100elo", {}), +1)
    checks["c3_passes"] = contains_zero(
        controls.get("C3_shuffled_rating", {}).get("tae_rating_gradient", {}))
    checks["c4_passes"] = contains_zero(
        controls.get("C4_shuffled_voc", {}).get("tae_rating_gradient", {}))
    influence = controls.get("C8_player_influence", {})
    checks["c8_passes"] = (
        influence.get("relative_change", 1.0) <= PLAYER_INFLUENCE_LIMIT
        and excludes_zero(influence.get("beta_without_busiest_1pct", {}))
        and influence.get("max_single_player_relative_shift", 1.0) <= JACKKNIFE_LIMIT
    )
    checks["matched_beta_consistent"] = matched.get("beta", {}).get("point", 0) > 0
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

    # --- gates, in order; exactly one must fire ------------------------------------------------------
    required = [
        "h1_interval_excludes_zero", "h1_positive", "h1_above_floor", "h1_band_agreement",
        "h2_includes_tae", "h2_second_metric", "h2_tae_matched", "h2_tae_no_zero_time",
        "h2_tae_low_clock_pressure", "h2_tae_spread", "h2_enough_bands", "h2_player_level",
        "c3_passes", "c4_passes", "c8_passes", "matched_beta_consistent",
        "temporal_sign_agreement", "player_disjoint_holds",
    ]
    failed = [name for name in required if not checks.get(name)]

    gates = {}
    gates["INVALID_EXPERIMENT"] = bool(invalid)
    gates["DIFFICULTY_PROXY_ONLY"] = (
        not gates["INVALID_EXPERIMENT"]
        and ((contains_zero(beta) or abs(beta["point"]) < BETA_FLOOR)
             and r2_gain < R2_GAIN_FLOOR)
    )
    gates["EXPERTISE_ADAPTATION_SUPPORTED"] = (
        not gates["INVALID_EXPERIMENT"] and not gates["DIFFICULTY_PROXY_ONLY"] and not failed
    )
    gates["GENERAL_REGULARITY_ONLY"] = (
        not gates["INVALID_EXPERIMENT"] and not gates["DIFFICULTY_PROXY_ONLY"]
        and not gates["EXPERTISE_ADAPTATION_SUPPORTED"] and h1_holds
    )
    # The metric bar met while H1 fails is a real, surprising outcome that the first draft printed
    # as SKILL_ONLY -- the wrong name for it (re-review, N2). It is off the level ladder in §3,
    # which is built around the regularity.
    gates["ADAPTATION_WITHOUT_REGULARITY"] = (
        not any(gates.values()) and checks["h2_includes_tae"] and checks["h2_second_metric"]
    )
    gates["SKILL_ONLY"] = not any(gates.values())

    fired = [name for name, on in gates.items() if on]
    assert len(fired) == 1, f"the gate set is not exhaustive and exclusive: {fired}"
    verdict = fired[0]

    # --- scientific level -----------------------------------------------------------------------------
    if verdict == "INVALID_EXPERIMENT":
        level = None
    elif verdict == "EXPERTISE_ADAPTATION_SUPPORTED":
        level = 4
        secondary = analysis.get("secondary_time_control", {})
        cross = signed(secondary.get("beta", {}), +1) and signed(
            secondary.get("tae_rating_gradient", {}), +1)
        if cross and checks["temporal_sign_agreement"]:
            level = 5
    elif verdict == "ADAPTATION_WITHOUT_REGULARITY":
        level = 0
        notes.append("off the scientific-level ladder: the expertise metric bar is met while the "
                     "regularity the ladder is built around is not")
    elif h1_holds:
        level = 1
        if r2_gain >= R2_GAIN_FLOOR:
            level = 2
        if level == 2 and checks["h1_band_agreement"] and math.isfinite(
                final.get("beta_band_spearman", float("nan"))):
            level = 3
    else:
        level = 0

    # 2.5c -- the C9 budget reading caps the level regardless of which gate fired (Gate 1, R12).
    c9 = analysis.get("c9", {})
    c9_caps = bool(c9.get("favours_difficulty_proxy"))
    if c9_caps and level is not None and level >= 3:
        notes.append(f"C9: r_beta upper bound {c9.get('r_beta', {}).get('hi')} is below "
                     f"{R_BETA_THRESHOLD}; level capped at 2 and level-3+ language withheld")
        level = 2

    out = {
        "verdict": verdict,
        "level": level,
        "reasons": invalid if verdict == "INVALID_EXPERIMENT" else
        [f"beta = {beta['point']:.5f} [{beta['lo']:.5f}, {beta['hi']:.5f}], floor {BETA_FLOOR}; "
         f"Q1 - Q0 held-out R^2 = {r2_gain:.5f}; conditions that failed: {failed or 'none'}"],
        "checks": checks,
        "failed_conditions": failed,
        "metrics": metric_detail,
        "adequately_powered_bands": powered,
        "band_sign_agreement": {"agree": agree, "of": len(powered), "needed": needed},
        "tae_spread": spread,
        "c9_reading": c9.get("reading"),
        # Reported beside SKILL_ONLY as facts, never as conditions (re-review, N2).
        "rating_on_quality": final.get("rating_on_quality"),
        "h2_metrics_meeting_the_bar": passing,
        "development_censored_voc_share": dev_censoring,
        "final_censored_voc_share": final["censored_voc_share"],
        "c5b_recovered_fraction": recovered,
        "notes": notes,
        "label_means": ("the time / value-of-computation relation differs systematically with "
                        "rating, net of matched position and clock state -- NOT that expertise "
                        "changes how players manage the process (VERDICT_RULES.md 3.1)"),
    }
    if verdict == "EXPERTISE_ADAPTATION_SUPPORTED" and level == 5:
        out["secondary_label"] = "CROSS_CONTEXT_REGULARITY"
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", default="results/analysis_final.json")
    ap.add_argument("--out", default="results/verdict.json")
    args = ap.parse_args()
    verdict = evaluate(json.load(open(args.analysis)))
    json.dump(verdict, open(args.out, "w"), indent=1, default=float)
    print(json.dumps({k: verdict[k] for k in
                      ("verdict", "level", "reasons", "failed_conditions", "notes")},
                     indent=1, default=float))


if __name__ == "__main__":
    main()
