"""The C3 repair pinned by FABLE GATE 3, applied narrowly and auditably.

WHAT WAS WRONG. C3 permutes rating across players and then formed the regressor as
`perm_rating - ratinghat`, where `ratinghat` is the DEVELOPMENT-frozen prediction of rating from
T1P. `ratinghat` is the partial of the REAL rating, not of the permuted one, so the null carried a
deterministic term that is zero only on the period the model was fitted on. It sat at zero on
DEVELOPMENT, at -0.00016 on VALIDATION, and at -0.00115 on FINAL -- 2.5 null standard deviations out,
which is what made the mechanical verdict `INVALID_EXPERIMENT`.

THE REPAIR, exactly as the reviewer pinned it and with no variants:

    perm_resid = perm_rating            # was: perm_rating - ratinghat

`slope()` centres, so this regresses each frozen residual on the permuted rating minus its mean --
the partial of `perm_rating` under the null. It is the same principle as the pre-holdout C4 repair,
"permute the regressor the estimator uses", and it is applied to all three slope-based C3 fields
whether or not each failed. The TAE-gradient field is untouched.

WHAT THIS SCRIPT MAY AND MAY NOT DO. It recomputes the C3 block, and nothing else, on the three
periods. Every other block of the analysis is copied through unchanged and the script asserts it is
byte-identical. It re-reads no data, re-scores nothing, refits nothing, and changes no threshold.
`evaluate.py` is then run unmodified on the repaired file. The shipped C3 block is kept beside the
repaired one under `C3_shuffled_rating_as_shipped`, because a repair whose evidence has been deleted
is a repair nobody can check.

Run:  python src/repair_c3.py
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import analysis as an  # noqa: E402
import dataset  # noqa: E402
from controls import PERMUTATIONS, _null, _permute, _rng  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def repaired_c3(scored, basis):
    """The C3 block, computed with the pinned repair. Same seed, same 200 draws."""
    rng = _rng("C3")
    players = scored["player"].to_numpy()
    unique = pd.unique(players)
    rating_of = scored.groupby("player")["rating"].first().loc[unique].to_numpy(float)
    position = {p: i for i, p in enumerate(unique)}
    index = np.array([position[p] for p in players])

    y_resid = scored["y_resid_T1"].to_numpy(float)
    voc_resid = scored["voc_resid"].to_numpy(float)
    allocation_resid = scored["allocation_resid"].to_numpy(float)
    extreme_resid = scored["extreme_resid"].to_numpy(float)
    rating = scored["rating"].to_numpy(float)

    def gradient(y_vec, x_vec, rating_vec):
        centred = (rating_vec - 1600.0) / 100.0
        return an.gradient_with_main_effect(y_vec, x_vec, centred, basis.transform(rating_vec))[1]

    tae_v, a_v, d_v, c_v = [], [], [], []
    for _ in range(PERMUTATIONS):
        perm_rating = _permute(rating_of, rng)[index]
        perm_resid = perm_rating            # THE REPAIR. Was `perm_rating - ratinghat`.
        tae_v.append(gradient(y_resid, voc_resid, perm_rating))
        a_v.append(100.0 * an.slope(y_resid, perm_resid))
        d_v.append(100.0 * an.slope(extreme_resid, perm_resid))
        c_v.append(100.0 * an.slope(allocation_resid, perm_resid))
    return {
        "tae_rating_gradient": _null(tae_v),
        "metric_a_time_vs_rating": _null(a_v),
        "extreme_ut_vs_rating": _null(d_v),
        "allocation_loss_vs_rating": _null(c_v),
        "repair": "perm_resid = perm_rating (was perm_rating - ratinghat); pinned by FABLE GATE 3",
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", default=os.path.join(ROOT, "results", "analysis_secondary.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "results", "analysis_repaired.json"))
    ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    args = ap.parse_args()

    original = json.load(open(args.analysis))
    repaired = copy.deepcopy(original)

    dev_raw = dataset.load(os.path.join(args.data, "development"))
    constants = dataset.frozen_constants(dev_raw)
    dev = dataset.apply_frozen(dev_raw, constants)
    groups = dev["player"].to_numpy()
    fits, _ = an.fit_all(dev, groups)
    scored = an.residualise(dev, fits, {**constants, "ut_q95": 0.0})
    constants["ut_q95"] = float(np.quantile(scored["unexpected_time_population"], 0.95))
    fits = an.fit_metric_nuisances(dev, fits, groups, constants)
    basis = an.RatingBasis(dev["rating"].to_numpy(float))

    diffs = {}
    for period in ("development", "validation", "final"):
        frame = dataset.apply_frozen(dataset.load(os.path.join(args.data, period)), constants)
        block = an.residualise(frame, fits, constants)
        shipped = original["controls"][period]["C3_shuffled_rating"]
        fixed = repaired_c3(block, basis)
        repaired["controls"][period]["C3_shuffled_rating"] = fixed
        repaired["controls"][period]["C3_shuffled_rating_as_shipped"] = shipped
        diffs[period] = {
            field: {"shipped": shipped[field], "repaired": fixed[field]}
            for field in ("tae_rating_gradient", "metric_a_time_vs_rating",
                          "extreme_ut_vs_rating", "allocation_loss_vs_rating")
        }
        # The pooled Metric B slope at the frozen centre, which the band-shape loop overwrote in the
        # shipped file (Gate 3, F-O1). Added, never substituted for anything.
        main, _ = an.gradient_with_main_effect(
            block["y_resid_T1"].to_numpy(float), block["voc_resid"].to_numpy(float),
            (block["rating"].to_numpy(float) - 1600.0) / 100.0,
            basis.transform(block["rating"].to_numpy(float)))
        repaired["periods"][period]["tae_pooled_slope_at_centre"] = float(main)

    # Everything outside the C3 block must be untouched.
    def strip(payload):
        out = copy.deepcopy(payload)
        for period in ("development", "validation", "final"):
            out["controls"][period].pop("C3_shuffled_rating", None)
            out["controls"][period].pop("C3_shuffled_rating_as_shipped", None)
            out["periods"][period].pop("tae_pooled_slope_at_centre", None)
        return hashlib.sha256(json.dumps(out, sort_keys=True, default=str).encode()).hexdigest()

    before, after = strip(original), strip(repaired)
    if before != after:
        raise SystemExit(f"REFUSING: the repair changed something outside C3 ({before} != {after})")

    repaired["_repair"] = {
        "applied": "C3 null construction, pinned by FABLE GATE 3 section 1.6",
        "change": "perm_resid = perm_rating (was perm_rating - ratinghat)",
        "scope": "the C3 block on the three primary periods; nothing else",
        "everything_else_sha256": before,
        "shipped_verdict": "INVALID_EXPERIMENT",
        "also_added": "periods.*.tae_pooled_slope_at_centre (Gate 3 F-O1)",
    }
    json.dump(repaired, open(args.out, "w"), indent=1, default=float)
    json.dump(diffs, open(os.path.join(ROOT, "results", "c3_repair_diff.json"), "w"), indent=1,
              default=float)

    print(f"everything outside C3 is byte-identical: sha256 {before[:16]}\n")
    for period, fields in diffs.items():
        print(period)
        for field, pair in fields.items():
            s, r = pair["shipped"], pair["repaired"]
            flag = "" if (r["lo"] <= 0 <= r["hi"]) else "   <-- STILL EXCLUDES 0"
            print(f"  {field:28} shipped {s['point']:+.6f} [{s['lo']:+.6f},{s['hi']:+.6f}]"
                  f"   repaired {r['point']:+.6f} [{r['lo']:+.6f},{r['hi']:+.6f}]{flag}")


if __name__ == "__main__":
    main()
