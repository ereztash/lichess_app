"""Every reported quantity, as an inner product on frozen residuals.

WHY IT IS SHAPED THIS WAY. `MODEL_SPEC.md` requires every model to be fitted on DEVELOPMENT and
applied unchanged. Once that is true, the Frisch-Waugh-Lovell theorem does the rest: a coefficient
in a big adjusted model equals the simple slope of one frozen residual on another. So the period a
result is read from supplies TWO VECTORS and no model fit at all, and a bootstrap replicate is a
resample of players plus three dot products rather than 400 ridge regressions.

It is also the honest shape. If the estimate needed a fit on the evaluation period, the evaluation
period would be choosing something.
"""
from __future__ import annotations

import numpy as np

import models

BOOTSTRAP = 400
BOOT_SEED = 20260901


# --- frozen fits ------------------------------------------------------------------------------
def fit_all(dev, groups):
    """Every model B3 uses, fitted once on DEVELOPMENT.

    `partial_*` entries are the FWL companions: each one regresses a quantity that will appear on
    the right-hand side onto the controls it must be purged of, so the evaluation-period estimate
    is a one-parameter slope.
    """
    fits = {}
    fits["T0"] = models.fit_frozen(dev, "T0", "log_time", groups)
    fits["T1P"] = models.fit_frozen(dev, "T1P", "log_time", groups)
    fits["T2P"] = models.fit_frozen(dev, "T2P", "log_time", groups)
    fits["T2R"] = models.fit_frozen(dev, "T2R", "log_time", groups)

    dev = dev.copy()
    dev["_ut_within"] = dev["log_time"] - models.predict(fits["T2R"], dev)
    dev["_ut_pop"] = dev["log_time"] - models.predict(fits["T2P"], dev)
    dev["_ut_novoc"] = dev["log_time"] - models.predict(fits["T1P"], dev)

    # Q0: the fully adjusted quality baseline. UT is deliberately NOT in it; it is what beta adds.
    fits["Q0"] = models.fit_frozen(dev, "T2R", "quality_loss", groups)
    # The FWL companion for beta: unexpected time purged of Q0's own design.
    fits["partial_ut"] = models.fit_frozen(dev, "T2R", "_ut_within", groups,
                                           penalty=fits["Q0"]["penalty"])
    # The rating-only quality model, for the SKILL_ONLY branch: does rating predict quality at all,
    # with everything else adjusted but rating itself left out?
    fits["Q_norating"] = models.fit_frozen(dev, "T2P", "quality_loss", groups,
                                           penalty=fits["Q0"]["penalty"])
    fits["partial_rating_q"] = models.fit_frozen(dev, "T2P", "rating", groups,
                                                 penalty=fits["Q0"]["penalty"])
    # Metric A / Metric B / Metric C / Metric D companions.
    fits["partial_rating"] = models.fit_frozen(dev, "T1P", "rating", groups,
                                               penalty=fits["T1P"]["penalty"])
    fits["partial_voc"] = models.fit_frozen(dev, "T1P", "voc_z", groups,
                                            penalty=fits["T1P"]["penalty"])
    return fits, dev


def residualise(frame, fits, constants):
    """Attach every frozen residual a downstream estimator reads."""
    out = frame.copy()
    out["yhat_T0"] = models.predict(fits["T0"], out)
    out["yhat_T1P"] = models.predict(fits["T1P"], out)
    out["yhat_T2P"] = models.predict(fits["T2P"], out)
    out["yhat_T2R"] = models.predict(fits["T2R"], out)
    out["unexpected_time_population"] = out["log_time"] - out["yhat_T2P"]
    out["unexpected_time_within_rating"] = out["log_time"] - out["yhat_T2R"]
    out["unexpected_time_novoc"] = out["log_time"] - out["yhat_T1P"]

    out["q_resid"] = out["quality_loss"] - models.predict(fits["Q0"], out)
    out["ut_resid"] = out["unexpected_time_within_rating"] - models.predict(fits["partial_ut"], out)
    out["y_resid_T1"] = out["log_time"] - out["yhat_T1P"]
    out["rating_resid"] = out["rating"] - models.predict(fits["partial_rating"], out)
    out["q_resid_norating"] = out["quality_loss"] - models.predict(fits["Q_norating"], out)
    out["rating_resid_q"] = out["rating"] - models.predict(fits["partial_rating_q"], out)
    out["voc_resid"] = out["voc_z"] - models.predict(fits["partial_voc"], out)

    # Metric C: misallocation is extra time where computation is worth less than average, or time
    # skimped where it is worth more. Both directions, one decision contributing to at most one.
    u = out["unexpected_time_novoc"].to_numpy()
    v = out["voc_z"].to_numpy()
    wrong_way = np.sign(u) != np.sign(v)
    out["allocation_loss"] = np.abs(u) * wrong_way
    out["overthinking"] = np.where((u > 0) & (v < 0), u, 0.0)
    out["premature_commitment"] = np.where((u < 0) & (v > 0), -u, 0.0)
    out["extreme_ut"] = (out["unexpected_time_population"] > constants["ut_q95"]).astype(float)
    return out


