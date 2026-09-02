#!/usr/bin/env python3
"""The frozen analysis: Test A, Test B, the falsifiers, the scope map and the ecology.

Protocol authority: docs/system-invariant/RESEARCH_QUESTION_FREEZE.md
Falsifier authority: docs/system-invariant/FALSIFIERS.md

Every threshold this script compares against was written down before the data existed. It reports
the comparison; it does not choose it. Nothing here refits a threshold, and no section reads a
result to decide what the next section should do.
"""
from __future__ import annotations

import argparse
import collections
import io
import json
import math
import sys
from pathlib import Path

import numpy as np
import zstandard

SEED = 20260902
BOOTSTRAPS = 5000
PAIR_EPSILON = 0.01
REASONABLE_BAND = 0.05
ACCURATE_WIN_PROBABILITY_LOSS = 0.02761
DERIVATION_SHARE = 0.60

L_FEATURES = [
    "moving_piece_type", "capture_flag", "captured_piece_value", "promotion_piece_type",
    "from_file", "from_rank", "to_file", "to_rank",
    "chebyshev_distance", "manhattan_distance", "gives_check",
]
CONTROLS = [
    "ply", "non_pawn_material", "legal_moves", "in_check", "rating", "rating_diff",
    "clock_frac", "clock_pressure", "log_time", "opp_prev_think_s",
    "wp1", "edge", "gap12", "n_near", "ambiguity_entropy", "is_mate_line",
]
VALUE_CONTROLS = ["wp1", "edge", "gap12", "n_near", "ambiguity_entropy"]
MATERIAL_FEATURES = ["material_post", "piece_count_post"]
MOBILITY_FEATURES = ["mobility_own_post", "mobility_opp_post"]
NEG_CONTROLS = {
    "NC1_redundant_defense": "nc_own_redundantly_defended_count_post",
    "NC2_defense_dependency": "nc_own_max_defense_dependency_post",
    "NC3_king_ring_defense": "nc_own_king_ring_own_defenses_post",
}


def read_zst(path):
    with open(path, "rb") as fh:
        r = zstandard.ZstdDecompressor().stream_reader(fh)
        for line in io.TextIOWrapper(r, encoding="utf-8"):
            yield json.loads(line)


def matrix(rows, cols):
    X = np.empty((len(rows), len(cols)), dtype=float)
    for j, c in enumerate(cols):
        col = np.array([r.get(c) if r.get(c) is not None else np.nan for r in rows], dtype=float)
        med = np.nanmedian(col) if np.isfinite(col).any() else 0.0
        col[~np.isfinite(col)] = med
        X[:, j] = col
    return X


def standardize(X):
    mu = X.mean(axis=0)
    sd = X.std(axis=0)
    sd[sd < 1e-12] = 1.0
    return (X - mu) / sd


def ridge_fit(X, y, alpha=1.0):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + alpha * np.eye(Xb.shape[1])
    A[-1, -1] -= alpha
    return np.linalg.solve(A, Xb.T @ y)


def ridge_predict(beta, X):
    return np.hstack([X, np.ones((len(X), 1))]) @ beta


def cluster_bootstrap(values_by_cluster, stat, rng, reps=BOOTSTRAPS):
    """Percentile interval, resampling whole clusters. The unit is the cluster, always."""
    keys = np.array(sorted(values_by_cluster))
    if len(keys) == 0:
        return [None, None]
    out = np.empty(reps)
    for i in range(reps):
        pick = rng.choice(keys, size=len(keys), replace=True)
        out[i] = stat([values_by_cluster[k] for k in pick])
    lo, hi = np.nanquantile(out, [0.025, 0.975])
    return [float(lo), float(hi)]


# --------------------------------------------------------------------------------------------
# Test A


