"""Descriptives of the personal decision table against the repository's canonical numbers, plus the
game-level ICC of the error indicator (D02 reversal condition 2)."""
from __future__ import annotations
import json, sys
import numpy as np
import pandas as pd
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, chronological_split
import vocab


def icc_binary(df, col="err"):
    """One-way ANOVA ICC of a binary outcome with games as groups (statsmodels-free)."""
    g = df.groupby("game_id")[col]
    n_i = g.count().values.astype(float); m_i = g.mean().values
    k = len(n_i); N = n_i.sum(); grand = df[col].mean()
    ss_between = float((n_i * (m_i - grand) ** 2).sum())
    ss_within = float(((df[col] - df["game_id"].map(g.mean())) ** 2).sum())
    ms_b = ss_between / (k - 1); ms_w = ss_within / (N - k)
    n0 = (N - (n_i ** 2).sum() / N) / (k - 1)
    return (ms_b - ms_w) / (ms_b + (n0 - 1) * ms_w)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "decisions.parquet"
    df = load_decisions(path)
    el = eligible(df)
    out = {}
    out["rows"] = len(df); out["eligible"] = len(el); out["games"] = int(df.game_id.nunique())
    out["forced"] = int(df.forced.sum()); out["book"] = int(df.book.sum())
    out["accurate_rate_eligible"] = float(el.y_accurate.mean())
    out["blunder10_rate"] = float(el.blunder10.mean()); out["mean_wp_loss"] = float(el.y_wp_loss.mean())
    bands = [(0, 1), (2, 3), (4, 7), (8, 15), (16, 45), (46, 10**9)]
    tt = []
    for lo, hi in bands:
        m = (el.seconds.round() >= lo) & (el.seconds.round() <= hi)
        tt.append({"band": f"{lo}-{hi if hi < 10**9 else '+'}", "n": int(m.sum()), "accurate": float(el.loc[m, "y_accurate"].mean())})
    out["think_time_bands"] = tt
    canon = {"phase-endgame": 0.8042, "clock-under-1m": 0.6938, "phase-opening": 0.6426, "standing-winning": 0.6378,
             "standing-losing": 0.6289, "fast-under-45s": 0.6271, "standing-level": 0.6097, "phase-middlegame": 0.6035}
    mine = {"phase-endgame": el[el.phase == "endgame"].y_accurate.mean(), "clock-under-1m": el[el.clock_own_ms < 60000].y_accurate.mean(),
            "phase-opening": el[el.phase == "opening"].y_accurate.mean(), "standing-winning": el[el.standing == "winning"].y_accurate.mean(),
            "standing-losing": el[el.standing == "losing"].y_accurate.mean(), "fast-under-45s": el[el.seconds < 45].y_accurate.mean(),
            "standing-level": el[el.standing == "level"].y_accurate.mean(), "phase-middlegame": el[el.phase == "middlegame"].y_accurate.mean()}
    out["bucket_comparison"] = {k: {"canonical_wasm": canon[k], "this_sf171": float(mine[k])} for k in canon}
    out["icc_err_game"] = float(icc_binary(el, "err")); out["icc_blunder10_game"] = float(icc_binary(el, "blunder10"))
    sp = chronological_split(el, vocab.DESIGN["derive_frac"], vocab.DESIGN["validate_frac"])
    out["split"] = {s: {"decisions": int((sp.split == s).sum()), "games": int(sp[sp.split == s].game_id.nunique()),
                        "err": float(sp[sp.split == s].err.mean()),
                        "first": str(pd.to_datetime(sp[sp.split == s].createdAt.min(), unit="ms").date()),
                        "last": str(pd.to_datetime(sp[sp.split == s].createdAt.max(), unit="ms").date())} for s in ("DERIVE", "VALIDATE", "TEST")}
    out["context_mix_eligible"] = {"color": el.color.value_counts().to_dict(), "phase": el.phase.value_counts().to_dict(),
                                   "speed": el.speed.value_counts().to_dict(), "eco_family": el.eco_family.value_counts().to_dict(),
                                   "standing": el.standing.value_counts().to_dict()}
    # feature availability
    miss = {c: float(el[c].isna().mean()) for c in vocab.VOCAB["ALL"] if c in el.columns}
    out["missing_share_vocab"] = {k: v for k, v in miss.items() if v > 0}
    out["err_by_opp_last"] = {"after_capture": float(el[el.opp_last_capture == 1].err.mean()), "after_check": float(el[el.opp_last_check == 1].err.mean()),
                              "quiet": float(el[(el.opp_last_capture == 0) & (el.opp_last_check == 0)].err.mean())}
    json.dump(out, open("results/describe.json", "w"), indent=1, default=str)
    print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main()
