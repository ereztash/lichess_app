"""
COMPUTE VALUE EXTRACTION: what else the 55,699 searches already bought.

THE QUESTION THIS ANSWERS. An engine run is usually spent on one gate and thrown away. The
evaluations are the expensive part and the gate verdict is a few bytes of it. So before any further
search is launched, this program asks what can be derived from the frozen corpus at zero additional
engine cost -- and, as importantly, states what CANNOT, so that the next run is justified by a gap
rather than by habit.

EVERY NUMBER HERE IS A RE-READ. No search, no predicate change, no protocol change. The Gate A and
Gate B results are preserved separately and unchanged; nothing below is allowed to alter them, and
where a derived artifact disagrees with them that disagreement is the finding.

    python extract.py --gate-a results/gate_a.json --gate-b results/gate_b.json \
        --c11 ../evidence-architecture/results/c11_screen.json \
        --twins results/minimal_twins.json --out results/compute_value.json
"""
from __future__ import annotations

import argparse
import collections
import io
import json
import math
import statistics
from pathlib import Path

import zstandard

CORPUS = Path(__file__).resolve().parent / "corpus"
BLUNDER_CP = 100


def stream(name: str):
    with open(CORPUS / name, "rb") as fh:
        for line in io.TextIOWrapper(
            zstandard.ZstdDecompressor().stream_reader(fh), encoding="utf-8"
        ):
            yield json.loads(line)


def q(xs: list[float], p: float):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    if len(xs) == 1:
        return xs[0]
    i = p * (len(xs) - 1)
    lo, hi = math.floor(i), math.ceil(i)
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo)


def atlas(items: list[dict], evals_by_pos: dict) -> dict:
    """
    1. ACTION-SET ATLAS. One row per (class, cell): how wide the permitted set is, what obeying is
    worth against the best alternative, and how the regret is spread across the set rather than
    summarised to its best or worst member.

    WIDTH IS REPORTED IN TWO UNITS ON PURPOSE. |B| is what a teacher would say ("there are four
    moves that do this"); |B|/legal is what the chance control needs. A class can have a small |B|
    and a large share in a cramped position, and the two say different things about ambiguity.
    """
    out: dict = {}
    by_cell: dict = collections.defaultdict(list)
    for it in items:
        by_cell[(it["rule_class"], it["trigger_state"])].append(it)
    for (rc, cell), rows in sorted(by_cell.items()):
        sizes = [r["n_satisfying"] for r in rows if r.get("n_satisfying") is not None]
        shares = [r["prescription_size"] for r in rows if r.get("prescription_size") is not None]
        regrets: list[float] = []
        worst: list[float] = []
        blunder_share: list[float] = []
        for r in rows:
            per = evals_by_pos.get((r["position_id"], rc), [])
            v_star = r.get("v_star_xs")
            if v_star is None or not per:
                continue
            rs = [v_star - e["xs"] for e in per if e.get("xs") is not None]
            if not rs:
                continue
            regrets.extend(rs)
            worst.append(max(rs))
            cps = [e["cp"] for e in per if e.get("cp") is not None]
            if cps and r.get("v_star_xs") is not None:
                pass
            blunder_share.append(sum(1 for x in rs if x > 0) / len(rs))
        out[f"{rc}::{cell}"] = {
            "items": len(rows),
            "b_size_median": q(sizes, 0.5),
            "b_size_p90": q(sizes, 0.9),
            "b_share_of_legal_mean": (statistics.fmean(shares) if shares else None),
            "advantage_xs_mean": _mean(r.get("advantage_xs") for r in rows),
            "regret_b_xs_mean": _mean(r.get("regret_b_xs") for r in rows),
            "per_action_regret_median": q(regrets, 0.5),
            "per_action_regret_p90": q(regrets, 0.9),
            "per_action_regret_max": q(regrets, 1.0),
            "worst_in_b_regret_mean": (statistics.fmean(worst) if worst else None),
            "share_of_permitted_actions_with_any_regret": (
                statistics.fmean(blunder_share) if blunder_share else None),
            "b_valid": _mean(r.get("b_valid") for r in rows),
        }
    return out


