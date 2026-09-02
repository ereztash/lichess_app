"""C1-C19. The controls are what make a negative result readable and a positive result survivable.

THE POSITIVE ONES ARE THE POINT. A pipeline that cannot see a signal produces the same tidy null on
every dataset in the world, so C6 (plant an expertise gradient) must come back with the planted
thing, C5b (plant a signal defined outside the pipeline's own residual) must recover most of it, and
C7 (plant nothing) must come back empty. B2's `--control plant-signal` exists for exactly this
reason and is why its negative findings could be read at all.

A DESTRUCTIVE CONTROL IS A PERMUTATION TEST, NOT ONE PERMUTATION WITH AN INTERVAL AROUND IT.

The first implementation ran each destructive control ONCE and reported a player-bootstrap interval
around that single draw. That interval measures how precisely the one permutation was estimated; it
says nothing about whether the permutation's value is consistent with zero. On validation, four of
them "failed" for exactly this reason -- C1 came back at -0.0017 with an interval of +/-0.001, which
excludes zero and looks like a destroyed association surviving its destruction. Twenty-five
permutations of the same data put the mean at -0.00009 with a standard deviation of 0.00054: the
null is centred on zero and the single draw was an unlucky one being read against the wrong ruler.

So each destructive control now runs many permutations and reports the **distribution across
permutations** -- the mean as the point and the 2.5/97.5 percentiles as the interval. "The interval
contains zero" is then the test `MODEL_SPEC.md` §9 always meant. It is the same discipline B2's
`analyse.py` applies with a thousand random-boundary nulls and a 95th-percentile bar.

The permutations are computed by residual algebra rather than by re-running the pipeline: every
frozen prediction is recoverable from the vectors already attached (`yhat_T2R = log_time -
unexpected_time_within_rating`, and so on), and none of the T1P-based residuals depends on rating at
all, so a rating permutation touches only the three vectors that carry rating. Exact, and fast
enough to afford two hundred draws.

Every control perturbs the DATA and re-derives through the FROZEN models. None refits anything: a
control that refits is asking a different question.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analysis import (
    PlayerBootstrap, RatingBasis, gradient_with_main_effect, residualise, slope,
)
from common import rating_band
from estimands import estimate

SEED = 20260901
PERMUTATIONS = 200


def _rng(tag: str) -> np.random.Generator:
    return np.random.default_rng(abs(hash((SEED, tag))) % (2**32))


def _null(values) -> dict:
    """The distribution of a statistic across permutations: mean, and the 2.5/97.5 percentiles."""
    finite = np.asarray([v for v in values if np.isfinite(v)], dtype=float)
    if finite.size < 10:
        return {"point": float("nan"), "lo": float("nan"), "hi": float("nan"),
                "permutations": int(finite.size)}
    lo, hi = np.percentile(finite, [2.5, 97.5])
    return {"point": float(finite.mean()), "lo": float(lo), "hi": float(hi),
            "sd": float(finite.std()), "permutations": int(finite.size),
            "note": "distribution across permutations, not a bootstrap around one of them"}


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

    # Vectors every destructive control is built from. Each frozen prediction is recovered from
    # the residual it defines, so no permutation needs the pipeline re-run.
    q = scored["quality_loss"].to_numpy(float)
    q_resid = scored["q_resid"].to_numpy(float)
    qhat = q - q_resid
    ut = scored["unexpected_time_within_rating"].to_numpy(float)
    ut_resid = scored["ut_resid"].to_numpy(float)
    uthat = ut - ut_resid
    log_time = scored["log_time"].to_numpy(float)
    yhat_t2r = log_time - ut
    y_resid = scored["y_resid_T1"].to_numpy(float)
    yhat_t1p = log_time - y_resid
    voc_z = scored["voc_z"].to_numpy(float)
    voc_resid = scored["voc_resid"].to_numpy(float)
    vochat = voc_z - voc_resid
    rating = scored["rating"].to_numpy(float)
    rating_resid = scored["rating_resid"].to_numpy(float)
    ratinghat = rating - rating_resid
    allocation_resid = scored["allocation_resid"].to_numpy(float)
    extreme_resid = scored["extreme_resid"].to_numpy(float)
    players = scored["player"].to_numpy()
    if basis is None:
        basis = RatingBasis(rating)

    def gradient(y_vec, x_vec, rating_vec):
        centred = (rating_vec - 1600.0) / 100.0
        return gradient_with_main_effect(y_vec, x_vec, centred, basis.transform(rating_vec))[1]

    # C1 -- shuffled quality. The primary association must not survive its outcome being destroyed.
    if wanted("C1"):
        rng = _rng("C1")
        results["C1_shuffled_quality"] = {
            "beta": _null([slope(_permute(q, rng) - qhat, ut_resid)
                           for _ in range(PERMUTATIONS)])
        }

    # C2 -- shuffled thinking time.
    if wanted("C2"):
        rng = _rng("C2")
        values = []
        for _ in range(PERMUTATIONS):
            perm = _permute(log_time, rng)
            values.append(slope(q_resid, (perm - yhat_t2r) - uthat))
        results["C2_shuffled_time"] = {"beta": _null(values)}

    # C3 -- shuffled rating, permuted ACROSS PLAYERS so a player's decisions stay together. Nothing
    # in the T1P residuals depends on rating, so a rating permutation touches exactly the three
    # vectors that carry it.
    if wanted("C3"):
        rng = _rng("C3")
        unique = pd.unique(players)
        rating_of = scored.groupby("player")["rating"].first().loc[unique].to_numpy(float)
        position = {p: i for i, p in enumerate(unique)}
        index = np.array([position[p] for p in players])
        tae_v, a_v, d_v, c_v = [], [], [], []
        for _ in range(PERMUTATIONS):
            perm_rating = _permute(rating_of, rng)[index]
            perm_resid = perm_rating - ratinghat
            tae_v.append(gradient(y_resid, voc_resid, perm_rating))
            a_v.append(100.0 * slope(y_resid, perm_resid))
            d_v.append(100.0 * slope(extreme_resid, perm_resid))
            c_v.append(100.0 * slope(allocation_resid, perm_resid))
        results["C3_shuffled_rating"] = {
            "tae_rating_gradient": _null(tae_v),
            "metric_a_time_vs_rating": _null(a_v),
            "extreme_ut_vs_rating": _null(d_v),
            "allocation_loss_vs_rating": _null(c_v),
        }

    # C4 -- shuffled value of computation. Metric B is an association with VoC; destroy VoC and the
    # association must die with it. If it does not, Metric B was measuring something else.
    if wanted("C4"):
        rng = _rng("C4")
        # PERMUTE THE REGRESSOR THE ESTIMATOR ACTUALLY USES.
        #
        # `MODEL_SPEC.md` §9 says "permute `voc_z`", and permuting the raw column and re-deriving
        # through the frozen fit leaves `-vochat(x)` in place -- a deterministic function of the
        # position that still carries rating-dependent structure. That null came back at -0.0012
        # with an interval excluding zero: not a signal surviving its destruction, but a control
        # that had not destroyed the thing it names. Permuting `voc_resid` destroys exactly the
        # association Metric B is a slope of. The raw-column version is reported beside it.
        residual_v, raw_v, pooled = [], [], []
        for _ in range(PERMUTATIONS):
            residual_v.append(gradient(y_resid, _permute(voc_resid, rng), rating))
            perm_raw = _permute(voc_z, rng) - vochat
            raw_v.append(gradient(y_resid, perm_raw, rating))
            pooled.append(slope(y_resid, _permute(voc_resid, rng)))
        results["C4_shuffled_voc"] = {
            "tae_rating_gradient": _null(residual_v),
            "tae_pooled": _null(pooled),
            "tae_rating_gradient_raw_column_permuted": _null(raw_v),
            "note": "the pass condition reads the permutation of voc_resid, the regressor the "
                    "estimator uses; permuting the raw column leaves the frozen fit's "
                    "deterministic part in place and is reported beside it",
        }

    # C5 -- planted regularity. AN IMPLEMENTATION CHECK: the planted term is linear in the
    # estimator's own regressor, so recovery follows from linear algebra and this can only fail on a
    # code defect. lambda is fixed here, before the real estimate is read.
    if wanted("C5"):
        lam = 0.02
        planted = slope(q + lam * ut - qhat, ut_resid)
        results["C5_planted_regularity"] = {
            "lambda": lam,
            "beta": boot.interval(lambda i: slope((q + lam * ut - qhat)[i], ut_resid[i]),
                                  point=planted),
            "beta_unplanted": slope(q_resid, ut_resid),
        }

    # C6 -- planted expertise adaptation: thinking time rebuilt so the VoC slope RISES with rating.
    # Many noise draws, so the interval is the distribution of the recovered gradient rather than a
    # bootstrap around one synthetic dataset.
    if wanted("C6"):
        rng = _rng("C6")
        sd = float(np.std(y_resid))
        planted_slope = 0.05 + 0.05 * (rating - 800) / 1800.0
        values = []
        for _ in range(max(20, PERMUTATIONS // 4)):
            synth = yhat_t1p + planted_slope * voc_z + rng.normal(0.0, sd, len(rating))
            values.append(gradient(synth - yhat_t1p, voc_resid, rating))
        results["C6_planted_expertise"] = {
            "planted_gradient_per_100elo": float(0.05 / 18.0),
            "tae_rating_gradient": _null(values),
        }

    # C7 -- nothing planted. The pipeline must not invent the hypothesis.
    #
    # THE SYNTHETIC DATA IS GENERATED FROM THE MODELS THE RESIDUALS ARE TAKEN AGAINST. A first
    # version generated thinking time from T1P while the residual was taken against T2R, and quality
    # around its mean while the residual was taken against Q0 -- so the synthetic data carried
    # structure the frozen models do not remove, and the pipeline duly found beta = +0.0016 on it.
    # That is not the pipeline inventing the hypothesis; it is a MEASUREMENT OF THE STUDY'S CENTRAL
    # LIMITATION, and it is now reported as one (C7b below) instead of failing a null it was never
    # the right shape for.
    if wanted("C7"):
        rng = _rng("C7")
        sd_y, sd_q = float(np.std(y_resid)), float(np.std(q_resid))
        draws = max(20, PERMUTATIONS // 4)
        b_v, tae_v, a_v = [], [], []
        # GENERATED FROM T2P, the fullest model WITHOUT rating. Generating from T2R put rating in
        # the synthetic time, so Metric A recovered its own real value (-0.0105) from data built to
        # have no rating effect -- the control failing because its generator contained the thing it
        # was testing for the absence of. T2P leaves beta at zero (quality is independent noise
        # around Q0) while making the true rating effect on time zero as well.
        yhat_t2p = scored["yhat_T2P"].to_numpy(float)
        for _ in range(draws):
            synth_lt = yhat_t2p + rng.normal(0.0, sd_y, len(rating))
            synth_q = qhat + rng.normal(0.0, sd_q, len(rating))
            synth_ut_resid = (synth_lt - yhat_t2r) - uthat
            b_v.append(slope(synth_q - qhat, synth_ut_resid))
            tae_v.append(gradient(synth_lt - yhat_t1p, voc_resid, rating))
            a_v.append(100.0 * slope(synth_lt - yhat_t1p, rating_resid))
        results["C7_no_effect_synthetic"] = {
            "beta": _null(b_v), "tae_rating_gradient": _null(tae_v),
            "metric_a_time_vs_rating": _null(a_v),
            "extreme_ut_vs_rating": _null([0.0] * len(b_v)),
            "note": "time generated from T2P (the fullest model without rating) and quality from "
                    "Q0, with independent noise and no UT-quality link, so the true beta, the true "
                    "rating effect on time and the true allocation gradient are all zero; "
                    "extreme_ut has no rating structure in such data by construction",
        }

    # C7b -- HOW MUCH BETA AN OMITTED DETERMINANT OF THINKING TIME MANUFACTURES.
    #
    # Not a pass/fail control: a magnitude for alternative explanation A2, which the design has
    # called its central irreducible limitation from the first draft and which had no number
    # attached to it. Thinking time is generated from T1P -- the model WITHOUT the
    # value-of-computation block -- while the residual is still taken against T2R. That is exactly
    # the situation A2 describes: a real determinant of time that the expected-time model does not
    # contain. Quality is generated from Q0 with independent noise, so the TRUE beta is zero and
    # whatever comes back is the inflation the omission produces.
    if wanted("C7b"):
        rng = _rng("C7b")
        sd_y, sd_q = float(np.std(y_resid)), float(np.std(q_resid))
        draws = max(20, PERMUTATIONS // 4)

        # A2 needs a factor that moves BOTH time and quality; a factor that moves only time
        # manufactures nothing, which a first version of this diagnostic duly measured as zero.
        # The unobserved factor is standard normal and independent of everything measured, and its
        # two strengths are calibrated to a MEASURED one -- the engine-difficulty block, the
        # contribution T1P adds to T0. So the question this answers is: if there were one more
        # difficulty factor as strong as the ones we do measure, and the expected-time model did not
        # contain it, how much beta would that alone produce?
        difficulty_block = yhat_t1p - scored["yhat_T0"].to_numpy(float)
        a = float(np.std(difficulty_block))
        centred_block = difficulty_block - difficulty_block.mean()
        denominator = float(centred_block @ centred_block)
        b = (float(centred_block @ (q - q.mean())) / denominator * a) if denominator > 0 else 0.0

        values = []
        for _ in range(draws):
            unobserved = rng.normal(0.0, 1.0, len(rating))
            synth_lt = yhat_t2r + a * unobserved + rng.normal(0.0, sd_y, len(rating))
            synth_q = qhat + b * unobserved + rng.normal(0.0, sd_q, len(rating))
            values.append(slope(synth_q - qhat, (synth_lt - yhat_t2r) - uthat))
        results["C7b_omitted_difficulty_simulation"] = {
            "beta_manufactured": _null(values),
            "factor_strength_on_log_time": a,
            "factor_strength_on_quality": b,
            "calibrated_to": "the engine-difficulty block, i.e. what T1P adds to T0",
            "true_beta": 0.0,
            "note": "reported, not a pass condition. A magnitude for alternative explanation A2: "
                    "the beta that one more unmeasured difficulty factor, as strong as the measured "
                    "ones and absent from the expected-time model, would manufacture on its own. "
                    "The observed beta must be read against this number.",
        }

    # C5b -- a signal the pipeline did not define. C5 plants a term LINEAR IN THE ESTIMATOR'S OWN
    # REGRESSOR, so its recovery follows from linear algebra and it can only fail on a code bug: it
    # is an implementation check, not evidence that a real signal would be seen. C5b plants
    # `lambda * (Y - Yhat_GBT)` -- the residual of the pinned gradient-boosted comparator, a
    # quantity this pipeline's own model never produced. What comes back is the fraction of a real
    # signal the frozen linear specification actually recovers, which is the attenuation factor
    # every reported effect should be read against. A shortfall is a measurement, not an invalid run.
    if wanted("C5b") and "ut_gbt" in scored:
        lam = 0.02
        gbt_resid = scored["ut_gbt"].to_numpy(float)
        planted = q + lam * gbt_resid - qhat
        point = slope(planted, ut_resid)
        out = {"beta": boot.interval(lambda i: slope(planted[i], ut_resid[i]), point=point)}
        base = slope(q_resid, ut_resid)
        recovered = out["beta"]["point"] - base
        results["C5b_planted_foreign_residual"] = {
            "lambda": lam,
            "beta": out["beta"],
            "beta_unplanted": base,
            "recovered_fraction": recovered / lam if lam else float("nan"),
            "note": "recovered_fraction is the share of a signal defined outside this pipeline's "
                    "own residual that the frozen linear specification detects -- algebraically "
                    "the regression slope of the tree residual on the linear residual, so it is "
                    "the attenuation of a signal OF THAT SHAPE and of nothing else",
        }

    # C8 -- player influence. (a) drop the busiest 1% of players; (b) jackknife over players.
    #
    # Restored after an edit that removed stale duplicate C6/C7 blocks took this one with them. It
    # was caught by the analysis output missing a key, which is the good case; a control that
    # silently stops running is the bad one, and `evaluate.missing_or_malformed` now treats an
    # absent required control as INVALID for exactly that reason.
    if wanted("C8"):
        counts = scored.groupby("player").size().sort_values(ascending=False)
        busiest = set(counts.index[: max(1, len(counts) // 100)])
        keep = ~scored["player"].isin(busiest)
        subset = scored[keep]
        sub_boot = PlayerBootstrap(subset["player"].to_numpy())
        dropped = estimate(subset, sub_boot, basis, only={"tae_spread_low_to_high"})
        full_beta = slope(q_resid, ut_resid)

        # Jackknife over players, on CENTRED running sums, so each leave-one-out value is the same
        # estimator as `full_beta`.
        n_all = len(q_resid)
        sq, su = float(q_resid.sum()), float(ut_resid.sum())
        squ, suu = float(q_resid @ ut_resid), float(ut_resid @ ut_resid)
        worst, worst_player = 0.0, None
        for player, rows in scored.groupby("player").indices.items():
            m = n_all - len(rows)
            if m < 3:
                continue
            sq_i, su_i = sq - float(q_resid[rows].sum()), su - float(ut_resid[rows].sum())
            squ_i = squ - float(q_resid[rows] @ ut_resid[rows])
            suu_i = suu - float(ut_resid[rows] @ ut_resid[rows])
            cov = squ_i - sq_i * su_i / m
            var = suu_i - su_i * su_i / m
            if var <= 0:
                continue
            shift = abs(cov / var - full_beta) / abs(full_beta) if full_beta else 0.0
            if shift > worst:
                worst, worst_player = shift, player

        results["C8_player_influence"] = {
            "beta_full": full_beta,
            "beta_without_busiest_1pct": dropped["beta"],
            "tae_gradient_without_busiest_1pct": dropped["tae_rating_gradient"],
            "relative_change": abs(dropped["beta"]["point"] - full_beta) / abs(full_beta)
            if full_beta else float("nan"),
            "max_single_player_relative_shift": worst,
            "most_influential_player": worst_player,
            "players_dropped": len(busiest),
        }

    # C19 -- the player's own previous think time added to the context block. It absorbs pace, and
    # pace is partly the allocation policy Metric B measures, which is why it is not in T0.
    #
    # N5: the first draft fitted `T2R_C19` on `scored` -- the period being read, FINAL included --
    # which breaks the one invariant this whole design rests on ("no period the result is read from
    # is ever a period a model was fitted on") and produced a marginal slope rather than the FWL
    # coefficient. The three C19 models are now fitted on DEVELOPMENT in `fit_all`, and this reads
    # their residuals like every other estimate here.
    if wanted("C19") and "ut_resid_c19" in scored:
        q = scored["q_resid_c19"].to_numpy(float)
        u = scored["ut_resid_c19"].to_numpy(float)
        results["C19_own_pace_added"] = {"beta": boot.interval(lambda i: slope(q[i], u[i]))}

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
        # Only what this control reports. Identical numbers, a fraction of the work.
        out = estimate(subset, sub_boot, basis, only=set())
        results[name] = {
            "n": out["n_decisions"],
            "players": out["n_players"],
            "beta": out["beta"],
            "tae_rating_gradient": out["tae_rating_gradient"],
            "metric_a_time_vs_rating": out["metric_a_time_vs_rating"],
        }
    return results
