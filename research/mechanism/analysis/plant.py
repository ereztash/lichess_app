"""
NODE B harness: can the governed search express and recover a cross-context personal pattern?

Worlds are built ON THE REAL FEATURE TABLE (the player's own decisions), with the target replaced:
  1. shuffle `err` within game  -> an exact null with the real dependence structure of the features;
  2. optionally plant a truth: inside a planted region, re-draw `err` with probability base + delta.

Truth types (mission §NODE B): simple feature, interaction, cross-context, unrepresentable,
no truth, broad-proxy-contains-narrow-truth, multiple equivalent descriptions.

Outputs per world x depth: validated rate (search+freeze+judge on VALIDATE), on-target rate
(Jaccard >= 0.60 with the planted region on VALIDATE), median Jaccard, false-claim rate on nulls.
"""
from __future__ import annotations
import argparse, json, os, sys, time
import numpy as np
import pandas as pd
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, chronological_split, shuffle_within_game, jaccard
from search import build_selectors, search, judge_region, residualize, add_within_game_targets
import vocab

ON_TARGET_J = 0.60


def plant(df: pd.DataFrame, mask: np.ndarray, delta: float, rng: np.random.Generator, target="err") -> pd.DataFrame:
    """Plant a truth: inside `mask`, redraw the outcome with probability base + delta, keep the loss
    consistent with the new label, then recompute history features (v1.5)."""
    from common import recompute_history
    df = df.copy()
    base = df[target].mean()
    p = np.clip(base + delta, 0, 1)
    draw = (rng.random(len(df)) < p).astype(int)
    m = np.asarray(mask, bool)
    df.loc[m, target] = draw[m]
    if "y_wp_loss" in df.columns:
        # a redrawn error carries a typical error loss; a redrawn non-error a typical accurate loss
        err_losses = df.loc[df[target] == 1, "y_wp_loss"].values; ok_losses = df.loc[df[target] == 0, "y_wp_loss"].values
        new = np.where(draw[m] == 1, rng.choice(err_losses, m.sum()), rng.choice(ok_losses, m.sum()))
        df.loc[m, "y_wp_loss"] = new
        df["y_accurate"] = 1 - df[target]
    return recompute_history(df)


def worlds(df: pd.DataFrame):
    """Return {name: (mask or None, delta)}. Masks use PRE-MOVE columns only."""
    W = {}
    W["W5-null"] = (None, 0.0)
    W["W1-simple"] = ((df["opp_last_capture"] == 1).values, 0.20)
    W["W2-interaction"] = (((df["opp_last_capture"] == 1) & (df["clock_own_ms"] < 60000)).values, 0.25)
    W["W3-cross-context"] = (((df["own_hanging_piece_count"] >= 1) & (df["opp_last_check"] == 0)).values, 0.20)
    # unrepresentable: the best move starts from a rook file (not in any vocabulary)
    from_file = df["y_played_uci"].str[0]  # NOTE: used only to define a planted truth, never as a feature
    W["W4-unrepresentable"] = (from_file.isin(["a", "h"]).values, 0.25)
    W["W6-proxy-contains-truth"] = (((df["opp_last_capture"] == 1) & (df["recapture_available"] == 1)).values, 0.30)
    W["W7-equivalent"] = ((df["own_hanging_piece_count"] >= 1).values, 0.20)
    W["W1w-simple-weak"] = ((df["opp_last_capture"] == 1).values, 0.08)
    W["W3w-cross-context-weak"] = (((df["own_hanging_piece_count"] >= 1) & (df["opp_last_check"] == 0)).values, 0.08)
    return W