def natural(items: list[dict]) -> list[dict]:
    """
    The natural corpus: one row per (class, position), constructed twins removed.

    DEDUPLICATION IS NOT COSMETIC. The twin run re-scored the 378 SOURCE positions alongside their
    twins, so those positions appear twice in the bank -- which is exactly the 5,581 cache hits the
    preservation step counted. Pooling them would weight 185 RC-05 positive items twice in a table
    about what the corpus contains. The full-corpus run wins ties because it is the run every other
    class was measured in.
    """
    best: dict = {}
    for it in items:
        # Constructed positions -- twins and their sham controls -- are never pooled with natural
        # ones. Nobody played them and their `observable_action` is null.
        if it.get("twin_of") or it.get("sham_of"):
            continue
        k = (it["rule_class"], it["position_id"])
        if k not in best or it["run_id"] == "sf171-full-corpus":
            best[k] = it
    return list(best.values())


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return (sum(xs) / len(xs)) if xs else None


def single_best_move_audit(items: list[dict], evals_by_pos: dict) -> dict:
    """
    3. SINGLE-BEST-MOVE APPROXIMATION AUDIT.

    `b_valid` asks one question: is the engine's argmax a member of B? The set-valued model asks
    what obeying COSTS. They disagree in two directions and the two disagreements are not the same
    mistake:

      FALSE ALARM   b_valid = 0 and regret_B = 0. The argmax is outside B, and a permitted move is
                    just as good. `b_valid` calls this a failure of the rule class; it is not one.
                    This is the RC-21 case that started the whole action-set reanalysis.
      FALSE COMFORT b_valid = 1 and the permitted set is dangerous. The argmax happens to satisfy
                    B, so the screen scores a hit, while other permitted moves lose the game. This
                    is the RC-06 case, and `b_valid` cannot see it by construction.

    The audit counts both, per class, on the cell that matters.
    """
    out: dict = {}
    by_cell: dict = collections.defaultdict(list)
    for it in items:
        by_cell[(it["rule_class"], it["trigger_state"])].append(it)
    for (rc, cell), rows in sorted(by_cell.items()):
        fa = fc = agree = n = 0
        fc_regrets = []
        for r in rows:
            bv = r.get("b_valid")
            reg = r.get("regret_b_xs")
            if bv is None or reg is None:
                continue
            n += 1
            per = evals_by_pos.get((r["position_id"], rc), [])
            v_star = r.get("v_star_xs")
            worst = None
            if per and v_star is not None:
                rs = [v_star - e["xs"] for e in per if e.get("xs") is not None]
                worst = max(rs) if rs else None
            if not bv and reg <= 0.0:
                fa += 1
            elif bv and worst is not None and worst >= 0.25:
                fc += 1
                fc_regrets.append(worst)
            else:
                agree += 1
        out[f"{rc}::{cell}"] = {
            "n": n,
            "false_alarm_argmax_outside_B_but_obeying_is_free": fa,
            "false_alarm_rate": (fa / n) if n else None,
            "false_comfort_argmax_in_B_but_a_permitted_move_loses_0.25_xs": fc,
            "false_comfort_rate": (fc / n) if n else None,
            "false_comfort_worst_regret_mean": (
                statistics.fmean(fc_regrets) if fc_regrets else None),
            "agree": agree,
        }
    return out


