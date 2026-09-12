"""
DIAGNOSIS ONLY. Reads committed artefacts. Writes nothing into the repository.
Changes no threshold, no rule, no frozen artefact. Nothing here is applied to the cohort.

Question: is the judge's fixed bar (resid_wg_z >= 3.5) an n-dependent bar in substance,
so that the RESIDUAL_POWERED denominator -- which is defined by having the most data --
passes it at a high rate for that reason rather than because of the players.
"""
import json
import math
import os
import statistics as st

from scipy import stats

HERE = "/home/user/lichess_app/research/mechanism/replication100"
d = json.load(open(os.path.join(HERE, "COHORT_RESULTS.json")))
members = d["members"]

# ---------- 1. per-candidate: does z track n_in ----------
cands = []
for m in members:
    for c in m["candidates"]:
        if c.get("resid_wg_z") is None or not c.get("n_in"):
            continue
        cands.append((c["n_in"], c["resid_wg_z"], bool(c.get("pass")), m["u"],
                      bool(m["RESIDUAL_POWERED"])))

n_in = [c[0] for c in cands]
z = [c[1] for c in cands]
print("candidates with both n_in and z: %d" % len(cands))
rho, p = stats.spearmanr(n_in, z)
print("Spearman rho(n_in, resid_wg_z) = %+.3f   p = %.2e" % (rho, p))
r, pr = stats.pearsonr([math.log(x) for x in n_in], z)
print("Pearson  r(log n_in, resid_wg_z) = %+.3f   p = %.2e" % (r, pr))

# ---------- 2. pass rate and implied effect by n_in quintile ----------
cands_sorted = sorted(cands, key=lambda c: c[0])
k = 5
size = len(cands_sorted) // k
print("\nby n_in quintile (candidate level):")
print("%-14s %8s %9s %9s %9s %9s" % ("n_in range", "n cands", "med n_in", "med z", "pass %", "med z/sqrt(n)"))
for i in range(k):
    lo = i * size
    hi = (i + 1) * size if i < k - 1 else len(cands_sorted)
    chunk = cands_sorted[lo:hi]
    ns = [c[0] for c in chunk]
    zs = [c[1] for c in chunk]
    eff = [c[1] / math.sqrt(c[0]) for c in chunk]
    passes = sum(1 for c in chunk if c[2])
    print("%-14s %8d %9d %9.2f %8.1f%% %12.4f" % (
        "%d-%d" % (min(ns), max(ns)), len(chunk), st.median(ns), st.median(zs),
        100.0 * passes / len(chunk), st.median(eff)))

# ---------- 3. member level: best z vs the member's data volume ----------
rows = []
for m in members:
    zs = [c["resid_wg_z"] for c in m["candidates"] if c.get("resid_wg_z") is not None]
    rows.append({
        "u": m["u"], "status": m["status"],
        "rp": bool(m["RESIDUAL_POWERED"]),
        "bvd": m["blitz_validate_decisions"],
        "maxz": max(zs) if zs else None,
        "reached_residual": m["status"] in ("PERSONAL_RESIDUAL_CANDIDATE", "LEVEL_TYPICAL_ONLY"),
    })

with_z = [r for r in rows if r["maxz"] is not None and r["bvd"]]
rho2, p2 = stats.spearmanr([r["bvd"] for r in with_z], [r["maxz"] for r in with_z])
print("\nmembers with at least one candidate: %d" % len(with_z))
print("Spearman rho(blitz_validate_decisions, best z) = %+.3f   p = %.2e" % (rho2, p2))

# ---------- 4. the comparison the red flag is actually made of ----------
reached = [r for r in rows if r["reached_residual"]]
rp = [r for r in reached if r["rp"]]
not_rp = [r for r in reached if not r["rp"]]
def prc(xs):
    n = sum(1 for r in xs if r["status"] == "PERSONAL_RESIDUAL_CANDIDATE")
    return n, len(xs), (100.0 * n / len(xs) if xs else float("nan"))
print("\namong members that reached the residual stage:")
print("  RESIDUAL_POWERED     : %d/%d = %.1f%%" % prc(rp))
print("  not RESIDUAL_POWERED : %d/%d = %.1f%%" % prc(not_rp))
print("  median blitz VALIDATE decisions, powered     : %d" % st.median([r["bvd"] for r in rp]))
print("  median blitz VALIDATE decisions, not powered : %d" % st.median([r["bvd"] for r in not_rp]))

# ---------- 5. would a bar that scales with n behave differently ----------
# NOT a proposal. A measurement of what the fixed bar is doing.
print("\npass rate under the frozen bar, by whether the member is RESIDUAL_POWERED:")
for label, want in (("powered", True), ("not powered", False)):
    sub = [c for c in cands if c[4] is want]
    if not sub:
        continue
    passes = sum(1 for c in sub if c[2])
    print("  %-12s %d/%d candidates pass = %.1f%%   median n_in = %d" % (
        label, passes, len(sub), 100.0 * passes / len(sub),
        st.median([c[0] for c in sub])))
