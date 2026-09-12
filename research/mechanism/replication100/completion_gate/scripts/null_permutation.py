"""
PERMUTATION NULL. Diagnosis only.

Reads committed artefacts and rebuilt feature tables. Writes only into the scratchpad.
Changes no frozen rule, no threshold, and nothing inside the repository.

THE QUESTION
    resid_wg_z decides the output class. What does this exact search, at the depth the real run
    chose, on this player's own game structure and corpus size, return when the outcome carries no
    information about the features at all.

THE NULL
    Within each game, permute the outcome columns jointly across that game's rows. Features stay
    put, game membership stays put, every game keeps its own outcomes and its own size. Only the
    link between a row's features and that row's outcome is destroyed.

    The baseline model is fitted BEFORE the permutation, on real data, because the model is part of
    the instrument and is not what is under test.

    Depth is taken from the committed run rather than re-chosen per permutation, which makes the
    null slightly conservative: a real run also got to pick its depth by cross-validation.

STAGES, as run.py runs them
    OBS  broad stage: residualize() on the frozen baseline columns, every speed, target cls_tactical
    POP  residual stage: residualize_population() against the band population, BLITZ ONLY,
         targets cls_hung_material then cls_tactical

    PERSONAL_RESIDUAL_CANDIDATE is decided on the POP stage, so that is the stage that matters here.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np
import pandas as pd

ANALYSIS = "/home/user/lichess_app/research/mechanism/analysis"
REPL = "/home/user/lichess_app/research/mechanism/replications"
sys.path.insert(0, ANALYSIS)

from common import (load_decisions, eligible, chronological_split,  # noqa: E402
                    within_game_contrast, within_game_demean)
from focal import exclude_focal  # noqa: E402
from search import (build_selectors, search, residualize,  # noqa: E402
                    residualize_population)
import vocab  # noqa: E402

DESIGN = vocab.DESIGN
K = DESIGN["k"]                    # 3.5
MIN_N = DESIGN["min_n_validate"]   # 100
VOCAB_OBS = vocab.VOCAB["OBS"]


def permute_within_game(df: pd.DataFrame, cols: list[str], rng: np.random.Generator) -> pd.DataFrame:
    """One permutation per game, applied to every outcome column together."""
    out = df.copy()
    newpos = np.arange(len(df))
    for _, pos in df.groupby("game_id", sort=False).indices.items():
        p = pos.copy()
        rng.shuffle(p)
        newpos[pos] = p
    for c in cols:
        out[c] = df[c].values[newpos]
    return out


def run_stage(run_dir: str, username: str, stage: str, disc_file: str,
              reps: int, seed: int) -> dict:
    disc = json.load(open(os.path.join(run_dir, "analysis", disc_file)))
    depth = int(disc["depth"])
    target = disc["target"]
    ctgt, stgt = f"{target}_resid", f"{target}_resid_wg"
    observed = [f["validate"]["resid_wg_z"] for f in disc["frozen"]
                if f.get("validate") and f["validate"].get("resid_wg_z") is not None]
    observed_max = max(observed) if observed else float("nan")
    observed_pass = any(f.get("validate", {}).get("pass") for f in disc["frozen"])

    corpus = f"lichess:{username}"
    dec = os.path.join(run_dir, "features", "decisions.parquet")
    df = chronological_split(eligible(load_decisions(dec, corpus=corpus)),
                             DESIGN["derive_frac"], DESIGN["validate_frac"])
    corpus_label = str(df["corpus"].iloc[0]) if "corpus" in df.columns and len(df) else None
    focal_keys = set(df["player_key"].dropna().unique()) if "player_key" in df.columns else set()
    focal_keys.add(username)

    if stage == "POP":
        # run.py passes --blitz-only 1 for the population stage, applied after the split
        df = df[df.speed == "blitz"]
        popres = json.load(open(os.path.join(run_dir, "analysis", "population_resolution.json")))
        if popres.get("status") != "OK":
            return {"username": username, "stage": stage, "error": "population not OK"}
        pop = eligible(load_decisions(popres["population"]["decisions_parquet_abs"], corpus=None))
        pop = exclude_focal(pop, corpus_label, focal_keys).reset_index(drop=True)

    dv = df[df.split == "DERIVE"].reset_index(drop=True)
    va = df[df.split == "VALIDATE"].reset_index(drop=True)
    if len(dv) == 0 or len(va) == 0:
        return {"username": username, "stage": stage, "error": "empty split"}

    # the instrument's own baseline, fitted on real data, before any permutation
    if stage == "POP":
        (_m, auc), (dvr, var) = residualize_population(pop, [dv, va], target)
    else:
        _m, (dvr, var) = residualize(dv, [va], target,
                                     DESIGN["baseline_cols"], DESIGN["baseline_cat"])
        auc = None

    cols = [c for c in (target, ctgt, stgt, DESIGN["secondary_target"], "y_wp_loss")
            if c in dvr.columns]

    nulls, passes = [], 0
    t0 = time.time()
    for r in range(reps):
        rng = np.random.default_rng(seed + r)
        dvp = permute_within_game(dvr, cols, rng)
        vap = permute_within_game(var, cols, rng)
        dvp[stgt] = within_game_demean(dvp, ctgt)
        vap[stgt] = within_game_demean(vap, ctgt)

        sels = build_selectors(dvp, VOCAB_OBS)
        cands = search(dvp, stgt, sels, depth, DESIGN["n_freeze"], True,
                       DESIGN["min_size"], DESIGN["max_size"], beam=DESIGN.get("beam", 30))
        best, any_pass = float("-inf"), False
        for c in cands:
            inside = np.asarray(c["sg"].covers(vap), bool)
            rw = within_game_contrast(vap, inside, ctgt)
            raw = within_game_contrast(vap, inside, target)
            z = rw["z"]
            if z is not None and np.isfinite(z):
                best = max(best, float(z))
                if (int(inside.sum()) >= MIN_N and z >= K
                        and np.isfinite(raw["est"]) and raw["est"] > 0):
                    any_pass = True
        if np.isfinite(best):
            nulls.append(best)
        if any_pass:
            passes += 1
        if (r + 1) % 25 == 0 or r == 0:
            print("  %s/%s/%s rep %3d/%d  (%.0fs)"
                  % (username, stage, target, r + 1, reps, time.time() - t0),
                  file=sys.stderr, flush=True)

    ns = sorted(nulls)
    n = len(ns)
    ge = sum(1 for x in ns if x >= observed_max)
    return {
        "username": username, "stage": stage, "target": target, "depth": depth,
        "pop_auc": auc,
        "derive_rows": int(len(dvr)), "validate_rows": int(len(var)),
        "validate_games": int(var.game_id.nunique()),
        "observed_max_resid_wg_z": observed_max,
        "observed_pass": bool(observed_pass),
        "null_reps": n,
        "null_p50": float(np.median(ns)) if n else None,
        "null_p95": float(np.percentile(ns, 95)) if n else None,
        "null_p99": float(np.percentile(ns, 99)) if n else None,
        "null_max": float(max(ns)) if n else None,
        "null_ge_observed": ge,
        "p_value": (ge + 1) / (n + 1) if n else None,
        "null_pass_rate": passes / n if n else None,
        "nulls": [round(x, 4) for x in ns],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--members", required=True)
    ap.add_argument("--reps", type=int, default=200)
    ap.add_argument("--seed", type=int, default=987654)
    ap.add_argument("--stages", default="POP,OBS")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    stages = [s.strip() for s in a.stages.split(",") if s.strip()]

    results = []
    for u in [x.strip() for x in a.members.split(",") if x.strip()]:
        rd = None
        for suffix in ("_COHORT", "_RUNOFRECORD", "_B"):
            p = os.path.join(REPL, f"lichess_{u}{suffix}")
            if os.path.isdir(p):
                rd = p
                break
        if rd is None:
            print(f"SKIP {u}: no run dir", file=sys.stderr)
            continue
        files = sorted(os.listdir(os.path.join(rd, "analysis")))
        for stage in stages:
            for f in files:
                if not (f.startswith(f"discovery_{stage}_") and f.endswith(".json")):
                    continue
                print(f"== {u} {stage} {f} ==", file=sys.stderr, flush=True)
                try:
                    results.append(run_stage(rd, u, stage, f, a.reps, a.seed))
                except Exception as e:  # noqa: BLE001
                    print(f"FAILED {u} {stage} {f}: {e!r}", file=sys.stderr)
                    results.append({"username": u, "stage": stage, "file": f, "error": repr(e)})
                json.dump(results, open(a.out, "w"), indent=1)
    print(f"wrote {a.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
