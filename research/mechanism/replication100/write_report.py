"""
PHASES 14, 16, 20-26 -- the written report.

Renders COHORT_RESULTS.json into REPLICATION_100_REPORT.md. It states no number the results file
does not carry and reaches no verdict the pre-registration did not define, so the report cannot
say more than the run earned.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(MECH, "replication"))
import contract          # noqa: E402

CLASSES = ("PERSONAL_RESIDUAL_CANDIDATE", "LEVEL_TYPICAL_ONLY", "NO_STABLE_STRUCTURE",
           "INSUFFICIENT_EVIDENCE")


def pct(n, d):
    return "—" if not d else "%.1f%%" % (100.0 * n / d)


def fmt(x, nd=3):
    return "—" if x is None else (("%%.%df" % nd) % x if isinstance(x, float) else str(x))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "REPLICATION_100_REPORT.md"))
    a = ap.parse_args()
    r = json.load(open(os.path.join(HERE, "COHORT_RESULTS.json")))
    pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
    plan = json.load(open(os.path.join(HERE, "POWER_PLAN.json")))
    frozen = json.load(open(os.path.join(HERE, "COHORT_FROZEN.json")))

    nb = r["denominators"]["BROAD_POWERED"]
    nr = r["denominators"]["RESIDUAL_POWERED"]
    cb, cr = r["classes"]["BROAD_POWERED"], r["classes"]["RESIDUAL_POWERED"]
    sm = r["instrument_self_measurement"]
    L = []
    w = L.append

    w("# 100 players, one frozen instrument")
    w("")
    w("What the mechanism-discovery pipeline returns when it is pointed at a hundred Lichess "
      "players it was never built around. The question is the DISTRIBUTION of outcomes, not "
      "whether a hundredth residual could be found.")
    w("")
    w("| | |")
    w("|---|---|")
    w("| `instrument_hash` | `%s` |" % r["instrument_hash"])
    w("| `prereg_hash` | `%s` |" % r["prereg_hash"])
    w("| `cohort_hash` | `%s` |" % r["cohort_hash"])
    w("| members frozen | %d |" % r["completeness"]["members"])
    w("| members finished | %d |" % r["completeness"]["finished"])
    w("")
    w("Every threshold below was fixed in `COHORT_PREREG.json` before a username was chosen. "
      "The instrument was frozen before that.")
    w("")

    w("## How the cohort was reached")
    w("")
    sw = frozen["selection_walk"]
    w("| stage | n |")
    w("|---|---|")
    w("| frame walked | %d |" % sw["walked"])
    for k, v in sorted(sw.get("prefiltered_without_a_fetch", {}).items()):
        w("| skipped without a fetch: %s | %d |" % (k, v))
    w("| fetched and tried | %d |" % sw["fetched"])
    for k, v in sorted(sw["rejection_reasons"].items()):
        w("| rejected: %s | %d |" % (k, v))
    w("| **accepted** | **%d** |" % frozen["n_members"])
    w("")
    w("Every rejection is a pre-analysis failure. No candidate was replaced for anything a run "
      "found, and no run that reached a result was discarded.")
    w("")

    w("## The two denominators")
    w("")
    w("A player can be large enough for the instrument to judge a BROAD structure and far too "
      "small for it to judge a PERSONAL RESIDUAL. Pooling them would report residual nulls that "
      "are properties of corpus size.")
    w("")
    w("| denominator | rule | n |")
    w("|---|---|---|")
    w("| BROAD_POWERED | ≥ %d VALIDATE decisions | %d |"
      % (plan["broad_minimum"]["validate_decisions"], nb))
    w("| RESIDUAL_POWERED | ≥ %d blitz VALIDATE decisions and ≥ %d admissible blitz games | %d |"
      % (plan["residual_minimum"]["validate_decisions_blitz"],
         plan["residual_minimum"]["operative_minimum_admissible_blitz_games"], nr))
    w("")

    w("## What the instrument returned")
    w("")
    w("| class | of BROAD_POWERED (%d) | of RESIDUAL_POWERED (%d) |" % (nb, nr))
    w("|---|---|---|")
    for c in CLASSES:
        w("| `%s` | %d (%s) | %d (%s) |"
          % (c, cb.get(c, 0), pct(cb.get(c, 0), nb), cr.get(c, 0), pct(cr.get(c, 0), nr)))
    w("")
    # The definition already contains the caveat sentence, so quote it whole. Splitting it and
    # prefixing a bold lead printed the same claim twice, which reads as emphasis and is padding.
    w("**`NO_STABLE_STRUCTURE`**: " + pre["null_semantics"]["NO_STABLE_STRUCTURE"])
    w("")
    w("`LEVEL_TYPICAL_ONLY` is the class that says a structure was found and the same-rating "
      "population explains it. The four counts are never summed into found versus not found.")
    w("")

    w("## The instrument, measured on itself")
    w("")
    w("A hundred runs make quantities visible that two runs could only hint at.")
    w("")
    w("| | p05 | p50 | p95 |")
    w("|---|---|---|---|")
    st, z = sm["stability_median_j"], sm["resid_wg_z_on_validate"]
    w("| `stability_median_j` of frozen candidates | %s | %s | %s |"
      % (fmt(st["p05"]), fmt(st["p50"]), fmt(st["p95"])))
    w("| `resid_wg_z` on VALIDATE | %s | %s | %s |"
      % (fmt(z["p05"], 2), fmt(z["p50"], 2), fmt(z["p95"], 2)))
    w("")
    w("%d frozen candidates examined; %s of them reach the judge's bar of %s. Reference: "
      "erez281's R\\*\\* scored `stability_median_j` 1.00, vibesgalore's best scored 0.13."
      % (sm["frozen_candidates_examined"],
         pct(round((z["share_at_or_above_bar"] or 0) * sm["frozen_candidates_examined"]),
             sm["frozen_candidates_examined"]), z["bar"]))
    w("")
    ba = sm["band_agreement_selection_vs_pipeline"]
    w("The band derived at selection from admissible games agreed with the band the pipeline "
      "derives from scored decisions for %d of %d members. Two implementations of one rule, "
      "measured rather than assumed." % (ba["agreed"], ba["of"]))
    w("")

    w("## Population safety")
    w("")
    ps = r["population_safety"]
    w("**Rule.** " + ps["rule"])
    w("")
    if ps.get("measured"):
        w("Re-derived here from the baseline corpus over the frozen members, not carried over from "
          "selection: **%d of %d** members appear among the %d players in the baseline that judges "
          "them. %d candidates were rejected at selection for exactly this."
          % (ps["members_in_baseline"], len(r["members"]), ps["baseline_players"],
             ps["rejected_at_selection"]))
        if ps["members_in_baseline"]:
            w("")
            w("**The gate is red.** Members also in the baseline: `%s`. Their population "
              "correction is judged partly against their own games, so their results cannot be "
              "read as this protocol intends." % "`, `".join(ps["who"]))
    else:
        w("**NOT MEASURED.** " + ps["_why_not"])
    w("")

    w("## Pattern diversity")
    w("")
    pd = r["pattern_diversity"]
    w("%d distinct candidate regions across the cohort. %s of candidates are R\\* or R\\*\\* "
      "verbatim, which are erez281's own."
      % (pd["distinct_regions"],
         "—" if pd["share_that_are_R_star_or_R_star_star"] is None
         else "%.1f%%" % (100 * pd["share_that_are_R_star_or_R_star_star"])))
    w("")
    if pd["region_counts"]:
        w("| region | members |")
        w("|---|---|")
        for reg, n in sorted(pd["region_counts"].items(), key=lambda kv: -kv[1]):
            w("| `%s` | %d |" % (reg, n))
        w("")

    w("## Red flags, declared before any result")
    w("")
    w("| flag | value | met |")
    w("|---|---|---|")
    for f in r["red_flags"]["flags"]:
        v = f["value"]
        vs = ("%.1f%%" % (100 * v)) if isinstance(v, float) else str(v)
        w("| %s | %s | %s |" % (f["flag"], vs[:80], "**YES**" if f["met"] else "no"))
    w("")

    w("## Verdict")
    w("")
    w("### `%s`" % r["verdict"]["verdict"])
    w("")
    w(r["verdict"]["why"])
    w("")
    w("**%s**" % pre["verdicts"]["not_a_verdict"])
    w("")
    w("## What this cannot say")
    w("")
    for rung, owner, note in contract.CLAIM_LADDER:
        w("- **%s** (%s): %s" % (rung, owner, note))
    w("")
    w("The claim ladder is unchanged by sample size. A hundred players buy a distribution, not a "
      "rung.")
    w("")

    open(a.out, "w").write("\n".join(L) + "\n")
    print(json.dumps({"out": a.out, "verdict": r["verdict"]["verdict"],
                      "broad_powered": nb, "residual_powered": nr,
                      "classes_residual": cr}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
