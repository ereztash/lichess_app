"""
GATE A, RE-RUN: is a rule class still separable when the prescription is a SET of actions?

WHAT THIS ADDS TO `research/measurement/action_set.py`, which already computes B(s), V_B, V_notB,
A_B and R_B, and which this file therefore does NOT reimplement. Two things:

  1. THE ENGINE. `docs/measurement/ACTION_SET_MODEL.json` carries its own `provenance_warning`:
     it ran on Stockfish 16, while every published screen ran Stockfish 17.1. `engine_sensitivity`
     is one of the seven open blockers in `STRONGEST_PERMITTED_CLAIM.json`, and it says in as many
     words that "action-set value stability" is untested. This run is that test: the same script,
     the same corpus bytes, the same seed, the same sampler, on both engines.

  2. THE REGRET DISTRIBUTION ACROSS ALL B-ACTIONS. Gate A's specification asks for it in words --
     "a rule is not safe merely because one B-action is excellent if many B-actions are bad" -- and
     the published model summarises it to two numbers per class (the worst member, and the share of
     items whose worst member blunders). The per-item MultiPV over B is in the raw rows as
     `within_b` and was never pooled. A rule class is taught to a player as a SET; what the player
     may pick from is the distribution, not its extremes.

WHAT IS DELIBERATELY NOT DONE HERE.

  NO NEW THRESHOLD. `PRE_HUMAN_GATES.md`: "No universal numerical acceptance threshold is introduced
  here. Report the full distributions and compare against the already measured ceiling and refuted
  floor under the same instrument." A5 is reported exactly as `decide_action_set.py` implements it,
  including against the incumbent this repository has since refuted as a floor -- and the refutation
  is reported beside it rather than used to move the line. Which of those two readings governs is a
  question for the audit document, not for this program.

  NO NEW RULE CLASSES. The corpus is the seventeen already screened.

  NO WDL-MODEL CHANGE. `action_set.py` pins `sf16`, and python-chess 1.11.2 offers nothing newer
  than `sf16.1`. Holding it fixed across both engines is what makes the difference attributable to
  the engine; the sensitivity of the mapping is reported separately from the same cp columns,
  because it is a post-processing question and needs no second search.

    python gate_a.py --raw <action_set_raw.jsonl> --run <action_set.json> --c11 <c11_screen.json> \
        --out results/gate_a.json
"""
from __future__ import annotations

import argparse
import collections
import json
import math

#: The same encoding `action_set.py` uses, and the same warning: a ceiling that makes subtraction
#: defined, not a material quantity. No mean of a cp column appears below.
MATE_SCORE = 100_000

#: `action_set.py`'s own definition of a real error, reused so both documents mean one thing.
BLUNDER_CP = 100


def quantiles(xs: list[float], with_mean: bool = False) -> dict | None:
    """Quantiles always; a mean only where the caller certifies the scale is bounded."""
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    def q(p: float) -> float:
        if len(xs) == 1:
            return xs[0]
        i = p * (len(xs) - 1)
        lo, hi = math.floor(i), math.ceil(i)
        return xs[lo] + (xs[hi] - xs[lo]) * (i - lo)
    out = {"n": len(xs), "min": xs[0], "p25": q(0.25), "median": q(0.5),
           "p75": q(0.75), "p90": q(0.90), "max": xs[-1]}
    if with_mean:
        out["mean"] = sum(xs) / len(xs)
    return out


