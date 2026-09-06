"""Post-hoc explanatory follow-up earned by the exact-frame provenance run.

The provenance run found that the owner's personal R** excess is concentrated in PERSISTENT
liabilities, while provenance as a generic population feature explains little of the overall R**
residual. This file asks the next, narrower descriptive question:

  Is the owner's excess on persistent liabilities concentrated when the CURRENT move leaves that
  already-persistent liability unresolved?

`current_move_unresolved` is post-move and therefore an action signature, never a pre-move trigger.
This is not a new independent validation pass and no new threshold is promoted from it.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

import rstarstar_provenance as m


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--owner", required=True)
    p.add_argument("--population", required=True)
    p.add_argument("--owner-scored", required=True)
    p.add_argument("--population-scored", required=True)
    p.add_argument("--out", required=True)
    return p.parse_args()


def rate(d: pd.DataFrame, col: str) -> float | None:
    return float(d[col].mean()) if len(d) else None


def cell(d: pd.DataFrame, residual: str | None = None) -> dict:
    out = {
        "n": int(len(d)),
        "games": int(d.game_id.nunique()) if len(d) else 0,
        "hung_material_rate": rate(d, m.TARGET),
        "tactical_rate": rate(d, "cls_tactical"),
        "forcing_move_rate": float(((d.played_capture_probe.fillna(0) == 1) | (d.played_check_probe.fillna(0) == 1)).mean()) if len(d) else None,
        "seconds_median": float(d.seconds.median()) if len(d) else None,
        "clock_frac_median": float(d.clock_frac.median()) if len(d) else None,
    }
    if residual is not None and len(d):
        out["population_model_residual"] = m.mean_clustered(d, residual)
    return out


def diff(a: float | None, b: float | None) -> float | None:
    return None if a is None or b is None else float(a - b)


def main():
    a = args()
    design = m.vocab.DESIGN
    owner_all = m.chronological_split(m.eligible(m.load_decisions(a.owner)), design["derive_frac"], design["validate_frac"])
    owner = owner_all[(owner_all.split == "VALIDATE") & (owner_all.speed == "blitz")].reset_index(drop=True)
    pop = m.eligible(m.load_decisions(a.population, corpus=None))
    pop = pop[pop.corpus != "erez281"].reset_index(drop=True)

    owner = m.add_probe(owner, m.reconstruct(a.owner_scored, set(zip(owner.game_id.astype(str), owner.ply.astype(int)))))
    pop = m.add_probe(pop, m.reconstruct(a.population_scored, set(zip(pop.game_id.astype(str), pop.ply.astype(int)))))
    if float((owner.current_overloaded_n_rebuilt == owner.own_overloaded_piece_count).mean()) != 1.0:
        raise RuntimeError("owner overload reconstruction mismatch")
    if float((pop.current_overloaded_n_rebuilt == pop.own_overloaded_piece_count).mean()) != 1.0:
        raise RuntimeError("population overload reconstruction mismatch")

    model, auc, cols = m.fit_population_model(pop, m.TARGET, seed=m.SEED)
    owner = owner.copy()
    owner["pop_hat"] = m.predict(model, cols, owner)
    owner["pop_resid"] = owner[m.TARGET] - owner.pop_hat

    ro = owner[m.rstarstar_mask(owner)].copy()
    rp = pop[m.rstarstar_mask(pop)].copy()
    if len(ro) != 1199:
        raise RuntimeError(f"exact R** frame not reproduced: {len(ro)}")

    ro["persistent"] = ro.provenance_profile.eq("PERSISTENT")
    rp["persistent"] = rp.provenance_profile.eq("PERSISTENT")
    ro["unresolved"] = ro.current_move_unresolved.eq(1)
    rp["unresolved"] = rp.current_move_unresolved.eq(1)

    owner_cells = {}
    pop_cells = {}
    for pflag, plabel in [(False, "NON_PERSISTENT"), (True, "PERSISTENT")]:
        for uflag, ulabel in [(False, "RESOLVED_CURRENT_MOVE"), (True, "UNRESOLVED_CURRENT_MOVE")]:
            key = f"{plabel}__{ulabel}"
            owner_cells[key] = cell(ro[(ro.persistent == pflag) & (ro.unresolved == uflag)], "pop_resid")
            pop_cells[key] = cell(rp[(rp.persistent == pflag) & (rp.unresolved == uflag)])

    owner_p = ro[ro.persistent]
    owner_np = ro[~ro.persistent]
    pop_p = rp[rp.persistent]
    pop_np = rp[~rp.persistent]
    owner_persistence_penalty = rate(owner_p, m.TARGET) - rate(owner_np, m.TARGET)
    pop_persistence_penalty = rate(pop_p, m.TARGET) - rate(pop_np, m.TARGET)

    # Within persistent liabilities, does leaving the liability unresolved carry a different penalty
    # for the owner than for the level population?
    op_u = owner_p[owner_p.unresolved]
    op_r = owner_p[~owner_p.unresolved]
    pp_u = pop_p[pop_p.unresolved]
    pp_r = pop_p[~pop_p.unresolved]
    owner_unresolved_penalty = rate(op_u, m.TARGET) - rate(op_r, m.TARGET)
    pop_unresolved_penalty = rate(pp_u, m.TARGET) - rate(pp_r, m.TARGET)

    out = {
        "status": "POST_HOC_EXPLANATORY_FOLLOWUP_NOT_INDEPENDENT_VALIDATION",
        "frame": "R** exact v1.8 VALIDATE blitz-only",
        "target": m.TARGET,
        "population_model_cv_auc": float(auc),
        "integrity": {"owner_rstarstar_n": int(len(ro)), "population_rstarstar_n": int(len(rp))},
        "owner_cells": owner_cells,
        "population_cells": pop_cells,
        "contrasts": {
            "owner_persistence_penalty": float(owner_persistence_penalty),
            "population_persistence_penalty": float(pop_persistence_penalty),
            "persistence_penalty_difference_in_differences": float(owner_persistence_penalty - pop_persistence_penalty),
            "owner_unresolved_penalty_within_persistent": float(owner_unresolved_penalty),
            "population_unresolved_penalty_within_persistent": float(pop_unresolved_penalty),
            "unresolved_penalty_difference_in_differences_within_persistent": float(owner_unresolved_penalty - pop_unresolved_penalty),
        },
        "boundary": "Supports an observable repeated-non-resolution mechanism only if the interaction survives; cannot name attention, perception, calculation depth, or motivation.",
    }
    Path(a.out).write_text(json.dumps(out, indent=2, default=float) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=2, default=float))


if __name__ == "__main__":
    main()
