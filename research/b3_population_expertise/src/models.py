"""The model spec, as data.

`MODEL_SPEC.md` is the binding document and this file is its transcription. The feature lists are
literals rather than something assembled at runtime, so a reader can diff the code against the spec
and a test can assert that no model consumes a column the schema tags `POST_MOVE`.

WHY EVERYTHING IS FITTED ON DEVELOPMENT AND THEN FROZEN. Knots, category levels, standardisation
constants and the ridge penalty are all estimated quantities. Re-estimating any of them on the
period a result is read from would let the holdout inform the model that reads it, which is the
quiet version of looking at the answer.
"""
from __future__ import annotations

import json

import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import SplineTransformer

# --- the three expected-time models, MODEL_SPEC.md §1 ----------------------------------------
T0_NUMERIC = [
    "ply", "move_number", "clock_ms_self", "clock_ms_opp", "clock_frac", "clock_pressure",
    "clock_diff_frac", "non_pawn_material", "opponent_rating",
]
T0_CATEGORICAL = ["phase", "standing", "side_num"]

T1_NUMERIC = T0_NUMERIC + [
    "wp1", "edge", "gap12", "gap1k", "ambiguity_entropy", "n_near", "legal_moves",
    "best_move_changes", "eval_volatility", "pv_instability", "final_depth",
    "nodes_to_depth10", "nodes_to_depth10_missing",
]
T1_CATEGORICAL = T0_CATEGORICAL + ["in_check", "is_mate_line"]

T2_NUMERIC = T1_NUMERIC + ["voc_regret", "voc_drift", "voc_rank"]
T2_CATEGORICAL = T1_CATEGORICAL + ["voc_switch"]

# Exactly two, named in the preregistration, added before any of them was estimated.
INTERACTIONS = [("voc_z", "clock_pressure"), ("ambiguity_entropy", "clock_pressure")]

# 5 interior knots for the three the spec names, 4 elsewhere. MODEL_SPEC.md §0.
KNOTS_5 = {"ply", "clock_ms_self", "rating"}
DEFAULT_KNOTS = 4
RIDGE_GRID = [0.01, 0.1, 1.0, 10.0, 100.0]

SPECS = {
    "T0": (T0_NUMERIC, T0_CATEGORICAL, []),
    "T1P": (T1_NUMERIC, T1_CATEGORICAL, []),
    "T1R": (T1_NUMERIC + ["rating"], T1_CATEGORICAL, []),
    "T2P": (T2_NUMERIC, T2_CATEGORICAL, INTERACTIONS),
    "T2R": (T2_NUMERIC + ["rating"], T2_CATEGORICAL, INTERACTIONS),
}

ALL_MODEL_FEATURES = sorted(
    set(T2_NUMERIC + T2_CATEGORICAL + ["rating"] + [c for pair in INTERACTIONS for c in pair])
    - {"voc_z"}  # a frozen standardisation of voc_regret, which is itself in the list
)


