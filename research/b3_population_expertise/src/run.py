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


def tree_comparator(dev, frame, fits) -> dict:
    """The PINNED gradient-boosted comparator, reported out of sample.

    ONE tree, the one control C5b plants the residual of. An earlier draft fitted a second tree here
    with different hyperparameters and a different seed, which would have left the report citing a
    comparator that was not the one the control used.

    If it predicts better than the additive model, that is a fact about predictability and nothing
    else: it supplies no reported scientific quantity, because a black box that predicts better is
    not thereby an explanation.
    """
    tree = fits["gbt"]
    return {
        "gbt_r2_development_in_sample": models.r2(dev["log_time"], models.gbt_predict(tree, dev)),
        "gbt_r2": models.r2(frame["log_time"], models.gbt_predict(tree, frame)),
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
    # `extreme_ut` needs `ut_q95`, and the Metric C/D nuisance fits need `extreme_ut`, so the second
    # round of fitting comes after the quantile exists (N1c).
    fits = an.fit_metric_nuisances(dev, fits, groups, constants)
    scored_dev = an.residualise(dev, fits, constants)
    # The rating spline that carries every interaction's main effect, frozen on DEVELOPMENT knots.
    basis = an.RatingBasis(dev["rating"].to_numpy(float))

    manifest = {
        "frozen_constants": constants,
        "models": {name: models.manifest_entry(fit) for name, fit in fits.items()
                   if isinstance(fit, dict)},
        "gbt": models.GBT_SPEC,
        "bootstrap": {"replicates": an.BOOTSTRAP, "seed": an.BOOT_SEED, "unit": "player"},
        "rating_basis_knots": basis.knots,
        "development": {"decisions": int(len(dev)), "players": int(dev["player"].nunique())},
        "written_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    json.dump(manifest, open(os.path.join(args.results, "model_manifest.json"), "w"), indent=1)

    periods, controls, matched, frontiers, players, comparison = {}, {}, {}, {}, {}, {}
    scored_frames: dict = {}
    wanted = {"develop": ["development"],
              "validate": ["development", "validation"],
              "final": ["development", "validation", "final"],
              "secondary": ["development", "validation", "final"]}[args.stage]
    if "final" in wanted or args.stage == "secondary":
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
                            **tree_comparator(dev, out["scored"], fits)}
        scored_frames[name] = out["scored"]
        out["scored"] = None
        out["raw"] = None

    # ---- the player-disjoint restriction of FINAL (N6; PREREGISTRATION.md §3) -------------------
    #
    # Preregistered, computed always, and never chosen after seeing it: both the full FINAL estimate
    # and the restricted one are reported, and VERDICT_RULES.md §2.5 requires the restricted one to
    # hold. Overlap is not prevented at sampling time, because preventing it would have meant
    # reading FINAL's player list before Gate 2.
    disjoint = {}
    if "final" in scored_frames:
        earlier = set(scored_frames["development"]["player"]) | set(
            scored_frames["validation"]["player"])
        final_frame = scored_frames["final"]
        overlap_mask = final_frame["player"].isin(earlier)
        restricted = final_frame[~overlap_mask]
        disjoint = {
            "overlapping_players": int(final_frame.loc[overlap_mask, "player"].nunique()),
            "final_players": int(final_frame["player"].nunique()),
            "overlapping_decisions": int(overlap_mask.sum()),
            "restricted_decisions": int(len(restricted)),
        }
        if len(restricted) > 5000:
            sub = estimate(restricted, an.PlayerBootstrap(restricted["player"].to_numpy()), basis)
            sub_matched, _ = matching.match(restricted)
            disjoint.update({
                "beta": sub["beta"],
                "tae_rating_gradient": sub["tae_rating_gradient"],
                "tae_spread_low_to_high": sub["tae_spread_low_to_high"],
                "tae_matched": matching.matched_estimates(sub_matched, basis).get(
                    "tae_rating_gradient", {}),
                "tae_no_zero_time": estimate(
                    restricted[restricted["seconds_taken"] > 0],
                    an.PlayerBootstrap(restricted[restricted["seconds_taken"] > 0]
                                       ["player"].to_numpy()), basis)["tae_rating_gradient"],
                "tae_low_clock_pressure": estimate(
                    restricted[restricted["clock_pressure_cut"] == 0],
                    an.PlayerBootstrap(restricted[restricted["clock_pressure_cut"] == 0]
                                       ["player"].to_numpy()), basis)["tae_rating_gradient"],
                "powered_bands": sub["powered_bands"],
            })
        else:
            disjoint["note"] = "too few decisions remain after the restriction to estimate on"

    # ---- the secondary time control, frozen pipeline, no retuning (N6; §2.6) ---------------------
    secondary = {}
    secondary_path = os.path.join(args.data, "secondary")
    if args.stage == "secondary" and os.path.exists(
            os.path.join(secondary_path, "decisions.jsonl.zst")):
        sys.stderr.write("analysing the secondary time control\n")
        out = analyse_period("secondary", secondary_path, fits, constants, basis,
                             want_controls=False, want_matching=False)
        secondary = {
            "beta": out["estimates"]["beta"],
            "tae_rating_gradient": out["estimates"]["tae_rating_gradient"],
            "tae_spread_low_to_high": out["estimates"]["tae_spread_low_to_high"],
            "metric_a_time_vs_rating": out["estimates"]["metric_a_time_vs_rating"],
            "extreme_ut_vs_rating": out["estimates"]["extreme_ut_vs_rating"],
            "n_decisions": out["estimates"]["n_decisions"],
            "n_players": out["estimates"]["n_players"],
            "powered_bands": out["estimates"]["powered_bands"],
            "note": "the DEVELOPMENT-fitted models applied unchanged to 300+0; nothing retuned",
        }

    analysis = {
        "stage": args.stage,
        "player_disjoint_final": disjoint,
        "secondary_time_control": secondary,
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
