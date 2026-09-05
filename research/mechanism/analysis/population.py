"""
NODE G (PERSONAL): is the frozen region an elevation for THIS player, or for everyone?

Population reference: 600 games of 2026-06 blitz (180+0, 300+0), both sides rated 1450-1850, one
game per player, scored under the same engine regime and the same feature extractor.

For a frozen region R:
  1. population raw contrast inside vs outside R (clustered by game);
  2. population residual contrast under a baseline fit ON THE POPULATION (so "generic difficulty"
     is defined by the population, not by erez281);
  3. erez281's residual elevation in R under the POPULATION baseline, on VALIDATE (and TEST when
     opened): the quantity that says "more than a same-rating player in the same situation";
  4. the distribution of per-player-side elevations in R across the population (one number per
     side with >= 8 decisions in R and >= 8 out), and erez281's rank in it (VALIDATE window).
Population evidence establishes only what the region means for a population; it cannot establish
that erez281 has the mechanism (mission §3 R6).
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions.parquet")
    ap.add_argument("--population", default="decisions_pop.parquet")
    ap.add_argument("--region", required=True)
    ap.add_argument("--target", default="err")
    ap.add_argument("--frame", default="VALIDATE")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    design = vocab.DESIGN
    pop = eligible(load_decisions(a.population, corpus=None))
    pop = pop[pop["corpus"] != "erez281"].reset_index(drop=True)
    me = chronological_split(eligible(load_decisions(a.decisions)), design["derive_frac"], design["validate_frac"])
    fr = me[me.split == a.frame].reset_index(drop=True)
    sg = ps.Conjunction.from_str(a.region)
    ins_pop = np.asarray(sg.covers(pop), bool); ins_me = np.asarray(sg.covers(fr), bool)
    # 1. population raw contrast
    raw_pop = region_contrast(pop, ins_pop, a.target)
    raw_me = region_contrast(fr, ins_me, a.target)
    # 2/3. population baseline, applied to both
    _, (popr, frr) = residualize(pop, [fr], a.target, design["baseline_cols"], design["baseline_cat"])
    rc = f"{a.target}_resid"
    def rcontrast(d, ins):
        x, sx = clustered_rate_se(d.loc[ins, rc].values, d.loc[ins, "game_id"].values)
        y, sy = clustered_rate_se(d.loc[~ins, rc].values, d.loc[~ins, "game_id"].values)
        se = np.sqrt(sx ** 2 + sy ** 2)
        return {"resid_in": x, "resid_out": y, "diff": x - y, "z": (x - y) / se if se > 0 else None, "n_in": int(ins.sum())}
    res_pop = rcontrast(popr, ins_pop); res_me = rcontrast(frr, ins_me)
    # 4. per-player-side elevation distribution (residual inside - outside under the population baseline)
    popr["inside"] = ins_pop
    elev = []
    for key, d in popr.groupby("player_key"):
        i = d["inside"].values
        if i.sum() >= 8 and (~i).sum() >= 8:
            elev.append({"player": key, "n_in": int(i.sum()), "elev": float(d.loc[i, rc].mean() - d.loc[~i, rc].mean()),
                         "raw_elev": float(d.loc[i, a.target].mean() - d.loc[~i, a.target].mean())})
    ev = np.array([e["elev"] for e in elev]); rv = np.array([e["raw_elev"] for e in elev])
    my_elev = res_me["diff"]; my_raw = raw_me["diff"]
    out = {"region": a.region, "frame": a.frame,
           "population": {"n": len(pop), "games": int(pop.game_id.nunique()), "sides": int(pop.player_key.nunique()), "base_err": float(pop[a.target].mean()),
                          "raw": raw_pop, "resid": res_pop},
           "erez281": {"n": len(fr), "raw": raw_me, "resid_under_population_baseline": res_me},
           "per_side": {"n_sides": len(elev), "elev_mean": float(ev.mean()) if len(ev) else None, "elev_sd": float(ev.std()) if len(ev) else None,
                        "elev_q": {q: float(np.quantile(ev, q)) for q in (0.05, 0.25, 0.5, 0.75, 0.95)} if len(ev) else None,
                        "erez_elev": my_elev, "erez_percentile": float((ev < my_elev).mean()) if len(ev) else None,
                        "raw_q": {q: float(np.quantile(rv, q)) for q in (0.05, 0.25, 0.5, 0.75, 0.95)} if len(rv) else None,
                        "erez_raw_elev": my_raw, "erez_raw_percentile": float((rv < my_raw).mean()) if len(rv) else None}}
    json.dump(out, open(a.out, "w"), indent=1, default=str)
    print(f"population: n={len(pop)} sides={pop.player_key.nunique()} base_err={pop[a.target].mean():.3f}")
    print(f"  raw in/out {raw_pop['p_in']:.3f}/{raw_pop['p_out']:.3f} diff={raw_pop['diff']:+.3f} z={raw_pop['z']:+.2f}; resid diff={res_pop['diff']:+.4f} z={res_pop['z']}")
    print(f"erez281 [{a.frame}]: raw in/out {raw_me['p_in']:.3f}/{raw_me['p_out']:.3f} diff={raw_me['diff']:+.3f} z={raw_me['z']:+.2f}; resid (pop baseline) diff={res_me['diff']:+.4f} z={res_me['z']}")
    if len(ev):
        print(f"per-side elevation: n={len(ev)} mean={ev.mean():+.4f} sd={ev.std():.4f} q05/50/95={np.quantile(ev,.05):+.3f}/{np.quantile(ev,.5):+.3f}/{np.quantile(ev,.95):+.3f}; erez={my_elev:+.4f} percentile={(ev<my_elev).mean():.3f}")


if __name__ == "__main__":
    main()
