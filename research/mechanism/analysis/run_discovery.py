"""
The real chain on the real target (Node C depth rule -> Node D stability -> freeze -> Node H judge).

Steps
  1. eligibility, chronological split (frozen design v1);
  2. NODE C: depth chosen by 5-fold game-grouped CV inside DERIVE (never on VALIDATE);
  3. search on all of DERIVE at the chosen depth, freeze top-3 (per vocabulary);
  4. NODE D: game-level bootstrap of DERIVE (B draws): re-run the search, record the Jaccard of the
     bootstrap winner with each frozen candidate (functional identity, not string identity);
  5. judge each frozen candidate on VALIDATE (game-clustered z >= k, n_in >= 100, residual > 0);
  6. write everything to results/discovery_<vocab>_<target>.json. TEST is NOT touched here.
"""
from __future__ import annotations
import argparse, json, sys, time
import numpy as np
import pandas as pd
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, chronological_split, resample_by_game, region_contrast, jaccard, clustered_rate_se, within_game_contrast
from search import build_selectors, search, judge_region, residualize, add_within_game_targets
import vocab


def prepare(dv, others, target, design):
    """Fit the baseline on `dv` (if residual) and attach within-game search targets to every frame."""
    if design["residual"]:
        _, frames = residualize(dv, others, target, design["baseline_cols"], design["baseline_cat"])
        return frames, f"{target}_resid_wg", f"{target}_resid"
    frames = add_within_game_targets([dv] + others, target)
    return frames, f"{target}_wg", target


