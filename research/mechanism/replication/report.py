"""
PHASE 17 -- THE REPLICATION REPORT.

One fixed shape per player, so two runs can be read side by side, and so the rungs of the claim
ladder stay separated on the page and not only in someone's head:

    OBSERVATION -> PREDICTION -> SPECIFICITY -> CAUSALITY -> INTERVENTION -> OUTCOME

The last three are not reachable by this pipeline under any result. The report says so on every
run, including a run that found a residual, because a residual is a candidate, not a cause.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract


def _fmt_pct(x) -> str:
    return "n/a" if x is None else f"{100 * float(x):.1f}%"


def _fmt_pp(x) -> str:
    return "n/a" if x is None else f"{100 * float(x):+.1f} pp"


def _fmt_z(x) -> str:
    return "n/a" if x is None else f"{float(x):.2f}"


def _candidate_block(title: str, cand: dict | None) -> list[str]:
    if not cand:
        return [f"## {title}", "", "None.", ""]
    v = cand.get("validate") or {}
    return [
        f"## {title}", "",
        f"    {cand['region']}", "",
        f"| frozen on DERIVE | n {cand.get('n_derive')} | rate in/out "
        f"{_fmt_pct(cand.get('derive_err_in'))} / {_fmt_pct(cand.get('derive_err_out'))} | "
        f"within-game {_fmt_pp(cand.get('derive_wg_est'))} (z {_fmt_z(cand.get('derive_wg_z'))}) |",
        f"| judged on VALIDATE | n_in {v.get('n_in')} | rate in/out {_fmt_pct(v.get('p_in'))} / "
        f"{_fmt_pct(v.get('p_out'))} | within-game {_fmt_pp(v.get('wg_est'))} "
        f"(z {_fmt_z(v.get('wg_z'))}), residual z {_fmt_z(v.get('resid_wg_z'))} |",
        f"| stability | {_fmt_pct(cand.get('stability_share_j60'))} of 30 game-level bootstrap "
        f"winners share Jaccard >= 0.60 with it (median J {cand.get('stability_median_j')}) |",
        "",
    ]


def render(state: dict) -> str:
    v = state.get("verdict") or {}
    ev = state.get("evidence") or {}
    focal = state.get("focal") or {}
    corpus = state.get("corpus") or {}
    L: list[str] = []
    L += [f"# Replication report — {focal.get('platform')}/{focal.get('username')}", ""]
    L += [f"**Result:** `{state.get('status')}`" + (f" (`{state['failure_code']}`)" if state.get("failure_code") else ""), ""]
    L += [v.get("reason", ""), ""]
    L += ["| | |", "| --- | --- |",
          f"| contract | `{state.get('contract_version')}` |",
          f"| repo SHA | `{state.get('repo_sha')}` |",
          f"| pipeline hash | `{state.get('pipeline_hash')}` |",
          f"| run directory | `{state.get('run_dir')}` |", ""]

    L += ["## PLAYER", "",
          f"- platform: {focal.get('platform')}",
          f"- username: {focal.get('username')} (canonical id `{focal.get('player_id')}`)",
          f"- corpus label: `{focal.get('corpus')}`", ""]

    L += ["## CORPUS", "",
          f"- fetched: {corpus.get('fetched')}",
          f"- admissible under the frozen rule: {corpus.get('admissible')}",
          f"- scorable (admissible AND standard variant): {corpus.get('scorable')}",
          f"- eligible decisions: {corpus.get('eligible_decisions')}",
          f"- speeds: {corpus.get('speeds')}", ""]

    L += ["## ELIGIBILITY", "", "Every exclusion, by the baseline's own reason vocabulary:", ""]
    for reason, n in sorted((corpus.get("exclusions") or {}).items()):
        L.append(f"- `{reason}`: {n}")
    L += ["", "Ids of every excluded game are in `admissible/exclusions.json`.", ""]

    sp = state.get("splits") or {}
    L += ["## SPLITS", "",
          f"- DERIVE {sp.get('DERIVE_decisions')} decisions / {sp.get('DERIVE_games')} games",
          f"- VALIDATE {sp.get('VALIDATE_decisions')} / {sp.get('VALIDATE_games')}",
          f"- TEST {sp.get('TEST_decisions')} / {sp.get('TEST_games')} (opened once, for the frozen candidate only)", ""]

    L += _candidate_block("BROAD STRUCTURE (R*)", v.get("broad_structure"))

    holdout = (ev.get("holdout_test") or {}).get("frames", {}).get("TEST")
    L += ["## HOLDOUT RESULT (TEST)", ""]
    if holdout:
        rc = holdout.get("region_contrast") or {}
        m = holdout.get("models") or {}
        L += [f"- region on TEST: n_in {rc.get('n_in')}, rate in/out {_fmt_pct(rc.get('p_in'))} / "
              f"{_fmt_pct(rc.get('p_out'))} (z {_fmt_z(rc.get('z'))})",
              f"- held-out log-loss / AUC: baseline {m.get('M3_baseline', {}).get('logloss')} / "
              f"{m.get('M3_baseline', {}).get('auc')} → baseline + region "
              f"{m.get('M4_baseline_region', {}).get('logloss')} / {m.get('M4_baseline_region', {}).get('auc')}",
              f"- within-game label-shuffle p for the region's gain: {holdout.get('shuffled_gain_p')}", ""]
    else:
        L += ["Not opened: no candidate reached it.", ""]

    L += ["## POPULATION COMPARISON", ""]
    pop = state.get("population") or {}
    L += [f"- band derived from the focal player's own blitz median rating: {pop.get('band')} "
          f"(median {pop.get('focal_blitz_median_rating')})",
          f"- population corpus: `{state.get('population_id')}` — resolution `{pop.get('status')}`"]
    pcmp = ev.get("population")
    if pcmp:
        per = pcmp.get("per_side") or {}
        L += [f"- the same region in the population: raw {_fmt_pp((pcmp.get('population') or {}).get('raw', {}).get('diff'))}, "
              f"residual {_fmt_pp((pcmp.get('population') or {}).get('resid', {}).get('diff'))}",
              f"- per-side elevation across {per.get('n_sides')} population sides: mean "
              f"{_fmt_pp(per.get('elev_mean'))}, sd {_fmt_pp(per.get('elev_sd'))}",
              f"- this player sits at the {(100 * per['focal_percentile']):.0f}th percentile of that distribution"
              if per.get("focal_percentile") is not None else "",
              f"- leakage guard: {pcmp.get('leakage_guard')}"]
    L += [""]

    L += _candidate_block("PERSONAL RESIDUAL (R**)", v.get("personal_residual"))

    L += ["## CANNOT INFER", "",
          "Under every result this pipeline can produce, the following remain unsupported:", "",
          "- any cognitive account of the region (attention, calculation depth, \"seeing\", rushing,",
          "  motivation, valuation state);",
          "- that any instruction changes the rate inside the region;",
          "- any outcome of an intervention.", "",
          "The rungs and their authorities:", "",
          "| rung | authority | reachable here |", "| --- | --- | --- |"]
    for rung, authority, note in contract.CLAIM_LADDER:
        L.append(f"| {rung} | {authority} | {note} |")
    L += [""]

    L += ["## NEXT TEST", ""]
    cls = state.get("status")
    if cls == "PERSONAL_RESIDUAL_CANDIDATE":
        L += ["A field test is the only thing that can move this past a candidate: the frozen",
              "alternating-block protocol of `FIELD_PROTOCOL_TEMPLATE.md`, instantiated for this",
              "region with a matched sham, an exposure log and the policy-signature endpoint.",
              "A second held-out window, or a larger population sample, is what would reverse it."]
    elif cls == "LEVEL_TYPICAL_ONLY":
        L += ["Nothing personal to test. The region is real for this player and is what the band",
              "does; a coaching claim about it would be a claim about the band."]
    elif cls == "NO_STABLE_STRUCTURE":
        L += ["Nothing to test. The frozen vocabulary found no recurring region on this record.",
              "That is a result about this player under this vocabulary, not a defect of the run."]
    else:
        L += ["More games, or a population corpus for this band. Neither is a re-tuning:",
              "both are the same pipeline with the input it needs."]
    L += ["", "---", "",
          "*Generated by `research/mechanism/replication/run.py`. The rules it ran under were frozen",
          "before this player's data was fetched; see `REPLICATION_PREREG.json` in the run directory.*", ""]
    return "\n".join(x for x in L if x is not None)


def write(run_dir: str, state: dict) -> str:
    path = os.path.join(run_dir, "report", "REPORT.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(render(state))
    return path


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-dir", required=True)
    a = ap.parse_args()
    state = json.load(open(os.path.join(a.run_dir, "report", "RESULT.json")))
    print(write(a.run_dir, state))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
