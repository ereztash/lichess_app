"""
TURN THE DECISION-MODEL RUN INTO A DECISION, WITHOUT A HUMAN CHOOSING THE WINNER IN PROSE.

Same job as `decide_rule_class.py`, and deliberately the same shape: this file applies a fixed
rule to the numbers `action_set.py` produced, so the table in
`docs/measurement/ACTION_SET_REANALYSIS.md` is DERIVED, and
`tests/research/measurement-action-set.test.ts` can fail the build when the document and the data
come apart.

THE FIVE GATES, AND WHY EACH IS A COMPARISON RATHER THAN A CONSTANT. They are the value-scale
counterparts of G1-G5, one for one, and they are numbered A1-A5 so that nobody can mistake a
result under this instrument for a result under the published screen.

  A1 measurable      both cells produced items, and V_B and V_notB are both defined on a majority
                     of them. An item where B is empty, or where B covers every legal move, has
                     no advantage to measure; those are counted, not dropped.

  A2 beats its own   `advantage_over_chance | T+` must have a 95% interval strictly above 0. The
     chance          comparison is a SIZE-MATCHED RANDOM PRESCRIPTION drawn on the same position,
     prescription    so it carries no chess knowledge and absorbs the depth asymmetry between a
                     small root set and a large one. This is exactly what G4 does with
                     `prescription_size`, moved onto the value scale: the chance level is derived
                     per item, never picked.

  A3 efficacious     obeying must cost LESS when the trigger fires than when it does not
                     (`separation_regret > 0`). A prescription that is more expensive to follow
                     when its own trigger is present is not a rule about that trigger.

  A4 discriminating  `separation_advantage_over_chance > 0`. The rule must buy more, over chance,
                     under T+ than under T-. This is the value-scale form of "separation", and it
                     is the gate the published screen's `separation_b_valid` was reaching for.

  A5 beats the       `separation_advantage_over_chance` must exceed the refuted incumbent's,
     incumbent       measured in THIS run under THIS engine. A candidate no sharper than the rule
                     class already shown to be uninterpretable is not a reason to do anything.

ROBUSTNESS IS REPORTED AND IS NOT A GATE, on purpose. "What share of the permitted set is safe"
has no non-arbitrary cut, and this program does not invent one. It is placed between the same two
anchors as everything else and left for a reader to weigh -- with the warning that the CEILING
anchor itself scores badly on it, which is a fact about `RC-00`'s prescription and the single
clearest demonstration that `b_valid` and robustness are different questions.

ELIGIBILITY IS NOT SUFFICIENCY. Exchangeability (max |SMD|) is untouched by anything here; a
candidate can pass all five gates and still be unusable for the reason that ended the first
iteration.

    python decide_action_set.py --run action_set.json --raw action_set_raw.jsonl \\
        --out ACTION_SET_MODEL.json
"""

from __future__ import annotations

import argparse
import collections
import json


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return (sum(xs) / len(xs)) if xs else None


