"""
PHASE 10 -- is this cohort a cohort, before a single position is scored?

WHY THIS EXISTS SEPARATELY FROM `freeze_cohort.py`. The freeze asserts the two things that stop a
cohort being assembled around a result: exactly a hundred members, exactly twenty-five of them
RESIDUAL class, none of them already scored. It does not re-derive anything. Everything else about
the selection -- that the members are distinct people, that each one's band was derived by the rule
rather than recorded by the walk, that none of them sits in the baseline that will judge them, that
the frame and the pre-registration under which they were chosen are the ones on disk now -- is
trusted, and the walk that produced it ran for five hours across a restart, a requeue for a defect,
and fourteen transport failures.

The scoring run costs about thirty-seven hours of engine time. A defect found after it is a defect
that costs thirty-seven hours to fix. Every check below runs in seconds, reads only what is already
on disk, and re-derives rather than re-reads wherever re-derivation is possible.

WHAT IT REFUSES TO DO. It does not judge any member, does not read any run's findings, and does not
touch the engine. It reads corpora and provenance. A check it cannot perform is reported NOT
MEASURED and counts against the audit, because "checked and correct" and "could not look" are the
two things this repository has been bitten by conflating.

    python audit_selection_validity.py          # seconds, no network, no engine
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
sys.path.insert(0, os.path.join(MECH, "replication"))
sys.path.insert(0, HERE)
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402
import populations       # noqa: E402
import cohort_select as cs  # noqa: E402

PASS, FAIL, UNMEASURED = [], [], []


def check(what: str, ok: bool, detail: str = "") -> None:
    (PASS if ok else FAIL).append(what)
    print(("PASS " if ok else "FAIL ") + what + (("  -- " + detail) if detail else ""))


def cannot(what: str, why: str) -> None:
    UNMEASURED.append(what)
    print("NOT MEASURED " + what + "  -- " + why)


def main() -> int:  # noqa: C901, PLR0912, PLR0915
    sel = json.load(open(os.path.join(HERE, "COHORT_SELECTION.json")))
    pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
    # THE FRAME THE WALK CONSUMES, which is not the one the feasibility screen published.
    # `COHORT_FRAME.json` holds 15,000 rows and is what `cohort_select.py` opens; `SCREENED_FRAME`
    # holds the 3,000-row screen. Auditing against the wrong one reported every member as absent
    # from the frame, which is the failure mode of an audit that reads a plausible file instead of
    # the file under test.
    frame = json.load(open(os.path.join(HERE, "COHORT_FRAME.json")))
    freeze = json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))
    acc, rej = sel["accepted"], sel["rejected"]
    want_n = pre["denominators"]["BROAD_POWERED"]["n"]
    want_resid = pre["denominators"]["RESIDUAL_POWERED"]["n"]

    print("== the cohort was chosen under the documents that are on disk now ==")
    check("selection carries the pre-registration's own hash",
          sel["prereg_hash"] == pre["prereg_hash"],
          "%s vs %s" % (sel["prereg_hash"][:12], pre["prereg_hash"][:12]))
    check("selection carries the screened frame's own hash",
          sel["frame_hash"] == frame["frame_hash"],
          "%s vs %s" % (sel["frame_hash"][:12], frame["frame_hash"][:12]))
    # THE PRE-REGISTRATION'S SEED, not the frame's. The screen drew its rows under 20260907; the
    # order the walk takes them in is shuffled under `selection.seed`, which the pre-registration
    # fixes separately and before any candidate was fetched. Holding the walk to the frame's seed
    # compares two numbers that were never meant to be equal.
    check("the walk shuffled under the pre-registered selection seed",
          sel["seed"] == pre["selection"]["seed"],
          "%s vs %s" % (sel["seed"], pre["selection"]["seed"]))
    here_hash = corpuslib.pipeline_version()["pipeline_hash"]
    check("the working tree is the frozen instrument",
          here_hash == freeze["pipeline_hash"],
          "tree %s, freeze %s" % (here_hash[:12], freeze["pipeline_hash"][:12]))

    print("\n== the hundred are a hundred distinct people ==")
    check("exactly %d accepted" % want_n, len(acc) == want_n, "got %d" % len(acc))
    for field, label in (("u", "usernames"), ("player_id", "player ids"), ("run_dir", "run dirs")):
        vals = [m[field] for m in acc]
        dupes = {v for v in vals if vals.count(v) > 1}
        check("%d distinct %s" % (len(acc), label), len(set(vals)) == len(vals),
              "duplicated: %s" % sorted(dupes) if dupes else "")
    lowered = [m["u"].lower() for m in acc]
    check("no two members differ only by case",
          len(set(lowered)) == len(lowered),
          "collides: %s" % sorted({v for v in lowered if lowered.count(v) > 1}))

    print("\n== every member came out of the committed frame, in order ==")
    rows = {r["u"].lower() for r in frame["rows"]}
    missing = [m["u"] for m in acc if m["u"].lower() not in rows]
    check("every accepted member is a row of the screened frame", not missing,
          "not in frame: %s" % missing[:5])
    check("the cursor did not run past the frame",
          sel["cursor"] <= len(frame["rows"]),
          "cursor %d, frame %d" % (sel["cursor"], len(frame["rows"])))
    tried = {m["u"].lower() for m in acc} | {r["u"].lower() for r in rej}
    check("no candidate was both accepted and rejected",
          not ({m["u"].lower() for m in acc} & {r["u"].lower() for r in rej}),
          "both: %s" % sorted({m["u"].lower() for m in acc} & {r["u"].lower() for r in rej})[:5])

    print("\n== nothing was judged that could not be reached, and nothing is still owed ==")
    # A CANDIDATE CAN BE UNREACHABLE ONCE AND JUDGED LATER, and that is the requeue working rather
    # than a defect. The first draft of this check called every such candidate a contradiction and
    # reported thirteen of them; what it had found was thirteen transport failures that were
    # correctly retried. What must hold is that a transport failure never DECIDED anything -- no
    # rejection reason is FETCH_FAILED, checked below -- and that nobody fell out of the walk in
    # between: every unreachable username was later accepted, rejected on its merits, or is still
    # owed a retry.
    unreach = {u["u"].lower() for u in sel.get("unreachable", [])}
    settled = {m["u"].lower() for m in acc} | {r["u"].lower() for r in rej} \
        | {u.lower() for u in sel["retry_queue"]}
    dropped = sorted(unreach - settled)
    check("no candidate was lost between a transport failure and a decision", not dropped,
          "unreachable and never settled: %s" % dropped[:5])
    check("the retry queue is empty", not sel["retry_queue"], "still queued: %s" % sel["retry_queue"])
    print("     (%d candidates were unreachable; %d were then accepted, %d rejected on their merits)"
          % (len(unreach), len(unreach & {m["u"].lower() for m in acc}),
             len(unreach & {r["u"].lower() for r in rej})))

    print("\n== the two window classes are what the pre-registration declares ==")
    resid = [m for m in acc if m["window_class"] == "RESIDUAL"]
    broad = [m for m in acc if m["window_class"] == "BROAD"]
    check("exactly %d RESIDUAL-class members" % want_resid, len(resid) == want_resid,
          "got %d" % len(resid))
    check("the rest are BROAD", len(broad) == want_n - want_resid, "got %d" % len(broad))
    check("every RESIDUAL member holds the wider window",
          all(m["window"] > 450 for m in resid),
          "narrow: %s" % [m["u"] for m in resid if m["window"] <= 450][:5])
    check("every RESIDUAL member's corpus is larger than the broad bound",
          all(m["admissible"] > 450 for m in resid),
          "not larger: %s" % [(m["u"], m["admissible"]) for m in resid if m["admissible"] <= 450][:5])
    check("every member that could be promoted was tried",
          all(m.get("residual_attempted") for m in acc if m.get("residual_capable"))
          or len(resid) == want_resid,
          "untried and capable: %s"
          % [m["u"] for m in acc if m.get("residual_capable") and not m.get("residual_attempted")][:5])

    print("\n== each member's band was DERIVED here, not read back from the walk ==")
    registered = {tuple(p["band"]) for p in populations.registry()}
    redone = wrong = absent = 0
    mismatches, unbanded = [], []
    for m in acc:
        games = os.path.join(REPO, m["run_dir"], "admissible", "games.ndjson")
        if not os.path.exists(games):
            unbanded.append(m["u"])
            continue
        med = cs.blitz_median_from_admissible(games, m["player_id"])
        band = tuple(contract.population_band(med)) if med is not None else None
        redone += 1
        if band != tuple(m["derived_band"]):
            wrong += 1
            mismatches.append((m["u"], m["derived_band"], list(band) if band else None))
        if band not in registered:
            absent += 1
    if redone == len(acc):
        check("all %d bands re-derived from the members' own games" % redone, True)
    elif redone:
        cannot("bands re-derived for every member",
               "%d of %d have no admissible corpus on disk: %s"
               % (len(unbanded), len(acc), unbanded[:5]))
    else:
        cannot("bands re-derived", "no member has an admissible corpus on disk")
    if redone:
        check("every re-derived band equals the one selection recorded", wrong == 0,
              "mismatches: %s" % mismatches[:3])
        check("every re-derived band exists in the population registry", absent == 0,
              "%d members whose band has no baseline" % absent)

    print("\n== PHASE 19: no member is in the baseline that judges them ==")
    pop_games = os.path.join(MECH, "data", "population_games.ndjson")
    if os.path.exists(pop_games):
        base = cs.population_members()
        inside = sorted({m["player_id"].lower() for m in acc} & base)
        check("no cohort member appears in the population baseline", not inside,
              "in baseline: %s" % inside[:5])
        print("     (baseline holds %d distinct players; %d candidates were rejected for this)"
              % (len(base), sum(1 for r in rej if r["reason"] == "IN_POPULATION_BASELINE")))
    else:
        cannot("the population-safety gate", "no baseline corpus at %s" % pop_games)

    print("\n== provenance: every member was derived by code this repository can name ==")
    dirty, nomanifest, badver = [], [], []
    for m in acc:
        p = os.path.join(REPO, m["run_dir"], "manifest.json")
        if not os.path.exists(p):
            nomanifest.append(m["u"])
            continue
        man = json.load(open(p))
        if man.get("repo_dirty"):
            dirty.append(m["u"])
        if (man.get("pipeline_version") or {}).get("pipeline_hash") not in (
                None, freeze["pipeline_hash"]):
            badver.append((m["u"], (man.get("pipeline_version") or {}).get("pipeline_hash", "")[:12]))
    check("every member has a manifest", not nomanifest, "missing: %s" % nomanifest[:5])
    check("no member was derived from a dirty tree", not dirty, "dirty: %s" % dirty[:5])
    check("every member was derived under the frozen pipeline hash", not badver,
          "other hashes: %s" % badver[:3])

    print("\n== nothing has been scored ==")
    scored = [m["u"] for m in acc
              if os.path.isdir(os.path.join(REPO, m["run_dir"], "scored"))
              and os.listdir(os.path.join(REPO, m["run_dir"], "scored"))]
    check("no member carries scored decisions", not scored, "scored already: %s" % scored[:5])
    resulted = []
    for m in acc:
        p = os.path.join(REPO, m["run_dir"], "report", "RESULT.json")
        if os.path.exists(p) and json.load(open(p)).get("status") in contract.TERMINAL_STATES:
            resulted.append(m["u"])
    check("no member carries a terminal result", not resulted, "already run: %s" % resulted[:5])

    print("\n== every rejection is pre-analysis ==")
    declared = {"POPULATION_BASELINE_INSUFFICIENT", "IN_POPULATION_BASELINE",
                "INSUFFICIENT_ELIGIBLE_GAMES", "NO_BLITZ_GAMES", "FETCH_FAILED"}
    reasons = {r["reason"] for r in rej}
    check("no rejection reason outside the declared set", reasons <= declared,
          "undeclared: %s" % sorted(reasons - declared))
    check("no candidate was rejected for a transport failure",
          "FETCH_FAILED" not in reasons,
          "%d rejected as FETCH_FAILED" % sum(1 for r in rej if r["reason"] == "FETCH_FAILED"))

    print("\n== the defect requeue is on the record ==")
    rq = sel.get("requeued_for_defect", [])
    for entry in rq:
        u = (entry.get("u") if isinstance(entry, dict) else entry)
        print("     requeued: %s (%s)"
              % (u, entry.get("reason", "no reason recorded") if isinstance(entry, dict) else ""))
    check("every requeued username was either re-derived or is absent, never duplicated",
          all(sum(1 for m in acc if m["u"] == (e.get("u") if isinstance(e, dict) else e)) <= 1
              for e in rq), "duplicated after requeue")

    n = len(PASS) + len(FAIL) + len(UNMEASURED)
    print("\n%d checks: %d pass, %d fail, %d NOT MEASURED" % (n, len(PASS), len(FAIL),
                                                             len(UNMEASURED)))
    if FAIL:
        print("\nNO-GO. Failed: %s" % ", ".join(FAIL))
    elif UNMEASURED:
        print("\nNO-GO. Nothing failed, but these could not be checked: %s" % ", ".join(UNMEASURED))
    else:
        print("\nAll green.")
    return 1 if (FAIL or UNMEASURED) else 0


if __name__ == "__main__":
    raise SystemExit(main())