# --- estimators, all one-parameter -------------------------------------------------------------
def slope(y, x) -> float:
    """OLS slope through the origin of two already-centred residual vectors."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    denominator = float(x @ x)
    return float(x @ y) / denominator if denominator > 0 else float("nan")


def slope_with_interaction(y, x, z):
    """Slope of `y` on `x` and on `x*z`; returns (main, interaction).

    `z` is centred rating in hundreds of Elo, so the interaction is "how the slope changes per 100
    rating points" and the main term is the slope at the sample's mean rating.
    """
    design = np.column_stack([np.asarray(x, float), np.asarray(x, float) * np.asarray(z, float),
                              np.ones(len(x))])
    coef, *_ = np.linalg.lstsq(design, np.asarray(y, float), rcond=None)
    return float(coef[0]), float(coef[1])


class PlayerBootstrap:
    """Resample PLAYERS with replacement, take all of a resampled player's decisions.

    Moves inside a game are not independent draws and games inside a player are not either. With N
    in the hundreds of thousands a move-level interval is arbitrarily narrow and means nothing, so
    this is the only interval this study reports.
    """

    def __init__(self, players, replicates=BOOTSTRAP, seed=BOOT_SEED):
        players = np.asarray(players)
        self.unique, inverse = np.unique(players, return_inverse=True)
        order = np.argsort(inverse, kind="stable")
        self.index_by_player = np.split(order, np.cumsum(np.bincount(inverse))[:-1])
        self.replicates = replicates
        self.rng = np.random.default_rng(seed)
        self._draws = [
            self.rng.integers(0, len(self.unique), len(self.unique))
            for _ in range(replicates)
        ]

    def indices(self, replicate: int) -> np.ndarray:
        return np.concatenate([self.index_by_player[p] for p in self._draws[replicate]])

    def interval(self, statistic, point=None):
        """`statistic(idx) -> float`. Returns `(point, lo, hi, n_ok)`."""
        values = []
        for r in range(self.replicates):
            try:
                value = statistic(self.indices(r))
            except Exception:
                value = float("nan")
            if np.isfinite(value):
                values.append(value)
        if point is None:
            point = statistic(np.arange(sum(len(i) for i in self.index_by_player)))
        if len(values) < 20:
            return {"point": float(point), "lo": float("nan"), "hi": float("nan"),
                    "replicates": len(values)}
        lo, hi = np.percentile(values, [2.5, 97.5])
        return {"point": float(point), "lo": float(lo), "hi": float(hi),
                "replicates": len(values)}


def pooled_random_effects(estimates, variances):
    """DerSimonian-Laird partial pooling across rating bands.

    Band estimates are noisy and a figure that reads a noisy band as a real reversal is a figure
    that invents non-monotonicity. Both raw and shrunk are reported; neither replaces the other.
    """
    estimates = np.asarray(estimates, float)
    variances = np.asarray(variances, float)
    ok = np.isfinite(estimates) & np.isfinite(variances) & (variances > 0)
    if ok.sum() < 2:
        return {"tau2": float("nan"), "mean": float("nan"), "shrunk": list(estimates)}
    e, v = estimates[ok], variances[ok]
    w = 1 / v
    fixed = float((w * e).sum() / w.sum())
    q = float((w * (e - fixed) ** 2).sum())
    c = float(w.sum() - (w**2).sum() / w.sum())
    tau2 = max(0.0, (q - (len(e) - 1)) / c) if c > 0 else 0.0
    w2 = 1 / (v + tau2)
    mean = float((w2 * e).sum() / w2.sum())
    shrunk = list(estimates)
    for i, keep in enumerate(ok):
        if keep:
            weight = tau2 / (tau2 + variances[i]) if (tau2 + variances[i]) > 0 else 0.0
            shrunk[i] = weight * estimates[i] + (1 - weight) * mean
    return {"tau2": tau2, "mean": mean, "shrunk": [float(s) for s in shrunk]}


def spearman(x, y) -> float:
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    ok = np.isfinite(x) & np.isfinite(y)
    if ok.sum() < 3:
        return float("nan")
    rx = np.argsort(np.argsort(x[ok])).astype(float)
    ry = np.argsort(np.argsort(y[ok])).astype(float)
    rx -= rx.mean()
    ry -= ry.mean()
    denominator = np.sqrt((rx @ rx) * (ry @ ry))
    return float(rx @ ry / denominator) if denominator > 0 else float("nan")
