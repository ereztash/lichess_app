"""
NODE G: does a frozen region's error elevation survive materially different chess contexts?

For a frozen region (a pysubgroup Conjunction string), on a given frame (VALIDATE, later TEST):
  * the raw contrast inside vs outside within each stratum of each context dimension
    (opening family, color, phase, speed, standing, rating era, clock state);
  * the residual (baseline-adjusted) contrast within each stratum;
  * leave-one-context-out: drop one whole stratum and re-judge.
A region earns "cross-context" only if the elevation holds in most strata that carry enough
decisions, and no single stratum carries the effect alone.
"""
from __future__ import annotations
import argparse, json, sys
import numpy as np
import pandas as pd
import pysubgroup as ps
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, chronological_split, region_contrast, clustered_rate_se
from search import residualize
import vocab

CONTEXTS = {
    "eco_family": lambda d: d["eco_family"].fillna("?"),
    "color": lambda d: d["color"],
    "phase": lambda d: d["phase"],
    "speed": lambda d: d["speed"],
    "standing": lambda d: d["standing"],
    "era": lambda d: pd.to_datetime(d["createdAt"], unit="ms").dt.year.astype(str),
    "clock_state": lambda d: np.where(d["clock_own_ms"] < 30000, "<30s", np.where(d["clock_own_ms"] < 60000, "30-60s", ">=60s")),
    "material": lambda d: np.where(d["non_pawn_material"] <= 13, "endgame-material", np.where(d["non_pawn_material"] <= 40, "reduced", "full")),
    "opp_last": lambda d: np.where(d["opp_last_capture"] == 1, "after-capture", np.where(d["opp_last_check"] == 1, "after-check", "quiet")),
}


def region_from_str(s: str) -> ps.Conjunction:
    return ps.Conjunction.from_str(s)


def strata_table(frame: pd.DataFrame, inside: np.ndarray, target: str, resid_col: str | None, min_n: int = 60) -> list[dict]:
    rows = []
    for name, fn in CONTEXTS.items():
        strata = pd.Series(np.asarray(fn(frame)), index=frame.index)
        for lvl in sorted(strata.dropna().unique()):
            m = (strata == lvl).values
            sub = frame[m]; ins = inside[m]
            if ins.sum() < min_n or (~ins).sum() < min_n:
                rows.append({"context": name, "stratum": str(lvl), "n_in": int(ins.sum()), "n_out": int((~ins).sum()), "diff": None, "z": None, "resid_diff": None})
                continue
            c = region_contrast(sub, ins, target)
            r = {"context": name, "stratum": str(lvl), "n_in": c["n_in"], "n_out": c["n_out"], "p_in": c["p_in"], "p_out": c["p_out"], "diff": c["diff"], "z": c["z"]}
            if resid_col:
                a, sa = clustered_rate_se(sub.loc[ins, resid_col].values, sub.loc[ins, "game_id"].values)
                b, sb = clustered_rate_se(sub.loc[~ins, resid_col].values, sub.loc[~ins, "game_id"].values)
                se = np.sqrt(sa ** 2 + sb ** 2)
                r["resid_diff"] = a - b; r["resid_z"] = (a - b) / se if se > 0 else None
            rows.append(r)
    return rows


def leave_one_out(frame: pd.DataFrame, inside: np.ndarray, target: str, resid_col: str | None) -> list[dict]:
    rows = []
    for name, fn in CONTEXTS.items():
        strata = pd.Series(np.asarray(fn(frame)), index=frame.index)
        for lvl in sorted(strata.dropna().unique()):
            keep = (strata != lvl).values
            sub = frame[keep]; ins = inside[keep]
            if ins.sum() < 100:
                continue
            c = region_contrast(sub, ins, target)
            r = {"dropped": f"{name}={lvl}", "n_in": c["n_in"], "diff": c["diff"], "z": c["z"]}
            if resid_col:
                a, sa = clustered_rate_se(sub.loc[ins, resid_col].values, sub.loc[ins, "game_id"].values)
                b, sb = clustered_rate_se(sub.loc[~ins, resid_col].values, sub.loc[~ins, "game_id"].values)
                se = np.sqrt(sa ** 2 + sb ** 2)
                r["resid_z"] = (a - b) / se if se > 0 else None
            rows.append(r)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions.parquet")
    ap.add_argument("--region", required=True)
    ap.add_argument("--frame", default="VALIDATE", choices=["VALIDATE", "TEST", "DERIVE"])
    ap.add_argument("--target", default="err")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    design = vocab.DESIGN
    df = chronological_split(eligible(load_decisions(a.decisions)), design["derive_frac"], design["validate_frac"])
    dv = df[df.split == "DERIVE"].reset_index(drop=True)
    fr = df[df.split == a.frame].reset_index(drop=True)
    _, (dv, fr) = residualize(dv, [fr], a.target, design["baseline_cols"], design["baseline_cat"])
    sg = region_from_str(a.region)
    inside = np.asarray(sg.covers(fr), bool)
    overall = region_contrast(fr, inside, a.target)
    out = {"region": a.region, "frame": a.frame, "overall": overall,
           "strata": strata_table(fr, inside, a.target, f"{a.target}_resid"),
           "leave_one_out": leave_one_out(fr, inside, a.target, f"{a.target}_resid")}
    json.dump(out, open(a.out, "w"), indent=1, default=str)
    print(f"overall: n_in={overall['n_in']} diff={overall['diff']:.3f} z={overall['z']:.2f}")
    for r in out["strata"]:
        if r.get("z") is not None:
            print(f"  {r['context']:12s} {r['stratum']:18s} n_in={r['n_in']:5d} diff={r['diff']:+.3f} z={r['z']:+.2f} resid_z={r.get('resid_z')}")
        else:
            print(f"  {r['context']:12s} {r['stratum']:18s} n_in={r['n_in']:5d} (too thin)")


if __name__ == "__main__":
    main()
