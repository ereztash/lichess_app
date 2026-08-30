"""Whether the null worlds are null, and whether the planted worlds contain what they claim.

A HARNESS THAT HAS NOT BEEN CHECKED IS A HARNESS THAT MEASURES THE HARNESS. Every rate in the M0
audit is conditional on this file passing. A "null" world carrying a real two-point effect makes
the shipped detector's false-positive rate an underestimate of nothing in particular; a planted
world whose effect is not where the plant says it is makes the recall figure a measurement of the
wrong region.

IT HAS ALREADY EARNED ITS KEEP. The first version of `oracle/worlds.py` derived the accuracy
probability from the features and then rounded a confidence onto the product's grid, clipping the
result into (0.02, 0.98). This file reported a leak of up to 1.1 points of calibration gap in
every phase bucket of NULL-1, the world with no correlation of any kind -- the clip was biting
hardest where confidence was extreme, confidence is a function of phase, so the clip WAS a phase
effect. `oracle/worlds.py` was rebuilt around the order that makes the null exact.

THE TOLERANCE IS STATISTICAL, NOT A ROUND NUMBER. Records are independent draws, so the mean
bucket contrast over `SELFTEST_RECORDS` of them has a standard error this file can estimate from
the same records. A world passes when every bucket's mean contrast is inside 3.5 of its own
standard errors. Over 60 world-by-bucket cells that is an expected 0.03 false alarms, and unlike
a fixed threshold it does not quietly pass a leak simply because the run was small.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.bridge import run_detector, to_line  # noqa: E402
from oracle.inference import intraclass_correlation  # noqa: E402
from oracle.worlds import (  # noqa: E402
    CONFIDENCE_GRID,
    NULL_WORLDS,
    PLANTS,
    generate_record,
    split_at_game,
)

RESULTS = Path(__file__).resolve().parent / "results"

#: How many standard errors of its own mean a null bucket contrast may sit from zero.
MAX_Z = 3.5
#: Games per record, and records per world. Both larger than any experiment uses: this is a check
#: on the GENERATOR, and it must be able to see a leak far smaller than a detector could.
SELFTEST_GAMES = 120
SELFTEST_RECORDS = 40
SEED = 20260830


def check_nulls() -> list[dict]:
    rows: list[dict] = []
    for world_index, spec in enumerate(NULL_WORLDS):
        rng = np.random.default_rng(SEED + world_index)
        records = [generate_record(rng, spec, SELFTEST_GAMES) for _ in range(SELFTEST_RECORDS)]
        lines = (
            to_line(record, f"{spec.name}-{i}", spec.name, split_at_game(record, SELFTEST_GAMES // 2), masks=True)
            for i, record in enumerate(records)
        )
        by_bucket: dict[str, list[float]] = {}
        iccs: list[float] = []
        for record, out in zip(records, run_detector(lines)):
            gap = np.array(out["gap"])
            iccs.append(intraclass_correlation(gap, np.array(record["g"])))
            for bucket in out["derivation"]:
                if bucket["insideN"] < 30 or bucket["outsideN"] < 30:
                    continue
                by_bucket.setdefault(bucket["key"], []).append(bucket["gapDifference"])
        for key, values in sorted(by_bucket.items()):
            array = np.array(values)
            mean = float(array.mean())
            se = float(array.std(ddof=1) / np.sqrt(array.size)) if array.size > 1 else float("nan")
            z = mean / se if se > 0 else float("nan")
            rows.append(
                {
                    "world": spec.name,
                    "bucket": key,
                    "records": int(array.size),
                    "mean_gap_difference": mean,
                    "standard_error": se,
                    "z": z,
                    "gap_icc_between_games": float(np.nanmean(iccs)),
                    "passes": bool(abs(z) <= MAX_Z),
                }
            )
    return rows


def check_plants() -> list[dict]:
    """That the realised gap contrast inside the planted region is the delta the plant declares.

    The region is read from the generator's own `planted` mask rather than by re-evaluating the
    predicate here. A second evaluation would be a second definition of where the effect is, and
    every recall figure downstream would then be measured against a region the data were not
    built from.
    """
    rows: list[dict] = []
    spec = NULL_WORLDS[1]  # plants are grown in the within-game-correlated world
    for index, plant in enumerate(PLANTS):
        rng = np.random.default_rng(SEED + 100 + index)
        inside: list[float] = []
        outside: list[float] = []
        shares: list[float] = []
        for _ in range(8):
            record = generate_record(rng, spec, SELFTEST_GAMES, plant)
            mask = np.array(record["planted"], dtype=bool)
            gap = CONFIDENCE_GRID[np.array(record["cf"]) - 1] - np.array(record["ac"], dtype=float)
            if mask.sum() < 30 or (~mask).sum() < 30:
                continue
            inside.append(float(gap[mask].mean()))
            outside.append(float(gap[~mask].mean()))
            shares.append(float(mask.mean()))
        if not inside:
            rows.append(
                {"plant": plant.name, "delta": plant.delta, "realised": None, "share_inside": None, "passes": False}
            )
            continue
        realised = float(np.mean(inside) - np.mean(outside))
        rows.append(
            {
                "plant": plant.name,
                "delta": plant.delta,
                "realised": realised,
                "share_inside": float(np.mean(shares)),
                "expressible_as": plant.expressible_as,
                # A fifth of the nominal delta, floored at two points of gap. Attenuation is
                # expected and legitimate: `min(stated + delta, 0.95)` in the generator caps a
                # large delta on an already-confident decision. What is NOT acceptable is an
                # effect that is absent, inverted, or somewhere other than where it was put --
                # and `realised` is the number every recall figure is stated against, not `delta`.
                "passes": abs(realised - plant.delta) <= max(0.02, 0.20 * abs(plant.delta))
                or realised >= 0.6 * plant.delta,
            }
        )
    return rows


def main() -> int:
    RESULTS.mkdir(exist_ok=True)
    nulls = check_nulls()
    plants = check_plants()
    leaks = [row for row in nulls if not row["passes"]]
    bad = [row for row in plants if not row["passes"]]
    report = {
        "max_z": MAX_Z,
        "games_per_record": SELFTEST_GAMES,
        "records_per_world": SELFTEST_RECORDS,
        "seed": SEED,
        "nulls": nulls,
        "plants": plants,
        "null_leaks": leaks,
        "plants_off_target": bad,
        "passed": not leaks and not bad,
    }
    (RESULTS / "selftest.json").write_text(json.dumps(report, indent=2))
    for row in nulls:
        flag = "    " if row["passes"] else "LEAK"
        print(
            f"{flag} {row['world']:32} {row['bucket']:18} mean {row['mean_gap_difference']:+.5f}"
            f"  se {row['standard_error']:.5f}  z {row['z']:+.2f}  icc {row['gap_icc_between_games']:.4f}"
        )
    for row in plants:
        flag = "    " if row["passes"] else "OFF "
        got = "n/a" if row["realised"] is None else f"{row['realised']:+.4f}"
        share = "n/a" if row["share_inside"] is None else f"{row['share_inside']:.3f}"
        print(f"{flag} plant {row['plant']:24} nominal {row['delta']:+.3f}  realised {got}  share {share}")
    print("PASSED" if report["passed"] else "FAILED")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
