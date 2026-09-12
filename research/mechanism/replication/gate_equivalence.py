"""
GATE-GENERIC-PIPELINE-EQUIVALENCE  (Phase 14 + the equivalence gate)

Two questions, and the gate answers both or it is not a gate:

  1. EQUIVALENCE. Does the generic pipeline, given `platform=lichess username=erez281`, reproduce
     the original pipeline's outputs on erez281 inside the tolerances declared BEFORE the check?
  2. DISCRIMINATION. If the old hard-code is put back, does the gate turn RED? A green that has
     never been shown red is not evidence. `--positive-control <name>` re-injects one specific
     piece of the removed hard-code and the gate then REQUIRES the corresponding check to fail.

Run:
    python gate_equivalence.py                       # the gate
    python gate_equivalence.py --positive-controls   # every control, each of which must go red
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(os.path.dirname(MECH))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(MECH, "analysis"))
sys.path.insert(0, os.path.join(MECH, "pipeline"))

import contract  # noqa: E402

DATA = os.path.join(MECH, "data")
OWNER_PARQUET = os.path.join(DATA, "decisions_erez281.parquet")
POP_PARQUET = os.path.join(DATA, "decisions_population_2026-06.parquet")

# --------------------------------------------------------------------------------------------------
# TOLERANCES, declared before the comparison is run.
#
# Counts, memberships, region strings and pass/fail verdicts are compared EXACTLY: they are the
# research content. Floating-point statistics are compared at 1e-9 relative, which is numerical
# noise, not agreement slack -- the generic pipeline runs the same code on the same rows, so
# anything larger is a real difference and the gate should say so.
# --------------------------------------------------------------------------------------------------
FLOAT_TOL = 1e-9


class Check:
    def __init__(self, name: str, kind: str):
        self.name, self.kind = name, kind
        self.rows: list[dict] = []
        self.ok = True

    def cmp(self, artifact: str, old, new, exact: bool = True, tol: float = FLOAT_TOL):
        if old is None and new is None:
            result, mode = True, "both absent"
        elif exact:
            result, mode = (old == new), "exact"
        else:
            try:
                result = abs(float(old) - float(new)) <= tol * max(1.0, abs(float(old)))
            except (TypeError, ValueError):
                result = False
            mode = f"rel<={tol:g}"
        self.ok &= result
        self.rows.append({"artifact": artifact, "old": old, "new": new,
                          "tolerance": mode, "result": "PASS" if result else "FAIL"})
        return result

    def to_dict(self) -> dict:
        return {"check": self.name, "kind": self.kind, "result": "PASS" if self.ok else "FAIL",
                "rows": self.rows}


# --------------------------------------------------------------------------------------------------
# controls: each re-injects one piece of the removed hard-code
# --------------------------------------------------------------------------------------------------
CONTROLS = {
    "focal_color_is_erez281": "score_games.resolve_focal decides the focal side by comparing the "
                              "white player's id to the literal \"erez281\"",
    "load_decisions_default_erez281": "common.load_decisions defaults to corpus=\"erez281\"",
    "population_excludes_only_erez281": "the population guard is `corpus != \"erez281\"`",
    "population_band_is_1450_1850": "the population band is the constant (1450, 1850)",
    "classifier_ranks_across_targets": "classify.passing ranks every passing candidate by DERIVE "
                                       "quality ACROSS targets, a quantity the mission says is not "
                                       "comparable between targets with different base rates",
}


def _install_control(name: str):
    """Put one removed hard-code back, and return an undo callable."""
    if name == "focal_color_is_erez281":
        import score_games
        orig = score_games.resolve_focal

        def legacy(g, focal_player_id=None):
            players = g.get("players") or {}
            wid = ((players.get("white") or {}).get("user") or {}).get("id")
            c = "w" if wid == "erez281" else "b"
            return c, (list(g.get("focal_colors")) if g.get("focal_colors") else [c])
        score_games.resolve_focal = legacy
        return lambda: setattr(score_games, "resolve_focal", orig)

    if name == "load_decisions_default_erez281":
        import common
        orig = common.load_decisions

        def legacy(path, corpus="erez281"):
            return orig(path, corpus=corpus)
        common.load_decisions = legacy
        return lambda: setattr(common, "load_decisions", orig)

    if name == "population_excludes_only_erez281":
        import focal as focalmod
        orig = focalmod.exclude_focal

        def legacy(pop, focal_corpus=None, focal_keys=None):
            return pop[pop["corpus"] != "erez281"] if "corpus" in pop.columns else pop
        focalmod.exclude_focal = legacy
        return lambda: setattr(focalmod, "exclude_focal", orig)

    if name == "classifier_ranks_across_targets":
        import classify
        orig = classify.passing

        def legacy(discovery):
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
        classify.passing = legacy
        return lambda: setattr(classify, "passing", orig)

    if name == "population_band_is_1450_1850":
        orig = contract.population_band
        contract.population_band = lambda r: (1450, 1850)
        return lambda: setattr(contract, "population_band", orig)

    raise KeyError(name)


# --------------------------------------------------------------------------------------------------
# checks
# --------------------------------------------------------------------------------------------------
def check_corpus(generic: dict) -> Check:
    """Eligible games and decisions, split membership: the research population itself."""
    import common
    from common import eligible, chronological_split
    c = Check("corpus_and_splits", "EQUIVALENCE")
    baseline = json.load(open(os.path.join(HERE, "BASELINE_EREZ281.json")))
    df = chronological_split(eligible(common.load_decisions(generic["decisions_parquet"])),
                             contract.SPLIT["derive_frac"], contract.SPLIT["validate_frac"])
    b = baseline["corpus"]
    c.cmp("scored decision rows", b["scored_decisions"],
          int(len(common.load_decisions(generic["decisions_parquet"]))))
    c.cmp("eligible decisions", b["eligible_decisions"], int(len(df)))
    c.cmp("eligible games", b["scored_games"], int(df.game_id.nunique()))
    for split in ("DERIVE", "VALIDATE", "TEST"):
        s = df[df.split == split]
        c.cmp(f"{split} decisions", baseline["splits"][split]["decisions"], int(len(s)))
        c.cmp(f"{split} games", baseline["splits"][split]["games"], int(s.game_id.nunique()))
    c.cmp("DERIVE first game id", baseline["splits"]["DERIVE"]["first_game_id"],
          str(df[df.split == "DERIVE"].sort_values("game_order").game_id.iloc[0]))
    c.cmp("TEST last game id", baseline["splits"]["TEST"]["last_game_id"],
          str(df[df.split == "TEST"].sort_values("game_order").game_id.iloc[-1]))
    return c


def check_features(generic: dict) -> Check:
    """Every feature column, every row, against the frozen decision table.

    `corpus` is the one column the generalisation deliberately changes: it used to be the literal
    "erez281" and is now the run's corpus label. It is therefore compared as an IDENTITY column --
    constant, and equal to what the run declared -- rather than against the baseline's value, and
    every other column is compared bitwise. Hiding it would be worse than saying which one moved.
    """
    import numpy as np
    import pandas as pd
    c = Check("feature_table", "EQUIVALENCE")
    old = pd.read_parquet(OWNER_PARQUET).sort_values(["game_id", "ply"]).reset_index(drop=True)
    new = pd.read_parquet(generic["decisions_parquet"]).sort_values(["game_id", "ply"]).reset_index(drop=True)
    c.cmp("rows", int(len(old)), int(len(new)))
    c.cmp("columns", list(old.columns), list(new.columns))
    identity = {"corpus"}
    if len(old) == len(new) and list(old.columns) == list(new.columns):
        differing = []
        for col in old.columns:
            if col in identity:
                continue
            a, b = old[col], new[col]
            if a.dtype.kind in "fc" or b.dtype.kind in "fc":
                same = np.allclose(a.astype(float).fillna(-9e18), b.astype(float).fillna(-9e18),
                                   rtol=0, atol=0)
            else:
                same = a.fillna("<NA>").astype(str).equals(b.fillna("<NA>").astype(str))
            if not same:
                differing.append(col)
        c.cmp("columns differing bitwise (identity columns excluded)", [], differing)
        labels = sorted(new["corpus"].dropna().unique())
        c.cmp("corpus label is constant", 1, len(labels))
        expected = generic.get("corpus_label")
        if expected:
            c.cmp("corpus label is the one the run declared", expected, labels[0] if labels else None)
        c.cmp("player_key is unchanged", sorted(old["player_key"].dropna().unique()),
              sorted(new["player_key"].dropna().unique()))
    return c


def check_rstar(generic: dict) -> Check:
    """R*: the frozen region, its DERIVE freeze, its VALIDATE judge, its stability."""
    c = Check("R_star_discovery", "EQUIVALENCE")
    old = json.load(open(os.path.join(MECH, "nodeB", "discovery_v17_cls_tactical.json")))
    path = generic.get("discovery_broad")
    if not path or not os.path.exists(path):
        c.cmp("generic R* run present", True, False)
        return c
    new = json.load(open(path))
    c.cmp("target", old["target"], new["target"])
    c.cmp("vocabulary", old["vocab"], new["vocab"])
    c.cmp("Node C depth", old["depth"], new["depth"])
    for d in sorted(old["cv_depth"]):
        c.cmp(f"CV mean z depth {d}", old["cv_depth"][d]["mean_z"], new["cv_depth"][d]["mean_z"],
              exact=False)
    c.cmp("frozen candidates", [f["region"] for f in old["frozen"]],
          [f["region"] for f in new["frozen"]])
    for fo, fn in zip(old["frozen"], new["frozen"]):
        tag = fo["region"]
        c.cmp(f"[{tag}] n_derive", fo["n_derive"], fn["n_derive"])
        c.cmp(f"[{tag}] DERIVE within-game", fo["derive_wg_est"], fn["derive_wg_est"], exact=False)
        c.cmp(f"[{tag}] stability share J>=0.60", fo["stability_share_j60"],
              fn["stability_share_j60"], exact=False)
        for k in ("n_in", "p_in", "p_out", "wg_est", "wg_z", "resid_wg_z"):
            c.cmp(f"[{tag}] VALIDATE {k}", fo["validate"][k], fn["validate"][k],
                  exact=(k == "n_in"))
        c.cmp(f"[{tag}] VALIDATE pass", fo["validate"]["pass"], fn["validate"]["pass"])
    return c


def check_rstarstar(generic: dict) -> Check:
    """R**: the population-baseline search, its region, its judge, the population model's AUC."""
    c = Check("R_star_star_population_residual", "EQUIVALENCE")
    old = json.load(open(os.path.join(MECH, "nodeB", "discovery_POP_cls_hung_material.json")))
    path = generic.get("discovery_residual")
    if not path or not os.path.exists(path):
        c.cmp("generic R** run present", True, False)
        return c
    new = json.load(open(path))
    c.cmp("target", old["target"], new["target"])
    c.cmp("Node C depth", old["depth"], new["depth"])
    c.cmp("population model holdout AUC", old["design"].get("_pop_auc"),
          new["design"].get("_pop_auc"), exact=False, tol=1e-6)
    c.cmp("frozen candidates", [f["region"] for f in old["frozen"]],
          [f["region"] for f in new["frozen"]])
    for fo, fn in zip(old["frozen"], new["frozen"]):
        tag = fo["region"]
        c.cmp(f"[{tag}] n_derive", fo["n_derive"], fn["n_derive"])
        c.cmp(f"[{tag}] stability share J>=0.60", fo["stability_share_j60"],
              fn["stability_share_j60"], exact=False)
        for k in ("n_in", "p_in", "p_out", "wg_est", "wg_z", "resid_wg_z"):
            c.cmp(f"[{tag}] VALIDATE {k}", fo["validate"][k], fn["validate"][k],
                  exact=(k == "n_in"))
        c.cmp(f"[{tag}] VALIDATE pass", fo["validate"]["pass"], fn["validate"]["pass"])
    return c


