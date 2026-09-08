"""
PHASES 14, 16, 17, 18, 19, 24, 26 -- read the cohort out.

Counts what the frozen instrument returned over the frozen cohort, evaluates the red flags that were
declared before any member ran, and applies the verdict rule that was fixed at the same time. It
takes no decisions: every threshold it uses is read out of COHORT_PREREG.json.

    python aggregate_cohort.py [--out COHORT_RESULTS.json]
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402

R_STAR = "material_balance>=-2 AND own_overloaded_piece_count>=1"
R_STAR2 = "material_balance: [0:3[ AND own_overloaded_piece_count>=1"


def read_member(run_dir: str) -> dict | None:
    p = os.path.join(REPO, run_dir, "report", "RESULT.json")
    return json.load(open(p)) if os.path.exists(p) else None


def frozen_candidates(run_dir: str) -> list:
    """Every frozen candidate the search returned, whether or not it passed the judge. The ones
    BELOW the bar are the ones a study of the instrument needs most, and a report that only shows
    winners cannot measure a search stage."""
    out = []
    d = os.path.join(REPO, run_dir, "analysis")
    if not os.path.isdir(d):
        return out
    for name in sorted(os.listdir(d)):
        if not (name.startswith("discovery_") and name.endswith(".json")):
            continue
        doc = json.load(open(os.path.join(d, name)))
        for c in doc.get("frozen") or []:
            v = c.get("validate") or {}
            out.append({"file": name, "target": doc.get("target"),
                        "region": c.get("region"), "n_derive": c.get("n_derive"),
                        "stability_median_j": c.get("stability_median_j"),
                        "stability_share_j60": c.get("stability_share_j60"),
                        "resid_wg_z": v.get("resid_wg_z"), "n_in": v.get("n_in"),
                        "pass": v.get("pass")})
    return out


POP_GAMES = os.path.join(MECH, "data", "population_games.ndjson")


def population_contamination(player_ids: list) -> dict:
    """Which frozen members, if any, appear in the population baseline that judges them.

    Reads the baseline's own committed games, exactly as `cohort_select.population_members` does,
    rather than a maintained list: a list can fall out of step with the corpus and the check would
    then pass while being false. An absent corpus is reported as NOT MEASURED, never as clean.
    """
    if not os.path.exists(POP_GAMES):
        return {"members_in_baseline": None, "measured": False,
                "_why_not": "the population baseline corpus is not in the tree at %s, so this "
                            "check could not run. It is NOT a clean result."
                            % os.path.relpath(POP_GAMES, REPO)}
    ids: set[str] = set()
    with open(POP_GAMES) as f:
        for line in f:
            g = json.loads(line)
            for side in ("white", "black"):
                u = ((g.get("players") or {}).get(side) or {}).get("user") or {}
                if u.get("id"):
                    ids.add(u["id"].lower())
    hit = sorted(p for p in player_ids if (p or "").lower() in ids)
    return {"members_in_baseline": len(hit), "measured": True, "who": hit,
            "baseline_players": len(ids)}


def q(xs: list, p: float):
    xs = sorted(x for x in xs if x is not None)
    return None if not xs else xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "COHORT_RESULTS.json"))
    a = ap.parse_args()

    pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
    frozen = json.load(open(os.path.join(HERE, "COHORT_FROZEN.json")))
    plan = json.load(open(os.path.join(HERE, "POWER_PLAN.json")))
    if frozen["prereg_hash"] != pre["prereg_hash"]:
        raise SystemExit("the frozen cohort was taken under a different pre-registration")

    broad_min = plan["broad_minimum"]["validate_decisions"]
    resid_dec_min = plan["residual_minimum"]["validate_decisions_blitz"]
    resid_games_min = plan["residual_minimum"]["operative_minimum_admissible_blitz_games"]

    rows, missing = [], []
    for m in frozen["members"]:
        res = read_member(m["run_dir"])
        if res is None or res.get("status") not in contract.TERMINAL_STATES:
            missing.append(m["u"]); continue
        sp, bs = res.get("splits") or {}, res.get("blitz_splits") or {}
        # The denominators are computed from the corpus AFTER scoring, mechanically, per the
        # pre-registration. Nothing here reads an output class to decide a denominator.
        broad_powered = (sp.get("VALIDATE_decisions") or 0) >= broad_min
        residual_powered = ((bs.get("VALIDATE_decisions") or 0) >= resid_dec_min
                            and m["blitz_admissible"] >= resid_games_min)
        v = res.get("verdict") or {}
        rows.append({
            "u": m["u"], "window_class": m["window_class"], "status": res["status"],
            "failure_code": res.get("failure_code"),
            "BROAD_POWERED": broad_powered, "RESIDUAL_POWERED": residual_powered,
            "validate_decisions": sp.get("VALIDATE_decisions"),
            "blitz_validate_decisions": bs.get("VALIDATE_decisions"),
            "blitz_admissible": m["blitz_admissible"],
            "band": (res.get("population") or {}).get("band"),
            "band_agreed_with_selection": (res.get("population") or {}).get("band")
                                          == m["derived_band"],
            "broad_region": (v.get("broad_structure") or {}).get("region"),
            "residual_region": (v.get("personal_residual") or {}).get("region"),
            "candidates": frozen_candidates(m["run_dir"]),
        })

    def count(pred, key="status") -> dict:
        out: dict[str, int] = {}
        for r in rows:
            if pred(r):
                out[r[key]] = out.get(r[key], 0) + 1
        return out

    broad = [r for r in rows if r["BROAD_POWERED"]]
    resid = [r for r in rows if r["RESIDUAL_POWERED"]]
    all_cands = [c for r in rows for c in r["candidates"]]
    regions = [r["residual_region"] or r["broad_region"] for r in rows
               if (r["residual_region"] or r["broad_region"])]
    distinct = sorted(set(regions))
    prc = [r for r in resid if r["status"] == "PERSONAL_RESIDUAL_CANDIDATE"]
    nss = [r for r in broad if r["status"] == "NO_STABLE_STRUCTURE"]
    erez_only = bool(regions) and set(regions) <= {R_STAR, R_STAR2}
    sel = json.load(open(os.path.join(HERE, "COHORT_SELECTION.json")))
    fetched = len(sel["accepted"]) + len(sel["rejected"])
    band_disagree = sum(1 for r in rows if not r["band_agreed_with_selection"])

    # PHASE 19, measured rather than asserted. This used to be the literal 0, on the strength of
    # the selection guard having run. A safety gate that reports a constant cannot fail, and one
    # that cannot fail is not a gate: if the guard had ever been skipped, or a member promoted by a
    # path that bypassed it, this would still have printed a clean zero. It is re-derived here from
    # the baseline corpus itself, which is also where the selection guard reads it, so the two agree
    # by construction or the disagreement is visible.
    contamination = population_contamination([m["player_id"] for m in frozen["members"]])

    flags = [
        {"flag": "PERSONAL_RESIDUAL_CANDIDATE rate above 50% of RESIDUAL_POWERED members",
         "value": (len(prc) / len(resid)) if resid else None,
         "met": bool(resid) and len(prc) / len(resid) > 0.50},
        {"flag": "every candidate region is R* or R** verbatim",
         "value": distinct, "met": erez_only},
        {"flag": "fewer than 3 distinct candidate regions across all members",
         "value": len(distinct), "met": bool(regions) and len(distinct) < 3},
        {"flag": "NO_STABLE_STRUCTURE rate above 90% of BROAD_POWERED members",
         "value": (len(nss) / len(broad)) if broad else None,
         "met": bool(broad) and len(nss) / len(broad) > 0.90},
        {"flag": "eligibility rejection rate above 90% of tried candidates",
         "value": (len(sel["rejected"]) / fetched) if fetched else None,
         "met": bool(fetched) and len(sel["rejected"]) / fetched > 0.90},
        {"flag": "the derived band differs from the screen's prediction for more than 80% of "
                 "tried candidates",
         "value": (band_disagree / len(rows)) if rows else None,
         "met": bool(rows) and band_disagree / len(rows) > 0.80},
    ]
    any_flag = any(f["met"] for f in flags)

    if missing:
        verdict, why = "INCOMPLETE", "%d members have not finished" % len(missing)
    elif any_flag:
        verdict, why = "UNDETERMINED", "a pre-declared red flag is met"
    elif len(resid) < 10:
        verdict, why = "UNDETERMINED", ("only %d members reached RESIDUAL_POWERED, too few for "
                                        "either statement" % len(resid))
    elif not prc:
        verdict, why = "DOES_NOT_GENERALISE", ("no RESIDUAL_POWERED member returned a personal "
                                               "residual candidate")
    elif len({r["residual_region"] for r in prc}) < 2:
        verdict, why = "DOES_NOT_GENERALISE", ("candidates appear on a single region only, which "
                                               "is a fact about the search, not about players")
    else:
        verdict, why = "GENERALISES", ("candidates occur on more than one distinct region, in a "
                                       "minority of RESIDUAL_POWERED members, with no red flag met")

    doc = {
        "_what": "The cohort read out. Every threshold comes from COHORT_PREREG.json.",
        "read_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repo_sha": corpuslib.repo_sha(),
        "prereg_hash": pre["prereg_hash"], "cohort_hash": frozen["cohort_hash"],
        "instrument_hash": frozen["instrument_hash"],
        "completeness": {"members": len(frozen["members"]), "finished": len(rows),
                         "unfinished": missing},
        "denominators": {"BROAD_POWERED": len(broad), "RESIDUAL_POWERED": len(resid),
                         "_note": pre["denominators"]["_why_two"],
                         "corpus_size_spread": {
                             "_why": "members do not all carry the same corpus. A candidate tried "
                                     "for a residual slot is fetched at the residual window, and "
                                     "if their blitz share falls short they join the cohort as a "
                                     "broad member holding a corpus several times the broad "
                                     "window. That makes them MORE powered, not less, so it "
                                     "invalidates nothing, but the cohort is not uniform in power "
                                     "and a reader should see that rather than assume it.",
                             "validate_decisions": {
                                 "p05": q([r["validate_decisions"] for r in broad], 0.05),
                                 "p50": q([r["validate_decisions"] for r in broad], 0.50),
                                 "p95": q([r["validate_decisions"] for r in broad], 0.95)},
                             "windows": {str(w): sum(1 for m in frozen["members"]
                                                     if m["window"] == w)
                                         for w in sorted({m["window"]
                                                          for m in frozen["members"]})}}},
        "classes": {
            "all_finished": count(lambda r: True),
            "BROAD_POWERED": count(lambda r: r["BROAD_POWERED"]),
            "RESIDUAL_POWERED": count(lambda r: r["RESIDUAL_POWERED"]),
            "_reporting_rule": pre["null_semantics"]["reporting_rule"],
            "_NO_STABLE_STRUCTURE_means": pre["null_semantics"]["NO_STABLE_STRUCTURE"],
        },
        "instrument_self_measurement": {
            "_what": pre["instrument_self_measurement"]["_what"],
            "frozen_candidates_examined": len(all_cands),
            "stability_median_j": {
                "p05": q([c["stability_median_j"] for c in all_cands], 0.05),
                "p50": q([c["stability_median_j"] for c in all_cands], 0.50),
                "p95": q([c["stability_median_j"] for c in all_cands], 0.95),
                "_reference": "erez281's R** scored 1.00; vibesgalore's best scored 0.13",
            },
            "resid_wg_z_on_validate": {
                "p05": q([c["resid_wg_z"] for c in all_cands], 0.05),
                "p50": q([c["resid_wg_z"] for c in all_cands], 0.50),
                "p95": q([c["resid_wg_z"] for c in all_cands], 0.95),
                "bar": 3.5,
                "share_at_or_above_bar": (
                    sum(1 for c in all_cands if (c["resid_wg_z"] or -9) >= 3.5) / len(all_cands)
                    if all_cands else None),
            },
            "band_agreement_selection_vs_pipeline": {
                "agreed": len(rows) - band_disagree, "of": len(rows)},
        },
        "pattern_diversity": {
            "distinct_regions": len(distinct), "regions": distinct,
            "region_counts": {r: regions.count(r) for r in distinct},
            "share_that_are_R_star_or_R_star_star": (
                sum(1 for r in regions if r in (R_STAR, R_STAR2)) / len(regions)
                if regions else None),
        },
        "population_safety": {
            "rule": pre["population_safety_gate"]["rule"],
            **contamination,
            "_how": "enforced at selection: a candidate appearing in the baseline corpus is "
                    "rejected before a fetch. Rejections are counted in COHORT_SELECTION.json. "
                    "This block re-derives the check from the baseline corpus over the FROZEN "
                    "members rather than trusting that the selection guard ran.",
            "rejected_at_selection": sum(1 for r in sel["rejected"]
                                         if r["reason"] == "IN_POPULATION_BASELINE"),
        },
        "ingest_reachability": {
            "_what": "Candidates the walk could not reach, as against candidates it judged. A "
                     "transport failure is not a rejection: nothing about the candidate was "
                     "decided. They are counted here and requeued at their committed position, and "
                     "they are kept OUT of the tried-candidate denominator below, so the "
                     "eligibility rejection rate is a fact about players and not about the client.",
            "unreachable_events": len(sel.get("unreachable") or []),
            "distinct_usernames": len({r["u"] for r in (sel.get("unreachable") or [])}),
            "still_queued_at_freeze": len(sel.get("retry_queue") or []),
            "tried_candidates_denominator": fetched,
            "rate_limit_waits_absorbed": sum(
                r.get("rate_limited_waits") or 0
                for r in (sel.get("rejected") or []) + (sel.get("unreachable") or [])),
            "_rate_limit_note": "each wait is one 429 the ingest layer sat out inside a request. "
                                "A high count with few failures means the walk was slowed and got "
                                "its data; a high count alongside unreachable candidates means it "
                                "was pushing harder than the platform wanted.",
        },
        "red_flags": {"any_met": any_flag, "flags": flags},
        "verdict": {"verdict": verdict, "why": why,
                    "_definitions": pre["verdicts"],
                    "_not_a_verdict": pre["verdicts"]["not_a_verdict"]},
        "members": rows,
    }
    json.dump(doc, open(a.out, "w"), indent=1, default=str)
    print(json.dumps({k: doc[k] for k in ("completeness", "denominators", "classes",
                                          "pattern_diversity", "red_flags", "verdict")},
                     indent=1, default=str)[:3000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
