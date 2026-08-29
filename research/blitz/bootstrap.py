"""Uncertainty that respects how the data were generated.

Moves from one game are not independent observations: they share a position stream, an opponent, a
clock and a player who was in one state of mind for all of them. A bootstrap that resamples MOVES
treats sixty correlated observations as sixty independent ones and returns an interval that is too
narrow, in the direction that makes every finding look established. The preregistration requires
resampling at the level of the game, and at the level of the player where the player is the unit
the claim generalises over.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

import numpy as np


def cluster_bootstrap(
    rows: Sequence[dict],
    cluster_key: str,
    statistic: Callable[[list[dict]], float],
    resamples: int = 2000,
    seed: int = 20260829,
    alpha: float = 0.05,
) -> dict:
    """Resample whole clusters with replacement; recompute the statistic on each resample."""
    rng = np.random.default_rng(seed)
    clusters: dict[str, list[dict]] = {}
    for row in rows:
        clusters.setdefault(row[cluster_key], []).append(row)
    keys = list(clusters)
    point = statistic(list(rows))
    draws = np.empty(resamples)
    for i in range(resamples):
        picked = rng.integers(0, len(keys), size=len(keys))
        sample: list[dict] = []
        for index in picked:
            sample.extend(clusters[keys[index]])
        draws[i] = statistic(sample)
    lo, hi = np.quantile(draws[np.isfinite(draws)], [alpha / 2, 1 - alpha / 2])
    return {
        "point": float(point),
        "ci": (float(lo), float(hi)),
        "clusters": len(keys),
        "n": len(rows),
        "resamples": resamples,
    }


def naive_bootstrap(
    rows: Sequence[dict],
    statistic: Callable[[list[dict]], float],
    resamples: int = 2000,
    seed: int = 20260829,
    alpha: float = 0.05,
) -> dict:
    """Resampling rows independently. Reported ONLY alongside the clustered interval, to show how
    much narrower the wrong analysis would have been."""
    rng = np.random.default_rng(seed)
    rows = list(rows)
    draws = np.empty(resamples)
    for i in range(resamples):
        picked = rng.integers(0, len(rows), size=len(rows))
        draws[i] = statistic([rows[j] for j in picked])
    lo, hi = np.quantile(draws[np.isfinite(draws)], [alpha / 2, 1 - alpha / 2])
    return {"point": float(statistic(rows)), "ci": (float(lo), float(hi)), "n": len(rows)}