def decide(run: dict, raw_rows: list[dict]) -> dict:
    classes = run["rule_classes"]

    # `prescription_size` mean per cell, which G4 uses and which the run stores only as a median.
    # Recomputed from the per-item records rather than approximated, so the two screens can be
    # compared on the column the published one actually gated on.
    psize = collections.defaultdict(list)
    for r in raw_rows:
        if r.get("prescription_size") is not None:
            psize[(r["rule_class"], r["trigger_state"])].append(r["prescription_size"])

    incumbent = classes.get("RC-01", {})
    floor = incumbent.get("separation_advantage_over_chance_xs")
    ceiling = classes.get("RC-00", {}).get("separation_advantage_over_chance_xs")
    floor_bv = incumbent.get("separation_b_valid")

    rows = []
    for rid, c in classes.items():
        row = {"id": rid, "name": c.get("name"), "family": c.get("family"),
               "role": c.get("role"), "gates": {}, "eligible": False}
        if "t_plus" not in c:
            row["gates"] = {g: None for g in
                            ("A1_measurable", "A2_beats_chance", "A3_efficacious",
                             "A4_discriminating", "A5_beats_incumbent")}
            row["gates"]["A1_measurable"] = False
            row["verdict"] = "UNTESTED"
            rows.append(row)
            continue

        p, m = c["t_plus"], c["t_minus"]
        adv_oc = p["advantage_over_chance_xs"]
        n_defined = adv_oc.get("n") or 0

        a1 = p["n"] > 0 and m["n"] > 0 and n_defined > p["n"] / 2
        a2 = bool(adv_oc.get("ci95") and adv_oc["ci95"][0] is not None
                  and adv_oc["ci95"][0] > 0)
        a3 = c.get("separation_regret_xs") is not None and c["separation_regret_xs"] > 0
        sep_oc = c.get("separation_advantage_over_chance_xs")
        a4 = sep_oc is not None and sep_oc > 0
        a5 = sep_oc is not None and floor is not None and sep_oc > floor

        row["gates"] = {"A1_measurable": a1, "A2_beats_chance": a2, "A3_efficacious": a3,
                        "A4_discriminating": a4, "A5_beats_incumbent": a5}
        row["eligible"] = all(row["gates"].values())
        row["verdict"] = (
            "ELIGIBLE" if row["eligible"]
            else "ANCHOR" if rid in ("RC-00", "RC-01")
            else "fails " + ", ".join(k for k, v in row["gates"].items() if v is False))
        row["measurements"] = {
            # EFFICACY -- what obeying costs, in expected score.
            "regret_b_xs_mean_t_plus": p["regret_b_xs"].get("mean"),
            "regret_b_xs_mean_t_minus": m["regret_b_xs"].get("mean"),
            "separation_regret_xs": c.get("separation_regret_xs"),
            "obeying_loses_100cp_or_more_t_plus": p["obeying_loses_100cp_or_more"]["p"],
            # NECESSITY -- what disobeying costs, raw and over chance.
            "advantage_xs_mean_t_plus": p["advantage_xs"].get("mean"),
            "chance_advantage_xs_mean_t_plus": p["chance_advantage_xs"].get("mean"),
            "advantage_over_chance_t_plus": adv_oc.get("mean"),
            "advantage_over_chance_t_plus_ci95": adv_oc.get("ci95"),
            "advantage_over_chance_t_minus": m["advantage_over_chance_xs"].get("mean"),
            "separation_advantage_over_chance_xs": sep_oc,
            # ROBUSTNESS -- reported, never gated.
            "permitted_moves_safe_t_plus": p["permitted_moves_safe"]["p"],
            "worst_permitted_loses_100cp_t_plus": p["worst_permitted_move_loses_100cp_or_more"]["p"],
            "max_regret_in_b_xs_mean_t_plus": p["max_regret_in_b_xs"].get("mean"),
            # THE PUBLISHED COLUMN, RECOMPUTED IN THIS RUN. Every comparison between the two
            # instruments uses this rather than a number from another engine.
            "b_valid_t_plus": p["b_valid"]["p"],
            "b_valid_t_minus": m["b_valid"]["p"],
            "separation_b_valid": c.get("separation_b_valid"),
            "prescription_size_mean_t_plus": _mean(psize[(rid, "positive")]),
            "prescription_size_mean_t_minus": _mean(psize[(rid, "negative")]),
            "position_between_anchors": (
                None if None in (sep_oc, floor, ceiling) or ceiling == floor
                else (sep_oc - floor) / (ceiling - floor)),
        }
        # Would this class have passed the PUBLISHED G4/G5 under this engine? Recorded so the
        # reordering claim below is a comparison of verdicts, not only of numbers.
        bvp = p["b_valid"]["p"]
        psz = _mean(psize[(rid, "positive")])
        row["published_gates_this_engine"] = {
            "G4_beats_chance": (None if bvp is None or psz is None else bvp > psz),
            "G5_beats_incumbent": (
                None if c.get("separation_b_valid") is None or floor_bv is None
                else c["separation_b_valid"] > floor_bv),
        }
        rows.append(row)

    eligible = [r for r in rows if r["eligible"] and r["id"] not in ("RC-00", "RC-01")]
    eligible.sort(key=lambda r: -(r["measurements"]["position_between_anchors"] or 0))

    # THE COMPARISON THE RUN EXISTS FOR. Which candidates does the decision model promote or
    # demote relative to the top-1 screen, on the SAME items and the SAME engine?
    def published_eligible(r):
        g = r.get("published_gates_this_engine") or {}
        return bool(g.get("G4_beats_chance")) and bool(g.get("G5_beats_incumbent"))

    scored = [r for r in rows if "measurements" in r and r["id"] not in ("RC-00", "RC-01")]
    return {
        "model_version": "1.0.0",
        "instrument": "action-set decision model (efficacy / necessity / robustness)",
        "engine": run.get("engine"),
        "provenance_warning": run.get("provenance_warning"),
        "anchors": {
            "ceiling": "RC-00", "ceiling_separation": ceiling,
            "floor": "RC-01", "floor_separation": floor,
        },
        "rows": rows,
        "eligible_ranked": [r["id"] for r in eligible],
        "recommended": eligible[0]["id"] if eligible else None,
        "verdict_changes": {
            "promoted_by_decision_model": [
                r["id"] for r in scored if r["eligible"] and not published_eligible(r)],
            "demoted_by_decision_model": [
                r["id"] for r in scored if not r["eligible"] and published_eligible(r)],
            "agree": [r["id"] for r in scored if r["eligible"] == published_eligible(r)],
        },
        "reordering": run.get("reordering"),
        "eligibility_is_not_sufficiency": (
            "Exchangeability is untouched by this instrument. A class passing A1-A5 still faces "
            "the max |SMD| that ended the first iteration, and robustness is reported rather than "
            "gated because no non-arbitrary cut for it exists."
        ),
    }


