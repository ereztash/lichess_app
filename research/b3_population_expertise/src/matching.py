"""Coarsened exact matching, and the decision efficiency frontier.

WHAT MATCHING IS FOR HERE, and it is narrower than the word usually implies. This is NOT causal
identification and the report says so in those words. It is protection against functional form: a
regression adjustment can produce a rating gradient out of an extrapolation if the rating bands
occupy different regions of the covariate space. Matching answers the same question inside cells
where every compared band actually has decisions, so an effect that only exists where one band has
no data cannot survive it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analysis import PlayerBootstrap, RatingBasis, gradient_with_main_effect, slope
from common import BAND_LABELS

CELL_KEYS = [
    "ambiguity_entropy_cut", "gap12_cut", "wp1_cut", "voc_regret_cut",
    "phase", "standing", "clock_pressure_cut", "ply_cut", "legal_moves_cut",
]
MIN_PER_BAND_IN_CELL = 20
MIN_BANDS_PER_CELL = 3
BALANCE_VARIABLES = [
    "ambiguity_entropy", "gap12", "wp1", "voc_z", "clock_pressure", "ply", "legal_moves",
    "n_near", "eval_volatility", "best_move_changes",
]


def cell_key(frame: pd.DataFrame) -> pd.Series:
    return frame[CELL_KEYS].astype(str).agg("|".join, axis=1)


def match(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Return the matched subset with CEM weights, plus a balance report."""
    work = frame.copy()
    work["_cell"] = cell_key(work)
    counts = work.groupby(["_cell", "rating_band"]).size().rename("n").reset_index()
    counts = counts[counts["n"] >= MIN_PER_BAND_IN_CELL]
    usable = counts.groupby("_cell")["rating_band"].nunique()
    keep_cells = set(usable[usable >= MIN_BANDS_PER_CELL].index)
    counts = counts[counts["_cell"].isin(keep_cells)]
    if counts.empty:
        return work.iloc[0:0], {"cells": 0, "note": "no cell held enough bands to compare"}

    allowed = set(zip(counts["_cell"], counts["rating_band"]))
    mask = [(c, b) in allowed for c, b in zip(work["_cell"], work["rating_band"])]
    matched = work[mask].copy()

    # CEM weight: inside a cell, every retained band is given the same total weight, so the
    # comparison across bands holds the covariate cell fixed by construction.
    cell_band = matched.groupby(["_cell", "rating_band"]).size().rename("n_band")
    cell_total = matched.groupby("_cell").size().rename("n_cell")
    joined = matched.join(cell_band, on=["_cell", "rating_band"]).join(cell_total, on="_cell")
    bands_in_cell = matched.groupby("_cell")["rating_band"].nunique().rename("k")
    joined = joined.join(bands_in_cell, on="_cell")
    matched["w"] = (joined["n_cell"] / (joined["k"] * joined["n_band"])).to_numpy()

    balance = {}
    powered = [b for b in BAND_LABELS if (matched["rating_band"] == b).sum() >= 200]
    if len(powered) >= 2:
        low, high = powered[0], powered[-1]
        for variable in BALANCE_VARIABLES:
            def smd(subset, weights=None):
                values = subset[variable].to_numpy(float)
                if weights is None:
                    return values.mean(), values.std()
                w = weights / weights.sum()
                mean = float(values @ w)
                return mean, float(np.sqrt(((values - mean) ** 2) @ w))

            before_low = smd(work[work["rating_band"] == low])
            before_high = smd(work[work["rating_band"] == high])
            after_low = smd(matched[matched["rating_band"] == low],
                            matched.loc[matched["rating_band"] == low, "w"].to_numpy())
            after_high = smd(matched[matched["rating_band"] == high],
                             matched.loc[matched["rating_band"] == high, "w"].to_numpy())
            pooled_before = np.sqrt((before_low[1] ** 2 + before_high[1] ** 2) / 2) or 1.0
            pooled_after = np.sqrt((after_low[1] ** 2 + after_high[1] ** 2) / 2) or 1.0
            balance[variable] = {
                "smd_before": float((before_high[0] - before_low[0]) / pooled_before),
                "smd_after": float((after_high[0] - after_low[0]) / pooled_after),
            }

    report = {
        "cells": len(keep_cells),
        "matched_decisions": int(len(matched)),
        "matched_players": int(matched["player"].nunique()),
        "share_of_decisions_retained": float(len(matched) / len(work)),
        "bands_compared": powered,
        "balance_lowest_vs_highest_band": balance,
    }
    return matched, report


def matched_estimates(matched: pd.DataFrame, rating_basis: RatingBasis | None = None) -> dict:
    """The primary estimates recomputed inside the matched sample, with CEM weights."""
    if matched.empty:
        return {"note": "no matched sample"}
    w = matched["w"].to_numpy(float)
    sw = np.sqrt(w)
    q = matched["q_resid"].to_numpy(float) * sw
    u = matched["ut_resid"].to_numpy(float) * sw
    y = matched["y_resid_T1"].to_numpy(float) * sw
    v = matched["voc_resid"].to_numpy(float) * sw
    rating_c = (matched["rating"].to_numpy(float) - 1600.0) / 100.0
    if rating_basis is None:
        rating_basis = RatingBasis(matched["rating"].to_numpy(float))
    block = rating_basis.transform(matched["rating"].to_numpy(float)) * sw[:, None]
    boot = PlayerBootstrap(matched["player"].to_numpy())
    return {
        "beta": boot.interval(lambda i: slope(q[i], u[i])),
        "tae_rating_gradient": boot.interval(
            lambda i: gradient_with_main_effect(y[i], v[i], rating_c[i], block[i])[1]
        ),
        "metric_a_time_vs_rating": boot.interval(
            lambda i: 100.0 * slope(y[i], matched["rating_resid"].to_numpy(float)[i] * sw[i])
        ),
    }


def frontier(frame: pd.DataFrame) -> list[dict]:
    """Mean time and mean quality loss inside matched difficulty x VoC x clock cells, per band.

    Deliberately NOT collapsed into one score. The shape of the (time, quality) relationship at each
    expertise level is the object; a single number would throw away the thing worth looking at.
    """
    rows = []
    grouped = frame.groupby(
        ["rating_band", "ambiguity_entropy_cut", "voc_regret_cut", "clock_pressure_cut"]
    )
    for (band, difficulty, voc, clock), block in grouped:
        if len(block) < 50:
            continue
        rows.append(
            {
                "rating_band": band,
                "difficulty_tercile": int(difficulty),
                "voc_tercile": int(voc),
                "clock_tercile": int(clock),
                "n": int(len(block)),
                "players": int(block["player"].nunique()),
                "mean_seconds": float(block["seconds_taken"].mean()),
                "mean_log_time": float(block["log_time"].mean()),
                "mean_quality_loss": float(block["quality_loss"].mean()),
                "sem_quality_loss": float(block["quality_loss"].std() / np.sqrt(len(block))),
            }
        )
    return rows