def check_evidence_state(generic: dict) -> Check:
    """The final evidence state: the frozen classification rule, applied to the generic outputs."""
    import classify
    import common
    from common import eligible, chronological_split
    import populations
    c = Check("final_evidence_state", "EQUIVALENCE")
    baseline = json.load(open(os.path.join(HERE, "BASELINE_EREZ281.json")))
    df = chronological_split(eligible(common.load_decisions(generic["decisions_parquet"])),
                             contract.SPLIT["derive_frac"], contract.SPLIT["validate_frac"])
    counts, bcounts = {}, {}
    blitz = df[df.speed == "blitz"]
    for split in ("DERIVE", "VALIDATE", "TEST"):
        s = df[df.split == split]
        counts[f"{split}_decisions"], counts[f"{split}_games"] = int(len(s)), int(s.game_id.nunique())
        b = blitz[blitz.split == split]
        bcounts[f"{split}_decisions"], bcounts[f"{split}_games"] = int(len(b)), int(b.game_id.nunique())
    pop = populations.resolve(generic["decisions_parquet"])
    c.cmp("population band", baseline["population"]["band"], pop.get("band"))
    c.cmp("population corpus id", baseline["population"]["corpus_id"],
          (pop.get("population") or {}).get("id"))
    broad = json.load(open(generic["discovery_broad"])) if generic.get("discovery_broad") and os.path.exists(generic["discovery_broad"]) else None
    resid = json.load(open(generic["discovery_residual"])) if generic.get("discovery_residual") and os.path.exists(generic["discovery_residual"]) else None
    verdict = classify.classify(counts=counts, blitz_counts=bcounts, population=pop,
                                discovery_broad=broad, discovery_residual=resid)
    c.cmp("output class", baseline["final_evidence_state"]["output_class"], verdict["output_class"])
    c.cmp("R* region", baseline["r_star"]["region"],
          (verdict.get("broad_structure") or {}).get("region"))
    c.cmp("R** region", baseline["r_star_star"]["region"],
          (verdict.get("personal_residual") or {}).get("region"))
    return c


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def check_invariance(generic: dict) -> Check:
    """NODE G cross-context: the region's elevation stratum by stratum, and leave-one-context-out."""
    c = Check("invariance", "EQUIVALENCE")
    old = json.load(open(os.path.join(MECH, "nodeB", "invariance_tactical_validate.json")))
    path = generic.get("invariance")
    if not path or not os.path.exists(path):
        c.cmp("generic invariance run present", True, False)
        return c
    new = json.load(open(path))
    c.cmp("region", old["region"], new["region"])
    c.cmp("frame", old["frame"], new["frame"])
    for k in ("n_in", "n_out", "p_in", "p_out", "diff", "z"):
        c.cmp(f"overall {k}", old["overall"][k], new["overall"][k], exact=(k in ("n_in", "n_out")))
    c.cmp("strata rows", len(old["strata"]), len(new["strata"]))
    o_by = {(r["context"], r["stratum"]): r for r in old["strata"]}
    n_by = {(r["context"], r["stratum"]): r for r in new["strata"]}
    c.cmp("strata keys", sorted(o_by), sorted(n_by))
    judged = [k for k in sorted(o_by) if o_by[k].get("diff") is not None]
    c.cmp("strata judged", len(judged), len([k for k in sorted(n_by) if n_by[k].get("diff") is not None]))
    c.cmp("strata with a positive raw elevation",
          sum(1 for k in judged if _num(o_by[k]["diff"]) > 0),
          sum(1 for k in judged if _num(n_by[k]["diff"]) > 0))
    mism = [k for k in judged
            if o_by[k]["n_in"] != n_by[k]["n_in"]
            or abs(_num(o_by[k]["diff"]) - _num(n_by[k]["diff"])) > FLOAT_TOL * max(1.0, abs(_num(o_by[k]["diff"])))
            or abs(_num(o_by[k]["z"]) - _num(n_by[k]["z"])) > FLOAT_TOL * max(1.0, abs(_num(o_by[k]["z"])))]
    c.cmp("strata differing in n_in, diff or z", [], [f"{a}={b}" for a, b in mism])
    o_loo = {r["dropped"]: r for r in old["leave_one_out"]}
    n_loo = {r["dropped"]: r for r in new["leave_one_out"]}
    c.cmp("leave-one-context-out rows", sorted(o_loo), sorted(n_loo))
    loo_mism = [k for k in sorted(o_loo) if k in n_loo
                and (o_loo[k]["n_in"] != n_loo[k]["n_in"]
                     or abs(_num(o_loo[k]["z"]) - _num(n_loo[k]["z"])) > FLOAT_TOL * max(1.0, abs(_num(o_loo[k]["z"]))))]
    c.cmp("leave-one-out rows differing", [], loo_mism)
    return c


