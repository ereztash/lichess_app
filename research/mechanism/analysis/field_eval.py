"""
NODE L/M infrastructure: evaluate the frozen field protocol on new games.

Inputs
  --decisions   parquet of the NEW games' decisions, produced by the unchanged pipeline
                (score_games.py -> features.py) — the same code that scored the record
  --exposure    jsonl of {"game_id": ..., "arm": "instruction" | "sham" | "none", "read_at": ...}
  --baseline    parquet of the pre-exposure record (the frozen 300-game window is selected here)

Outputs (all frozen in MISSION_LEDGER.md §Node L before any new game is read)
  * primary: tactical-error rate inside R*, within game, instruction vs sham (game-fixed-effects
    contrast), with a 5,000-replicate game-level bootstrap;
  * policy signature: share of R* decisions whose move leaves the under-defended piece
    under-defended, per arm;
  * negative endpoint: tactical-error rate and think time OUTSIDE R*, per arm;
  * pre-exposure baseline beside everything.
Nothing here chooses anything; every number is the one the protocol named.
"""
from __future__ import annotations
import argparse, json, sys
import numpy as np
import pandas as pd
import pysubgroup as ps
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, within_game_contrast

REGION = "material_balance>=-2 AND own_overloaded_piece_count>=1"
SEED = 20260905


def arm_rates(d: pd.DataFrame) -> dict:
    ins = d["inR"].values
    return {"n_games": int(d.game_id.nunique()), "n_in": int(ins.sum()), "n_out": int((~ins).sum()),
            "tactical_in": float(d.loc[ins, "cls_tactical"].mean()) if ins.sum() else None,
            "tactical_out": float(d.loc[~ins, "cls_tactical"].mean()) if (~ins).sum() else None,
            "within_game": within_game_contrast(d, ins, "cls_tactical"),
            "policy_signature_left_underdefended": float(d.loc[ins, "left_underdefended"].mean()) if ("left_underdefended" in d and ins.sum()) else None,
            "seconds_median_out": float(d.loc[~ins, "seconds"].median()) if (~ins).sum() else None,
            "err_out": float(d.loc[~ins, "err"].mean()) if (~ins).sum() else None}


def bootstrap_diff(a: pd.DataFrame, b: pd.DataFrame, reps=5000, seed=SEED) -> dict:
    """Bootstrap over games of (within-game contrast in a) - (within-game contrast in b)."""
    rng = np.random.default_rng(seed)
    ga = np.array(list(a.game_id.unique()), dtype=object); gb = np.array(list(b.game_id.unique()), dtype=object)
    diffs = []
    for _ in range(reps):
        sa = a[a.game_id.isin(rng.choice(ga, len(ga), replace=True))]; sb = b[b.game_id.isin(rng.choice(gb, len(gb), replace=True))]
        ca = within_game_contrast(sa, sa["inR"].values, "cls_tactical")["est"]; cb = within_game_contrast(sb, sb["inR"].values, "cls_tactical")["est"]
        if np.isfinite(ca) and np.isfinite(cb):
            diffs.append(ca - cb)
    diffs = np.array(diffs)
    return {"reps": int(len(diffs)), "diff_mean": float(diffs.mean()) if len(diffs) else None,
            "ci95": [float(np.quantile(diffs, 0.025)), float(np.quantile(diffs, 0.975))] if len(diffs) else None}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--exposure", required=True)
    ap.add_argument("--baseline", default=None)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    d = eligible(load_decisions(a.decisions))
    sg = ps.Conjunction.from_str(REGION)
    d["inR"] = np.asarray(sg.covers(d), bool)
    arms = {}
    for line in open(a.exposure):
        if line.strip():
            r = json.loads(line); arms[r["game_id"]] = r.get("arm", "none")
    d["arm"] = d["game_id"].map(arms).fillna("none")
    out = {"region": REGION, "arms": {}}
    for arm in ("instruction", "sham", "none"):
        sub = d[d.arm == arm]
        if len(sub):
            out["arms"][arm] = arm_rates(sub)
    if (d.arm == "instruction").any() and (d.arm == "sham").any():
        out["instruction_minus_sham"] = bootstrap_diff(d[d.arm == "instruction"], d[d.arm == "sham"])
    if a.baseline:
        b = eligible(load_decisions(a.baseline)); b["inR"] = np.asarray(sg.covers(b), bool)
        g = b.groupby("game_id")["createdAt"].first().sort_values()
        recent = set(g.index[-300:])
        out["pre_exposure_recent300"] = arm_rates(b[b.game_id.isin(recent) & (b.speed == "blitz")])
        out["pre_exposure_whole"] = arm_rates(b)
    json.dump(out, open(a.out, "w"), indent=1, default=str)
    print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main()
