"""The whole analysis path, on a small real slice, so a name error cannot cost an hour.

This is not a scientific test. It exists because a `want()` helper defined below its first use
passed every unit test in the suite, ran for fifteen minutes on 160,000 decisions, and then raised
`UnboundLocalError` -- and the only thing that would have caught it is executing the path.

Skipped when the development corpus is not present, so a checkout without the data still runs green.
"""
import os
import sys

import pytest

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "src"))
DATA = os.path.join(HERE, "..", "data", "development", "decisions.jsonl.zst")

pytestmark = pytest.mark.skipif(not os.path.exists(DATA), reason="no scored development corpus")


@pytest.fixture(scope="module")
def slice_():
    import analysis as an
    import dataset

    frame = dataset.load(os.path.join(HERE, "..", "data", "development"))
    small = frame.sample(6000, random_state=0)
    constants = dataset.frozen_constants(small)
    prepared = dataset.apply_frozen(small, constants)
    groups = prepared["player"].to_numpy()
    fits, _ = an.fit_all(prepared, groups)
    scored = an.residualise(prepared, fits, {**constants, "ut_q95": 0.0})
    constants["ut_q95"] = float(scored["unexpected_time_population"].quantile(0.95))
    fits = an.fit_metric_nuisances(prepared, fits, groups, constants)
    scored = an.residualise(prepared, fits, constants)
    return prepared, scored, fits, constants, an


def test_estimate_runs_and_the_reduced_pass_agrees_on_what_it_computes(slice_):
    from estimands import estimate

    prepared, scored, fits, constants, an = slice_
    boot = an.PlayerBootstrap(scored["player"].to_numpy(), replicates=20)
    basis = an.RatingBasis(prepared["rating"].to_numpy(float))
    full = estimate(scored, boot, basis)
    reduced = estimate(scored, boot, basis, only=set())
    assert full["beta"]["point"] == reduced["beta"]["point"], (
        "the stratum fast path must not change a number it computes"
    )
    assert len(reduced) < len(full)
    for key in ("beta", "tae_rating_gradient", "metric_a_time_vs_rating", "beta_by_band",
                "tae_by_band", "rating_on_quality"):
        assert key in full


def test_every_control_runs(slice_):
    import controls as ctl

    prepared, scored, fits, constants, an = slice_
    basis = an.RatingBasis(prepared["rating"].to_numpy(float))
    out = ctl.run(prepared, scored, fits, constants, basis=basis,
                  which={"C1", "C2", "C3", "C4", "C5", "C5b", "C6", "C7", "C7b", "C8", "C10",
                         "C19"})
    for name in ("C1_shuffled_quality", "C2_shuffled_time", "C3_shuffled_rating",
                 "C4_shuffled_voc", "C5_planted_regularity", "C5b_planted_foreign_residual",
                 "C6_planted_expertise", "C7_no_effect_synthetic",
                 "C7b_omitted_difficulty_simulation", "C8_player_influence",
                 "C10_binary_outcome", "C19_own_pace_added"):
        assert name in out, f"{name} did not run"


def test_every_control_the_verdict_requires_is_produced(slice_):
    """A control that silently stops running must be impossible to miss.

    An edit removing stale duplicate blocks took C8 out with them, and nothing failed: the run
    completed, the analysis was written, and the key was simply absent. `evaluate.py` now treats an
    absent required control as INVALID, and this asserts the pipeline actually emits every one.
    """
    import controls as ctl
    from evaluate import REQUIRED_CONTROLS

    prepared, scored, fits, constants, an = slice_
    basis = an.RatingBasis(prepared["rating"].to_numpy(float))
    out = ctl.run(prepared, scored, fits, constants, basis=basis)
    missing = [name for name in REQUIRED_CONTROLS if name not in out]
    assert not missing, f"controls the verdict reads are not produced: {missing}"
    for extra in ("C8_player_influence", "C7b_omitted_difficulty_simulation",
                  "C11_no_book", "C14_clock_pressure_t0", "C17_no_zero_time"):
        assert extra in out, f"{extra} is not produced"


def test_a_destructive_control_reports_a_permutation_distribution(slice_):
    """The repair that mattered: an interval across permutations, not around one of them."""
    import controls as ctl

    prepared, scored, fits, constants, an = slice_
    basis = an.RatingBasis(prepared["rating"].to_numpy(float))
    out = ctl.run(prepared, scored, fits, constants, basis=basis, which={"C1", "C3"})
    for key, field in (("C1_shuffled_quality", "beta"),
                       ("C3_shuffled_rating", "tae_rating_gradient")):
        cell = out[key][field]
        assert cell["permutations"] >= 50, f"{key} is not a permutation test"
        assert "sd" in cell, f"{key} does not report the spread of its own null"
        assert cell["lo"] <= cell["point"] <= cell["hi"]


def test_matching_and_player_level_run(slice_):
    import matching
    from estimands import player_level

    prepared, scored, fits, constants, an = slice_
    basis = an.RatingBasis(prepared["rating"].to_numpy(float))
    matched, balance = matching.match(scored)
    assert "cells" in balance
    matching.matched_estimates(matched, basis)   # must not raise, even on an empty match
    player_level(scored)                         # likewise, even with too few eligible players
