#!/usr/bin/env python3
"""The frozen analysis: Test A, Test B, the falsifiers, functional invariance, the D04 scope map
and the ecology.

Protocol authority:      docs/system-invariant/RESEARCH_QUESTION_FREEZE.md
Falsifier authority:     docs/system-invariant/FALSIFIERS.md
Interpretation contract: docs/system-invariant/AMENDMENT_01.md

Every threshold compared against here was written down before the data existed. This script reports
the comparison; it does not choose it. No section reads a result to decide what a later section does.

WHY THE RESAMPLING IS VECTORISED. A position-cluster bootstrap written as a Python loop over 18,000
positions times 5,000 replicates is 90 million iterations per comparison, and there are dozens of
comparisons. Every bootstrap below reduces first to per-cluster (correct, total) pairs and then
resamples cluster INDICES with numpy. Same estimator, same resampling unit, three orders of
magnitude faster.
"""
from __future__ import annotations

import argparse
import collections
import io
import json
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
MIN_REGION_PAIRS = 200

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
    mu, sd = X.mean(axis=0), X.std(axis=0)
    sd[sd < 1e-12] = 1.0
    return (X - mu) / sd


def ridge_fit(X, y, alpha=1.0):
    Xb = np.hstack([X, np.ones((len(X), 1))])
    A = Xb.T @ Xb + alpha * np.eye(Xb.shape[1])
    A[-1, -1] -= alpha
    return np.linalg.solve(A, Xb.T @ y)


def ridge_predict(beta, X):
    return np.hstack([X, np.ones((len(X), 1))]) @ beta


def ratio_ci(c, n, rng, reps=BOOTSTRAPS):
    """Cluster bootstrap of sum(c)/sum(n); each element of c and n is one cluster."""
    K = len(n)
    if K == 0:
        return [None, None]
    out = np.empty(reps)
    for r in range(reps):
        idx = rng.integers(0, K, K)
        tot = n[idx].sum()
        out[r] = c[idx].sum() / tot if tot else np.nan
    lo, hi = np.nanquantile(out, [0.025, 0.975])
    return [float(lo), float(hi)]


def diff_ci(ca, na, cb, nb, rng, reps=BOOTSTRAPS):
    """Cluster bootstrap of a difference of two ratios over the SAME clusters."""
    K = len(na)
    if K == 0:
        return [None, None]
    out = np.empty(reps)
    for r in range(reps):
        idx = rng.integers(0, K, K)
        ta, tb = na[idx].sum(), nb[idx].sum()
        out[r] = (ca[idx].sum() / ta if ta else np.nan) - (cb[idx].sum() / tb if tb else np.nan)
    lo, hi = np.nanquantile(out, [0.025, 0.975])
    return [float(lo), float(hi)]


# --------------------------------------------------------------------------------------------
# Test A


