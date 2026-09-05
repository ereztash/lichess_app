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


# ---------------------------------------------------------------------------------------------------
# Design v1.8: the POPULATION as the baseline. A flexible model of the target is fit on same-rating
# population decisions (pre-move features only); the owner's residual (target - p_pop) is what the
# search reads. A region found this way is where the owner errs more than a typical same-rating
# player would in the same pre-move situation.
# ---------------------------------------------------------------------------------------------------
def population_feature_columns():
    import vocab
    num = [c for c in vocab.VOCAB["OBS"] if c not in ("phase", "standing", "color", "speed", "prev_game_result")]
    num += [c for c in vocab.VOCAB["ENG"]]
    num += ["log_seconds", "clock_frac", "clock_under_60s", "rating_diff", "ply", "free_capture", "opp_hanging_any",
            "own_hanging_value", "opp_hanging_value", "own_support_edges", "opp_support_edges", "own_attack_edges", "opp_attack_edges",
            "own_min_defenders_on_attacked", "own_max_defense_dependency", "opp_pinned_count", "own_king_ring_own_defenses",
            "opp_king_ring_own_defenses", "own_redundantly_defended_count", "opp_redundantly_defended_count", "opp_overloaded_piece_count",
            "opp_mobility", "piece_count", "own_pawns", "opp_pawns", "own_doubled", "own_isolated", "opp_doubled", "opp_isolated",
            "max_capture_value", "new_attacks_on_own", "wp1", "gap13", "n_lines"]
    num = list(dict.fromkeys(num))
    cat = ["phase", "standing", "color", "ply_bin"]
    return num, cat


def fit_population_model(pop: pd.DataFrame, target: str, seed: int = 20260905):
    """HistGradientBoosting on the population; returns (pipeline, game-grouped CV AUC)."""
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.metrics import roc_auc_score
    num, cat = population_feature_columns()
    num = [c for c in num if c in pop.columns and pop[c].nunique(dropna=True) > 1]
    pop = pop.copy()
    for c in num:
        pop[c] = pd.to_numeric(pop[c], errors="coerce").astype(float)
    pre = ColumnTransformer([("num", "passthrough", num), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)], sparse_threshold=0)
    model = Pipeline([("pre", pre), ("gb", HistGradientBoostingClassifier(max_iter=400, learning_rate=0.05, max_leaf_nodes=31,
                                                                          min_samples_leaf=60, l2_regularization=1.0, random_state=seed))])
    # game-grouped 5-fold CV AUC on the population
    games = np.array(list(pop.game_id.unique()), dtype=object); rng = np.random.default_rng(seed); rng.shuffle(games)
    fold = {g: i % 5 for i, g in enumerate(games)}; f = pop.game_id.map(fold).values
    aucs = []
    for k in range(5):
        tr = pop[f != k]; ho = pop[f == k]
        model.fit(tr[num + cat], tr[target]); aucs.append(roc_auc_score(ho[target], model.predict_proba(ho[num + cat])[:, 1]))
    model.fit(pop[num + cat], pop[target])
    return model, float(np.mean(aucs)), num + cat


_POP_CACHE = {}


def residualize_population(pop: pd.DataFrame, frames: list[pd.DataFrame], target: str):
    """The population model does not depend on the owner's frames: fit once per (population, target)."""
    from common import within_game_demean
    key = (id(pop), target)
    if key not in _POP_CACHE:
        _POP_CACHE[key] = fit_population_model(pop, target)
    model, auc, cols = _POP_CACHE[key]
    outs = []
    for fr in frames:
        fr = fr.copy()
        X = fr[cols].copy()
        for c in cols[:-4]:
            X[c] = pd.to_numeric(X[c], errors="coerce").astype(float)
        p = model.predict_proba(X)[:, 1]
        fr[f"{target}_hat"] = p; fr[f"{target}_resid"] = fr[target] - p
        fr[f"{target}_resid_wg"] = within_game_demean(fr, f"{target}_resid"); fr[f"{target}_wg"] = within_game_demean(fr, target)
        outs.append(fr)
    return (model, auc), outs
