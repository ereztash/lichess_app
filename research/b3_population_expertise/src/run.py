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

import hashlib

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


def _gate_checks(results_dir) -> dict:
    """The two INVALID conditions that were literals. Absent evidence is a failure, not a pass."""
    path = os.path.join(results_dir, "gate_checks.json")
    if not os.path.exists(path):
        return {"leakage_tests_passed": False,
                "engine_nondeterminism_detected": True,
                "gate_checks_note": "results/gate_checks.json is absent; run src/gate_checks.py"}
    checks = json.load(open(path))
    return {
        "leakage_tests_passed": bool(checks.get("leakage_tests_passed")),
        "engine_nondeterminism_detected": bool(checks.get("engine_nondeterminism_detected")),
        "gate_checks": checks,
    }


def model_comparison(frame, fits, groups=None) -> dict:
    y = frame["log_time"].to_numpy(float)
    out = {name: models.r2(y, models.predict(fits[name], frame))
           for name in ("T0", "T1P", "T2P", "T2R")}
    q = frame["quality_loss"].to_numpy(float)
    q0 = models.predict(fits["Q0"], frame)
    out["Q0"] = models.r2(q, q0)
    u = frame["ut_resid"].to_numpy(float)
    resid = frame["q_resid"].to_numpy(float)
    # The SAME estimator as the reported beta (M3c). Inlined uncentred, `q1_minus_q0_r2` -- which
    # decides §2.2 and level 2 -- was computed from a beta that was not the one being reported.
    beta = an.slope(resid, u)
    uc = u - u.mean()
    total = q - q.mean()
    out["Q1"] = out["Q0"] + (beta**2 * float(uc @ uc)) / float(total @ total)
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


def _cache_key(path, fits, constants) -> str:
    """What a cached period result depends on: the corpus, the analysis code, and the frozen fits.

    A period's analysis is deterministic given those three, and it costs the better part of an hour,
    so `--stage validate` recomputing DEVELOPMENT is an hour spent reproducing a file it already
    has. The key changes whenever any source file under `src/` changes, so an edit cannot leave a
    stale result behind.
    """
    digest = hashlib.sha256()
    decisions = os.path.join(path, "decisions.jsonl.zst")
    stat = os.stat(decisions)
    digest.update(f"{decisions}|{stat.st_size}|{int(stat.st_mtime)}".encode())
    for source in sorted(os.listdir(os.path.dirname(os.path.abspath(__file__)))):
        if source.endswith(".py"):
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), source), "rb") as fh:
                digest.update(fh.read())
    digest.update(json.dumps(constants, sort_keys=True, default=str).encode())
    digest.update(json.dumps({k: v.get("penalty") for k, v in fits.items()
                              if isinstance(v, dict)}, sort_keys=True).encode())
    return digest.hexdigest()


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
        period_path = os.path.join(args.data, name)
        cache_path = os.path.join(args.results, f"period_{name}.json")
        key = _cache_key(period_path, fits, constants)
        cached = None
        if os.path.exists(cache_path):
            candidate = json.load(open(cache_path))
            if candidate.get("_cache_key") == key:
                cached = candidate
                sys.stderr.write(f"reusing the cached analysis of {name}\n")

        if cached is None:
            sys.stderr.write(f"analysing {name}\n")
            started_period = time.time()
            out = analyse_period(name, period_path, fits, constants, basis)
            comparison[name] = {**out["estimates"].pop("model_comparison"),
                                **tree_comparator(dev, out["scored"], fits)}
            scored_frames[name] = out["scored"]
            block = {"_cache_key": key, "estimates": out["estimates"],
                     "controls": out["controls"], "matched": out["matched"],
                     "frontier": out["frontier"], "player_level": out["player_level"],
                     "model_comparison": comparison[name]}
            json.dump(block, open(cache_path, "w"), indent=1, default=float)
            sys.stderr.write(f"  {name} took {time.time() - started_period:.0f}s\n")
        else:
            block = cached
            comparison[name] = cached["model_comparison"]
            frame = dataset.apply_frozen(dataset.load(period_path), constants)
            scored_frames[name] = an.residualise(frame, fits, constants)

        periods[name] = block["estimates"]
        controls[name] = block["controls"]
        matched[name] = block["matched"]
        frontiers[name] = block["frontier"]
        players[name] = block["player_level"]

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

    # ---- C9, embedded so the level cap has a path to the verdict (M5) ---------------------------
    #
    # `VERDICT_RULES.md` §2.5c is a rule; `c9.py` writes `results/c9.json`; nothing joined them, so
    # `evaluate.py` read `analysis.get("c9", {})`, found nothing, and applied no cap while recording
    # nothing. A rule with no implementation between its input and the verdict is licence.
    c9_path = os.path.join(args.results, "c9.json")
    c9 = json.load(open(c9_path)) if os.path.exists(c9_path) else {}

    analysis = {
        "stage": args.stage,
        "c9": c9,
        "player_disjoint_final": disjoint,
        "secondary_time_control": secondary,
        "periods": periods,
        "controls": controls,
        "matched": matched,
        "frontier": frontiers,
        "player_level": players,
        "model_comparison": comparison,
        # Read from the recorded test run rather than asserted (see `results/gate_checks.json`,
        # written by `src/gate_checks.py`). Literals here fed constants to two INVALID conditions.
        **_gate_checks(args.results),
        "elapsed_seconds": round(time.time() - started, 1),
    }
    path = os.path.join(args.results, f"analysis_{args.stage}.json")
    json.dump(analysis, open(path, "w"), indent=1, default=float)
    sys.stderr.write(f"wrote {path} in {analysis['elapsed_seconds']}s\n")


if __name__ == "__main__":
    main()
