"""R-18: what the shipped six-bucket search does on a record made entirely of blitz games.

THE QUESTION, AND WHY IT IS NOT ANSWERED BY Q4. `q4_end_to_end.py` draws time controls from four
orders of pace -- 3+0, 5+3, 10+0, 30+0 -- and its own comment says why: the spread is where the
within-game correlation of bucket MEMBERSHIP comes from, and without it the clustered and
unclustered errors would agree by construction. That is the right world for the question Q4 asks.

It is the wrong world for a player who only plays blitz, and the blitz route exists for that player.
`tests/shared/a-line-nobody-crossed.test.ts` measured the consequence directly on a synthetic 3+0
record: `fast-under-45s` comes out 480 inside and 0 outside, `slow-over-2m` the mirror. Two of the
six splits are structurally dead, and one of them is the bucket the product's whole narrative rests
on -- when you have little time, you commit before you have checked.

WHAT THIS FILE ADDS is the end-to-end consequence, in the same units Q4 reports, so the two tables
can be read side by side:

    1. the false-claim rate on blitz-only null worlds. A search with two dead buckets is a search
       over FOUR, and fewer comparisons cannot raise a false-positive rate -- but "cannot" is an
       argument and this project measures instead.
    2. the recall of a `clean-fast` plant on a blitz-only world. Q4 measures 0.1250 validated on
       target with four pace bands available. The prediction here is 0.0000, because the region the
       plant lives in is a bucket that has no outside.
    3. the same for `clean-middlegame`, as the control. If the blitz worlds broke everything, the
       phase plant would fall too, and this file would be measuring its own fixture.

NOTHING HERE PROPOSES A NEW BUCKET. `SEPARABILITY_K = 3.75` is a measurement of those six searched
together, so a seventh or a redefined one needs its own false-positive rate before it may be
searched at all -- and choosing WHICH relative-time definition to measure is a decision with
alternatives, argued in `docs/decisions/D09-blitz-time.md` rather than settled by whoever wrote the
harness first.
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.bridge import run_detector, to_line  # noqa: E402
from oracle.worlds import BASE, PLANTS, generate_record, split_at_game  # noqa: E402
from q4_end_to_end import (  # noqa: E402
    DERIVATION_GAMES,
    FALSE_CLAIM_CEILING,
    GAMES_PER_RECORD,
    null_scorecard,
    planted_scorecard,
    wilson,
)

RESULTS = Path(__file__).resolve().parent / "results"

#: Smaller than Q4's 800 because this asks a narrower question and the bridge is the slow part.
#: Reported with its Wilson bound like every other rate here, so the size is visible rather than
#: implied.
RECORDS_PER_WORLD = 400
SEED = 20260831

#: BLITZ ONLY, AND THE TWO CONTROLS THE PRODUCT ITSELF OFFERS FIRST.
#: `Blitz.tsx` lists 3+0, 3+2, 5+0 and 5+5. Two of them here, weighted toward the shortest, because
#: the question is about the SHORT end and a spread would reintroduce exactly what Q4 already has.
BLITZ_CONTROLS = ((180_000, 0, 0.6), (300_000, 3_000, 0.4))

#: The same nulls Q4 uses, restricted to blitz. Four rather than ten: these are the four whose
#: mechanisms could plausibly interact with a saturated bucket -- independence, within-game
#: correlation, a skewed think-time distribution, and missingness that depends on pace.
BLITZ_NULLS = (
    replace(BASE, name="BLITZ-NULL-1-independent", time_controls=BLITZ_CONTROLS,
            sigma_tilt=0.0, sigma_conf=0.0, sigma_pace=0.0),
    replace(BASE, name="BLITZ-NULL-2-within-game-correlated", time_controls=BLITZ_CONTROLS),
    replace(BASE, name="BLITZ-NULL-3-skewed-features", time_controls=BLITZ_CONTROLS, sigma_time=1.35),
    replace(BASE, name="BLITZ-NULL-5-informative-missingness", time_controls=BLITZ_CONTROLS,
            clock_missing_rate=0.25, missingness_informative=True),
)

#: One plant in a dead bucket, one in a live one. The second is the control on the fixture.
BLITZ_PLANTS = tuple(p for p in PLANTS if p.name in ("clean-fast", "clean-middlegame"))


def run_world(spec, records: int, seed: int, plant=None) -> list[dict]:
    rng = np.random.default_rng(seed)
    drawn = [generate_record(rng, spec, GAMES_PER_RECORD, plant) for _ in range(records)]
    lines = (
        to_line(record, f"{spec.name}-{i}", spec.name, split_at_game(record, DERIVATION_GAMES), sides=True)
        for i, record in enumerate(drawn)
    )
    return list(run_detector(lines))


#: The floor `detect` itself applies to BOTH sides of a split. Duplicated from `shared/detector.ts`
#: on purpose: a study that imported it would report "readable" against whatever the constant
#: happens to be, and this table's whole job is to say what the shipped floor does to a blitz
#: record. `tests/shared/what-the-documents-still-say.test.ts` holds the two together.
MIN_BUCKET_N = 30


def bucket_liveness(results: list[dict]) -> dict[str, dict[str, float]]:
    """How often each bucket was READABLE AT ALL, and how often it was readable BY THE DETECTOR.

    THREE COLUMNS AND NOT TWO, and the first draft of this function had two and was misleading.
    It counted `inside > 0 and outside > 0` as readable, which reported `fast-under-45s` readable on
    100% of blitz records -- true, and useless, because ONE decision on the far side satisfies it
    while `detect` needs `MIN_BUCKET_N` on both. The two numbers are 1.0000 and 0.0000 on the same
    data, and only the second describes what the product does.

    So: `nonempty` is the weak sense, kept because the gap between it and `usable` is exactly the
    finding -- a bucket that technically divides the record and cannot be measured. `usable` is the
    detector's own floor. `cleared` is what passed the separability test.
    """
    counts: dict[str, dict[str, float]] = {}
    for r in results:
        for key, side in (r.get("sides") or {}).items():
            row = counts.setdefault(key, {"nonempty": 0.0, "usable": 0.0, "cleared": 0.0, "n": 0.0})
            row["n"] += 1
            if side["inside"] > 0 and side["outside"] > 0:
                row["nonempty"] += 1
            if min(side["inside"], side["outside"]) >= MIN_BUCKET_N:
                row["usable"] += 1
        for key in r["cleared"]:
            counts.setdefault(key, {"nonempty": 0.0, "usable": 0.0, "cleared": 0.0, "n": 0.0})[
                "cleared"
            ] += 1
    return counts


def main() -> int:
    RESULTS.mkdir(exist_ok=True)
    report: dict = {"seed": SEED, "records_per_world": RECORDS_PER_WORLD, "controls": BLITZ_CONTROLS}
    lines: list[str] = []

    lines.append(f"{'world':38} {'n':>5} {'any bucket':>12} {'claim':>8} {'validated':>10} {'upper 95%':>10}")
    nulls = []
    pooled_validated = 0
    pooled_n = 0
    liveness: dict[str, dict[str, float]] = {}
    for i, spec in enumerate(BLITZ_NULLS):
        results = run_world(spec, RECORDS_PER_WORLD, SEED + i)
        card = null_scorecard(spec.name, results)
        nulls.append(card)
        pooled_validated += card["validated_claims"]
        pooled_n += card["records"]
        for key, row in bucket_liveness(results).items():
            live = liveness.setdefault(key, {"nonempty": 0.0, "usable": 0.0, "cleared": 0.0, "n": 0.0})
            for field in ("nonempty", "usable", "cleared", "n"):
                live[field] += row[field]
        lines.append(
            f"{spec.name:38} {card['records']:>5} {card['any_bucket_rate']:>12.4f} "
            f"{card['claim_formed_rate']:>8.4f} {card['false_validated_rate']:>10.4f} "
            f"{card['false_validated_rate_ci'][1]:>10.4f}"
        )

    low, high = wilson(pooled_validated, pooled_n)
    verdict = "PASS" if high < FALSE_CLAIM_CEILING else "FAIL"
    lines.append("")
    lines.append(
        f"pooled blitz null: {pooled_validated}/{pooled_n} = {pooled_validated / max(pooled_n, 1):.4f}"
        f"  95% CI [{low:.4f}, {high:.4f}]  ceiling {FALSE_CLAIM_CEILING}  -> {verdict}"
    )

    lines.append("")
    lines.append(
        f"{'bucket':20} {'non-empty':>10} {'usable':>9} {'cleared':>9}   (share of records, pooled nulls)"
    )
    for key in sorted(liveness):
        row = liveness[key]
        n = max(row["n"], 1)
        lines.append(
            f"{key:20} {row['nonempty'] / n:>10.4f} {row['usable'] / n:>9.4f} {row['cleared'] / n:>9.4f}"
        )

    lines.append("")
    lines.append(f"{'plant':22} {'delta':>7} {'recall':>8} {'on target':>10} {'validated':>10} {'on target':>10}")
    plants = []
    for i, plant in enumerate(BLITZ_PLANTS):
        spec = replace(BASE, name=f"BLITZ-{plant.name}", time_controls=BLITZ_CONTROLS)
        results = run_world(spec, RECORDS_PER_WORLD, SEED + 100 + i, plant)
        card = planted_scorecard(plant, results)
        plants.append(card)
        lines.append(
            f"{plant.name:22} {plant.delta:>7.3f} {card['any_bucket_recall']:>8.4f} "
            f"{card['predicate_recovery']:>10.4f} {card['validation_success']:>10.4f} "
            f"{card['validated_on_target']:>10.4f}"
        )

    report["nulls"] = nulls
    report["pooled_null"] = {"validated": pooled_validated, "n": pooled_n, "ci": [low, high]}
    report["bucket_liveness"] = liveness
    report["plants"] = plants

    text = "\n".join(lines) + "\n"
    (RESULTS / "q6_blitz_time.txt").write_text(text, encoding="utf-8")
    (RESULTS / "q6_blitz_time.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