def cv_depth(dv: pd.DataFrame, target: str, design: dict, depths, folds=5) -> dict:
    """Held-out clustered z of the top candidate's residual contrast, per depth, inside DERIVE."""
    games = np.array(list(dv["game_id"].unique()), dtype=object)
    rng = np.random.default_rng(design["seed"])
    rng.shuffle(games)
    fold_of = {g: i % folds for i, g in enumerate(games)}
    dv = dv.copy(); dv["fold"] = dv["game_id"].map(fold_of)
    out = {}
    for depth in depths:
        zs = []; regions = []
        for f in range(folds):
            tr = dv[dv.fold != f].reset_index(drop=True); ho = dv[dv.fold == f].reset_index(drop=True)
            sels = build_selectors(tr, design["vocab"])
            (tr, ho), stgt, ctgt = prepare(tr, [ho], target, design)
            cands = search(tr, stgt, sels, depth, 1, True, design["min_size"] * (folds - 1) // folds, design["max_size"], beam=design.get("beam", 30))
            if not cands:
                zs.append(0.0); regions.append(None); continue
            sg = cands[0]["sg"]
            inside = np.asarray(sg.covers(ho), bool)
            # held-out within-game contrast of the (residual) target
            z = within_game_contrast(ho, inside, ctgt)["z"]
            zs.append(float(z) if np.isfinite(z) else 0.0); regions.append(str(sg))
        out[depth] = {"mean_z": float(np.mean(zs)), "zs": zs, "regions": regions}
    return out


def choose_depth(cv: dict) -> int:
    best = None
    for d in sorted(cv):
        if best is None or cv[d]["mean_z"] > cv[best]["mean_z"] + 1e-9:
            best = d
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions.parquet")
    ap.add_argument("--vocab", default="OBS")
    ap.add_argument("--target", default=None)
    ap.add_argument("--residual", type=int, default=1)
    ap.add_argument("--boot", type=int, default=50)
    ap.add_argument("--depths", default="1,2,3")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    design = vocab.DESIGN.copy(); design["vocab"] = vocab.VOCAB[a.vocab]; design["residual"] = bool(a.residual)
    target = a.target or design["target"]
    depths = [int(d) for d in a.depths.split(",")]
    df = chronological_split(eligible(load_decisions(a.decisions)), design["derive_frac"], design["validate_frac"])
    dv = df[df.split == "DERIVE"].reset_index(drop=True); va = df[df.split == "VALIDATE"].reset_index(drop=True)
    print(f"DERIVE {len(dv)}/{dv.game_id.nunique()} games, VALIDATE {len(va)}/{va.game_id.nunique()} games, base err {dv[target].mean():.3f}", file=sys.stderr)
    t0 = time.time()
    cv = cv_depth(dv, target, design, depths)
    depth = choose_depth(cv)
    cv_txt = ", ".join("%d: %.2f" % (d, cv[d]["mean_z"]) for d in cv)
    print(f"NODE C depth CV: {{ {cv_txt} }} -> depth {depth} ({time.time()-t0:.0f}s)", file=sys.stderr)

    sels = build_selectors(dv, design["vocab"])
    (dvr, var), stgt, ctgt = prepare(dv, [va], target, design)
    numeric = True
    cands = search(dvr, stgt, sels, depth, design["n_freeze"], numeric, design["min_size"], design["max_size"], beam=design.get("beam", 30))
    # v1.1/v1.5: a depth-3 candidate must collapse to a 2-term sub-conjunction with Jaccard >= 0.60 on DERIVE
    import itertools
    collapsed = []
    for c in cands:
        if len(c["sg"].selectors) <= 2:
            collapsed.append(c); continue
        full = np.asarray(c["sg"].covers(dvr), bool); best = None
        for pair in itertools.combinations(c["sg"].selectors, 2):
            sub = __import__("pysubgroup").Conjunction(list(pair))
            jv = jaccard(np.asarray(sub.covers(dvr), bool), full)
            if jv >= 0.60 and (best is None or jv > best[0]):
                best = (jv, sub)
        if best is None:
            print(f"  dropped (no 2-term collapse with J>=0.60): {c['region']}", file=sys.stderr); continue
        c = dict(c); c["region_depth3"] = c["region"]; c["sg"] = best[1]; c["region"] = str(best[1]); c["collapse_jaccard"] = best[0]
        c["depth"] = 2; c["n_derive"] = int(np.asarray(best[1].covers(dvr), bool).sum())
        collapsed.append(c)
    cands = collapsed
    frozen = []
    for c in cands:
        inside_d = np.asarray(c["sg"].covers(dvr), bool)
        raw_d = region_contrast(dvr, inside_d, target)
        wg_d = within_game_contrast(dvr, inside_d, target)
        frozen.append({"region": c["region"], "region_depth3": c.get("region_depth3"), "collapse_jaccard": c.get("collapse_jaccard"),
                       "quality": c["quality"], "depth": c["depth"], "n_derive": c["n_derive"],
                       "derive_err_in": raw_d["p_in"], "derive_err_out": raw_d["p_out"], "derive_wg_est": wg_d["est"], "derive_wg_z": wg_d["z"],
                       "derive_resid_wg_in": float(dvr.loc[inside_d, stgt].mean())})
    print("FROZEN on DERIVE:", file=sys.stderr)
    for f in frozen:
        print(f"  {f['region']}  n={f['n_derive']} err_in={f['derive_err_in']:.3f} err_out={f['derive_err_out']:.3f} wg_est={f['derive_wg_est']:+.4f} wg_z={f['derive_wg_z']:.2f}", file=sys.stderr)

    # NODE D: stability under game-level resampling of DERIVE
    t0 = time.time(); stab = []
    for b in range(a.boot):
        rng = np.random.default_rng(design["seed"] + 100 + b)
        bs = resample_by_game(dv, rng).reset_index(drop=True)
        # resampled games must stay distinct clusters: suffix duplicated game ids
        bs["game_id"] = bs["game_id"].astype(str) + "#" + bs.groupby(["game_id", "ply"]).cumcount().astype(str)
        bsels = build_selectors(bs, design["vocab"])
        (bsr,), _, _ = prepare(bs, [], target, design)
        bc = search(bsr, stgt, bsels, depth, 1, numeric, design["min_size"], design["max_size"], beam=design.get("beam", 30))
        if not bc:
            stab.append({"winner": None, "j": [0.0] * len(cands)}); continue
        w = bc[0]["sg"]
        # functional identity measured on VALIDATE coverage (a fixed reference set)
        cov_w = np.asarray(w.covers(var), bool)
        js = [jaccard(cov_w, np.asarray(c["sg"].covers(var), bool)) for c in cands]
        stab.append({"winner": str(w), "j": js})
    for i, c in enumerate(cands):
        js = [s["j"][i] for s in stab]
        frozen[i]["stability_share_j60"] = float(np.mean([j >= 0.60 for j in js])); frozen[i]["stability_median_j"] = float(np.median(js))
    winners = {}
    for s in stab:
        winners[s["winner"]] = winners.get(s["winner"], 0) + 1
    print(f"NODE D bootstrap winners ({a.boot} draws, {time.time()-t0:.0f}s): {sorted(winners.items(), key=lambda kv: -kv[1])[:5]}", file=sys.stderr)

    # judge on VALIDATE
    for i, c in enumerate(cands):
        j = judge_region(var, c["sg"], target, design["k"], design["min_n_validate"])
        inside_v = np.asarray(c["sg"].covers(var), bool)
        if design["residual"]:
            # v1.4: the deciding statistic is the within-game contrast of the baseline RESIDUAL
            # (excess error beyond generic difficulty, time, context and ease, inside games)
            rw = within_game_contrast(var, inside_v, ctgt)
            j["resid_wg_est"] = rw["est"]; j["resid_wg_z"] = rw["z"]
            j["pass"] = bool(j["n_in"] >= design["min_n_validate"] and np.isfinite(rw["z"]) and rw["z"] >= design["k"]
                             and np.isfinite(j["wg_est"]) and j["wg_est"] > 0)
        sec = within_game_contrast(var, inside_v, design["secondary_target"])
        j["secondary_wg"] = {k: sec[k] for k in ("est", "z", "n_games")}
        wl = within_game_contrast(var, inside_v, "y_wp_loss")
        j["wp_loss_wg"] = {k: wl[k] for k in ("est", "z")}
        frozen[i]["validate"] = j
        print(f"VALIDATE {c['region']}: n_in={j['n_in']} err_in={j['p_in']:.3f} err_out={j['p_out']:.3f} between_z={j['z']:.2f} wg_est={j['wg_est']:+.4f} wg_z={j['wg_z']:.2f} resid_wg_z={j.get('resid_wg_z')} pass={j['pass']}", file=sys.stderr)
    out = a.out or f"results/discovery_{a.vocab}_{target}_{'resid' if design['residual'] else 'raw'}.json"
    json.dump({"design": {k: v for k, v in design.items() if k != "vocab"}, "vocab": a.vocab, "target": target,
               "cv_depth": {str(k): v for k, v in cv.items()}, "depth": depth, "frozen": frozen,
               "bootstrap_winners": winners}, open(out, "w"), indent=1, default=str)
    print(f"wrote {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