def standardized_coefficient(rows, target, controls, cluster_key, rng, demean_by=None,
                             permute_target_within=None):
    """Standardized coefficient of `target` on `quality_loss`, with a cluster interval.

    `demean_by` gives the within-estimator (falsifiers A4 and A5): subtracting the group mean from
    the outcome and from every regressor leaves only variation inside the group, so a between-group
    composition effect cannot produce a coefficient.
    """
    cols = [target] + controls
    rows = [r for r in rows if r.get(target) is not None]
    if permute_target_within is not None:
        groups = collections.defaultdict(list)
        for i, r in enumerate(rows):
            groups[r[permute_target_within]].append(i)
        vals = [r[target] for r in rows]
        shuffled = list(vals)
        for _, idx in groups.items():
            pool = [vals[i] for i in idx]
            rng.shuffle(pool)
            for i, v in zip(idx, pool):
                shuffled[i] = v
        rows = [dict(r, **{target: v}) for r, v in zip(rows, shuffled)]

    X = standardize(matrix(rows, cols))
    y = np.array([r["quality_loss"] for r in rows], dtype=float)
    y = (y - y.mean()) / (y.std() or 1.0)
    groups = np.array([r[cluster_key] for r in rows])

    if demean_by is not None:
        g = np.array([r[demean_by] for r in rows])
        order = {k: i for i, k in enumerate(sorted(set(g.tolist())))}
        gi = np.array([order[v] for v in g])
        counts = np.bincount(gi, minlength=len(order)).astype(float)
        keep = counts[gi] >= 2
        X, y, gi, groups = X[keep], y[keep], gi[keep], groups[keep]
        counts = np.bincount(gi, minlength=len(order)).astype(float)
        for arr in (X,):
            means = np.zeros((len(order), arr.shape[1]))
            np.add.at(means, gi, arr)
            means /= np.maximum(counts, 1)[:, None]
            arr -= means[gi]
        ymeans = np.zeros(len(order))
        np.add.at(ymeans, gi, y)
        ymeans /= np.maximum(counts, 1)
        y = y - ymeans[gi]

    beta = ridge_fit(X, y)[0]

    by_cluster = collections.defaultdict(list)
    for i, gkey in enumerate(groups):
        by_cluster[gkey].append(i)

    def stat(index_lists):
        idx = np.concatenate([np.array(v) for v in index_lists]) if index_lists else np.array([], int)
        if len(idx) < len(CONTROLS) + 5:
            return np.nan
        return ridge_fit(X[idx], y[idx])[0]

    ci = cluster_bootstrap(dict(by_cluster), stat, rng, reps=1000)
    return {"beta_standardized": float(beta), "ci95_cluster": ci, "n": int(len(y)),
            "clusters": int(len(by_cluster))}


# --------------------------------------------------------------------------------------------
# Test B


def pair_index(rows):
    by_pos = collections.defaultdict(list)
    for i, r in enumerate(rows):
        by_pos[(r["game_id"], r["ply"])].append(i)
    pairs = collections.defaultdict(list)
    for pos, idx in by_pos.items():
        for a in range(len(idx)):
            for b in range(a + 1, len(idx)):
                i, j = idx[a], idx[b]
                if abs(rows[i]["regret"] - rows[j]["regret"]) >= PAIR_EPSILON:
                    pairs[pos].append((i, j))
    return pairs


def ranking_accuracy(rows, pred, pairs):
    per_pos = {}
    for pos, plist in pairs.items():
        c = t = 0.0
        for i, j in plist:
            dt = rows[i]["regret"] - rows[j]["regret"]
            dp = pred[i] - pred[j]
            t += 1
            if abs(dp) < 1e-12:
                c += 0.5
            elif (dt > 0) == (dp > 0):
                c += 1.0
        if t:
            per_pos[pos] = (c, t)
    c = sum(v[0] for v in per_pos.values())
    n = sum(v[1] for v in per_pos.values())
    return {"accuracy": c / n if n else None, "pairs": int(n), "positions": len(per_pos)}, per_pos


def fit_and_rank(train_rows, test_rows, cols, test_pairs):
    Xtr = standardize(matrix(train_rows, cols))
    ytr = np.array([r["regret"] for r in train_rows], dtype=float)
    beta = ridge_fit(Xtr, ytr)
    raw = matrix(train_rows, cols)
    mu, sd = raw.mean(axis=0), raw.std(axis=0)
    sd[sd < 1e-12] = 1.0
    Xte = (matrix(test_rows, cols) - mu) / sd
    pred = ridge_predict(beta, Xte)
    return ranking_accuracy(test_rows, pred, test_pairs)