def standardized_coefficient(rows, target, controls, rng, demean_by=None,
                             permute_target_within=None, reps=1000):
    """Standardized coefficient of `target` on `quality_loss`, with a player-cluster interval.

    `demean_by` is the within-estimator (F-A4, F-A5): subtracting the group mean from the outcome
    and from every regressor leaves only variation inside the group, so a between-group composition
    effect cannot produce a coefficient.
    """
    rows = [r for r in rows if r.get(target) is not None]
    if len(rows) < len(controls) + 30:
        return {"beta_standardized": None, "ci95_cluster": [None, None], "n": len(rows),
                "clusters": 0, "note": "too few rows"}
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

    X = standardize(matrix(rows, [target] + controls))
    y = np.array([r["quality_loss"] for r in rows], dtype=float)
    y = (y - y.mean()) / (y.std() or 1.0)
    players = np.array([r["player"] for r in rows])

    if demean_by is not None:
        g = np.array([r[demean_by] for r in rows])
        order = {k: i for i, k in enumerate(sorted(set(g.tolist())))}
        gi = np.array([order[v] for v in g])
        counts = np.bincount(gi, minlength=len(order)).astype(float)
        keep = counts[gi] >= 2
        X, y, gi, players = X[keep], y[keep], gi[keep], players[keep]
        if len(y) < len(controls) + 30:
            return {"beta_standardized": None, "ci95_cluster": [None, None], "n": int(len(y)),
                    "clusters": 0, "note": "too few rows after demeaning"}
        order = {k: i for i, k in enumerate(sorted(set(gi.tolist())))}
        gi = np.array([order[v] for v in gi])
        counts = np.bincount(gi, minlength=len(order)).astype(float)
        means = np.zeros((len(order), X.shape[1]))
        np.add.at(means, gi, X)
        X = X - (means / counts[:, None])[gi]
        ym = np.zeros(len(order))
        np.add.at(ym, gi, y)
        y = y - (ym / counts)[gi]

    beta = float(ridge_fit(X, y)[0])
    uniq, inv = np.unique(players, return_inverse=True)
    idx_by_cluster = [np.where(inv == k)[0] for k in range(len(uniq))]
    K = len(uniq)
    out = np.empty(reps)
    for r in range(reps):
        pick = rng.integers(0, K, K)
        idx = np.concatenate([idx_by_cluster[k] for k in pick])
        try:
            out[r] = ridge_fit(X[idx], y[idx])[0]
        except np.linalg.LinAlgError:
            out[r] = np.nan
    lo, hi = np.nanquantile(out, [0.025, 0.975])
    return {"beta_standardized": beta, "ci95_cluster": [float(lo), float(hi)],
            "n": int(len(y)), "clusters": int(K)}


# --------------------------------------------------------------------------------------------
# Within-position pair machinery, built once and reused by every later section


class PairTable:
    def __init__(self, rows):
        by_pos = collections.defaultdict(list)
        for i, r in enumerate(rows):
            by_pos[(r["game_id"], r["ply"])].append(i)
        self.rows = rows
        self.pos_list = sorted(by_pos)
        pos_index = {p: k for k, p in enumerate(self.pos_list)}
        I, J, P = [], [], []
        for p in self.pos_list:
            idx = by_pos[p]
            for a in range(len(idx)):
                for b in range(a + 1, len(idx)):
                    i, j = idx[a], idx[b]
                    if abs(rows[i]["regret"] - rows[j]["regret"]) < PAIR_EPSILON:
                        continue
                    I.append(i)
                    J.append(j)
                    P.append(pos_index[p])
        self.i = np.array(I, dtype=int)
        self.j = np.array(J, dtype=int)
        self.pos = np.array(P, dtype=int)
        self.npos = len(self.pos_list)
        ei = np.array([rows[k]["exposure_post"] for k in I], dtype=float)
        ej = np.array([rows[k]["exposure_post"] for k in J], dtype=float)
        ri = np.array([rows[k]["regret"] for k in I], dtype=float)
        rj = np.array([rows[k]["regret"] for k in J], dtype=float)
        self.dtrue = ri - rj
        de = ei - ej
        self.exposure_differs = de != 0
        self.exposure_agree = ((de > 0) == (self.dtrue > 0)).astype(float)
        pi = np.array([rows[k]["moving_piece_type"] for k in I])
        pj = np.array([rows[k]["moving_piece_type"] for k in J])
        ci = np.array([rows[k]["capture_flag"] for k in I])
        cj = np.array([rows[k]["capture_flag"] for k in J])
        self.alike = (pi == pj) & (ci == cj)

    def cluster_counts(self, correct, mask=None):
        m = np.ones(len(self.pos), dtype=bool) if mask is None else mask
        c = np.bincount(self.pos[m], weights=correct[m], minlength=self.npos)
        n = np.bincount(self.pos[m], minlength=self.npos).astype(float)
        keep = n > 0
        return c[keep], n[keep]

    def score(self, pred):
        dp = pred[self.i] - pred[self.j]
        return np.where(np.abs(dp) < 1e-12, 0.5, ((self.dtrue > 0) == (dp > 0)).astype(float))


