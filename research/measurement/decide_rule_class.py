"""
TURN THE SCREEN INTO A DECISION, WITHOUT A HUMAN CHOOSING THE WINNER IN PROSE.

The decision rule is applied by this file to the numbers `screen_rule_classes.py` produced, so the
recommendation in `docs/measurement/RULE_CLASS_SEARCH.md` is DERIVED rather than asserted, and
`tests/research/measurement-rule-class-screen.test.ts` can check that the document and the data
agree. A recommendation written by hand is a recommendation nobody can audit.

EVERY GATE IS A COMPARISON, NEVER A CONSTANT.

  G1 structural      `c3_grade` may not be `defined-by-a-chosen-action`. That grade is what the
                     Lichess `hangingPiece` theme is, and it puts B inside T.
  G2 testable        both cells produced items under the candidate's own exclusion.
  G3 occurs          the trigger fires at all in an unfiltered corpus (C9).
  G4 beats the       P(B_valid | T+) must exceed the mean `prescription_size` on T+ -- the share
     item's own      of legal moves that satisfy B. That share IS the chance rate for this item,
     chance rate     so the gate asks whether the trigger predicts the correct action better than
                     picking a permitted move at random would. It is derived per item, not chosen.
  G5 beats the       `separation_b_valid` must exceed the refuted incumbent's. A candidate no
     incumbent       sharper than the rule class already shown to be uninterpretable is not a
                     reason to do anything.

Ranking among survivors is by `position_between_anchors`: 0 sits at the refuted incumbent, 1 at
the sharpest rule class chess allows. Nothing is normalised against a number anybody picked.

ELIGIBILITY IS NOT SUFFICIENCY, and the output says so in its own field. A candidate can pass all
five gates and still be unusable because T+ and T- are not exchangeable, which is the failure that
ended the first iteration and which no amount of prescriptive sharpness repairs.

    python decide_rule_class.py --screen rc_screen.json --out RULE_CLASS_SCREEN.json
"""

from __future__ import annotations

import argparse
import json


def decide(screen: dict) -> dict:
    floor_sep = screen["anchors"]["floor_separation"]
    ceiling_sep = screen["anchors"]["ceiling_separation"]
    rows = []

    for rid, r in screen["rule_classes"].items():
        row = {
            "id": rid,
            "name": r["name"],
            "family": r["family"],
            "role": r["role"],
            "gates": {},
            "eligible": False,
        }
        if "c4_prescriptive_validity" not in r:
            row["gates"] = {"G1_structural": None, "G2_testable": False,
                            "G3_occurs": None, "G4_beats_chance": None, "G5_beats_incumbent": None}
            row["verdict"] = r.get("verdict", "UNTESTED")
            row["why"] = r.get("why")
            rows.append(row)
            continue

        c4 = r["c4_prescriptive_validity"]
        b_plus = c4["t_plus"]["b_valid"]["p"]
        b_minus = c4["t_minus"]["b_valid"]["p"]
        chance_plus = c4["t_plus"]["prescription_size_mean"]
        sep = c4["separation_b_valid"]
        base_plus = r["c9_base_rate"]["t_plus"]["p"]

        g1 = r["c3_grade"] != "defined-by-a-chosen-action"
        g2 = True
        g3 = bool(base_plus and base_plus > 0)
        g4 = b_plus is not None and chance_plus is not None and b_plus > chance_plus
        g5 = sep is not None and floor_sep is not None and sep > floor_sep

        row["gates"] = {
            "G1_structural": g1,
            "G2_testable": g2,
            "G3_occurs": g3,
            "G4_beats_chance": g4,
            "G5_beats_incumbent": g5,
        }
        row["measurements"] = {
            "b_valid_t_plus": b_plus,
            "b_valid_t_minus": b_minus,
            "chance_rate_t_plus": chance_plus,
            "lift_over_chance_t_plus": (
                None if b_plus is None or chance_plus is None else b_plus - chance_plus
            ),
            "separation": sep,
            "position_between_anchors": r.get("position_between_anchors"),
            "base_rate_t_plus": base_plus,
            "max_abs_smd": r.get("c6_max_abs_smd"),
            "contextual_exception_rate_t_plus": c4["contextual_exception_rate_t_plus"],
            "following_the_rule_loses_100cp_or_more_t_plus":
                c4["t_plus"]["following_the_rule_loses_100cp_or_more"]["p"],
            "player_d_prime": r["player_behaviour_secondary"].get("d_prime"),
            "player_d_prime_monotone_in_rating":
                r["player_behaviour_secondary"].get("d_prime_monotone_in_rating"),
        }
        # Anchors are the scale; they are measured, not judged against themselves.
        row["eligible"] = bool(g1 and g2 and g3 and g4 and g5) if r["role"] == "candidate" else False
        row["verdict"] = (
            "ANCHOR" if r["role"] != "candidate"
            else ("ELIGIBLE" if row["eligible"] else "FAILS-A-GATE")
        )
        rows.append(row)

    eligible = [r for r in rows if r["eligible"]]
    eligible.sort(key=lambda r: r["measurements"]["position_between_anchors"] or 0, reverse=True)

    return {
        "decision_version": "1.0.0",
        "anchors": {
            "ceiling": screen["anchors"]["ceiling"],
            "ceiling_separation": ceiling_sep,
            "floor": screen["anchors"]["floor"],
            "floor_separation": floor_sep,
            "scale": "position_between_anchors: 0 = the refuted incumbent, 1 = the ceiling",
        },
        "corpus": screen["corpus"],
        "engine": screen["engine"],
        "rows": rows,
        "eligible_ranked": [r["id"] for r in eligible],
        "recommended": eligible[0]["id"] if eligible else None,
        "eligibility_is_not_sufficiency": (
            "Passing all five gates means the trigger predicts a correct action better than "
            "chance and more sharply than the refuted incumbent. It does NOT mean T+ and T- are "
            "exchangeable, and it does not mean a human study is warranted. Exchangeability is "
            "reported per candidate as max_abs_smd and is not a gate here because no "
            "literature-justified cut point exists for it in this design."
        ),
        "if_nothing_is_eligible": (
            "That is a finding, not a failure of the search: it would say rule use is not "
            "identifiable from the final move alone in any family tried, and the program would "
            "have to move to process evidence or a different paradigm."
        ),
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--screen", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    screen = json.load(open(a.screen, encoding="utf-8"))
    result = decide(screen)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    for r in result["rows"]:
        m = r.get("measurements") or {}
        pos = m.get("position_between_anchors")
        print(
            f"{r['id']} {r['name']:26s} {r['verdict']:14s} "
            f"gates={''.join('1' if v else ('0' if v is False else '-') for v in r['gates'].values())} "
            f"anchor={pos if pos is None else round(pos, 3)}"
        )
    print("recommended:", result["recommended"])
