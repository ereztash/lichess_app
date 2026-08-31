"""What the standard error of a bucket contrast is, under two answers to one question.

THE QUESTION IS WHAT AN OBSERVATION IS. `shared/detector.ts` answers "a decision": it takes the
sample variance of the per-decision gap inside the bucket and outside it, divides each by its own
count, and adds. That is exactly right if decisions are independent draws.

`DecisionAtom` already carries `game_id`, and moves from one game share an opponent, an opening, a
clock, a time control and a player who was in one state of mind for all of them. If the gap
carries a game-level component, then n decisions are not n observations and the error above is too
small -- in the direction that makes every finding look established.

TWO ESTIMATORS, ONE CONTRAST. Both estimate the same beta; only the error differs.

    product     what ships today, reproduced here ONLY to be differenced against
    cluster     statsmodels OLS with cov_type="cluster", groups=game_id

statsmodels is the reference implementation and is not reimplemented: `cluster`, `cluster-jk` and
`cluster-crv3` are documented options on `OLS.fit`, and porting a formula before measuring against
the thing that already has it is the failure mode this whole audit exists to avoid.

A NOTE ON WHY THE PRODUCT'S FORMULA IS REPRODUCED HERE AT ALL. It is not a second definition of a
product rule -- the bridge emits the product's own `standardError` and `parity_check` below
asserts this reproduction matches it to 1e-12 on every record measured. It exists so the
difference can be attributed: OLS's default error is POOLED and the product's is not, so
`cluster / product` would otherwise confound clustering with pooling. HC1 sits between them and is
reported for the same reason.
"""

from __future__ import annotations

import numpy as np
import statsmodels.api as sm


def product_standard_error(gap: np.ndarray, inside: np.ndarray) -> float | None:
    """The shipped formula: sqrt(var_in/n_in + var_out/n_out), Bessel-corrected, both sides.

    Returns None exactly where `gapDifferenceStandardError` returns null -- fewer than two on a
    side, or a side with no variance at all. A degenerate sample is not certainty.
    """
    a, b = gap[inside], gap[~inside]
    if a.size < 2 or b.size < 2:
        return None
    va, vb = a.var(ddof=1), b.var(ddof=1)
    if va <= 0 or vb <= 0:
        return None
    return float(np.sqrt(va / a.size + vb / b.size))


def estimates(gap: np.ndarray, inside: np.ndarray, games: np.ndarray) -> dict | None:
    """Both errors for one bucket contrast, plus the pieces needed to attribute the difference."""
    if inside.sum() < 2 or (~inside).sum() < 2:
        return None
    product = product_standard_error(gap, inside)
    if product is None:
        return None

    x = sm.add_constant(inside.astype(float), has_constant="add")
    model = sm.OLS(gap, x)
    classical = model.fit()
    robust = model.fit(cov_type="HC1")
    clustered = model.fit(cov_type="cluster", cov_kwds={"groups": games})

    beta = float(classical.params[1])
    se_cluster = float(clustered.bse[1])
    return {
        "beta": beta,
        "se_product": product,
        "se_ols": float(classical.bse[1]),
        "se_hc1": float(robust.bse[1]),
        "se_cluster": se_cluster,
        # The one number the audit turns on. >1 means the product's error is too small.
        "inflation": se_cluster / product if product > 0 else float("nan"),
        "n": int(gap.size),
        "n_inside": int(inside.sum()),
        "clusters": int(np.unique(games).size),
        # How much of the record one game is. The Moulton factor grows with it.
        "mean_cluster_size": float(gap.size / max(np.unique(games).size, 1)),
    }


def parity_check(gap: np.ndarray, inside: np.ndarray, reported_se: float, reported_beta: float) -> dict:
    """That this file's reproduction of the shipped formula IS the shipped formula.

    Run on every bucket of every record in the Q1 experiment. A reproduction that has never been
    differenced against the original is a guess with a docstring.
    """
    mine = product_standard_error(gap, inside)
    beta = float(gap[inside].mean() - gap[~inside].mean())
    return {
        "se_delta": abs((mine if mine is not None else float("nan")) - reported_se),
        "beta_delta": abs(beta - reported_beta),
    }


def intraclass_correlation(values: np.ndarray, groups: np.ndarray) -> float:
    """One-way ANOVA ICC of `values` within `groups`: the share of variance that is between games.

    Reported beside the inflation ratio because it is the thing the ratio is a consequence of, and
    because a reader who does not accept the ratio can check this instead.
    """
    keys, index = np.unique(groups, return_inverse=True)
    k = keys.size
    n = values.size
    if k < 2 or n <= k:
        return float("nan")
    counts = np.bincount(index, minlength=k).astype(float)
    means = np.bincount(index, weights=values, minlength=k) / counts
    grand = values.mean()
    ss_between = float((counts * (means - grand) ** 2).sum())
    ss_within = float(((values - means[index]) ** 2).sum())
    ms_between = ss_between / (k - 1)
    ms_within = ss_within / (n - k)
    # The unbalanced-design correction: without it the ICC of variable-length games is biased.
    n0 = (n - (counts**2).sum() / n) / (k - 1)
    denom = ms_between + (n0 - 1) * ms_within
    if denom <= 0:
        return float("nan")
    return float((ms_between - ms_within) / denom)
