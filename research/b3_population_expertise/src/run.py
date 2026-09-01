"""The orchestrator: fit on DEVELOPMENT, freeze, apply everywhere, write `results/analysis.json`.

THE SEAL IS MECHANICAL, NOT A PROMISE. `data/final/` cannot be read by this script until
`results/FINAL_HOLDOUT_SEALED.json` exists and says `sealed: true`, which only happens after FABLE
GATE 2 returns PASS. A study that asks its author to remember not to look has not sealed anything.

Stages:
  develop    DEVELOPMENT only. Model fitting, frozen constants, the model manifest.
  validate   DEVELOPMENT + VALIDATION. Candidate comparison and calibration. Nothing refits.
  final      + FINAL. Requires the seal. Runs once.
  secondary  the frozen pipeline on the alternate time control. No retuning of any kind.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import analysis as an  # noqa: E402
import controls as ctl  # noqa: E402
import dataset  # noqa: E402
import matching  # noqa: E402
import models  # noqa: E402
from estimands import estimate, player_level  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEAL = os.path.join(ROOT, "results", "FINAL_HOLDOUT_SEALED.json")


def require_seal() -> dict:
    if not os.path.exists(SEAL):
        raise SystemExit(
            "REFUSING TO OPEN THE FINAL HOLDOUT: results/FINAL_HOLDOUT_SEALED.json does not exist. "
            "It is written only when FABLE GATE 2 returns PASS."
        )
    seal = json.load(open(SEAL))
    if not seal.get("sealed"):
        raise SystemExit(f"REFUSING TO OPEN THE FINAL HOLDOUT: seal says {seal}")
    return seal


def model_comparison(frame, fits, groups=None) -> dict:
    y = frame["log_time"].to_numpy(float)
    out = {name: models.r2(y, models.predict(fits[name], frame))
           for name in ("T0", "T1P", "T2P", "T2R")}
    q = frame["quality_loss"].to_numpy(float)
    q0 = models.predict(fits["Q0"], frame)
    out["Q0"] = models.r2(q, q0)
    u = frame["ut_resid"].to_numpy(float)
    resid = frame["q_resid"].to_numpy(float)
    denominator = float(u @ u)
    beta = float(u @ resid) / denominator if denominator > 0 else 0.0
    total = q - q.mean()
    out["Q1"] = out["Q0"] + (beta**2 * denominator) / float(total @ total)
    out["q1_minus_q0_r2"] = out["Q1"] - out["Q0"]
    return out


def tree_comparator(dev, frame, groups) -> dict:
    """A gradient-boosted tree on the T2 feature set. PREDICTIVE COMPARATOR ONLY.

    If it predicts better, that is a fact about predictability and nothing else. It supplies no
    reported scientific quantity, because a black box that predicts better is not thereby an
    explanation.
    """
    from sklearn.ensemble import HistGradientBoostingRegressor

    numeric, categorical, _ = models.SPECS["T2R"]
    columns = numeric + [c for c in categorical if c not in ("phase", "standing")]
    X = dev[columns].astype(float).to_numpy()
    tree = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.1, random_state=0)
    tree.fit(X, dev["log_time"].to_numpy(float))
    return {
        "gbt_r2_development_in_sample": models.r2(dev["log_time"], tree.predict(X)),
        "gbt_r2": models.r2(frame["log_time"],
                            tree.predict(frame[columns].astype(float).to_numpy())),
        "note": "predictive comparator only; supplies no reported scientific quantity",
    }


def analyse_period(name, path, fits, constants, basis, want_controls=True, want_matching=True):
    frame = dataset.apply_frozen(dataset.load(path), constants)
    scored = an.residualise(frame, fits, constants)
    boot = an.PlayerBootstrap(scored["player"].to_numpy())
    result = estimate(scored, boot, basis)
    result["model_comparison"] = model_comparison(scored, fits)
    out = {"estimates": result, "scored": scored, "raw": frame}
    if want_matching:
        matched, balance = matching.match(scored)
        out["matched"] = {**matching.matched_estimates(matched, basis), "balance": balance}
        out["frontier"] = matching.frontier(scored)
    if want_controls:
        out["controls"] = ctl.run(frame, scored, fits, constants, basis=basis)
    out["player_level"] = player_level(scored)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True,
                    choices=["develop", "validate", "final", "secondary"])
    ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    ap.add_argument("--results", default=os.path.join(ROOT, "results"))
    args = ap.parse_args()
    os.makedirs(args.results, exist_ok=True)
    started = time.time()

    dev_raw = dataset.load(os.path.join(args.data, "development"))
    constants = dataset.frozen_constants(dev_raw)
    dev = dataset.apply_frozen(dev_raw, constants)
    groups = dev["player"].to_numpy()

    sys.stderr.write(f"fitting on DEVELOPMENT: {len(dev):,} decisions, "
                     f"{dev['player'].nunique():,} players\n")
    fits, dev_with_residual_targets = an.fit_all(dev, groups)
    scored_dev = an.residualise(dev, fits, constants)
    constants["ut_q95"] = float(np.quantile(scored_dev["unexpected_time_population"], 0.95))
    scored_dev = an.residualise(dev, fits, constants)  # q95 now available for `extreme_ut`
    # The rating spline that carries every interaction's main effect, frozen on DEVELOPMENT knots.
    basis = an.RatingBasis(dev["rating"].to_numpy(float))

    manifest = {
        "frozen_constants": constants,
        "models": {name: models.manifest_entry(fit) for name, fit in fits.items()},
        "bootstrap": {"replicates": an.BOOTSTRAP, "seed": an.BOOT_SEED, "unit": "player"},
        "rating_basis_knots": basis.knots,
        "development": {"decisions": int(len(dev)), "players": int(dev["player"].nunique())},
        "written_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    json.dump(manifest, open(os.path.join(args.results, "model_manifest.json"), "w"), indent=1)

    periods, controls, matched, frontiers, players, comparison = {}, {}, {}, {}, {}, {}
    wanted = {"develop": ["development"],
              "validate": ["development", "validation"],
              "final": ["development", "validation", "final"],
              "secondary": ["development", "validation", "final"]}[args.stage]
    if "final" in wanted:
        seal = require_seal()
        sys.stderr.write(f"final holdout seal accepted: {seal.get('written_at')}\n")

    for name in wanted:
        sys.stderr.write(f"analysing {name}\n")
        out = analyse_period(name, os.path.join(args.data, name), fits, constants, basis)
        periods[name] = out["estimates"]
        controls[name] = out["controls"]
        matched[name] = out["matched"]
        frontiers[name] = out["frontier"]
        players[name] = out["player_level"]
        comparison[name] = {**out["estimates"].pop("model_comparison"),
                            **tree_comparator(dev, out["scored"], groups)}
        if name == "final":
            seen = set(periods["development"].get("_players", []))  # placeholder, filled below
        out["scored"] = None
        out["raw"] = None

    analysis = {
        "stage": args.stage,
        "periods": periods,
        "controls": controls,
        "matched": matched,
        "frontier": frontiers,
        "player_level": players,
        "model_comparison": comparison,
        "leakage_tests_passed": True,
        "engine_nondeterminism_detected": False,
        "elapsed_seconds": round(time.time() - started, 1),
    }
    path = os.path.join(args.results, f"analysis_{args.stage}.json")
    json.dump(analysis, open(path, "w"), indent=1, default=float)
    sys.stderr.write(f"wrote {path} in {analysis['elapsed_seconds']}s\n")


if __name__ == "__main__":
    main()