def check_holdout_test(generic: dict) -> Check:
    """NODE H: the TEST read, opened once. Region contrast, every model's held-out score, the
    baseline's calibration gap inside the region, and the within-game label-shuffle control."""
    c = Check("holdout_test", "EQUIVALENCE")
    old = json.load(open(os.path.join(MECH, "nodeB", "predict_tactical_test.json")))
    path = generic.get("holdout_test")
    if not path or not os.path.exists(path):
        c.cmp("generic TEST run present", True, False)
        return c
    new = json.load(open(path))
    c.cmp("region", old["region"], new["region"])
    c.cmp("fit_on", old["fit_on"], new["fit_on"])
    c.cmp("n_fit", old["n_fit"], new["n_fit"])
    c.cmp("frames", sorted(old["frames"]), sorted(new["frames"]))
    for frame in sorted(set(old["frames"]) & set(new["frames"])):
        o, n = old["frames"][frame], new["frames"][frame]
        c.cmp(f"[{frame}] n", o["n"], n["n"])
        c.cmp(f"[{frame}] games", o["games"], n["games"])
        for k in ("n_in", "p_in", "p_out", "z"):
            c.cmp(f"[{frame}] region {k}", o["region_contrast"][k], n["region_contrast"][k],
                  exact=(k == "n_in"))
        for k in ("gap_in", "gap_out", "diff", "z"):
            c.cmp(f"[{frame}] baseline gap {k}", o["baseline_gap_in_region"][k],
                  n["baseline_gap_in_region"][k], exact=False)
        for model in sorted(o["models"]):
            for metric in ("logloss", "auc"):
                c.cmp(f"[{frame}] {model} {metric}", o["models"][model][metric],
                      n["models"][model][metric], exact=False)
        c.cmp(f"[{frame}] region gain over baseline", o["region_logloss_gain_over_baseline"],
              n["region_logloss_gain_over_baseline"], exact=False)
        c.cmp(f"[{frame}] shuffled-label p", o["shuffled_gain_p"], n["shuffled_gain_p"], exact=False)
        c.cmp(f"[{frame}] max shuffled gain", o["shuffled_gain_max"], n["shuffled_gain_max"], exact=False)
    return c


