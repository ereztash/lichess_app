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

import math

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
    # The comparator, and the residual control C5b plants -- one the linear pipeline did not make.
    fits["gbt"] = models.fit_gbt(dev)
    return fits, dev


def fit_metric_nuisances(dev, fits, groups, constants):
    """The `allocation_loss ~ T1P` and `extreme_ut ~ T1P` fits that `MODEL_SPEC.md` §4 step 1 names.

    N1(c). Without them, Metrics C and D were estimated by regressing the raw centred quantity on
    `rating_resid`, which equals the partial coefficient only where `rating_resid` is orthogonal to
    the T1P column space -- approximately true on DEVELOPMENT, where the fit was made, and not on
    FINAL, which is the period condition 4 reads Metric D from.

    They are fitted after `ut_q95` exists, because `extreme_ut` is defined by it.
    """
    scored = residualise(dev, fits, constants)
    fits["partial_allocation"] = models.fit_frozen(scored, "T1P", "allocation_loss", groups,
                                                   penalty=fits["T1P"]["penalty"])
    fits["partial_extreme"] = models.fit_frozen(scored, "T1P", "extreme_ut", groups,
                                                penalty=fits["T1P"]["penalty"])
    # N5: C19's models are fitted on DEVELOPMENT here, never on the period they are read from.
    fits["T2R_C19"] = models.fit_frozen(dev, "T2R_C19", "log_time", groups,
                                        penalty=fits["T2R"]["penalty"])
    dev_c19 = dev.copy()
    dev_c19["_ut_c19"] = dev_c19["log_time"] - models.predict(fits["T2R_C19"], dev_c19)
    fits["Q0_C19"] = models.fit_frozen(dev_c19, "T2R_C19", "quality_loss", groups,
                                       penalty=fits["Q0"]["penalty"])
    fits["partial_ut_C19"] = models.fit_frozen(dev_c19, "T2R_C19", "_ut_c19", groups,
                                               penalty=fits["Q0"]["penalty"])
    return fits


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
    # `ut_q95` does not exist on the first pass -- it is a quantile OF this residual -- so the
    # indicator is empty then and correct on the second. `run.py` calls this twice for that reason.
    out["extreme_ut"] = (out["unexpected_time_population"]
                         > constants.get("ut_q95", float("inf"))).astype(float)
    if "gbt" in fits:
        out["ut_gbt"] = out["log_time"] - models.gbt_predict(fits["gbt"], out)
    # N1(c): Metrics C and D read residualised outcomes, not raw ones.
    if "partial_allocation" in fits:
        out["allocation_resid"] = (out["allocation_loss"]
                                   - models.predict(fits["partial_allocation"], out))
        out["extreme_resid"] = out["extreme_ut"] - models.predict(fits["partial_extreme"], out)
    else:
        out["allocation_resid"] = out["allocation_loss"] - out["allocation_loss"].mean()
        out["extreme_resid"] = out["extreme_ut"] - out["extreme_ut"].mean()
    # N5: C19's residual pair, both from DEVELOPMENT-fitted models.
    if "T2R_C19" in fits:
        out["ut_c19"] = out["log_time"] - models.predict(fits["T2R_C19"], out)
        out["q_resid_c19"] = out["quality_loss"] - models.predict(fits["Q0_C19"], out)
        out["ut_resid_c19"] = out["ut_c19"] - models.predict(fits["partial_ut_C19"], out)
    return out


# --- estimators, all one-parameter -------------------------------------------------------------
def slope(y, x) -> float:
    """`cov(y, x) / var(x)` INSIDE THE SET BEING ESTIMATED. Equivalently: with an intercept.

    N1 FROM THE GATE 1 RE-REVIEW, and it lands directly on the quantity the strongest verdict reads.
    The first draft used `<y, x> / <x, x>` -- a slope through the origin -- on the grounds that
    frozen ridge residuals have mean zero. They have mean zero **on DEVELOPMENT as a whole**: not
    inside a rating band, not for one player, not on another period. The uncentred form therefore
    carries `n * mean(y|set) * mean(x|set) / <x, x>`, a product of two frozen-model misfits with no
    allocation content and no determined sign.

    Measured on synthetic residuals with a true slope of 0.098 in every band, a band misfit of 0.08
    log-seconds in `eY` and 0.12 sd in `eV` moved the band slope to 0.084 or 0.107 -- 0.009 to 0.013,
    against a `TAE_FLOOR` of 0.02. At player level it is worse: a player's mean time residual is
    their pace (which Metric A predicts trends with rating) and their mean VoC residual is the kind
    of position they reach, so with 20-120 decisions each the product term is the same order as the
    allocation slope. That is the R1(a) mechanism reintroduced one level down, inside the check that
    is supposed to confirm the gradient at player level.
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.size < 2:
        return float("nan")
    xc = x - x.mean()
    yc = y - y.mean()
    denominator = float(xc @ xc)
    return float(xc @ yc) / denominator if denominator > 0 else float("nan")


def partial_correlation(y, x) -> float:
    """`corr(y, x)` inside the set being estimated -- centred, for the same reason as `slope`."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.size < 3:
        return float("nan")
    xc, yc = x - x.mean(), y - y.mean()
    denominator = math.sqrt(float(xc @ xc) * float(yc @ yc))
    return float(xc @ yc) / denominator if denominator > 0 else float("nan")


