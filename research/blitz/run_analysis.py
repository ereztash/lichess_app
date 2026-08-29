"""The analysis, with the preregistered gate enforced by the code rather than by discipline.

Stage 2 decides whether a stable deep reference exists. If it does not, stages 4 and 5 -- the two
hypotheses -- DO NOT RUN, and this script says so instead of producing numbers nobody is allowed to
quote. That is the point of the whole exercise: the architecture has to be able to discover that the
idea is wrong before the idea becomes a product.

The reason the gate is fatal rather than inconvenient is stated in the report it writes: the
remaining-computation-value predictor and the win-probability-loss outcome BOTH contain the term
V_deep(best move). Error in that term is common to predictor and outcome, so an unstable reference
does not merely add noise -- it manufactures correlation between the two in the direction that
looks like a finding.

Run: python3 research/blitz/run_analysis.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from blitz import plots  # noqa: E402
from blitz.bootstrap import cluster_bootstrap, naive_bootstrap  # noqa: E402
from blitz.dataset import DATA, load  # noqa: E402
from blitz.statistics import cohen_kappa, gini, quantiles, spearman, wilson  # noqa: E402

GATE_TARGET = 0.95


def gate_one(summary: dict) -> dict:
    """The preregistered deep-reference rule, applied exactly as written and not one step further."""
    for check in summary["checks"]:
        if check["strictRate"] >= GATE_TARGET:
            return {"passed": True, "budget": check["budget"], "tolerance": "strict"}
    for check in summary["checks"]:
        if check["tolerantRate"] >= GATE_TARGET:
            return {"passed": True, "budget": check["budget"], "tolerance": "tolerant"}
    best_strict = max(summary["checks"], key=lambda c: c["strictRate"])
    best_tolerant = max(summary["checks"], key=lambda c: c["tolerantRate"])
    return {
        "passed": False,
        "code": "STOP-D",
        "budget": None,
        "tolerance": None,
        "bestStrict": {"budget": best_strict["budget"], "rate": best_strict["strictRate"]},
        "bestTolerant": {"budget": best_tolerant["budget"], "rate": best_tolerant["tolerantRate"]},
    }


def provenance(art) -> dict:
    m = art.event_manifest
    return {
        "months": m["months"],
        "prefixBytes": m["prefixBytes"],
        "gamesRead": {k: v["read"] for k, v in m["counters"].items()},
        "gamesQualified": {k: v["qualified"] for k, v in m["counters"].items()},
        "gameRejections": {k: v["rejected"] for k, v in m["counters"].items()},
        "decisions": len(art.events),
        "games": art.games,
        "players": art.players,
        "recurringPlayers": m["recurringChosen"],
        "datasetSha256": m["datasetSha256"],
        "seed": m["seed"],
    }


def reference_noise(art) -> dict:
    """How far the reference moves when its budget doubles, in winning-chance units."""
    rows = art.saturation
    pairs = len(rows[0]["budgets"]) - 1
    out = {}
    for i in range(pairs):
        deltas = np.array(
            [abs(r["budgets"][i]["value"] - r["budgets"][i + 1]["value"]) for r in rows]
        )
        out[f"{rows[0]['budgets'][i]['nodes']}v{rows[0]['budgets'][i + 1]['nodes']}"] = {
            "mean": float(deltas.mean()),
            **quantiles(deltas),
            "n": len(deltas),
        }
    return out


def label_stability(art) -> dict | None:
    """What choosing one defensible reference over another does to the OUTCOME VARIABLE."""
    if not art.budgeted:
        return None
    rows = [
        r
        for r in art.budgeted
        if all(ref["inaccurate"] is not None for ref in r["references"])
    ]
    if not rows:
        return None
    low_key, high_key = 0, 1
    for r in rows:
        r["_flip"] = r["references"][low_key]["inaccurate"] != r["references"][high_key]["inaccurate"]

    low = np.array([r["references"][low_key]["inaccurate"] for r in rows], dtype=bool)
    high = np.array([r["references"][high_key]["inaccurate"] for r in rows], dtype=bool)
    flips = int((low != high).sum())

    clustered = cluster_bootstrap(rows, "gameId", lambda rs: float(np.mean([r["_flip"] for r in rs])))
    naive = naive_bootstrap(rows, lambda rs: float(np.mean([r["_flip"] for r in rs])))

    # The ceiling any model could reach. Treat the 400k label as a PERFECT predictor of itself and
    # score it against the 800k label: a binary predictor's AUC is its balanced accuracy. Whatever
    # a model achieves against one reference, this is what it is worth against the other.
    tp = int((low & high).sum())
    fn = int((~low & high).sum())
    tn = int((~low & ~high).sum())
    fp = int((low & ~high).sum())
    sensitivity = tp / (tp + fn) if tp + fn else float("nan")
    specificity = tn / (tn + fp) if tn + fp else float("nan")
    ceiling = (sensitivity + specificity) / 2

    incoherent = {}
    for index, ref in enumerate(("400k", "800k")):
        raw = np.array([r["references"][index]["rawLoss"] for r in rows], dtype=float)
        worse = int((raw < 0).sum())
        incoherent[ref] = {
            "count": worse,
            "rate": worse / len(rows),
            "ci": wilson(worse, len(rows)),
            "worstMargin": float(raw.min()),
        }

    losses_low = np.array([r["references"][low_key]["loss"] for r in rows], dtype=float)
    losses_high = np.array([r["references"][high_key]["loss"] for r in rows], dtype=float)
    return {
        "decisions": len(rows),
        "games": len({r["gameId"] for r in rows}),
        "inaccurateRate": {"400k": float(low.mean()), "800k": float(high.mean())},
        "flips": flips,
        "flipRate": flips / len(rows),
        "flipRateClusterCi": clustered["ci"],
        "flipRateNaiveCi": naive["ci"],
        "kappa": cohen_kappa(low, high),
        "lossSpearman": spearman(losses_low, losses_high),
        "aucCeiling": ceiling,
        "sensitivity": sensitivity,
        "specificity": specificity,
        "referenceIncoherence": incoherent,
    }


def trajectory_description(art) -> dict | None:
    """OBSERVATION ONLY. Do positions differ at all in how much a search changes its answer?

    This does not and cannot say the difference predicts anything: the reference it is measured
    against failed Gate 1. What it CAN settle is whether the construct is degenerate -- a quantity
    that is the same everywhere has nothing to offer any model, and that is worth knowing before
    anyone spends compute on one.
    """
    if not art.budgeted:
        return None
    rows = [r for r in art.budgeted if r["metrics"]["remainingComputationValue"] is not None]
    if not rows:
        return None
    rcv = np.array([r["metrics"]["remainingComputationValue"] for r in rows], dtype=float)
    rcv_area = np.array([r["metrics"]["remainingComputationValueArea"] for r in rows], dtype=float)
    gap = np.array(
        [r["metrics"]["candidateGap"] if r["metrics"]["candidateGap"] is not None else np.nan for r in rows],
        dtype=float,
    )
    instability = np.array([r["metrics"]["moveInstability"] for r in rows], dtype=float)
    converged = [r["metrics"]["convergenceNodes"] for r in rows]

    # The scale the construct must beat to be more than reference noise: how far the reference
    # itself moves when its budget doubles.
    noise = reference_noise(art)["400000v800000"]["mean"]
    return {
        "decisions": len(rows),
        "remainingComputationValue": {
            "mean": float(rcv.mean()),
            **quantiles(rcv),
            "shareBelowReferenceNoise": float((rcv < noise).mean()),
            "gini": gini(rcv),
        },
        "remainingComputationValueArea": {"mean": float(rcv_area.mean()), **quantiles(rcv_area)},
        "moveInstability": {
            "mean": float(instability.mean()),
            "shareZero": float((instability == 0).mean()),
            **quantiles(instability),
        },
        "convergenceNodes": {
            str(budget): float(np.mean([c == budget for c in converged]))
            for budget in sorted({c for c in converged if c is not None})
        },
        "candidateGap": {"mean": float(np.nanmean(gap)), **quantiles(gap)},
        "spearmanRcvVsCandidateGap": spearman(rcv, gap),
        "referenceNoiseScale": noise,
    }


def determinism_control(art) -> dict | None:
    """Control 3, mechanically: identical positions must produce identical features.

    Every feature is computed from `fenBefore` alone, so two decisions that met the same position
    must come out identical. If they do not, something outside the position is reaching the
    features -- a warm transposition table, a stray search order, or a leak from the move that was
    actually played. This is the check that would catch it.
    """
    if not art.budgeted:
        return None
    by_fen: dict[str, list[dict]] = {}
    for row in art.budgeted:
        by_fen.setdefault(row.get("fen", row["key"]), []).append(row)
    repeated = {k: v for k, v in by_fen.items() if len(v) > 1}
    mismatches = 0
    for group in repeated.values():
        first = json.dumps(group[0]["metrics"], sort_keys=True)
        for other in group[1:]:
            if json.dumps(other["metrics"], sort_keys=True) != first:
                mismatches += 1
    return {"repeatedPositions": len(repeated), "mismatches": mismatches}


def main() -> None:
    art = load()
    report: dict = {"provenance": provenance(art)}

    gate = gate_one(art.saturation_summary)
    report["gate1"] = {
        **gate,
        "target": GATE_TARGET,
        "epsilonStrict": art.saturation_summary["epsilonStrict"],
        "epsilonTolerant": art.saturation_summary["epsilonTolerant"],
        "checks": art.saturation_summary["checks"],
        "meanDepthByBudget": art.saturation_summary["meanDepthByBudget"],
    }
    if art.saturation_extended_summary:
        report["gate1Extended"] = {
            "note": "post-hoc, outside the preregistered grid; cannot rescue the gate, only says "
            "whether the curve is climbing or flat",
            "checks": art.saturation_extended_summary["checks"],
            "meanDepthByBudget": art.saturation_extended_summary["meanDepthByBudget"],
        }
    report["referenceNoise"] = reference_noise(art)

    if gate["passed"]:
        raise SystemExit(
            "Gate 1 passed; H1/H2 stages are not implemented in this run. Re-read the "
            "preregistration before adding them."
        )

    report["stop"] = {
        "code": "STOP-D",
        "stage": "deep reference",
        "consequence": "H1 and H2 were not run. Both models read V_deep(best move) in their "
        "predictors AND in their outcome, so an unstable reference does not only attenuate an "
        "effect -- the shared error term manufactures correlation between predictor and outcome.",
    }
    report["labelStability"] = label_stability(art)
    report["trajectoryDescription"] = trajectory_description(art)
    report["determinismControl"] = determinism_control(art)

    checks = art.saturation_summary["checks"]
    if art.saturation_extended_summary:
        checks = art.saturation_extended_summary["checks"]
    plots.saturation_curve(checks, GATE_TARGET, DATA.parent / "saturation_curve.svg")
    if report["trajectoryDescription"]:
        values = [
            r["metrics"]["remainingComputationValue"]
            for r in art.budgeted
            if r["metrics"]["remainingComputationValue"] is not None
        ]
        plots.distribution(
            values,
            "Value still on the table after 20,000 nodes",
            "remaining computation value (winning chances)",
            DATA.parent / "remaining_computation_value.svg",
        )

    (DATA / "analysis_results.json").write_text(json.dumps(report, indent=2, default=float))
    print(json.dumps(report, indent=2, default=float))


if __name__ == "__main__":
    main()