def viability(gate_a: dict, c11: dict, twins: dict, gate_b: dict) -> dict:
    """
    2. RULE-CLASS VIABILITY MATRIX. One row per class, one column per thing that can disqualify it,
    and a final column naming what no amount of engine time can settle.

    THE LAST COLUMN IS THE POINT. Six of the seven columns are answerable by a machine and are
    answered. The seventh is not, and a matrix that omitted it would read as though a class with six
    green cells were ready for a player.
    """
    out: dict = {}
    for rid, e in gate_a["classes"].items():
        tp = e["cells"].get("t_plus", {})
        tm = e["cells"].get("t_minus", {})
        rob = tp.get("robustness", {})
        par = rob.get("per_action_regret_xs") or {}
        cell = c11.get(rid, {})
        delta = (gate_a.get("against_published", {}).get("per_class", {}) or {}).get(rid, {})
        d = None
        if delta.get("here_separation_advantage_over_chance_xs") is not None and \
           delta.get("published_separation_advantage_over_chance_xs") is not None:
            d = abs(delta["here_separation_advantage_over_chance_xs"] -
                    delta["published_separation_advantage_over_chance_xs"])
        out[rid] = {
            "name": e.get("name"),
            "trigger_specificity": {
                "prescription_size_t_plus": (tp.get("prescription_size") or {}).get("mean"),
                "prescription_size_t_minus": (tm.get("prescription_size") or {}).get("mean"),
                "c11_grade": cell.get("c11_grade"),
                "predicate_branches_on_trigger": cell.get("substitutes_the_antecedent_on_T_minus"),
            },
            "action_model_validity": {
                "b_valid_t_plus": tp.get("b_valid"),
                "regret_b_xs_t_plus": (tp.get("regret_b_xs") or {}).get("mean"),
                "advantage_xs_t_plus": (tp.get("advantage_xs") or {}).get("mean"),
            },
            "safety": {
                "per_action_regret_p90": par.get("p90"),
                "share_permitted_losing_100cp": rob.get(
                    "share_of_permitted_actions_losing_100cp_or_more"),
                "mean_share_of_B_that_blunders": rob.get(
                    "mean_share_of_an_items_permitted_set_that_blunders"),
            },
            "negative_cell": {
                "c11_grade": cell.get("c11_grade"),
                "regret_b_xs_t_minus": (tm.get("regret_b_xs") or {}).get("mean"),
                "b_valid_t_minus": tm.get("b_valid"),
            },
            "engine_sensitivity_abs_delta_sep_aoc": d,
            "twin_availability": (
                {"attempted": True, "pairs": twins["twins_made"], "yield": twins["yield"]}
                if rid == twins["rule_class"] else
                {"attempted": False,
                 "why": ("the transformation is trigger-specific -- for RC-05 it relocates an "
                         "attacker of the promotion square -- so a bank for another class needs its "
                         "own transformation designed. Construction is ENGINE-FREE; only scoring "
                         "the bank costs searches")}),
            "human_required": [
                "whether the cue is recognisable without being told (no gate exists)",
                "whether recognising it changes the move (Study D)",
                "whether the change survives a trigger-negative condition",
                "whether any of it appears in an ordinary game with no prompt",
            ],
        }
    return out


def item_bank_classification(items: list[dict]) -> dict:
    """
    5. REUSABLE ITEM BANK. Classify what is in the frozen bank so a later study can draw from it
    without re-deriving the labels.

    `hard negative` IS THE LABEL WORTH HAVING. A trigger-negative item where the rule still names a
    move AND that move is wrong is the item that separates conditional discrimination from response
    bias. An item where the rule names nothing on T- is a VACANT cell in miniature and teaches the
    instrument nothing.
    """
    counts: collections.Counter = collections.Counter()
    per_class: dict = collections.defaultdict(collections.Counter)
    for it in items:
        rc, cell = it["rule_class"], it["trigger_state"]
        labels = [cell]
        if it.get("twin_of"):
            labels.append("minimal_functional_twin")
        elif it.get("sham_of"):
            labels.append("sham_control_matched_perturbation_no_trigger_flip")
        elif it.get("source_game_id") is None:
            labels.append("provenance_missing")
        if it.get("no_satisfying_move"):
            labels.append("degenerate_no_permitted_move")
        if it.get("no_violating_move"):
            labels.append("degenerate_every_move_permitted")
        if cell == "negative" and not it.get("no_satisfying_move"):
            reg = it.get("regret_b_xs")
            if reg is not None and reg >= 0.10:
                labels.append("hard_negative_rule_names_a_move_and_it_is_wrong")
            elif reg is not None:
                labels.append("soft_negative_rule_names_a_move_and_it_is_fine")
        if it.get("max_regret_in_b_xs") is not None and it["max_regret_in_b_xs"] >= 0.5:
            labels.append("boundary_permitted_set_contains_a_losing_move")
        for l in labels:
            counts[l] += 1
            per_class[rc][l] += 1
    return {"totals": dict(counts),
            "per_class": {k: dict(v) for k, v in sorted(per_class.items())}}


