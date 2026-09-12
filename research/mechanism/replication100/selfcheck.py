"""
The checks that must pass before a walk that takes hours is started.

A missing import in `cohort_select.py` once survived four launches, because the first candidate to
reach that line needed a three-minute fetch to get there and the walk simply wrote no state until
then. Everything here runs in under a second and touches no network.

    python selfcheck.py
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
sys.path.insert(0, os.path.join(MECH, "replication"))
sys.path.insert(0, HERE)

REF_RUN = os.path.join(MECH, "replications", "lichess_vibesgalore_B")
FIXTURES = os.path.join(HERE, "fixtures")


def main() -> int:
    checks: list[tuple[str, bool, str]] = []

    skipped: list[str] = []

    def check(what: str, ok: bool, detail: str = "") -> None:
        checks.append((what, bool(ok), detail))

    # 1. Every stage imports. This is the one that was missed: an import error deep in a walk is
    #    indistinguishable from a slow fetch until the walk has already burned an hour.
    mods = {}
    for name in ("cohort_select", "freeze_cohort", "cohort_run", "aggregate_cohort",
                 "write_report", "make_cohort_prereg", "make_power_plan", "make_instrument_freeze"):
        try:
            mods[name] = __import__(name)
            check("imports: %s" % name, True)
        except Exception as e:  # noqa: BLE001
            check("imports: %s" % name, False, repr(e))

    # 2a. The band rule, on a tracked fixture. This runs everywhere, including CI, because the
    #     fixture is seven synthetic games rather than a corpus. Each line is there to be the reason
    #     one clause of the rule fires: a non-blitz game the focal player is in, a blitz game they
    #     are not in, the focal player as black, an id that differs by case, an anonymous opponent.
    if "cohort_select" in mods:
        try:
            exp = json.load(open(os.path.join(FIXTURES, "band_helper_expected.json")))
            got = mods["cohort_select"].blitz_median_from_admissible(
                os.path.join(FIXTURES, "band_helper_games.ndjson"), exp["focal_player_id"])
            check("band rule on the tracked fixture", got == exp["expected_blitz_median"],
                  "got %s, worked by hand %s" % (got, exp["expected_blitz_median"]))
        except Exception as e:  # noqa: BLE001
            check("band rule on the tracked fixture", False, repr(e))

    # 2b. And the same helper against the PIPELINE's own derivation on a run whose answer is on the
    #     record. Two implementations of one rule; this is the cheap half of holding them together.
    #
    #     The admissible corpus is gitignored, on purpose: game corpora are not repository content.
    #     So this half cannot run on a fresh checkout, and it used to FAIL there rather than say so,
    #     which is how it went red the first time CI ran this file. A check that cannot run reports
    #     that it did not run. 2a is the half that holds the rule everywhere.
    ref_games = os.path.join(REF_RUN, "admissible", "games.ndjson")
    if "cohort_select" in mods and os.path.exists(ref_games):
        try:
            got = mods["cohort_select"].blitz_median_from_admissible(ref_games, "vibesgalore")
            want = json.load(open(os.path.join(REF_RUN, "report", "RESULT.json")))
            want = want["population"]["focal_blitz_median_rating"]
            check("band helper matches the pipeline on the recorded run", got == want,
                  "got %s, recorded %s" % (got, want))
        except Exception as e:  # noqa: BLE001
            check("band helper matches the pipeline on the recorded run", False, repr(e))
    else:
        skipped.append("band helper against the recorded run: %s is gitignored and absent here"
                       % os.path.relpath(ref_games, REPO))

    # 3. The artefacts a walk reads exist and agree with each other.
    try:
        pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
        fr = json.load(open(os.path.join(HERE, "COHORT_FRAME.json")))
        fz = json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))
        check("prereg names the frozen frame",
              pre["sampling_frame"]["frame_hash"] == fr["frame_hash"])
        check("prereg names the frozen instrument",
              pre["instrument"]["instrument_hash"] == fz["instrument_hash"])
        check("prereg carries the retrieval bound and its enforcement",
              "retrieval_bound" in pre["window"]
              and "full window" in pre["window"]["retrieval_bound"]["enforced_by"].lower())
        check("frame holds screenable rows",
              sum(1 for r in fr["rows"] if r["status"] == "OK") > 0)
    except Exception as e:  # noqa: BLE001
        check("cohort artefacts load and agree", False, repr(e))

    # 4. The instrument the walk would run under is the one the freeze names.
    try:
        import corpus as corpuslib
        fz = json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))
        check("pipeline hash still matches the freeze",
              corpuslib.pipeline_version()["pipeline_hash"] == fz["pipeline_hash"],
              corpuslib.pipeline_version()["pipeline_hash"])
    except Exception as e:  # noqa: BLE001
        check("pipeline hash still matches the freeze", False, repr(e))

    # 5. The runs already on the record still verify. A walk is not worth starting on a tree where
    #    the frozen findings no longer belong to the code.
    try:
        import verify_run
        for name in sorted(os.listdir(os.path.join(MECH, "replications"))):
            d = os.path.join(MECH, "replications", name)
            if not os.path.isdir(d):
                continue
            v = verify_run.verify(d)
            check("run verifies: %s" % name, not v["problems"], "; ".join(v["problems"])[:200])
    except Exception as e:  # noqa: BLE001
        check("existing runs verify", False, repr(e))

    failed = [c for c in checks if not c[1]]
    for what, ok, detail in checks:
        print("%-4s %s%s" % ("PASS" if ok else "FAIL", what, (" -- " + detail) if detail and not ok else ""))
    for why in skipped:
        print("SKIP %s" % why)
    print("\n%d checks: %d pass, %d fail, %d skipped"
          % (len(checks), len(checks) - len(failed), len(failed), len(skipped)))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
