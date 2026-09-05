"""
Governed subgroup search: derive on DERIVE games, freeze, judge on VALIDATE games.

Generalises research/discovery-oracle/q7_candidate_search.py (D04, E3) from the six-bucket
vocabulary and the calibration-gap target to (a) a governed pre-move feature vocabulary with cuts
fixed on the derivation half only, (b) a binary error target or a baseline-residual target, and
(c) depth 1..3 conjunctions. The search/freeze/judge discipline is unchanged:

    search on DERIVE  ->  freeze the top candidate(s)  ->  judge on VALIDATE with a clustered SE

Nothing about a candidate's identity may be chosen by looking at VALIDATE or TEST.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
import pysubgroup as ps
from common import region_contrast, clustered_rate_se


def fixed_cuts(derive: pd.DataFrame, feature: str, kind: str, cuts: list[float] | None = None) -> list[ps.SelectorBase]:
    """Selectors for one feature. `kind`:
       'bool'      -> ==1 and ==0
       'cat'       -> one EqualitySelector per observed level
       'cuts'      -> IntervalSelectors between the given fixed cut points (both tails included)
       'quantile'  -> cuts at derivation-half tertiles (fixed BEFORE validation is touched)
    """
    sels: list[ps.SelectorBase] = []
    if kind == "bool":
        sels = [ps.EqualitySelector(feature, 1), ps.EqualitySelector(feature, 0)]
    elif kind == "cat":
        for lvl in sorted(derive[feature].dropna().unique()):
            sels.append(ps.EqualitySelector(feature, lvl))
    elif kind in ("cuts", "quantile"):
        if kind == "quantile":
            q = derive[feature].dropna().quantile([1 / 3, 2 / 3]).values
            cuts = sorted(set(float(x) for x in q))
        edges = [float("-inf")] + list(cuts) + [float("inf")]
        for lo, hi in zip(edges[:-1], edges[1:]):
            if lo == hi:
                continue
            sels.append(ps.IntervalSelector(feature, lo, hi))
        # also the two tails as single cuts (>= first cut, < last cut) so a monotone effect is
        # expressible with one selector rather than a union
        if len(cuts) > 1:
            sels.append(ps.IntervalSelector(feature, float("-inf"), cuts[-1]))
            sels.append(ps.IntervalSelector(feature, cuts[0], float("inf")))
    return sels


def build_selectors(derive: pd.DataFrame, vocabulary: dict) -> list[ps.SelectorBase]:
    out = []
    for feature, spec in vocabulary.items():
        kind = spec["kind"]
        out.extend(fixed_cuts(derive, feature, kind, spec.get("cuts")))
    return out


def search(derive: pd.DataFrame, target: str, selectors, depth: int, result_size: int,
           numeric: bool, min_size: int, max_size: int, beam: int = 30):
    """Top candidates on the derivation half. Size constraints are part of the frozen design."""
    if numeric:
        tgt = ps.NumericTarget(target)
        qf = ps.StandardQFNumeric(a=0.5)
    else:
        tgt = ps.BinaryTarget(target, 1)
        qf = ps.StandardQF(a=0.5)
    constraints = [ps.MinSupportConstraint(min_size)]
    # retrieve many more than needed: the size cap below is applied after retrieval, and the top of the
    # list is often oversized regions (a single broad selector) that the cap removes
    rss = max(40, result_size * 20)
    task = ps.SubgroupDiscoveryTask(derive, tgt, selectors, result_set_size=rss, depth=depth,
                                    qf=qf, constraints=constraints)
    res = ps.BeamSearch(beam_width=max(beam, rss)).execute(task)
    rows = []
    for item in res.to_descriptions():
        quality, sg = item[0], item[1]
        cov = sg.covers(derive)
        n = int(cov.sum())
        if n < min_size or n > max_size:
            continue
        rows.append({"quality": float(quality), "region": str(sg), "sg": sg, "n_derive": n,
                     "depth": len(sg.selectors)})
        if len(rows) >= result_size:
            break
    return rows


def judge_region(validate: pd.DataFrame, sg, target: str, k: float, min_n: int) -> dict:
    """Design v1.3: the judge is the within-game (game fixed effects) contrast of the raw target.
    Between-game numbers are reported beside it but never decide."""
    from common import within_game_contrast
    inside = np.asarray(sg.covers(validate), bool)
    out = region_contrast(validate, inside, target)
    wg = within_game_contrast(validate, inside, target)
    out["wg_est"] = wg["est"]; out["wg_se"] = wg["se"]; out["wg_z"] = wg["z"]; out["wg_games"] = wg["n_games"]
    out["pass"] = bool(out["n_in"] >= min_n and out["n_out"] >= min_n and np.isfinite(wg["z"]) and wg["z"] >= k)
    out["region"] = str(sg)
    return out


def residualize(derive: pd.DataFrame, others: list[pd.DataFrame], target: str, baseline_cols: list[str],
                cat_cols: list[str]):
    """Fit a baseline logistic model on DERIVE only; return residual columns for every frame.
    Residual = y - p_hat. A region with a positive residual mean is one where the player errs more
    than the baseline predicts."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    num = [c for c in baseline_cols if c not in cat_cols]
    pre = ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ])
    model = Pipeline([("pre", pre), ("lr", LogisticRegression(max_iter=2000, C=1.0))])
    X = derive[baseline_cols]; y = derive[target]
    model.fit(X, y)
    from common import within_game_demean
    outs = []
    for fr in [derive] + others:
        p = model.predict_proba(fr[baseline_cols])[:, 1]
        fr = fr.copy(); fr[f"{target}_hat"] = p; fr[f"{target}_resid"] = fr[target] - p
        # v1.3: the search target is the residual demeaned WITHIN game, so a region can only score
        # by decision-level structure inside games, never by selecting bad games
        fr[f"{target}_resid_wg"] = within_game_demean(fr, f"{target}_resid")
        fr[f"{target}_wg"] = within_game_demean(fr, target)
        outs.append(fr)
    return model, outs


def add_within_game_targets(frames: list[pd.DataFrame], target: str) -> list[pd.DataFrame]:
    from common import within_game_demean
    out = []
    for fr in frames:
        fr = fr.copy(); fr[f"{target}_wg"] = within_game_demean(fr, target); out.append(fr)
    return out
