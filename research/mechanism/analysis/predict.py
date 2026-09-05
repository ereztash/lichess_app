"""
NODE H: does the frozen candidate predict NEW mistakes beyond simpler baselines?

Everything is fit on DERIVE (+ VALIDATE once the candidate is frozen, if `--fit-on both`), and
evaluated ONCE on TEST (the newest 20% of games) and on EXTRA (post-freeze games).

Models compared on held-out log-loss / AUC, all logistic:
  M0  history-only      : intercept (the player's overall error rate)
  M1  six buckets       : phase, seconds<45, seconds>120, clock<60s (the product's vocabulary)
  M2  context           : M1 + speed + color + standing + eco family
  M3  baseline          : the frozen design's difficulty+time+context baseline
  M4  baseline + region : M3 + the frozen region indicator
  M5  context + region  : M2 + region (does the region add beyond context without engine features?)
Plus, inside the region on TEST: observed error vs M3-predicted error (calibration gap of the
baseline in the region), with a game-clustered SE; and a shuffled-label control for the region's
increment (labels permuted within game on TEST, 200 draws).
"""
from __future__ import annotations
import argparse, json, sys
import numpy as np
import pandas as pd
import pysubgroup as ps
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import log_loss, roc_auc_score
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, chronological_split, region_contrast, clustered_rate_se, shuffle_within_game
import vocab


def make_model(num, cat):
    pre = ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
    ])
    return Pipeline([("pre", pre), ("lr", LogisticRegression(max_iter=3000, C=1.0))])


def add_cols(df):
    df = df.copy()
    df["fast45"] = (df["seconds"] < 45).astype(float)
    df["slow120"] = (df["seconds"] > 120).astype(float)
    df["eco_family"] = df["eco_family"].fillna("?")
    return df


def evaluate(fit: pd.DataFrame, test: pd.DataFrame, region_col: str, target: str):
    specs = {
        "M0_history": ([], []),
        "M1_six_buckets": (["fast45", "slow120", "clock_under_60s"], ["phase"]),
        "M2_context": (["fast45", "slow120", "clock_under_60s", "rating_diff"], ["phase", "speed", "color", "standing", "eco_family"]),
        "M3_baseline": ([c for c in vocab.BASELINE_COLS if c not in vocab.BASELINE_CAT], vocab.BASELINE_CAT),
        "M4_baseline_region": ([c for c in vocab.BASELINE_COLS if c not in vocab.BASELINE_CAT] + [region_col], vocab.BASELINE_CAT),
        "M5_context_region": (["fast45", "slow120", "clock_under_60s", "rating_diff", region_col], ["phase", "speed", "color", "standing", "eco_family"]),
    }
    out = {}
    preds = {}
    for name, (num, cat) in specs.items():
        if not num and not cat:
            p = np.full(len(test), fit[target].mean())
        else:
            m = make_model(num, cat); m.fit(fit[num + cat], fit[target])
            p = m.predict_proba(test[num + cat])[:, 1]
        preds[name] = p
        out[name] = {"logloss": float(log_loss(test[target], p)), "auc": float(roc_auc_score(test[target], p))}
    return out, preds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions.parquet")
    ap.add_argument("--extra", default=None, help="parquet of post-freeze decisions")
    ap.add_argument("--region", required=True)
    ap.add_argument("--target", default="err")
    ap.add_argument("--fit-on", default="derive", choices=["derive", "both"])
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    design = vocab.DESIGN
    df = add_cols(chronological_split(eligible(load_decisions(a.decisions)), design["derive_frac"], design["validate_frac"]))
    sg = ps.Conjunction.from_str(a.region)
    df["region"] = np.asarray(sg.covers(df), float)
    fit = df[df.split.isin(["DERIVE"] + (["VALIDATE"] if a.fit_on == "both" else []))].reset_index(drop=True)
    test = df[df.split == "TEST"].reset_index(drop=True)
    frames = {"TEST": test}
    if a.extra:
        ex = add_cols(eligible(load_decisions(a.extra))); ex["region"] = np.asarray(sg.covers(ex), float); frames["EXTRA"] = ex
    report = {"region": a.region, "fit_on": a.fit_on, "n_fit": len(fit), "frames": {}}
    for fname, fr in frames.items():
        metrics, preds = evaluate(fit, fr, "region", a.target)
        inside = fr["region"].values == 1
        c = region_contrast(fr, inside, a.target)
        # baseline calibration inside the region: observed - M3 predicted, clustered SE
        gap = fr[a.target].values - preds["M3_baseline"]
        g_in, se_in = clustered_rate_se(gap[inside], fr.loc[inside, "game_id"].values)
        g_out, se_out = clustered_rate_se(gap[~inside], fr.loc[~inside, "game_id"].values)
        se = np.sqrt(se_in ** 2 + se_out ** 2)
        # shuffled-label control on the region increment (M3 -> M4 logloss gain)
        rng = np.random.default_rng(design["seed"] + 777)
        base_gain = metrics["M3_baseline"]["logloss"] - metrics["M4_baseline_region"]["logloss"]
        gains = []
        for _ in range(200):
            sh = shuffle_within_game(fr, a.target, rng)
            m3 = log_loss(sh[a.target], preds["M3_baseline"]); m4 = log_loss(sh[a.target], preds["M4_baseline_region"])
            gains.append(m3 - m4)
        report["frames"][fname] = {
            "n": len(fr), "games": int(fr.game_id.nunique()), "base_err": float(fr[a.target].mean()),
            "region_contrast": c, "baseline_gap_in_region": {"gap_in": g_in, "gap_out": g_out, "diff": g_in - g_out, "z": (g_in - g_out) / se if se > 0 else None},
            "models": metrics, "region_logloss_gain_over_baseline": base_gain,
            "shuffled_gain_p": float(np.mean([g >= base_gain for g in gains])), "shuffled_gain_max": float(np.max(gains)),
        }
        print(f"[{fname}] n={len(fr)} games={fr.game_id.nunique()} region n_in={c['n_in']} err_in={c['p_in']:.3f} err_out={c['p_out']:.3f} z={c['z']:.2f}")
        print(f"   baseline gap in region: {g_in:+.4f} vs out {g_out:+.4f}  z={(g_in-g_out)/se if se>0 else float('nan'):+.2f}")
        for k, v in metrics.items():
            print(f"   {k:22s} logloss={v['logloss']:.5f} auc={v['auc']:.4f}")
        print(f"   region gain over baseline: {base_gain:+.5f}; shuffled p={report['frames'][fname]['shuffled_gain_p']:.3f} (max shuffled {np.max(gains):+.5f})")
    json.dump(report, open(a.out, "w"), indent=1, default=str)


if __name__ == "__main__":
    main()
