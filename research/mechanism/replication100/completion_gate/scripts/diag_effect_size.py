"""
DIAGNOSIS ONLY. Reads committed artefacts, writes nothing into the repository, applies no
threshold to the cohort and changes no frozen rule.

Two questions the quintile table raises:
  1. how much of the rise in resid_wg_z across n is just sqrt(n)
  2. once n is divided out, do the RESIDUAL_POWERED members still look different from the rest,
     or is the 68% entirely a property of which members are in that denominator
"""
import json
import math
import os
import statistics as st

from scipy import stats

HERE = "/home/user/lichess_app/research/mechanism/replication100"
d = json.load(open(os.path.join(HERE, "COHORT_RESULTS.json")))
members = d["members"]

cands = []
for m in members:
    for c in m["candidates"]:
        z, n = c.get("resid_wg_z"), c.get("n_in")
        if z is None or n is None or not n:
            continue
        if not (isinstance(z, (int, float)) and math.isfinite(z)):
            continue
        cands.append({"n": n, "z": z, "pass": bool(c.get("pass")),
                      "u": m["u"], "rp": bool(m["RESIDUAL_POWERED"]),
                      "eff": z / math.sqrt(n)})

print("usable candidates: %d of 835" % len(cands))
ns = [c["n"] for c in cands]
zs = [c["z"] for c in cands]
ef = [c["eff"] for c in cands]

rho, p = stats.spearmanr(ns, zs)
print("Spearman rho(n_in, z)          = %+.3f  p = %.2e" % (rho, p))
rho_e, p_e = stats.spearmanr(ns, ef)
print("Spearman rho(n_in, z/sqrt(n))  = %+.3f  p = %.2e" % (rho_e, p_e))

# how much of the z rise is sqrt(n): regress log z on log n, slope 0.5 means pure sqrt(n)
lz = [math.log(c["z"]) for c in cands if c["z"] > 0]
ln = [math.log(c["n"]) for c in cands if c["z"] > 0]
sl, ic, r, pv, se = stats.linregress(ln, lz)
print("\nlog z on log n_in: slope = %.3f (se %.3f), r2 = %.3f" % (sl, se, r * r))
print("  slope 0.50 is exactly what a fixed effect measured with more data looks like")
print("  slope 0.00 would mean n does not move the statistic at all")

# ---- the decisive split: effect size, powered vs not ----
pw = [c["eff"] for c in cands if c["rp"]]
npw = [c["eff"] for c in cands if not c["rp"]]
print("\nimplied effect size z/sqrt(n_in), by member class:")
print("  RESIDUAL_POWERED     n=%4d  median %.4f  IQR %.4f-%.4f" % (
    len(pw), st.median(pw), st.quantiles(pw, n=4)[0], st.quantiles(pw, n=4)[2]))
print("  not RESIDUAL_POWERED n=%4d  median %.4f  IQR %.4f-%.4f" % (
    len(npw), st.median(npw), st.quantiles(npw, n=4)[0], st.quantiles(npw, n=4)[2]))
u, pu = stats.mannwhitneyu(pw, npw, alternative="two-sided")
print("  Mann-Whitney two-sided p = %.3f" % pu)

# same thing at member level, one number per member so heavy members cannot dominate
best = {}
for c in cands:
    if c["u"] not in best or c["eff"] > best[c["u"]]["eff"]:
        best[c["u"]] = c
bp = [v["eff"] for v in best.values() if v["rp"]]
bn = [v["eff"] for v in best.values() if not v["rp"]]
print("\nbest candidate per member, implied effect size:")
print("  RESIDUAL_POWERED     n=%3d  median %.4f" % (len(bp), st.median(bp)))
print("  not RESIDUAL_POWERED n=%3d  median %.4f" % (len(bn), st.median(bn)))
u2, pu2 = stats.mannwhitneyu(bp, bn, alternative="two-sided")
print("  Mann-Whitney two-sided p = %.3f" % pu2)
