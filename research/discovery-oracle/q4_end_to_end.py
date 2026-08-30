"""Q4 of the M0 audit: does the shipped six-bucket detector survive the harness V2 would face?

THE CHAIN, NOT THE COMPONENT. `shared/detector.ts` was calibrated against a shuffled-label control
-- one record, permuted hundreds of times, worst cell reported -- and that control is a good one
for the question it asks: does the SEARCH invent structure? It is not the question this audit asks.
The product does not stop at a search. It scans six buckets, collapses them to three variables,
selects one claim, and then tests that claim prospectively. A rate measured on the first step is
not the rate of the thing that reaches a player.

SO THE UNIT MEASURED HERE IS THE WHOLE CHAIN:

    detect(derivation games, DEFAULT_THRESHOLDS)      the six-bucket scan
    readVariables(...).findings[0].strongest          one claim, three variables (bucket-variable.ts)
    freeze that bucket key
    detect(validation games, PREREGISTERED_THRESHOLDS, onlyBucketKey)   the one test the freeze bought
    same sign, or it is a refutation and not a replication

and the number reported is P(the chain emits a validated claim | there is no true pattern), with a
Wilson upper bound. That is `docs/discovery-v2/` 's stated criterion, and it is the only rate that
describes what a player would be told.

THE SPLIT IS BY GAME, NEVER BY DECISION. Twenty games suggest the claim, twenty different games
test it. A split inside a game would put one sitting -- one opponent, one clock, one mood -- on both
sides of the wall, which is precisely the correlation Q1 is about.

WHAT THE NULL WORLDS ARE FOR, AND WHAT THE PLANTED ONES ARE FOR. A chain that never speaks has a
false-claim rate of zero and is useless, so silence is not the criterion on its own. The planted
worlds ask the other half: when there IS something there, does the chain find it, and does it find
the RIGHT thing? `wrong_proxy` and `mirror` are the two ways of finding the wrong thing, and
`shared/bucket-variable.ts` measured the second one on this very detector before this file existed.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.bridge import run_detector, to_line  # noqa: E402
from oracle.worlds import NULL_WORLDS, PLANTS, generate_record, split_at_game  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"

RECORDS_PER_WORLD = 800
RECORDS_PER_PLANT = 400
GAMES_PER_RECORD = 40
DERIVATION_GAMES = 20
SEED = 20260830
#: The share of the gap's variance that is between games. Not known for real players; swept.
TILT_SWEEP = (0.0, 0.04, 0.08, 0.12)
SWEEP_BAND = (0.50, 0.65)
#: The ceiling this project holds itself to end to end.
FALSE_CLAIM_CEILING = 0.02
#: ...and the power floor, for effects DECLARED STRONG IN ADVANCE. See `STRONG_PLANTS`.
POWER_FLOOR = 0.95
#: Which planted effects the power criterion applies to, named before the run.
STRONG_PLANTS = ("clean-middlegame", "clean-fast")


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Interval for a proportion.

    Wilson rather than the normal approximation for the reason `research/blitz/statistics.py`
    gives: every proportion here sits near an end, where the symmetric interval runs past it and
    stops being an interval. Reproduced rather than imported because that module belongs to a
    different study with its own data loader, and importing it would drag that study's `DATA` path
    into this one.
    """
    if n == 0:
        return (0.0, 1.0)
    p = successes / n
    denom = 1 + z * z / n
    centre = p + z * z / (2 * n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((centre - half) / denom, (centre + half) / denom)


def run_world(spec, records: int, seed: int, plant=None) -> list[dict]:
    rng = np.random.default_rng(seed)
    drawn = [generate_record(rng, spec, GAMES_PER_RECORD, plant) for _ in range(records)]
    lines = (
        to_line(record, f"{spec.name}-{i}", spec.name, split_at_game(record, DERIVATION_GAMES))
        for i, record in enumerate(drawn)
    )
    return list(run_detector(lines))


def null_scorecard(name: str, results: list[dict], icc_note: float | None = None) -> dict:
    n = len(results)
    cleared = sum(1 for r in results if r["cleared"])
    claimed = sum(1 for r in results if r["selected"] is not None)
    validated = sum(1 for r in results if r["validated"])
    by_bucket: dict[str, int] = {}
    for r in results:
        for key in r["cleared"]:
            by_bucket[key] = by_bucket.get(key, 0) + 1
    return {
        "world": name,
        "records": n,
        "sigma_tilt": icc_note,
        "any_bucket_cleared": cleared,
        "any_bucket_rate": cleared / n if n else float("nan"),
        "any_bucket_rate_ci": wilson(cleared, n),
        "claim_formed": claimed,
        "claim_formed_rate": claimed / n if n else float("nan"),
        "validated_claims": validated,
        "false_validated_rate": validated / n if n else float("nan"),
        "false_validated_rate_ci": wilson(validated, n),
        "cleared_by_bucket": dict(sorted(by_bucket.items())),
    }


def planted_scorecard(plant, results: list[dict]) -> dict:
    n = len(results)
    target = plant.expressible_as
    cleared = sum(1 for r in results if r["cleared"])
    claimed = [r for r in results if r["selected"] is not None]
    on_target = sum(1 for r in claimed if target is not None and r["selected"] == target)
    validated = sum(1 for r in results if r["validated"])
    validated_on_target = sum(
        1 for r in results if r["validated"] and target is not None and r["selected"] == target
    )
    # A MIRROR is a claim about a level that cleared on the opposite side of the record's average
    # from the planted one. `shared/bucket-variable.ts` measured this on the shipped detector:
    # a middlegame weakness makes "the opening" look separable, in the underconfident direction,
    # every time. Every plant here raises the gap, so a negative contrast is a mirror.
    mirrors = sum(1 for r in claimed if (r["selectedGapDifference"] or 0) < 0)
    wrong_proxy = sum(
        1 for r in claimed if target is not None and r["selected"] != target and (r["selectedGapDifference"] or 0) > 0
    )
    return {
        "plant": plant.name,
        "delta": plant.delta,
        "expressible_as": target,
        "records": n,
        "any_bucket_recall": cleared / n if n else float("nan"),
        "any_bucket_recall_ci": wilson(cleared, n),
        "claim_formed_rate": len(claimed) / n if n else float("nan"),
        "predicate_recovery": on_target / n if n else float("nan"),
        "predicate_recovery_ci": wilson(on_target, n),
        "validation_success": validated / n if n else float("nan"),
        "validation_success_ci": wilson(validated, n),
        "validated_on_target": validated_on_target / n if n else float("nan"),
        "validated_on_target_ci": wilson(validated_on_target, n),
        "mirror_rate": mirrors / n if n else float("nan"),
        "wrong_proxy_rate": wrong_proxy / n if n else float("nan"),
    }


def main() -> int:
    RESULTS.mkdir(exist_ok=True)

    nulls = []
    for index, spec in enumerate(NULL_WORLDS):
        print(f"null {spec.name} ...", file=sys.stderr)
        nulls.append(null_scorecard(spec.name, run_world(spec, RECORDS_PER_WORLD, SEED + index)))

    sweep = []
    base = NULL_WORLDS[1]
    for index, sigma in enumerate(TILT_SWEEP):
        spec = replace(
            base,
            name=f"SWEEP-tilt-{sigma:.2f}",
            sigma_tilt=sigma,
            confidence_floor=SWEEP_BAND[0],
            confidence_ceiling=SWEEP_BAND[1],
            confidence_centre=sum(SWEEP_BAND) / 2,
        )
        print(f"sweep {spec.name} ...", file=sys.stderr)
        sweep.append(
            null_scorecard(spec.name, run_world(spec, RECORDS_PER_WORLD, SEED + 700 + index), sigma)
        )

    planted = []
    for index, plant in enumerate(PLANTS):
        print(f"plant {plant.name} ...", file=sys.stderr)
        planted.append(planted_scorecard(plant, run_world(base, RECORDS_PER_PLANT, SEED + 900 + index, plant)))

    # POOLED ACROSS THE TEN NULL WORLDS. The ceiling is a statement about the chain, not about one
    # world, and a per-world rate on 800 records cannot resolve 2% on its own. The worst single
    # world is reported beside it, because a pooled rate can hide one world that is much worse.
    pooled_n = sum(row["records"] for row in nulls)
    pooled_validated = sum(row["validated_claims"] for row in nulls)
    pooled_ci = wilson(pooled_validated, pooled_n)
    worst = max(nulls, key=lambda row: row["false_validated_rate_ci"][1])

    strong = [row for row in planted if row["plant"] in STRONG_PLANTS]
    report = {
        "records_per_world": RECORDS_PER_WORLD,
        "records_per_plant": RECORDS_PER_PLANT,
        "games_per_record": GAMES_PER_RECORD,
        "derivation_games": DERIVATION_GAMES,
        "seed": SEED,
        "false_claim_ceiling": FALSE_CLAIM_CEILING,
        "power_floor": POWER_FLOOR,
        "strong_plants": list(STRONG_PLANTS),
        "nulls": nulls,
        "tilt_sweep": sweep,
        "planted": planted,
        "pooled_null": {
            "records": pooled_n,
            "validated_claims": pooled_validated,
            "rate": pooled_validated / pooled_n,
            "ci": pooled_ci,
            "upper_ci_below_ceiling": pooled_ci[1] < FALSE_CLAIM_CEILING,
            "worst_world": worst["world"],
            "worst_world_upper_ci": worst["false_validated_rate_ci"][1],
        },
        "power": {
            row["plant"]: {
                "validated_on_target": row["validated_on_target"],
                "lower_ci": row["validated_on_target_ci"][0],
                "meets_floor": row["validated_on_target_ci"][0] > POWER_FLOOR,
            }
            for row in strong
        },
    }
    (RESULTS / "q4_end_to_end.json").write_text(json.dumps(report, indent=2))

    print(f"\n{'world':34} {'n':>5} {'any bucket':>12} {'claim':>8} {'validated':>10} {'upper 95%':>10}")
    for row in nulls + sweep:
        print(
            f"{row['world']:34} {row['records']:5d} {row['any_bucket_rate']:12.4f} "
            f"{row['claim_formed_rate']:8.4f} {row['false_validated_rate']:10.4f} "
            f"{row['false_validated_rate_ci'][1]:10.4f}"
        )
    print(
        f"\npooled null: {pooled_validated}/{pooled_n} = {pooled_validated / pooled_n:.4f}"
        f"  95% CI [{pooled_ci[0]:.4f}, {pooled_ci[1]:.4f}]"
        f"  ceiling {FALSE_CLAIM_CEILING}"
        f"  -> {'PASS' if pooled_ci[1] < FALSE_CLAIM_CEILING else 'FAIL'}"
    )

    print(
        f"\n{'plant':26} {'delta':>7} {'recall':>8} {'on target':>10} {'validated':>10} "
        f"{'on target':>10} {'mirror':>8} {'proxy':>8}"
    )
    for row in planted:
        print(
            f"{row['plant']:26} {row['delta']:7.3f} {row['any_bucket_recall']:8.4f} "
            f"{row['predicate_recovery']:10.4f} {row['validation_success']:10.4f} "
            f"{row['validated_on_target']:10.4f} {row['mirror_rate']:8.4f} {row['wrong_proxy_rate']:8.4f}"
        )
    for name, entry in report["power"].items():
        print(
            f"\npower on {name}: validated-on-target {entry['validated_on_target']:.4f}"
            f"  lower 95% {entry['lower_ci']:.4f}  floor {POWER_FLOOR}"
            f"  -> {'PASS' if entry['meets_floor'] else 'FAIL'}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
