"""Operational progress only. This script CANNOT report an analytic outcome, by construction.

OUTCOME BLINDNESS IS A PROPERTY OF THE INSTRUMENT HERE, NOT OF MY DISCIPLINE. `TERMINAL_STATES`
contains the four output classes, so COHORT_PROGRESS.json holds every member's class the moment it
finishes. Rather than promise not to look, this partitions the states and never prints a member's
class or any count broken down by class: a finished member is one integer, and that is all.

EXECUTION failures and ELIGIBILITY surprises ARE printed and named, because they are operational
facts the run must act on -- a frozen member that comes back INSUFFICIENT_* after passing selection
is a defect signal, not a finding.
"""
import json, os, sys, time

ANALYTIC = {"NO_STABLE_STRUCTURE", "LEVEL_TYPICAL_ONLY", "PERSONAL_RESIDUAL_CANDIDATE",
            "INSUFFICIENT_EVIDENCE"}
EXECUTION = {"ENGINE_FAILURE", "FETCH_FAILED", "PIPELINE_EQUIVALENCE_FAILED", "USER_NOT_FOUND",
             "PLATFORM_UNSUPPORTED", "NO_PUBLIC_GAMES", "RUN_FAILED"}
ELIGIBILITY = {"INSUFFICIENT_CORPUS", "INSUFFICIENT_ELIGIBLE_GAMES", "POPULATION_BASELINE_INSUFFICIENT"}

HERE = "research/mechanism/replication100"
prog_p = os.path.join(HERE, "COHORT_PROGRESS.json")
fz = json.load(open(os.path.join(HERE, "COHORT_FROZEN.json")))
resid = {m["u"] for m in fz["members"] if m["window_class"] == "RESIDUAL"}
if not os.path.exists(prog_p):
    print("no COHORT_PROGRESS.json yet; the run has not recorded its first member")
    sys.exit(0)
prog = json.load(open(prog_p))
mem = prog.get("members", {})
done = [u for u, v in mem.items() if v.get("status") in ANALYTIC]
exec_fail = [(u, v["status"]) for u, v in mem.items() if v.get("status") in EXECUTION]
elig = [(u, v["status"]) for u, v in mem.items() if v.get("status") in ELIGIBILITY]
band_bad = [u for u, v in mem.items() if v.get("band_check", {}).get("checked")
            and not v["band_check"]["agree"]]
secs = [v["seconds"] for v in mem.values() if "seconds" in v]
n_done = len(done) + len(exec_fail) + len(elig)
print("cohort_hash %s" % prog.get("cohort_hash", "?")[:16])
print("COMPLETED           %d / 100" % n_done)
print("  of which RESIDUAL %d / 25" % len({u for u in done + [x[0] for x in exec_fail + elig]} & resid))
print("EXECUTION FAILURES  %d %s" % (len(exec_fail), exec_fail[:5] if exec_fail else ""))
print("ELIGIBILITY SURPRISES %d %s" % (len(elig), elig[:5] if elig else ""))
print("BAND DISAGREEMENTS  %d %s" % (len(band_bad), band_bad[:5] if band_bad else ""))
if secs:
    mean = sum(secs) / len(secs)
    left = 100 - n_done
    print("seconds per member: mean %.0f, min %.0f, max %.0f" % (mean, min(secs), max(secs)))
    print("PROJECTED REMAINING %.1f h  (%d members x %.0f s)" % (left * mean / 3600, left, mean))
print("progress file written %s ago"
      % time.strftime("%Hh %Mm %Ss", time.gmtime(time.time() - os.path.getmtime(prog_p))))
