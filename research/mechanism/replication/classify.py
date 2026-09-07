"""
PHASE 13 -- THE OUTPUT CLASSES, decided by a rule frozen before any new player is run.

Four terminal classes, and the rule that picks between them:

    INSUFFICIENT_EVIDENCE          the frozen statistics are undefined on this corpus, or no
                                   population baseline covers this player's band
    NO_STABLE_STRUCTURE            the frozen OBS residual search returns no region that passes
                                   the VALIDATE judge on the union tactical class
    LEVEL_TYPICAL_ONLY             a region passes, and the population-baseline search returns none
    PERSONAL_RESIDUAL_CANDIDATE    a region survives the population baseline on held-out games

The rule uses ONLY the judge that was already frozen (`analysis/run_discovery.py`: residual
within-game z >= DESIGN.k, n_in >= DESIGN.min_n_validate, raw within-game contrast > 0). It adds no
threshold of its own. Stability, invariance, the TEST read and the engine-artifact control are
reported as evidence attached to the class, exactly as the baseline reported them for R* and R**;
they do not silently promote or demote a class.

Applied to erez281 the rule returns PERSONAL_RESIDUAL_CANDIDATE, which is what the mission ledger
concluded: R* passes the judge (level-typical against the population), and R** passes the
population-baseline judge on VALIDATE.

C is never forced. LEVEL_TYPICAL_ONLY and NO_STABLE_STRUCTURE are ordinary results.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "analysis"))
import contract


def passing(discovery) -> list[dict]:
    """The frozen candidates that passed the VALIDATE judge, best DERIVE quality first.

    Accepts one discovery run or several. Design v1.8 ran the population-baseline search over more
    than one class target, so the residual stage is a list; quality is not comparable across targets
    with different base rates, so each candidate keeps the target it was found on and the order
    inside a target is by DERIVE quality (the frozen final-candidate rule).
    """
    runs = [] if discovery is None else (discovery if isinstance(discovery, list) else [discovery])
    out = []
    for run in runs:
        if not run:
            continue
        target = run.get("target")
        for f in run.get("frozen", []):
            if (f.get("validate") or {}).get("pass"):
                out.append({**f, "target": f.get("target", target)})
    return sorted(out, key=lambda f: -float(f.get("quality") or 0.0))


def corpus_sufficient(counts: dict) -> tuple[bool, list[str]]:
    """MIN_CORPUS: the points below which the frozen statistics are undefined. Not evidence thresholds."""
    m = contract.MIN_CORPUS
    missing = []
    for split, dec_key, game_key in (("DERIVE", "derive_decisions", "derive_games"),
                                     ("VALIDATE", "validate_decisions", "validate_games"),
                                     ("TEST", "test_decisions", "test_games")):
        have_d = counts.get(f"{split}_decisions", 0)
        have_g = counts.get(f"{split}_games", 0)
        if have_d < m[dec_key]:
            missing.append(f"{split}: {have_d} eligible decisions, the frozen design needs {m[dec_key]}")
        if have_g < m[game_key]:
            missing.append(f"{split}: {have_g} games, the frozen design needs {m[game_key]}")
    return (not missing), missing


def classify(*, counts: dict, blitz_counts: dict | None, population: dict,
             discovery_broad: dict | None, discovery_residual: dict | None) -> dict:
    """The frozen decision rule. Returns the class, the reason, and the evidence it rests on."""
    ok, missing = corpus_sufficient(counts)
    if not ok:
        return {"output_class": "INSUFFICIENT_EVIDENCE", "failure_code": "INSUFFICIENT_CORPUS",
                "reason": "the corpus is below the point at which the frozen judge is defined",
                "missing": missing, "required": contract.MIN_CORPUS}

    broad = passing(discovery_broad)
    if not broad:
        return {"output_class": "NO_STABLE_STRUCTURE", "failure_code": None,
                "reason": ("no region of the frozen OBS vocabulary passes the VALIDATE judge "
                           f"(residual within-game z >= {_k()}, n_in >= {_min_n()}, raw within-game > 0) "
                           f"on the union class {contract.BROAD_TARGET}"),
                "broad_candidates_examined": _n_frozen(discovery_broad)}

    if population.get("status") != "OK":
        return {"output_class": "INSUFFICIENT_EVIDENCE",
                "failure_code": "POPULATION_BASELINE_INSUFFICIENT",
                "reason": population.get("reason"),
                "band": population.get("band"),
                "broad_structure": broad[0],
                "note": ("a region was found and held up on games never used to find it. Without a "
                         "same-rating population there is no way to say whether it is this player's "
                         "or the level's, so no personal claim is made.")}

    if blitz_counts is not None:
        ok_b, missing_b = corpus_sufficient(blitz_counts)
        if not ok_b:
            return {"output_class": "INSUFFICIENT_EVIDENCE",
                    "failure_code": "POPULATION_BASELINE_INSUFFICIENT",
                    "reason": ("the population corpus is blitz-only, and this player's blitz frame is "
                               "below the point at which the frozen judge is defined"),
                    "missing": missing_b, "broad_structure": broad[0]}

    residual = passing(discovery_residual)
    if not residual:
        return {"output_class": "LEVEL_TYPICAL_ONLY", "failure_code": None,
                "reason": ("the region holds up on held-out games, and under a model of same-rating "
                           "players no region of the same frozen vocabulary passes the judge: what "
                           "was found is the structure of the band, not of the player"),
                "broad_structure": broad[0],
                "residual_targets_examined": _targets(discovery_residual),
                "residual_candidates_examined": _n_frozen(discovery_residual)}

    return {"output_class": "PERSONAL_RESIDUAL_CANDIDATE", "failure_code": None,
            "reason": ("a region survives a same-rating population model on games never used to find "
                       "it. Candidate only: not a cause, not an intervention, not a field result"),
            "broad_structure": broad[0], "personal_residual": residual[0],
            "all_passing_residual": residual}


def _runs(d):
    return [] if d is None else (d if isinstance(d, list) else [d])


def _n_frozen(d):
    return sum(len((r or {}).get("frozen", [])) for r in _runs(d))


def _targets(d):
    return [r.get("target") for r in _runs(d) if r]


def _k():
    import vocab
    return vocab.DESIGN["k"]


def _min_n():
    import vocab
    return vocab.DESIGN["min_n_validate"]


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True, help="JSON with counts / blitz_counts / population / discovery_*")
    a = ap.parse_args()
    st = json.load(open(a.state))
    print(json.dumps(classify(counts=st["counts"], blitz_counts=st.get("blitz_counts"),
                              population=st["population"],
                              discovery_broad=st.get("discovery_broad"),
                              discovery_residual=st.get("discovery_residual")), indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