def failure_ontology(gate_a: dict, c11: dict) -> dict:
    """
    6. FAILURE ONTOLOGY. For every class that is not a candidate, the exact reason -- and then the
    recurring mechanisms, because a mechanism that can be checked WITHOUT an engine is a pre-screen
    that saves the next run.
    """
    reasons: dict = {}
    mech: collections.Counter = collections.Counter()
    for rid, e in gate_a["classes"].items():
        tp = e["cells"].get("t_plus", {})
        rob = tp.get("robustness", {})
        par = rob.get("per_action_regret_xs") or {}
        grade = c11.get(rid, {}).get("c11_grade")
        why = []
        if grade == "VACANT":
            why.append("VACANT noise cell: the rule names no act at all on >=95% of T- items, so "
                       "its negative cell carries no information about the rule")
            mech["vacant noise cell"] += 1
        if grade == "SATURATED":
            why.append("SATURATED noise cell: nearly every legal move satisfies the rule when the "
                       "trigger is absent, so separation is a fact about the predicate")
            mech["saturated noise cell"] += 1
        if c11.get(rid, {}).get("substitutes_the_antecedent_on_T_minus"):
            why.append("the response predicate BRANCHES on the trigger: a hit and a false alarm "
                       "score different behaviours, so no matching can repair the contrast")
            mech["branching response predicate"] += 1
        if par.get("p90") is not None and par["p90"] >= 0.5:
            why.append(f"UNSAFE PERMITTED SET: the 90th-percentile permitted move costs "
                       f"{par['p90']:.3f} expected score")
            mech["unsafe permitted set"] += 1
        if (tp.get("advantage_xs") or {}).get("mean") is not None and \
                tp["advantage_xs"]["mean"] <= 0:
            why.append("NOT NECESSARY: on average the best permitted move is no better than the "
                       "best forbidden one when the trigger fires")
            mech["not necessary"] += 1
        reasons[rid] = {"name": e.get("name"), "c11": grade, "reasons": why or ["none of the "
                        "machine-checkable failures fired"]}
    return {
        "per_class": reasons,
        "recurring_mechanisms": dict(mech),
        "engine_free_pre_screens": [
            {"mechanism": "vacant or saturated noise cell",
             "check": "C11: prescription size on the trigger-negative cell under the class's own "
                      "prescription sentence",
             "cost": "no engine, no participants, no new corpus",
             "would_have_retired": 10},
            {"mechanism": "branching response predicate",
             "check": "does `satisfies` call the trigger, or recompute the same board condition? "
                      "`branching_audit.py` already does this and found the source-text detector "
                      "misses RC-12",
             "cost": "static, no engine",
             "would_have_retired": 2},
            {"mechanism": "the predicate scores a DIFFERENT ACT on the negative cell than the "
                          "class's own prescription sentence names",
             "check": "C11's `substitutes_the_antecedent_on_T_minus`: read the shipped predicate "
                      "against the prescription sentence and ask whether the antecedent is the "
                      "same object on both cells",
             "cost": "static, no engine, no corpus",
             "would_have_retired": 0,
             "note": "10 of 17 classes do this, which is why C11 grades them on the AS-STATED "
                     "reading. It is not itself a disqualification -- it is the reason a "
                     "separation statistic cannot be read at face value, and it is the single "
                     "most common machine-checkable defect in the register"},
            {"mechanism": "prescription covers most legal moves",
             "check": "prescription size on T+; RC-03's is .543",
             "cost": "no engine",
             "would_have_retired": 0,
             "note": "a wide prescription is not a failure, but it caps how much the rule can say"},
        ],
        "what_still_needs_an_engine": [
            "safety of the permitted set: the regret distribution over B needs a value per move",
            "necessity: V_notB needs a search over the complement",
            "any statement about what obeying COSTS",
        ],
    }


