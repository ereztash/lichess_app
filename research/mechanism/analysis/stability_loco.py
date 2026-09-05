"""
NODE D (derivation stability): leave-one-context-out re-derivation. Drop one whole context stratum
(an opening family, a colour, a phase, a speed, an era) from DERIVE, re-run the frozen search at the
frozen depth, and report the Jaccard (on VALIDATE coverage) between the new winner and R*.
Also: history windows (older half / newer half of DERIVE) and half-size subsamples.
"""
from __future__ import annotations
import argparse, json, sys
import numpy as np
import pandas as pd
import pysubgroup as ps
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, chronological_split, jaccard
from search import build_selectors, search, residualize
from run_discovery import prepare
from invariance import CONTEXTS
import vocab


def winner(dv, va, target, design, depth):
    sels = build_selectors(dv, design["vocab"])
    (dvr, var), stgt, ctgt = prepare(dv, [va], target, design)
    c = search(dvr, stgt, sels, depth, 1, True, design["min_size"], design["max_size"], beam=design.get("beam", 30))
    return c[0]["sg"] if c else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions_v2.parquet")
    ap.add_argument("--region", required=True)
    ap.add_argument("--target", default="cls_tactical")
    ap.add_argument("--depth", type=int, default=2)
    ap.add_argument("--vocab", default="OBS")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    design = vocab.DESIGN.copy(); design["vocab"] = vocab.VOCAB[a.vocab]; design["residual"] = True
    df = chronological_split(eligible(load_decisions(a.decisions)), design["derive_frac"], design["validate_frac"])
    dv = df[df.split == "DERIVE"].reset_index(drop=True); va = df[df.split == "VALIDATE"].reset_index(drop=True)
    ref = ps.Conjunction.from_str(a.region); ref_cov = np.asarray(ref.covers(va), bool)
    rows = []
    def record(name, sub):
        w = winner(sub.reset_index(drop=True), va, a.target, design, a.depth)
        j = jaccard(np.asarray(w.covers(va), bool), ref_cov) if w is not None else 0.0
        rows.append({"variant": name, "n": int(len(sub)), "winner": str(w), "jaccard": j})
        print(f"{name:40s} n={len(sub):6d} J={j:.2f}  {w}", file=sys.stderr)
    for name, fn in CONTEXTS.items():
        if name in ("clock_state", "material", "opp_last", "standing"):
            continue
        strata = pd.Series(np.asarray(fn(dv)), index=dv.index)
        for lvl in sorted(strata.dropna().unique()):
            m = (strata != lvl).values
            if m.sum() < 0.5 * len(dv):
                continue
            record(f"drop {name}={lvl}", dv[m])
    # history windows
    g = dv.groupby("game_id")["createdAt"].first().sort_values()
    half = len(g) // 2
    older = set(g.index[:half]); newer = set(g.index[half:])
    record("older half of DERIVE", dv[dv.game_id.isin(older)])
    record("newer half of DERIVE", dv[dv.game_id.isin(newer)])
    # random half-size subsamples by game
    rng = np.random.default_rng(7)
    games = np.array(list(g.index), dtype=object)
    for k in range(3):
        pick = set(rng.choice(games, size=len(games) // 2, replace=False))
        record(f"random half {k}", dv[dv.game_id.isin(pick)])
    json.dump({"region": a.region, "target": a.target, "depth": a.depth, "rows": rows}, open(a.out, "w"), indent=1)


if __name__ == "__main__":
    main()