def fit_predict(train_rows, test_rows, cols):
    raw = matrix(train_rows, cols)
    mu, sd = raw.mean(axis=0), raw.std(axis=0)
    sd[sd < 1e-12] = 1.0
    beta = ridge_fit((raw - mu) / sd, np.array([r["regret"] for r in train_rows], dtype=float))
    return ridge_predict(beta, (matrix(test_rows, cols) - mu) / sd)


def summarize(c, n, rng, reps=BOOTSTRAPS):
    tot = n.sum()
    return {"accuracy": float(c.sum() / tot) if tot else None, "pairs": int(tot),
            "positions": int(len(n)), "ci95_cluster_position": ratio_ci(c, n, rng, reps)}


def tertile_cuts(rows, key):
    v = np.array([r[key] for r in rows], dtype=float)
    return [float(x) for x in np.quantile(v, [1 / 3, 2 / 3])]


def build_selectors(derivation_rows):
    """The frozen vocabulary of freeze section 8. Cuts come from the derivation subset ONLY."""
    cuts = {k: tertile_cuts(derivation_rows, k)
            for k in ("clock_pressure", "non_pawn_material", "legal_moves", "n_near")}

    def tertile(key):
        lo, hi = cuts[key]
        return lambda r: "low" if r[key] <= lo else ("mid" if r[key] <= hi else "high")

    return {
        "band": lambda r: r["band"],
        "phase": lambda r: r["phase"],
        "standing": lambda r: r["standing"],
        "in_check": lambda r: "yes" if r["in_check"] else "no",
        "clock_pressure": tertile("clock_pressure"),
        "non_pawn_material": tertile("non_pawn_material"),
        "legal_moves": tertile("legal_moves"),
        "n_near": tertile("n_near"),
    }, cuts


def label_region(der_acc, held_acc, held_pairs, ci):
    if held_pairs < MIN_REGION_PAIRS or ci[0] is None or held_acc is None:
        return "INSUFFICIENT"
    if ci[0] > 0.5:
        if der_acc is None or der_acc <= 0.5:
            return "WEAK"
        return "SUPPORTED" if (held_acc - 0.5) >= 0.5 * (der_acc - 0.5) else "WEAK"
    if ci[1] < 0.5:
        return "REVERSED"
    return "WEAK"


def region_stats(pt, pos_mask, rng, reps=2000):
    m = pos_mask[pt.pos] & pt.exposure_differs
    c, n = pt.cluster_counts(pt.exposure_agree, m)
    tot = n.sum()
    if not tot:
        return {"accuracy": None, "pairs": 0, "positions": 0}, [None, None]
    return ({"accuracy": float(c.sum() / tot), "pairs": int(tot), "positions": int(len(n))},
            ratio_ci(c, n, rng, reps))