def check_stability(generic: dict) -> Check:
    """NODE D: leave-one-context-out re-derivation, history windows and random halves."""
    c = Check("stability_loco", "EQUIVALENCE")
    old = json.load(open(os.path.join(MECH, "nodeB", "stability_loco_tactical.json")))
    path = generic.get("stability_loco")
    if not path or not os.path.exists(path):
        c.cmp("generic stability run present", True, False)
        return c
    new = json.load(open(path))
    c.cmp("region", old["region"], new["region"])
    c.cmp("target", old["target"], new["target"])
    c.cmp("depth", old["depth"], new["depth"])
    o_by = {r["variant"]: r for r in old["rows"]}
    n_by = {r["variant"]: r for r in new["rows"]}
    c.cmp("variants", sorted(o_by), sorted(n_by))
    c.cmp("re-derivations returning R* exactly (J = 1.00)",
          sum(1 for r in old["rows"] if r["jaccard"] >= 0.999),
          sum(1 for r in new["rows"] if r["jaccard"] >= 0.999))
    diff = [v for v in sorted(set(o_by) & set(n_by))
            if o_by[v]["winner"] != n_by[v]["winner"]
            or abs(o_by[v]["jaccard"] - n_by[v]["jaccard"]) > FLOAT_TOL
            or o_by[v]["n"] != n_by[v]["n"]]
    c.cmp("variants differing in winner, n or Jaccard", [], diff)
    return c


def check_population_comparison(generic: dict) -> Check:
    """NODE G PERSONAL: the region in the population, and the focal player's place in it.

    The generic file renames `erez281` -> `focal` and `erez_*` -> `focal_*` and adds the leakage
    guard's own record; the numbers underneath must be the same.
    """
    c = Check("population_comparison", "EQUIVALENCE")
    old = json.load(open(os.path.join(MECH, "nodeB", "population_tactical_validate.json")))
    path = generic.get("population")
    if not path or not os.path.exists(path):
        c.cmp("generic population comparison present", True, False)
        return c
    new = json.load(open(path))
    c.cmp("region", old["region"], new["region"])
    c.cmp("frame", old["frame"], new["frame"])
    for k in ("n", "games", "sides", "base_err"):
        c.cmp(f"population {k}", old["population"][k], new["population"][k], exact=(k != "base_err"))
    for k in ("n_in", "p_in", "p_out", "diff", "z"):
        c.cmp(f"population raw {k}", old["population"]["raw"][k], new["population"]["raw"][k],
              exact=(k == "n_in"))
    for k in ("resid_in", "resid_out", "diff", "z"):
        c.cmp(f"population residual {k}", old["population"]["resid"][k],
              new["population"]["resid"][k], exact=False)
    o_focal, n_focal = old["erez281"], new["focal"]
    c.cmp("focal n", o_focal["n"], n_focal["n"])
    for k in ("n_in", "p_in", "p_out", "diff", "z"):
        c.cmp(f"focal raw {k}", o_focal["raw"][k], n_focal["raw"][k], exact=(k == "n_in"))
    for k in ("resid_in", "resid_out", "diff", "z"):
        c.cmp(f"focal residual under the population baseline {k}",
              o_focal["resid_under_population_baseline"][k],
              n_focal["resid_under_population_baseline"][k], exact=False)
    op, np_ = old["per_side"], new["per_side"]
    c.cmp("per-side count", op["n_sides"], np_["n_sides"])
    c.cmp("per-side elevation mean", op["elev_mean"], np_["elev_mean"], exact=False)
    c.cmp("per-side elevation sd", op["elev_sd"], np_["elev_sd"], exact=False)
    c.cmp("focal elevation", op["erez_elev"], np_["focal_elev"], exact=False)
    c.cmp("focal percentile", op["erez_percentile"], np_["focal_percentile"], exact=False)
    c.cmp("focal raw elevation", op["erez_raw_elev"], np_["focal_raw_elev"], exact=False)
    c.cmp("focal raw percentile", op["erez_raw_percentile"], np_["focal_raw_percentile"], exact=False)
    # the guard is new, and it must show it actually ran
    guard = new.get("leakage_guard") or {}
    c.cmp("leakage guard removed the focal corpus from the population frame", 0,
          int(guard.get("focal_rows_removed", -1)))
    c.cmp("leakage guard names the focal corpus", True, bool(guard.get("focal_corpus")))
    return c


def _discovery_check(name: str, old_path: str, new_path: str | None, auc: bool) -> Check:
    c = Check(name, "EQUIVALENCE")
    old = json.load(open(old_path))
    if not new_path or not os.path.exists(new_path):
        c.cmp("generic run present", True, False)
        return c
    new = json.load(open(new_path))
    c.cmp("target", old["target"], new["target"])
    c.cmp("vocabulary", old["vocab"], new["vocab"])
    c.cmp("Node C depth", old["depth"], new["depth"])
    for d in sorted(old["cv_depth"]):
        c.cmp(f"CV mean z depth {d}", old["cv_depth"][d]["mean_z"], new["cv_depth"][d]["mean_z"],
              exact=False)
    if auc:
        c.cmp("population model holdout AUC", old["design"].get("_pop_auc"),
              new["design"].get("_pop_auc"), exact=False, tol=1e-6)
    c.cmp("frozen candidates", [f["region"] for f in old["frozen"]],
          [f["region"] for f in new["frozen"]])
    for fo, fn in zip(old["frozen"], new["frozen"]):
        tag = fo["region"]
        c.cmp(f"[{tag}] n_derive", fo["n_derive"], fn["n_derive"])
        c.cmp(f"[{tag}] DERIVE within-game", fo["derive_wg_est"], fn["derive_wg_est"], exact=False)
        c.cmp(f"[{tag}] stability share J>=0.60", fo["stability_share_j60"],
              fn["stability_share_j60"], exact=False)
        for k in ("n_in", "p_in", "p_out", "wg_est", "wg_z", "resid_wg_z"):
            c.cmp(f"[{tag}] VALIDATE {k}", fo["validate"][k], fn["validate"][k], exact=(k == "n_in"))
        c.cmp(f"[{tag}] VALIDATE pass", fo["validate"]["pass"], fn["validate"]["pass"])
    c.cmp("bootstrap winner table", old["bootstrap_winners"], new["bootstrap_winners"])
    return c