class RatingBasis:
    """A frozen spline basis for rating, so an interaction can carry its own main effect.

    R1(a) FROM GATE 1, AND IT WOULD HAVE MANUFACTURED THE HEADLINE RESULT. The first draft estimated
    the expertise gradient as the coefficient of `voc_resid x rating` with NO `rating` main effect
    in the model, because the nuisance set (T1P) deliberately contains no rating. An interaction
    without its main effect does not sit still: it absorbs

        (the rating main effect on time) x (E[voc_resid | rating])

    and neither factor is zero -- Metric A PREDICTS the first, and the second is non-zero whenever
    position distributions differ by band, which they do. So a population in which every player
    allocated time identically would still have produced a rating gradient in Metric B. The main
    effect enters as a spline with DEVELOPMENT knots, and the interaction is then what the name says.
    """

    def __init__(self, values, n_knots=5):
        from sklearn.preprocessing import SplineTransformer

        values = np.asarray(values, float).reshape(-1, 1)
        knots = np.unique(np.quantile(values, np.linspace(0, 1, n_knots + 2))).reshape(-1, 1)
        self.spline = SplineTransformer(degree=3, knots=knots, extrapolation="linear",
                                        include_bias=False).fit(values)
        self.knots = [float(k) for k in knots.ravel()]

    def transform(self, values) -> np.ndarray:
        return self.spline.transform(np.asarray(values, float).reshape(-1, 1))


def weighted_slope(y, x, w) -> float:
    """`cov_w(y, x) / var_w(x)`: the weighted slope with an intercept.

    The matched sample carries CEM weights, and the usual square-root trick (multiply both vectors
    by `sqrt(w)` and take an ordinary slope) is only correct through the origin. Once N1 made every
    slope centred, the centring had to be weighted too -- centring `sqrt(w) * x` by its unweighted
    mean is not centring `x` by its weighted mean, and the difference is a function of how the
    weights covary with the regressor, which in a matched sample is exactly what the weights are for.
    """
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    w = np.asarray(w, float)
    total = w.sum()
    if total <= 0 or x.size < 2:
        return float("nan")
    xbar = float(w @ x) / total
    ybar = float(w @ y) / total
    denominator = float(w @ (x - xbar) ** 2)
    return float(w @ ((x - xbar) * (y - ybar))) / denominator if denominator > 0 else float("nan")


def gradient_with_main_effect(y, x, rating_c, rating_block, weights=None):
    """`y ~ s(rating) + x + x*rating_c`. Returns (slope at mean rating, gradient per 100 Elo).

    Three free parameters plus the frozen-knot spline main effect: no nuisance choice is made on the
    period being read, which is what keeps the freeze intact while still letting FINAL supply the
    number the verdict reads.
    """
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    design = np.column_stack([rating_block, x, x * np.asarray(rating_c, float),
                              np.ones(len(x))])
    if weights is not None:
        # Weighted least squares, with the INTERCEPT scaled too. Scaling every column but the
        # intercept fits an unweighted constant against weighted covariates, which is not a
        # weighted regression of anything.
        root = np.sqrt(np.asarray(weights, float))[:, None]
        design = design * root
        y = y * root.ravel()
    coef, *_ = np.linalg.lstsq(design, y, rcond=None)
    return float(coef[-3]), float(coef[-2])


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
        draws = [self.rng.integers(0, len(self.unique), len(self.unique))
                 for _ in range(replicates)]
        # BUILT ONCE. The draws are fixed at construction, so the row indices they select are too --
        # and rebuilding them per statistic meant concatenating a few thousand small arrays about
        # ninety times over, once for every interval this study reports. Same numbers, two orders of
        # magnitude less work.
        self._resamples = [np.concatenate([self.index_by_player[p] for p in draw]) for draw in draws]
        self.n_rows = sum(len(i) for i in self.index_by_player)

    def indices(self, replicate: int) -> np.ndarray:
        return self._resamples[replicate]

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
            point = statistic(np.arange(self.n_rows))
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