def pos_attr(pt, fn):
    first = {}
    for r in pt.rows:
        key = (r["game_id"], r["ply"])
        if key not in first:
            first[key] = str(fn(r))
    return np.array([first[p] for p in pt.pos_list], dtype=object)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--table-a", required=True)
    ap.add_argument("--table-b", required=True)
    ap.add_argument("--per-side", required=True)
    ap.add_argument("--ingest-manifest", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    rng = np.random.default_rng(SEED)
    A = list(read_zst(args.table_a))
    B = list(read_zst(args.table_b))

    players = sorted({r["player"] for r in A})
    perm = np.random.default_rng(SEED).permutation(len(players))
    derivation = {players[i] for i in perm[: int(round(DERIVATION_SHARE * len(players)))]}

    result = {
        "protocol": "docs/system-invariant/RESEARCH_QUESTION_FREEZE.md",
        "interpretation_contract": "docs/system-invariant/AMENDMENT_01.md",
        "seed": SEED, "engine_searches_run": 0,
        "n_decisions": len(A), "n_candidate_rows": len(B), "n_players": len(players),
        "derivation_players": len(derivation),
        "judgement_players": len(players) - len(derivation),
    }

    best_rows = [r for r in A if r["played_is_best"]]
    ql = np.array([r["quality_loss"] for r in best_rows])
    result["outcome_noise_floor"] = {
        "what": "quality_loss where the human played the engine's own best move; it should be 0",
        "n": len(best_rows), "mean": float(ql.mean()), "median": float(np.median(ql)),
        "share_above_zero": float((ql > 1e-9).mean()),
        "share_above_accurate_threshold": float((ql > ACCURATE_WIN_PROBABILITY_LOSS).mean()),
        "p95": float(np.quantile(ql, 0.95)),
    }

    print("Test A ...", flush=True)
    testa = {t: standardized_coefficient(A, t, CONTROLS, rng)
             for t in ("exposure_delta", "exposure_post")}
    testa["exposure_delta_without_value_controls"] = standardized_coefficient(
        A, "exposure_delta", [c for c in CONTROLS if c not in VALUE_CONTROLS], rng)
    result["test_a"] = testa

    print("Test A falsifiers ...", flush=True)
    cp = np.array([r["clock_pressure"] for r in A])
    t1, t2 = np.quantile(cp, [1 / 3, 2 / 3])

    def tert(r):
        return "low" if r["clock_pressure"] <= t1 else ("mid" if r["clock_pressure"] <= t2 else "high")

    result["test_a_falsifiers"] = {
        "F_A1_rating_bands": {b: standardized_coefficient(
            [r for r in A if r["band"] == b], "exposure_delta", CONTROLS, rng, reps=400)
            for b in sorted({r["band"] for r in A})},
        "F_A2_phase": {p: standardized_coefficient(
            [r for r in A if r["phase"] == p], "exposure_delta", CONTROLS, rng, reps=400)
            for p in sorted({r["phase"] for r in A})},
        "F_A3_clock_tertile": {t: standardized_coefficient(
            [r for r in A if tert(r) == t], "exposure_delta", CONTROLS, rng, reps=400)
            for t in ("low", "mid", "high")},
        "F_A3_cuts": {"tertile_1": float(t1), "tertile_2": float(t2)},
        "F_A4_within_player": standardized_coefficient(A, "exposure_delta", CONTROLS, rng,
                                                       demean_by="player"),
        "F_A5_within_game": standardized_coefficient(A, "exposure_delta", CONTROLS, rng,
                                                     demean_by="game_id"),
        "F_A9_permuted_within_player": standardized_coefficient(
            A, "exposure_delta", CONTROLS, rng, permute_target_within="player"),
    }

    print("Test B ...", flush=True)
    train = [r for r in B if r["player"] in derivation]
    test = [r for r in B if r["player"] not in derivation]
    PT = PairTable(test)
    ladder = {"L": L_FEATURES,
              "L_Epost": L_FEATURES + ["exposure_post"],
              "L_Edelta": L_FEATURES + ["exposure_delta"],
              "L_Material": L_FEATURES + MATERIAL_FEATURES,
              "L_Mobility": L_FEATURES + MOBILITY_FEATURES}
    for name, col in NEG_CONTROLS.items():
        ladder[f"L_{name}"] = L_FEATURES + [col]

    counts, stats = {}, {}
    for name, cols in ladder.items():
        c, n = PT.cluster_counts(PT.score(fit_predict(train, test, cols)))
        counts[name] = (c, n)
        stats[name] = summarize(c, n, rng)

    comparisons = {}
    for a, b in (("L_Epost", "L"), ("L_Edelta", "L"), ("L_Epost", "L_Material"),
                 ("L_Epost", "L_Mobility"), ("L_Epost", "L_Edelta")):
        comparisons[f"{a}_minus_{b}"] = {
            "gain": stats[a]["accuracy"] - stats[b]["accuracy"],
            "ci95_cluster_position": diff_ci(*counts[a], *counts[b], rng)}
    for name in NEG_CONTROLS:
        comparisons[f"L_{name}_minus_L"] = {
            "gain": stats[f"L_{name}"]["accuracy"] - stats["L"]["accuracy"],
            "ci95_cluster_position": diff_ci(*counts[f"L_{name}"], *counts["L"], rng)}
    result["test_b"] = {"models": stats, "comparisons": comparisons,
                        "held_out_on": "players not in the derivation 60%"}

    print("functional invariance ...", flush=True)
    fi = {}
    for label, mask in (("all_pairs", PT.exposure_differs),
                        ("alike_geometry", PT.exposure_differs & PT.alike),
                        ("unlike_geometry", PT.exposure_differs & ~PT.alike)):
        c, n = PT.cluster_counts(PT.exposure_agree, mask)
        fi[label] = summarize(c, n, rng, reps=2000)
    fi["unlike_minus_alike_gain"] = (
        (fi["unlike_geometry"]["accuracy"] or 0) - (fi["alike_geometry"]["accuracy"] or 0))
    fi["what_alike_means"] = "same moving piece type and same capture status"
    result["functional_invariance"] = fi

    print("scope map ...", flush=True)
    der_rows = [r for r in B if r["player"] in derivation]
    fams, cuts = build_selectors(der_rows)
    PT_der = PairTable(der_rows)
    der_overall, der_ci = region_stats(PT_der, np.ones(PT_der.npos, dtype=bool), rng)
    held_overall, held_ci = region_stats(PT, np.ones(PT.npos, dtype=bool), rng)
    der_overall["ci95_cluster_position"] = der_ci
    held_overall["ci95_cluster_position"] = held_ci

    attrs_der = {f: pos_attr(PT_der, fn) for f, fn in fams.items()}
    attrs_held = {f: pos_attr(PT, fn) for f, fn in fams.items()}
    depth1 = {}
    for fam in sorted(fams):
        for value in sorted(set(attrs_der[fam].tolist())):
            d, _ = region_stats(PT_der, attrs_der[fam] == value, rng, reps=600)
            h, ci = region_stats(PT, attrs_held[fam] == value, rng, reps=600)
            h["ci95_cluster_position"] = ci
            depth1[f"{fam}={value}"] = {
                "label": label_region(d["accuracy"], h["accuracy"], h["pairs"], ci),
                "derivation": d, "held_out": h}

    fam_names = sorted(fams)
    best = None
    for a in range(len(fam_names)):
        for b in range(a + 1, len(fam_names)):
            fa, fb = fam_names[a], fam_names[b]
            for va in sorted(set(attrs_der[fa].tolist())):
                for vb in sorted(set(attrs_der[fb].tolist())):
                    mask = (attrs_der[fa] == va) & (attrs_der[fb] == vb)
                    if mask.sum() < 30:
                        continue
                    m = mask[PT_der.pos] & PT_der.exposure_differs
                    c, n = PT_der.cluster_counts(PT_der.exposure_agree, m)
                    tot = n.sum()
                    if tot < MIN_REGION_PAIRS:
                        continue
                    acc = float(c.sum() / tot)
                    if best is None or acc > best[0]:
                        best = (acc, fa, va, fb, vb, int(tot), int(len(n)))

    scope = {
        "selector_vocabulary": fam_names,
        "tertile_cuts_from_derivation_only": cuts,
        "min_region_pairs": MIN_REGION_PAIRS,
        "region_score": "model-free: among within-position pairs whose exposure differs, how often the lower-exposure move has the lower regret",
        "overall_derivation": der_overall,
        "overall_held_out": held_overall,
        "depth1": depth1,
    }
    if best is not None:
        acc, fa, va, fb, vb, tot, npos = best
        h, ci = region_stats(PT, (attrs_held[fa] == va) & (attrs_held[fb] == vb), rng, reps=2000)
        h["ci95_cluster_position"] = ci
        scope["depth2_frozen_winner"] = {
            "region": f"{fa}={va} AND {fb}={vb}",
            "chosen_on": "derivation players only, before any held-out number was read",
            "derivation": {"accuracy": acc, "pairs": tot, "positions": npos},
            "held_out": h,
            "label": label_region(acc, h["accuracy"], h["pairs"], ci)}
    result["scope_map"] = scope

    print("ecology ...", flush=True)
    per_side = {r["game_id"]: r for r in (json.loads(l) for l in open(args.per_side))}
    manifest = json.loads(Path(args.ingest_manifest).read_text())
    cand = manifest["candidate_sides_by_band"]
    total_cand = sum(cand.values())
    W = {b: cand[b] / total_cand for b in cand}

    by_pos = collections.defaultdict(list)
    for r in B:
        by_pos[(r["game_id"], r["ply"])].append(r)
    a_by_pos = {(r["game_id"], r["ply"]): r for r in A}

    infos = []
    for pos, cands in by_pos.items():
        best_wp = max(c["cand_wp"] for c in cands)
        reasonable = [c for c in cands if best_wp - c["cand_wp"] <= REASONABLE_BAND]
        is_opp = len(reasonable) >= 2 and len({c["exposure_post"] for c in reasonable}) >= 2
        rec = {"is_opp": is_opp, "band": cands[0]["band"], "player": cands[0]["player"],
               "game_id": cands[0]["game_id"], "chose_higher": None, "cost": None,
               "played_in_reasonable": None, "two_plus_reasonable": len(reasonable) >= 2}
        if is_opp:
            played = [c for c in reasonable if c["is_played"]]
            rec["played_in_reasonable"] = bool(played)
            if played:
                lo = min(c["exposure_post"] for c in reasonable)
                rec["chose_higher"] = played[0]["exposure_post"] > lo
                arow = a_by_pos.get(pos)
                if rec["chose_higher"] and arow is not None:
                    rec["cost"] = arow["quality_loss"]
        infos.append(rec)

    bands = sorted({i["band"] for i in infos})
    O1 = {}
    for b in bands:
        sub = [i for i in infos if i["band"] == b]
        O1[b] = {"rate": sum(1 for i in sub if i["is_opp"]) / len(sub),
                 "opportunities": sum(1 for i in sub if i["is_opp"]),
                 "denominator_decisions": len(sub)}

    opp_by_game, dec_by_game = collections.Counter(), collections.Counter()
    for i in infos:
        dec_by_game[i["game_id"]] += 1
        if i["is_opp"]:
            opp_by_game[i["game_id"]] += 1
    uncapped = {g for g, r in per_side.items() if not r["capped"]}
    O2 = {}
    for b in bands:
        games = [g for g in dec_by_game if g in uncapped and per_side.get(g, {}).get("band") == b]
        tot = sum(opp_by_game[g] for g in games)
        O2[b] = {"opportunities_per_game": (tot / len(games)) if games else None,
                 "opportunities": tot, "denominator_games": len(games),
                 "O3_games_needed_for_one_opportunity_UPPER_BOUND":
                     (len(games) / tot) if tot else None}

    unc_sides = [r for r in per_side.values() if not r["capped"]]
    scored_unc = sum(r["decisions_in_table"] for r in unc_sides)
    oplies_unc = sum(r["opportunity_eligible_plies"] for r in unc_sides)
    exactness = {
        "question": "on uncapped sides, is the scored-decision sequence identical to the complete sequence of plies the frozen opportunity definition could apply to?",
        "answer": "NO",
        "uncapped_sides": len(unc_sides),
        "sides_where_sequences_match": sum(
            1 for r in unc_sides if r["decisions_in_table"] == r["opportunity_eligible_plies"]),
        "scored_decisions": scored_unc,
        "opportunity_eligible_plies": oplies_unc,
        "coverage": scored_unc / oplies_unc,
        "missing_plies": oplies_unc - scored_unc,
        "why": "B3 excludes the player's first move (no derivable think time), the last ply of the game, and impossible think times. All three could host an opportunity. Forced positions are the only harmless exclusion, since one legal move cannot yield two reasonable candidates.",
        "consequence": "O2 is NOT exact and is NOT repaired. It counts opportunities per game over B3-ELIGIBLE decisions.",
        "bias_direction": "O2 is a LOWER bound on opportunities per game; O3 an UPPER bound on games needed. Conservative with respect to the GO threshold.",
    }

    O4 = sum(W[b] * O1[b]["rate"] for b in bands if b in W)
    by_player = collections.defaultdict(list)
    for i in infos:
        by_player[i["player"]].append(i)
    player_rates = [sum(1 for x in v if x["is_opp"]) / len(v) for v in by_player.values()]
    O6 = sum(1 for i in infos if i["is_opp"]) / len(infos)

    def headroom_of(sub):
        den = [i for i in sub if i["is_opp"] and i["played_in_reasonable"]]
        num = [i for i in den if i["chose_higher"]]
        return {"rate": len(num) / len(den) if den else None,
                "numerator_chose_higher_exposure": len(num),
                "denominator_opportunities_with_played_move_reasonable": len(den)}

    costs = np.array([i["cost"] for i in infos if i["cost"] is not None], dtype=float)
    cost_games = [i["game_id"] for i in infos if i["cost"] is not None]
    noise = result["outcome_noise_floor"]
    ci_cons = [None, None]
    if len(costs):
        gk = sorted(set(cost_games))
        gi = {g: k for k, g in enumerate(gk)}
        arr = np.array([gi[g] for g in cost_games])
        hit = (costs >= ACCURATE_WIN_PROBABILITY_LOSS).astype(float)
        ci_cons = ratio_ci(np.bincount(arr, weights=hit, minlength=len(gk)),
                           np.bincount(arr, minlength=len(gk)).astype(float), rng)
    noise_rate = noise["share_above_accurate_threshold"]

    result["ecology"] = {
        "estimand_authority": "docs/system-invariant/AMENDMENT_01.md section C",
        "definition": "at least 2 candidates within 0.05 wp of best AND differing in exposure_post by at least 1",
        "target_population_for_O4": "analysed-eligible sides of rated 180+0 standard games played 2026-07-01 UTC, ratings 800-2599, inside the 520,000,000-byte prefix this mission consumed",
        "O4_weights_band_share_of_candidate_sides": W,
        "O1_per_decision_rate_by_band": O1,
        "O2_opportunities_per_game_over_B3_ELIGIBLE_DECISIONS_by_band": O2,
        "O2_exactness_check": exactness,
        "O2_capped_sides_excluded": sum(1 for g in dec_by_game
                                        if g in per_side and per_side[g]["capped"]),
        "O4_pooled_population_weighted_rate": O4,
        "O5_player_weighted_rate": float(np.mean(player_rates)),
        "O5_players": len(player_rates),
        "O6_decision_weighted_rate_SAMPLER_WEIGHTED_NOT_A_POPULATION_RATE": O6,
        "positions": len(infos),
        "positions_with_2plus_reasonable": sum(1 for i in infos if i["two_plus_reasonable"]),
        "headroom_overall": headroom_of(infos),
        "headroom_by_band": {b: headroom_of([i for i in infos if i["band"] == b]) for b in bands},
        "opportunities_where_played_move_not_in_reasonable_set":
            sum(1 for i in infos if i["is_opp"] and not i["played_in_reasonable"]),
        "consequence_n": int(len(costs)),
        "consequence_mean_quality_loss": float(costs.mean()) if len(costs) else None,
        "consequence_median_quality_loss": float(np.median(costs)) if len(costs) else None,
        "consequence_share_at_or_above_FROZEN_threshold_0_02761":
            float((costs >= ACCURATE_WIN_PROBABILITY_LOSS).mean()) if len(costs) else None,
        "consequence_share_ci95_game_cluster": ci_cons,
        "consequence_share_at_or_above_noise_p95_SECONDARY":
            float((costs >= noise["p95"]).mean()) if len(costs) else None,
        "noise_floor_share_above_frozen_threshold": noise_rate,
        "separable_from_noise_floor": bool(ci_cons[0] is not None and ci_cons[0] > noise_rate),
        "measurement_limited_if_not_separable": "AMENDMENT_01 section B.4",
    }

    print("===SI_RESULT_BEGIN===")
    print(json.dumps(result, indent=2, sort_keys=True))
    print("===SI_RESULT_END===")
    Path(args.out).write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
