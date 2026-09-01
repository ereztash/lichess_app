"""The C9 comparison itself: two budgets, the same decisions, the frozen recipe refitted on each.

Reports `r_beta` and `r_TAE` with player-bootstrap intervals, and applies the preregistered reading
(`VERDICT_RULES.md`): an upper interval bound on `r_beta` below 0.5 means the evidence favours the
difficulty-proxy explanation over H1, and level 3 and higher language is withheld.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import analysis as an  # noqa: E402
import dataset  # noqa: E402
import models  # noqa: E402

R_BETA_THRESHOLD = 0.5


def estimates_for(path):
    """Refit the frozen RECIPE on this budget's own subset, then take the two slopes."""
    raw = dataset.load(path)
    constants = dataset.frozen_constants(raw)
    frame = dataset.apply_frozen(raw, constants)
    groups = frame["player"].to_numpy()
    fits, _ = an.fit_all(frame, groups)
    scored = an.residualise(frame, fits, {**constants, "ut_q95": 0.0})
    basis = an.RatingBasis(frame["rating"].to_numpy(float))
    block = basis.transform(frame["rating"].to_numpy(float))
    rating_c = (frame["rating"].to_numpy(float) - 1600.0) / 100.0
    return {
        "frame": scored,
        "q": scored["q_resid"].to_numpy(float),
        "u": scored["ut_resid"].to_numpy(float),
        "y": scored["y_resid_T1"].to_numpy(float),
        "v": scored["voc_resid"].to_numpy(float),
        "rating_c": rating_c,
        "block": block,
        "penalty": fits["T2R"]["penalty"],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="the 60k-node subset")
    ap.add_argument("--alt", required=True, help="the 150k-node re-score of the same decisions")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    base, alt = estimates_for(args.base), estimates_for(args.alt)
    # Restrict both to the decisions present in both, so the ratio is not a change of sample.
    key = lambda f: list(zip(f["frame"]["game_id"], f["frame"]["ply"]))  # noqa: E731
    common = sorted(set(key(base)) & set(key(alt)))
    index = {k: i for i, k in enumerate(common)}
    for side in (base, alt):
        order = np.array([index[k] for k in key(side) if k in index])
        keep = np.array([k in index for k in key(side)])
        ranking = np.argsort(order)
        for column in ("q", "u", "y", "v", "rating_c"):
            side[column] = side[column][keep][ranking]
        side["block"] = side["block"][keep][ranking]
        side["players"] = side["frame"]["player"].to_numpy()[keep][ranking]

    boot = an.PlayerBootstrap(base["players"])

    def ratio(field_y, field_x, gradient):
        def statistic(i):
            if gradient:
                a = an.gradient_with_main_effect(base[field_y][i], base[field_x][i],
                                                 base["rating_c"][i], base["block"][i])[1]
                b = an.gradient_with_main_effect(alt[field_y][i], alt[field_x][i],
                                                 alt["rating_c"][i], alt["block"][i])[1]
            else:
                a = an.slope(base[field_y][i], base[field_x][i])
                b = an.slope(alt[field_y][i], alt[field_x][i])
            return b / a if a != 0 else np.nan

        return boot.interval(statistic)

    out = {
        "n_common_decisions": len(common),
        "players": int(len(set(base["players"]))),
        "beta_60k": an.slope(base["q"], base["u"]),
        "beta_150k": an.slope(alt["q"], alt["u"]),
        "r_beta": ratio("q", "u", gradient=False),
        "tae_gradient_60k": an.gradient_with_main_effect(base["y"], base["v"], base["rating_c"],
                                                         base["block"])[1],
        "tae_gradient_150k": an.gradient_with_main_effect(alt["y"], alt["v"], alt["rating_c"],
                                                          alt["block"])[1],
        "r_tae": ratio("y", "v", gradient=True),
        "threshold": R_BETA_THRESHOLD,
    }
    upper = out["r_beta"]["hi"]
    out["favours_difficulty_proxy"] = bool(np.isfinite(upper) and upper < R_BETA_THRESHOLD)
    out["reading"] = (
        "the upper bound of r_beta is below 0.5: the evidence favours the difficulty-proxy "
        "explanation over H1, and level 3 and higher language is withheld"
        if out["favours_difficulty_proxy"]
        else "r_beta does not fall below the preregistered threshold"
    )
    json.dump(out, open(args.out, "w"), indent=1, default=float)
    print(json.dumps({k: out[k] for k in ("beta_60k", "beta_150k", "r_beta",
                                          "favours_difficulty_proxy", "reading")},
                     indent=1, default=float))


if __name__ == "__main__":
    main()