def check_rstarstar_second_target(generic: dict) -> Check:
    """Design v1.8 ran the population-baseline search over more than one class target. The second
    one is part of the frozen procedure and part of the equivalence claim."""
    return _discovery_check("R_star_star_second_target",
                            os.path.join(MECH, "nodeB", "discovery_POP_cls_tactical.json"),
                            generic.get("discovery_residual_secondary"), auc=True)


def check_classifier_verdict(generic: dict) -> Check:
    """The classifier's own output: the class, R*, R**, and the ORDER of every passing residual
    candidate. The ordering is the frozen target precedence, so it is part of the comparison."""
    import classify
    c = Check("classifier_verdict", "EQUIVALENCE")
    baseline = json.load(open(os.path.join(HERE, "BASELINE_EREZ281.json")))
    runs = [json.load(open(p)) for p in (generic.get("discovery_residual"),
                                         generic.get("discovery_residual_secondary"))
            if p and os.path.exists(p)]
    broad = json.load(open(generic["discovery_broad"])) if generic.get("discovery_broad") and os.path.exists(generic["discovery_broad"]) else None
    fat = {"DERIVE_decisions": 31851, "DERIVE_games": 1297, "VALIDATE_decisions": 10626,
           "VALIDATE_games": 432, "TEST_decisions": 10404, "TEST_games": 432}
    verdict = classify.classify(counts=fat, blitz_counts=fat, population={"status": "OK"},
                                discovery_broad=broad, discovery_residual=runs or None)
    c.cmp("output class", baseline["final_evidence_state"]["output_class"], verdict["output_class"])
    c.cmp("R* region", baseline["r_star"]["region"],
          (verdict.get("broad_structure") or {}).get("region"))
    c.cmp("R** region", baseline["r_star_star"]["region"],
          (verdict.get("personal_residual") or {}).get("region"))
    c.cmp("R** target", baseline["r_star_star"]["target"],
          (verdict.get("personal_residual") or {}).get("target"))
    order = [(x.get("target"), x["region"]) for x in verdict.get("all_passing_residual", [])]
    c.cmp("residual targets, in frozen precedence order",
          list(contract.RESIDUAL_TARGETS),
          list(dict.fromkeys(t for t, _ in order)))
    c.cmp("the highest-precedence passing candidate is R**",
          (contract.RESIDUAL_PRIMARY, baseline["r_star_star"]["region"]),
          order[0] if order else None)
    return c


def check_readiness_semantics() -> Check:
    """Readiness is about the DERIVED BAND being registered, not about the rating lying inside a
    registered band. The two come apart, and the pipeline must side with the derived band."""
    import readiness
    c = Check("readiness_semantics", "DISCRIMINATION")
    w = readiness.admissible_median_window((1450, 1850))
    c.cmp("integer medians that derive the registered band", [1626, 1674],
          [w["integer_median_min"], w["integer_median_max"]])
    # a rating INSIDE 1450-1850 whose derived band is NOT registered
    r1500 = readiness.evaluate(platform="lichess", blitz_median_rating=1500, counts=None,
                               blitz_counts=None, enumeration_available=True, gate_green=True)
    c.cmp("median 1500 derives", [1300, 1700], r1500["checks"]["derived_population_band"])
    c.cmp("median 1500 is inside the registered band 1450-1850", True, 1450 <= 1500 <= 1850)
    c.cmp("median 1500 is NOT ready", False, r1500["ready"])
    c.cmp("and the blocker names the population baseline", True,
          any(b.startswith("POPULATION_BASELINE_INSUFFICIENT") for b in r1500["blockers"]))
    # the focal player's own median, which does derive a registered band
    r1654 = readiness.evaluate(platform="lichess", blitz_median_rating=1654, counts=None,
                               blitz_counts=None, enumeration_available=True, gate_green=True)
    c.cmp("median 1654 derives", [1450, 1850], r1654["checks"]["derived_population_band"])
    c.cmp("median 1654 IS ready", True, r1654["ready"])
    # boundary: banker's rounding at exactly 1625
    c.cmp("median 1625 derives", [1400, 1800],
          list(contract.population_band(1625)))
    c.cmp("median 1625.5 derives", [1450, 1850], list(contract.population_band(1625.5)))
    # a missing gate or missing enumeration blocks readiness on its own
    c.cmp("a red gate blocks readiness", False,
          readiness.evaluate(platform="lichess", blitz_median_rating=1654, counts=None,
                             blitz_counts=None, enumeration_available=True, gate_green=False)["ready"])
    c.cmp("no enumeration blocks readiness", False,
          readiness.evaluate(platform="lichess", blitz_median_rating=1654, counts=None,
                             blitz_counts=None, enumeration_available=False, gate_green=True)["ready"])
    return c


def check_classifier_precedence() -> Check:
    """Does the classifier follow the frozen TARGET PRECEDENCE rather than a cross-target sort?

    On erez281's own data the two orderings coincide: the hung-material candidates happen to carry
    the highest DERIVE quality anyway, so his record cannot tell a precedence rule from a quality
    sort. This check therefore uses a fixture built to separate them -- a secondary-target candidate
    with a deliberately higher quality -- which is the only way the `classifier_ranks_across_targets`
    control can be shown to turn the gate red.
    """
    import classify
    c = Check("classifier_precedence", "DISCRIMINATION")
    ok = {"pass": True, "n_in": 500, "resid_wg_z": 5.0, "wg_est": 0.1}
    primary = {"target": contract.RESIDUAL_PRIMARY,
               "frozen": [{"region": "PRIMARY_LOW_QUALITY", "quality": 1.0, "validate": ok},
                          {"region": "PRIMARY_LOWER", "quality": 0.5, "validate": ok}]}
    secondary = {"target": contract.RESIDUAL_TARGETS[1],
                 "frozen": [{"region": "SECONDARY_HIGH_QUALITY", "quality": 99.0, "validate": ok}]}
    got = classify.passing([primary, secondary])
    c.cmp("a lower-quality primary-target candidate still comes first",
          (contract.RESIDUAL_PRIMARY, "PRIMARY_LOW_QUALITY"),
          (got[0].get("target"), got[0]["region"]) if got else None)
    c.cmp("target order is the frozen precedence, not the quality order",
          [contract.RESIDUAL_PRIMARY, contract.RESIDUAL_TARGETS[1]],
          list(dict.fromkeys(x.get("target") for x in got)))
    c.cmp("within one target, quality still orders the candidates",
          ["PRIMARY_LOW_QUALITY", "PRIMARY_LOWER"],
          [x["region"] for x in got if x.get("target") == contract.RESIDUAL_PRIMARY])
    c.cmp("every passing candidate is kept, none dropped", 3, len(got))
    return c


