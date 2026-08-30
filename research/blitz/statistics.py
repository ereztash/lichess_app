"""Estimators, each with the reason it was chosen over the obvious alternative."""

from __future__ import annotations

import math

import numpy as np


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Interval for a proportion.

    Wilson rather than normal-approximation because every proportion in this study sits near 1,
    where the symmetric interval runs past 1.0 and stops being an interval.
    """
    if n == 0:
        return (0.0, 1.0)
    p = successes / n
    denom = 1 + z * z / n
    centre = p + z * z / (2 * n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((centre - half) / denom, (centre + half) / denom)


def cohen_kappa(a: np.ndarray, b: np.ndarray) -> float:
    """Agreement beyond chance between two binary labellings of the same items.

    Raw agreement is not enough here: the outcome is imbalanced (most blitz moves are accurate by
    the rule), so two labellings that share nothing but the base rate already agree most of the
    time. Kappa is what says whether they agree about the SAME decisions.
    """
    a = np.asarray(a, dtype=bool)
    b = np.asarray(b, dtype=bool)
    observed = float((a == b).mean())
    pa, pb = a.mean(), b.mean()
    expected = pa * pb + (1 - pa) * (1 - pb)
    if expected >= 1.0:
        return float("nan")
    return (observed - expected) / (1 - expected)


def quantiles(values: np.ndarray, qs=(0.5, 0.75, 0.9, 0.95, 0.99)) -> dict[str, float]:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    return {f"p{int(q * 100)}": float(np.quantile(values, q)) for q in qs}


def spearman(x: np.ndarray, y: np.ndarray) -> float:
    """Rank correlation. The quantities compared here are bounded and heavily skewed, so a
    Pearson coefficient would mostly report what the tail did."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    ok = np.isfinite(x) & np.isfinite(y)
    if ok.sum() < 3:
        return float("nan")
    rx = np.argsort(np.argsort(x[ok]))
    ry = np.argsort(np.argsort(y[ok]))
    return float(np.corrcoef(rx, ry)[0, 1])


def gini(values: np.ndarray) -> float:
    """How unevenly a non-negative quantity is spread over the sample.

    Used for ONE question: is the remaining-computation-value distribution degenerate? A construct
    where every position scores the same has nothing to predict with, and that is a fact about the
    construct rather than about any model of it.
    """
    v = np.sort(np.asarray(values, dtype=float))
    v = v[np.isfinite(v)]
    if v.size == 0 or v.sum() == 0:
        return 0.0
    n = v.size
    index = np.arange(1, n + 1)
    return float((2 * index - n - 1).dot(v) / (n * v.sum()))
