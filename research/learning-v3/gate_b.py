"""
GATE B, QUESTIONS 3 AND 5: does the trigger move the decision, or does item difficulty move it?

The twin bank from `minimal_twins.py` answers questions 1, 2 and 4 by construction and by
counting -- one predicate held fixed, one material-preserving relocation, every covariate delta
recorded. What it cannot answer without the engine is the pair that matters:

  Q3  does the transformation preserve enough of the decision problem that ITEM DIFFICULTY is not
      doing the work?
  Q5  does the ACTION-SET CONTRAST move in the predicted direction?

THE PAIRED FORM IS THE WHOLE POINT. A difference between the T+ and T- cells of a naturally
occurring corpus is a difference between two sets of positions that differ in every way at once;
`GO_NO_GO.md` records exactly that failure, with material-balance SMD -0.487 and T+ puzzles ~125
rating points easier than T-. Here each T+ item has ITS OWN T- item, one piece one square away, so
the contrast is within pair and the between-pair variation cancels.

WHAT COUNTS AS THE PREDICTED DIRECTION, stated before the numbers exist:

  the rule is `if a pawn can promote to a square nothing attacks, promote`. Its whole content is
  that promoting is right WHEN THE SQUARE IS SAFE. So obeying should cost less, and be worth more
  against the alternative, on T+ than on T-:

      regret_B   T+  <  T-       obeying is cheaper when the trigger fires
      advantage  T+  >  T-       disobeying is more expensive when the trigger fires

  A twin bank that shows neither is a bank where the trigger does not govern the decision, and
  that is `B-PREDICATE-FAIL` reported honestly rather than a design to be tuned.

WHAT DIFFICULTY IS MEASURED BY, and why not by the covariates. Legal-move counts and material are
what the twin holds fixed, so using them to argue the pair is matched would be circular. Difficulty
here is `V*` -- what the position is worth to the side to move under the engine -- and the spread of
values across all legal moves, which is how much the choice matters at all. A pair whose two halves
differ wildly on those is a pair where the relocation changed the game, whatever the piece counts
say.

    python gate_b.py --raw <twin_bank_raw.jsonl> --pairs results/minimal_twins.json \
        --out results/gate_b.json
"""
from __future__ import annotations

import argparse
import json
import math
import statistics


def paired(deltas: list[float]) -> dict | None:
    """
    Mean, sd, a paired-t statistic and a 95% interval. No p-value is reported as a verdict.

    THE INTERVAL IS THE RESULT, not the t. `PRE_HUMAN_GATES.md` forbids introducing a numerical
    acceptance threshold here, so this returns the estimate and its precision and lets the audit
    document say what it means. A t is included only because a reader who wants one should not have
    to recompute it from the sd.
    """
    xs = [d for d in deltas if d is not None]
    if len(xs) < 2:
        return None
    m = statistics.fmean(xs)
    sd = statistics.stdev(xs)
    se = sd / math.sqrt(len(xs))
    return {
        "n_pairs": len(xs),
        "mean_difference": m,
        "sd": sd,
        "se": se,
        "ci95": [m - 1.96 * se, m + 1.96 * se],
        "t": (m / se) if se else None,
        "share_positive": sum(1 for x in xs if x > 0) / len(xs),
        "share_zero": sum(1 for x in xs if x == 0) / len(xs),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, help="action_set.py --raw over the twin bank")
    ap.add_argument("--pairs", required=True, help="minimal_twins.py --report")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    by_fen = {}
    failures = 0
    for line in open(a.raw, encoding="utf-8"):
        r = json.loads(line)
        if r.get("engine_failed"):
            failures += 1
            continue
        by_fen[r["fen"]] = r

    report = json.load(open(a.pairs, encoding="utf-8"))
    scored, unscored = [], 0
    for p in report["pairs"]:
        o = by_fen.get(p["original_fen"])
        t = by_fen.get(p["twin_fen"])
        if o is None or t is None:
            unscored += 1
            continue
        # Orient every pair the same way: `plus` is the T+ half whichever side it came from, so a
        # difference is always "trigger present minus trigger absent" and the two directions of
        # the transformation can be pooled or split at will.
        plus, minus = (o, t) if p["original_state"] == "positive" else (t, o)
        scored.append({
            "built_from": p["original_state"],
            "distance": p["transformation"]["chebyshev_distance"],
            "regret_b_xs": _d(plus, minus, "regret_b_xs"),
            "advantage_xs": _d(plus, minus, "advantage_xs"),
            "b_valid": _d(plus, minus, "b_valid"),
            "prescription_size": _d(plus, minus, "prescription_size"),
            "v_star_xs_plus": plus.get("v_star_xs"),
            "v_star_xs_minus": minus.get("v_star_xs"),
            "v_star_xs_gap": _d(plus, minus, "v_star_xs"),
            "max_regret_in_b_xs": _d(plus, minus, "max_regret_in_b_xs"),
            "n_legal_plus": plus.get("n_legal"),
            "n_legal_minus": minus.get("n_legal"),
        })

    def col(key: str, only: str | None = None) -> dict | None:
        return paired([s[key] for s in scored
                       if only is None or s["built_from"] == only])

    out = {
        "version": "1.0.0",
        "rule_class": report["rule_class"],
        "transformation": report["transformation"],
        "pairs_built": len(report["pairs"]),
        "pairs_scored": len(scored),
        "pairs_unscored": unscored,
        "engine_failures": failures,
        "predicted_direction": {
            "regret_b_xs": "T+ minus T- should be NEGATIVE: obeying costs less when the trigger fires",
            "advantage_xs": "T+ minus T- should be POSITIVE: disobeying costs more when the trigger fires",
        },
        "q5_action_set_contrast": {
            "regret_b_xs": {"all": col("regret_b_xs"),
                            "built_from_positive": col("regret_b_xs", "positive"),
                            "built_from_negative": col("regret_b_xs", "negative")},
            "advantage_xs": {"all": col("advantage_xs"),
                             "built_from_positive": col("advantage_xs", "positive"),
                             "built_from_negative": col("advantage_xs", "negative")},
            "b_valid": {"all": col("b_valid")},
            "max_regret_in_b_xs": {"all": col("max_regret_in_b_xs")},
        },
        "q3_difficulty": {
            "why_not_the_covariates": (
                "material and piece count are held fixed by the transformation, so using them to "
                "argue the pair is matched would be circular. Difficulty is what the position is "
                "worth and how much the choice matters"),
            "v_star_xs_gap": col("v_star_xs_gap"),
            "prescription_size_gap": col("prescription_size"),
        },
        "per_pair": scored,
    }
    json.dump(out, open(a.out, "w", encoding="utf-8"), indent=1)
    print(f"{len(scored)} pairs scored, {unscored} unscored, {failures} engine failures")
    return 0


def _d(plus: dict, minus: dict, key: str):
    a, b = plus.get(key), minus.get(key)
    return None if a is None or b is None else a - b


if __name__ == "__main__":
    raise SystemExit(main())