def check_generalisation() -> Check:
    """The generalisation itself: the same questions asked of a player who is not erez281.

    These are the checks the positive controls are aimed at. Each one fails if the corresponding
    hard-code is back.
    """
    import pandas as pd
    import common
    import focal as focalmod
    import score_games
    c = Check("generalisation", "DISCRIMINATION")

    # 1. focal side of a game neither of whose players is erez281
    game = {"id": "test0001", "players": {"white": {"user": {"id": "someuser"}},
                                          "black": {"user": {"id": "otheruser"}}}}
    col, cols = score_games.resolve_focal(game, "someuser")
    c.cmp("focal side of a non-erez281 white player", "w", col)
    col2, _ = score_games.resolve_focal(game, "otheruser")
    c.cmp("focal side of a non-erez281 black player", "b", col2)

    # 2. loading a decision table whose corpus label is not "erez281", WITHOUT naming the corpus.
    #    This is the call the old default silently answered with zero rows.
    pop_head = pd.read_parquet(POP_PARQUET)
    rows = len(common.load_decisions(POP_PARQUET))
    c.cmp("rows loaded for a non-erez281 corpus, corpus not named", int(len(pop_head)), int(rows))
    #    and a file holding more than one corpus must refuse to guess rather than pick one
    mixed_path = os.path.join(os.environ.get("REPLICATION_TMP", "/tmp"), "gate_mixed_corpus.parquet")
    m = pd.concat([pop_head.head(50), pop_head.head(50).assign(corpus="lichess:someuser")],
                  ignore_index=True)
    m.to_parquet(mixed_path, index=False)
    try:
        common.load_decisions(mixed_path)
        refused = False
    except ValueError:
        refused = True
    c.cmp("refuses to guess between two corpora in one file", True, refused)

    # 3. the population guard removes a focal player carrying some other corpus label
    fake = pop_head.head(200).copy()
    fake["corpus"] = "lichess:someuser"
    fake["player_key"] = "someuser"
    mixed = pd.concat([pop_head.head(200), fake], ignore_index=True)
    kept = focalmod.exclude_focal(mixed, "lichess:someuser", {"someuser"})
    c.cmp("focal rows left inside the population frame", 0,
          int((kept["player_key"] == "someuser").sum()))

    # 4. the band follows the player's rating instead of erez281's
    c.cmp("band for a 1654-rated player", [1450, 1850], list(contract.population_band(1654)))
    c.cmp("band for a 2010-rated player", [1800, 2200], list(contract.population_band(2010)))
    c.cmp("band for a 1180-rated player", [1000, 1400], list(contract.population_band(1180)))
    return c


def check_eligibility_rule() -> Check:
    """The transcription of `admissible()` and of the baseline's reason precedence.

    Verified upstream by re-fetching the frozen 2,209 ids and re-applying the rule: 2,209
    admissible, 2,161 scorable, 48 `non-standard-variant` (47 fromPosition + 1 atomic) — the exact
    frozen window. Here the mutations that the frozen tally counted are checked directly, because
    the frozen id list contains only games that PASSED and so cannot exercise the rejection paths.
    """
    import eligibility as elig
    c = Check("eligibility_rule", "DISCRIMINATION")
    clocks = " ".join(f"{i+1}. e4 {{ [%clk 0:03:0{i%10}] }}" for i in range(30))
    good = ('[Event "Rated Blitz game"]\n[Site "https://lichess.org/abcd1234"]\n[White "a"]\n'
            '[Black "b"]\n[Termination "Normal"]\n\n' + clocks + " 1-0\n")
    base = {"id": "abcd1234", "rated": True, "variant": "standard", "pgn": good}
    c.cmp("a clean game is admissible", None, elig.rejection_reason(base))
    c.cmp("no pgn", "no-pgn", elig.rejection_reason({**base, "pgn": None}))
    c.cmp("unrated", "unrated", elig.rejection_reason({**base, "rated": False}))
    c.cmp("time forfeit", "termination:Time forfeit",
          elig.rejection_reason({**base, "pgn": good.replace('"Normal"', '"Time forfeit"')}))
    c.cmp("abandoned", "termination:Abandoned",
          elig.rejection_reason({**base, "pgn": good.replace('"Normal"', '"Abandoned"')}))
    c.cmp("no clocks", "no-clocks", elig.rejection_reason({**base, "pgn": good.replace("%clk", "%emt")}))
    short = good.split("\n\n")[0] + "\n\n" + " ".join(
        f"{i+1}. e4 {{ [%clk 0:03:00] }}" for i in range(10)) + " 1-0\n"
    c.cmp("under 20 clocked plies", "under-20-plies", elig.rejection_reason({**base, "pgn": short}))
    # PRECEDENCE: a non-Normal termination is reported even when clocks are also missing, because
    # that is the order build_account_corpus.ts used to produce the frozen tally.
    both = good.replace('"Normal"', '"Time forfeit"').replace("%clk", "%emt")
    c.cmp("termination beats no-clocks (baseline precedence)", "termination:Time forfeit",
          elig.rejection_reason({**base, "pgn": both}))
    c.cmp("non-standard variant is scorable=False", False, elig.is_scorable({**base, "variant": "atomic"}))
    c.cmp("standard variant is scorable", True, elig.is_scorable(base))
    return c


