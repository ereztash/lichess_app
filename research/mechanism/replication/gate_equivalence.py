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
    """Every feature column, every row, against the frozen decision table."""
    import numpy as np
    import pandas as pd
    c = Check("feature_table", "EQUIVALENCE")
    old = pd.read_parquet(OWNER_PARQUET).sort_values(["game_id", "ply"]).reset_index(drop=True)
    new = pd.read_parquet(generic["decisions_parquet"]).sort_values(["game_id", "ply"]).reset_index(drop=True)
    c.cmp("rows", int(len(old)), int(len(new)))
    c.cmp("columns", list(old.columns), list(new.columns))
    if len(old) == len(new) and list(old.columns) == list(new.columns):
        differing = []
        for col in old.columns:
            a, b = old[col], new[col]
            if a.dtype.kind in "fc" or b.dtype.kind in "fc":
                same = np.allclose(a.astype(float).fillna(-9e18), b.astype(float).fillna(-9e18),
                                   rtol=0, atol=0)
            else:
                same = a.fillna("<NA>").astype(str).equals(b.fillna("<NA>").astype(str))
            if not same:
                differing.append(col)
        c.cmp("columns differing bitwise", [], differing)
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
    "R_star_star_population_residual": check_rstarstar,
    "final_evidence_state": check_evidence_state,
}
CONTROL_TARGETS = {
    "focal_color_is_erez281": "generalisation",
    "load_decisions_default_erez281": "generalisation",
    "population_excludes_only_erez281": "generalisation",
    "population_band_is_1450_1850": "generalisation",
}


def rebuild_generic(workdir: str, python: str | None = None) -> dict:
    """Produce the generic pipeline's outputs on erez281 from the committed frozen artifacts, so the
    gate proves a reproduction rather than comparing two files someone left on disk.

    Starts at the frozen scored corpus (`data/scored_erez281_sf171_d12_mpv3.jsonl.zst`), which is the
    engine's output and is not re-searched: the generic feature extractor rebuilds the decision
    table, and the generic analysis layer re-runs the frozen search, judge, bootstrap and population
    baseline with the frozen arguments.
    """
    import subprocess
    import zstandard as zstd
    py = python or os.environ.get("REPLICATION_PYTHON") or sys.executable
    scored = os.path.join(workdir, "scored")
    os.makedirs(scored, exist_ok=True)
    part = os.path.join(scored, "part00.jsonl")
    if not os.path.exists(part):
        src = os.path.join(DATA, "scored_erez281_sf171_d12_mpv3.jsonl.zst")
        with open(src, "rb") as f, open(part, "wb") as o:
            zstd.ZstdDecompressor().copy_stream(f, o)
    decisions = os.path.join(workdir, "decisions_generic.parquet")
    env = dict(os.environ)
    env.update({"OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1", "MKL_NUM_THREADS": "1"})
    if not os.path.exists(decisions):
        subprocess.check_call([py, os.path.join(MECH, "pipeline", "features.py"), scored, decisions,
                               "erez281"], cwd=os.path.join(MECH, "pipeline"), env=env)
    broad = os.path.join(workdir, "generic_discovery_OBS_cls_tactical.json")
    resid = os.path.join(workdir, "generic_discovery_POP_cls_hung_material.json")
    common_args = [py, os.path.join(MECH, "analysis", "run_discovery.py"), "--decisions", decisions,
                   "--vocab", "OBS", "--residual", "1", "--boot", "30", "--depths", "1,2,3"]
    if not os.path.exists(broad):
        subprocess.check_call(common_args + ["--target", contract.BROAD_TARGET, "--out", broad],
                              cwd=os.path.join(MECH, "analysis"), env=env)
    if not os.path.exists(resid):
        subprocess.check_call(common_args + ["--population", POP_PARQUET, "--blitz-only", "1",
                                             "--target", contract.RESIDUAL_PRIMARY, "--out", resid],
                              cwd=os.path.join(MECH, "analysis"), env=env)
    return {"decisions_parquet": decisions, "discovery_broad": broad, "discovery_residual": resid}


def run_gate(generic: dict) -> dict:
    checks = [fn(generic) for fn in CHECKS.values()]
    checks.append(check_generalisation())
    checks.append(check_failure_modes())
    checks.append(check_eligibility_rule())
    ok = all(c.ok for c in checks)
    return {"gate": "GATE-GENERIC-PIPELINE-EQUIVALENCE",
            "result": "GREEN" if ok else "RED",
            "verdict": "EQUIVALENT" if ok else "NOT EQUIVALENT",
            "checks": [c.to_dict() for c in checks]}


def run_positive_controls() -> dict:
    out = []
    for name, description in CONTROLS.items():
        undo = _install_control(name)
        try:
            c = check_generalisation()
            went_red = not c.ok
            out.append({"control": name, "reinjected": description,
                        "gate_went_red": went_red,
                        "result": "PASS" if went_red else "FAIL — the gate did not notice",
                        "failing_rows": [r for r in c.rows if r["result"] == "FAIL"]})
        finally:
            undo()
    ok = all(x["gate_went_red"] for x in out)
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
    if a.positive_controls:
        res = run_positive_controls()
    elif a.rebuild:
        os.makedirs(a.rebuild, exist_ok=True)
        res = run_gate(rebuild_generic(a.rebuild))
    else:
        res = run_gate(json.load(open(a.generic)))
    if a.out:
        with open(a.out, "w") as f:
            json.dump(res, f, indent=1, default=str)
    print(json.dumps(res, indent=1, default=str)[:4000])
    return 0 if res["result"] in ("GREEN", "PASS") else 1


if __name__ == "__main__":
    raise SystemExit(main())
