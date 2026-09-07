"""
PHASE 2 -- power before players.

How many decisions does a player need before the frozen instrument is CAPABLE of returning
PERSONAL_RESIDUAL_CANDIDATE for them? Answered before a single username is chosen, so that a null
result can be read as "the instrument looked and found nothing" rather than "the instrument could
not have found anything here".

Everything here is derived from the two runs already on the record. Nothing is typed in by hand.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
sys.path.insert(0, os.path.join(MECH, "analysis"))
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402
import vocab             # noqa: E402

RUNS = os.path.join(MECH, "replications")
REF = "lichess_erez281_RUNOFRECORD"
NEG = "lichess_vibesgalore_B"

# The public HTML enumeration ceiling, measured -- not assumed. See replication/enumerate_ids_html.py.
HTML_PAGES = 40
HTML_PER_PAGE = 12


def result(run: str) -> dict:
    return json.load(open(os.path.join(RUNS, run, "report", "RESULT.json")))


def discovery(run: str, name: str) -> dict:
    return json.load(open(os.path.join(RUNS, run, "analysis", "discovery_%s.json" % name)))


def main() -> int:
    ref, neg = result(REF), result(NEG)
    # The bar is read out of the frozen design, never retyped here. `k` is the residual within-game
    # z the VALIDATE judge demands; `min_n_validate` is the in-region floor.
    bar = float(vocab.DESIGN["k"])
    min_n_in = int(vocab.DESIGN["min_n_validate"])

    # ---- reference effects: the two arms of the erez281 finding, on VALIDATE ----
    broad = ref["verdict"]["broad_structure"]
    resid = ref["verdict"]["personal_residual"]
    b_v, r_v = broad["validate"], resid["validate"]

    # ---- JUDGE-stage requirement -------------------------------------------------------------
    # The judge is a within-game contrast z on VALIDATE. For a fixed effect size and a fixed
    # in-region share, z scales as sqrt(n). So the n at which an erez281-sized effect would land
    # exactly on the bar is n_ref * (bar / z_ref)^2. Below that n, the instrument cannot return a
    # candidate even if the effect is really there at erez281's magnitude.
    def judge_min(n_ref: int, z_ref: float) -> int:
        return int(math.ceil(n_ref * (bar / z_ref) ** 2))

    broad_validate_min = judge_min(ref["splits"]["VALIDATE_decisions"], b_v["resid_wg_z"])
    resid_validate_min = judge_min(ref["blitz_splits"]["VALIDATE_decisions"], r_v["resid_wg_z"])

    # ---- conversion: VALIDATE decisions -> admissible games --------------------------------
    vfrac = contract.SPLIT["validate_frac"]
    dpg_all = ref["corpus"]["eligible_decisions"] / ref["corpus"]["scorable"]
    bs = ref["blitz_splits"]
    blitz_dec = bs["DERIVE_decisions"] + bs["VALIDATE_decisions"] + bs["TEST_decisions"]
    blitz_games = bs["DERIVE_games"] + bs["VALIDATE_games"] + bs["TEST_games"]
    dpg_blitz = blitz_dec / blitz_games
    dpg_neg = neg["corpus"]["eligible_decisions"] / neg["corpus"]["scorable"]

    broad_games_min = int(math.ceil(broad_validate_min / vfrac / dpg_all))
    resid_blitz_games_min = int(math.ceil(resid_validate_min / vfrac / dpg_blitz))

    # ---- SEARCH-stage floor -----------------------------------------------------------------
    # The judge is not the only stage that can fail for want of data. Beam search picks the region
    # inside DERIVE; if DERIVE is thin, the bootstrap winners disagree and the frozen candidate is
    # whatever won a noisy draw. This is an OBSERVATION from two runs, not a power curve.
    ref_hm = discovery(REF, "POP_cls_hung_material")["frozen"][0]
    neg_hm = discovery(NEG, "POP_cls_hung_material")["frozen"][0]
    ref_share = ref_hm["n_derive"] / ref["blitz_splits"]["DERIVE_decisions"]
    search_derive_min = int(math.ceil(ref_hm["n_derive"] / ref_share))
    search_blitz_games_min = int(math.ceil(
        search_derive_min / contract.SPLIT["derive_frac"] / dpg_blitz))

    # ---- what the enumeration ceiling actually permits ---------------------------------------
    raw_cap = HTML_PAGES * HTML_PER_PAGE
    adm_rate = neg["corpus"]["admissible"] / neg["corpus"]["fetched"]
    blitz_rate = neg["corpus"]["speeds"]["blitz"] / neg["corpus"]["fetched"]
    cap_admissible = int(raw_cap * adm_rate)
    cap_blitz = int(raw_cap * blitz_rate)

    doc = {
        "_what": "Power before players. The decision volume at which the frozen instrument becomes "
                 "CAPABLE of returning PERSONAL_RESIDUAL_CANDIDATE, computed from the runs already "
                 "on the record, before any cohort member is named.",
        "_why": "So that a null result can be read as evidence about the player rather than "
                "evidence about the corpus size.",
        "written_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "instrument_hash": json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))["instrument_hash"],
        "repo_sha": corpuslib.repo_sha(),

        "thresholds": {
            "judge": {
                "_source": "research/mechanism/analysis/vocab.py DESIGN, inside the pipeline hash",
                "residual_within_game_z": bar,
                "n_in": min_n_in,
                "raw_within_game": "> 0",
            },
            "note": "The bar is the instrument's, not this plan's. This plan only asks at what n "
                    "an erez281-sized effect would reach it.",
        },

        "reference_effects": {
            "_source": "research/mechanism/replications/%s/report/RESULT.json" % REF,
            "_caveat": "One player. These are the only effect sizes this instrument has ever "
                       "produced at candidate strength, so they are the only ones available to "
                       "power against. They are almost certainly at the optimistic end: erez281 is "
                       "the case the method was developed on.",
            "broad": {
                "target": broad["target"], "region": broad["region"],
                "resid_wg_est": b_v["resid_wg_est"], "resid_wg_z": b_v["resid_wg_z"],
                "n_validate": ref["splits"]["VALIDATE_decisions"],
                "n_in": b_v["n_in"], "in_region_share": b_v["n_in"] / ref["splits"]["VALIDATE_decisions"],
            },
            "residual": {
                "target": resid["target"], "region": resid["region"],
                "resid_wg_est": r_v["resid_wg_est"], "resid_wg_z": r_v["resid_wg_z"],
                "n_validate_blitz": ref["blitz_splits"]["VALIDATE_decisions"],
                "n_in": r_v["n_in"],
                "in_region_share": r_v["n_in"] / ref["blitz_splits"]["VALIDATE_decisions"],
            },
        },

        "reference_n": {
            "erez281": {"scorable_games": ref["corpus"]["scorable"],
                        "eligible_decisions": ref["corpus"]["eligible_decisions"],
                        "blitz_games": ref["corpus"]["speeds"]["blitz"],
                        "decisions_per_game": round(dpg_all, 3),
                        "splits": ref["splits"], "blitz_splits": ref["blitz_splits"]},
            "vibesgalore": {"scorable_games": neg["corpus"]["scorable"],
                            "eligible_decisions": neg["corpus"]["eligible_decisions"],
                            "blitz_games": neg["corpus"]["speeds"]["blitz"],
                            "decisions_per_game": round(dpg_neg, 3),
                            "splits": neg["splits"], "blitz_splits": neg["blitz_splits"]},
            "decisions_per_game_observed_range": [round(min(dpg_all, dpg_neg), 3),
                                                  round(max(dpg_all, dpg_neg), 3)],
            "decisions_per_blitz_game_reference": round(dpg_blitz, 3),
        },

        "calculation": {
            "judge_formula": "n_min = n_ref * (z_bar / z_ref)^2",
            "judge_assumes": [
                "the same residual effect size as erez281",
                "the same in-region share of decisions",
                "z grows as sqrt(n), which holds for a fixed contrast with independent games",
            ],
            "games_formula": "games_min = ceil(n_min / validate_frac / decisions_per_game)",
            "games_assumes": ["erez281's decisions-per-game; a player with more moves per game "
                              "clears the bar on fewer games, and vice versa"],
            "search_formula": "derive_min = n_derive_in_region(erez281 R**) / in_region_share",
            "search_basis": "OBSERVATIONAL, n=2. Not a power curve.",
        },

        "broad_minimum": {
            "_definition": "BROAD_POWERED: the corpus is large enough that an erez281-sized BROAD "
                           "effect (cls_tactical) would reach the judge's bar on VALIDATE.",
            "validate_decisions": broad_validate_min,
            "eligible_decisions": int(math.ceil(broad_validate_min / vfrac)),
            "admissible_games": broad_games_min,
            "speeds": "all admissible speeds",
        },

        "residual_minimum": {
            "_definition": "RESIDUAL_POWERED: the corpus is large enough that an erez281-sized "
                           "PERSONAL RESIDUAL (cls_hung_material, after the population model) would "
                           "reach the judge's bar on blitz VALIDATE.",
            "validate_decisions_blitz": resid_validate_min,
            "eligible_decisions_blitz": int(math.ceil(resid_validate_min / vfrac)),
            "admissible_blitz_games": resid_blitz_games_min,
            "speeds": "blitz only (the population baseline is blitz-only by contract)",
            "search_floor": {
                "_definition": "The judge is not the binding stage. Beam search picks the region "
                               "inside DERIVE, and on a thin DERIVE the bootstrap winners disagree, "
                               "so the frozen candidate is a noisy draw rather than a structure. "
                               "A run can be JUDGE-powered and still be unable to FIND anything.",
                "erez281_R2star": {"n_derive_in_region": ref_hm["n_derive"],
                                   "in_region_share_of_blitz_derive": round(ref_share, 4),
                                   "stability_share_j60": ref_hm["stability_share_j60"],
                                   "stability_median_j": ref_hm["stability_median_j"]},
                "vibesgalore_best": {"n_derive_in_region": neg_hm["n_derive"],
                                     "stability_share_j60": neg_hm["stability_share_j60"],
                                     "stability_median_j": neg_hm["stability_median_j"],
                                     "reading": "bootstrap resamples did not agree on a region; the "
                                                "search stage, not the judge, is what failed here"},
                "blitz_derive_decisions": search_derive_min,
                "admissible_blitz_games": search_blitz_games_min,
                "binds_above_judge": search_blitz_games_min > resid_blitz_games_min,
            },
            "operative_minimum_admissible_blitz_games": max(resid_blitz_games_min,
                                                            search_blitz_games_min),
        },

        "enumeration_ceiling": {
            "_what": "What a player's corpus can be WITHOUT a LICHESS_API_TOKEN. The by-username "
                     "export endpoint returns 404 unauthenticated; the public HTML game list is the "
                     "only enumeration path and it is hard-capped.",
            "pages": HTML_PAGES, "ids_per_page": HTML_PER_PAGE, "raw_ids_max": raw_cap,
            "observed_rates_source": NEG,
            "admissible_rate": round(adm_rate, 4), "blitz_rate": round(blitz_rate, 4),
            "max_admissible_games": cap_admissible, "max_blitz_games": cap_blitz,
            "broad_reachable": cap_admissible >= broad_games_min,
            "broad_margin": round(cap_admissible / broad_games_min, 3),
            "residual_reachable": cap_blitz >= max(resid_blitz_games_min, search_blitz_games_min),
            "residual_deficit_factor": round(
                max(resid_blitz_games_min, search_blitz_games_min) / cap_blitz, 2),
        },

        "limitations": [
            "One reference player. The effect sizes powered against come from the single case the "
            "method was developed on, so they are an upper end, not a typical value. If real "
            "personal residuals in the population are half erez281's size, every minimum here is "
            "four times too small.",
            "Root-n scaling covers the JUDGE only. The SEARCH stage has no power calculation at "
            "all; its floor here is an observation from two runs.",
            "Decisions-per-game varies between the two observed players by a factor of 1.3 "
            "(24.5 vs 31.9). Game-count minimums are therefore approximate; the decision-count "
            "minimums are the real ones.",
            "The in-region share is treated as fixed. A player whose region is rarer than "
            "erez281's needs proportionally more decisions for the same n_in.",
            "These minimums say when the instrument CAN return a candidate. They say nothing about "
            "how often it SHOULD -- that is the question the cohort is meant to answer.",
        ],

        "consequences_for_the_cohort": {
            "without_token": {
                "broad_powered_cohort": "possible but marginal: the ceiling clears the broad "
                                        "minimum by a factor of about %.2f, and a player with "
                                        "fewer decisions per game than erez281 falls under it"
                                        % (cap_admissible / broad_games_min),
                "residual_powered_subset": "NOT reachable. Every member would be underpowered for "
                                           "the residual question by construction, and 100 nulls "
                                           "would measure the enumeration cap, not the population.",
            },
            "with_token": {
                "broad_powered_cohort": "comfortable",
                "residual_powered_subset": "reachable for players whose blitz history exceeds "
                                           "%d admissible blitz games"
                                           % max(resid_blitz_games_min, search_blitz_games_min),
            },
        },
    }
    out = os.path.join(HERE, "POWER_PLAN.json")
    json.dump(doc, open(out, "w"), indent=1, sort_keys=False)
    print(json.dumps({
        "out": out,
        "broad_minimum_validate_decisions": broad_validate_min,
        "broad_minimum_admissible_games": broad_games_min,
        "residual_minimum_validate_blitz_decisions": resid_validate_min,
        "residual_minimum_admissible_blitz_games": resid_blitz_games_min,
        "residual_search_floor_admissible_blitz_games": search_blitz_games_min,
        "enumeration_ceiling_admissible": cap_admissible,
        "enumeration_ceiling_blitz": cap_blitz,
        "broad_reachable_without_token": cap_admissible >= broad_games_min,
        "residual_reachable_without_token": cap_blitz >= max(resid_blitz_games_min,
                                                             search_blitz_games_min),
    }, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