def check_failure_modes() -> Check:
    """Every terminal state the contract promises must actually be reachable, and each must be
    reached by its own cause. A pipeline that can only return one answer is not answering."""
    import pandas as pd
    import classify
    import ingest_lichess
    import populations
    c = Check("failure_modes", "DISCRIMINATION")

    # USER_NOT_FOUND for an account lichess does not have
    try:
        ingest_lichess.verify_account("this-account-does-not-exist-9f3a2b71c4")
        code = "NO ERROR"
    except ingest_lichess.IngestError as e:
        code = e.code
    c.cmp("unknown account", "USER_NOT_FOUND", code)

    # INSUFFICIENT_CORPUS from a corpus below the frozen minimum, and NOT from one above it
    thin = {"DERIVE_decisions": 120, "DERIVE_games": 4, "VALIDATE_decisions": 40,
            "VALIDATE_games": 1, "TEST_decisions": 40, "TEST_games": 1}
    fat = {"DERIVE_decisions": 31851, "DERIVE_games": 1297, "VALIDATE_decisions": 10626,
           "VALIDATE_games": 432, "TEST_decisions": 10404, "TEST_games": 432}
    c.cmp("thin corpus -> INSUFFICIENT_EVIDENCE/INSUFFICIENT_CORPUS",
          ("INSUFFICIENT_EVIDENCE", "INSUFFICIENT_CORPUS"),
          tuple(classify.classify(counts=thin, blitz_counts=None, population={"status": "OK"},
                                  discovery_broad=None, discovery_residual=None)[k]
                for k in ("output_class", "failure_code")))
    c.cmp("sufficient corpus is not called insufficient", False,
          classify.classify(counts=fat, blitz_counts=fat, population={"status": "OK"},
                            discovery_broad=None, discovery_residual=None)["failure_code"] == "INSUFFICIENT_CORPUS")

    # NO_STABLE_STRUCTURE when nothing passes the VALIDATE judge
    none_pass = {"frozen": [{"region": "x", "quality": 1.0, "validate": {"pass": False}}]}
    one_pass = {"frozen": [{"region": "R*", "quality": 1.0, "validate": {"pass": True}}]}
    c.cmp("no region passes -> NO_STABLE_STRUCTURE", "NO_STABLE_STRUCTURE",
          classify.classify(counts=fat, blitz_counts=fat, population={"status": "OK"},
                            discovery_broad=none_pass, discovery_residual=one_pass)["output_class"])

    # POPULATION_BASELINE_INSUFFICIENT when a region is found but no population covers the band
    c.cmp("region found, no population -> POPULATION_BASELINE_INSUFFICIENT",
          ("INSUFFICIENT_EVIDENCE", "POPULATION_BASELINE_INSUFFICIENT"),
          tuple(classify.classify(counts=fat, blitz_counts=fat,
                                  population={"status": "POPULATION_BASELINE_INSUFFICIENT",
                                              "reason": "no corpus for band"},
                                  discovery_broad=one_pass, discovery_residual=one_pass)[k]
                for k in ("output_class", "failure_code")))

    # LEVEL_TYPICAL_ONLY when the region survives the judge but not the population baseline
    c.cmp("region survives judge, not population -> LEVEL_TYPICAL_ONLY", "LEVEL_TYPICAL_ONLY",
          classify.classify(counts=fat, blitz_counts=fat, population={"status": "OK"},
                            discovery_broad=one_pass, discovery_residual=none_pass)["output_class"])

    # PERSONAL_RESIDUAL_CANDIDATE only when both pass
    c.cmp("both pass -> PERSONAL_RESIDUAL_CANDIDATE", "PERSONAL_RESIDUAL_CANDIDATE",
          classify.classify(counts=fat, blitz_counts=fat, population={"status": "OK"},
                            discovery_broad=one_pass, discovery_residual=one_pass)["output_class"])

    # a player outside every registered band gets no population, and says so
    tmp = os.path.join(os.environ.get("REPLICATION_TMP", "/tmp"), "gate_offband.parquet")
    df = pd.read_parquet(POP_PARQUET, columns=["game_id", "speed", "own_rating"]).head(4000).copy()
    df["own_rating"] = 2410
    df.to_parquet(tmp, index=False)
    res = populations.resolve(tmp)
    c.cmp("2410-rated player -> POPULATION_BASELINE_INSUFFICIENT", "POPULATION_BASELINE_INSUFFICIENT",
          res["status"])
    c.cmp("and the band it needed is named", [2200, 2600], res.get("band"))
    return c


CHECKS = {
    "corpus_and_splits": check_corpus,
    "feature_table": check_features,
    "R_star_discovery": check_rstar,
    "invariance": check_invariance,
    "stability_loco": check_stability,
    "holdout_test": check_holdout_test,
    "population_comparison": check_population_comparison,
    "R_star_star_population_residual": check_rstarstar,
    "R_star_star_second_target": check_rstarstar_second_target,
    "classifier_verdict": check_classifier_verdict,
    "final_evidence_state": check_evidence_state,
}
CONTROL_TARGETS = {
    "focal_color_is_erez281": "generalisation",
    "load_decisions_default_erez281": "generalisation",
    "population_excludes_only_erez281": "generalisation",
    "population_band_is_1450_1850": "generalisation",
    "classifier_ranks_across_targets": "classifier_precedence",
}


