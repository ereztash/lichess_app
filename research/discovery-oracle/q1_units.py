"""Q1 of the M0 audit: is a decision an observation?

`shared/detector.ts` divides a bucket's gap variance by the number of DECISIONS in it. That is
correct if decisions are independent draws. `DecisionAtom` carries `game_id`, and moves from one
game share an opponent, an opening, a clock, a time control and a player who was in one state of
mind for all of them.

WHAT IS MEASURED, AND WHY IT IS NOT A RATIO OF TWO ESTIMATES. The obvious experiment -- compute
both standard errors on one record and divide -- answers the wrong question twice over. A
cluster-robust error estimated from twenty games is itself extremely noisy, so a single ratio says
more about that noise than about the product. And neither estimate is the truth.

THE TRUTH IS AVAILABLE HERE, and that is the whole reason for simulating. Records drawn from one
null world are independent replications, so the SPREAD OF THE CONTRAST ACROSS THEM is the sampling
error, measured rather than estimated. Every column below is judged against it:

    sd_empirical      the true standard error of the bucket contrast, from R independent records
    mean_se_product   what the shipped formula says it is, averaged over the same records
    mean_se_cluster   what statsmodels' cluster-robust error says it is
    sd_z_product      spread of gapDifference / se_product. ONE if the shipped error is right.
    fire_rate_*       how often |z| clears the shipped multiplier, which is the thing that ships

A `sd_z_product` of 1.3 means the product's stated 3.75-sigma bar is really a 2.9-sigma bar, and
the false-positive ceiling it was calibrated to does not hold.

THE SWEEP IS THE HONEST PART. How much of the gap is a property of the game rather than of the
decision is NOT KNOWN for real players -- nobody has measured it, because the product throws
`game_id` away before the detector sees it. So the answer is reported as a function of that
quantity, over a range that brackets any plausible value, together with the estimator that would
settle it once a record with game identity exists.
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.bridge import run_detector, to_line  # noqa: E402
from oracle.inference import estimates, intraclass_correlation, parity_check  # noqa: E402
from oracle.worlds import NULL_WORLDS, generate_record, split_at_game  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"

RECORDS_PER_WORLD = 400
GAMES_PER_RECORD = 40
DERIVATION_GAMES = 20
SEED = 20260830
#: The shipped six-bucket multiplier (`SEPARABILITY_K`). Read here only to report a rate against it.
SHIPPED_K = 3.75
#: The share of the gap's variance that is between games, swept because it is NOT KNOWN.
#:
#: THE TOP OF THE RANGE IS SET BY THE INSTRUMENT, NOT BY TASTE. A game-level gap component of
#: sigma has to fit inside the confidence grid: the least confident decision in the band still
#: needs an accuracy probability above zero, and `oracle/worlds.feasibility` refuses the
#: parameters when it does not. Against the narrowed band below, 0.12 is the largest value the
#: seven-level scale can carry. What lies beyond it is reported analytically instead, from the
#: Moulton relation, and is marked as extrapolation in the audit.
TILT_SWEEP = (0.0, 0.04, 0.08, 0.12)
#: The sweep narrows the confidence band so that ONLY sigma_tilt varies across its cells. Holding
#: the band at the ten worlds' [0.50, 0.80] would have forced the band to move with sigma, and the
#: sweep would then be measuring two changes at once.
SWEEP_BAND = (0.50, 0.65)


def measure(spec, records: int, seed: int) -> dict:
    rng = np.random.default_rng(seed)
    drawn = [generate_record(rng, spec, GAMES_PER_RECORD) for _ in range(records)]
    lines = (
        to_line(record, f"{spec.name}-{i}", spec.name, split_at_game(record, DERIVATION_GAMES), masks=True)
        for i, record in enumerate(drawn)
    )

    per_bucket: dict[str, dict[str, list[float]]] = {}
    iccs: list[float] = []
    worst_parity = {"se": 0.0, "beta": 0.0}
    for record, out in zip(drawn, run_detector(lines)):
        split = out["derivation"][0]["insideN"] + out["derivation"][0]["outsideN"] if out["derivation"] else 0
        del split
        gap_all = np.array(out["gap"])
        games_all = np.array(record["g"])
        # The derivation half only: it is the half the six-bucket scan ran on, and mixing the two
        # would average a search over a test.
        boundary = split_at_game(record, DERIVATION_GAMES)
        gap = gap_all[:boundary]
        games = games_all[:boundary]
        iccs.append(intraclass_correlation(gap, games))
        for bucket in out["derivation"]:
            if bucket["standardError"] is None:
                continue
            if bucket["insideN"] < 30 or bucket["outsideN"] < 30:
                continue
            index = np.array(bucket["inside"] + bucket["outside"])
            inside = np.zeros(index.size, dtype=bool)
            inside[: len(bucket["inside"])] = True
            estimate = estimates(gap[index], inside, games[index])
            if estimate is None:
                continue
            parity = parity_check(gap[index], inside, bucket["standardError"], bucket["gapDifference"])
            worst_parity["se"] = max(worst_parity["se"], parity["se_delta"])
            worst_parity["beta"] = max(worst_parity["beta"], parity["beta_delta"])
            slot = per_bucket.setdefault(
                bucket["key"],
                {"beta": [], "se_product": [], "se_cluster": [], "se_hc1": [], "cluster_size": []},
            )
            slot["beta"].append(bucket["gapDifference"])
            slot["se_product"].append(bucket["standardError"])
            slot["se_cluster"].append(estimate["se_cluster"])
            slot["se_hc1"].append(estimate["se_hc1"])
            slot["cluster_size"].append(estimate["mean_cluster_size"])

    rows = []
    for key, slot in sorted(per_bucket.items()):
        beta = np.array(slot["beta"])
        se_p = np.array(slot["se_product"])
        se_c = np.array(slot["se_cluster"])
        z_p = beta / se_p
        z_c = beta / se_c
        rows.append(
            {
                "bucket": key,
                "records": int(beta.size),
                "sd_empirical": float(beta.std(ddof=1)),
                "mean_se_product": float(se_p.mean()),
                "mean_se_cluster": float(se_c.mean()),
                "mean_se_hc1": float(np.mean(slot["se_hc1"])),
                "product_understates_by": float(beta.std(ddof=1) / se_p.mean()),
                "cluster_understates_by": float(beta.std(ddof=1) / se_c.mean()),
                "sd_z_product": float(z_p.std(ddof=1)),
                "sd_z_cluster": float(z_c.std(ddof=1)),
                "fire_rate_product": float((np.abs(z_p) >= SHIPPED_K).mean()),
                "fire_rate_cluster": float((np.abs(z_c) >= SHIPPED_K).mean()),
                "mean_cluster_size": float(np.mean(slot["cluster_size"])),
            }
        )
    return {
        "world": spec.name,
        "sigma_tilt": spec.sigma_tilt,
        "records": records,
        "games_per_record": GAMES_PER_RECORD,
        "derivation_games": DERIVATION_GAMES,
        "gap_icc_between_games": float(np.nanmean(iccs)),
        "worst_parity_delta": worst_parity,
        "buckets": rows,
    }


def main() -> int:
    RESULTS.mkdir(exist_ok=True)
    worlds = []
    for index, spec in enumerate(NULL_WORLDS):
        print(f"world {spec.name} ...", file=sys.stderr)
        worlds.append(measure(spec, RECORDS_PER_WORLD, SEED + index))

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
        sweep.append(measure(spec, RECORDS_PER_WORLD, SEED + 500 + index))

    report = {
        "shipped_k": SHIPPED_K,
        "records_per_world": RECORDS_PER_WORLD,
        "seed": SEED,
        "worlds": worlds,
        "tilt_sweep": sweep,
    }
    (RESULTS / "q1_units.json").write_text(json.dumps(report, indent=2))

    def show(entry: dict) -> None:
        print(f"\n{entry['world']}   gap ICC between games {entry['gap_icc_between_games']:.4f}")
        print(
            f"  {'bucket':18} {'true sd':>9} {'se product':>11} {'se cluster':>11} "
            f"{'sd z prod':>10} {'sd z clus':>10} {'fire prod':>10} {'fire clus':>10}"
        )
        for row in entry["buckets"]:
            print(
                f"  {row['bucket']:18} {row['sd_empirical']:9.5f} {row['mean_se_product']:11.5f} "
                f"{row['mean_se_cluster']:11.5f} {row['sd_z_product']:10.3f} {row['sd_z_cluster']:10.3f} "
                f"{row['fire_rate_product']:10.4f} {row['fire_rate_cluster']:10.4f}"
            )

    for entry in worlds:
        show(entry)
    for entry in sweep:
        show(entry)
    worst = max(
        (row["sd_z_product"] for entry in worlds + sweep for row in entry["buckets"]), default=float("nan")
    )
    print(f"\nworst sd(z) under the shipped error: {worst:.3f}")
    print(
        "worst parity delta against the shipped formula: "
        f"{max(e['worst_parity_delta']['se'] for e in worlds + sweep):.2e}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