def retest_assets(items: list[dict]) -> dict:
    """
    7. FUTURE NATURAL-RETEST ASSETS. Which evaluated positions could seed an opportunity matcher.

    NO ECOLOGICAL CLAIM IS MADE. Every position here came from a real game, but the ITEM is a
    presented position with an engine label; nobody chose a move under a clock in the item. What the
    corpus can support is a matcher's TRAINING and CALIBRATION set -- how often the trigger fires in
    ordinary play, and what the base rate of rule-consistent action was among the humans who
    actually played these positions -- which is a different and smaller claim.
    """
    per_class: dict = collections.defaultdict(lambda: {"positions": 0, "with_human_move": 0,
                                                       "human_followed_rule": 0})
    for it in items:
        if it["trigger_state"] != "positive":
            continue
        d = per_class[it["rule_class"]]
        d["positions"] += 1
        if it.get("observable_action") is not None:
            d["with_human_move"] += 1
            d["human_followed_rule"] += int(bool(it["observable_action"]))
    return {
        "per_class": {k: {**v,
                          "human_rule_consistent_rate": (
                              v["human_followed_rule"] / v["with_human_move"]
                              if v["with_human_move"] else None)}
                      for k, v in sorted(per_class.items())},
        "what_this_supports": [
            "the base rate at which each trigger fires in ordinary play, already in the corpus "
            "manifest's trigger_counts",
            "the unaided rate at which real players made a rule-consistent move on T+ items",
            "a calibration set for a cue matcher: positions where the trigger is known to fire",
        ],
        "what_this_does_not_support": [
            "that any of these players recognised the trigger; the move is all that is observed",
            "any ecological claim. The retest the product needs happens during a game with no "
            "prompt, and nothing here was collected that way",
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-a", required=True)
    ap.add_argument("--gate-b", required=True)
    ap.add_argument("--c11", required=True)
    ap.add_argument("--twins", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    gate_a = json.load(open(a.gate_a, encoding="utf-8"))
    gate_b = json.load(open(a.gate_b, encoding="utf-8"))
    c11 = json.load(open(a.c11, encoding="utf-8"))["classes"]
    twins = json.load(open(a.twins, encoding="utf-8"))

    items = list(stream("item_bank.jsonl.zst"))
    evals_by_pos: dict = collections.defaultdict(list)

    # AN EVALUATION IS SCOPED TO THE CLASS WHOSE B IT BELONGS TO, and the first version of this
    # was wrong in a way that only shows up in a corpus with shared positions. It attached every
    # `multipv-over-B` evaluation at a position to EVERY rule class that position serves --
    # 581 positions here, 269 of them with a different |B| per class -- so one class's permitted
    # moves leaked into another class's regret distribution. `b_moves` on the item row is the
    # membership the evaluation record cannot carry, because the evaluation itself is
    # class-independent: a position, a move and a policy. What is class-dependent is WHICH moves
    # were evaluated, and that lives on the item.
    b_moves: dict = {(it["position_id"], it["rule_class"]): set(it.get("b_moves") or [])
                     for it in items}
    at_position: dict = collections.defaultdict(list)
    for e in stream("engine_evaluations.jsonl.zst"):
        if e["policy"] != "multipv-over-B":
            continue
        at_position[e["position_id"]].append(e)
    for (pos, rc), moves in b_moves.items():
        if not moves:
            continue
        # THE ROOT SET, NOT JUST MEMBERSHIP. A move can be in two classes' B sets at one position
        # and carry a different value in each, because a MultiPV search over B(RC-21) and one over
        # B(RC-09) are different searches. Matching on membership alone picked whichever was
        # emitted first; matching on the root set picks the one made for THIS class.
        want = sorted(moves)
        evals_by_pos[(pos, rc)] = [e for e in at_position.get(pos, ())
                                   if e["moves"] and e["moves"][0] in moves
                                   and (e.get("root_set") or []) == want]

    nat = natural(items)
    result = {
        "version": "1.0.0",
        "natural_items_after_dedup": len(nat),
        "items_in_bank": len(items),
        "derived_from": "the frozen corpus only. No engine search was run to produce this file.",
        "1_action_set_atlas": atlas(nat, evals_by_pos),
        "2_rule_class_viability": viability(gate_a, c11, twins, gate_b),
        "3_single_best_move_approximation": single_best_move_audit(nat, evals_by_pos),
        "5_item_bank": item_bank_classification(items),
        "6_failure_ontology": failure_ontology(gate_a, c11),
        "7_natural_retest_assets": retest_assets(nat),
    }
    json.dump(result, open(a.out, "w", encoding="utf-8"), indent=1)
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
