"""Diagnostics the report is obliged to carry, computed from the frozen pipeline.

None of these is an estimand and none enters a verdict. They exist because Gate 3 ruled that
several sentences the draft report wanted to write are not supported by the primary numbers alone,
and required the supporting decompositions to be printed beside them:

  F-B1  `beta` under a capped outcome, and where its numerator comes from.
  F-B2  `beta` on the decisions where the player played the engine's own first line.
  F-B3  `beta` by standing, beside the scale of the outcome in each standing.
  F-N1  what the value-of-computation instrument actually is: its point mass, its partial
        correlation, and whether it responds to the clock.
  F-N2  the cancellation inside the Metric B gradient: the zero-regret rows, the rest, and the
        response of residual time to PREDICTED value of computation.
  F-N3  the spread the design could detect at 80% power, beside the preregistered floor.
  F-N4  what coarsened exact matching selected, and how balance moved.
  F-O3  Metric A with the `T = 0` rows removed, and their share by band.
  F-O4  the frozen models' per-band residual means (Gate 1 recommendation 6).
  A7.5  every headline quantity under three estimators: frozen, three-parameter, refit.

Nothing here re-reads, re-scores or re-samples any period. It reads the same stored features the
analysis read and applies the same frozen fits, plus -- for the "refit" column only -- the same
recipe fitted on the period being described, which is a diagnostic of drift and is labelled as one
everywhere it appears.

Run:  python src/report_diagnostics.py
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
from common import BAND_LABELS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERIODS = ("development", "validation", "final")
BANDS_ACROSS_RANGE = 18.0  # 800 -> 2600 in units of 100 Elo, for the power statement


def _ols(y, columns):
    """Least squares with an intercept; returns the coefficient vector without it."""
    x = np.column_stack([np.ones(len(y))] + [np.asarray(c, float) for c in columns])
    return np.linalg.lstsq(x, np.asarray(y, float), rcond=None)[0][1:]


def _grad(y, x, rating, basis):
    return an.gradient_with_main_effect(y, x, (rating - 1600.0) / 100.0, basis.transform(rating))[1]


def _main(y, x, rating, basis):
    return an.gradient_with_main_effect(y, x, (rating - 1600.0) / 100.0, basis.transform(rating))[0]


def _sd(boot, statistic):
    """The bootstrap standard deviation, which the power statement needs and an interval hides."""
    values = [statistic(boot.indices(r)) for r in range(boot.replicates)]
    values = [v for v in values if np.isfinite(v)]
    return float(np.std(values, ddof=1)) if len(values) > 2 else float("nan")


def refit_estimates(frame):
    """The same recipe fitted on this period. A drift diagnostic, never a reported estimate."""
    groups = frame["player"].to_numpy()
    fits, _ = an.fit_all(frame, groups)
    constants = dataset.frozen_constants(frame)
    scored = an.residualise(frame, fits, {**constants, "ut_q95": 0.0})
    constants["ut_q95"] = float(np.quantile(scored["unexpected_time_population"], 0.95))
    fits = an.fit_metric_nuisances(frame, fits, groups, constants)
    scored = an.residualise(frame, fits, constants)
    basis = an.RatingBasis(frame["rating"].to_numpy(float))
    rating = scored["rating"].to_numpy(float)
    return {
        "beta": float(an.slope(scored["q_resid"].to_numpy(float),
                               scored["ut_resid"].to_numpy(float))),
        "metric_a": float(100.0 * an.slope(scored["y_resid_T1"].to_numpy(float),
                                           scored["rating_resid"].to_numpy(float))),
        "tae_rating_gradient": float(_grad(scored["y_resid_T1"].to_numpy(float),
                                           scored["voc_resid"].to_numpy(float), rating, basis)),
    }


def diagnostics_for(scored, basis, boot):
    q = scored["q_resid"].to_numpy(float)
    u = scored["ut_resid"].to_numpy(float)
    y = scored["y_resid_T1"].to_numpy(float)
    v = scored["voc_resid"].to_numpy(float)
    rating = scored["rating"].to_numpy(float)
    loss = scored["quality_loss"].to_numpy(float)
    seconds = scored["seconds_taken"].to_numpy(float)
    qhat = loss - q
    uthat = scored["unexpected_time_population"].to_numpy(float) - u
    vochat = scored["voc_z"].to_numpy(float) - v
    ratinghat = rating - scored["rating_resid"].to_numpy(float)
    out = {}

    # ---- A7.5: the same quantity under three estimators -------------------------------------
    out["beta_frozen"] = float(an.slope(q, u))
    out["beta_3param"] = float(_ols(loss, [scored["unexpected_time_population"].to_numpy(float),
                                           qhat, uthat])[0])
    out["metric_a_frozen"] = float(100.0 * an.slope(y, scored["rating_resid"].to_numpy(float)))
    out["metric_a_3param"] = float(100.0 * _ols(
        scored["log_time"].to_numpy(float),
        [rating, scored["yhat_T1P"].to_numpy(float), ratinghat])[0])

    # ---- F-B1: where beta comes from ---------------------------------------------------------
    # The outcome is capped and regressed on the SAME frozen time residual: the question is which
    # part of the quality scale carries the association, not what a differently-adjusted model says.
    for cap in (0.05, 0.1, 0.2, 0.5):
        out[f"beta_capped_{cap}"] = float(an.slope(np.minimum(loss, cap), u))
    out["share_loss_above_0.05"] = float(np.mean(loss > 0.05))
    out["share_loss_above_0.1"] = float(np.mean(loss > 0.1))
    deciles = pd.qcut(u, 10, labels=False, duplicates="drop")
    contribution = (q - q.mean()) * (u - u.mean())
    extreme = np.isin(deciles, [0, 9])
    out["numerator_share_extreme_ut_deciles"] = float(
        contribution[extreme].sum() / contribution.sum())

    # ---- F-B2: the decisions where the engine's own move was played --------------------------
    best = np.array([t["top_moves"][0] if t.get("top_moves") else ""
                     for t in scored["trace"].to_numpy()], dtype=object)
    played_best = (scored["move_uci"].to_numpy(dtype=object) == best)
    out["share_played_engine_best"] = float(np.mean(played_best))
    out["beta_when_engine_move_played"] = boot.interval(
        lambda i: an.slope(q[i][played_best[i]], u[i][played_best[i]]))
    out["beta_when_engine_move_not_played"] = boot.interval(
        lambda i: an.slope(q[i][~played_best[i]], u[i][~played_best[i]]))
    out["beta_holding_engine_best_fixed"] = float(
        _ols(q, [u, played_best.astype(float)])[0])
    out["engine_best_rate_fastest_ut_decile"] = float(played_best[deciles == 0].mean())
    out["engine_best_rate_slowest_ut_decile"] = float(played_best[deciles == 9].mean())

    # ---- F-B3: the stratum pattern is the outcome's scale --------------------------------------
    standing = scored["standing"].to_numpy(dtype=object)
    out["beta_by_standing"] = {}
    for label in ("winning", "level", "losing"):
        m = standing == label
        if m.sum() > 100:
            out["beta_by_standing"][label] = {
                "beta": float(an.slope(q[m], u[m])),
                "sd_q_resid": float(np.std(q[m], ddof=1)),
                "ratio": float(an.slope(q[m], u[m]) / np.std(q[m], ddof=1)),
                "n": int(m.sum()),
            }

    # ---- 2.1: where the regularity lives -------------------------------------------------------
    player = scored["player"].to_numpy()
    frame = pd.DataFrame({"p": player, "g": scored["game_id"].to_numpy(), "q": q, "u": u})
    within_player = frame.groupby("p")[["q", "u"]].transform("mean")
    within_game = frame.groupby("g")[["q", "u"]].transform("mean")
    out["beta_within_player"] = float(an.slope(q - within_player["q"].to_numpy(),
                                               u - within_player["u"].to_numpy()))
    out["beta_within_game"] = float(an.slope(q - within_game["q"].to_numpy(),
                                             u - within_game["u"].to_numpy()))
    means = frame.groupby("p")[["q", "u"]].mean()
    out["beta_between_players"] = float(an.slope(means["q"].to_numpy(), means["u"].to_numpy()))

    # ---- F-N1: the instrument -------------------------------------------------------------------
    regret = scored["voc_regret"].to_numpy(float)
    zero = regret <= 0
    out["zero_regret_share"] = float(np.mean(zero))
    out["voc_z_on_zero_rows"] = float(scored["voc_z"].to_numpy(float)[zero].mean())
    out["sd_voc_resid_zero_rows"] = float(np.std(v[zero], ddof=1))
    out["sd_voc_resid_other_rows"] = float(np.std(v[~zero], ddof=1))
    vc = v - v.mean()
    out["regressor_ss_share_zero_rows"] = float((vc[zero] ** 2).sum() / (vc ** 2).sum())
    out["tae_pooled_slope_at_centre"] = float(_main(y, v, rating, basis))
    out["tae_pooled_slope"] = boot.interval(lambda i: an.slope(y[i], v[i]))
    out["tae_partial_correlation"] = float(an.partial_correlation(y, v))
    out["ey_on_regret_positive_indicator"] = float(an.slope(y, (~zero).astype(float)))
    out["ey_on_voc_switch"] = float(an.slope(y, scored["voc_switch"].to_numpy(float)))
    pressure = scored["clock_pressure"].to_numpy(float)
    tercile = pd.qcut(pressure, 3, labels=False, duplicates="drop")
    out["tae_pooled_by_clock_tercile"] = {}
    for t, label in enumerate(("fullest", "middle", "emptiest")):
        m = tercile == t
        if m.sum() > 100:
            out["tae_pooled_by_clock_tercile"][label] = boot.interval(
                lambda i, m=m: an.slope(y[i][m[i]], v[i][m[i]]))
    phase = scored["phase"].to_numpy(dtype=object)
    out["tae_pooled_by_phase"] = {
        label: float(an.slope(y[phase == label], v[phase == label]))
        for label in ("opening", "middlegame", "endgame") if (phase == label).sum() > 100
    }

    # ---- F-N2: the cancellation ------------------------------------------------------------------
    out["ey_on_predicted_voc_x_rating"] = boot.interval(
        lambda i: _grad(y[i], vochat[i], rating[i], basis))
    out["ey_on_raw_voc_x_rating"] = boot.interval(
        lambda i: _grad(y[i], scored["voc_z"].to_numpy(float)[i], rating[i], basis))
    out["tae_gradient_all_rows"] = boot.interval(lambda i: _grad(y[i], v[i], rating[i], basis))
    out["tae_gradient_zero_regret_rows"] = boot.interval(
        lambda i: _grad(y[i][zero[i]], v[i][zero[i]], rating[i][zero[i]], basis))
    out["tae_gradient_varying_rows"] = boot.interval(
        lambda i: _grad(y[i][~zero[i]], v[i][~zero[i]], rating[i][~zero[i]], basis))
    out["ey_on_minus_predicted_voc_x_rating_zero_rows"] = float(
        _grad(y[zero], -vochat[zero], rating[zero], basis))

    # ---- F-N3: what spread the design could see --------------------------------------------------
    se = _sd(boot, lambda i: _grad(y[i], v[i], rating[i], basis))
    out["tae_gradient_se_per_100elo"] = se
    out["tae_spread_detectable_at_80pct_power"] = float(2.8 * se * BANDS_ACROSS_RANGE)

    # ---- F-O3: the premove share -----------------------------------------------------------------
    moved = seconds > 0
    out["zero_time_share"] = float(np.mean(~moved))
    out["metric_a_no_zero_time"] = float(
        100.0 * an.slope(y[moved], scored["rating_resid"].to_numpy(float)[moved]))
    band = scored["rating_band"].to_numpy(dtype=object)
    out["zero_time_share_by_band"] = {
        b: float(np.mean(~moved[band == b])) for b in BAND_LABELS if (band == b).sum() > 0
    }

    # ---- F-O4: the frozen models' per-band residual means -----------------------------------------
    out["band_residual_means"] = {}
    for b in BAND_LABELS:
        m = band == b
        if m.sum() == 0:
            continue
        out["band_residual_means"][b] = {
            "n": int(m.sum()),
            "mean_y_resid_T1": float(y[m].mean()),
            "mean_rating_resid": float(scored["rating_resid"].to_numpy(float)[m].mean()),
            "mean_q_resid": float(q[m].mean()),
            "mean_voc_resid": float(v[m].mean()),
        }
    return out


def matched_diagnostics(scored, basis):
    """F-N4: what CEM selected, how balance moved, and where the matched gradient comes from."""
    matched, balance = matching.match(scored)
    if matched.empty:
        return {"note": "no matched sample"}
    w = matched["w"].to_numpy(float)
    y = matched["y_resid_T1"].to_numpy(float)
    v = matched["voc_resid"].to_numpy(float)
    rating = matched["rating"].to_numpy(float)
    regret = matched["voc_regret"].to_numpy(float)
    zero = regret <= 0
    rating_c = (rating - 1600.0) / 100.0
    block = basis.transform(rating)
    out = {
        "retained_share": float(len(matched) / len(scored)),
        "zero_regret_share_matched": float(np.mean(zero)),
        "zero_regret_share_full": float(np.mean(scored["voc_regret"].to_numpy(float) <= 0)),
        "opening_share_matched": float(np.mean(matched["phase"].to_numpy(dtype=object) == "opening")),
        "opening_share_full": float(np.mean(scored["phase"].to_numpy(dtype=object) == "opening")),
        "book_share_matched": float(np.mean(matched["is_book"].to_numpy(bool))),
        "book_share_full": float(np.mean(scored["is_book"].to_numpy(bool))),
        "max_weight": float(w.max()),
        "gradient_weighted": float(an.gradient_with_main_effect(y, v, rating_c, block,
                                                               weights=w)[1]),
        "gradient_unweighted": float(an.gradient_with_main_effect(y, v, rating_c, block)[1]),
        "gradient_zero_regret_rows": float(an.gradient_with_main_effect(
            y[zero], v[zero], rating_c[zero], block[zero], weights=w[zero])[1]),
        "gradient_varying_rows": float(an.gradient_with_main_effect(
            y[~zero], v[~zero], rating_c[~zero], block[~zero], weights=w[~zero])[1]),
        "balance": balance,
    }
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    ap.add_argument("--out", default=os.path.join(ROOT, "results", "report_diagnostics.json"))
    ap.add_argument("--skip-refit", action="store_true",
                    help="omit the per-period refit column (the slow part)")
    args = ap.parse_args()

    dev_raw = dataset.load(os.path.join(args.data, "development"))
    constants = dataset.frozen_constants(dev_raw)
    dev = dataset.apply_frozen(dev_raw, constants)
    groups = dev["player"].to_numpy()
    fits, _ = an.fit_all(dev, groups)
    scored_dev = an.residualise(dev, fits, {**constants, "ut_q95": 0.0})
    constants["ut_q95"] = float(np.quantile(scored_dev["unexpected_time_population"], 0.95))
    fits = an.fit_metric_nuisances(dev, fits, groups, constants)
    basis = an.RatingBasis(dev["rating"].to_numpy(float))

    payload = {}
    for period in PERIODS:
        frame = dataset.apply_frozen(dataset.load(os.path.join(args.data, period)), constants)
        scored = an.residualise(frame, fits, constants)
        boot = an.PlayerBootstrap(scored["player"].to_numpy())
        block = diagnostics_for(scored, basis, boot)
        block["matched"] = matched_diagnostics(scored, basis)
        if not args.skip_refit:
            block["refit_on_this_period"] = refit_estimates(frame)
        payload[period] = block
        sys.stderr.write(f"{period} done\n")

    json.dump(payload, open(args.out, "w"), indent=1, default=float)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