def run_world(dv: pd.DataFrame, va: pd.DataFrame, mask_d, mask_v, delta, depth, design, rng, target="err"):
    dv = shuffle_within_game(dv, target, rng); va = shuffle_within_game(va, target, rng)
    if mask_d is not None:
        dv = plant(dv, mask_d, delta, rng, target); va = plant(va, mask_v, delta, rng, target)
    sels = build_selectors(dv, design["vocab"])
    if design["residual"]:
        _, (dv, va) = residualize(dv, [va], target, design["baseline_cols"], design["baseline_cat"])
        stgt = f"{target}_resid_wg"
    else:
        dv, va = add_within_game_targets([dv, va], target)
        stgt = f"{target}_wg"
    numeric = True  # v1.3: both search targets are within-game demeaned, hence numeric
    cands = search(dv, stgt, sels, depth, design["n_freeze"], numeric, design["min_size"], design["max_size"])
    results = []
    for c in cands:
        j = judge_region(va, c["sg"], target, design["k"], design["min_n_validate"])
        inside_v = np.asarray(c["sg"].covers(va), bool)
        j["jaccard"] = jaccard(inside_v, mask_v) if mask_v is not None else None
        j["quality"] = c["quality"]; j["n_derive"] = c["n_derive"]; j["depth"] = c["depth"]
        results.append(j)
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions.parquet")
    ap.add_argument("--reps", type=int, default=20)
    ap.add_argument("--nulls", type=int, default=100)
    ap.add_argument("--depths", default="1,2,3")
    ap.add_argument("--residual", type=int, default=1)
    ap.add_argument("--vocab", default="OBS")
    ap.add_argument("--out", default="results/nodeB.json")
    a = ap.parse_args()
    design = vocab.DESIGN.copy()
    design["vocab"] = vocab.VOCAB[a.vocab]
    design["residual"] = bool(a.residual)
    df = load_decisions(a.decisions)
    df = eligible(df)
    df = chronological_split(df, design["derive_frac"], design["validate_frac"])
    dv = df[df.split == "DERIVE"].reset_index(drop=True)
    va = df[df.split == "VALIDATE"].reset_index(drop=True)
    print(f"DERIVE {len(dv)} decisions / {dv.game_id.nunique()} games; VALIDATE {len(va)} / {va.game_id.nunique()} games", file=sys.stderr)
    Wd = worlds(dv); Wv = worlds(va)
    report = {"design": {k: v for k, v in design.items() if k != "vocab"}, "vocab": a.vocab, "residual": design["residual"], "sweeps": []}
    done = {}
    if os.path.exists(a.out):  # resume: keep finished (depth, world) cells
        try:
            old = json.load(open(a.out))
            for s in old.get("sweeps", []):
                for w in s["worlds"]:
                    done[(s["depth"], w["world"])] = w
        except Exception:
            done = {}
    for depth in [int(d) for d in a.depths.split(",")]:
        sweep = {"depth": depth, "worlds": []}
        report["sweeps"].append(sweep)
        for name, (mask_d, delta) in Wd.items():
            mask_v = Wv[name][0]
            if (depth, name) in done:
                sweep["worlds"].append(done[(depth, name)]); continue
            reps = a.nulls if mask_d is None else a.reps
            t0 = time.time(); rows = []
            for r in range(reps):
                rng = np.random.default_rng(design["seed"] + 1000 * depth + r)
                res = run_world(dv, va, mask_d, mask_v, delta, depth, design, rng)
                any_pass = any(x["pass"] for x in res)
                on_target = any(x["pass"] and x["jaccard"] is not None and x["jaccard"] >= ON_TARGET_J for x in res)
                best_j = max([x["jaccard"] for x in res if x["jaccard"] is not None], default=None)
                rows.append({"validated": any_pass, "on_target": on_target, "best_jaccard": best_j,
                             "regions": [(x["region"], round(x["z"], 2), x["pass"]) for x in res]})
            v = sum(r["validated"] for r in rows) / reps
            ot = sum(r["on_target"] for r in rows) / reps
            js = [r["best_jaccard"] for r in rows if r["best_jaccard"] is not None]
            top = {}
            for r in rows:
                for reg, z, p in r["regions"]:
                    if p: top[reg] = top.get(reg, 0) + 1
            sweep["worlds"].append({"world": name, "delta": delta, "reps": reps, "validated_rate": v, "on_target_rate": ot,
                                    "median_best_jaccard": float(np.median(js)) if js else None,
                                    "top_regions": sorted(top.items(), key=lambda kv: -kv[1])[:4],
                                    "seconds": round(time.time() - t0, 1)})
            print(f"depth {depth} {name:28s} validated {v:.3f} on-target {ot:.3f} medJ {np.median(js) if js else float('nan'):.3f} ({time.time()-t0:.0f}s)", file=sys.stderr)
            json.dump(report, open(a.out, "w"), indent=1, default=str)  # checkpoint after every world
    json.dump(report, open(a.out, "w"), indent=1, default=str)


if __name__ == "__main__":
    main()
