"""Exact-frame runner for the R** provenance probe.

R** v1.8 was discovered/judged with chronological split first and `speed == blitz` second.
This wrapper reuses every reconstruction/model helper from rstarstar_provenance.py but reproduces
that frame exactly before reading the result. It exists separately so the first, broader diagnostic
run remains auditable rather than being silently overwritten.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

import rstarstar_provenance as m


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--owner", required=True)
    p.add_argument("--population", required=True)
    p.add_argument("--owner-scored", required=True)
    p.add_argument("--population-scored", required=True)
    p.add_argument("--out", required=True)
    return p.parse_args()


def main():
    a = args()
    design = m.vocab.DESIGN

    # Match run_discovery.py + pop_runs.sh exactly: split ALL eligible owner decisions first,
    # then restrict the already-assigned split to blitz. Population reference is unchanged.
    owner_all = m.chronological_split(
        m.eligible(m.load_decisions(a.owner)), design["derive_frac"], design["validate_frac"]
    )
    owner = owner_all[(owner_all["split"] == "VALIDATE") & (owner_all["speed"] == "blitz")].reset_index(drop=True)
    pop = m.eligible(m.load_decisions(a.population, corpus=None))
    pop = pop[pop["corpus"] != "erez281"].reset_index(drop=True)

    pop_probe = m.reconstruct(a.population_scored, set(zip(pop.game_id.astype(str), pop.ply.astype(int))))
    owner_probe = m.reconstruct(a.owner_scored, set(zip(owner.game_id.astype(str), owner.ply.astype(int))))
    pop = m.add_probe(pop, pop_probe)
    owner = m.add_probe(owner, owner_probe)

    pop_agree = float((pop.current_overloaded_n_rebuilt == pop.own_overloaded_piece_count).mean())
    owner_agree = float((owner.current_overloaded_n_rebuilt == owner.own_overloaded_piece_count).mean())
    if pop_agree < 0.999 or owner_agree < 0.999:
        raise RuntimeError(f"overload rebuild mismatch: population={pop_agree:.6f}, owner={owner_agree:.6f}")

    base_model, base_auc, base_cols = m.fit_population_model(pop, m.TARGET, seed=m.SEED)
    aug_model, aug_auc, aug_cols = m.fit_augmented_population(pop, m.TARGET)
    owner = owner.copy()
    owner["base_hat"] = m.predict(base_model, base_cols, owner)
    owner["base_resid"] = owner[m.TARGET] - owner["base_hat"]
    owner["aug_hat"] = m.predict(aug_model, aug_cols, owner)
    owner["aug_resid"] = owner[m.TARGET] - owner["aug_hat"]

    rmask_owner = m.rstarstar_mask(owner)
    rmask_pop = m.rstarstar_mask(pop)
    ro = owner[rmask_owner].copy()
    rp = pop[rmask_pop].copy()

    base_wg = m.within_game_contrast(owner, rmask_owner, "base_resid")
    aug_wg = m.within_game_contrast(owner, rmask_owner, "aug_resid")
    reduction = None
    if np.isfinite(base_wg["est"]) and abs(base_wg["est"]) > 1e-12 and np.isfinite(aug_wg["est"]):
        reduction = float(1 - aug_wg["est"] / base_wg["est"])

    contributions = {}
    for name, d in ro.groupby("provenance_profile"):
        contributions[str(name)] = {
            "n": int(len(d)),
            "aug_resid_sum_per_rstarstar_decision": float(d["aug_resid"].sum() / len(ro)),
            "base_resid_sum_per_rstarstar_decision": float(d["base_resid"].sum() / len(ro)),
        }

    captured = ro.loc[ro[m.TARGET] == 1, "reply_captured_provenance"].dropna().value_counts().to_dict()

    out = {
        "status": "EXECUTED_RETROSPECTIVE_MECHANISM_DECOMPOSITION_BLITZ_EXACT_FRAME",
        "claim_boundary": {
            "permits": "pre-move liability provenance and post-move action signatures",
            "forbids": ["attention failure", "tunnel vision", "calculation depth", "rush", "causal intervention effect"],
        },
        "design": {
            "target": m.TARGET,
            "owner_frame": "chronological split on all eligible decisions, then VALIDATE + blitz only (exact v1.8 frame)",
            "region": m.RSTARSTAR,
            "population_model": "same HistGradientBoosting family and features as v1.8",
            "challenger": "add pre-move provenance_profile only",
            "seed": m.SEED,
        },
        "integrity": {
            "population_decisions": int(len(pop)),
            "owner_validate_blitz_decisions": int(len(owner)),
            "overload_rebuild_agreement_population": pop_agree,
            "overload_rebuild_agreement_owner": owner_agree,
            "base_population_cv_auc": float(base_auc),
            "augmented_population_cv_auc": float(aug_auc),
            "expected_original_rstarstar_n": 1199,
            "expected_original_resid_wg_est": 0.06144158192483223,
        },
        "rstarstar": {
            "owner_n": int(len(ro)),
            "population_n": int(len(rp)),
            "owner_hung_material_rate": float(ro[m.TARGET].mean()),
            "population_hung_material_rate": float(rp[m.TARGET].mean()),
            "base_population_residual_within_game": base_wg,
            "augmented_population_residual_within_game": aug_wg,
            "provenance_explained_fraction_of_base_contrast": reduction,
        },
        "owner_profiles": m.profile_summary(ro, ["base_resid", "aug_resid"]),
        "population_profiles": m.profile_summary(rp, []),
        "owner_action_signature_by_outcome": m.action_by_outcome(ro),
        "owner_hung_material_engine_reply_captured_provenance": captured,
        "owner_augmented_residual_contribution": contributions,
    }

    # Refuse interpretation if the original frame was not reproduced.
    n_ok = int(len(ro)) == out["integrity"]["expected_original_rstarstar_n"]
    est_ok = abs(float(base_wg["est"]) - out["integrity"]["expected_original_resid_wg_est"]) < 0.002
    out["integrity"]["original_frame_reproduced"] = bool(n_ok and est_ok)
    if not out["integrity"]["original_frame_reproduced"]:
        raise RuntimeError(
            f"R** frame failed reproduction: n={len(ro)} expected=1199; resid={base_wg['est']:.6f} expected≈0.061442"
        )

    Path(a.out).write_text(json.dumps(out, indent=2, default=float) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=2, default=float))


if __name__ == "__main__":
    main()