def rebuild_generic(workdir: str, python: str | None = None) -> dict:
    """Produce the generic pipeline's outputs on erez281 from the committed frozen artifacts, so the
    gate proves a reproduction rather than comparing two files someone left on disk.

    Starts at the frozen scored corpus (`data/scored_erez281_sf171_d12_mpv3.jsonl.zst`), which is the
    engine's output and is not re-searched: the generic feature extractor rebuilds the decision
    table, and the generic analysis layer re-runs the frozen search, judge, bootstrap, population
    baseline, invariance, stability and the TEST read with the frozen arguments. Resumable: a stage
    whose output already exists is not recomputed.
    """
    import subprocess
    import zstandard as zstd
    py = python or os.environ.get("REPLICATION_PYTHON") or sys.executable
    A = os.path.join(MECH, "analysis")
    env = dict(os.environ)
    env.update({"OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1", "MKL_NUM_THREADS": "1"})

    scored = os.path.join(workdir, "scored")
    os.makedirs(scored, exist_ok=True)
    part = os.path.join(scored, "part00.jsonl")
    if not os.path.exists(part):
        src = os.path.join(DATA, "scored_erez281_sf171_d12_mpv3.jsonl.zst")
        with open(src, "rb") as f, open(part, "wb") as o:
            zstd.ZstdDecompressor().copy_stream(f, o)
    decisions = os.path.join(workdir, "decisions_generic.parquet")
    if not os.path.exists(decisions):
        subprocess.check_call([py, os.path.join(MECH, "pipeline", "features.py"), scored, decisions,
                               "erez281"], cwd=os.path.join(MECH, "pipeline"), env=env)

    out = {"decisions_parquet": decisions}
    disc = [py, os.path.join(A, "run_discovery.py"), "--decisions", decisions,
            "--vocab", "OBS", "--residual", "1", "--boot", "30", "--depths", "1,2,3"]
    pop_args = ["--population", POP_PARQUET, "--blitz-only", "1"]
    stages = [
        ("discovery_broad", "generic_discovery_OBS_cls_tactical.json",
         disc + ["--target", contract.BROAD_TARGET]),
        ("discovery_residual", f"generic_discovery_POP_{contract.RESIDUAL_TARGETS[0]}.json",
         disc + pop_args + ["--target", contract.RESIDUAL_TARGETS[0]]),
        ("discovery_residual_secondary", f"generic_discovery_POP_{contract.RESIDUAL_TARGETS[1]}.json",
         disc + pop_args + ["--target", contract.RESIDUAL_TARGETS[1]]),
    ]
    for key, fname, cmd in stages:
        path = os.path.join(workdir, fname)
        if not os.path.exists(path):
            subprocess.check_call(cmd + ["--out", path], cwd=A, env=env)
        out[key] = path

    region = json.load(open(out["discovery_broad"]))["frozen"][0]["region"]
    evidence = [
        ("invariance", "generic_invariance.json",
         [py, os.path.join(A, "invariance.py"), "--decisions", decisions, "--region", region,
          "--frame", "VALIDATE", "--target", contract.BROAD_TARGET]),
        ("stability_loco", "generic_stability_loco.json",
         [py, os.path.join(A, "stability_loco.py"), "--decisions", decisions, "--region", region,
          "--target", contract.BROAD_TARGET, "--depth", "2", "--vocab", "OBS"]),
        ("holdout_test", "generic_predict_test.json",
         [py, os.path.join(A, "predict.py"), "--decisions", decisions, "--region", region,
          "--target", contract.BROAD_TARGET]),
        ("population", "generic_population.json",
         [py, os.path.join(A, "population.py"), "--decisions", decisions, "--population", POP_PARQUET,
          "--region", region, "--target", contract.BROAD_TARGET, "--frame", "VALIDATE",
          "--focal-player-key", "erez281"]),
    ]
    for key, fname, cmd in evidence:
        path = os.path.join(workdir, fname)
        if not os.path.exists(path):
            subprocess.check_call(cmd + ["--out", path], cwd=A, env=env)
        out[key] = path
    return out


def run_gate(generic: dict) -> dict:
    checks = [fn(generic) for fn in CHECKS.values()]
    checks.append(check_generalisation())
    checks.append(check_classifier_precedence())
    checks.append(check_readiness_semantics())
    checks.append(check_failure_modes())
    checks.append(check_eligibility_rule())
    ok = all(c.ok for c in checks)
    return {"gate": "GATE-GENERIC-PIPELINE-EQUIVALENCE",
            "result": "GREEN" if ok else "RED",
            "verdict": "EQUIVALENT" if ok else "NOT EQUIVALENT",
            "checks": [c.to_dict() for c in checks]}


def run_positive_controls(generic: dict | None = None) -> dict:
    out = []
    for name, description in CONTROLS.items():
        target = CONTROL_TARGETS[name]
        needs_generic = target not in ("generalisation", "classifier_precedence")
        if needs_generic and generic is None:
            out.append({"control": name, "reinjected": description, "gate_went_red": None,
                        "result": "SKIPPED - needs --generic (or --rebuild) to evaluate "
                                  f"the `{target}` check", "failing_rows": []})
            continue
        undo = _install_control(name)
        try:
            if target == "generalisation":
                c = check_generalisation()
            elif target == "classifier_precedence":
                c = check_classifier_precedence()
            else:
                c = CHECKS[target](generic)
            went_red = not c.ok
            out.append({"control": name, "reinjected": description, "targets_check": target,
                        "gate_went_red": went_red,
                        "result": "PASS" if went_red else "FAIL — the gate did not notice",
                        "failing_rows": [r for r in c.rows if r["result"] == "FAIL"]})
        finally:
            undo()
    ok = all(x["gate_went_red"] for x in out if x["gate_went_red"] is not None)
    return {"positive_controls": out,
            "result": "PASS" if ok else "FAIL",
            "meaning": "every removed hard-code, put back, turns this gate red"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--generic", default=os.path.join(HERE, "generic_run.json"),
                    help="JSON naming the generic pipeline's outputs on erez281")
    ap.add_argument("--positive-controls", action="store_true")
    ap.add_argument("--rebuild", default=None, metavar="WORKDIR",
                    help="rebuild the generic outputs from the committed frozen scored corpus into "
                         "WORKDIR, then gate on them (resumable; skips stages already present)")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    generic = None
    if a.rebuild:
        os.makedirs(a.rebuild, exist_ok=True)
        generic = rebuild_generic(a.rebuild)
        generic.setdefault("corpus_label", "erez281")
    elif os.path.exists(a.generic):
        generic = json.load(open(a.generic))
    if a.positive_controls:
        res = run_positive_controls(generic)
    else:
        if generic is None:
            raise SystemExit(f"no generic outputs: {a.generic} missing and --rebuild not given")
        res = run_gate(generic)
    if a.out:
        with open(a.out, "w") as f:
            json.dump(res, f, indent=1, default=str)
    print(json.dumps(res, indent=1, default=str)[:4000])
    return 0 if res["result"] in ("GREEN", "PASS") else 1


if __name__ == "__main__":
    raise SystemExit(main())