class Design:
    """A frozen design matrix builder: knots, levels and scaling all estimated once."""

    def __init__(self, numeric, categorical, interactions):
        self.numeric = list(numeric)
        self.categorical = list(categorical)
        self.interactions = [tuple(i) for i in interactions]
        self.knots: dict[str, list[float]] = {}
        self.levels: dict[str, list] = {}
        self.center: dict[str, float] = {}
        self.scale: dict[str, float] = {}
        self._splines: dict[str, SplineTransformer] = {}
        self.columns: list[str] = []

    def fit(self, frame) -> "Design":
        for name in self.numeric:
            values = np.asarray(frame[name], dtype=float)
            n_knots = 5 if name in KNOTS_5 else DEFAULT_KNOTS
            distinct = np.unique(values)
            if len(distinct) < 20:
                # Too few distinct values for a spline to mean anything; enters linearly.
                self.knots[name] = []
                self.center[name] = float(values.mean())
                self.scale[name] = float(values.std() or 1.0)
                continue
            quantiles = np.quantile(values, np.linspace(0, 1, n_knots + 2))
            quantiles = np.unique(quantiles)
            if len(quantiles) < 4:
                self.knots[name] = []
                self.center[name] = float(values.mean())
                self.scale[name] = float(values.std() or 1.0)
                continue
            self.knots[name] = [float(q) for q in quantiles]
            spline = SplineTransformer(
                degree=3, knots=quantiles.reshape(-1, 1), extrapolation="linear",
                include_bias=False,
            )
            spline.fit(values.reshape(-1, 1))
            self._splines[name] = spline
        for name in self.categorical:
            self.levels[name] = sorted({str(v) for v in frame[name]})[1:]  # first level dropped
        for a, b in self.interactions:
            for name in (a, b):
                if name not in self.center:
                    values = np.asarray(frame[name], dtype=float)
                    self.center[name] = float(values.mean())
                    self.scale[name] = float(values.std() or 1.0)
        self.columns = self._column_names()
        return self

    def _column_names(self) -> list[str]:
        names = []
        for name in self.numeric:
            if name in self._splines:
                names += [f"{name}_s{i}" for i in range(self._splines[name].n_features_out_)]
            else:
                names.append(name)
        for name in self.categorical:
            names += [f"{name}={level}" for level in self.levels[name]]
        names += [f"{a}*{b}" for a, b in self.interactions]
        return names

    def transform(self, frame) -> np.ndarray:
        blocks = []
        for name in self.numeric:
            values = np.asarray(frame[name], dtype=float).reshape(-1, 1)
            if name in self._splines:
                blocks.append(self._splines[name].transform(values))
            else:
                blocks.append((values - self.center[name]) / self.scale[name])
        for name in self.categorical:
            column = np.asarray([str(v) for v in frame[name]])
            for level in self.levels[name]:
                blocks.append((column == level).astype(float).reshape(-1, 1))
        for a, b in self.interactions:
            za = (np.asarray(frame[a], dtype=float) - self.center[a]) / self.scale[a]
            zb = (np.asarray(frame[b], dtype=float) - self.center[b]) / self.scale[b]
            blocks.append((za * zb).reshape(-1, 1))
        return np.hstack(blocks)

    def to_json(self) -> dict:
        return {
            "numeric": self.numeric,
            "categorical": self.categorical,
            "interactions": [list(i) for i in self.interactions],
            "knots": self.knots,
            "levels": self.levels,
            "center": self.center,
            "scale": self.scale,
            "columns": self.columns,
        }


def choose_penalty(X, y, groups, grid=RIDGE_GRID, seed=0):
    """5-fold cross-validation GROUPED BY PLAYER.

    Ungrouped folds would score a move against a model fitted on the neighbouring move of the same
    game, which is not out-of-sample by any definition this study can use.
    """
    splitter = GroupKFold(n_splits=5)
    best, best_score = grid[0], -np.inf
    for alpha in grid:
        scores = []
        for train, test in splitter.split(X, y, groups):
            model = Ridge(alpha=alpha, fit_intercept=True)
            model.fit(X[train], y[train])
            prediction = model.predict(X[test])
            residual = y[test] - prediction
            total = y[test] - y[test].mean()
            scores.append(1 - float(residual @ residual) / float(total @ total))
        mean_score = float(np.mean(scores))
        if mean_score > best_score:
            best, best_score = alpha, mean_score
    return best, best_score


def fit_frozen(frame, spec_name, target, groups, penalty=None):
    """Fit one model on DEVELOPMENT and hand back everything needed to apply it unchanged."""
    numeric, categorical, interactions = SPECS[spec_name]
    design = Design(numeric, categorical, interactions).fit(frame)
    X = design.transform(frame)
    y = np.asarray(frame[target], dtype=float)
    if penalty is None:
        penalty, cv_r2 = choose_penalty(X, y, groups)
    else:
        _, cv_r2 = penalty, None
    model = Ridge(alpha=penalty, fit_intercept=True)
    model.fit(X, y)
    return {
        "spec": spec_name,
        "target": target,
        "design": design,
        "model": model,
        "penalty": penalty,
        "cv_r2": cv_r2,
    }


def predict(fitted, frame) -> np.ndarray:
    return fitted["model"].predict(fitted["design"].transform(frame))


def r2(y, yhat) -> float:
    y = np.asarray(y, dtype=float)
    residual = y - yhat
    total = y - y.mean()
    return 1 - float(residual @ residual) / float(total @ total)


def manifest_entry(fitted) -> dict:
    return {
        "spec": fitted["spec"],
        "target": fitted["target"],
        "penalty": fitted["penalty"],
        "cv_r2": fitted["cv_r2"],
        "intercept": float(fitted["model"].intercept_),
        "coefficients": dict(zip(fitted["design"].columns,
                                 [float(c) for c in fitted["model"].coef_])),
        "design": fitted["design"].to_json(),
    }