def within_b_regret(rows: list[dict]) -> dict:
    """
    THE QUANTITY GATE A ASKS FOR AND THE PUBLISHED MODEL DOES NOT CARRY.

    For every item, `within_b` holds one entry per member of B with that member's own value. The
    regret of a member is `V* - V(member)`: what a player loses by choosing THAT permitted move
    rather than the best move available at all. Pooled over every member of every item, this is the
    distribution a player is actually exposed to when told "do something in B" -- as opposed to
    `regret_B`, which is what they lose if they pick B's BEST member, and which no instruction can
    guarantee.

    Three readings, because they answer different questions:

      per_action   pooled over all members of all items. What a uniformly-chosen permitted move
                   costs. This is the teaching-exposure distribution.
      per_item_max the worst member of each item. What the rule permits at its worst.
      per_item_p50 the median member of each item, so a single catastrophic option in a large B
                   cannot be mistaken for a set that is bad throughout.
    """
    per_action_xs: list[float] = []
    per_action_cp: list[float] = []
    per_item_max_xs: list[float] = []
    per_item_med_xs: list[float] = []
    blunder_actions = 0
    total_actions = 0
    items_with_b = 0
    # Share of items where a uniformly-chosen permitted move loses >= BLUNDER_CP.
    item_blunder_share: list[float] = []

    for r in rows:
        within = r.get("within_b") or []
        v_star_xs, v_star_cp = r.get("v_star_xs"), r.get("v_star_cp")
        if not within or v_star_xs is None:
            continue
        items_with_b += 1
        regrets_xs, blunders = [], 0
        for p in within:
            if p.get("xs") is not None:
                g = v_star_xs - p["xs"]
                per_action_xs.append(g)
                regrets_xs.append(g)
            if p.get("cp") is not None and v_star_cp is not None:
                # A cp regret is meaningless where either end is a mate score; those items are
                # counted in the xs columns and excluded here rather than averaged into nonsense.
                if abs(p["cp"]) < MATE_SCORE and abs(v_star_cp) < MATE_SCORE:
                    d = v_star_cp - p["cp"]
                    per_action_cp.append(d)
                    total_actions += 1
                    if d >= BLUNDER_CP:
                        blunder_actions += 1
                        blunders += 1
        if regrets_xs:
            per_item_max_xs.append(max(regrets_xs))
            s = sorted(regrets_xs)
            per_item_med_xs.append(s[len(s) // 2])
        if within:
            item_blunder_share.append(blunders / len(within))

    return {
        "items_with_a_permitted_set": items_with_b,
        "per_action_regret_xs": quantiles(per_action_xs, with_mean=True),
        "per_action_regret_cp_excluding_mates": quantiles(per_action_cp),
        "per_item_worst_regret_xs": quantiles(per_item_max_xs, with_mean=True),
        "per_item_median_regret_xs": quantiles(per_item_med_xs, with_mean=True),
        "share_of_permitted_actions_losing_100cp_or_more": (
            (blunder_actions / total_actions) if total_actions else None),
        "permitted_actions_scored_on_cp": total_actions,
        "mean_share_of_an_items_permitted_set_that_blunders": (
            (sum(item_blunder_share) / len(item_blunder_share)) if item_blunder_share else None),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, help="action_set.py --raw JSONL")
    ap.add_argument("--run", required=True, help="action_set.py --out aggregate JSON")
    ap.add_argument("--c11", required=True, help="research/evidence-architecture/results/c11_screen.json")
    ap.add_argument("--published", help="docs/measurement/ACTION_SET_MODEL.json, to difference against")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    rows = [json.loads(l) for l in open(a.raw, encoding="utf-8")]
    run = json.load(open(a.run, encoding="utf-8"))
    c11 = json.load(open(a.c11, encoding="utf-8"))["classes"]
    published = json.load(open(a.published, encoding="utf-8")) if a.published else None

    by_cell: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    failures = 0
    for r in rows:
        if r.get("engine_failed"):
            failures += 1
            continue
        by_cell[(r["rule_class"], r["trigger_state"])].append(r)

    classes = run["rule_classes"]
    out_classes = {}
    for rid, c in classes.items():
        entry = {
            "name": c.get("name"),
            "role": c.get("role"),
            "c11_grade": c11.get(rid, {}).get("c11_grade"),
            "cells": {},
        }
        for cell, key in (("t_plus", "T+"), ("t_minus", "T-")):
            rs = by_cell.get((rid, key), [])
            if not rs:
                continue
            entry["cells"][cell] = {
                "n": len(rs),
                "advantage_xs": quantiles([r.get("advantage_xs") for r in rs], with_mean=True),
                "regret_b_xs": quantiles([r.get("regret_b_xs") for r in rs], with_mean=True),
                "chance_advantage_xs": quantiles(
                    [r.get("chance_advantage_xs") for r in rs], with_mean=True),
                "b_valid": (sum(r.get("b_valid", 0) for r in rs) / len(rs)),
                "prescription_size": quantiles(
                    [r.get("prescription_size") for r in rs], with_mean=True),
                "robustness": within_b_regret(rs),
            }
        out_classes[rid] = entry

    result = {
        "gate_a_version": "1.0.0",
        "what_this_is": (
            "Gate A re-run on the seventeen already-screened rule classes. The action-set "
            "quantities come from research/measurement/action_set.py unchanged; what is new here "
            "is the engine and the pooled regret distribution across every member of B."),
        "engine": run.get("engine"),
        "corpus": run.get("corpus"),
        "sample_per_cell": run.get("sample_per_cell"),
        "seed": run.get("seed"),
        "items_adjudicated": run.get("items_adjudicated"),
        "searches": run.get("searches"),
        "engine_failures_in_raw": failures,
        "wdl_model": "sf16, held fixed across engines so a difference is attributable to the engine",
        "classes": out_classes,
    }

    if published:
        # A DIFFERENCE, NOT A REPLACEMENT. The published run is Stockfish 16; this one may not be.
        # Reporting the pair is the engine-sensitivity measurement; reporting only the new number
        # would be a silent instrument change.
        deltas = {}
        for row in published.get("rows", []):
            rid = row["id"]
            m = row.get("measurements", {})
            here = classes.get(rid, {})
            deltas[rid] = {
                "published_separation_advantage_over_chance_xs": m.get(
                    "separation_advantage_over_chance_xs"),
                "here_separation_advantage_over_chance_xs": here.get(
                    "separation_advantage_over_chance_xs"),
                "published_b_valid_t_plus": m.get("b_valid_t_plus"),
                "here_b_valid_t_plus": here.get("b_valid_t_plus"),
                "published_verdict": row.get("verdict"),
            }
        result["against_published"] = {
            "published_engine": published.get("engine"),
            "published_provenance_warning": published.get("provenance_warning"),
            "per_class": deltas,
        }

    json.dump(result, open(a.out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"wrote {a.out}: {len(out_classes)} classes, {len(rows)} raw rows, {failures} engine failures")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
