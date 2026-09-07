"""
PHASES 3, 4, 6, 7, 8, 9, 10, 15, 17, 18, 19, 24, 26 -- the cohort pre-registration.

Written and hashed BEFORE a single username is selected. Everything a later reader might suspect was
chosen after seeing results is fixed here: the two denominators, the frame, the order, the seed, the
windows, what counts as a pre-analysis failure, what a null does and does not mean, the red flags
that would invalidate the run, and the three verdicts the cohort may return.

The instrument itself is NOT redeclared here. It is frozen in INSTRUMENT_FREEZE.json and referenced
by hash, so a cohort that ran under a different instrument is detectable rather than arguable.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402

# Declared here, before selection, and never recomputed from a result.
COHORT_N = 100
RESIDUAL_SUBSET_N = 25
SELECTION_SEED = 20260907_100     # committed; the order is a seeded shuffle of the frame
W_BROAD = 450                     # admissible games, most-recent-first (contract.WINDOW_RULE + cap)
W_RESID = 2200
PREFILTER_HALFWIDTH = 200         # current blitz rating within this of a registered band centre
FETCH_MARGIN = 1.35               # raw games fetched per admissible game wanted


def main() -> int:
    freeze = json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))
    plan = json.load(open(os.path.join(HERE, "POWER_PLAN.json")))
    screen = json.load(open(os.path.join(HERE, "COHORT_SCREEN.json")))
    frame_path = os.path.join(HERE, "COHORT_FRAME.json")
    frame = json.load(open(frame_path))

    broad_dec = plan["broad_minimum"]["validate_decisions"]
    resid_games = plan["residual_minimum"]["operative_minimum_admissible_blitz_games"]
    dpg = plan["reference_n"]["decisions_per_game_observed_range"][0]
    blitz_share = plan["ingestion_reach"]["blitz_rate"] / plan["ingestion_reach"]["admissible_rate"]

    doc = {
        "_what": "The 100-player cohort pre-registration, hashed before any username is selected.",
        "_why": "A cohort measures a DISTRIBUTION of outcomes. That measurement is worthless if any "
                "rule could have moved after a result was seen, so every rule that could move is "
                "fixed here first.",
        "written_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repo_sha": corpuslib.repo_sha(),
        "protocol_version": "V1",

        "instrument": {
            "_note": "Not redeclared. Referenced by hash so that a cohort run under a different "
                     "instrument is detectable rather than arguable.",
            "instrument_hash": freeze["instrument_hash"],
            "pipeline_hash": freeze["pipeline_hash"],
            "protocol_hash": freeze["protocol_hash"],
            "contract_version": contract.CONTRACT_VERSION,
        },

        # ---- PHASE 3 -------------------------------------------------------------------------
        "denominators": {
            "_why_two": "A player can be large enough for the instrument to judge a BROAD structure "
                        "and far too small for it to judge a PERSONAL RESIDUAL. Pooling them would "
                        "report residual nulls that are properties of corpus size. The two "
                        "denominators are reported separately and never merged.",
            "BROAD_POWERED": {
                "n": COHORT_N,
                "rule": ">= %d VALIDATE decisions in the frozen window" % broad_dec,
                "basis": "POWER_PLAN.broad_minimum.validate_decisions",
                "unit_note": "decisions, not games. Games only approximate this; decisions-per-game "
                             "varies by 1.3x between the two observed players.",
            },
            "RESIDUAL_POWERED": {
                "n": RESIDUAL_SUBSET_N,
                "rule": ">= %d admissible BLITZ games in the frozen window" % resid_games,
                "basis": "POWER_PLAN.residual_minimum.operative_minimum_admissible_blitz_games, "
                         "which is the SEARCH floor and sits above the judge's %d"
                         % plan["residual_minimum"]["admissible_blitz_games"],
                "subset_of": "BROAD_POWERED. Every residual member is also a broad member.",
                "why_25_and_not_all": "engine time. About 77%% of eligible candidates clear the "
                                      "residual volume gate, so the subset is bounded by compute "
                                      "and not by availability. 25 was chosen before selection and "
                                      "is not adjustable by any result.",
            },
        },

        # ---- PHASE 4 -------------------------------------------------------------------------
        "scope": {
            "platform": "lichess", "speed": "blitz (180+0, 300+0) for the population baseline",
            "band": "whatever the registry holds; today one band, [1450, 1850]",
            "why_narrow": "a first cohort that varies platform, speed and band at once cannot "
                          "attribute a null to any of them",
        },

        # ---- PHASE 6 -------------------------------------------------------------------------
        "sampling_frame": {
            "source": screen["frame"]["source"],
            "prefix_mb": screen["frame"]["prefix_mb"],
            "time_controls": screen["frame"]["blitz_time_controls"],
            "distinct_players_in_frame": screen["frame"]["distinct_players"],
            "screened": screen["counts"]["sampled"],
            "screenable": screen["counts"]["screenable"],
            "frame_file": "COHORT_FRAME.json",
            "frame_hash": frame["frame_hash"],
            "pre_filter": "NONE on rating. The frame is not filtered by the band gate, so the "
                          "yield it reports is a measurement and not a tautology.",
            "known_bias": "A player enters the frame by appearing in the dump prefix, and a player "
                          "who plays more appears more readily. The frame is therefore biased "
                          "toward high-volume players, which is the same direction as the volume "
                          "gate. Declared, not corrected: correcting it would require a player "
                          "list this study does not have. It means the reported eligibility rates "
                          "are an UPPER bound on the platform's, and the cohort is a cohort of "
                          "active blitz players rather than of accounts.",
        },

        # ---- PHASE 7 -------------------------------------------------------------------------
        "selection": {
            "order": "a seeded shuffle of the screenable frame, taken once",
            "seed": SELECTION_SEED,
            "rule": "walk the order; try each candidate; take the first %d that pass eligibility"
                    % COHORT_N,
            "what_selection_may_read": ["public profile metadata", "the derived population band",
                                        "the decision and game counts of the frozen window"],
            "what_selection_may_not_read": ["any analysis result", "any discovery output",
                                            "any judge statistic", "any output class"],
            "prefilter": {
                "_what": "Candidates whose current blitz rating is further than %d from every "
                         "registered band centre are skipped without a fetch."
                         % PREFILTER_HALFWIDTH,
                "_why": "Walking the whole frame means a full-history fetch per candidate to reject "
                        "about 95%% of them. The prefilter cuts that by more than half.",
                "rule": "|current blitz rating - band centre| <= %d, for some registered band"
                        % PREFILTER_HALFWIDTH,
                "measured_recall": {
                    "_method": "share of frame players whose JUNE median derives a registered band "
                               "that this prefilter keeps. Measured on COHORT_FRAME.json before the "
                               "prefilter was chosen.",
                    "half_width_200": 0.988, "half_width_150": 0.962, "half_width_100": 0.843,
                    "frame_share_kept_at_200": 0.413,
                    "chosen": PREFILTER_HALFWIDTH,
                    "why_this_one": "98.8%% recall for 41%% of the fetches. The p90 of absolute "
                                    "rating drift is 118, so a half-width of 200 sits well outside "
                                    "the drift the band gate has to survive.",
                },
                "bias_it_introduces": "the cohort is restricted to players whose CURRENT rating is "
                                      "near the band centre, so a player who drifted more than 200 "
                                      "points into the band cannot enter it. That is 1.2% of "
                                      "otherwise-eligible players. It also mildly selects for "
                                      "rating stability over the window, which is a property that "
                                      "could plausibly correlate with having a stable personal "
                                      "structure. Declared here because it cannot be measured "
                                      "away, and it limits generalisation rather than validity.",
                "what_it_is_not": "an acceptance rule. No candidate is ACCEPTED on a profile "
                                  "rating. Acceptance is decided only by the band the frozen "
                                  "window derives, which is what the pipeline itself reads. That "
                                  "distinction is the lesson of the livio68 rejection.",
            },
            "residual_subset_assignment": {
                "_when": "BEFORE the fetch, from profile metadata alone, so the window can be "
                         "declared before the corpus exists",
                "candidate_rule": "profile blitz game count * %.4f >= %d"
                                  % (plan["ingestion_reach"]["admissible_rate"], resid_games),
                "fill_rule": "the first %d ACCEPTED such candidates, in the committed order"
                             % RESIDUAL_SUBSET_N,
            },
        },

        # ---- window: declared before any fetch ------------------------------------------------
        "window": {
            "rule": contract.WINDOW_RULE,
            "broad_members": {"admissible_games": W_BROAD,
                              "implied_validate_decisions_at_%.1f_dec_per_game" % dpg:
                                  int(W_BROAD * contract.SPLIT["validate_frac"] * dpg),
                              "margin_over_minimum": round(
                                  W_BROAD * contract.SPLIT["validate_frac"] * dpg / broad_dec, 2)},
            "residual_members": {"admissible_games": W_RESID,
                                 "implied_admissible_blitz_games": int(W_RESID * blitz_share),
                                 "margin_over_minimum": round(W_RESID * blitz_share / resid_games, 2)},
            "fetch_cap": {
                "rule": "ceil(window / admissible_rate * %.2f) most-recent games" % FETCH_MARGIN,
                "broad": int(math.ceil(W_BROAD / plan["ingestion_reach"]["admissible_rate"]
                                       * FETCH_MARGIN)),
                "residual": int(math.ceil(W_RESID / plan["ingestion_reach"]["admissible_rate"]
                                          * FETCH_MARGIN)),
                "_why": "operational, not research. The export streams a full history and the "
                        "corpus is windowed anyway, so fetching 13,000 games to keep 450 is waste. "
                        "Same most-recent-first order as the window, so the corpus is identical to "
                        "the one an unbounded fetch would have produced.",
                "_risk": "a cap set too tight yields a short window and the candidate is rejected "
                         "on size, which would be a selection artefact. The %.2fx margin is why it "
                         "is not, and every rejection on size is recorded with its admissible "
                         "count so the artefact would be visible." % FETCH_MARGIN,
            },
            "why_a_cap": "the export returns a full history, and scoring a 13,000-game history "
                         "under the frozen engine regime is days of compute per player. The caps "
                         "are declared here, before any fetch, and are the same for every member "
                         "of their class.",
        },

        # ---- PHASE 8 -------------------------------------------------------------------------
        "replacement": {
            "allowed_only_for": [
                "USER_NOT_FOUND, NO_PUBLIC_GAMES, account closed or flagged",
                "INSUFFICIENT_ELIGIBLE_GAMES or fewer than the declared minimum decisions",
                "POPULATION_BASELINE_INSUFFICIENT: the derived band is not one the registry holds",
                "FETCH_FAILED or ENGINE_FAILURE that a rerun does not clear",
            ],
            "forbidden": "replacement for ANY reason that reads an analysis result. A member whose "
                         "run returns NO_STABLE_STRUCTURE, LEVEL_TYPICAL_ONLY or INSUFFICIENT_"
                         "EVIDENCE stays in the cohort. That is the measurement.",
            "record": "every rejected candidate is recorded in COHORT_SELECTION.json with its "
                      "reason, so the rejection rate is auditable and a silent re-roll is visible",
            "stage": "all replacement happens in selection, before any scoring. Once the cohort is "
                     "frozen (Phase 9) no member is replaced for any reason.",
        },

        # ---- PHASE 9 -------------------------------------------------------------------------
        "freeze": {
            "rule": "the full cohort of %d is selected and frozen BEFORE the first position of the "
                    "first member is scored" % COHORT_N,
            "artefact": "COHORT_FROZEN.json, listing every member, their window, their derived "
                        "band, their frozen corpus hash and their per-player prereg hash",
            "why": "selecting members while results arrive lets the cohort drift toward whatever "
                   "the early results looked like, without anybody intending it",
        },

        # ---- PHASE 12 ------------------------------------------------------------------------
        "no_player_by_player_decisions": {
            "rule": "the runner takes no per-player choices. Same window class, same engine regime, "
                    "same splits, same search, same judge, same classifier for all %d." % COHORT_N,
            "operational_exceptions": ["--workers and a resume of an interrupted run, neither of "
                                       "which reads a result"],
        },

        # ---- PHASE 13 ------------------------------------------------------------------------
        "defect_policy": {
            "infrastructure": "fix, record, rerun the affected members. Does not invalidate the "
                              "cohort.",
            "research_semantic": "a rule was wrong or was applied differently across members. "
                                 "STOPS the cohort. The cohort is void and must be re-run whole "
                                 "under a corrected instrument.",
            "ambiguity": "the frozen rules do not determine an outcome for some member. Record it, "
                         "do not resolve it in that member's favour, and report the count.",
            "precedent": "one research-semantic defect is already on this record: the package "
                         "asserted the by-username export needs a token, unmeasured, after the "
                         "repository had corrected the claim. See ENDPOINT_CONTRACT.json.",
        },

        # ---- PHASE 15 ------------------------------------------------------------------------
        "null_semantics": {
            "NO_STABLE_STRUCTURE": "no region of the frozen vocabulary passed the VALIDATE judge on "
                                   "the broad class. This is NOT 'no personal residual'. The "
                                   "residual stage was never reached, so nothing about a personal "
                                   "residual is measured by it, in either direction.",
            "LEVEL_TYPICAL_ONLY": "a structure was found and the population baseline explains it. "
                                  "THIS is the class that says 'no personal residual'.",
            "INSUFFICIENT_EVIDENCE": "the statistics are undefined on this corpus, or no baseline "
                                     "covers this band. Says nothing about the player.",
            "PERSONAL_RESIDUAL_CANDIDATE": "survives the baseline on held-out games. Candidate: not "
                                           "a cause, not an intervention, not a field result.",
            "reporting_rule": "the four classes are reported as four counts and are never summed "
                              "into 'found' versus 'not found'.",
        },

        # ---- PHASE 17 ------------------------------------------------------------------------
        "instrument_self_measurement": {
            "_what": "quantities about the INSTRUMENT that the cohort makes measurable for the "
                     "first time, declared now so they are not chosen later to look good",
            "measures": [
                "the rate at which the broad stage passes at all, per 100 eligible players",
                "the rate at which the population baseline explains what the broad stage found",
                "the rate at which a personal residual survives it",
                "the distribution of stability_median_j of frozen candidates, which is the "
                "search-stage health the power plan could only observe on two players",
                "the distribution of resid_wg_z on VALIDATE, including the ones below the bar",
                "how often the derived band differs from the screen's prediction",
            ],
        },

        # ---- PHASE 18 ------------------------------------------------------------------------
        "pattern_diversity": {
            "_question": "do candidates concentrate on one or two regions of the vocabulary, or "
                         "spread across it?",
            "reported": ["the multiset of frozen candidate regions across all members",
                         "how many distinct regions appear",
                         "the share of members whose candidate is R* or R** verbatim"],
            "_why_declared_now": "a cohort that returns erez281's own region for everybody would "
                                 "be a finding about the search, not about players, and it must be "
                                 "impossible to present that as replication after the fact",
        },

        # ---- PHASE 19 ------------------------------------------------------------------------
        "population_safety_gate": {
            "rule": "leave-one-player-out. No cohort member's games may enter the population "
                    "baseline that judges them.",
            "check": "the population corpus is population_2026-06, built before this cohort "
                     "existed. Every selected member is checked against its player list, and a "
                     "member who appears in it is REJECTED at selection as a pre-analysis failure.",
            "why": "a player scored against a baseline containing their own games is compared to "
                   "themselves, and the residual is attenuated by construction",
        },

        # ---- PHASE 24 ------------------------------------------------------------------------
        "red_flags_predeclared": {
            "_what": "results that would mean the cohort is measuring the instrument or the frame "
                     "rather than the players. Declared BEFORE any result, so that meeting one is "
                     "a finding and not a debate.",
            "flags": [
                {"flag": "PERSONAL_RESIDUAL_CANDIDATE rate above 50% of RESIDUAL_POWERED members",
                 "reads_as": "the judge is too permissive, or the population baseline is too weak "
                             "to remove what is common at this level"},
                {"flag": "every candidate region is R* or R** verbatim",
                 "reads_as": "the search is returning its training case, not the player's structure"},
                {"flag": "fewer than 3 distinct candidate regions across all members",
                 "reads_as": "the vocabulary or the beam is collapsing, independent of players"},
                {"flag": "NO_STABLE_STRUCTURE rate above 90% of BROAD_POWERED members",
                 "reads_as": "the corpus sizes are still below what the search needs, so the power "
                             "plan's search floor is wrong and the cohort measures that"},
                {"flag": "eligibility rejection rate above 90% of tried candidates",
                 "reads_as": "the frame or the band gate, not the players"},
                {"flag": "the derived band differs from the screen's prediction for more than 80% "
                         "of tried candidates",
                 "reads_as": "the metadata screen is not a screen and selection is effectively "
                             "random over the frame"},
            ],
        },

        # ---- PHASE 26 ------------------------------------------------------------------------
        "verdicts": {
            "_rule": "exactly one is returned, from the counts, by a rule fixed here",
            "GENERALISES": "PERSONAL_RESIDUAL_CANDIDATE occurs in a minority but non-trivial share "
                           "of RESIDUAL_POWERED members, on more than one distinct region, with no "
                           "red flag met",
            "DOES_NOT_GENERALISE": "PERSONAL_RESIDUAL_CANDIDATE occurs for no RESIDUAL_POWERED "
                                   "member, or only for erez281's own regions, with no red flag "
                                   "met. The instrument works and the phenomenon is not general.",
            "UNDETERMINED": "a red flag is met, or too few members reached RESIDUAL_POWERED for "
                            "either statement. Reported as UNDETERMINED and not rounded toward "
                            "either of the other two.",
            "not_a_verdict": "no count in this cohort licenses a CAUSAL, INTERVENTION or OUTCOME "
                             "claim. The claim ladder is unchanged by sample size.",
        },

        "governance": {
            "no_tuning_after_this_hash": "once this document is hashed, none of eligibility, "
                                         "features, thresholds, search space, target order, split "
                                         "rules, population correction, judge, classifier, residual "
                                         "definition, output classes, windows, seed or cohort size "
                                         "may change because of any member's result",
            "one_run_per_player": contract.GOVERNANCE["one_run_per_player"],
            "test_opened": contract.SPLIT["test_opened"],
        },
    }
    doc["prereg_hash"] = hashlib.sha256(
        json.dumps({k: v for k, v in doc.items() if k not in ("prereg_hash", "written_at")},
                   sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    out = os.path.join(HERE, "COHORT_PREREG.json")
    json.dump(doc, open(out, "w"), indent=1, default=str)
    print(json.dumps({"out": out, "prereg_hash": doc["prereg_hash"],
                      "instrument_hash": doc["instrument"]["instrument_hash"],
                      "cohort_n": COHORT_N, "residual_subset_n": RESIDUAL_SUBSET_N,
                      "seed": SELECTION_SEED, "W_BROAD": W_BROAD, "W_RESID": W_RESID,
                      "frame_hash": doc["sampling_frame"]["frame_hash"]}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