def gain_ci(per_pos_a, per_pos_b, rng, reps=BOOTSTRAPS):
    keys = np.array(sorted(set(per_pos_a) & set(per_pos_b)), dtype=object)
    if len(keys) == 0:
        return [None, None]
    out = np.empty(reps)
    for i in range(reps):
        pick = rng.choice(len(keys), size=len(keys), replace=True)
        ca = na = cb = nb = 0.0
        for k in pick:
            key = keys[k]
            c, n = per_pos_a[key]; ca += c; na += n
            c, n = per_pos_b[key]; cb += c; nb += n
        out[i] = ca / na - cb / nb
    lo, hi = np.quantile(out, [0.025, 0.975])
    return [float(lo), float(hi)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--table-a", required=True)
    ap.add_argument("--table-b", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    rng = np.random.default_rng(SEED)
    A = list(read_zst(args.table_a))
    B = list(read_zst(args.table_b))

    players = sorted({r["player"] for r in A})
    rng_split = np.random.default_rng(SEED)
    perm = rng_split.permutation(len(players))
    n_der = int(round(DERIVATION_SHARE * len(players)))
    derivation = {players[i] for i in perm[:n_der]}
    result = {
        "protocol": "docs/system-invariant/RESEARCH_QUESTION_FREEZE.md",
        "seed": SEED,
        "engine_searches_run": 0,
        "n_decisions": len(A),
        "n_candidate_rows": len(B),
        "n_players": len(players),
        "derivation_players": len(derivation),
        "judgement_players": len(players) - len(derivation),
    }

    # ---- noise floor: what the outcome reads when the human played the engine's own best move
    best_rows = [r for r in A if r["played_is_best"]]
    ql = np.array([r["quality_loss"] for r in best_rows])
    result["outcome_noise_floor"] = {
        "what": "quality_loss on decisions where the human played the engine's own best move; it should be 0 and is not, because the parent and child searches are different searches",
        "n": len(best_rows),
        "mean": float(ql.mean()) if len(ql) else None,
        "median": float(np.median(ql)) if len(ql) else None,
        "share_above_zero": float((ql > 1e-9).mean()) if len(ql) else None,
        "share_above_accurate_threshold": float((ql > ACCURATE_WIN_PROBABILITY_LOSS).mean()) if len(ql) else None,
    }

    # ---- Test A
    testa = {}
    for target in ("exposure_delta", "exposure_post"):
        testa[target] = standardized_coefficient(A, target, CONTROLS, "player", rng)
    no_value = [c for c in CONTROLS if c not in VALUE_CONTROLS]
    testa["exposure_delta_without_value_controls"] = standardized_coefficient(
        A, "exposure_delta", no_value, "player", rng)
    result["test_a"] = testa

    # ---- Test A falsifiers
    fals = {}
    fals["F_A1_rating_bands"] = {
        band: standardized_coefficient([r for r in A if r["band"] == band], "exposure_delta",
                                       CONTROLS, "player", rng)
        for band in sorted({r["band"] for r in A})
    }
    fals["F_A2_phase"] = {
        ph: standardized_coefficient([r for r in A if r["phase"] == ph], "exposure_delta",
                                     CONTROLS, "player", rng)
        for ph in sorted({r["phase"] for r in A})
    }
    cp = np.array([r["clock_pressure"] for r in A])
    t1, t2 = np.quantile(cp, [1 / 3, 2 / 3])
    def clock_tertile(r):
        return "low" if r["clock_pressure"] <= t1 else ("mid" if r["clock_pressure"] <= t2 else "high")
    fals["F_A3_clock_tertile"] = {
        t: standardized_coefficient([r for r in A if clock_tertile(r) == t], "exposure_delta",
                                    CONTROLS, "player", rng)
        for t in ("low", "mid", "high")
    }
    fals["F_A3_cuts"] = {"tertile_1": float(t1), "tertile_2": float(t2)}
    fals["F_A4_within_player"] = standardized_coefficient(A, "exposure_delta", CONTROLS, "player",
                                                          rng, demean_by="player")
    fals["F_A5_within_game"] = standardized_coefficient(A, "exposure_delta", CONTROLS, "player",
                                                        rng, demean_by="game_id")
    fals["F_A9_permuted_within_player"] = standardized_coefficient(
        A, "exposure_delta", CONTROLS, "player", rng, permute_target_within="player")
    result["test_a_falsifiers"] = fals

    # ---- Test B, judged on held-out players
    train = [r for r in B if r["player"] in derivation]
    test = [r for r in B if r["player"] not in derivation]
    test_pairs = pair_index(test)
    ladder = {
        "L": L_FEATURES,
        "L_Epost": L_FEATURES + ["exposure_post"],
        "L_Edelta": L_FEATURES + ["exposure_delta"],
        "L_Material": L_FEATURES + MATERIAL_FEATURES,
        "L_Mobility": L_FEATURES + MOBILITY_FEATURES,
    }
    for name, col in NEG_CONTROLS.items():
        ladder[f"L_{name}"] = L_FEATURES + [col]

    stats, per_pos = {}, {}
    for name, cols in ladder.items():
        s, pp = fit_and_rank(train, test, cols, test_pairs)
        stats[name] = s
        per_pos[name] = pp
    comparisons = {}
    for a, b in (("L_Epost", "L"), ("L_Edelta", "L"), ("L_Epost", "L_Material"),
                 ("L_Epost", "L_Mobility"), ("L_Epost", "L_Edelta")):
        comparisons[f"{a}_minus_{b}"] = {
            "gain": stats[a]["accuracy"] - stats[b]["accuracy"],
            "ci95_cluster_position": gain_ci(per_pos[a], per_pos[b], rng),
        }
    for name in NEG_CONTROLS:
        comparisons[f"L_{name}_minus_L"] = {
            "gain": stats[f"L_{name}"]["accuracy"] - stats["L"]["accuracy"],
            "ci95_cluster_position": gain_ci(per_pos[f"L_{name}"], per_pos["L"], rng),
        }
    result["test_b"] = {"models": stats, "comparisons": comparisons,
                        "held_out_on": "players not in the derivation 60%"}

    # ---- ecology: opportunity, headroom, consequence
    by_pos = collections.defaultdict(list)
    for r in B:
        by_pos[(r["game_id"], r["ply"])].append(r)
    a_by_pos = {(r["game_id"], r["ply"]): r for r in A}

    opps = 0
    reasonable_ge2 = 0
    headroom_num = 0
    headroom_den = 0
    unclassifiable = 0
    costs = []
    opp_rows = []
    for pos, cands in by_pos.items():
        best = max(c["cand_wp"] for c in cands)
        reasonable = [c for c in cands if best - c["cand_wp"] <= REASONABLE_BAND]
        if len(reasonable) >= 2:
            reasonable_ge2 += 1
        exps = {c["exposure_post"] for c in reasonable}
        if len(reasonable) >= 2 and len(exps) >= 2:
            opps += 1
            arow = a_by_pos.get(pos)
            opp_rows.append((pos, reasonable, arow))
            played = [c for c in reasonable if c["is_played"]]
            if not played:
                unclassifiable += 1
            else:
                headroom_den += 1
                lo = min(c["exposure_post"] for c in reasonable)
                if played[0]["exposure_post"] > lo:
                    headroom_num += 1
                    if arow is not None:
                        costs.append(arow["quality_loss"])
    costs_arr = np.array(costs) if costs else np.array([])
    result["ecology"] = {
        "definition": "at least 2 candidates within 0.05 wp of best AND differing in exposure_post by at least 1",
        "positions": len(by_pos),
        "positions_with_2plus_reasonable": reasonable_ge2,
        "opportunities": opps,
        "opportunity_rate_of_decisions": opps / len(by_pos) if by_pos else None,
        "headroom_denominator_played_move_in_reasonable_set": headroom_den,
        "headroom_numerator_chose_higher_exposure": headroom_num,
        "headroom_rate": headroom_num / headroom_den if headroom_den else None,
        "opportunities_where_played_move_not_in_reasonable_set": unclassifiable,
        "consequence_n": int(len(costs_arr)),
        "consequence_mean_quality_loss": float(costs_arr.mean()) if len(costs_arr) else None,
        "consequence_median_quality_loss": float(np.median(costs_arr)) if len(costs_arr) else None,
        "consequence_share_at_or_above_accurate_threshold":
            float((costs_arr >= ACCURATE_WIN_PROBABILITY_LOSS).mean()) if len(costs_arr) else None,
    }

    print("===SI_RESULT_BEGIN===")
    print(json.dumps(result, indent=2, sort_keys=True))
    print("===SI_RESULT_END===")
    Path(args.out).write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
