"""
A repeatable test of the post-selection chain: `aggregate_cohort.py` and `write_report.py`.

These two run once, at the end of a cohort that costs days to produce, which is the worst moment to
discover a defect in them. They are exercised here against fixtures built from runs that are already
on the record, so the chain is known to work long before it is needed.

The fixtures are synthetic COHORTS over REAL runs: a member is a pointer to a run directory, so a
fixture can hold twenty members over two runs and still read real results. Nothing here writes to
the tree, and nothing here is a finding about any player.

    python test_readout.py          # no network, a few seconds

Covers: the verdict branches that can be reached without inventing results, the two denominators,
the population-safety gate including a positive control that must go red, and that the report
renders.

NOT covered, and deliberately not faked: `GENERALISES` and `DOES_NOT_GENERALISE`. Both need a cohort
that trips no red flag, and the only two runs on the record are a null and erez281's own R\*\*, so
any cohort built from them either trips the R\*/R\*\* flag or has nothing in it. Reaching those two
branches would mean inventing a result, which is the one thing a test of this chain must not do.
The cohort itself will reach them or it will not.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
sys.path.insert(0, HERE)
import aggregate_cohort as ac      # noqa: E402
import write_report as wr          # noqa: E402

NULL_RUN = "research/mechanism/replications/lichess_vibesgalore_B"
PRC_RUN = "research/mechanism/replications/lichess_erez281_RUNOFRECORD"

PASS, FAIL = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (PASS if ok else FAIL).append(name)
    print(("PASS " if ok else "FAIL ") + name + (("  -- " + detail) if detail and not ok else ""))


def member(u: str, run_dir: str, *, window_class="BROAD", blitz_admissible=99999,
           player_id=None, window=450) -> dict:
    res = json.load(open(os.path.join(REPO, run_dir, "report", "RESULT.json")))
    return {"u": u, "player_id": player_id or u, "run_dir": run_dir,
            "window_class": window_class, "window": window,
            "admissible": blitz_admissible, "blitz_admissible": blitz_admissible,
            "speeds": {}, "blitz_median": 1650.0,
            "derived_band": (res.get("population") or {}).get("band"),
            "screen_predicted_band": (res.get("population") or {}).get("band"),
            "screen_band_agreed": True}


def build(tmp: str, members: list, *, unfinished: list | None = None,
          unreachable: list | None = None, retry_queue: list | None = None) -> None:
    """A fixture cohort in `tmp`, shaped so only the thing under test can move the verdict."""
    pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
    pre["denominators"]["BROAD_POWERED"]["n"] = len(members)
    pre["denominators"]["RESIDUAL_POWERED"]["n"] = sum(
        1 for m in members if m["window_class"] == "RESIDUAL")
    all_members = members + [member(u, NULL_RUN) | {"run_dir": "research/does/not/exist"}
                             for u in (unfinished or [])]
    frozen = {"prereg_hash": pre["prereg_hash"], "cohort_hash": "fixture",
              "instrument_hash": "fixture", "n_members": len(all_members),
              "n_residual_class": sum(1 for m in all_members
                                      if m["window_class"] == "RESIDUAL"),
              "selection_walk": {"walked": len(all_members), "prefiltered_without_a_fetch": {},
                                 "fetched": len(all_members), "rejected_after_fetch": 0,
                                 "rejection_reasons": {}},
              "screen_band_agreement": {"agreed": len(all_members), "of": len(all_members)},
              "members": all_members}
    sel = {"prereg_hash": pre["prereg_hash"], "frame_hash": "fixture", "seed": 0, "cursor": 1,
           "accepted": members, "rejected": [], "prefiltered": {},
           "unreachable": [{"u": u, "reason": "FETCH_FAILED"} for u in (unreachable or [])],
           "retry_queue": list(retry_queue or [])}
    json.dump(pre, open(os.path.join(tmp, "COHORT_PREREG.json"), "w"))
    json.dump(frozen, open(os.path.join(tmp, "COHORT_FROZEN.json"), "w"))
    json.dump(sel, open(os.path.join(tmp, "COHORT_SELECTION.json"), "w"))
    shutil.copy(os.path.join(HERE, "POWER_PLAN.json"), tmp)


class _Quiet:
    """The aggregator prints its summary. Six fixtures of that buries the check lines."""
    def __enter__(self):
        self._out, sys.stdout = sys.stdout, open(os.devnull, "w")
        return self

    def __exit__(self, *a):
        sys.stdout.close(); sys.stdout = self._out


def read_out(tmp: str) -> dict:
    ac.HERE = tmp
    sys.argv = ["aggregate_cohort.py", "--out", os.path.join(tmp, "COHORT_RESULTS.json")]
    with _Quiet():
        ac.main()
    return json.load(open(os.path.join(tmp, "COHORT_RESULTS.json")))


def main() -> int:
    # ---- 1. an unfinished member blocks every other statement -----------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("a", PRC_RUN), member("b", NULL_RUN)], unfinished=["ghost"])
        r = read_out(tmp)
        check("an unfinished member gives INCOMPLETE",
              r["verdict"]["verdict"] == "INCOMPLETE", r["verdict"]["verdict"])
        check("the unfinished member is named, not just counted",
              r["completeness"]["unfinished"] == ["ghost"])

    # ---- 2. the denominators separate ------------------------------------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("a", PRC_RUN, window_class="RESIDUAL", blitz_admissible=99999),
                    member("b", NULL_RUN, window_class="BROAD", blitz_admissible=1)])
        r = read_out(tmp)
        d = r["denominators"]
        check("a member short of blitz games is BROAD_POWERED and not RESIDUAL_POWERED",
              d["BROAD_POWERED"] == 2 and d["RESIDUAL_POWERED"] == 1, json.dumps(d)[:200])

    # ---- 3. a pre-declared red flag beats any finding --------------------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("n%d" % i, NULL_RUN) for i in range(12)])
        r = read_out(tmp)
        met = [f["flag"] for f in r["red_flags"]["flags"] if f["met"]]
        check("an all-null cohort trips a red flag", bool(met), str(met))
        check("a met red flag forces UNDETERMINED, never a verdict",
              r["verdict"]["verdict"] == "UNDETERMINED", r["verdict"]["verdict"])

    # ---- 4. a cohort of clones is caught by the flags, not read as a finding --------------------
    #
    # Twelve copies of one run is the degenerate case the red flags exist for: every member returns
    # a candidate, on one region, and that region is erez281's own. The rule puts the flags ahead of
    # every finding, so the answer is UNDETERMINED and NOT the DOES_NOT_GENERALISE the shape of the
    # counts would otherwise suggest. That ordering is the thing worth pinning.
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("p%d" % i, PRC_RUN, window_class="RESIDUAL") for i in range(12)])
        r = read_out(tmp)
        met = {f["flag"] for f in r["red_flags"]["flags"] if f["met"]}
        check("a cohort of clones trips the R*/R** flag",
              any("R* or R** verbatim" in f for f in met), str(met))
        check("a cohort of clones trips the residual-rate flag",
              any("rate above 50%" in f for f in met), str(met))
        check("the flags beat the counts: UNDETERMINED, not DOES_NOT_GENERALISE",
              r["verdict"]["verdict"] == "UNDETERMINED", r["verdict"]["verdict"])

    # ---- 5. PHASE 19, and it must be able to go red ----------------------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("a", PRC_RUN), member("b", NULL_RUN)])
        r = read_out(tmp)
        ps = r["population_safety"]
        check("the population gate is measured, not asserted", ps.get("measured") is True)
        check("no fixture member is in the baseline", ps["members_in_baseline"] == 0)

        with open(ac.POP_GAMES) as f:
            victim = ((json.loads(f.readline())["players"]["white"]).get("user") or {})["id"]
        build(tmp, [member("a", PRC_RUN), member(victim, NULL_RUN, player_id=victim)])
        r2 = read_out(tmp)
        check("POSITIVE CONTROL: a real baseline player as a member turns the gate red",
              r2["population_safety"]["members_in_baseline"] == 1,
              json.dumps(r2["population_safety"])[:200])

        real = ac.POP_GAMES
        ac.POP_GAMES = real + ".absent"
        r3 = read_out(tmp)
        ac.POP_GAMES = real
        check("an absent baseline reads as NOT MEASURED, never as clean",
              r3["population_safety"]["measured"] is False
              and r3["population_safety"]["members_in_baseline"] is None)

    # ---- 6. an unreachable candidate is not a rejection ------------------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("a", PRC_RUN), member("b", NULL_RUN)],
              unreachable=["ogbullz", "ogbullz", "akhiln3"], retry_queue=["akhiln3"])
        r = read_out(tmp)
        ir = r["ingest_reachability"]
        check("unreachable candidates are counted as events and as names",
              ir["unreachable_events"] == 3 and ir["distinct_usernames"] == 2, json.dumps(ir))
        check("a candidate still queued at freeze is visible",
              ir["still_queued_at_freeze"] == 1, json.dumps(ir))
        check("unreachable candidates stay OUT of the tried denominator",
              ir["tried_candidates_denominator"] == 2, json.dumps(ir))

    # ---- 7. the report renders --------------------------------------------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("a", PRC_RUN, window_class="RESIDUAL"), member("b", NULL_RUN)])
        read_out(tmp)
        wr.HERE = tmp
        sys.argv = ["write_report.py", "--out", os.path.join(tmp, "REPORT.md")]
        wr.main()
        md = open(os.path.join(tmp, "REPORT.md")).read()
        check("the report renders", len(md) > 800, "%d bytes" % len(md))
        check("the report carries the population-safety gate", "## Population safety" in md)
        check("the report does not print a bare None", "None" not in md,
              next((ln for ln in md.splitlines() if "None" in ln), ""))
        check("the report states the finished count rather than asserting a hundred",
              "2 finished runs" in md and "A hundred runs" not in md,
              next((ln for ln in md.splitlines() if "runs make quantities" in ln), ""))

    # ---- 8. the walk's unreachable candidates reach the reader ------------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        build(tmp, [member("a", PRC_RUN), member("b", NULL_RUN)],
              unreachable=["x", "x", "y"], retry_queue=["y"])
        read_out(tmp)
        wr.HERE = tmp
        sys.argv = ["write_report.py", "--out", os.path.join(tmp, "REPORT.md")]
        wr.main()
        md = open(os.path.join(tmp, "REPORT.md")).read()
        check("the report separates unreachable candidates from rejections",
              "**3** fetches failed against **2** candidates" in md
              and "NOT rejections" in md,
              next((ln for ln in md.splitlines() if "Separately" in ln), "(absent)"))
        check("the report says how many were still queued at the freeze",
              "1 was still queued" in md,
              next((ln for ln in md.splitlines() if "Separately" in ln), "(absent)"))

    # ---- 9. the runner refuses a moved instrument before it spends forty hours -------------------
    import cohort_run as cr                                                      # noqa: PLC0415
    with tempfile.TemporaryDirectory() as tmp:
        pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
        freeze = json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))
        json.dump(pre, open(os.path.join(tmp, "COHORT_PREREG.json"), "w"))
        json.dump({"prereg_hash": pre["prereg_hash"], "cohort_hash": "fixture", "members": []},
                  open(os.path.join(tmp, "COHORT_FROZEN.json"), "w"))
        json.dump({**freeze, "pipeline_hash": "0" * 64},
                  open(os.path.join(tmp, "INSTRUMENT_FREEZE.json"), "w"))
        cr.HERE = tmp
        sys.argv = ["cohort_run.py", "--out", os.path.join(tmp, "PROGRESS.json")]
        try:
            with _Quiet():
                cr.main()
            check("the runner refuses a pipeline hash that moved since the freeze", False,
                  "it started anyway")
        except SystemExit as e:
            check("the runner refuses a pipeline hash that moved since the freeze",
                  "pipeline hash" in str(e), str(e)[:120])
        json.dump(freeze, open(os.path.join(tmp, "INSTRUMENT_FREEZE.json"), "w"))
        sys.argv = ["cohort_run.py", "--out", os.path.join(tmp, "PROGRESS.json")]
        try:
            with _Quiet():
                rc = cr.main()
            check("the runner proceeds under the frozen instrument", rc == 0, "rc %s" % rc)
        except SystemExit as e:
            check("the runner proceeds under the frozen instrument", False, str(e)[:120])

    print("\n%d checks: %d pass, %d fail" % (len(PASS) + len(FAIL), len(PASS), len(FAIL)))
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
