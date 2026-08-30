"""Q5: can anything tell the named region from a bucket that merely overlaps it?

WHAT Q4 LEFT ON THE TABLE. The shipped chain's error control against "nothing is there" is close to
perfect -- 0 validated false claims in 8,000 null records, upper 95% CI 0.00048 against a 0.02
ceiling. On a world whose true effect lives in a region no bucket can express (`fast AND endgame`),
it validated a claim naming the WRONG SUBGROUP on 11% of records. The judge cannot catch that,
because it tests the frozen bucket and that bucket really does separate: the true region is a subset
of it and drags its mean along.

So this is not a question about false positives, and tightening `SEPARABILITY_K` does not touch it.
It is a question about ATTRIBUTION, and `shared/discovery/attribution.ts` is the test: split the
claimed bucket by each of the other bucketings and ask whether the gap inside it is homogeneous. If
some division of the bucket carries the whole thing, the claim is not attributable to the name it
was frozen under.

WHAT THIS FILE MEASURES, and why it is a sweep rather than a verdict. The test has one threshold,
`ATTRIBUTION_K`, and it buys one thing at the cost of another:

    a veto that fires too easily  ->  a TRUE claim is withheld            (silence)
    a veto that fires too rarely  ->  a MISATTRIBUTED claim goes through  (the wrong sentence)

Neither error is free and they move in opposite directions, so the threshold is a trade and a trade
is chosen from a table. The bridge reports the underlying statistic -- the largest |z| over the
readable splits -- so every candidate `k` is evaluated from ONE run of the chain rather than from a
re-run per value.

THE TWO POPULATIONS THE TABLE IS READ AGAINST, named before the run:

    FALSE VETO      measured on the CLEAN plants, where the planted region IS a bucket, so a claim
                    naming that bucket is right and any veto of it is wrong.
    CAUGHT          measured on `interaction-only` and `proxy-correlated`, where the planted region
                    is NOT a bucket, so a validated claim names something too wide and a veto of it
                    is the whole point.

WHAT IT DOES NOT MEASURE. Whether the narrower region the veto names is the true one. It usually
will not be exactly -- `fast AND endgame` is not `phase-endgame` -- and the test does not claim it
is: it withholds and names a division to pre-register next, rather than renaming the claim, because
renaming would be choosing a region after seeing the outcome on the data being judged.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.bridge import run_detector, to_line  # noqa: E402
from oracle.worlds import PLANTS, generate_record, split_at_game  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"

RECORDS_PER_PLANT = 400
GAMES_PER_RECORD = 40
DERIVATION_GAMES = 20
SEED = 20260831

#: Candidate thresholds. Swept, not guessed; the chosen one is written into attribution.ts.
K_SWEEP = (1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0)

#: Plants whose planted region IS one of the six buckets. A veto here is a false veto.
CLEAN_PLANTS = ("clean-middlegame", "clean-fast", "weak-middlegame", "weak-fast", "sparse-low-clock")
#: Plants whose planted region is NOT expressible as a bucket. A veto here is a catch.
MISATTRIBUTING_PLANTS = ("interaction-only", "proxy-correlated")

#: Declared before the run: how often the test may withhold a claim that was true as named.
FALSE_VETO_CEILING = 0.10


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (float("nan"), float("nan"))
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def run_plant(plant, records: int, seed: int) -> list[dict]:
    from dataclasses import replace as _replace

    from oracle.worlds import BASE

    rng = np.random.default_rng(seed)
    spec = _replace(BASE, name=f"plant-{plant.name}")
    drawn = [generate_record(rng, spec, GAMES_PER_RECORD, plant) for _ in range(records)]
    lines = (
        to_line(record, f"{plant.name}-{i}", plant.name, split_at_game(record, DERIVATION_GAMES))
        for i, record in enumerate(drawn)
    )
    return list(run_detector(lines))


def scorecard(plant, results: list[dict]) -> dict:
    """One row per plant: what the chain validated, and what attribution said about it."""
    n = len(results)
    target = plant.expressible_as

    # ONLY VALIDATED CLAIMS ARE IN SCOPE. Attribution runs after the judge, on a claim that already
    # cleared prospectively; counting records where nothing was claimed would dilute every rate
    # here with records the test never saw.
    validated = [r for r in results if r["validated"]]

    # Three silences, counted apart. "No claim" is not "claimed but unsplittable" and neither is
    # "split and homogeneous"; folding them together is how "we could not look" becomes "we looked".
    unreadable = sum(
        1 for r in validated if r["attribution"] is None or r["attribution"]["maxAbsZ"] is None
    )
    readable = [
        r for r in validated if r["attribution"] is not None and r["attribution"]["maxAbsZ"] is not None
    ]

    row: dict = {
        "plant": plant.name,
        "delta": plant.delta,
        "expressible_as": target,
        "records": n,
        "validated": len(validated),
        "validated_rate": len(validated) / n if n else float("nan"),
        # On a clean plant, a validated claim naming the target is RIGHT; on a misattributing plant
        # there is no right name, so every validated claim is one attribution should veto.
        "validated_on_target": sum(1 for r in validated if target is not None and r["selected"] == target),
        "attribution_unreadable": unreadable,
        "attribution_readable": len(readable),
        "by_k": {},
    }

    for k in K_SWEEP:
        vetoed = [r for r in readable if r["attribution"]["maxAbsZ"] >= k]
        row["by_k"][f"{k:.1f}"] = {
            "vetoed": len(vetoed),
            # Denominator is every validated claim, including the ones attribution could not read:
            # a claim it could not look at is a claim it did not stop.
            "veto_rate": len(vetoed) / len(validated) if validated else float("nan"),
            "veto_rate_ci": wilson(len(vetoed), len(validated)),
            # Which division the veto named, so a later pre-registration has somewhere to start.
            "named": _counts(r["attribution"]["splitBy"] for r in vetoed),
            "carried_excess": sum(1 for r in vetoed if r["attribution"]["carriesExcess"]),
        }
    return row


def _counts(keys) -> dict:
    out: dict[str, int] = {}
    for key in keys:
        if key is not None:
            out[key] = out.get(key, 0) + 1
    return dict(sorted(out.items(), key=lambda kv: (-kv[1], kv[0])))


#: The second block: is the test weak, or is the RECORD small? Sizes named before the run.
SIZE_SWEEP = (40, 80, 160)
#: Which plants the size block runs, chosen to hold one of each kind rather than all nine.
SIZE_PLANTS = ("clean-middlegame", "sparse-low-clock", "interaction-only", "proxy-correlated")
RECORDS_PER_SIZE = 250


def run_plant_at(plant, records: int, seed: int, games: int) -> list[dict]:
    """The same run, with a longer record. The derivation half is held at 20 games throughout.

    HELD, DELIBERATELY. Growing both halves would confound two effects -- a search that sees more
    and a test that sees more -- and only the second is what this block asks about. Twenty games is
    also what Q4 used, so the claim being attributed is the same claim it measured.
    """
    from dataclasses import replace as _replace

    from oracle.worlds import BASE

    rng = np.random.default_rng(seed)
    spec = _replace(BASE, name=f"plant-{plant.name}")
    drawn = [generate_record(rng, spec, games, plant) for _ in range(records)]
    lines = (
        to_line(record, f"{plant.name}-{i}", plant.name, split_at_game(record, DERIVATION_GAMES))
        for i, record in enumerate(drawn)
    )
    return list(run_detector(lines))


def main() -> int:
    rows = []
    for index, plant in enumerate(PLANTS):
        rows.append(scorecard(plant, run_plant(plant, RECORDS_PER_PLANT, SEED + 100 * index)))

    by_name = {row["plant"]: row for row in rows}

    # THE TRADE, AS A TABLE. Worst false-veto rate over the clean plants against the mean catch rate
    # over the misattributing ones, for every candidate threshold.
    trade = []
    for k in K_SWEEP:
        key = f"{k:.1f}"
        clean = [by_name[p]["by_k"][key]["veto_rate"] for p in CLEAN_PLANTS if p in by_name]
        wrong = [by_name[p]["by_k"][key]["veto_rate"] for p in MISATTRIBUTING_PLANTS if p in by_name]
        clean = [c for c in clean if c == c]  # drop NaN: a plant that validated nothing says nothing
        wrong = [w for w in wrong if w == w]
        trade.append(
            {
                "k": k,
                "worst_false_veto": max(clean) if clean else float("nan"),
                "mean_false_veto": sum(clean) / len(clean) if clean else float("nan"),
                "worst_caught": min(wrong) if wrong else float("nan"),
                "mean_caught": sum(wrong) / len(wrong) if wrong else float("nan"),
            }
        )

    # THE CHOICE RULE, WRITTEN DOWN BEFORE THE NUMBERS: the smallest k whose worst false-veto rate
    # is within the declared ceiling. Smallest, because among thresholds that respect the ceiling
    # the one that catches most is the one that vetoes most readily.
    admissible = [t for t in trade if t["worst_false_veto"] == t["worst_false_veto"] and t["worst_false_veto"] <= FALSE_VETO_CEILING]
    chosen = min(admissible, key=lambda t: t["k"]) if admissible else None

    # THE SECOND BLOCK. If the veto is weak because each split of a claimed bucket holds too few
    # decisions, then lengthening the VALIDATION half -- and only that half -- should move it. If it
    # does not, the weakness is the test rather than the record, which is a different conclusion and
    # a different thing to do about it.
    by_size = []
    for games in SIZE_SWEEP:
        block = []
        for index, name in enumerate(SIZE_PLANTS):
            plant = next(p for p in PLANTS if p.name == name)
            block.append(
                scorecard(plant, run_plant_at(plant, RECORDS_PER_SIZE, SEED + 7000 + 13 * index + games, games))
            )
        seen = {row["plant"]: row for row in block}
        for k in K_SWEEP:
            key = f"{k:.1f}"
            clean = [seen[p]["by_k"][key]["veto_rate"] for p in SIZE_PLANTS if p in CLEAN_PLANTS]
            wrong = [seen[p]["by_k"][key]["veto_rate"] for p in SIZE_PLANTS if p in MISATTRIBUTING_PLANTS]
            clean = [c for c in clean if c == c]
            wrong = [w for w in wrong if w == w]
            by_size.append(
                {
                    "games": games,
                    "validation_games": games - DERIVATION_GAMES,
                    "k": k,
                    "worst_false_veto": max(clean) if clean else float("nan"),
                    "mean_caught": sum(wrong) / len(wrong) if wrong else float("nan"),
                    "validated": {row["plant"]: row["validated"] for row in block},
                }
            )

    report = {
        "records_per_plant": RECORDS_PER_PLANT,
        "size_sweep": list(SIZE_SWEEP),
        "size_plants": list(SIZE_PLANTS),
        "records_per_size": RECORDS_PER_SIZE,
        "by_size": by_size,
        "games_per_record": GAMES_PER_RECORD,
        "derivation_games": DERIVATION_GAMES,
        "false_veto_ceiling": FALSE_VETO_CEILING,
        "k_sweep": list(K_SWEEP),
        "clean_plants": list(CLEAN_PLANTS),
        "misattributing_plants": list(MISATTRIBUTING_PLANTS),
        "plants": rows,
        "trade": trade,
        "chosen_k": chosen,
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "q5_attribution.json").write_text(json.dumps(report, indent=1) + "\n")

    lines = [
        "Q5 -- attribution: can anything tell the named region from a bucket that overlaps it?",
        "",
        f"{RECORDS_PER_PLANT} records per plant, {GAMES_PER_RECORD} games each, "
        f"{DERIVATION_GAMES} to derive and the rest to validate.",
        "",
        "PER PLANT",
        f"{'plant':<24} {'delta':>6} {'validated':>10} {'on-target':>10} {'unreadable':>11} {'readable':>9}",
    ]
    for row in rows:
        lines.append(
            f"{row['plant']:<24} {row['delta']:6.2f} {row['validated_rate']:10.4f} "
            f"{row['validated_on_target']:10d} {row['attribution_unreadable']:11d} "
            f"{row['attribution_readable']:9d}"
        )
    lines += [
        "",
        "THE TRADE  (false veto = a true claim withheld; caught = a misattributed claim stopped)",
        f"{'k':>5} {'worst false veto':>17} {'mean false veto':>16} {'worst caught':>13} {'mean caught':>12}",
    ]
    for t in trade:
        lines.append(
            f"{t['k']:5.1f} {t['worst_false_veto']:17.4f} {t['mean_false_veto']:16.4f} "
            f"{t['worst_caught']:13.4f} {t['mean_caught']:12.4f}"
        )
    lines += [
        "",
        f"Ceiling on the worst false-veto rate, declared before the run: {FALSE_VETO_CEILING:.2f}",
        (
            f"CHOSEN k = {chosen['k']:.1f}  "
            f"(worst false veto {chosen['worst_false_veto']:.4f}, mean caught {chosen['mean_caught']:.4f})"
            if chosen
            else "NO k RESPECTS THE CEILING -- the test is not usable as designed, and that is the finding."
        ),
        "",
        "IS IT THE TEST OR THE RECORD?  Derivation held at 20 games; only the validation half grows.",
        f"{'games':>6} {'validation':>11} {'k':>5} {'worst false veto':>17} {'mean caught':>12}",
    ]
    for row in by_size:
        lines.append(
            f"{row['games']:6d} {row['validation_games']:11d} {row['k']:5.1f} "
            f"{row['worst_false_veto']:17.4f} {row['mean_caught']:12.4f}"
        )
    text = "\n".join(lines) + "\n"
    (RESULTS / "q5_attribution.txt").write_text(text)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
