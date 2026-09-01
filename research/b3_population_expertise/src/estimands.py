"""Every reported number for one period, computed from frozen residuals.

The whole file is deliberately mechanical. It takes a residualised frame and returns a dictionary;
it makes no choices, reads no thresholds it was not handed, and knows nothing about verdicts.
`evaluate.py` is where rules are applied, and it applies them to this output.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analysis import (
    PlayerBootstrap, RatingBasis, gradient_with_main_effect, partial_correlation,
    pooled_random_effects, slope, spearman,
)
from common import BAND_LABELS

MIN_PLAYERS_PER_BAND = 150
MIN_DECISIONS_PER_BAND = 3000
MIN_DECISIONS_PER_PLAYER = 20


def _band_index(frame):
    return {band: np.flatnonzero((frame["rating_band"] == band).to_numpy()) for band in BAND_LABELS}


def adequately_powered(frame) -> dict[str, bool]:
    out = {}
    for band in BAND_LABELS:
        rows = frame[frame["rating_band"] == band]
        out[band] = bool(len(rows) >= MIN_DECISIONS_PER_BAND
                         and rows["player"].nunique() >= MIN_PLAYERS_PER_BAND)
    return out


def _by_band(frame, boot, fn):
    """`fn(idx) -> float` evaluated inside each band, with a player bootstrap interval."""
    band_of = frame["rating_band"].to_numpy()
    out = {}
    for band in BAND_LABELS:
        mask = band_of == band
        if mask.sum() < 50:
            out[band] = {"point": float("nan"), "lo": float("nan"), "hi": float("nan"),
                         "n": int(mask.sum())}
            continue
        rows = np.flatnonzero(mask)
        point = fn(rows)
        stat = lambda idx, m=mask: fn(idx[m[idx]])  # noqa: E731
        interval = boot.interval(stat, point=point)
        interval["n"] = int(mask.sum())
        interval["players"] = int(frame["player"].to_numpy()[rows].__class__ is not None
                                  and pd.unique(frame["player"].to_numpy()[rows]).size)
        out[band] = interval
    return out


def _centred_rating(frame):
    return (frame["rating"].to_numpy(float) - 1600.0) / 100.0


def estimate(frame: pd.DataFrame, boot: PlayerBootstrap | None = None,
             rating_basis: RatingBasis | None = None) -> dict:
    if boot is None:
        boot = PlayerBootstrap(frame["player"].to_numpy())
    if rating_basis is None:
        rating_basis = RatingBasis(frame["rating"].to_numpy(float))
    rating_block = rating_basis.transform(frame["rating"].to_numpy(float))

    q_resid = frame["q_resid"].to_numpy(float)
    ut_resid = frame["ut_resid"].to_numpy(float)
    y_resid = frame["y_resid_T1"].to_numpy(float)
    voc_resid = frame["voc_resid"].to_numpy(float)
    rating_resid = frame["rating_resid"].to_numpy(float)
    rating_c = _centred_rating(frame)
    allocation = frame["allocation_loss"].to_numpy(float)
    extreme = frame["extreme_ut"].to_numpy(float)
    # N1(c): the frozen-residualised forms, which are what MODEL_SPEC 4 step 1 specifies.
    allocation_resid = frame["allocation_resid"].to_numpy(float)
    extreme_resid = frame["extreme_resid"].to_numpy(float)

    out: dict = {
        "n_decisions": int(len(frame)),
        "n_players": int(frame["player"].nunique()),
        "n_games": int(frame["game_id"].nunique()),
        "rating_range": [int(frame["rating"].min()), int(frame["rating"].max())],
        "adequately_powered": adequately_powered(frame),
        "mean_quality_loss": float(frame["quality_loss"].mean()),
        "mean_seconds": float(frame["seconds_taken"].mean()),
        "median_seconds": float(frame["seconds_taken"].median()),
        "accurate_rate": float(frame["accurate"].mean()),
        "censored_voc_share": float(frame["voc_regret_censored"].mean()),
        "zero_time_share": float((frame["seconds_taken"] == 0).mean()),
        "book_share": float(frame["is_book"].mean()),
    }

    # --- H1 -----------------------------------------------------------------------------------
    out["beta"] = boot.interval(lambda i: slope(q_resid[i], ut_resid[i]))
    out["beta_by_band"] = _by_band(frame, boot, lambda i: slope(q_resid[i], ut_resid[i]))
    main, inter = gradient_with_main_effect(q_resid, ut_resid, rating_c, rating_block)
    out["beta_at_mean_rating"] = main
    out["beta_rating_interaction"] = boot.interval(
        lambda i: gradient_with_main_effect(q_resid[i], ut_resid[i], rating_c[i],
                                            rating_block[i])[1], point=inter
    )

    # --- Metric A: matched-difficulty thinking time, per 100 Elo -------------------------------
    out["metric_a_time_vs_rating"] = boot.interval(
        lambda i: 100.0 * slope(y_resid[i], rating_resid[i])
    )

    out["metric_a_by_band"] = _by_band(
        frame, boot, lambda i: 100.0 * slope(y_resid[i], rating_resid[i])
    )

    # --- Metric B: time allocation efficiency (PRIMARY) ----------------------------------------
    out["tae_by_band"] = _by_band(frame, boot, lambda i: slope(y_resid[i], voc_resid[i]))
    tae_main, tae_inter = gradient_with_main_effect(y_resid, voc_resid, rating_c, rating_block)
    out["tae_pooled"] = tae_main
    out["tae_rating_gradient"] = boot.interval(
        lambda i: gradient_with_main_effect(y_resid[i], voc_resid[i], rating_c[i],
                                            rating_block[i])[1], point=tae_inter
    )
    # The partial-correlation form, so a band whose thinking times are merely more variable cannot
    # read as more efficient. Centred within the band, per N1(a).
    out["tae_partial_correlation_by_band"] = _by_band(
        frame, boot, lambda i: partial_correlation(y_resid[i], voc_resid[i])
    )

    # --- Metric C: allocation loss --------------------------------------------------------------
    out["allocation_loss_by_band"] = _by_band(frame, boot, lambda i: float(allocation[i].mean()))
    out["allocation_loss_vs_rating"] = boot.interval(
        lambda i: 100.0 * slope(allocation_resid[i], rating_resid[i])
    )
    out["overthinking_by_band"] = _by_band(
        frame, boot, lambda i: float(frame["overthinking"].to_numpy(float)[i].mean())
    )
    out["premature_commitment_by_band"] = _by_band(
        frame, boot, lambda i: float(frame["premature_commitment"].to_numpy(float)[i].mean())
    )

    # --- Metric D: extreme unexpected-time exposure ---------------------------------------------
    out["extreme_ut_by_band"] = _by_band(frame, boot, lambda i: float(extreme[i].mean()))
    out["extreme_ut_vs_rating"] = boot.interval(
        lambda i: 100.0 * slope(extreme_resid[i], rating_resid[i])
    )

    # --- Metric E: friction burden. DESCRIPTIVE. Cannot contribute to a verdict. -----------------
    def burden(i):
        hot = extreme[i] > 0
        if hot.sum() < 20 or (~hot).sum() < 20:
            return float("nan")
        return float(q_resid[i][hot].mean() - q_resid[i][~hot].mean())

    out["friction_burden_by_band"] = _by_band(frame, boot, burden)

    # --- shape across bands ---------------------------------------------------------------------
    powered = [b for b in BAND_LABELS if out["adequately_powered"][b]]
    out["powered_bands"] = powered
    for name, table, expect in (
        ("beta", out["beta_by_band"], +1),
        ("tae", out["tae_by_band"], +1),
        ("allocation_loss", out["allocation_loss_by_band"], -1),
        ("extreme_ut", out["extreme_ut_by_band"], -1),
    ):
        values = [table[b]["point"] for b in powered]
        idx = list(range(len(powered)))
        out[f"{name}_band_spearman"] = spearman(idx, values) if len(values) >= 3 else float("nan")
        pooled = pooled_random_effects(
            values,
            [((table[b]["hi"] - table[b]["lo"]) / 3.92) ** 2 for b in powered],
        )
        out[f"{name}_pooled"] = pooled
        out[f"{name}_expected_sign"] = expect
    # The SKILL_ONLY branch needs the plain question: does rating predict quality at all?
    qn = frame["q_resid_norating"].to_numpy(float)
    rq = frame["rating_resid_q"].to_numpy(float)
    out["rating_on_quality"] = boot.interval(lambda i: 100.0 * slope(qn[i], rq[i]))

    # VERDICT_RULES 2.5.5: the TAE spread between the extreme adequately powered bands.
    if len(powered) >= 2:
        low_mask = (frame["rating_band"] == powered[0]).to_numpy()
        high_mask = (frame["rating_band"] == powered[-1]).to_numpy()

        def spread(i):
            lo = slope(y_resid[i][low_mask[i]], voc_resid[i][low_mask[i]])
            hi = slope(y_resid[i][high_mask[i]], voc_resid[i][high_mask[i]])
            return hi - lo

        out["tae_spread_low_to_high"] = boot.interval(spread)
        out["tae_spread_bands"] = [powered[0], powered[-1]]
    else:
        out["tae_spread_low_to_high"] = {"point": float("nan"), "lo": float("nan"),
                                         "hi": float("nan"), "replicates": 0}

    out["beta_sign_agreement"] = (
        float(np.mean([out["beta_by_band"][b]["point"] > 0 for b in powered])) if powered else float("nan")
    )
    return out


def player_level(frame: pd.DataFrame) -> dict:
    """Per-player estimates, shrunk, then regressed on player rating.

    A player with 20 decisions must not be able to produce an extreme coefficient, so every player
    quantity is shrunk toward the population mean by its own sampling variance before it is used.
    """
    grouped = frame.groupby("player")
    rows = []
    for player, block in grouped:
        if len(block) < MIN_DECISIONS_PER_PLAYER:
            continue
        y = block["y_resid_T1"].to_numpy(float)
        v = block["voc_resid"].to_numpy(float)
        # CENTRED WITHIN THE PLAYER (N1b). Uncentred, this statistic is dominated by
        # mean(pace) x mean(position-type) -- the player's tempo times the kind of positions they
        # reach -- and both trend with rating, so condition 6 would have read a product of two
        # frozen-model misfits as a player-level allocation gradient.
        yc, vc = y - y.mean(), v - v.mean()
        denominator = float(vc @ vc)
        tae = float(vc @ yc) / denominator if denominator > 0 else np.nan
        rows.append(
            {
                "player": player,
                "n": len(block),
                "rating": float(block["rating"].mean()),
                "tae": tae,
                "tae_var": (float(yc @ yc) / denominator / max(len(block) - 2, 1))
                if denominator > 0 else np.nan,
                "mean_quality_loss": float(block["quality_loss"].mean()),
                "adjusted_time": float(block["y_resid_T1"].mean()),
                "ut_sd": float(block["unexpected_time_within_rating"].std()),
                "extreme_rate": float(block["extreme_ut"].mean()),
                "allocation_loss": float(block["allocation_loss"].mean()),
            }
        )
    table = pd.DataFrame(rows)
    if len(table) < 30:
        return {"players": len(table), "note": "too few players with enough decisions"}

    finite = table["tae"].replace([np.inf, -np.inf], np.nan).dropna()
    pooled = pooled_random_effects(table["tae"].to_numpy(), table["tae_var"].to_numpy())
    table["tae_shrunk"] = pooled["shrunk"]

    weights = 1.0 / (table["tae_var"].to_numpy() + max(pooled["tau2"], 1e-12))
    weights = np.where(np.isfinite(weights), weights, 0.0)
    x = (table["rating"].to_numpy() - 1600.0) / 100.0
    y = table["tae_shrunk"].to_numpy()
    ok = np.isfinite(x) & np.isfinite(y) & (weights > 0)
    design = np.column_stack([x[ok], np.ones(ok.sum())])
    w = weights[ok]
    coef, *_ = np.linalg.lstsq(design * np.sqrt(w)[:, None], y[ok] * np.sqrt(w), rcond=None)

    rng = np.random.default_rng(20260901)
    replicates = []
    for _ in range(400):
        draw = rng.integers(0, ok.sum(), ok.sum())
        d, t, ww = design[draw], y[ok][draw], w[draw]
        try:
            c, *_ = np.linalg.lstsq(d * np.sqrt(ww)[:, None], t * np.sqrt(ww), rcond=None)
            replicates.append(float(c[0]))
        except Exception:
            pass
    lo, hi = np.percentile(replicates, [2.5, 97.5]) if len(replicates) > 20 else (np.nan, np.nan)

    return {
        "players": int(len(table)),
        "mean_decisions_per_player": float(table["n"].mean()),
        "tae_mean": float(finite.mean()),
        "tau2": pooled["tau2"],
        "tae_vs_rating_per_100elo": {"point": float(coef[0]), "lo": float(lo), "hi": float(hi)},
        "quality_vs_rating_per_100elo": float(
            np.polyfit((table["rating"] - 1600) / 100, table["mean_quality_loss"], 1)[0]
        ),
    }
