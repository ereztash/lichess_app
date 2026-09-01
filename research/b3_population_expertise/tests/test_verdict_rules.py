"""The gate set must be exhaustive and exclusive: exactly one verdict fires, for every input.

R4b FROM GATE 1 FOUND A HOLE. In the first draft, `beta` positive, significant and above the floor
but agreeing in fewer than 80% of bands fired NONE of the four gates -- `evaluate.py` would have had
nothing to print, on a perfectly ordinary result. The band-shape condition has moved to the
scientific-level ladder and the gates are now checked here on constructed inputs, including that
case.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import evaluate as ev  # noqa: E402

BANDS = ["800-999", "1000-1199", "1200-1399", "1400-1599", "1600-1799", "1800-1999",
         "2000-2199", "2200-2399", "2400-2599"]


def interval(point, lo=None, hi=None):
    if lo is None:
        lo, hi = (point * 0.5, point * 1.5) if point > 0 else (point * 1.5, point * 0.5)
    return {"point": point, "lo": lo, "hi": hi, "replicates": 400}


def band_table(points):
    return {b: {**interval(p), "n": 5000} for b, p in zip(BANDS, points)}


def analysis(*, beta=0.01, band_betas=None, tae_gradient=0.03, tae_spread=0.05,
             metric_a=-0.5, metric_d=-0.4, r2_gain=0.004, powered=None, controls_ok=True,
             c5b=0.8, c9_proxy=False, disjoint_ok=True, tae_extras_ok=True,
             metric_a_dead=False, metric_d_dead=False):
    powered = BANDS if powered is None else powered
    band_betas = band_betas or [0.01] * len(BANDS)
    dead = interval(0.0, -0.02, 0.02)
    period = {
        "n_decisions": 80000, "n_players": 2400, "n_games": 2400,
        "censored_voc_share": 0.09, "powered_bands": powered,
        "beta": interval(beta), "beta_by_band": band_table(band_betas),
        "beta_band_spearman": 0.7, "beta_sign_agreement": 1.0,
        "tae_by_band": band_table([0.01 + 0.01 * i for i in range(len(BANDS))]),
        "tae_rating_gradient": interval(tae_gradient), "tae_band_spearman": 0.9,
        "tae_spread_low_to_high": interval(tae_spread),
        "metric_a_time_vs_rating": dead if metric_a_dead else interval(metric_a),
        "extreme_ut_vs_rating": dead if metric_d_dead else interval(metric_d),
        "extreme_ut_band_spearman": -0.8,
        "allocation_loss_vs_rating": interval(-0.2), "allocation_loss_band_spearman": -0.7,
        "rating_on_quality": interval(-0.5),
    }
    good = interval(tae_gradient) if tae_extras_ok else dead
    return {
        "leakage_tests_passed": True,
        "periods": {"development": period, "validation": period, "final": period},
        "model_comparison": {"final": {"q1_minus_q0_r2": r2_gain}},
        "matched": {"final": {"beta": interval(beta), "tae_rating_gradient": good}},
        "player_level": {"final": {"tae_vs_rating_per_100elo": interval(tae_gradient)}},
        "player_disjoint_final": {"beta": interval(beta),
                                  "tae_rating_gradient": interval(tae_gradient)}
        if disjoint_ok else {},
        "c9": {"favours_difficulty_proxy": c9_proxy,
               "r_beta": interval(0.3, 0.1, 0.45) if c9_proxy else interval(0.9, 0.7, 1.2)},
        "controls": {"final": {
            "C5_planted_regularity": {"beta": interval(0.03)},
            "C5b_planted_foreign_residual": {"recovered_fraction": c5b},
            "C6_planted_expertise": {"tae_rating_gradient": interval(0.05)},
            "C7_no_effect_synthetic": {"beta": dead, "tae_rating_gradient": dead},
            "C1_shuffled_quality": {"beta": dead},
            "C2_shuffled_time": {"beta": dead},
            "C3_shuffled_rating": {"tae_rating_gradient": dead if controls_ok
                                   else interval(0.04)},
            "C4_shuffled_voc": {"tae_rating_gradient": dead if controls_ok else interval(0.04)},
            "C8_player_influence": {"relative_change": 0.05,
                                    "beta_without_busiest_1pct": interval(beta),
                                    "max_single_player_relative_shift": 0.03},
            "C14_clock_pressure_t0": {"tae_rating_gradient": good},
            "C17_no_zero_time": {"tae_rating_gradient": good},
        }},
    }


def test_exactly_one_gate_fires_on_a_supporting_result():
    out = ev.evaluate(analysis())
    assert out["verdict"] == "EXPERTISE_ADAPTATION_SUPPORTED"
    assert out["level"] == 4


def test_the_hole_gate_1_found_now_has_a_verdict():
    """beta positive, significant, above the floor, but band agreement fails.

    In the first draft this fired no gate at all.
    """
    out = ev.evaluate(analysis(band_betas=[0.01, -0.01, 0.01, -0.01, 0.01, -0.01, 0.01, -0.01,
                                           0.01]))
    assert out["verdict"] == "GENERAL_REGULARITY_ONLY"
    assert out["level"] == 2, "band agreement failing must cap the level at 2, not fire nothing"


def test_difficulty_proxy_only():
    out = ev.evaluate(analysis(beta=0.0002, r2_gain=0.0001))
    assert out["verdict"] == "DIFFICULTY_PROXY_ONLY"


def test_skill_only_when_h1_fails_but_the_model_still_gains():
    out = ev.evaluate(analysis(beta=0.0001, r2_gain=0.01, tae_gradient=0.0001,
                               metric_a_dead=True, metric_d_dead=True))
    assert out["verdict"] == "SKILL_ONLY"


def test_a_failed_negative_control_invalidates():
    out = ev.evaluate(analysis(controls_ok=False))
    assert out["verdict"] == "INVALID_EXPERIMENT"
    assert any("C3" in r or "C4" in r for r in out["reasons"])


def test_c5b_below_the_recovery_floor_invalidates():
    out = ev.evaluate(analysis(c5b=0.3))
    assert out["verdict"] == "INVALID_EXPERIMENT"
    assert any("C5b" in r for r in out["reasons"])


def test_an_absolute_tae_floor_cannot_be_passed_by_a_near_zero_base():
    """Gate 1, R3: the old relative floor passed on any positive difference near zero."""
    out = ev.evaluate(analysis(tae_spread=0.001))
    assert out["verdict"] == "GENERAL_REGULARITY_ONLY"
    assert "h2_tae_spread" in out["failed_conditions"]


def test_fewer_than_five_powered_bands_cannot_reach_level_4():
    out = ev.evaluate(analysis(powered=BANDS[:4]))
    assert out["verdict"] == "GENERAL_REGULARITY_ONLY"
    assert "h2_enough_bands" in out["failed_conditions"]


def test_c9_budget_reading_caps_the_level():
    out = ev.evaluate(analysis(c9_proxy=True))
    assert out["level"] == 2, "an attenuating beta must withhold level 3 and above"
    assert any("C9" in n for n in out["notes"])


def test_metric_c_alone_cannot_supply_the_second_metric():
    """Gate 1, R4e: Metric C is a transform of Metric B and must not count."""
    out = ev.evaluate(analysis(metric_a_dead=True, metric_d_dead=True))
    assert out["verdict"] == "GENERAL_REGULARITY_ONLY"
    assert "h2_second_metric" in out["failed_conditions"]
    # Metric C is significant and correctly signed in this fixture and still does not count.
    assert out["metrics"]["C_allocation_loss"]["role"].startswith("descriptive")


@pytest.mark.parametrize("kwargs", [
    {}, {"beta": -0.01}, {"beta": 0.0}, {"r2_gain": 0.0}, {"tae_gradient": -0.03},
    {"controls_ok": False}, {"c5b": 0.1}, {"disjoint_ok": False}, {"tae_extras_ok": False},
    {"powered": BANDS[:2]}, {"beta": 0.0005, "r2_gain": 0.02},
    {"metric_a_dead": True}, {"metric_a_dead": True, "metric_d_dead": True},
    {"tae_spread": 0.0}, {"c9_proxy": True},
])
def test_every_constructed_input_produces_exactly_one_verdict(kwargs):
    out = ev.evaluate(analysis(**kwargs))
    assert out["verdict"] in {
        "INVALID_EXPERIMENT", "DIFFICULTY_PROXY_ONLY", "SKILL_ONLY",
        "GENERAL_REGULARITY_ONLY", "EXPERTISE_ADAPTATION_SUPPORTED",
    }