def _fmt(v, places=3, pct=False):
    if v is None:
        return "—"
    if pct:
        return f"{v:.3f}".lstrip("0") if 0 <= v < 1 else f"{v:.3f}"
    return f"{v:+.{places}f}" if places else f"{v:+.0f}"


def markdown(result: dict) -> str:
    """
    THE DOCUMENT'S TABLE, RENDERED FROM THE DATA RATHER THAN TYPED.

    `tests/research/measurement-action-set.test.ts` checks that every row in the model appears in
    the markdown. That check is only worth having if the markdown is transcribed mechanically --
    a table retyped by hand agrees with the data exactly until the first time somebody rounds a
    number to make a sentence read better.
    """
    head = ("| | rule class | family | `b_valid` T+ | sep `b_valid` | regret T+ | regret T− | "
            "adv/chance T+ | sep adv/chance | safe in B | verdict |")
    rule = "| " + " | ".join(["---"] * 11) + " |"
    lines = [head, rule]
    for r in result["rows"]:
        m = r.get("measurements") or {}
        lines.append(
            f"| {r['id']} | {r['name'] or '—'} | {r.get('family') or '—'} | "
            f"{_fmt(m.get('b_valid_t_plus'), pct=True)} | "
            f"{_fmt(m.get('separation_b_valid'))} | "
            f"{_fmt(m.get('regret_b_xs_mean_t_plus'))} | "
            f"{_fmt(m.get('regret_b_xs_mean_t_minus'))} | "
            f"{_fmt(m.get('advantage_over_chance_t_plus'))} | "
            f"{_fmt(m.get('separation_advantage_over_chance_xs'))} | "
            f"{_fmt(m.get('permitted_moves_safe_t_plus'), pct=True)} | "
            f"{r['verdict']} |")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--markdown", help="also write the document's table, rendered from the data")
    a = ap.parse_args()
    run = json.load(open(a.run, encoding="utf-8"))
    raw = [json.loads(l) for l in open(a.raw, encoding="utf-8")]
    result = decide(run, raw)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    for r in result["rows"]:
        m = r.get("measurements") or {}
        pos = m.get("position_between_anchors")
        print(f"{r['id']} {str(r['name'])[:26]:26s} {r['verdict'][:34]:34s} "
              f"gates={''.join('1' if v else ('0' if v is False else '-') for v in r['gates'].values())} "
              f"anchor={pos if pos is None else round(pos, 3)}")
    if a.markdown:
        with open(a.markdown, "w", encoding="utf-8") as fh:
            fh.write(markdown(result) + "\n")
    print("recommended:", result["recommended"])
    print("verdict changes:", json.dumps(result["verdict_changes"]))


if __name__ == "__main__":
    main()
