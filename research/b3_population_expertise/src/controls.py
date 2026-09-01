"""C1-C18. The controls are what make a negative result readable and a positive result survivable.

THE POSITIVE ONES ARE THE POINT. A pipeline that cannot see a signal produces the same tidy null on
every dataset in the world, so C5 (plant a regularity) and C6 (plant an expertise gradient) must
come back with the planted thing, and C7 (plant nothing) must come back empty. If C5 or C6 fails,
no negative verdict from this pipeline means anything and the run is INVALID_EXPERIMENT rather than
SKILL_ONLY. B2's `--control plant-signal` exists for exactly this reason and is the reason its
negative findings could be read at all.

Every control perturbs the DATA and then re-derives residuals through the FROZEN models. None of
them refits anything: a control that refits is asking a different question.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analysis import PlayerBootstrap, residualise
from estimands import estimate

SEED = 20260901


def _rng(tag: str) -> np.random.Generator:
    return np.random.default_rng(abs(hash((SEED, tag))) % (2**32))


def _rerun(frame, fits, constants, boot=None, basis=None):
    residualised = residualise(frame, fits, constants)
    if boot is None:
        boot = PlayerBootstrap(residualised["player"].to_numpy())
    return estimate(residualised, boot, basis)


def _permute(values, rng):
    out = np.asarray(values).copy()
    rng.shuffle(out)
    return out


def run(raw: pd.DataFrame, scored: pd.DataFrame, fits, constants, which=None, basis=None) -> dict:
    """`raw` is the loaded frame with frozen constants applied; `scored` is it residualised."""
    boot = PlayerBootstrap(scored["player"].to_numpy())
    results: dict = {}
    want = set(which) if which else None

    def wanted(name):
        return want is None or name in want

    # C1 -- shuffled quality. The primary association must not survive its outcome being destroyed.
    if wanted("C1"):
        rng = _rng("C1")
        frame = raw.copy()
        frame["quality_loss"] = _permute(frame["quality_loss"].to_numpy(), rng)
        results["C1_shuffled_quality"] = {"beta": _rerun(frame, fits, constants, boot, basis)["beta"]}

    # C2 -- shuffled thinking time.
    if wanted("C2"):
        rng = _rng("C2")
        frame = raw.copy()
        frame["seconds_taken"] = _permute(frame["seconds_taken"].to_numpy(), rng)
        frame["log_time"] = np.log1p(frame["seconds_taken"].astype(float))
        results["C2_shuffled_time"] = {"beta": _rerun(frame, fits, constants, boot, basis)["beta"]}

    # C3 -- shuffled rating, permuted ACROSS PLAYERS so a player's decisions stay together. A
    # move-level rating shuffle would also destroy the clustering, and would then be a weaker test.
    if wanted("C3"):
        rng = _rng("C3")
        frame = raw.copy()
        players = frame["player"].to_numpy()
        unique = pd.unique(players)
        rating_of = frame.groupby("player")["rating"].first()
        shuffled = dict(zip(unique, _permute(rating_of.loc[unique].to_numpy(), rng)))
        frame["rating"] = [shuffled[p] for p in players]
        from common import rating_band

        frame["rating_band"] = [rating_band(r) or "800-999" for r in frame["rating"]]
        frame["rating_diff"] = frame["rating"] - frame["opponent_rating"]
        out = _rerun(frame, fits, constants, boot, basis)
        results["C3_shuffled_rating"] = {
            k: out[k] for k in
            ("tae_rating_gradient", "metric_a_time_vs_rating", "allocation_loss_vs_rating",
             "extreme_ut_vs_rating", "beta_rating_interaction")
        }

    # C4 -- shuffled value of computation. Metric B is an association with VoC; destroy VoC and the
    # association must die with it. If it does not, Metric B was measuring something else.
    if wanted("C4"):
        rng = _rng("C4")
        frame = raw.copy()
        frame["voc_regret"] = _permute(frame["voc_regret"].to_numpy(), rng)
        frame["voc_z"] = (frame["voc_regret"] - constants["voc_mean"]) / constants["voc_sd"]
        out = _rerun(frame, fits, constants, boot, basis)
        results["C4_shuffled_voc"] = {"tae_rating_gradient": out["tae_rating_gradient"],
                                      "tae_pooled": out["tae_pooled"]}

    # C5 -- planted regularity. lambda is fixed here, before the real estimate is read.
    if wanted("C5"):
        lam = 0.02
        frame = raw.copy()
        frame["quality_loss"] = (
            frame["quality_loss"].to_numpy() + lam * scored["unexpected_time_within_rating"].to_numpy()
        )
        out = _rerun(frame, fits, constants, boot, basis)
        results["C5_planted_regularity"] = {"lambda": lam, "beta": out["beta"]}

    # C5b -- a signal the pipeline did not define. C5 plants a term LINEAR IN THE ESTIMATOR'S OWN
    # REGRESSOR, so its recovery follows from linear algebra and it can only fail on a code bug: it
    # is an implementation check, not evidence that a real signal would be seen. C5b plants
    # `lambda * (Y - Yhat_GBT)` -- the residual of the pinned gradient-boosted comparator, a
    # quantity this pipeline's own model never produced. What comes back is the fraction of a real
    # signal the frozen linear specification actually recovers, which is the attenuation factor
    # every reported effect should be read against. A shortfall is a measurement, not an invalid run.
    if wanted("C5b") and "ut_gbt" in scored:
        lam = 0.02
        frame = raw.copy()
        frame["quality_loss"] = (frame["quality_loss"].to_numpy()
                                 + lam * scored["ut_gbt"].to_numpy())
        out = _rerun(frame, fits, constants, boot, basis)
        base = float(np.asarray(scored["q_resid"]) @ np.asarray(scored["ut_resid"])
                     / (np.asarray(scored["ut_resid"]) @ np.asarray(scored["ut_resid"])))
        recovered = out["beta"]["point"] - base
        results["C5b_planted_foreign_residual"] = {
            "lambda": lam,
            "beta": out["beta"],
            "beta_unplanted": base,
            "recovered_fraction": recovered / lam if lam else float("nan"),
            "note": "recovered_fraction is the share of a signal defined outside this pipeline's "
                    "own residual that the frozen linear specification detects; it is the "
                    "attenuation factor for every reported effect",
        }

    # C6 -- planted expertise adaptation: thinking time rebuilt so the VoC slope RISES with rating.
    if wanted("C6"):
        rng = _rng("C6")
        frame = raw.copy()
        base = scored["yhat_T1P"].to_numpy()
        gradient = 0.05 + 0.05 * (frame["rating"].to_numpy() - 800) / 1800.0
        noise = rng.normal(0.0, float(scored["y_resid_T1"].std()), len(frame))
        frame["log_time"] = base + gradient * frame["voc_z"].to_numpy() + noise
        frame["seconds_taken"] = np.expm1(np.clip(frame["log_time"], 0, None))
        out = _rerun(frame, fits, constants, boot, basis)
        results["C6_planted_expertise"] = {"tae_rating_gradient": out["tae_rating_gradient"],
                                           "tae_by_band": out["tae_by_band"]}

    # C7 -- nothing planted. The pipeline must not invent the hypothesis.
    if wanted("C7"):
        rng = _rng("C7")
        frame = raw.copy()
        frame["log_time"] = scored["yhat_T1P"].to_numpy() + rng.normal(
            0.0, float(scored["y_resid_T1"].std()), len(frame)
        )
        frame["seconds_taken"] = np.expm1(np.clip(frame["log_time"], 0, None))
        frame["quality_loss"] = np.clip(
            scored["quality_loss"].to_numpy().mean()
            + rng.normal(0.0, float(scored["q_resid"].std()), len(frame)),
            0, 1,
        )
        out = _rerun(frame, fits, constants, boot, basis)
        results["C7_no_effect_synthetic"] = {
            k: out[k] for k in ("beta", "tae_rating_gradient", "metric_a_time_vs_rating",
                                "allocation_loss_vs_rating", "extreme_ut_vs_rating")
        }

    # C8 -- player influence. (a) drop the busiest 1% of players; (b) jackknife over players.
    if wanted("C8"):
        counts = scored.groupby("player").size().sort_values(ascending=False)
        busiest = set(counts.index[: max(1, len(counts) // 100)])
        keep = ~scored["player"].isin(busiest)
        subset = scored[keep]
        sub_boot = PlayerBootstrap(subset["player"].to_numpy())
        dropped = estimate(subset, sub_boot, basis)
        full_beta = float(np.asarray(scored["q_resid"]) @ np.asarray(scored["ut_resid"])
                          / (np.asarray(scored["ut_resid"]) @ np.asarray(scored["ut_resid"])))
        # Jackknife: the largest single-player influence on beta.
        q = scored["q_resid"].to_numpy()
        u = scored["ut_resid"].to_numpy()
        num, den = float(q @ u), float(u @ u)
        worst, worst_player = 0.0, None
        for player, block in scored.groupby("player").indices.items():
            n = num - float(q[block] @ u[block])
            d = den - float(u[block] @ u[block])
            if d <= 0:
                continue
            shift = abs(n / d - full_beta) / abs(full_beta) if full_beta else 0.0
            if shift > worst:
                worst, worst_player = shift, player
        results["C8_player_influence"] = {
            "beta_full": full_beta,
            "beta_without_busiest_1pct": dropped["beta"],
            "tae_gradient_without_busiest_1pct": dropped["tae_rating_gradient"],
            "relative_change": abs(dropped["beta"]["point"] - full_beta) / abs(full_beta)
            if full_beta else float("nan"),
            "max_single_player_relative_shift": worst,
            "players_dropped": len(busiest),
        }

    # C19 -- the player's own previous think time added to the context block. It absorbs pace, and
    # pace is partly the allocation policy Metric B measures, which is why it is not in T0.
    if wanted("C19"):
        import models as m

        dev_like = scored
        try:
            fit = m.fit_frozen(dev_like, "T2R_C19", "log_time", dev_like["player"].to_numpy(),
                               penalty=fits["T2R"]["penalty"])
            ut = dev_like["log_time"].to_numpy(float) - m.predict(fit, dev_like)
            q = scored["q_resid"].to_numpy(float)
            results["C19_own_pace_added"] = {
                "beta": boot.interval(lambda i: float(q[i] @ ut[i]) / float(ut[i] @ ut[i])
                                      if float(ut[i] @ ut[i]) > 0 else np.nan)
            }
        except Exception as error:
            results["C19_own_pace_added"] = {"note": f"not computable: {error}"}

    # C10 -- the B2-compatible binary outcome.
    if wanted("C10"):
        u = scored["ut_resid"].to_numpy()
        a = scored["accurate"].to_numpy(float)
        a = a - a.mean()
        results["C10_binary_outcome"] = {
            "beta_on_inaccuracy": boot.interval(
                lambda i: -float(a[i] @ u[i]) / float(u[i] @ u[i]) if float(u[i] @ u[i]) > 0 else np.nan
            )
        }

    # C11-C14, C17, C18 -- strata and exclusions, all on the same frozen residuals.
    strata = {}
    if wanted("C11"):
        strata["C11_no_book"] = scored["is_book"] == 0
    if wanted("C17"):
        strata["C17_no_zero_time"] = scored["seconds_taken"] > 0
    if wanted("C18"):
        strata["C18_first_40_plies"] = scored["ply"] < 40
    if wanted("C12"):
        for phase in ("opening", "middlegame", "endgame"):
            strata[f"C12_phase_{phase}"] = scored["phase"] == phase
    if wanted("C13"):
        for standing in ("winning", "level", "losing"):
            strata[f"C13_standing_{standing}"] = scored["standing"] == standing
    if wanted("C14"):
        cut = scored["clock_pressure_cut"]
        for tercile in (0, 1, 2):
            strata[f"C14_clock_pressure_t{tercile}"] = cut == tercile

    for name, mask in strata.items():
        subset = scored[mask]
        if len(subset) < 2000:
            results[name] = {"n": int(len(subset)), "note": "too few decisions"}
            continue
        sub_boot = PlayerBootstrap(subset["player"].to_numpy())
        out = estimate(subset, sub_boot, basis)
        results[name] = {
            "n": out["n_decisions"],
            "players": out["n_players"],
            "beta": out["beta"],
            "tae_rating_gradient": out["tae_rating_gradient"],
            "metric_a_time_vs_rating": out["metric_a_time_vs_rating"],
        }
    return results
